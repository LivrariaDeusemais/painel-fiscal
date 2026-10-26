// Cada nova tela/bloco deve ser registrado aqui; funções não recebem novos acessos implicitamente.
const catalog=[
 ['painel','Painel','tarefas','Tarefas e mensagens',['/visao-geral','/painel'],true],
 ['financeiro','Financeiro','arquivo','Arquivos de comprovantes',['/arquivo'],true],
 ['financeiro','Financeiro','contas','Contas a pagar',['/rotina-despesas','/alertas-vencimentos'],true],
 ['financeiro','Financeiro','comprovantes','Lançamentos e comprovantes',['/lancamentos','/novo','/editar','/excluir','/download','/exportar-excel','/uploads','/documentos','/documentos-antigo'],true],
 ['financeiro','Financeiro','financeiro','Visão operacional financeira',['/financeiro','/dashboard'],false],
 ['compras','Compras e Estoque','compras','Arquivo de NFs / estoque',['/compras','/ferramentas-ia/gestao-compras'],true],
 ['compras','Compras e Estoque','codificador','Codificador',['/ferramentas-ia/codificador'],true],
 ['precos','Preços','calculadora','Calculadora',['/ferramentas-ia/tabela-precos/promocoes'],true],
 ['precos','Preços','produtos','Produtos',['/ferramentas-ia/tabela-precos/produtos'],true],
 ['precos','Preços','vinculos','Vínculos e base de produtos',['/ferramentas-ia/tabela-precos/base','/ferramentas-ia/tabela-precos/vinculos'],true],
 ['precos','Preços','regras','Regras e tarifas',['/ferramentas-ia/tabela-precos/regras'],true],
 ['precos','Preços','fretes','Fretes',['/ferramentas-ia/tabela-precos/fretes'],true],
 ['precos','Preços','bling','Integração Bling',['/ferramentas-ia/tabela-precos/bling'],true],
 ['precos','Preços','meli','Mercado Livre / campanhas / publicação',['/ferramentas-ia/tabela-precos/mercado-livre'],true],
 ['precos','Preços','tabela','Tabela por marketplace / exportações',['/precos','/ferramentas-ia/tabela-precos/tabela','/ferramentas-ia/tabela-precos/exportar','/ferramentas-ia/tabela-precos/exportar-liquido','/ferramentas-ia/tabela-precos/exportar-completa','/ferramentas-ia/tabela-precos/publicar-marketplace','/ferramentas-ia/tabela-precos/novo-bruto','/ferramentas-ia/tabela-precos'],true],
 ['contabil','Contábil','downloads','Central de downloads',['/espaco-contador'],true],
 ['contabil','Contábil','fechamento','Fechamento / faturamento / resultados',['/contabil/fechamento','/contabil/historico'],true,'sensitive'],
 ['contabil','Contábil','conciliacao','Conciliação bancária',['/conciliacao-bancaria'],true],
 ['contabil','Contábil','contabil','Visão contábil',['/contabil'],false],
 ['integracoes','Integrações','fiscais','Integrações fiscais',['/integracoes','/nfpaulistana','/sefaz','/nfse-nacional','/ferramentas-ia'],true],
 ['admin','Administração','usuarios','Usuários e funções',['/usuarios','/administracao','/funcoes'],true,'admin'],
 ['admin','Administração','equipes','Equipes e acompanhamento',['/painel/equipes'],true,'admin'],
 ['admin','Administração','categorias','Categorias',['/categorias'],true],
 ['admin','Administração','backup','Backup',['/backup'],true,'admin'],
 ['painel','Painel','alertas','Bloco: alertas automáticos',[],false],
 ['precos','Preços','alertas-precos','Bloco: pendências de preços',[],false],
].map(([menu,menuLabel,id,label,paths,editable,restriction])=>({menu,menuLabel,id,label,paths,editable,restriction}));
function capability(path){return catalog.flatMap(c=>c.paths.map(prefix=>({c,prefix}))).filter(x=>path===x.prefix||path.startsWith(x.prefix+'/')).sort((a,b)=>b.prefix.length-a.prefix.length)[0]?.c;}
function permitted(user,id,write=false){if(user?.perfil==='ADMIN')return true;if(!user?.functionAccess)return null;return user.functionAccess[id]?.[write?'edit':'view']===true;}
function operationalGrant(req){const c=capability((req.originalUrl||req.path||'').split('?')[0]);return !!c&&!c.restriction&&c.editable&&permitted(req.session?.usuario,c.id,true)===true;}
module.exports={catalog,capability,permitted,operationalGrant};
