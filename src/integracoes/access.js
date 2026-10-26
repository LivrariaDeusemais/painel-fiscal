// Permissão operacional específica aprovada para Filipe; não concede perfil ADMIN.
function canOperate(user) {
  if(user?.perfil!=='ADMIN'&&user?.functionAccess)return ['meli','bling','tabela'].some(id=>user.functionAccess[id]?.edit===true);
  return user?.perfil === 'ADMIN' || user?.perfil === 'USUARIO' && String(user.id) === '3' && String(user.nome).trim().toLocaleLowerCase('pt-BR') === 'filipe';
}
function isAdmin(user) { return user?.perfil === 'ADMIN'; }
function canDownload(user,id){if(user?.perfil==='ADMIN')return true;if(user?.functionAccess)return user.functionAccess[id]?.view===true&&user.functionAccess[id]?.download===true;return canOperate(user);}
module.exports = {canOperate,isAdmin,canDownload};
