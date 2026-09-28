const crypto = require('crypto');
const fs = require('fs');

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const AUTH_BASE = 'https://login.microsoftonline.com/common/oauth2/v2.0';
const GRAPH_SCOPES = 'offline_access User.Read Files.ReadWrite';
const DEFAULT_FOLDER = 'Backups PlennaTec';
const DEFAULT_RETENTION = 4;
const CHUNK_SIZE = 10 * 1024 * 1024;
const LOCK_ID = 774209281;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function envConfig() {
  return {
    clientId: String(process.env.ONEDRIVE_CLIENT_ID || '').trim(),
    clientSecret: String(process.env.ONEDRIVE_CLIENT_SECRET || '').trim(),
    redirectUri: String(process.env.ONEDRIVE_REDIRECT_URI || '').trim(),
    encryptionKey: String(process.env.ONEDRIVE_TOKEN_ENCRYPTION_KEY || '').trim(),
    folderName: String(process.env.ONEDRIVE_BACKUP_FOLDER || DEFAULT_FOLDER).trim() || DEFAULT_FOLDER,
    retention: Math.max(1, Number.parseInt(process.env.ONEDRIVE_BACKUP_RETENTION || DEFAULT_RETENTION, 10) || DEFAULT_RETENTION)
  };
}

function missingConfig() {
  const config = envConfig();
  const missing = [];
  if (!config.clientId) missing.push('ONEDRIVE_CLIENT_ID');
  if (!config.clientSecret) missing.push('ONEDRIVE_CLIENT_SECRET');
  if (!config.redirectUri) missing.push('ONEDRIVE_REDIRECT_URI');
  if (!config.encryptionKey) missing.push('ONEDRIVE_TOKEN_ENCRYPTION_KEY');
  return missing;
}

function tokenKey() {
  const secret = envConfig().encryptionKey;
  if (!secret) throw new Error('ONEDRIVE_TOKEN_ENCRYPTION_KEY não configurada.');
  return crypto.createHash('sha256').update(secret).digest();
}

function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', tokenKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join(':');
}

function decrypt(value) {
  const [version, iv64, tag64, data64] = String(value || '').split(':');
  if (version !== 'v1' || !iv64 || !tag64 || !data64) throw new Error('Credencial do OneDrive inválida.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', tokenKey(), Buffer.from(iv64, 'base64'));
  decipher.setAuthTag(Buffer.from(tag64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data64, 'base64')), decipher.final()]).toString('utf8');
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch (error) { return text; }
}

function responseMessage(body, fallback) {
  return body?.error?.message || body?.error_description || (typeof body === 'string' ? body : fallback);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const body = await parseResponse(response);
  if (!response.ok) {
    const error = new Error(responseMessage(body, `Erro HTTP ${response.status}`));
    error.status = response.status;
    error.body = body;
    error.retryAfter = Number(response.headers.get('retry-after') || 0);
    throw error;
  }
  return body;
}

async function initializeTables(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS onedrive_backup_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      refresh_token_enc TEXT NOT NULL,
      account_name TEXT,
      account_email TEXT,
      drive_id TEXT,
      connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS onedrive_backup_runs (
      id BIGSERIAL PRIMARY KEY,
      schedule_key TEXT UNIQUE NOT NULL,
      trigger_type TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at TIMESTAMPTZ,
      file_name TEXT,
      local_size BIGINT,
      remote_item_id TEXT,
      remote_size BIGINT,
      message TEXT
    )
  `);
  await pool.query(`
    UPDATE onedrive_backup_runs
    SET status = 'error', finished_at = NOW(), message = 'Execução interrompida antes da conclusão.'
    WHERE status = 'running' AND started_at < NOW() - INTERVAL '6 hours'
  `);
}

async function exchangeToken(params) {
  const config = envConfig();
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    scope: GRAPH_SCOPES,
    ...params
  });
  return requestJson(`${AUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
}

async function getStoredConfig(pool) {
  await initializeTables(pool);
  const result = await pool.query('SELECT * FROM onedrive_backup_config WHERE id = 1');
  return result.rows[0] || null;
}

async function saveConnection(pool, token, profile, drive) {
  if (!token.refresh_token) throw new Error('A Microsoft não retornou autorização para acesso offline.');
  await initializeTables(pool);
  await pool.query(`
    INSERT INTO onedrive_backup_config
      (id, refresh_token_enc, account_name, account_email, drive_id, connected_at, updated_at)
    VALUES (1, $1, $2, $3, $4, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      refresh_token_enc = EXCLUDED.refresh_token_enc,
      account_name = EXCLUDED.account_name,
      account_email = EXCLUDED.account_email,
      drive_id = EXCLUDED.drive_id,
      connected_at = NOW(),
      updated_at = NOW()
  `, [
    encrypt(token.refresh_token),
    profile?.displayName || '',
    profile?.mail || profile?.userPrincipalName || '',
    drive?.id || ''
  ]);
}

async function getAccessToken(pool) {
  const stored = await getStoredConfig(pool);
  if (!stored) throw new Error('OneDrive ainda não conectado.');
  const token = await exchangeToken({
    grant_type: 'refresh_token',
    refresh_token: decrypt(stored.refresh_token_enc)
  });
  if (token.refresh_token) {
    await pool.query(
      'UPDATE onedrive_backup_config SET refresh_token_enc = $1, updated_at = NOW() WHERE id = 1',
      [encrypt(token.refresh_token)]
    );
  }
  return token.access_token;
}

async function graphRequest(accessToken, pathOrUrl, options = {}) {
  const url = pathOrUrl.startsWith('https://') ? pathOrUrl : `${GRAPH_BASE}${pathOrUrl}`;
  return requestJson(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
}

async function ensureBackupFolder(accessToken) {
  const folderName = envConfig().folderName;
  try {
    return await graphRequest(accessToken, `/me/drive/root:/${encodeURIComponent(folderName)}`);
  } catch (error) {
    if (error.status !== 404) throw error;
  }
  return graphRequest(accessToken, '/me/drive/root/children', {
    method: 'POST',
    body: JSON.stringify({
      name: folderName,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'fail'
    })
  });
}

async function createUploadSession(accessToken, folderId, fileName) {
  const encodedName = encodeURIComponent(fileName);
  return graphRequest(accessToken, `/me/drive/items/${encodeURIComponent(folderId)}:/${encodedName}:/createUploadSession`, {
    method: 'POST',
    body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'replace', name: fileName } })
  });
}

async function uploadChunk(uploadUrl, chunk, start, total) {
  let attempt = 0;
  while (attempt < 6) {
    try {
      const end = start + chunk.length - 1;
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Length': String(chunk.length),
          'Content-Range': `bytes ${start}-${end}/${total}`
        },
        body: chunk
      });
      const body = await parseResponse(response);
      if (response.ok) return { status: response.status, body };
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable) {
        const error = new Error(responseMessage(body, `Falha no upload: HTTP ${response.status}`));
        error.status = response.status;
        throw error;
      }
      const retryAfter = Number(response.headers.get('retry-after') || 0);
      await sleep(retryAfter > 0 ? retryAfter * 1000 : Math.min(30000, 1000 * (2 ** attempt)));
    } catch (error) {
      if (error.status && error.status < 500 && error.status !== 429) throw error;
      if (attempt === 5) throw error;
      await sleep(Math.min(30000, 1000 * (2 ** attempt)));
    }
    attempt += 1;
  }
  throw new Error('Não foi possível enviar uma parte do backup ao OneDrive.');
}

async function uploadLargeFile(accessToken, folderId, filePath, fileName) {
  const stat = await fs.promises.stat(filePath);
  const session = await createUploadSession(accessToken, folderId, fileName);
  if (!session?.uploadUrl) throw new Error('A Microsoft não retornou uma sessão de upload.');

  const handle = await fs.promises.open(filePath, 'r');
  let offset = 0;
  let completed = null;
  try {
    while (offset < stat.size) {
      const length = Math.min(CHUNK_SIZE, stat.size - offset);
      const buffer = Buffer.allocUnsafe(length);
      const { bytesRead } = await handle.read(buffer, 0, length, offset);
      if (!bytesRead) throw new Error('Leitura inesperadamente interrompida durante o upload.');
      const result = await uploadChunk(session.uploadUrl, buffer.subarray(0, bytesRead), offset, stat.size);
      if (result.status === 200 || result.status === 201) {
        completed = result.body;
        offset = stat.size;
      } else {
        const next = Number.parseInt(String(result.body?.nextExpectedRanges?.[0] || `${offset + bytesRead}-`).split('-')[0], 10);
        offset = Number.isFinite(next) ? next : offset + bytesRead;
      }
    }
  } finally {
    await handle.close();
  }

  if (!completed?.id) throw new Error('O OneDrive recebeu as partes, mas não confirmou a criação do arquivo.');
  if (Number(completed.size) !== Number(stat.size)) {
    throw new Error(`Tamanho divergente no OneDrive: local ${stat.size}, remoto ${completed.size}.`);
  }
  return { item: completed, size: stat.size };
}

async function listFolderChildren(accessToken, folderId) {
  let url = `${GRAPH_BASE}/me/drive/items/${encodeURIComponent(folderId)}/children?$select=id,name,size,createdDateTime,file&$top=200`;
  const items = [];
  while (url) {
    const page = await graphRequest(accessToken, url);
    items.push(...(page?.value || []));
    url = page?.['@odata.nextLink'] || '';
  }
  return items;
}

async function applyRetention(accessToken, driveId, folderId, keepItemId) {
  const retention = envConfig().retention;
  const items = (await listFolderChildren(accessToken, folderId))
    .filter(item => item.file && /^plennatec-backup-completo-.*\.zip$/i.test(item.name || ''))
    .sort((a, b) => new Date(b.createdDateTime) - new Date(a.createdDateTime));

  const keep = new Set(items.slice(0, retention).map(item => item.id));
  keep.add(keepItemId);
  const deleted = [];
  for (const item of items) {
    if (keep.has(item.id)) continue;
    await graphRequest(accessToken, `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(item.id)}/permanentDelete`, {
      method: 'POST'
    });
    deleted.push(item.name);
  }
  return deleted;
}

function saoPauloParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

function scheduledRunKey(date = new Date()) {
  const p = saoPauloParts(date);
  if (p.weekday !== 'Sun' || p.hour !== '02') return '';
  return `weekly-${p.year}-${p.month}-${p.day}`;
}

function createOneDriveBackupService({ pool, backupDir, generateCompleteBackup }) {
  let running = false;

  async function status() {
    await initializeTables(pool);
    const [configResult, runResult] = await Promise.all([
      pool.query('SELECT account_name, account_email, connected_at, updated_at FROM onedrive_backup_config WHERE id = 1'),
      pool.query('SELECT * FROM onedrive_backup_runs ORDER BY started_at DESC LIMIT 1')
    ]);
    return {
      configured: missingConfig().length === 0,
      missing: missingConfig(),
      connected: configResult.rowCount > 0,
      account: configResult.rows[0] || null,
      lastRun: runResult.rows[0] || null,
      running,
      folderName: envConfig().folderName,
      retention: envConfig().retention
    };
  }

  function authorizationUrl(state) {
    const config = envConfig();
    const params = new URLSearchParams({
      client_id: config.clientId,
      response_type: 'code',
      redirect_uri: config.redirectUri,
      response_mode: 'query',
      scope: GRAPH_SCOPES,
      state,
      prompt: 'select_account'
    });
    return `${AUTH_BASE}/authorize?${params.toString()}`;
  }

  async function connectFromCode(code) {
    const token = await exchangeToken({ grant_type: 'authorization_code', code });
    const [profile, drive] = await Promise.all([
      graphRequest(token.access_token, '/me'),
      graphRequest(token.access_token, '/me/drive')
    ]);
    await saveConnection(pool, token, profile, drive);
    return { profile, drive };
  }

  async function disconnect() {
    await initializeTables(pool);
    await pool.query('DELETE FROM onedrive_backup_config WHERE id = 1');
  }

  async function run({ triggerType = 'manual', scheduleKey = '' } = {}) {
    if (running) return { started: false, reason: 'Já existe um backup em execução.' };
    if (missingConfig().length) return { started: false, reason: `Configuração ausente: ${missingConfig().join(', ')}` };
    const stored = await getStoredConfig(pool);
    if (!stored) return { started: false, reason: 'OneDrive ainda não conectado.' };

    const key = scheduleKey || `manual-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const client = await pool.connect();
    let lockAcquired = false;
    try {
      const lock = await client.query('SELECT pg_try_advisory_lock($1) AS acquired', [LOCK_ID]);
      lockAcquired = !!lock.rows[0]?.acquired;
      if (!lockAcquired) return { started: false, reason: 'Outro servidor já está executando o backup.' };

      const inserted = await client.query(`
        INSERT INTO onedrive_backup_runs (schedule_key, trigger_type, status)
        VALUES ($1, $2, 'running')
        ON CONFLICT (schedule_key) DO UPDATE SET
          trigger_type = EXCLUDED.trigger_type,
          status = 'running',
          started_at = NOW(),
          finished_at = NULL,
          message = NULL
        WHERE onedrive_backup_runs.status = 'error'
        RETURNING id
      `, [key, triggerType]);
      if (!inserted.rowCount) return { started: false, reason: 'Este backup semanal já foi executado.' };

      const runId = inserted.rows[0].id;
      running = true;
      try {
        const generated = await generateCompleteBackup();
        const filePath = `${backupDir}/${generated.arquivo}`;
        const accessToken = await getAccessToken(pool);
        const folder = await ensureBackupFolder(accessToken);
        const uploaded = await uploadLargeFile(accessToken, folder.id, filePath, generated.arquivo);
        const driveId = folder.parentReference?.driveId || stored.drive_id;
        if (!driveId) throw new Error('Não foi possível identificar o OneDrive conectado.');
        const deleted = await applyRetention(accessToken, driveId, folder.id, uploaded.item.id);

        await pool.query(`
          UPDATE onedrive_backup_runs
          SET status = 'success', finished_at = NOW(), file_name = $2, local_size = $3,
              remote_item_id = $4, remote_size = $5, message = $6
          WHERE id = $1
        `, [runId, generated.arquivo, uploaded.size, uploaded.item.id, uploaded.item.size,
          deleted.length ? `Enviado e validado. ${deleted.length} backup(s) antigo(s) excluído(s).` : 'Enviado e validado.']);

        for (const intermediate of generated.intermediateFiles || []) {
          try { await fs.promises.unlink(`${backupDir}/${intermediate}`); } catch (error) {}
        }
        return { started: true, success: true, fileName: generated.arquivo };
      } catch (error) {
        await pool.query(`
          UPDATE onedrive_backup_runs
          SET status = 'error', finished_at = NOW(), message = $2
          WHERE id = $1
        `, [runId, String(error.message || error).slice(0, 2000)]);
        throw error;
      } finally {
        running = false;
      }
    } finally {
      if (lockAcquired) {
        try { await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]); } catch (error) {}
      }
      client.release();
    }
  }

  async function schedulerTick() {
    const key = scheduledRunKey();
    if (!key || running || missingConfig().length) return;
    try {
      const stored = await getStoredConfig(pool);
      if (!stored) return;
      await run({ triggerType: 'scheduled', scheduleKey: key });
    } catch (error) {
      console.error('[OneDrive backup] Falha na execução agendada:', error.message);
    }
  }

  function startScheduler() {
    initializeTables(pool).catch(error => console.error('[OneDrive backup] Falha ao preparar tabelas:', error.message));
    const timer = setInterval(schedulerTick, 10 * 60 * 1000);
    if (typeof timer.unref === 'function') timer.unref();
    setTimeout(schedulerTick, 30 * 1000).unref?.();
  }

  return {
    authorizationUrl,
    connectFromCode,
    disconnect,
    run,
    startScheduler,
    status
  };
}

module.exports = {
  createOneDriveBackupService,
  _test: { scheduledRunKey, saoPauloParts }
};
