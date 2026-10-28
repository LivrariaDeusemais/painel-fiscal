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
 // Evaluate both light and dark paper, ignoring regions connected to the frame.
 function detect(data,w,h){
  const gray=new Float32Array(w*h),blur=new Float32Array(w*h),hist=new Uint32Array(256);
  for(let i=0;i<gray.length;i++)gray[i]=.299*data[i*4]+.587*data[i*4+1]+.114*data[i*4+2];
  // Suppress text and texture before segmenting the sheet from the surface.
  const radius=Math.max(1,Math.round(Math.min(w,h)/100));
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){let sum=0,n=0;for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&xx<w&&yy>=0&&yy<h){sum+=gray[yy*w+xx];n++;}}const v=sum/n;blur[y*w+x]=v;hist[Math.round(v)]++;}
  const quantile=q=>{let n=0;for(let i=0;i<256;i++){n+=hist[i];if(n>=w*h*q)return i;}return 255;};
  const low=quantile(.1),high=quantile(.9);if(high-low<6)return full(w,h);
  const levels=[...new Set([.15,.25,.35,.45,.55,.65,.75,.85].map(quantile))];
  const cross=(o,a,b)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);
  function quad(boundary){
   boundary.sort((a,b)=>a.x-b.x||a.y-b.y);const lower=[],upper=[];
   for(const p of boundary){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p);}
   for(let i=boundary.length-1;i>=0;i--){const p=boundary[i];while(upper.length>1&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p);}
   const hull=lower.slice(0,-1).concat(upper.slice(0,-1));
   while(hull.length>4){let remove=0,area=Infinity;for(let i=0;i<hull.length;i++){const a=Math.abs(cross(hull[(i+hull.length-1)%hull.length],hull[i],hull[(i+1)%hull.length]));if(a<area){area=a;remove=i;}}hull.splice(remove,1);}
   if(hull.length!==4)return null;
   let first=0;for(let i=1;i<4;i++)if(hull[i].x+hull[i].y<hull[first].x+hull[first].y)first=i;
   return hull.slice(first).concat(hull.slice(0,first));
  }
  // Compensate for uneven lighting using the surface on both sides of the sheet.
  const contrast=new Float32Array(w*h),edge=Math.max(3,Math.round(w*.06));
  for(let y=0;y<h;y++){
   const left=[],right=[];for(let x=2;x<edge;x++){left.push(blur[y*w+x]);right.push(blur[y*w+w-1-x]);}left.sort((a,b)=>a-b);right.sort((a,b)=>a-b);
   const l=left[Math.floor(left.length/2)],r=right[Math.floor(right.length/2)];
   for(let x=0;x<w;x++)contrast[y*w+x]=l+(r-l)*x/(w-1)-blur[y*w+x];
  }
  const ink=[],inkMask=new Uint8Array(w*h),inkSeen=new Uint8Array(w*h);
  for(let y=3;y<h-3;y++)for(let x=3;x<w-3;x++)if(x>w*.05&&x<w*.95&&y>h*.05&&y<h*.95&&blur[y*w+x]-gray[y*w+x]>12)inkMask[y*w+x]=1;
  for(let seed=0;seed<inkMask.length;seed++)if(inkMask[seed]&&!inkSeen[seed]){
   const part=[seed];inkSeen[seed]=1;let minX=w,maxX=0,minY=h,maxY=0;
   for(let n=0;n<part.length;n++){const i=part[n],x=i%w,y=Math.floor(i/w);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);for(const j of [x?i-1:-1,x<w-1?i+1:-1,y?i-w:-1,y<h-1?i+w:-1])if(j>=0&&inkMask[j]&&!inkSeen[j]){inkSeen[j]=1;part.push(j);}}
   // Long continuous contours belong to the paper boundary, not its text.
   if(part.length>2&&maxX-minX<w*.45&&maxY-minY<h*.18)for(const i of part)ink.push({x:i%w,y:Math.floor(i/w)});
  }
  const contains=(polygon,p)=>polygon.every((a,i)=>cross(a,polygon[(i+1)%4],p)>=-2);
  let best=null,bestScore=0;
  for(const layer of [{values:blur,levels},{values:contrast,levels:[3,5,8,12,18,25]}])
  for(const threshold of layer.levels)for(const bright of [false,true]){
   const seen=new Uint8Array(w*h),matches=i=>bright?layer.values[i]>threshold:layer.values[i]<threshold;
   for(let seed=0;seed<seen.length;seed++)if(!seen[seed]&&matches(seed)){
    const queue=[seed];seen[seed]=1;const boundary=[];let touches=false,cx=0,cy=0;
    for(let n=0;n<queue.length;n++){const i=queue[n],x=i%w,y=Math.floor(i/w);cx+=x;cy+=y;if(x<2||y<2||x>w-3||y>h-3)touches=true;let edge=false;
     for(const j of [x>0?i-1:-1,x<w-1?i+1:-1,y>0?i-w:-1,y<h-1?i+w:-1]){if(j<0||!matches(j)){edge=true;continue;}if(!seen[j]){seen[j]=1;queue.push(j);}}
     if(edge)boundary.push({x,y});
    }
    if(touches||queue.length<w*h*.08||queue.length>w*h*.92)continue;
    const points=quad(boundary);if(!points||!valid(points,w,h))continue;
    const area=Math.abs(points.reduce((s,p,i)=>s+p.x*points[(i+1)%4].y-p.y*points[(i+1)%4].x,0)/2),fill=queue.length/area;
    if(fill<.65||fill>1.2)continue;
    if(ink.length>100&&ink.filter(p=>contains(points,p)).length<ink.length*.96)continue;
    const center=1-Math.min(.6,Math.hypot(cx/queue.length-w/2,cy/queue.length-h/2)/Math.hypot(w/2,h/2));
    const score=area/(w*h)*Math.min(1,fill)*center;
    if(score>bestScore){bestScore=score;best=points;}
   }
  }
  if(best)return best;
  // Low-contrast fallback: retain the complete text region with a generous margin,
  // rather than accepting a small internal contour that would cut off receipt text.
  if(ink.length>Math.max(150,w*h*.005)){
   const xs=ink.map(p=>p.x).sort((a,b)=>a-b),ys=ink.map(p=>p.y).sort((a,b)=>a-b),q=(a,f)=>a[Math.floor((a.length-1)*f)];
   const left=Math.max(0,q(xs,.01)-w*.055),right=Math.min(w-1,q(xs,.99)+w*.055),top=Math.max(0,q(ys,.01)-h*.04),bottom=Math.min(h-1,q(ys,.99)+h*.04);
   const box=[{x:left,y:top},{x:right,y:top},{x:right,y:bottom},{x:left,y:bottom}];
   if(valid(box,w,h)&&(right-left)*(bottom-top)<w*h*.85&&bottom-top>h*.3)return box;
  }
  return full(w,h);
 }
 const api={distance,valid,project,full,detect};if(typeof module!=='undefined')module.exports=api;else root.ScannerImage=api;
})(typeof window==='undefined'?globalThis:window);
