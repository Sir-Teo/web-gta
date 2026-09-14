import {BufferAttribute,BufferGeometry,DynamicDrawUsage,Group,InstancedMesh,Matrix4,MeshBasicMaterial} from 'three';
import {requireAsset} from '../assets/binary';
import {TexturePool} from '../assets/TexturePool';
import {bindNativeGrassCover,type NativeGrassAssets} from '../assets/nativeGrassAssets';
import type {ModelTexture} from '../assets/modelTextures';
import type {AllocatedPlantTriangle} from '../world/NativePlantPool';
import type {NativePlantSurface} from '../world/nativeVegetation';
import type {PlantPoint} from '../world/nativePlantTriangle';
import {nativeGrassInstance,nativeGrassDrawColor,nativeGrassLitColor,nativeGrassDistance} from '../world/nativeGrassInstance';
type Samples=readonly [number,number,number,number,number];
type Batch={mesh:InstancedMesh<BufferGeometry,MeshBasicMaterial>;texture:ModelTexture;samples:Samples[]};
export interface NativeGrassFrame {
 camera:PlantPoint;night:number;wind:number;quality:'low'|'medium'|'high'|'veryHigh';
 visible:(triangle:AllocatedPlantTriangle)=>boolean;
}

/** Dedicated grass pass. Supplied allocations own seed lifetime; supplied
 * sampling owns the unresolved original PRNG contract. Coordinates are GTA Z-up. */
export class NativeGrassPass {
 readonly root=new Group();
 private geometries=new Map<number,BufferGeometry>();
 private batches=new Map<AllocatedPlantTriangle,Map<number,Batch>>();
 private disposed=false;
 constructor(private readonly assets:NativeGrassAssets,private readonly surfaces:ReadonlyMap<number,NativePlantSurface>,private readonly sample:(triangle:AllocatedPlantTriangle,cover:number,index:number)=>Samples,private readonly textures=new TexturePool()){
  this.root.name='native-grass';this.root.rotation.x=-Math.PI/2;
 }
 update(triangles:readonly AllocatedPlantTriangle[],frame:NativeGrassFrame){
  if(this.disposed)return;
  requireAsset(frame.camera.length===3&&frame.camera.every(n=>Number.isFinite(n)&&Math.abs(n)<=1e7)&&Number.isFinite(frame.night)&&frame.night>=0&&frame.night<=1&&Number.isFinite(Math.fround(frame.wind))&&['low','medium','high','veryHigh'].includes(frame.quality),'Invalid grass frame.');
  const retained=new Set(triangles);
  for(const [triangle,batches] of this.batches)if(!retained.has(triangle)){
   for(const batch of batches.values())this.release(batch);this.batches.delete(triangle);
  }
  for(const batches of this.batches.values())for(const batch of batches.values())batch.mesh.visible=false;
  if(frame.quality==='low')return;
  const far=frame.quality==='medium'?30:60,matrix=new Matrix4();let order=1;
  for(const triangle of triangles){
   const candidate=triangle.candidate;if(!candidate.createsPlants||!frame.visible(triangle))continue;
   const surface=this.surfaces.get(candidate.surface);requireAsset(!!surface,'Missing grass surface for rendering.');
   const distance=nativeGrassDistance(candidate.triangle.center,frame.camera);
   for(let coverIndex=0;coverIndex<3;coverIndex++){
    const cover=surface.covers[coverIndex],count=candidate.counts?.draw[coverIndex]??0;if(cover.model===65535||!count)continue;
    const color=nativeGrassDrawColor(nativeGrassLitColor(cover.color,candidate.lighting,frame.night),cover.intensity,distance,far);if(!color)continue;
    let batches=this.batches.get(triangle);if(!batches){batches=new Map();this.batches.set(triangle,batches);}
    let batch=batches.get(coverIndex);
    if(!batch){
     const bound=bindNativeGrassCover(this.assets,candidate.slot,cover,color);
     // Samplers may reuse a scratch tuple; own each draw's retained values.
     const samples=Array.from({length:count},(_,index)=>[...this.sample(triangle,coverIndex,index)] as unknown as Samples);
     // Validate samples before allocating GPU-facing resources.
     for(const sample of samples)nativeGrassInstance(candidate.triangle.vertices,cover,sample,frame.wind);
     let geometry=this.geometries.get(cover.model);
     if(!geometry){
      const source=bound.model.geometries[0];geometry=new BufferGeometry();
      geometry.setAttribute('position',new BufferAttribute(source.positions,3));geometry.setAttribute('uv',new BufferAttribute(source.uvs[0],2));geometry.setIndex(new BufferAttribute(source.indices,1));
      this.geometries.set(cover.model,geometry);
     }
     const texture=bound.textures[0],material=new MeshBasicMaterial({map:this.textures.acquire(texture),transparent:true,depthWrite:false,depthTest:true,alphaTest:0,fog:true,toneMapped:false});
     const mesh=new InstancedMesh(geometry,material,count);mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(DynamicDrawUsage);
     batch={mesh,texture,samples};batches.set(coverIndex,batch);this.root.add(mesh);
    }
    const {mesh}=batch;mesh.visible=true;mesh.renderOrder=order++;mesh.material.color.setRGB(color[0]/255,color[1]/255,color[2]/255);mesh.material.opacity=color[3]/255;
    let written=0;
    for(const samples of batch.samples){
     const instance=nativeGrassInstance(candidate.triangle.vertices,cover,samples,frame.wind);
     if(nativeGrassDistance(instance.position,frame.camera)<1)continue;
     mesh.setMatrixAt(written++,matrix.fromArray(instance.matrix));
    }
    mesh.count=written;mesh.instanceMatrix.needsUpdate=true;
   }
  }
 }
 private release(batch:Batch){batch.mesh.removeFromParent();batch.mesh.dispose();batch.mesh.material.dispose();this.textures.release(batch.texture);}
 dispose(){
  if(this.disposed)return;this.disposed=true;
  for(const batches of this.batches.values())for(const batch of batches.values())this.release(batch);
  for(const geometry of this.geometries.values())geometry.dispose();
  this.batches.clear();this.geometries.clear();this.root.removeFromParent();this.root.clear();
 }
}
