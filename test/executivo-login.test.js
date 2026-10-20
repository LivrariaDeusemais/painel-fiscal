const {test}=require('node:test');
const assert=require('node:assert/strict');
const {decorate}=require('../src/services/ui-executivo');
const html='<!DOCTYPE html><html><head><title>Login</title></head><body class="login-page"><form>Entrar</form></body></html>';
test('login não recebe menus nem estilos internos mesmo com sessão ativa em ambos os layouts',()=>{
 for(const plennaLayout of ['executivo','antigo'])for(const perfil of ['ADMIN','USUARIO','CONTADOR'])for(const url of ['/login','/login/','/login?erro=1','/LOGIN']){
  const req={originalUrl:url,session:{usuario:{id:1,nome:'Teste',perfil},plennaLayout}};
  assert.equal(decorate(req,html),html);
 }
});
test('página interna continua recebendo o layout selecionado',()=>{
 for(const plennaLayout of ['executivo','antigo']){
  const result=decorate({originalUrl:'/arquivo',session:{usuario:{id:1,nome:'Teste',perfil:'ADMIN'},plennaLayout}},html);
  assert.ok(result.includes(plennaLayout==='executivo'?'id="exec-header"':'id="exec-old-choice"'));
 }
 assert.equal(decorate({path:'/login',session:{}},html),html);
});
