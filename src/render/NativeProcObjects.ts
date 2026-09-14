import type {InstalledCollisionSource} from '../simulation/nativeScene';
import {Group,Matrix4} from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import {requireAsset} from '../assets/binary';
import {modelObject} from '../assets/ModelObjects';
import {TexturePool} from '../assets/TexturePool';
import {buildingLightingState} from '../assets/buildingMaterial';
import type {readNativeProcAssets} from '../assets/nativeProcAssets';
import {installNativeCollisionMatrix} from '../simulation/nativeCollision';
import type {NativeProcAdapter,NativeProcModel} from '../world/NativeProcPlacementManager';
import type {nativeProcTransform} from '../world/nativeProcTransform';
import type {AllocatedPlantTriangle} from '../world/NativePlantPool';
type Asset=Awaited<ReturnType<typeof readNativeProcAssets>>[number];
interface ProcEntity {asset:Asset;slot:number;visual:ReturnType<typeof modelObject>;physical?:ReturnType<typeof installNativeCollisionMatrix>;registered?:Map<number,InstalledCollisionSource>;}
const conversion=new Matrix4().makeRotationX(-Math.PI/2);

/** Native DFF/TXD render and COL adapter. Entity and visual matrices are kept
 * separate so source object-only scale never stretches collision geometry. */
export class NativeProcObjects implements NativeProcAdapter<ProcEntity> {
 readonly root=new Group();
 private readonly textures=new TexturePool();
 private readonly entities=new Set<ProcEntity>();
 private readonly assets:Map<string,Asset>;
 private readonly lighting=buildingLightingState();
 private night=0;
 private disposed=false;
 constructor(private readonly world:RAPIER.World,assets:readonly Asset[],private readonly sources=new Map<number,InstalledCollisionSource>()){
  requireAsset(new Set(assets.map(asset=>asset.name)).size===assets.length,'Duplicate native procedural assets.');
  this.root.name='native-procedural-objects';
  this.assets=new Map(assets.map(asset=>[asset.name,asset]));
 }
 allocate(model:NativeProcModel,slot:number):ProcEntity{
  requireAsset(!this.disposed,'Procedural renderer is disposed.');
  const asset=this.assets.get(model.name);
  requireAsset(asset&&asset.definition.id===model.id&&asset.entityKind===model.kind&&asset.collision.bounds.min[2]===model.minimumZ,'Procedural asset metadata mismatch.');
  const visual=modelObject(asset.model,asset.textures,undefined,this.textures,{buildingLighting:this.lighting});
  visual.setNight(this.night);
  const entity={asset,slot,visual};this.entities.add(entity);return entity;
 }
 install(entity:ProcEntity,transform:ReturnType<typeof nativeProcTransform>,triangle:AllocatedPlantTriangle){
  requireAsset(this.entities.has(entity)&&!entity.physical,'Invalid procedural render ownership.');
  const matrix=conversion.clone().multiply(new Matrix4().fromArray(transform.entityMatrix));
  const physical=installNativeCollisionMatrix(this.world,entity.asset.collision,matrix);
  entity.physical=physical;entity.registered=new Map();
  physical.sources.forEach((source,handle)=>{
   const record:InstalledCollisionSource={modelName:entity.asset.name,source,entityKind:entity.asset.entityKind,procedural:true,matrix};
   this.sources.set(handle,record);entity.registered!.set(handle,record);
  });
  const root=entity.visual.root;root.matrixAutoUpdate=false;root.matrix.copy(conversion).multiply(new Matrix4().fromArray(transform.renderMatrix));
  root.name=entity.asset.name;root.userData.nativeProcedural={slot:entity.slot,lighting:triangle.candidate.lighting,surface:triangle.candidate.surface,kind:entity.asset.entityKind};
  this.root.add(root);root.updateMatrixWorld(true);
 }
 setNight(amount:number){requireAsset(Number.isFinite(amount),'Invalid procedural night balance.');this.night=Math.max(0,Math.min(1,amount));this.lighting.night.value=this.night;for(const entity of this.entities)entity.visual.setNight(this.night);}
 setAmbient(rgb:readonly [number,number,number]){requireAsset(rgb.length===3&&rgb.every(Number.isFinite),'Invalid procedural ambient lighting.');this.lighting.ambient.value.set(...rgb);}
 destroy(entity:ProcEntity){if(!this.entities.delete(entity))return;entity.registered?.forEach((record,handle)=>{if(this.sources.get(handle)===record)this.sources.delete(handle);});entity.registered?.clear();entity.physical?.dispose();entity.visual.dispose();}
 snapshot(){return {entities:this.entities.size,colliders:[...this.entities].reduce((n,entity)=>n+(entity.physical?.sources.size??0),0)};}
 dispose(){if(this.disposed)return;this.disposed=true;for(const entity of [...this.entities])this.destroy(entity);this.root.removeFromParent();this.root.clear();this.assets.clear();}
}
