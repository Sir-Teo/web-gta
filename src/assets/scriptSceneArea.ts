import type {IndexedDistrict} from './districtIndex';
/** Compact metadata from the active native IPL load list, reused by script scene transfers without an ENEX door. */
export function collectInteriorBounds(index:readonly IndexedDistrict[]){
 const result=new Float64Array(index.reduce((n,d)=>n+(d.interiorBounds?.length??0),0));let at=0;
 for(const d of index)if(d.interiorBounds){result.set(d.interiorBounds,at);at+=d.interiorBounds.length;}
 return result;
}
/** The area's actual content must be near the script's point in XY and height. A street cutscene area alone is insufficient. */
export function scriptPointHasInterior(bounds:Float64Array,area:number,p:{x:number;y:number;z:number},reach=100,height=50){
 if(!area||area===13)return false;
 for(let i=0;i+6<bounds.length;i+=7){
  if(bounds[i]!==area)continue;
  const x=Math.max(bounds[i+1],Math.min(p.x,bounds[i+4])),y=Math.max(bounds[i+2],Math.min(p.y,bounds[i+5])),z=Math.max(bounds[i+3],Math.min(p.z,bounds[i+6]));
  if(Math.hypot(x-p.x,y-p.y)<reach&&Math.abs(z-p.z)<height)return true;
 }
 return false;
}
