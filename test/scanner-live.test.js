const test=require('node:test'),assert=require('node:assert/strict');
const live=require('../src/assets/scanner-live'),geometry=require('../src/assets/scanner-image');
function frame(overrides={}){return {w:240,h:320,method:'edges',points:[{x:45,y:25},{x:190,y:30},{x:195,y:295},{x:40,y:290}],brightness:180,sharpness:120,fingerprint:Array.from({length:192},(_,i)=>i%2?20:-20),...overrides};}
test('captura automática exige três observações estáveis por pelo menos 1,3 segundo',()=>{
 const tracker=live.createTracker();assert.equal(tracker.update(frame(),0),'steady');assert.equal(tracker.update(frame(),650),'steady');assert.equal(tracker.update(frame(),1300),'capture');
 assert.equal(tracker.update(frame(),1400),'steady');
});
test('movimento, perda de foco, pouca luz e intervalos grandes reiniciam a estabilidade',()=>{
 for(const bad of [frame({sharpness:10}),frame({brightness:20}),frame({method:'text'}),frame({method:'none'}),frame({points:geometry.full(240,320)})]){
 const tracker=live.createTracker();tracker.update(frame(),0);assert.notEqual(tracker.update(bad,650),'capture');assert.equal(tracker.update(frame(),1300),'steady');assert.equal(tracker.update(frame(),1950),'steady');assert.equal(tracker.update(frame(),2600),'capture');}
 const t=live.createTracker();t.update(frame(),0);assert.equal(t.update(frame({points:frame().points.map(p=>({x:p.x+8,y:p.y}))}),650),'steady');assert.equal(t.update(frame(),2500),'steady');
});
test('mesma página não é capturada de novo automaticamente, mas uma nova pode ser',()=>{
 const t=live.createTracker(),previous=frame().fingerprint;assert.equal(t.update(frame(),0,previous),'duplicate');assert.equal(t.update(frame(),3000,previous),'duplicate');
 const next=frame({fingerprint:Array.from({length:192},(_,i)=>i%3?30:-30)});assert.equal(t.update(next,4000,previous),'steady');assert.equal(t.update(next,4650,previous),'steady');assert.equal(t.update(next,5300,previous),'capture');
});
test('avalia nitidez da região do documento e conserva identificação com variação de luminosidade',()=>{
 const w=100,h=140,data=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,v=(x%7<2&&y%8<3)?30:200;data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;}
 const points=geometry.full(w,h),q=live.quality(data,w,h,points);assert.ok(q.sharpness>45);assert.ok(q.brightness>45);
 const first=live.signature(data,w,h,points);for(let i=0;i<data.length;i+=4)for(let c=0;c<3;c++)data[i+c]+=10;
 assert.equal(live.same(first,live.signature(data,w,h,points)),true);
});
test('pequena tremida suaviza o contorno e permite captura sem exigir imobilidade perfeita',()=>{
 const tracker=live.createTracker(),base=frame().points;
 const jitter=dx=>frame({points:base.map(p=>({x:p.x+dx,y:p.y+dx*.2}))});
 assert.equal(tracker.update(jitter(0),0),'steady');
 const second=jitter(5);assert.equal(tracker.update(second,650),'steady');
 assert.ok(second.points[0].x>base[0].x&&second.points[0].x<base[0].x+5);
 assert.equal(tracker.update(jitter(-4),1300),'capture');
});
test('suavização não permite capturar quando o celular continua se deslocando',()=>{
 const tracker=live.createTracker(),base=frame().points;
 for(let i=0;i<8;i++)assert.notEqual(tracker.update(frame({points:base.map(p=>({x:p.x+i*3,y:p.y}))}),i*650),'capture');
});
test('processamento um pouco mais lento conserva a estabilidade, mas uma pausa longa reinicia',()=>{
 const tracker=live.createTracker();tracker.update(frame(),0);
 assert.equal(tracker.update(frame(),1900),'steady');assert.equal(tracker.update(frame(),3800),'capture');
 tracker.update(frame(),4000);assert.equal(tracker.update(frame(),8000),'steady');
});
