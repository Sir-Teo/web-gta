import type {NativeGrassAssets} from '../assets/nativeGrassAssets';
import type {SurfaceInfoRecord} from '../assets/surfaceInfo';
import {requireAsset} from '../assets/binary';
import {NativeGrassPass,type NativeGrassFrame} from '../render/NativeGrassPass';
import {NativeBuildingSectors} from './NativeBuildingSectors';
import {NativePlantEntityCache,type NativePlantEntity} from './NativePlantEntityCache';
import {NativePlantPool,type NativePlantPoolHooks} from './NativePlantPool';
import type {NativePlantSurface} from './nativeVegetation';
import type {PlantPoint} from './nativePlantTriangle';

/** Session owner for imported native vegetation. Entity insertion order,
 * scheduling and random streams are explicit caller contracts. */
export class NativeVegetationScene {
 private readonly entities=new Map<string,NativePlantEntity>();
 private readonly sectors=new NativeBuildingSectors();
 private readonly pool:NativePlantPool;
 private readonly cache:NativePlantEntityCache;
 private readonly pass:NativeGrassPass;
 private disposed=false;
 constructor(entities:readonly NativePlantEntity[],assets:NativeGrassAssets,private readonly surfaces:ReadonlyMap<number,NativePlantSurface>,private readonly info:ReadonlyMap<number,SurfaceInfoRecord>,hooks:NativePlantPoolHooks,sample:ConstructorParameters<typeof NativeGrassPass>[2]){
  this.pool=new NativePlantPool(hooks);this.cache=new NativePlantEntityCache(this.pool);this.pass=new NativeGrassPass(assets,surfaces,sample);
  try{
   for(const entity of entities){
    requireAsset(!this.entities.has(entity.identity),'Duplicate vegetation scene entity.');
    this.sectors.add(entity,false);this.entities.set(entity.identity,entity);
   }
  }catch(error){this.dispose();throw error;}
 }
 get root(){return this.pass.root;}
 get entityCount(){return this.entities.size;}
 get cachedEntityCount(){return this.cache.identities().length;}
 allocations(){return this.pool.triangles();}
 /** Full camera preupdate: fast=false, phase omitted. Ordinary ticks must
  * supply the verified cache-update cadence and selected triangle phase. */
 simulate(camera:PlantPoint,fast=false,phase?:number){
  if(this.disposed)return;
  requireAsset(camera.length===3&&camera.every(n=>Number.isFinite(n)&&Math.abs(n)<=1e7)&&(phase===undefined||Number.isInteger(phase)&&phase>-8&&phase<8),'Invalid vegetation update.');
  const resolve=(identity:string)=>this.entities.get(identity);
  this.cache.update(camera,fast,this.sectors.scan(camera),resolve);
  this.cache.process(camera,resolve,this.info,this.surfaces,phase);
 }
 render(frame:NativeGrassFrame){if(!this.disposed)this.pass.update(this.pool.triangles(),frame);}
 /** Deleted entities leave sectors immediately; the next cache update removes
  * their cached allocations through the missing-reference path. */
 removeEntity(identity:string){if(this.disposed)return;this.sectors.remove(identity);this.entities.delete(identity);}
 dispose(){
  if(this.disposed)return;this.disposed=true;
  this.cache.clear();this.pass.dispose();this.sectors.clear();this.entities.clear();
 }
}
