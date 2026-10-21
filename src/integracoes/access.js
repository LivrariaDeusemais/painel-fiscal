// Permissão operacional específica aprovada para Filipe; não concede perfil ADMIN.
function canOperate(user) {
  return user?.perfil === 'ADMIN' || user?.perfil === 'USUARIO' && String(user.id) === '3' && String(user.nome).trim().toLocaleLowerCase('pt-BR') === 'filipe';
}
function isAdmin(user) { return user?.perfil === 'ADMIN'; }
module.exports = {canOperate,isAdmin};
