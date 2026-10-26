const {test}=require('node:test'),assert=require('node:assert/strict'),{save,page}=require('../src/access/users');
function database({missingRole=false,failBinding=false}={}){
 const calls=[];let committed=false,rolledBack=false,released=false;
 const client={async query(sql,args){calls.push({sql,args});if(sql==='COMMIT')committed=true;if(sql==='ROLLBACK')rolledBack=true;if(sql.startsWith('SELECT id FROM acesso_funcoes'))return {rows:missingRole?[]:[{id:2}]};if(sql.startsWith('INSERT INTO usuarios')||sql.startsWith('UPDATE usuarios'))return {rows:[{id:7}]};if(failBinding&&sql.startsWith('INSERT INTO acesso_usuario_funcao'))throw Error('vínculo indisponível');return {rows:[]};},release(){released=true}};
 return {pool:{connect:async()=>client},calls,state:()=>({committed,rolledBack,released})};
}
const actor={id:1},body={nome:'Pessoa Teste',email:'pessoa@example.test',perfil:'USUARIO',funcao:'2',senha:'senha-ficticia',alerta_email:'on'};
test('cadastro salva função junto dos dados e nunca registra senha na auditoria',async()=>{
 const db=database();assert.equal(await save(db.pool,actor,body,{hashPassword:async()=>'hash-ficticio'}),7);
 assert.deepEqual(db.state(),{committed:true,rolledBack:false,released:true});
 assert.deepEqual(db.calls.find(c=>c.sql.startsWith('INSERT INTO acesso_usuario_funcao')).args,['7','2']);
 const audit=db.calls.find(c=>c.sql.startsWith('INSERT INTO acesso_historico'));assert.doesNotMatch(audit.args[2],/senha|hash/);
});
test('edição remove vínculo quando sem função, sem trocar senha',async()=>{
 const db=database();await save(db.pool,actor,{...body,funcao:''},{id:'7',hashPassword:()=>{throw Error('não deve gerar senha')}});
 assert.ok(db.calls.some(c=>c.sql.startsWith('DELETE FROM acesso_usuario_funcao')));assert.ok(db.calls.some(c=>c.sql.startsWith('UPDATE usuarios')));assert.equal(db.state().committed,true);
});
test('função inexistente e falha de vínculo fazem rollback de toda alteração',async()=>{
 for(const settings of [{missingRole:true},{failBinding:true}]){const db=database(settings);await assert.rejects(save(db.pool,actor,body,{id:'7'}));assert.deepEqual(db.state(),{committed:false,rolledBack:true,released:true});}
});
test('valida o perfil e não associa função operacional ao ADMIN',async()=>{
 for(const invalid of [{perfil:'ROOT'},{perfil:'ADMIN',funcao:'2'},{funcao:'inexistente'}]){const db=database();await assert.rejects(save(db.pool,actor,{...body,...invalid},{id:'7'}));assert.equal(db.calls.length,0);}
});
test('tabela destaca função, mantém perfil técnico e escapa conteúdo',()=>{
 const html=page({roles:[{id:2,nome:'Gestor'}],csrf:'token',currentId:1,users:[{id:7,nome:'<script>',email:'teste@example.test',perfil:'USUARIO',funcao_nome:'Gestor'}]});
 assert.match(html,/name="funcao"/);assert.match(html,/<th scope="col">Função<\/th>/);assert.match(html,/<th scope="col">Perfil técnico<\/th>/);assert.match(html,/ua-role">Gestor/);assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);
 const edit=page({roles:[{id:2,nome:'Gestor'}],user:{id:7,nome:'Teste',funcao:2},csrf:'token'});assert.match(edit,/value="2" selected/);assert.doesNotMatch(edit,/name="senha"/);
});
