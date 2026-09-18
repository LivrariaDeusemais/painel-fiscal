const https = require('https');

function requisitarHttps({ url, method = 'POST', pfx, passphrase = '', headers = {}, body = '', timeoutMs = 30000 }) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method,
      pfx,
      passphrase,
      timeout: timeoutMs,
      headers: {
        'Content-Length': Buffer.byteLength(body),
        ...headers
      }
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({
          ok: response.statusCode >= 200 && response.statusCode < 300,
          statusCode: response.statusCode,
          headers: response.headers,
          buffer,
          body: buffer.toString('utf8')
        });
      });
    });

    req.on('timeout', () => req.destroy(new Error('Tempo limite excedido na comunicação com o serviço fiscal.')));
    req.on('error', reject);
    req.end(body);
  });
}

module.exports = { requisitarHttps };
