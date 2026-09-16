/** cBuoyancy::ProcessBuoyancy (non-boat, non-ped path) and CAutomobile::ProcessBuoyancy response,
 * in native Z-up units: speeds per 50 Hz step, forces as momentum per step. */
export type NativeVec=[number,number,number];
export interface NativeBuoyancyBody {
 position:NativeVec;
 /** Columns of the native orientation matrix: right, forward, up. */
 right:NativeVec;forward:NativeVec;up:NativeVec;
 boundsMin:NativeVec;boundsMax:NativeVec;
 modelId:number;heli:boolean;touchingWater:boolean;
 mass:number;turnMass:number;centerOfMass:NativeVec;buoyancyConstant:number;
 moveSpeed:NativeVec;turnSpeed:NativeVec;
}
const MODEL_LEVIATHAN=417,MODEL_SKIMMER=460,MODEL_SEASPARROW=447,MODEL_VORTEX=539;
const f=Math.fround;
const transform=(b:Pick<NativeBuoyancyBody,'right'|'forward'|'up'>,p:NativeVec):NativeVec=>[0,1,2].map(i=>b.right[i]*p[0]+b.forward[i]*p[1]+b.up[i]*p[2]) as NativeVec;
const cross=(a:NativeVec,c:NativeVec):NativeVec=>[a[1]*c[2]-a[2]*c[1],a[2]*c[0]-a[0]*c[2],a[0]*c[1]-a[1]*c[0]];
/** CWaterLevel::GetWaterLevel without waves: false beyond 3 units below the surface unless already touching water. */
export function nativeWaterLevel(level:(x:number,y:number)=>number|undefined,x:number,y:number,z:number,touching:boolean){
 const water=level(x,y);if(water===undefined)return undefined;if(water-z>3&&!touching)return undefined;return water;
}
export function processNativeBuoyancy(body:NativeBuoyancyBody,level:(x:number,y:number)=>number|undefined){
 const [px,py,pz]=body.position;
 if(nativeWaterLevel(level,px,py,pz,body.touchingWater)===undefined)return undefined;
 // PreCalcSetup bounding adjustments for non-boats.
 const min=[...body.boundsMin] as NativeVec,max=[...body.boundsMax] as NativeVec;
 if(body.modelId===MODEL_LEVIATHAN){min[1]*=.4;max[1]*=1.15;}
 else if(body.modelId===MODEL_SKIMMER){min[0]*=.3;min[1]=max[1]*-.6;min[2]-=.1;max[0]*=.3;max[1]*=1.4;}
 else if(body.heli){min[1]=-max[1];max[2]=min[2]*-1.1;min[2]*=.85;}
 const center:NativeVec=[(max[0]-min[0])*.5,(max[1]-min[1])*.5,(max[2]-min[2])*.5];
 const scale=center[2]>center[0]&&center[2]>center[1]?1/center[2]:center[1]>center[0]&&center[1]>center[2]?1/center[1]:1/center[0];
 const normalized=center.map(v=>v*scale) as NativeVec;
 let checked=1,immersion=0,inWater=false,turn:NativeVec=[0,0,0];
 // vecAllPoints[x][y]: the sample with its clamped water height, or (0, 0, min z) above the water.
 const points:NativeVec[][]=[[],[],[]];
 // SimpleCalcBuoyancy: nine sample points across the bounding footprint.
 for(let ix=0;ix<3;ix++)for(let iy=0;iy<3;iy++){
  const local:NativeVec=[min[0]+center[0]*ix,min[1]+center[1]*iy,0],t=transform(body,local);
  // A missing polygon leaves the output at 0, as GetWaterLevel does not write it.
  let z=(nativeWaterLevel(level,t[0]+px,t[1]+py,pz,true)??0)-(t[2]+pz),above=false;
  if(z>max[2])z=max[2];else if(z<min[2]){z=min[2];above=true;}
  points[ix][iy]=above?[0,0,min[2]]:[local[0],local[1],z];
  if(above)continue;
  // SimpleSumBuoyancyData with fPointVolMultiplier 1.
  const distance=Math.abs(z-min[2]);immersion+=distance;
  const offset:NativeVec=[local[0]*normalized[0],local[1]*normalized[1],(z+min[2])*normalized[2]*.5],fresh=1/checked;
  turn=[0,1,2].map(i=>offset[i]*fresh*distance+turn[i]*(1-fresh)) as NativeVec;checked+=1;inWater=true;
 }
 if(!inWater)return undefined;
 immersion/=9*(max[2]-min[2]);
 return {immersion,turnPoint:transform(body,turn),points,min,max};
}
/** SimpleCalcBuoyancy's splash edges: a footprint edge whose two samples both have the water line between half height and the top of the
 * bounds throws spray. The +X edge reads the +Y row's samples, as the original does. */
export function nativeBuoyancySplashEdges(sample:{points:NativeVec[][];min:NativeVec;max:NativeVec}){
 const {points,min,max}=sample,half=min[2]+(max[2]-min[2])*.5,wet=(p:NativeVec)=>p[2]>half&&p[2]<max[2],edges:{from:NativeVec;to:NativeVec}[]=[];
 const edge=(a:NativeVec,b:NativeVec)=>{if(wet(a)&&wet(b))edges.push({from:a,to:b});};
 for(let i=0;i<2;i++){edge(points[i][0],points[i+1][0]);edge(points[i][2],points[i+1][2]);}
 for(let i=0;i<2;i++){edge(points[0][i],points[0][i+1]);if(wet(points[2][i])&&wet(points[2][i+1]))edges.push({from:points[i][2],to:points[i+1][2]});}
 return edges;
}
/** cBuoyancy::AddSplashParticles (0x6C34E0) for a vehicle: prt_watersplash particles along the edge, pushed out from the body's centre at the
 * move speed (capped at 0.1 units per frame) and thrown up against its fall. Nothing is added, and no splash reported, at 0.05 units per frame or less. */
export function nativeSplashParticles(body:Pick<NativeBuoyancyBody,'position'|'right'|'forward'|'up'|'moveSpeed'>,from:NativeVec,to:NativeVec,random:()=>number=Math.random){
 let speed=[...body.moveSpeed] as NativeVec,magnitude=Math.hypot(...speed);
 if(magnitude>.1){speed=speed.map(v=>v*(1/magnitude)*.1) as NativeVec;magnitude=.1;}
 if(magnitude<=.05)return undefined;
 // vecUsedSpeed * CVector(0, 0, -1) * 120 is a component-wise product.
 const lift=-speed[2]*120,count=Math.max(1,Math.trunc(2*Math.hypot(to[0]-from[0],to[1]-from[1],to[2]-from[2]))),particles:{position:NativeVec;velocity:NativeVec}[]=[];
 for(let i=0;i<count;i++){
  const u=i/count,local:NativeVec=[from[0]+(to[0]-from[0])*u,from[1]+(to[1]-from[1])*u,from[2]+(to[2]-from[2])*u],t=transform(body,local);
  const world:NativeVec=[t[0]+body.position[0],t[1]+body.position[1],t[2]+body.position[2]];
  let dx=world[0]-body.position[0],dy=world[1]-body.position[1];const length=Math.hypot(dx,dy);
  // CVector::Normalise turns a zero vector into (1, 0, 0).
  if(length>0){dx/=length;dy/=length;}else{dx=1;dy=0;}
  const push=random()*.5;
  particles.push({position:[world[0]+dx*push,world[1]+dy*push,world[2]],velocity:[dx*magnitude*60,dy*magnitude*60,lift]});
 }
 return particles;
}
/** Applies one variable native timestep of CAutomobile::ProcessBuoyancy. `forceScale` lets a browser
 * controller with different gravity keep the native equilibrium immersion. */export function applyNativeBuoyancy(body:NativeBuoyancyBody,level:(x:number,y:number)=>number|undefined,timeStep:number,state:{rotorSpeed:number;initialBuoyancy:number;sample?:ReturnType<typeof processNativeBuoyancy>},forceScale=1){
 const result=processNativeBuoyancy(body,level);
 if(!result){body.touchingWater=false;body.buoyancyConstant=state.initialBuoyancy;return {inWater:false,drowning:false,blowUp:false,rotorKilled:false,engineOff:false,ratio:0};}
 state.sample=result;
 // CalcBuoyancyForce.
 const current=result.immersion*body.buoyancyConstant*timeStep;let force=current;
 const moveForceZ=body.mass*body.moveSpeed[2];if(moveForceZ>current*4)force=Math.max(0,current-moveForceZ);
 const blowUp=!body.heli&&body.moveSpeed[2]< -1;
 body.touchingWater=true;
 const step=Math.max(.01,timeStep),usedMass=body.mass/125;let ratio=force/(step*usedMass);
 if(usedMass>body.buoyancyConstant)ratio*=1.05*usedMass/body.buoyancyConstant;
 const speedMult=Math.pow(Math.max(.5,1-ratio/20),timeStep);
 if(body.modelId!==MODEL_VORTEX||body.up[2]<=.3){body.moveSpeed=body.moveSpeed.map(v=>v*speedMult) as NativeVec;body.turnSpeed=body.turnSpeed.map(v=>v*speedMult) as NativeVec;}
 const amphibious=body.modelId===MODEL_SEASPARROW||body.modelId===MODEL_LEVIATHAN;
 let rotorKilled=false;
 if(body.heli&&state.rotorSpeed>.15){
  let forceKill=false;
  if(!amphibious){
   body.moveSpeed[2]+=force*-2/Math.max(1,ratio*8)*forceScale/body.mass;body.turnSpeed=body.turnSpeed.map(v=>v*speedMult) as NativeVec;
   if(ratio<=.9)return {inWater:true,drowning:false,blowUp,rotorKilled,engineOff:false,ratio};
   forceKill=true;
  }
  if(ratio>3||forceKill){state.rotorSpeed=0;rotorKilled=true;}
 }
 // ApplyMoveForce and ApplyTurnForce.
 body.moveSpeed[2]+=force*forceScale/body.mass;
 const com=transform(body,body.centerOfMass),arm:NativeVec=[result.turnPoint[0]-com[0],result.turnPoint[1]-com[1],result.turnPoint[2]-com[2]],torque=cross(arm,[0,0,force*forceScale]);
 body.turnSpeed=body.turnSpeed.map((v,i)=>v+torque[i]/body.turnMass) as NativeVec;
 if(amphibious&&ratio<3&&(body.up[2]>-.5||ratio<.6))return {inWater:true,drowning:false,blowUp,rotorKilled,engineOff:false,ratio};
 if(rotorKilled||ratio>=1||ratio>.6){
  body.moveSpeed[2]=Math.max(-.1,body.moveSpeed[2]);
  if(body.mass*8/1250<body.buoyancyConstant)body.buoyancyConstant=f(body.buoyancyConstant-body.mass*.01/1250);
  return {inWater:true,drowning:true,blowUp,rotorKilled,engineOff:body.buoyancyConstant<body.mass/125,ratio};
 }
 return {inWater:true,drowning:false,blowUp,rotorKilled,engineOff:false,ratio};
}
/** CBoat wake trail (PruneWakeTrail/AddWakePoint): stern points living 150 native
 * frames, spaced at least 2 units apart, at most 32 kept (31 player, 20 mission, 15 else). */
export const WAKE={lifetime:150,interval:2,max:32} as const;
export interface WakeTrail {coords:{x:number;y:number}[];speeds:number[];counters:number[]}
export function createWakeTrail():WakeTrail{return {coords:[],speeds:[],counters:[]};}
export function pruneWakeTrail(trail:WakeTrail,timeStep:number){
 let count=0;
 for(;count<trail.counters.length;count++){
  if(trail.counters[count]<=0)break;
  if(trail.counters[count]<=timeStep){trail.counters[count]=0;break;}
  trail.counters[count]-=timeStep;
 }
 trail.coords.length=count;trail.speeds.length=count;trail.counters.length=count;
}
export function addWakePoint(trail:WakeTrail,position:{x:number;y:number},moveSpeed:number,maxPoints=31){
 const intensity=Math.trunc(Math.min(255,Math.max(0,moveSpeed*100)));
 if(!trail.coords.length||trail.counters[0]<=0){
  trail.coords.unshift({x:position.x,y:position.y});trail.speeds.unshift(intensity);trail.counters.unshift(WAKE.lifetime);
  trail.coords.length=Math.min(WAKE.max,trail.coords.length);trail.speeds.length=trail.coords.length;trail.counters.length=trail.coords.length;
  return;
 }
 const dx=trail.coords[0].x-position.x,dy=trail.coords[0].y-position.y;
 if(dx*dx+dy*dy<=WAKE.interval*WAKE.interval)return;
 const keep=Math.min(trail.coords.length,Math.min(maxPoints,WAKE.max-1));
 trail.coords.unshift({x:position.x,y:position.y});trail.speeds.unshift(intensity);trail.counters.unshift(WAKE.lifetime);
 trail.coords.length=Math.min(WAKE.max,keep+1);trail.speeds.length=trail.coords.length;trail.counters.length=trail.coords.length;
}
/** cBuoyancy boat volume classes (ProcessBuoyancyBoat model selection). The 3x3
 * distribution tables live at static addresses upstream, so every class uses a
 * uniform table (authored); per-model class selection is preserved. Model IDs
 * follow the local vehicle definitions (the reversed comments name JETMAX 498;
 * the local JETMAX/CUPBOAT is 493). */
export type BoatVolumeClass='speed'|'dinghy'|'sail'|'standard';
export function boatVolumeClass(modelId:number):BoatVolumeClass{
 if(modelId===446||modelId===452||modelId===493||modelId===595)return 'speed';
 if(modelId===472||modelId===473)return 'dinghy';
 if(modelId===484)return 'sail';
 return 'standard';
}
/** PreCalcSetup bounding adjustments for boats. */
export function boatBounds(modelId:number,boundsMin:NativeVec,boundsMax:NativeVec){
 const min=[...boundsMin] as NativeVec,max=[...boundsMax] as NativeVec;
 switch(modelId){
  case 446:min[1]*=.9;max[1]*=.9;break;
  case 452:min[1]*=.83;max[1]*=1.25;break;
  case 453:case 493:min[1]*=.9;break;
  case 454:min[1]*=.82;max[1]*=1.3;min[2]-=.2;break;
  case 472:min[1]*=.9;max[1]*=1.1;min[2]-=.3;break;
  case 473:min[1]*=.9;max[1]*=1.3;min[2]-=.2;break;
  case 484:min[1]*=.9;max[1]*=1.1;break;
  case 595:min[1]*=.8;max[1]*=1.25;min[2]-=.1;break;
  default:min[1]*=.9;max[1]*=1.05;break;
 }
 return {min,max};
}
export interface NativeBoatBody extends Omit<NativeBuoyancyBody,'heli'> {
 /** Handling m_fSuspensionDampingLevel for the per-point wave power. */
 suspensionDamping:number;
}
/** cBuoyancy::ProcessBuoyancyBoat for hulls over flat water (waves are not local):
 * nine footprint samples with the class volume table, per-point wave power from the
 * sample-point velocity and suspension damping, force up plus turn torque. Speeds are
 * native 50 Hz-step units; `forceScale` keeps browser gravity equilibrium. */
export function applyNativeBoatBuoyancy(body:NativeBoatBody,level:(x:number,y:number)=>number|undefined,timeStep:number,state:{sample?:{points:NativeVec[][];min:NativeVec;max:NativeVec}},forceScale=1,underwater=false){
 const [px,py,pz]=body.position;
 if(nativeWaterLevel(level,px,py,pz,body.touchingWater)===undefined){body.touchingWater=false;return {inWater:false,immersion:0,force:0};}
 const {min,max}=boatBounds(body.modelId,body.boundsMin,body.boundsMax);
 const height=max[2]-min[2];
 if(!(height>0)){body.touchingWater=false;return {inWater:false,immersion:0,force:0};}
 const center:NativeVec=[(max[0]-min[0])*.5,(max[1]-min[1])*.5,(max[2]-min[2])*.5];
 const heightRatio=1/(height*9);
 const scale=center[2]>center[0]&&center[2]>center[1]?1/center[2]:center[1]>center[0]&&center[1]>center[2]?1/center[1]:1/center[0];
 const normalized=center.map(v=>v*scale) as NativeVec;
 const points:NativeVec[][]=[[],[],[]];
 let checked=1,immersion=0,inWater=false;
 let turn:NativeVec=[0,0,0];
 const torque:NativeVec=[0,0,0];
 let force=0;
 const baseForce=timeStep*body.buoyancyConstant;
 const com=transform(body,body.centerOfMass);
 for(let ix=0;ix<3;ix++)for(let iy=0;iy<3;iy++){
  const local:NativeVec=[min[0]+center[0]*ix,min[1]+center[1]*iy,0],t=transform(body,local);
  let z=(nativeWaterLevel(level,t[0]+px,t[1]+py,pz,true)??0)-(t[2]+pz),above=false;
  if(z>max[2])z=max[2];else if(z<min[2]){z=min[2];above=true;}
  points[ix][iy]=above?[0,0,min[2]]:[local[0],local[1],z];
  if(above)continue;
  // SimpleSumBuoyancyData with a uniform class table (multiplier 1).
  const added=Math.abs(z-min[2]);immersion+=added;
  const offset:NativeVec=[local[0]*normalized[0],local[1]*normalized[1],(z+min[2])*normalized[2]*.5],fresh=1/checked;
  turn=[0,1,2].map(i=>offset[i]*fresh*added+turn[i]*(1-fresh)) as NativeVec;checked+=1;inWater=true;
  const contribution=baseForce*(added*heightRatio);
  // Flat-water wave normal with the point velocity (linear plus angular cross offset).
  const r=transform(body,local);
  const vp:NativeVec=[body.moveSpeed[0]+(body.turnSpeed[1]*r[2]-body.turnSpeed[2]*r[1]),body.moveSpeed[1]+(body.turnSpeed[2]*r[0]-body.turnSpeed[0]*r[2]),body.moveSpeed[2]+(body.turnSpeed[0]*r[1]-body.turnSpeed[1]*r[0])];
  const wavePower=Math.max(0,1-vp[2]*body.suspensionDamping)*contribution;
  force+=wavePower;
  if(!underwater){
   const applied=transform(body,[local[0],local[1],z]);
   const arm:NativeVec=[applied[0]-com[0],applied[1]-com[1],applied[2]-com[2]];
   const q=cross(arm,[0,0,wavePower*forceScale]);
   torque[0]+=q[0];torque[1]+=q[1];torque[2]+=q[2];
  }
 }
 if(!inWater){body.touchingWater=false;return {inWater:false,immersion:0,force:0};}
 body.touchingWater=true;
 immersion*=heightRatio;
 state.sample={points,min,max};
 body.moveSpeed[2]+=force*forceScale/body.mass;
 body.turnSpeed=body.turnSpeed.map((v,i)=>v+torque[i]/body.turnMass) as NativeVec;
 return {inWater:true,immersion,force,turnPoint:transform(body,turn)};
}
