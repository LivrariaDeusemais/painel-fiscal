const { SignedXml } = require('xml-crypto');

const C14N = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
const ENVELOPED = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';
const SHA1 = 'http://www.w3.org/2000/09/xmldsig#sha1';
const RSA_SHA1 = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1';

function criarAssinador({ privateKeyPem, certificatePem }) {
  return new SignedXml({
    privateKey: privateKeyPem,
    publicCert: certificatePem,
    signatureAlgorithm: RSA_SHA1,
    canonicalizationAlgorithm: C14N
  });
}

function assinarDocumentoInteiro(xml, credenciais, elementoInsercao = 'Cabecalho') {
  const sig = criarAssinador(credenciais);
  sig.addReference({
    xpath: '/*',
    transforms: [ENVELOPED, C14N],
    digestAlgorithm: SHA1,
    isEmptyUri: true
  });
  sig.computeSignature(xml, {
    location: {
      reference: `//*[local-name()='${elementoInsercao}']`,
      action: 'after'
    }
  });
  return sig.getSignedXml();
}

function assinarElementoPorId(xml, credenciais, id) {
  const sig = criarAssinador(credenciais);
  sig.addReference({
    xpath: `//*[@Id='${id}']`,
    transforms: [ENVELOPED, C14N],
    digestAlgorithm: SHA1,
    uri: `#${id}`
  });
  sig.computeSignature(xml, {
    location: {
      reference: `//*[@Id='${id}']`,
      action: 'after'
    }
  });
  return sig.getSignedXml();
}

module.exports = { assinarDocumentoInteiro, assinarElementoPorId };
