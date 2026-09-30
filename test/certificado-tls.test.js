const test = require('node:test');
const assert = require('node:assert/strict');
const tls = require('node:tls');
const forge = require('node-forge');
const { certificadoPem, certificadoTls } = require('../src/services/certificado-tls');

const keys = forge.pki.rsa.generateKeyPair(2048);
const cert = forge.pki.createCertificate();
cert.publicKey = keys.publicKey;
cert.serialNumber = '01';
cert.validity.notBefore = new Date('2026-01-01');
cert.validity.notAfter = new Date('2027-01-01');
cert.setSubject([{ name: 'commonName', value: 'Teste' }]);
cert.setIssuer(cert.subject.attributes);
cert.sign(keys.privateKey, forge.md.sha256.create());
const pfx = Buffer.from(forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(
  keys.privateKey, [cert], 'senha-teste', { algorithm: '3des' }
)).getBytes(), 'binary');

test('converte A1 em memória preservando chave e certificado para TLS', () => {
  const pem = certificadoPem(pfx, 'senha-teste');
  assert.doesNotThrow(() => tls.createSecureContext(pem));
  const extraido = forge.pki.certificateFromPem(pem.cert);
  assert.equal(extraido.serialNumber, cert.serialNumber);
  assert.equal(extraido.publicKey.n.toString(), keys.publicKey.n.toString());
});

test('mantém leitura nativa para PFX compatível e rejeita senha incorreta', () => {
  assert.equal(certificadoTls(pfx, 'senha-teste').pfx, pfx);
  assert.throws(() => certificadoTls(pfx, 'errada'));
  assert.throws(() => certificadoPem(pfx, 'errada'));
});
