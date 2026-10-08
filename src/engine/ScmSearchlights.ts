import {requireAsset} from '../assets/binary';
import {scriptThingHandle} from './ScmFires';
/* CTheScripts' script searchlights as the iOS executable has them (ScriptSearchLightArray at 0x10079d698, eight of
 * 0x98 bytes): AddScriptSearchLight (0x1001ecda4), the commands that point and move them, ProcessAllSearchLights
 * (0x1001ed44c), and the part of CHeli::SearchLightCone (0x100466ba8) that finds where the beam meets the ground,
 * which IsEntityWithinSearchLight (0x1001ecfdc) then tests. gta-reversed has the slots and ProcessAllSearchLights
 * (with the step toward the target decompiled as a product), and neither the cone nor the test. Native axes. */
type V3={x:number;y:number;z:number};
export const MAX_SCRIPT_SEARCHLIGHTS=8;
/** What a searchlight is hung on, followed by or turned with, by its script handle. */
export type SearchlightEntity={kind:'ped'|'vehicle'|'object';handle:number};
export interface ScmSearchlight {
 /** m_bUsed, m_bClipIfColliding (+0x1), m_bEnableShadow (+0x2, SWITCH_ON_GROUND_SEARCHLIGHT). */
 used:boolean;clipIfColliding:boolean;enableShadow:boolean;
 /** The state byte (+0x3): its path (0 none, 1 to the first point, 2 to the second, 3 after an entity, 4 to a point and
  * stop) and its top bit, which ProcessAllSearchLights needs set to move it at all. */
 state:number;moving:boolean;
 /** m_nId, the counter the handle's high half carries. */
 referenceIndex:number;
 /** m_Origin (+0x8): where the beam starts, an offset on the entity or bulb it hangs from, else in the world. */
 origin:V3;
 /** m_Target (+0x14), the radius of the beam there (+0x20) and at its origin (+0x24). */
 target:V3;targetRadius:number;baseRadius:number;
 /** m_PathCoord1 (+0x28), m_PathCoord2 (+0x34) and m_fPathSpeed (+0x40), units a frame. */
 path1:V3;path2:V3;pathSpeed:number;
 /** m_AttachedEntity (+0x48), m_FollowingEntity (+0x50), m_Tower (+0x58), m_Housing (+0x60), m_Bulb (+0x68). */
 attached?:SearchlightEntity;following?:SearchlightEntity;tower?:number;housing?:number;bulb?:number;
 /** m_TargetSpot (+0x70) and the two half axes of the lit ellipse on the ground (+0x7c, +0x88), which the cone sets
  * each frame it is drawn. */
 spot:V3;axisA:V3;axisB:V3;
}
const zero=():V3=>({x:0,y:0,z:0});
function empty():ScmSearchlight{
 return {used:false,clipIfColliding:false,enableShadow:false,state:0,moving:false,referenceIndex:0,origin:zero(),target:zero(),
  targetRadius:0,baseRadius:0,path1:zero(),path2:zero(),pathSpeed:0,spot:zero(),axisA:zero(),axisB:zero()};
}
const sub=(a:V3,b:V3):V3=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const add=(a:V3,b:V3,k=1):V3=>({x:a.x+b.x*k,y:a.y+b.y*k,z:a.z+b.z*k});
const dot=(a:V3,b:V3)=>a.x*b.x+a.y*b.y+a.z*b.z;
const len=(a:V3)=>Math.hypot(a.x,a.y,a.z);
/** CVector::Normalise (iOS 0x1002cb4c4): a vector of no length becomes (1, its y, its z). */
const norm=(a:V3):V3=>{const l=len(a);return l>0?{x:a.x/l,y:a.y/l,z:a.z/l}:{x:1,y:a.y,z:a.z};};
const cross=(a:V3,b:V3):V3=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});

/** CHeli::SearchLightCone's geometry (iOS 0x100466ba8): the beam runs from `origin` along to `target` and on; where a
 * line of sight from the origin to three units past the target first strikes a building is the spot (or that far
 * point, with nothing struck). The cone's edge runs from a circle of `baseRadius` round the origin to one of
 * `targetRadius` round the point 100 along, in forty steps of 9 degrees about the beam; each edge line is cut where it
 * crosses the spot's height. The ellipse the scripts test has its half axes from the spot to the cuts at 180 and 270
 * degrees. `near` and `ground` are the 41 points the cone is drawn between (each ground point no more than 100 from its
 * near one). */
export function searchlightCone(origin:V3,target:V3,targetRadius:number,baseRadius:number,lineOfSight:(from:V3,to:V3)=>V3|undefined){
 const dir=norm(sub(target,origin));
 const end=add(target,dir,3),spot=lineOfSight(origin,end)??end;
 const far=add(origin,dir,100);
 const u=norm(cross(dir,{x:0,y:0,z:1})),v=norm(cross(u,dir));
 const near:V3[]=[],ground:V3[]=[];let axisA=zero(),axisB=zero();
 for(let i=0;i<=40;i++){
  const angle=i*.15707964,s=Math.sin(angle),c=Math.cos(angle),ring={x:u.x*s+v.x*c,y:u.y*s+v.y*c,z:u.z*s+v.z*c};
  const n=add(origin,ring,baseRadius),f=add(far,ring,targetRadius);
  const t=(n.z-spot.z)/(n.z-f.z);
  let g=add(n,sub(f,n),t);
  if(i===20)axisA=sub(g,spot);else if(i===30)axisB=sub(g,spot);
  const reach=sub(g,n);if(len(reach)>100)g=add(n,norm(reach),100);
  near.push(n);ground.push(g);
 }
 return {spot,axisA,axisB,near,ground};
}
/** IsEntityWithinSearchLight's test (iOS 0x1001ecfdc): inside the lit ellipse, each half axis scaled to one. */
export function isPointWithinSearchlight(light:Pick<ScmSearchlight,'spot'|'axisA'|'axisB'>,point:V3){
 const d=sub(point,light.spot),a2=dot(light.axisA,light.axisA),b2=dot(light.axisB,light.axisB);
 if(!(a2>0)||!(b2>0))return false;
 const a=dot(d,light.axisA)/a2,b=dot(d,light.axisB)/b2;
 return a*a+b*b<=1;
}

export class ScmSearchlights {
 readonly lights:ScmSearchlight[]=Array.from({length:MAX_SCRIPT_SEARCHLIGHTS},()=>empty());
 /** CTheScripts::GetActualScriptThingIndex for a searchlight: the slot, while its id still matches the handle. */
 slotOf(handle:number){
  const index=handle&0xffff,light=this.lights[index];
  return light&&light.used&&light.referenceIndex===(handle>>>16&0xffff)?index:-1;
 }
 private live(handle:number){const index=this.slotOf(handle);return index<0?undefined:this.lights[index];}
 exists(handle:number){return this.slotOf(handle)>=0;}
 /** AddScriptSearchLight (iOS 0x1001ecda4): the first free slot, lit with its shadow, ready to move; CREATE_SEARCHLIGHT
  * gives no entity and CREATE_SEARCHLIGHT_ON_VEHICLE the vehicle, `origin` then an offset on it. */
 add(origin:V3,attached:SearchlightEntity|undefined,target:V3,targetRadius:number,baseRadius:number){
  const index=this.lights.findIndex(l=>!l.used);requireAsset(index>=0,'No free script searchlight.');
  const previous=this.lights[index].referenceIndex,light=empty();
  Object.assign(light,{used:true,enableShadow:true,moving:true,origin:{...origin},target:{...target},targetRadius,baseRadius,attached});
  const {handle,referenceIndex}=scriptThingHandle(index,previous);light.referenceIndex=referenceIndex;
  this.lights[index]=light;return handle;
 }
 /** RemoveScriptSearchLight: the slot goes back to empty, keeping its id counter. */
 remove(handle:number){const index=this.slotOf(handle);if(index<0)return;const id=this.lights[index].referenceIndex;this.lights[index]={...empty(),referenceIndex:id};}
 /** MoveSearchLightBetweenTwoPoints (iOS 0x1001ed244): back and forth, starting toward the nearer point along the
  * ground; whatever it followed is let go. */
 moveBetween(handle:number,from:V3,to:V3,speed:number){
  const light=this.live(handle);if(!light)return;
  const d1=(light.target.x-from.x)**2+(light.target.y-from.y)**2,d2=(light.target.x-to.x)**2+(light.target.y-to.y)**2;
  Object.assign(light,{path1:{...from},path2:{...to},state:d1>d2?2:1,moving:true,pathSpeed:speed,following:undefined});
 }
 /** POINT_SEARCHLIGHT_AT_CHAR (iOS 0x1001f159c) and _AT_VEHICLE: after the entity at `speed` a frame. */
 pointAt(handle:number,entity:SearchlightEntity,speed:number){
  const light=this.live(handle);if(!light)return;
  Object.assign(light,{state:3,moving:true,path1:zero(),path2:zero(),pathSpeed:speed,following:entity});
 }
 /** POINT_SEARCHLIGHT_AT_COORD (iOS 0x1001f1ef0): to the point, then stop. */
 pointAtCoord(handle:number,point:V3,speed:number){
  const light=this.live(handle);if(!light)return;
  Object.assign(light,{state:4,moving:true,path1:{...point},path2:zero(),pathSpeed:speed,following:undefined});
 }
 /** AttachSearchlightToSearchlightObject (iOS 0x1001ed318): the origin an offset on the bulb, the vehicle let go. */
 attachToObjects(handle:number,tower:number,housing:number,bulb:number,offset:V3){
  const light=this.live(handle);if(!light)return;
  Object.assign(light,{origin:{...offset},attached:undefined,tower,housing,bulb});
 }
 setClipIfColliding(handle:number,on:boolean){const light=this.live(handle);if(light)light.clipIfColliding=on;}
 setGroundLight(handle:number,on:boolean){const light=this.live(handle);if(light)light.enableShadow=on;}
 /** ProcessAllSearchLights' path step (iOS 0x1001ed44c), once a frame: toward the point (or entity) its state names by
  * the path speed, onto it once within that, and on to the next. `positionOf` answers a followed entity's position. */
 process(positionOf:(entity:SearchlightEntity)=>V3|undefined,frames=1){
  for(const light of this.lights){
   if(!light.used||!light.moving)continue;
   const goal=light.state===1||light.state===4?light.path1:light.state===2?light.path2:light.state===3&&light.following?positionOf(light.following):undefined;
   if(!goal)continue;
   const d=sub(goal,light.target),step=light.pathSpeed*frames;
   if(len(d)>step){light.target=add(light.target,norm(d),step);continue;}
   light.target={...goal};
   if(light.state===1)light.state=2;
   else if(light.state===2)light.state=1;
   else if(light.state===4){light.state=0;light.path1=zero();light.pathSpeed=0;}
  }
 }
 /** IsEntityWithinAnySearchLight (iOS 0x1001ed0f8): the first searchlight lighting the point, its handle, else -1. */
 anyLighting(point:V3){
  for(let i=0;i<this.lights.length;i++){const light=this.lights[i];if(light.used&&isPointWithinSearchlight(light,point))return (light.referenceIndex<<16|i)|0;}
  return -1;
 }
 lighting(handle:number,point:V3){const light=this.live(handle);return !!light&&isPointWithinSearchlight(light,point);}
}
