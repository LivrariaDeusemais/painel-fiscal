const fs = require('fs');
const forge = require('node-forge');

let cache = null;

function carregarPfx(caminho) {
  const raw = fs.readFileSync(caminho);
  const texto = raw.toString('utf8').trim();
  const pareceBase64 = /^[A-Za-z0-9+/=\r\n]+$/.test(texto) && texto.replace(/\s+/g, '').length > 100;
  return pareceBase64 ? Buffer.from(texto.replace(/\s+/g, ''), 'base64') : raw;
}

function obterCredenciaisA1(caminho, senha = '') {
  const stat = fs.statSync(caminho);
  const cacheKey = `${caminho}:${stat.mtimeMs}:${senha}`;
  if (cache && cache.key === cacheKey) return cache.value;

  const pfx = carregarPfx(caminho);
  const asn1 = forge.asn1.fromDer(pfx.toString('binary'));
  const pkcs12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, senha);
  const keyBags = [
    ...pkcs12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || [],
    ...pkcs12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || []
  ];
  const certBags = pkcs12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
  const keyBag = keyBags.find(item => item.key);
  const certBag = keyBag && certBags.find(item => {
    const publicKey = item.cert?.publicKey;
    const privateKey = keyBag.key;
    return publicKey?.n && privateKey?.n && publicKey.n.equals(privateKey.n);
  }) || certBags.find(item => item.cert);

  if (!keyBag || !certBag) {
    throw new Error('O certificado A1 não contém chave privada e certificado utilizáveis.');
  }

  const value = {
    pfx,
    privateKeyPem: forge.pki.privateKeyToPem(keyBag.key),
    certificatePem: forge.pki.certificateToPem(certBag.cert)
  };
  cache = { key: cacheKey, value };
  return value;
}

module.exports = { carregarPfx, obterCredenciaisA1 };
