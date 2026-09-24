import * as THREE from 'three';
import {modelObject} from '../assets/ModelObjects';
import {TexturePool} from '../assets/TexturePool';
import {nativeAmbientState} from '../assets/nativeMaterial';
import {nativeContactLightMultiplier} from '../simulation/nativeContactLighting';
import type {EscalatorAssets} from '../assets/escalatorAssets';
import {NativeEscalatorField,planEscalator,type EscalatorPlan,type Vec3} from '../world/nativeEscalators';
import type {ModelEscalatorEffect} from '../assets/twoDEffect';
/** CEscalators over the installed scene: every escalator 2d effect of a streamed placement becomes a plan in the
 * field, and each built escalator's steps are cloned step models positioned every frame. The step objects live in
 * one world-space group in native axes, as CEscalator adds them to the world rather than to the entity. */
export class NativeEscalators {
 readonly field=new NativeEscalatorField();
 readonly group=new THREE.Group();
 private assets?:EscalatorAssets;
 private pool=new TexturePool();
 private ambient=nativeAmbientState();
 private sources?:{sloped:ReturnType<typeof modelObject>;flat:ReturnType<typeof modelObject>};
 private steps=new Map<number,THREE.Object3D[]>();
 private pending:{effect:ModelEscalatorEffect;position:Vec3;matrix:readonly number[]}[]=[];
 private keyed=new Set<string>();
 constructor(scene?:THREE.Scene){
  this.group.name='Native escalators';this.group.rotation.x=-Math.PI/2;this.group.matrixAutoUpdate=false;this.group.updateMatrix();
  scene?.add(this.group);
 }
 get ready(){return !!this.assets;}
 /** The step models; plans added before they arrive are planned once they do. */
 setAssets(assets:EscalatorAssets){
  this.assets=assets;
  this.sources={sloped:modelObject(assets.sloped.model,assets.sloped.textures,undefined,this.pool,{worldLighting:true,ambient:this.ambient}),
   flat:modelObject(assets.flat.model,assets.flat.textures,undefined,this.pool,{worldLighting:true,ambient:this.ambient})};
  const pending=this.pending.splice(0);
  for(const p of pending)this.addEffect(p.effect,p.position,p.matrix);
 }
 /** CEntity::CreateEffects: the effect's four points through the placement's native modelling matrix (right, up,
  * at and position rows, twelve numbers). */
 addEffect(effect:ModelEscalatorEffect,position:Vec3,matrix:readonly number[]){
  const transform=(p:readonly number[]):Vec3=>[
   matrix[0]*p[0]+matrix[3]*p[1]+matrix[6]*p[2]+matrix[9],
   matrix[1]*p[0]+matrix[4]*p[1]+matrix[7]*p[2]+matrix[10],
   matrix[2]*p[0]+matrix[5]*p[1]+matrix[8]*p[2]+matrix[11]];
  const start=transform(position);
  const key=`${start.map(v=>v.toFixed(2)).join(',')}|${effect.direction}`;
  if(this.keyed.has(key))return false;
  if(!this.assets){this.pending.push({effect,position,matrix});return false;}
  this.keyed.add(key);
  return this.field.add(planEscalator(start,transform(effect.bottom),transform(effect.top),transform(effect.end),effect.direction===0,this.assets.stepHeight));
 }
 /** The steps light like any other world object (CEntity's object ambient and the sun multiplier). */
 setLighting(worldAmbient:readonly [number,number,number]|undefined,objectAmbient:readonly number[]|undefined,sunMultiplier:number){
  const factor=worldAmbient?nativeContactLightMultiplier(worldAmbient,0):1;
  this.ambient.enabled.value=!!objectAmbient;this.ambient.directMultiplier.value=factor;
  if(objectAmbient&&objectAmbient.length===3)this.ambient.color.value.set(objectAmbient[0],objectAmbient[1],objectAmbient[2]).multiplyScalar(sunMultiplier*factor);
 }
 /** CEscalators::Update: build or drop each escalator's steps and place them. `cameraPosition` is renderer space. */
 update(cameraPosition:{x:number;y:number;z:number},timeStep:number){
  if(!this.sources)return;
  const drawn=this.field.update([cameraPosition.x,-cameraPosition.z,cameraPosition.y],timeStep);this.drawn=drawn;
  const alive=new Set<number>();
  for(const {escalator,steps} of drawn){
   const index=this.field.escalators.indexOf(escalator);alive.add(index);
   let objects=this.steps.get(index);
   if(!objects){
    objects=steps.map(step=>{const clone=(step.sloped?this.sources!.sloped:this.sources!.flat).root.clone(true);clone.matrixAutoUpdate=false;this.group.add(clone);return clone;});
    this.steps.set(index,objects);
   }
   const rotation=escalator.plan.rotation;
   for(const [i,object] of objects.entries()){
    const step=steps[i];if(!step)continue;
    // The shared rotation's rows are the native right, forward and up; the model's own Z-up turn is on the group.
    object.matrix.set(
     rotation[0][0],rotation[1][0],rotation[2][0],step.position[0],
     rotation[0][1],rotation[1][1],rotation[2][1],step.position[1],
     rotation[0][2],rotation[1][2],rotation[2][2],step.position[2],
     0,0,0,1);
    object.matrixWorldNeedsUpdate=true;object.visible=true;
   }
  }
  for(const [index,objects] of this.steps)if(!alive.has(index)){for(const object of objects){object.removeFromParent();}this.steps.delete(index);}
 }
 private drawn:ReturnType<NativeEscalatorField['update']>=[];
 /** The move speed (renderer space, units a second) of the built step under `feet` (renderer space), if any. */
 carrySpeed(feet:{x:number;y:number;z:number}){
  const step=NativeEscalatorField.stepUnder(this.drawn,[feet.x,-feet.z,feet.y]);
  return step?{x:step.speed[0]*50,y:step.speed[2]*50,z:-step.speed[1]*50}:undefined;
 }
 snapshot(){return {ready:!!this.assets,...this.field.snapshot(),drawn:[...this.steps.values()].reduce((n,o)=>n+o.length,0)};}
 dispose(){
  this.group.removeFromParent();this.steps.clear();this.field.clear();this.keyed.clear();this.pending.length=0;
  this.sources?.sloped.dispose();this.sources?.flat.dispose();this.sources=undefined;this.assets=undefined;
 }
}
