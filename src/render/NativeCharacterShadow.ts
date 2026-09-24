import {OrthographicCamera,type Matrix4,type Vector3,type WebGLRenderer} from 'three';
import {CharacterSilhouette} from './CharacterSilhouette';
import {ShadowRasterFilter} from './ShadowRasterFilter';
import {ProjectedShadow} from './ProjectedShadow';
import {configureNativeShadowCamera} from './nativeShadowCamera';
import {nativeShadowOrientation} from './nativeShadowOrientation';
import {viceCityShadowProjection} from './relatedShadowProjection';
import {nativeShadowStrength,stepNativeShadowIntensity} from './nativeShadowIntensity';
import {sampleSun} from '../world/sun';
import {nativeDayNightBalance} from '../world/nativeDayNight';
import type {ShadowFootprint} from './projectShadowReceiver';
import type {NativeCharacter} from './NativeCharacter';
import type {nativeShadowReceivers} from '../simulation/nativeShadowReceivers';
/** CPed::PreRenderAfterTest (Ped.cpp) for a ped with a real-time shadow: none when submerged (touching water); in a
 * vehicle, or walking to a car as its driver, only if that vehicle is a BMX, bike or quad; and a living ped whose
 * position (a unit above the feet) is 0.2 above BONE_SPINE1, lying down, keeps it only when ducking. */
export function drawsRealTimeShadow(ped:{submerged:boolean;vehicle?:'bike'|'other';enteringAsDriver?:'bike'|'other';alive:boolean;originZ:number;spine1Z?:number;ducking:boolean}){
 if(ped.submerged)return false;
 let draw=ped.vehicle===undefined||ped.vehicle==='bike';
 if(ped.enteringAsDriver)draw=ped.enteringAsDriver==='bike';
 if(ped.alive&&ped.spine1Z!==undefined&&ped.originZ-.2>ped.spine1Z)draw=ped.ducking;
 return draw;
}
export type ShadowReceiverQuery=(footprint:ShadowFootprint,projection:Matrix4)=>ReturnType<typeof nativeShadowReceivers>;
/** Session-owned imported-character shadow. Framing and terrain mapping are
 * related-source candidates; native raster filtering and intensity are independent. */
export class NativeCharacterShadow {
 readonly draw=new ProjectedShadow();
 private capture=new CharacterSilhouette();private filter=new ShadowRasterFilter();private camera=new OrthographicCamera();
 private intensity=0;private vertices=0;private strength=0;private error:string|null=null;private disposed=false;
 private capturedCharacter?:NativeCharacter;private captureKey:number[]=[];private captureUpdates=0;
 update(renderer:WebGLRenderer,character:NativeCharacter|undefined,query:ShadowReceiverQuery|undefined,view:Vector3,minutes:number,baseStrength:number|undefined,paused:boolean,allowed=true){
  if(this.disposed)return;
  this.vertices=0;this.strength=0;this.error=null;
  // `allowed` is PreRenderAfterTest's drawRealTimeShadow: without DoShadowThisFrame the intensity steps down.
  const sphere=character?.shadowSphere(),active=allowed&&!!character?.root.visible&&!!sphere&&!!query&&baseStrength!==undefined;
  if(!paused)this.intensity=stepNativeShadowIntensity(this.intensity,active);
  if(!active||!this.intensity){this.draw.clear();return;}
  try{
   const {center,radius}=sphere!;
   const position=character!.shadowPosition();
   this.strength=nativeShadowStrength(baseStrength!,Math.hypot(view.x-position.x,view.z-position.z),this.intensity);
   if(!this.strength){this.draw.clear();return;}
   this.camera.quaternion.copy(nativeShadowOrientation(sampleSun(minutes).direction).rotation);configureNativeShadowCamera(this.camera,center,radius);
   // Bounded browser receiver volume; native sphere/triangle selection remains
   // a calibration task. Covers the complete candidate footprint near the actor.
   const receivers=query!({center:{x:center.x,y:center.y+radius,z:center.z},side:{x:3*radius,z:0},front:{x:0,z:3*radius},depth:4*radius},viceCityShadowProjection(this.camera));
   this.vertices=receivers.vertexCount;
   if(!this.vertices){this.draw.clear();return;}
   const key=[character!.shadowPoseRevision,...character!.root.matrixWorld.elements,...this.camera.matrixWorld.elements,...this.camera.projectionMatrix.elements];
   const reuse=paused&&this.capturedCharacter===character&&key.length===this.captureKey.length&&key.every((value,i)=>value===this.captureKey[i]);
   if(!reuse){
    this.invalidateCapture();
    this.capture.update(renderer,character!.root,this.camera);this.filter.update(renderer,this.capture.texture,4,true);
    this.captureKey=key;this.capturedCharacter=character;this.captureUpdates++;
   }
   this.draw.update(receivers.chunks.map(chunk=>chunk.geometry),this.filter.texture,this.strength,nativeDayNightBalance(minutes));
  }catch(error){this.draw.clear();this.error=error instanceof Error?error.message:String(error);}
 }
 invalidateCapture(){this.capturedCharacter=undefined;this.captureKey=[];}
 reset(){this.invalidateCapture();this.intensity=0;this.vertices=0;this.strength=0;this.error=null;this.draw.clear();}
 snapshot(){return {visible:this.draw.mesh.visible,intensity:this.intensity,vertices:this.vertices,strength:this.strength,error:this.error,captureUpdates:this.captureUpdates,mapping:'related-vc-candidate'};}
 dispose(){if(this.disposed)return;this.disposed=true;this.draw.dispose();this.filter.dispose();this.capture.dispose();}
}
