const {parseStringPromise}=require('xml2js');
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
async function supplierLabel(name,document,xmlBuffer){
 if(!normalize(name).includes('sociedade biblica do brasil'))return name;
 let suffix='';
 if(xmlBuffer){
  const text=xmlBuffer.toString('utf8');
  if(!/<!DOCTYPE|<!ENTITY/i.test(text)){
   const xml=await parseStringPromise(text,{explicitArray:false,tagNameProcessors:[s=>s.split(':').pop()]});
   const address=(xml.nfeProc?.NFe||xml.NFe)?.infNFe?.emit?.enderEmit||{};
   if(normalize(address.xMun)==='barueri')suffix='Barueri';
   else if(/\bluz\b/.test(normalize(address.xBairro)))suffix='Luz';
  }
 }
 return name+' - '+(suffix||'CNPJ '+document);
}
module.exports={supplierLabel};
