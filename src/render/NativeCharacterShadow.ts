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
export type ShadowReceiverQuery=(footprint:ShadowFootprint,projection:Matrix4)=>ReturnType<typeof nativeShadowReceivers>;
/** Session-owned imported-character shadow. Framing and terrain mapping are
 * related-source candidates; native raster filtering and intensity are independent. */
export class NativeCharacterShadow {
 readonly draw=new ProjectedShadow();
 private capture=new CharacterSilhouette();private filter=new ShadowRasterFilter();private camera=new OrthographicCamera();
 private intensity=0;private vertices=0;private strength=0;private error:string|null=null;private disposed=false;
 update(renderer:WebGLRenderer,character:NativeCharacter|undefined,query:ShadowReceiverQuery|undefined,view:Vector3,minutes:number,baseStrength:number|undefined,paused:boolean){
  if(this.disposed)return;
  this.vertices=0;this.strength=0;this.error=null;
  const sphere=character?.shadowSphere(),active=!!character?.root.visible&&!!sphere&&!!query&&baseStrength!==undefined;
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
   this.capture.update(renderer,character!.root,this.camera);this.filter.update(renderer,this.capture.texture,4,true);
   this.draw.update(receivers.chunks.map(chunk=>chunk.geometry),this.filter.texture,this.strength,nativeDayNightBalance(minutes));
  }catch(error){this.draw.clear();this.error=error instanceof Error?error.message:String(error);}
 }
 reset(){this.intensity=0;this.vertices=0;this.strength=0;this.error=null;this.draw.clear();}
 snapshot(){return {visible:this.draw.mesh.visible,intensity:this.intensity,vertices:this.vertices,strength:this.strength,error:this.error,mapping:'related-vc-candidate'};}
 dispose(){if(this.disposed)return;this.disposed=true;this.draw.dispose();this.filter.dispose();this.capture.dispose();}
}
