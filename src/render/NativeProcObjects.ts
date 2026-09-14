import type {InstalledCollisionSource} from '../simulation/nativeScene';
import {Group,Matrix4,Sphere,Vector3,Frustum,type PerspectiveCamera} from 'three';
import {placementFade} from './placementFade';
import {distanceFadeWidth,distanceFadeAlpha} from './distanceFade';
import type RAPIER from '@dimforge/rapier3d-compat';
import {requireAsset} from '../assets/binary';
import {modelObject} from '../assets/ModelObjects';
import {TexturePool} from '../assets/TexturePool';
import {nativeAmbientState} from '../assets/nativeMaterial';
import {nativeContactLightMultiplier} from '../simulation/nativeContactLighting';
import {buildingLightingState} from '../assets/buildingMaterial';
import type {readNativeProcAssets} from '../assets/nativeProcAssets';
import {installNativeCollisionMatrix} from '../simulation/nativeCollision';
import type {NativeProcAdapter,NativeProcModel} from '../world/NativeProcPlacementManager';
import type {nativeProcTransform} from '../world/nativeProcTransform';
import type {AllocatedPlantTriangle} from '../world/NativePlantPool';
import {nativeTreeType,nativeTreeWind,type NativeTreeWindState} from '../world/nativeTreeWind';
type Asset=Awaited<ReturnType<typeof readNativeProcAssets>>[number];
interface ProcEntity {asset:Asset;slot:number;visual:ReturnType<typeof modelObject>;physical?:ReturnType<typeof installNativeCollisionMatrix>;registered?:Map<number,InstalledCollisionSource>;fade:ReturnType<typeof placementFade>;origin?:Vector3;sphere?:Sphere;nativeVisual?:Matrix4;}
const conversion=new Matrix4().makeRotationX(-Math.PI/2);

/** Native DFF/TXD render and COL adapter. Entity and visual matrices are kept
 * separate so source object-only scale never stretches collision geometry. */
export class NativeProcObjects implements NativeProcAdapter<ProcEntity> {
 readonly root=new Group();
 private readonly textures=new TexturePool();
 private readonly entities=new Set<ProcEntity>();
 private readonly assets:Map<string,Asset>;
 private readonly lighting=buildingLightingState();
 private readonly frustum=new Frustum();
 private readonly view=new Matrix4();
 private readonly cameraPosition=new Vector3();
 private readonly entityLighting={building:nativeAmbientState(),object:nativeAmbientState()};
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
  requireAsset(asset&&typeof asset.definition.drawDistance==='number'&&Number.isFinite(asset.definition.drawDistance)&&asset.definition.drawDistance>=0&&asset.definition.id===model.id&&asset.entityKind===model.kind&&asset.collision.bounds.min[2]===model.minimumZ,'Procedural asset metadata mismatch.');
  const visual=modelObject(asset.model,asset.textures,undefined,this.textures,{buildingLighting:this.lighting,worldLighting:true,ambient:this.entityLighting[asset.entityKind]});
  visual.setNight(this.night);
  let fade:ReturnType<typeof placementFade>;
  try{fade=placementFade(visual.root,asset.definition.flags,0,true);}catch(error){visual.dispose();throw error;}
  const entity={asset,slot,visual,fade};this.entities.add(entity);return entity;
 }
 install(entity:ProcEntity,transform:ReturnType<typeof nativeProcTransform>,triangle:AllocatedPlantTriangle,seed:number){
  requireAsset(this.entities.has(entity)&&!entity.physical,'Invalid procedural render ownership.');
  requireAsset(Number.isInteger(seed)&&seed>=0&&seed<=0xffff,'Invalid procedural entity seed.');
  const matrix=conversion.clone().multiply(new Matrix4().fromArray(transform.entityMatrix));
  const physical=installNativeCollisionMatrix(this.world,entity.asset.collision,matrix);
  entity.physical=physical;entity.registered=new Map();
  entity.origin=new Vector3().setFromMatrixPosition(matrix);
  entity.sphere=new Sphere(new Vector3(...entity.asset.collision.bounds.center),entity.asset.collision.bounds.radius).applyMatrix4(matrix);
  physical.sources.forEach((source,handle)=>{
   const record:InstalledCollisionSource={modelName:entity.asset.name,source,entityKind:entity.asset.entityKind,procedural:true,matrix};
   this.sources.set(handle,record);entity.registered!.set(handle,record);
  });
  entity.nativeVisual=new Matrix4().fromArray(transform.renderMatrix);
  const root=entity.visual.root;root.matrixAutoUpdate=false;root.matrix.copy(conversion).multiply(entity.nativeVisual);
  root.name=entity.asset.name;root.userData.nativeProcedural={slot:entity.slot,seed,lighting:triangle.candidate.lighting,surface:triangle.candidate.surface,kind:entity.asset.entityKind};
  this.root.add(root);root.updateMatrixWorld(true);
 }
 /** PreRender adapter with explicit native identity and weather inputs. A
  * browser allocation slot is not a substitute for the source entity address. */
 updateTreeWind(entity:ProcEntity,state:NativeTreeWindState,status:{paused:boolean;exploded:boolean}){
  requireAsset(this.entities.has(entity)&&entity.nativeVisual,'Invalid procedural wind ownership.');
  const type=nativeTreeType(entity.asset.definition.flags??0);
  if(status.paused||!entity.visual.root.visible||!type||(entity.asset.entityKind==='object'&&status.exploded))return false;
  const [x,y]=nativeTreeWind(state,type==='palm');
  entity.nativeVisual.elements[8]=x;entity.nativeVisual.elements[9]=y;
  const root=entity.visual.root;root.matrix.copy(conversion).multiply(entity.nativeVisual);root.updateMatrixWorld(true);
  return true;
 }
 /** Loaded non-LOD map entities. Visibility never releases simulation ownership. */
 updateView(camera:PerspectiveCamera,lodDistanceMultiplier=1){
  requireAsset(Number.isFinite(lodDistanceMultiplier)&&lodDistanceMultiplier>0&&lodDistanceMultiplier<=10,'Invalid procedural LOD distance multiplier.');
  camera.updateWorldMatrix(true,false);this.cameraPosition.setFromMatrixPosition(camera.matrixWorld);
  this.frustum.setFromProjectionMatrix(this.view.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),camera.coordinateSystem,camera.reversedDepth);
  for(const entity of this.entities){
   if(!entity.origin||!entity.sphere)continue;
   const drawDistance=entity.asset.definition.drawDistance!;
   const range=Math.min(drawDistance*lodDistanceMultiplier,camera.far+entity.asset.collision.bounds.radius);
   const width=distanceFadeWidth(range,drawDistance,false),distance=entity.origin.distanceTo(this.cameraPosition);
   const alpha=distanceFadeAlpha(distance,range,drawDistance,false,width),fading=distance>=range+20-width;
   entity.visual.root.visible=alpha>0&&this.frustum.intersectsSphere(entity.sphere);
   if(entity.visual.root.visible){entity.fade.setAlpha(alpha,fading);entity.fade.setDistance(distance);}
  }
 }
 /** Static procedural entities have zero initial contact brightness. Generated
  * point-light factor is explicitly neutral (1) until its native routine is
  * reconstructed; subsequent physical contact updates are separate systems. */
 setEntityLighting(worldAmbient:readonly [number,number,number],objectAmbient:readonly number[]|undefined,sunMultiplier:number){
  requireAsset(Number.isFinite(sunMultiplier)&&sunMultiplier>=.6&&sunMultiplier<=1,'Invalid procedural sun multiplier.');
  const objectFactor=nativeContactLightMultiplier(worldAmbient,0);
  requireAsset(!objectAmbient||objectAmbient.length===3&&objectAmbient.every(v=>Number.isFinite(v)&&v>=0),'Invalid procedural object ambient.');
  for(const kind of ['building','object'] as const){
   const state=this.entityLighting[kind],factor=kind==='building'?.5:objectFactor;
   state.enabled.value=!!objectAmbient;state.directMultiplier.value=factor;
   if(objectAmbient)state.color.value.set(objectAmbient[0],objectAmbient[1],objectAmbient[2]).multiplyScalar(sunMultiplier*factor);
  }
 }
 setNight(amount:number){requireAsset(Number.isFinite(amount),'Invalid procedural night balance.');this.night=Math.max(0,Math.min(1,amount));this.lighting.night.value=this.night;for(const entity of this.entities)entity.visual.setNight(this.night);}
 setAmbient(rgb:readonly [number,number,number]){requireAsset(rgb.length===3&&rgb.every(Number.isFinite),'Invalid procedural ambient lighting.');this.lighting.ambient.value.set(...rgb);}
 destroy(entity:ProcEntity){if(!this.entities.delete(entity))return;entity.registered?.forEach((record,handle)=>{if(this.sources.get(handle)===record)this.sources.delete(handle);});entity.registered?.clear();entity.physical?.dispose();entity.fade.dispose();entity.visual.dispose();}
 snapshot(){return {entities:this.entities.size,colliders:[...this.entities].reduce((n,entity)=>n+(entity.physical?.sources.size??0),0)};}
 dispose(){if(this.disposed)return;this.disposed=true;for(const entity of [...this.entities])this.destroy(entity);this.root.removeFromParent();this.root.clear();this.assets.clear();}
}
