/* Pure geometry shared by the mobile editor and regression tests. */
(function(root){
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 function valid(points,w,h){
  if(points.length!==4||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.y<0||p.x>w-1||p.y>h-1))return false;
  const cross=points.map((a,i)=>{const b=points[(i+1)%4],c=points[(i+2)%4];return (b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);});
  const area=Math.abs(points.reduce((s,p,i)=>s+p.x*points[(i+1)%4].y-p.y*points[(i+1)%4].x,0)/2);
  return cross.every(n=>n>0)&&area>w*h*.02&&points.every((p,i)=>distance(p,points[(i+1)%4])>10);
 }
 function project(points){
  const a=[],b=[];
  [[0,0],[1,0],[1,1],[0,1]].forEach(([u,v],i)=>{const {x,y}=points[i];a.push([u,v,1,0,0,0,-u*x,-v*x],[0,0,0,u,v,1,-u*y,-v*y]);b.push(x,y);});
  for(let i=0;i<8;i++){let pivot=i;for(let j=i+1;j<8;j++)if(Math.abs(a[j][i])>Math.abs(a[pivot][i]))pivot=j;
   [a[i],a[pivot]]=[a[pivot],a[i]];[b[i],b[pivot]]=[b[pivot],b[i]];const div=a[i][i];if(Math.abs(div)<1e-9)throw Error('Ajuste os cantos do documento.');
   for(let k=i;k<8;k++)a[i][k]/=div;b[i]/=div;
   for(let j=0;j<8;j++)if(j!==i){const f=a[j][i];for(let k=i;k<8;k++)a[j][k]-=f*a[i][k];b[j]-=f*b[i];}
  }
  return (u,v)=>{const z=b[6]*u+b[7]*v+1;return {x:(b[0]*u+b[1]*v+b[2])/z,y:(b[3]*u+b[4]*v+b[5])/z};};
 }
 function full(w,h){return [{x:0,y:0},{x:w-1,y:0},{x:w-1,y:h-1},{x:0,y:h-1}];}
 // Suggest a bright document against a darker background; user always reviews.
 function detect(data,w,h){
  const values=[];for(let i=0;i<data.length;i+=4)values.push((data[i]+data[i+1]+data[i+2])/3);
  const sorted=[...values].sort((a,b)=>a-b),low=sorted[Math.floor(sorted.length*.2)],high=sorted[Math.floor(sorted.length*.85)];
  if(high-low<40)return full(w,h);
  const threshold=low+(high-low)*.65,seen=new Uint8Array(w*h);let best=[];
  for(let p=0;p<values.length;p++)if(!seen[p]&&values[p]>threshold){const queue=[p];seen[p]=1;for(let n=0;n<queue.length;n++){const i=queue[n],x=i%w,y=Math.floor(i/w);for(const j of [x>0?i-1:-1,x<w-1?i+1:-1,y>0?i-w:-1,y<h-1?i+w:-1])if(j>=0&&!seen[j]&&values[j]>threshold){seen[j]=1;queue.push(j);}}if(queue.length>best.length)best=queue;}
  if(best.length<w*h*.15)return full(w,h);
  let tl,br,tr,bl;for(const i of best){const p={x:i%w,y:Math.floor(i/w)};if(!tl||p.x+p.y<tl.x+tl.y)tl=p;if(!br||p.x+p.y>br.x+br.y)br=p;if(!tr||p.x-p.y>tr.x-tr.y)tr=p;if(!bl||p.x-p.y<bl.x-bl.y)bl=p;}
  const result=[tl,tr,br,bl];return valid(result,w,h)?result:full(w,h);
 }
 const api={distance,valid,project,full,detect};if(typeof module!=='undefined')module.exports=api;else root.ScannerImage=api;
})(typeof window==='undefined'?globalThis:window);
