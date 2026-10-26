// Permissão operacional específica aprovada para Filipe; não concede perfil ADMIN.
function canOperate(user) {
  if(user?.perfil!=='ADMIN'&&user?.functionAccess)return ['meli','bling','tabela'].some(id=>user.functionAccess[id]?.edit===true);
  return user?.perfil === 'ADMIN' || user?.perfil === 'USUARIO' && String(user.id) === '3' && String(user.nome).trim().toLocaleLowerCase('pt-BR') === 'filipe';
}
function isAdmin(user) { return user?.perfil === 'ADMIN'; }
module.exports = {canOperate,isAdmin};
