/* Live capture decisions use only image data; no camera or network access here. */
(function(root){
 const geometry=typeof module!=='undefined'?require('./scanner-image'):root.ScannerImage;
 function signature(data,w,h,points){
  const map=geometry.project(points),values=[];
  for(let y=0;y<16;y++)for(let x=0;x<12;x++){const p=map((x+.5)/12,(y+.5)/16),i=(Math.max(0,Math.min(h-1,Math.round(p.y)))*w+Math.max(0,Math.min(w-1,Math.round(p.x))))*4;values.push(.299*data[i]+.587*data[i+1]+.114*data[i+2]);}
  const average=values.reduce((s,v)=>s+v,0)/values.length;return values.map(v=>v-average);
 }
 function same(a,b){return a?.length===192&&b?.length===192&&a.reduce((sum,v,i)=>sum+Math.abs(v-b[i]),0)/a.length<7;}
 function quality(data,w,h,points){
  const map=geometry.project(points);let n=0,sum=0,lapSum=0,lapSquared=0;
  const gray=(x,y)=>{const i=(y*w+x)*4;return .299*data[i]+.587*data[i+1]+.114*data[i+2];};
  for(let v=.06;v<.95;v+=.025)for(let u=.06;u<.95;u+=.035){const p=map(u,v),x=Math.round(p.x),y=Math.round(p.y);if(x<1||x>w-2||y<1||y>h-2)continue;const g=gray(x,y),lap=gray(x-1,y)+gray(x+1,y)+gray(x,y-1)+gray(x,y+1)-4*g;n++;sum+=g;lapSum+=lap;lapSquared+=lap*lap;}
  return {brightness:n?sum/n:0,sharpness:n?lapSquared/n-(lapSum/n)**2:0};
 }
 function createTracker(){
  let reference=null,outline=null,started=0,samples=0,lastTime=0;
  const reset=()=>{reference=null;outline=null;started=0;samples=0;lastTime=0;};
  function update(frame,now,previous){
   const {points,w,h,method,brightness,sharpness,fingerprint}=frame;
   if(!['edges','region'].includes(method)||!geometry.valid(points,w,h)){reset();return 'align';}
   const area=Math.abs(points.reduce((s,p,i)=>s+p.x*points[(i+1)%4].y-p.y*points[(i+1)%4].x,0)/2)/(w*h);
   if(area<.15||area>.90||points.some(p=>p.x<w*.025||p.x>w*.975||p.y<h*.025||p.y>h*.975)){reset();return 'align';}
   if(brightness<45||brightness>248){reset();return 'light';}
   if(sharpness<45){reset();return 'focus';}
   if(same(fingerprint,previous)){reset();return 'duplicate';}
   const normalized=points.map(p=>({x:p.x/w,y:p.y/h}));
   const moved=!reference||now-lastTime>2800||normalized.some((p,i)=>geometry.distance(p,reference[i])>.024);
   if(moved){reference=normalized;outline=normalized;started=now;samples=1;}else {
    samples++;outline=normalized.map((p,i)=>({x:outline[i].x*.6+p.x*.4,y:outline[i].y*.6+p.y*.4}));
   }
   // Smooth only small jitter; keep the original anchor so continued movement
   // cannot gradually drift into an automatic capture.
   frame.points=outline.map(p=>({x:p.x*w,y:p.y*h}));
   lastTime=now;
   if(samples>=3&&now-started>=1300){reset();return 'capture';}
   return 'steady';
  }
  return {update,reset};
 }
 const api={signature,same,quality,createTracker};if(typeof module!=='undefined')module.exports=api;else root.ScannerLive=api;
})(typeof window==='undefined'?globalThis:window);
