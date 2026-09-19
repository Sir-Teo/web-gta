/** CCoronas and CRegisteredCorona (gta-reversed 0076f901, Coronas.cpp 0x6FADF0-0x6FC4D0, RegisteredCorona.cpp
 * 0x6FABF0) for the world's coronas: slots registered each frame, faded in and out, and drawn by the caller. Positions
 * are native world units. The sun keeps its own `SunCoronas`. */
export const MAX_NUM_CORONAS=64;
export interface NativeCorona {
 /** m_dwId; 0 is a free slot. */
 id:number;
 color:[number,number,number];
 /** m_Color.a: the registered intensity. */
 alpha:number;
 /** m_FadedIntensity. */
 faded:number;
 position:[number,number,number];size:number;farClip:number;
 /** m_fNearClip: how far the sprite is pulled toward the camera. */
 nearClip:number;
 checkObstacles:boolean;fadeSpeed:number;onlyFromBelow:boolean;flareType:number;reflection:boolean;
 offScreen:boolean;justCreated:boolean;registeredThisFrame:boolean;
 /** m_bHasValidHeightAboveGround and m_fHeightAboveGround, for the wet-road reflection. */
 validHeight:boolean;heightAboveGround:number;
}
export interface CoronaRegistration {
 id:number;color:readonly [number,number,number];intensity:number;position:readonly [number,number,number];size:number;range:number;
 flareType?:number;reflection?:boolean;checkObstacles?:boolean;neonFade?:boolean;pullTowardsCamera?:number;fullBrightAtStart?:boolean;
 fadeSpeed?:number;onlyFromBelow?:boolean;
}
const empty=():NativeCorona=>({id:0,color:[0,0,0],alpha:0,faded:0,position:[0,0,0],size:0,farClip:0,nearClip:0,checkObstacles:false,fadeSpeed:15,onlyFromBelow:false,flareType:0,reflection:false,offScreen:true,justCreated:false,registeredThisFrame:false,validHeight:false,heightAboveGround:0});

export class NativeCoronas {
 readonly coronas:NativeCorona[]=Array.from({length:MAX_NUM_CORONAS},empty);
 /** NumCoronas. */
 count=0;
 /** bChangeBrightnessImmediately: three frames after the camera's look direction changes. */
 changeImmediately=0;
 private lastLook=0;
 /** CCoronas::RegisterCorona (0x6FC180), unattached. `camera` is TheCamera's position. */
 register(r:CoronaRegistration,camera:readonly [number,number,number]){
  const dx=camera[0]-r.position[0],dy=camera[1]-r.position[1];
  if(r.range*r.range<dx*dx+dy*dy)return;
  let alpha=r.intensity;
  if(r.neonFade){
   const d=Math.hypot(dx,dy,camera[2]-r.position[2]);
   if(d<35)return;
   // alpha *= uint8((d - 35) / 15): zero until 50 units.
   if(d<50)alpha=(alpha*Math.trunc((d-35)/15))&255;
  }
  let c=this.coronas.find(k=>k.id===r.id);
  if(c){
   if(!c.alpha&&!alpha){c.id=0;this.count--;return;}
  }else{
   c=this.coronas.find(k=>!k.id);if(!c)return;
   c.faded=r.fullBrightAtStart?255:0;c.offScreen=true;c.justCreated=true;c.id=r.id;this.count++;
  }
  c.color=[r.color[0],r.color[1],r.color[2]];c.alpha=alpha;c.position=[r.position[0],r.position[1],r.position[2]];c.size=r.size;
  c.registeredThisFrame=true;c.farClip=r.range;c.nearClip=r.pullTowardsCamera??1.5;c.flareType=r.flareType??0;c.reflection=!!r.reflection;
  c.checkObstacles=!!r.checkObstacles;c.fadeSpeed=r.fadeSpeed??15;c.onlyFromBelow=!!r.onlyFromBelow;
 }
 /** CCoronas::UpdateCoronaCoors (0x6FC4D0). */
 updateCoors(id:number,position:readonly [number,number,number],range:number,camera:readonly [number,number,number]){
  const dx=camera[0]-position[0],dy=camera[1]-position[1];
  if(range*range<dx*dx+dy*dy)return;
  const c=this.coronas.find(k=>k.id===id);if(c)c.position=[position[0],position[1],position[2]];
 }
 /** CCoronas::Update (0x6FADF0) with CRegisteredCorona::Update for each slot. `lookMask` is the camera's look flags;
  * `lineOfSightClear` tests buildings only. */
 update(timeStep:number,camera:readonly [number,number,number],lookMask:number,lineOfSightClear:(from:readonly [number,number,number],to:readonly [number,number,number])=>boolean){
  if(this.lastLook===lookMask)this.changeImmediately=Math.max(this.changeImmediately-1,0);else this.changeImmediately=3;
  this.lastLook=lookMask;
  for(const c of this.coronas){
   if(!c.id)continue;
   if(!c.registeredThisFrame)c.alpha=0;
   const step=timeStep*c.fadeSpeed;
   if(!c.checkObstacles||lineOfSightClear(c.position,camera)){
    if(c.offScreen||c.onlyFromBelow&&camera[2]>c.position[2])c.faded=Math.trunc(Math.max(0,c.faded-step));
    else{
     c.faded=Math.trunc(c.faded<c.alpha?Math.min(c.alpha,c.faded+step):Math.max(c.alpha,c.faded-step));
     if(this.changeImmediately)c.faded=c.alpha;
    }
   }else c.faded=Math.trunc(Math.max(0,c.faded-step));
   if(!c.faded&&!c.justCreated){c.id=0;this.count--;}
   c.justCreated=false;c.registeredThisFrame=false;
  }
 }
}
/** A wet-road reflection to draw: the corona mirrored through the ground under it. */
export interface CoronaReflection {position:[number,number,number];size:number;color:[number,number,number];farClip:number;heightFactor:number}
/** CCoronas::RenderReflections (0x6FB630) up to the projection: with the roads wet, each registered reflecting corona
 * finds the ground under it (every 16th frame per slot, or while it has none) and, if it is under 20 above ground that
 * is below the camera, reflects to the same depth under the ground. The far clip is min(55, 0.75 × its own), and the
 * brightness falls off with height (1 − h / 20). gta-reversed's loop checks neither the slot's id nor its reflection
 * flag, compares the valid-height bool with 20, and tests `(i & 255) + (frame & 255) % 16`; the id, flag, height and a
 * slot-staggered `(i + frame) % 16` are used instead. */
export function coronaReflections(coronas:NativeCoronas,wetRoads:number,frame:number,camera:readonly [number,number,number],groundZ:(position:readonly [number,number,number])=>number|undefined):CoronaReflection[]{
 if(wetRoads<=0){for(const c of coronas.coronas)c.validHeight=false;return [];}
 const out:CoronaReflection[]=[];
 coronas.coronas.forEach((c,i)=>{
  if(!c.id||!c.reflection)return;
  if(!c.validHeight||(i+frame)%16===0){const z=groundZ(c.position);if(z!==undefined){c.validHeight=true;c.heightAboveGround=c.position[2]-z;}}
  if(!c.validHeight||c.heightAboveGround>=20||c.position[2]-c.heightAboveGround>=camera[2])return;
  out.push({position:[c.position[0],c.position[1],c.position[2]-2*c.heightAboveGround],size:c.size,color:[...c.color],farClip:Math.min(55,c.farClip*.75),heightFactor:1-c.heightAboveGround/20});
 });
 return out;
}
/** CRegisteredCorona::CalculateIntensity: full to half the far clip, gone at it. */
export function coronaIntensity(depth:number,farClip:number){return Math.max(0,Math.min(1,(farClip-depth)/(farClip-farClip/2)));}
