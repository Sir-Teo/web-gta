import {requireAsset} from '../assets/binary';
import {nativeContactBrightness} from '../assets/collisionLighting';
import type {PlantPoint} from './nativePlantTriangle';
import type {NativePlantCover} from './nativeVegetation';

/** Native vector subtraction, squared sum and square root round to float32. */
export function nativeGrassDistance(a:PlantPoint,b:PlantPoint){
 const f=Math.fround;
 requireAsset([a,b].every(p=>p.length===3&&p.every(n=>Number.isFinite(n)&&Math.abs(n)<=1e7)),'Invalid grass distance coordinates.');
 const [x,y,z]=a.map((n,i)=>f(f(n)-f(b[i])));
 return f(Math.sqrt(f(f(f(x*x)+f(y*y))+f(z*z))));
}

/** Wind changes only the two shear entries of the native instance matrix. */
export function nativeGrassBend(cover:Pick<NativePlantCover,'windBend'|'windVariation'>,sample:number,wind:number){
 const f=Math.fround;
 requireAsset(Number.isFinite(sample)&&sample>=0&&sample<=1,'Grass requires a wind sample in [0,1].');
 requireAsset(Number.isFinite(f(wind))&&Number.isFinite(f(cover.windBend))&&Number.isFinite(f(cover.windVariation)),'Invalid grass wind.');
 const bend=f(f(f(f(sample)*f(cover.windVariation))+1)*f(f(wind)*f(cover.windBend)));
 requireAsset(Number.isFinite(bend),'Grass transform exceeds float32 limits.');return bend;
}

/** Equations from GrassRenderer with explicit samples. The inspected project
 * changed its PRNG; callers must not mistake its mt19937 for the retail stream. */
export function nativeGrassInstance(vertices:readonly [PlantPoint,PlantPoint,PlantPoint],cover:NativePlantCover,samples:readonly [number,number,number,number,number],wind:number){
 const f=Math.fround;
 requireAsset(samples.length===5&&samples.every(n=>Number.isFinite(n)&&n>=0&&n<=1),'Grass requires five samples in [0,1].');
 requireAsset(vertices.length===3&&vertices.every(p=>p.length===3&&p.every(n=>Number.isFinite(n)&&Math.abs(n)<=1e7)),'Invalid grass triangle vertices.');
 requireAsset([wind,cover.scaleXY,cover.scaleZ,cover.scaleVariationXY,cover.scaleVariationZ,cover.windBend,cover.windVariation].every(n=>Number.isFinite(n)&&Number.isFinite(f(n))),'Invalid grass scale or wind.');
 let [a,b]=samples.map(f);
 if(f(a+b)>1){a=f(1-a);b=f(1-b);}
 const weight=f(f(1-a)-b);
 const position=[0,1,2].map(i=>f(f(f(weight*f(vertices[0][i]))+f(a*f(vertices[1][i])))+f(b*f(vertices[2][i])))) as [number,number,number];
 const xy=f(f(f(samples[2])*f(cover.scaleVariationXY))+f(cover.scaleXY));
 const z=f(f(f(samples[3])*f(cover.scaleVariationZ))+f(cover.scaleZ));
 const bend=nativeGrassBend(cover,samples[4],wind);
 requireAsset([...position,xy,z,bend].every(Number.isFinite),'Grass transform exceeds float32 limits.');
 // Native plants remain upright: bend shears the local Z axis equally in X/Y.
 // Column-major matrix in GTA Z-up coordinates; no terrain-normal alignment.
 const matrix=new Float32Array([xy,0,0,0,0,xy,0,0,bend,bend,z,0,...position,1]);
 return {position,scale:[xy,xy,z] as const,bend,matrix};
}

/** Color is the already collision-lit byte color. This is the grass pass's
 * /256 intensity modulation and 20-unit far fade, before display conversion. */
export function nativeGrassDrawColor(color:readonly [number,number,number,number],intensity:number,centerDistance:number,farDistance:30|60){
 requireAsset(color.length===4&&[...color,intensity].every(n=>Number.isInteger(n)&&n>=0&&n<=255),'Grass color/intensity must be bytes.');
 requireAsset(Number.isFinite(centerDistance)&&centerDistance>=0&&(farDistance===30||farDistance===60),'Invalid grass draw distance.');
 const f=Math.fround,distance=f(centerDistance);
 if(distance>farDistance+20)return undefined;
 const alpha=distance>=farDistance?Math.max(0,Math.min(255,Math.floor(f(f(f(farDistance+20-distance)*color[3])/20)))):color[3];
 return [Math.trunc(intensity*color[0]/256),Math.trunc(intensity*color[1]/256),Math.trunc(intensity*color[2]/256),alpha] as const;
}

/** PlantMgr's collision-light modulation precedes GrassRenderer intensity/fade.
 * Follows the inspected source without its commented-out, uncertain *255. */
export function nativeGrassLitColor(color:readonly [number,number,number,number],lighting:number,night:number){
 requireAsset(color.length===4&&color.every(n=>Number.isInteger(n)&&n>=0&&n<=255),'Grass color must contain bytes.');
 const brightness=nativeContactBrightness(lighting,night);
 return [Math.trunc(Math.fround(color[0]*brightness)),Math.trunc(Math.fround(color[1]*brightness)),Math.trunc(Math.fround(color[2]*brightness)),color[3]] as const;
}
