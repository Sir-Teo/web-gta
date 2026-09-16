import type {WaterPolygon} from '../assets/water';
const CELL=250;
/** Native-coordinate water heights from WATER.DAT. CWaterLevel::GetWaterLevelNoWaves is not reversed;
 * quads interpolate their four corners bilinearly and triangles use their plane. Waves are not added. */
export class WaterLevelIndex {
 private cells=new Map<string,number[]>();
 private shapes:{minX:number;minY:number;maxX:number;maxY:number;level:(x:number,y:number)=>number|undefined}[]=[];
 constructor(polygons:readonly WaterPolygon[]){
  for(const polygon of polygons){
   const v=polygon.vertices.map(p=>p.position),xs=v.map(p=>p[0]),ys=v.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
   if(!(maxX>minX&&maxY>minY))continue;
   let level:(x:number,y:number)=>number|undefined;
   if(v.length===4){
    const corner=(cx:number,cy:number)=>v.reduce((best,p)=>Math.hypot(p[0]-cx,p[1]-cy)<Math.hypot(best[0]-cx,best[1]-cy)?p:best)[2];
    const z00=corner(minX,minY),z10=corner(maxX,minY),z01=corner(minX,maxY),z11=corner(maxX,maxY);
    level=(x,y)=>{const u=(x-minX)/(maxX-minX),t=(y-minY)/(maxY-minY);return (z00*(1-u)+z10*u)*(1-t)+(z01*(1-u)+z11*u)*t;};
   }else{
    const [a,b,c]=v,det=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(det)<1e-9)continue;
    level=(x,y)=>{const l1=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/det,l2=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/det,l3=1-l1-l2;return l1<-1e-6||l2<-1e-6||l3<-1e-6?undefined:l1*a[2]+l2*b[2]+l3*c[2];};
   }
   const index=this.shapes.push({minX,minY,maxX,maxY,level})-1;
   for(let cx=Math.floor(minX/CELL);cx<=Math.floor(maxX/CELL);cx++)for(let cy=Math.floor(minY/CELL);cy<=Math.floor(maxY/CELL);cy++){const key=`${cx},${cy}`;let list=this.cells.get(key);if(!list)this.cells.set(key,list=[]);list.push(index);}
  }
 }
 /** Highest water surface containing the native point, if any. */
 level(x:number,y:number){
  let best:number|undefined;
  for(const index of this.cells.get(`${Math.floor(x/CELL)},${Math.floor(y/CELL)}`)??[]){const s=this.shapes[index];if(x<s.minX||x>s.maxX||y<s.minY||y>s.maxY)continue;const z=s.level(x,y);if(z!==undefined&&(best===undefined||z>best))best=z;}
  return best;
 }
}
