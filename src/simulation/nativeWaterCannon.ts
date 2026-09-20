/* CAutomobile::FireTruckControl and CWaterCannon / CWaterCannons (gta-reversed ead3051) for the Fire Truck (407) and
 * the S.W.A.T. tank (601) under the player. With the camera on its string the nozzle follows the camera front: yaw
 * (m_fDoomVerticalRotation) at a fiftieth of a step over 20 toward atan2(−front.x, front.y), pitch
 * (m_fDoomHorizontalRotation) at the step in seconds toward atan2(front.z, |front.xy|) lifted 15° (22° on the
 * S.W.A.T.), the yaw wrapped to ±π and the pitch clamped to ±20° (−10°…35° on the S.W.A.T.). While the car gun is
 * held a water section leaves the misc_a node (or (0, 1.5, 1.8) in car space) each frame: 1.2 (2.0) units along the
 * nozzle direction plus the node's own speed for a step, moving at the car's speed (its z scaled 0.3) plus 0.5 (0.4)
 * of that direction, with up to 15/1000 of a unit of random lift. A cannon keeps 32 sections in a ring: after its
 * first 150 ms the write slot advances (and empties) every frame, each live section falls at 1/250 a step² and puts
 * out fires within 2 units at strength 0.5, every fourth frame the sections push peds within √5 units (a fall-and-get-
 * up with the ped's speed pulled toward 0.6 of the water's, capped at 0.2 a step), and the cannon frees itself once
 * no section is live. Rendering draws three crossed quads per consecutive pair of live sections under 5 units apart
 * (size i²/32 + 3 scaled by 1/20; colour 200, 200, 255 at alpha 64 × (1 − i/32)) and stops at the first pair whose
 * line of sight is blocked, where four prt_watersplash particles burst along the surface normal.
 * Native car space and world space: x right, y forward, z up; speeds in units a time step. */
export type V3={x:number;y:number;z:number};
export const CANNON_SECTIONS=32,CANNON_LIFETIME_MS=150,CANNON_PUSH_RANGE2=5,CANNON_RENDER_RANGE2=25;
export const CANNON_MODELS=new Set([407,601]);
export interface CannonAim {yaw:number;pitch:number}
export function initialCannonAim():CannonAim{return {yaw:0,pitch:0};}
const wrap=(a:number)=>{while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a;};
const rad=(d:number)=>d*Math.PI/180;
/** One frame of the camera-following aim; `front` is the camera front in car space, `steps` the frame in time steps. */
export function stepFireTruckAim(t:CannonAim,front:V3,steps:number,swat:boolean):CannonAim{
 let yawTarget=Math.atan2(-front.x,front.y);
 const pitchTarget=Math.atan2(front.z,Math.hypot(front.x,front.y))+rad(swat?22:15);
 if(yawTarget>t.yaw+Math.PI)yawTarget-=2*Math.PI;else if(yawTarget<t.yaw-Math.PI)yawTarget+=2*Math.PI;
 let yaw=t.yaw,pitch=t.pitch;
 const yawDiff=yawTarget-yaw,yawStep=steps/20;
 if(yawDiff>yawStep)yaw+=yawStep;else if(yawDiff<-yawStep)yaw-=yawStep;
 const pitchDiff=pitchTarget-pitch,pitchStep=steps/50;
 if(pitchDiff>pitchStep)pitch+=pitchStep;else if(pitchDiff<-pitchStep)pitch-=pitchStep;
 yaw=wrap(yaw);
 pitch=swat?Math.min(rad(35),Math.max(rad(-10),pitch)):Math.min(rad(20),Math.max(rad(-20),pitch));
 return {yaw,pitch};
}
/** The nozzle direction in car space. */
export function cannonDirection(t:CannonAim):V3{const c=Math.cos(t.pitch);return {x:-(Math.sin(t.yaw)*c),y:Math.cos(t.yaw)*c,z:Math.sin(t.pitch)};}
export const CANNON_DEFAULT_NOZZLE:V3={x:0,y:1.5,z:1.8};
export interface CannonEmissionInput {
 /** The nozzle direction and the nozzle point in world space, and whether the point came from the misc_a node. */
 direction:V3;nozzle:V3;fromNode:boolean;
 carPosition:V3;moveSpeed:V3;turnSpeed:V3;timeStep:number;swat:boolean;
 /** The native integer draw (CGeneral::GetRandomNumber). */
 randomInt:number;
}
/** The section a held car gun adds this frame: its start point and its move speed. */
export function cannonEmission(input:CannonEmissionInput):{start:V3;end:V3}{
 const d={...input.direction},start={...input.nozzle};
 if(input.fromNode){
  const reach=input.swat?2:1.2;start.x+=d.x*reach;start.y+=d.y*reach;start.z+=d.z*reach;
  // CPhysical::GetSpeed(offset): the move speed plus the turn speed's cross with the offset from the car.
  const o={x:start.x-input.carPosition.x,y:start.y-input.carPosition.y,z:start.z-input.carPosition.z},w=input.turnSpeed,m=input.moveSpeed;
  const v={x:m.x+(w.y*o.z-w.z*o.y),y:m.y+(w.z*o.x-w.x*o.z),z:m.z+(w.x*o.y-w.y*o.x)};
  start.x+=v.x*input.timeStep;start.y+=v.y*input.timeStep;start.z+=v.z*input.timeStep;
 }
 d.z+=(input.randomInt%16)/1000;
 const k=input.swat?.4:.5,m=input.moveSpeed;
 return {start,end:{x:m.x+d.x*k,y:m.y+d.y*k,z:m.z*.3+d.z*k}};
}
/** CWaterCannon::PushPeds' direct speed change followed by CEventHandler::ComputeWaterCannonResponse (planar). */
export function waterCannonPedSpeed(ped:{x:number;y:number},water:V3):{x:number;y:number}{
 let x=ped.x,y=ped.y;
 const ax=(water.x/10-x)/10,ay=(water.y/10-y)/10;
 if(water.x*ax>0)x=ax+water.x;
 if(water.y*ay>0)y=ay+water.y;
 x=(water.x*.6+x)/2;y=(water.y*.6+y)/2;
 const speed=Math.hypot(x,y);
 if(speed>=.2){x*=.2/speed;y*=.2/speed;}
 return {x,y};
}
export interface CannonRenderInput {
 cameraForward:V3;
 /** Uniform draws in [0, 1) for the crossed quads' random axes. */
 random:()=>number;
 /** CWorld::ProcessLineOfSight over buildings and vehicles between two section points. */
 lineOfSight:(from:V3,to:V3)=>{point:V3;normal:V3}|undefined;
}
export class WaterCannon {
 id=0;sectionsCount=0;creationTime=0;
 readonly points:V3[]=Array.from({length:CANNON_SECTIONS},()=>({x:0,y:0,z:0}));
 readonly speeds:V3[]=Array.from({length:CANNON_SECTIONS},()=>({x:0,y:0,z:0}));
 readonly used:boolean[]=new Array(CANNON_SECTIONS).fill(false);
 init(nowMs:number){this.id=0;this.sectionsCount=0;this.creationTime=nowMs;this.used.fill(false);}
 /** CWaterCannons::UpdateOne: a fresh cannon for a new vehicle id, then the frame's section. */
 newInput(id:number,nowMs:number,start:V3,end:V3){
  if(this.id!==id){this.init(nowMs);this.id=id;}
  this.points[this.sectionsCount]={...start};this.speeds[this.sectionsCount]={...end};this.used[this.sectionsCount]=true;
 }
 /** CWaterCannon::Update_OncePerFrame. Returns whether this is a ped-pushing frame. */
 update(nowMs:number,timeStep:number,frame:number,index:number,extinguish?:(point:V3)=>void){
  if(!this.id)return false;
  if(nowMs>this.creationTime+CANNON_LIFETIME_MS){this.sectionsCount=(this.sectionsCount+1)%CANNON_SECTIONS;this.used[this.sectionsCount]=false;}
  for(let i=0;i<CANNON_SECTIONS;i++){
   if(!this.used[i])continue;
   const s=this.speeds[i],p=this.points[i];
   s.z-=timeStep/250;p.x+=s.x*timeStep;p.y+=s.y*timeStep;p.z+=s.z*timeStep;
   extinguish?.(p);
  }
  const push=((frame+index)&255)%4===0;
  if(!this.used.some(Boolean))this.id=0;
  return push;
 }
 /** The live sections (point and speed). */
 sections(){const out:{point:V3;speed:V3}[]=[];for(let i=0;i<CANNON_SECTIONS;i++)if(this.used[i])out.push({point:this.points[i],speed:this.speeds[i]});return out;}
 /** CWaterCannon::Render as vertex data (native space; colours in bytes) plus the splash of the first blocked pair. */
 renderGeometry(input:CannonRenderInput){
  const positions:number[]=[],colors:number[]=[];let splash:{point:V3;normal:V3}|undefined;
  if(!this.id)return {positions,colors,splash};
  let prev=this.sectionsCount%CANNON_SECTIONS,curr=prev===0?CANNON_SECTIONS-1:prev-1,axes:{up:V3;right:V3;fwd:V3}|undefined;
  const unit=(v:V3,scale:number)=>{const l=Math.hypot(v.x,v.y,v.z)||1;return {x:v.x/l*scale,y:v.y/l*scale,z:v.z/l*scale};};
  for(let i=0;i<CANNON_SECTIONS;i++){
   if(this.used[prev]&&this.used[curr]){
    const a=this.points[prev],b=this.points[curr],d={x:a.x-b.x,y:a.y-b.y,z:a.z-b.z};
    if(d.x*d.x+d.y*d.y+d.z*d.z<CANNON_RENDER_RANGE2){
     if(!axes){
      const f=input.cameraForward;
      axes={up:unit({x:d.y*f.z-d.z*f.y,y:d.z*f.x-d.x*f.z,z:d.x*f.y-d.y*f.x},1/20),right:unit({x:input.random(),y:input.random(),z:input.random()},1/20),fwd:unit({x:input.random(),y:input.random(),z:input.random()},1/20)};
     }
     const hit=input.lineOfSight(a,b);
     if(hit){splash=hit;break;}
     const size=i*i/CANNON_SECTIONS+3,alpha=Math.trunc(64*(1-i/CANNON_SECTIONS));
     for(const axis of [axes.up,axes.right,axes.fwd]){
      const ox=axis.x*size,oy=axis.y*size,oz=axis.z*size;
      // Vertices 0..3: curr−, curr+, prev−, prev+; triangles (0,1,2) and (1,3,2).
      const q=[[b.x-ox,b.y-oy,b.z-oz],[b.x+ox,b.y+oy,b.z+oz],[a.x-ox,a.y-oy,a.z-oz],[a.x+ox,a.y+oy,a.z+oz]];
      for(const v of [0,1,2,1,3,2]){positions.push(...q[v]);colors.push(200,200,255,alpha);}
     }
    }
   }
   curr=prev;prev=prev===0?CANNON_SECTIONS-1:prev-1;
  }
  return {positions,colors,splash};
 }
}
