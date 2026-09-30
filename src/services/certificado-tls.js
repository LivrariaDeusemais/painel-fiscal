const forge = require('node-forge');
const tls = require('node:tls');

function certificadoTls(pfx, senha) {
  // Prefere o leitor nativo; alguns A1 usam algoritmos PKCS#12 que o
  // OpenSSL do Node não aceita. A conversão alternativa fica só em memória.
  try {
    tls.createSecureContext({ pfx, passphrase: senha });
    return { pfx, passphrase: senha };
  } catch (error) {
    if (!/unsupported/i.test(String(error.message))) throw error;
  }
  return certificadoPem(pfx, senha);
}

function certificadoPem(pfx, senha) {
  const arquivo = forge.pkcs12.pkcs12FromAsn1(
    forge.asn1.fromDer(pfx.toString('binary')), senha
  );
  const bags = tipo => arquivo.getBags({ bagType: tipo })[tipo] || [];
  const chave = [...bags(forge.pki.oids.pkcs8ShroudedKeyBag), ...bags(forge.pki.oids.keyBag)]
    .find(bag => bag.key)?.key;
  if (!chave) throw new Error('Certificado A1 sem chave privada.');
  const certificados = bags(forge.pki.oids.certBag).map(bag => bag.cert).filter(Boolean);
  const folha = certificados.find(cert => cert.publicKey.n?.equals(chave.n) && cert.publicKey.e?.equals(chave.e));
  if (!folha) throw new Error('Certificado A1 sem certificado correspondente à chave privada.');
  return {
    key: forge.pki.privateKeyToPem(chave),
    cert: [folha, ...certificados.filter(cert => cert !== folha)]
      .map(cert => forge.pki.certificateToPem(cert)).join('\n')
  };
}

module.exports = { certificadoTls, certificadoPem };
