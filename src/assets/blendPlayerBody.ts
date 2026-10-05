import {requireAsset} from './binary';
import type {ModelGeometry} from './dff';
import type {ModelTexture} from './modelTextures';
/* CClothesBuilder's blend of CJ's three bodies (each clothing DFF's normal, fat and ripped clumps, and the skin
 * dictionaries' torso, torso_fat and torso_ripped) by his fat and muscle. gta-reversed leaves BlendGeometry, the ratio
 * code and ConstructTextures unreversed, and its BlendTextures loops step the pixel count inside the channel loop; the
 * iOS executable's are followed here. */
export interface PlayerBodyRatios {normal:number;fat:number;ripped:number}
const f=Math.fround;
/** CreateSkinnedClump's ratios (iOS 0x1002dcdb0; gta-reversed's 0x5A42B0 sketch agrees): fat past 200 over 800 and
 * muscle over 1000, each held to 0 to 1; if together they pass 1 they are scaled down to share it and normal has
 * none, else normal is what is left. */
export function playerBodyRatios(fatStat:number,muscleStat:number):PlayerBodyRatios{
 let fat=Math.min(f(Math.max(f(fatStat-200),0)/800),1),ripped=Math.min(f(Math.max(muscleStat,0)/1000),1),normal=0;
 const sum=f(fat+ripped);
 if(sum>1){fat=f(fat/sum);ripped=f(ripped/sum);}else normal=f(1-sum);
 return {normal,fat,ripped};
}
/** BlendGeometry(clump, "normal", "fat", "ripped", ...) (iOS 0x1002de31c): the normal geometry's triangles and
 * materials, each vertex's position, normal and UV the ratios' sum of the three bodies' (the normal made unit length
 * again); its bone influences the three bodies' four each, scaled by their ratio, those of no weight left out and
 * those on the same bone added, kept in that order. The first four are kept, and divided by their sum only when a
 * fifth bone had weight. */
export function blendPlayerGeometry(normal:ModelGeometry,fat:ModelGeometry,ripped:ModelGeometry,r:PlayerBodyRatios):ModelGeometry{
 const bodies=[normal,fat,ripped],ratios=[f(r.normal),f(r.fat),f(r.ripped)];
 const count=normal.positions.length/3;
 for(const g of bodies){
  requireAsset(g.positions.length===count*3&&g.normals?.length===count*3&&g.uvs[0]?.length===count*2,'Player bodies to blend need the same vertices, normals and UVs.');
  requireAsset(g.skin&&g.skin.indices.length===count*4&&g.skin.weights.length===count*4,'Player bodies to blend need four skin influences a vertex.');
 }
 const out=structuredClone(normal),positions=out.positions,normals=out.normals!,uvs=out.uvs[0],skin=out.skin!;
 const sum3=(read:(g:ModelGeometry)=>ArrayLike<number>,i:number)=>f(f(f(read(normal)[i]*ratios[0])+f(read(fat)[i]*ratios[1]))+f(read(ripped)[i]*ratios[2]));
 const bones=new Uint8Array(8),weights=new Float32Array(8);
 for(let v=0;v<count;v++){
  for(let c=0;c<3;c++)positions[v*3+c]=sum3(g=>g.positions,v*3+c);
  let nx=sum3(g=>g.normals!,v*3),ny=sum3(g=>g.normals!,v*3+1),nz=sum3(g=>g.normals!,v*3+2);
  const length=f(Math.hypot(nx,ny,nz));if(length>0){nx=f(nx/length);ny=f(ny/length);nz=f(nz/length);}
  normals[v*3]=nx;normals[v*3+1]=ny;normals[v*3+2]=nz;
  for(let c=0;c<2;c++)uvs[v*2+c]=sum3(g=>g.uvs[0],v*2+c);
  // AddWeightToBoneVertex (0x5A4840): a new bone takes the next free entry; one already listed gains the weight.
  bones.fill(0);weights.fill(0);let listed=0;
  for(let b=0;b<3;b++)for(let k=0;k<4;k++){
   const weight=f(bodies[b].skin!.weights[v*4+k]*ratios[b]);if(weight===0)continue;
   const bone=bodies[b].skin!.indices[v*4+k];let e=0;
   while(e<listed&&bones[e]!==bone)e++;
   if(e===listed){bones[e]=bone;weights[e]=weight;listed++;}else weights[e]=f(weights[e]+weight);
  }
  const total=listed>4?f(f(f(weights[0]+weights[1])+weights[2])+weights[3]):1;
  for(let k=0;k<4;k++){skin.indices[v*4+k]=bones[k];skin.weights[v*4+k]=listed>4?f(weights[k]/total):weights[k];}
 }
 return out;
}
/** BlendTextures(dst, src1, src2, ...) (iOS 0x1002de01c): each pixel's red, green and blue the ratios' sum of the
 * three, cut to a whole number; alpha the normal texture's. */
export function blendPlayerTextures(normal:ModelTexture,fat:ModelTexture,ripped:ModelTexture,r:PlayerBodyRatios):ModelTexture{
 const [a,b,c]=[normal,fat,ripped].map(t=>t.mips[0]);
 requireAsset(a&&b&&c&&a.width===b.width&&a.width===c.width&&a.height===b.height&&a.height===c.height&&a.data.length===a.width*a.height*4&&b.data.length===a.data.length&&c.data.length===a.data.length,'Player skin textures to blend need the same size.');
 const data=a.data.slice(),rn=f(r.normal),rf=f(r.fat),rr=f(r.ripped);
 for(let i=0;i<data.length;i+=4)for(let k=0;k<3;k++)data[i+k]=Math.trunc(f(f(f(a.data[i+k]*rn)+f(b.data[i+k]*rf))+f(c.data[i+k]*rr)));
 // CopyTexture's copy, as composePlayerTexture makes it: the top level alone, filtered linearly.
 let hasAlpha=false;for(let i=3;i<data.length;i+=4)if(data[i]!==255){hasAlpha=true;break;}
 return {name:normal.name,filter:2,addressU:1,addressV:1,hasAlpha,mips:[{width:a.width,height:a.height,data}]};
}
