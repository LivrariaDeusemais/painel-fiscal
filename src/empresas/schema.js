function ensure(pool) {
  return pool.query(`
    CREATE TABLE IF NOT EXISTS cliente_empresas (
      id UUID PRIMARY KEY,
      nome TEXT NOT NULL,
      razao_social TEXT,
      cnpj TEXT UNIQUE,
      logo BYTEA,
      logo_tipo TEXT,
      modulos JSONB NOT NULL DEFAULT '{}',
      versao INTEGER NOT NULL DEFAULT 1,
      criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS cliente_usuarios (
      id UUID PRIMARY KEY,
      empresa_id UUID NOT NULL REFERENCES cliente_empresas(id),
      email TEXT NOT NULL UNIQUE,
      nome TEXT NOT NULL,
      senha_hash TEXT NOT NULL,
      permissoes JSONB NOT NULL DEFAULT '{}',
      confirmado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS cliente_convites (
      empresa_id UUID PRIMARY KEY REFERENCES cliente_empresas(id),
      email TEXT NOT NULL UNIQUE,
      token_hash TEXT NOT NULL UNIQUE,
      expira_em TIMESTAMPTZ NOT NULL,
      aceito_em TIMESTAMPTZ,
      revogado_em TIMESTAMPTZ,
      permissoes JSONB NOT NULL DEFAULT '{}',
      versao INTEGER NOT NULL DEFAULT 1,
      envio TEXT NOT NULL CHECK (envio IN ('enviando','enviado','falhou')),
      criado_por TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cliente_categorias (
      empresa_id UUID NOT NULL REFERENCES cliente_empresas(id),
      id UUID NOT NULL,
      nome TEXT NOT NULL,
      PRIMARY KEY(empresa_id,id),
      UNIQUE(empresa_id,nome)
    );
    CREATE TABLE IF NOT EXISTS cliente_fornecedores (
      empresa_id UUID NOT NULL REFERENCES cliente_empresas(id),
      id UUID NOT NULL,
      nome TEXT NOT NULL,
      PRIMARY KEY(empresa_id,id),
      UNIQUE(empresa_id,nome)
    );
    CREATE TABLE IF NOT EXISTS cliente_despesas (
      empresa_id UUID NOT NULL REFERENCES cliente_empresas(id),
      id UUID NOT NULL,
      categoria_id UUID NOT NULL,
      fornecedor_id UUID NOT NULL,
      descricao TEXT NOT NULL,
      data DATE NOT NULL,
      valor NUMERIC(14,2) NOT NULL CHECK(valor>0),
      anexo BYTEA,
      anexo_tipo TEXT,
      PRIMARY KEY(empresa_id,id),
      FOREIGN KEY(empresa_id,categoria_id) REFERENCES cliente_categorias(empresa_id,id),
      FOREIGN KEY(empresa_id,fornecedor_id) REFERENCES cliente_fornecedores(empresa_id,id)
    );
    CREATE INDEX IF NOT EXISTS cliente_despesas_periodo ON cliente_despesas(empresa_id,data DESC);
    CREATE TABLE IF NOT EXISTS cliente_acesso_historico (
      id BIGSERIAL PRIMARY KEY,
      empresa_id UUID NOT NULL REFERENCES cliente_empresas(id),
      autor TEXT NOT NULL,
      acao TEXT NOT NULL,
      dados JSONB NOT NULL DEFAULT '{}',
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function transaction(pool, work) {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const result = await work(db);
    await db.query('COMMIT');
    return result;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}

module.exports = { ensure, transaction };
