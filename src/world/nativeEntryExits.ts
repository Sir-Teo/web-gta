import type {IplEntryExit} from '../assets/iplEntryExit';
import type {ScmEntryExitSwitch} from '../assets/scmEntryExits';

/** CEntryExit::eFlags. */
export const ENEX={
 UNKNOWN_INTERIOR:1<<0,UNKNOWN_PAIRING:1<<1,CREATE_LINKED_PAIR:1<<2,REWARD_INTERIOR:1<<3,USED_REWARD_ENTRANCE:1<<4,
 CARS_AND_AIRCRAFT:1<<5,BIKES_AND_MOTORCYCLES:1<<6,DISABLE_ON_FOOT:1<<7,ACCEPT_NPC_GROUP:1<<8,FOOD_DATE:1<<9,
 UNKNOWN_BURGLARY:1<<10,DISABLE_EXIT:1<<11,BURGLARY_ACCESS:1<<12,ENTERED_WITHOUT_EXIT:1<<13,ENABLE_ACCESS:1<<14,DELETE_ENEX:1<<15,
} as const;

/** CEntryExit in native world units. */
export interface EntryExit {
 /** Pool slot: IPL load order. */
 readonly index:number;
 /** m_szName; empty when unnamed. */
 readonly name:string;
 /** m_recEntrance as left, bottom, right, top: the IPL centre ± half the range. */
 readonly rect:readonly [number,number,number,number];
 /** m_fEntranceZ: the IPL centre's z + 1. */
 readonly entranceZ:number;
 /** m_fEntranceAngleRad. */
 readonly angle:number;
 /** m_vecExitPos: the IPL exit raised by 1. */
 readonly exit:readonly [number,number,number];
 /** m_fExitAngle, degrees: the heading given at this record's own exit. */
 readonly exitAngle:number;
 readonly area:number;readonly skyColor:number;readonly pedCount:number;
 flags:number;timeOn:number;timeOff:number;
 link?:EntryExit;
 /** AddEnExToWorld's quadtree rect: the entrance rect's two corners rotated about its centre. */
 readonly bounds:readonly [number,number,number,number];
}

const has=(e:EntryExit,flag:number)=>(e.flags&flag)!==0;
const set=(e:EntryExit,flag:number,on:boolean)=>{e.flags=on?e.flags|flag:e.flags&~flag;};
/** The entrance rect's centre at m_fEntranceZ (CEntryExit::GetPosition). */
export function entryExitPosition(e:EntryExit):[number,number,number]{return [(e.rect[0]+e.rect[2])/2,(e.rect[1]+e.rect[3])/2,e.entranceZ];}
/** CClock::GetIsTimeInRange. */
export function isTimeInRange(hour:number,from:number,to:number){return from>to?hour>=from||hour<to:hour>=from&&hour<to;}

/** CEntryExit's constructor as CEntryExitManager::AddOne (0x43FA00) builds it. `random` gives [0, 1) for
 * CGeneral::RandomBool(50). */
function createEntryExit(row:IplEntryExit,index:number,burglaryHousesEnabled:boolean,random:()=>number):EntryExit{
 const [x,y,z]=row.position,[w,h]=row.size;
 const rect=[x-w/2,y-h/2,x+w/2,y+h/2] as const,angle=row.angle*Math.PI/180;
 const e:EntryExit={index,name:row.name,rect,entranceZ:z+1,angle,exit:[row.exit[0],row.exit[1],row.exit[2]+1],exitAngle:row.exitAngle,
  area:row.area,skyColor:row.skyColor,pedCount:row.pedCount,flags:row.flags,timeOn:row.timeOn,timeOff:row.timeOff,bounds:entranceBounds(rect,angle)};
 if(has(e,ENEX.UNKNOWN_BURGLARY)&&random()*100<50){e.timeOn=0;e.timeOff=0;}
 else if(has(e,ENEX.BURGLARY_ACCESS)){e.timeOn=0;e.timeOff=24;}
 if(burglaryHousesEnabled||!has(e,ENEX.BURGLARY_ACCESS))set(e,ENEX.ENABLE_ACCESS,true);
 return e;
}
/** CEntryExitManager::AddEnExToWorld: the rect's (right, top) and (left, bottom) corners rotated by the entrance angle. */
function entranceBounds(rect:readonly [number,number,number,number],angle:number):[number,number,number,number]{
 const cx=(rect[0]+rect[2])/2,cy=(rect[1]+rect[3])/2,c=Math.cos(angle),s=Math.sin(angle);
 const corners=[[rect[2],rect[3]],[rect[0],rect[1]]].map(([px,py])=>[cx+(px-cx)*c-(py-cy)*s,cy+(px-cx)*s+(py-cy)*c]);
 return [Math.min(corners[0][0],corners[1][0]),Math.min(corners[0][1],corners[1][1]),Math.max(corners[0][0],corners[1][0]),Math.max(corners[0][1],corners[1][1])];
}
/** CEntryExit::IsInArea (0x43E460): inside the entrance rect, after the rect's matrix transforms a rotated entrance's
 * point, within 1 unit of m_fEntranceZ. */
export function isInEntryExitArea(e:EntryExit,[x,y,z]:readonly [number,number,number]){
 let px=x,py=y;
 if(e.angle!==0){
  // GetRectEntranceMatrix().TransformPoint(point - GetPosition()): SetRotateZ about the centre.
  const [cx,cy]=entryExitPosition(e),c=Math.cos(e.angle),s=Math.sin(e.angle),dx=x-cx,dy=y-cy;
  px=cx+dx*c-dy*s;py=cy+dx*s+dy*c;
 }
 return px>=e.rect[0]&&px<=e.rect[2]&&py>=e.rect[1]&&py<=e.rect[3]&&Math.abs(z-e.entranceZ)<1;
}
const overlaps=(b:readonly number[],left:number,bottom:number,right:number,top:number)=>b[0]<=right&&b[2]>=left&&b[1]<=top&&b[3]>=bottom;

/** What CEntryExit::TransitionStarted needs to know of the player. */
export interface EntryExitPed {
 /** CPed position (the collision centre, one unit above the feet), native. */
 position:readonly [number,number,number];
 /** The vehicle driven, or undefined on foot. */
 vehicle?:{type:'automobile'|'bike'|'other';big:boolean};
 /** CPlayerPed::CanPlayerStartMission. */
 canStartMission:boolean;
}
/** A started transition: `warping` is ms_bWarping; `walk` is the CTaskComplexGotoDoorAndOpen target for the short walk-in
 * (no door objects stream, so FindNearestDoor finds none). */
export interface EntryExitTransition {enex:EntryExit;spawn:EntryExit;warping:boolean;walk?:[number,number,number]}

/** CEntryExitManager (EntryExitManager.cpp): the pool, links, script switches, marker choice and the transition
 * start. TransitionFinished (0x4404A0, unreversed) is sequenced by the caller through `finishStep`. */
export class EntryExitManager {
 readonly pool:EntryExit[]=[];
 /** ms_exitEnterState: 0 idle, 1 walking in, 2 fading, 3 arrived, 4 arrived and left the arrival marker. */
 state=0;
 /** mp_Active and CEntryExit::ms_spawnPoint. */
 active?:EntryExitTransition;
 /** ms_entryExitStack. */
 readonly stack:EntryExit[]=[];
 /** ms_bDisabled. */
 disabled=false;
 burglaryHousesEnabled=false;
 /** Whether an area's placements can stream: interiors need MODELS\GTA_INT.IMG, which may be unpublished. Doors into
  * an area that cannot load neither show a marker nor start. */
 areaAvailable:(area:number)=>boolean;
 constructor(rows:readonly IplEntryExit[],random:()=>number=Math.random,areaAvailable:(area:number)=>boolean=()=>true){
  this.areaAvailable=areaAvailable;
  if(rows.length>400)throw new Error('Entry exits exceed the 400-slot pool.');
  rows.forEach((row,i)=>this.pool.push(createEntryExit(row,i,this.burglaryHousesEnabled,random)));
  // AddOne's LinkEntryExit then PostEntryExitsCreation: every pair links to the first same-named non-pair record.
  for(const e of this.pool)if(has(e,ENEX.CREATE_LINKED_PAIR)&&!e.link)this.link(e);
 }
 /** CEntryExitManager::LinkEntryExit (0x43F050). */
 private link(e:EntryExit){
  const i=this.index(e.name,0,ENEX.CREATE_LINKED_PAIR);if(i<0)return;
  const linked=this.pool[i];e.link=linked;
  if(linked.link)linked.link=e;
  linked.timeOn=0;linked.timeOff=24;
 }
 /** CEntryExitManager::GetEntryExitIndex (0x43EFD0): flags compared on their low byte, names on 8 characters without case. */
 index(name:string,enabled:number,disabled:number){
  const key=name.slice(0,8).toLowerCase();
  return this.pool.findIndex(e=>(e.flags&enabled&255)===(enabled&255)&&(e.flags&disabled&255)===0&&e.name.slice(0,8).toLowerCase()===key);
 }
 /** CEntryExitManager::FindNearestEntryExit (0x43F4B0): quadtree rect ±range, closest centre under 2 × range. */
 findNearest(x:number,y:number,range:number,ignoreArea=-1){
  let best:EntryExit|undefined,bestDistance=2*range;
  for(const e of this.pool){
   if(!overlaps(e.bounds,x-range,y-range,x+range,y+range)||(e.link??e).area===ignoreArea)continue;
   const [cx,cy]=entryExitPosition(e),d=Math.hypot(cx-x,cy-y);
   if(d<bestDistance){best=e;bestDistance=d;}
  }
  return best;
 }
 /** SWITCH_ENTRY_EXIT: every record of that name. */
 switchAccess(name:string,on:boolean){const key=name.toLowerCase();for(const e of this.pool)if(e.name.toLowerCase()===key)set(e,ENEX.ENABLE_ACCESS,on);}
 /** SET_CLOSEST_ENTRY_EXIT_FLAG. */
 setClosestFlag(x:number,y:number,radius:number,flag:number,on:boolean){const e=this.findNearest(x,y,radius);if(e)set(e,flag,on);}
 /** The INITIAL mission's switches, in order. */
 applyScript(switches:readonly ScmEntryExitSwitch[]){for(const s of switches)if(s.kind==='switch')this.switchAccess(s.name,s.on);else this.setClosestFlag(s.x,s.y,s.radius,s.flag,s.on);}
 /** CEntryExitManager::Update's marker pass (0x440D10): enabled entrances in the 60-unit square 30 units ahead of the
  * camera whose link leads out of the current area (or, unlinked, lead into another one), open at this hour and
  * within 40 units of the camera. `visible` is TheCamera.IsSphereVisible(centre, 1). Returns the cone points,
  * GetPosition() + (0, 0, 1). */
 markers(camera:readonly [number,number,number],forward:readonly [number,number],area:number,hour:number,visible:(p:[number,number,number])=>boolean){
  const out:{enex:EntryExit;position:[number,number,number]}[]=[];
  if(this.disabled||this.state!==0)return out;
  const qx=camera[0]+forward[0]*30,qy=camera[1]+forward[1]*30;
  for(const e of this.pool){
   if(!overlaps(e.bounds,qx-30,qy-30,qx+30,qy+30)||!has(e,ENEX.ENABLE_ACCESS))continue;
   if(!(e.link&&e.area===area||!e.link&&e.area!==area)||!this.areaAvailable((e.link??e).area))continue;
   const p=entryExitPosition(e);
   if(!visible(p)||!isTimeInRange(hour,e.timeOn,e.timeOff))continue;
   if((p[0]-camera[0])**2+(p[1]-camera[1])**2+(p[2]-camera[2])**2>=40*40)continue;
   out.push({enex:e,position:[p[0],p[1],p[2]+1]});
  }
  return out;
 }
 /** CEntryExitManager::Update's search when nothing is active: an enabled entrance around the player starts a
  * transition; standing in none lets ms_exitEnterState settle (3 → 4 → 0). */
 update(ped:EntryExitPed,hour:number,controlsDisabled=false):EntryExitTransition|undefined{
  if(this.active)return undefined;
  let inArea=false;
  for(const e of this.pool){
   if(!has(e,ENEX.ENABLE_ACCESS)||!overlaps(e.bounds,ped.position[0],ped.position[1],ped.position[0],ped.position[1])||!isInEntryExitArea(e,ped.position))continue;
   inArea=true;
   if(!controlsDisabled&&!this.disabled){const started=this.start(e,ped,hour);if(started){this.active=started;return started;}}
  }
  if(!inArea)this.state=this.state!==3?0:4;
  return undefined;
 }
 /** CEntryExit::TransitionStarted (0x43FFD0). */
 private start(e:EntryExit,ped:EntryExitPed,hour:number):EntryExitTransition|undefined{
  if(!has(e,ENEX.ENABLE_ACCESS)||this.state!==0||!isTimeInRange(hour,e.timeOn,e.timeOff)||!this.areaAvailable((e.link??e).area))return undefined;
  if(ped.vehicle){
   if(ped.vehicle.big)return undefined;
   if(ped.vehicle.type==='automobile'){if(!has(e,ENEX.CARS_AND_AIRCRAFT))return undefined;}
   else if(ped.vehicle.type==='bike'){if(!has(e,ENEX.BIKES_AND_MOTORCYCLES))return undefined;}
   else return undefined;
  }else if(has(e,ENEX.DISABLE_EXIT))return undefined;
  let spawn=e;
  if(e.link){spawn=e.link;e.link.link=e;}
  const p=entryExitPosition(e),d=[spawn.exit[0]-p[0],spawn.exit[1]-p[1],spawn.exit[2]-p[2]],far=d[0]**2+d[1]**2+d[2]**2>10*10;
  if(!ped.canStartMission)return undefined;
  set(e,ENEX.ENTERED_WITHOUT_EXIT,true);
  if(has(e,ENEX.UNKNOWN_PAIRING)||has(e,ENEX.FOOD_DATE)||ped.vehicle)return {enex:e,spawn,warping:far};
  // No swing or lock door objects: FindNearestDoor(*this, 10) finds none.
  if(far){set(e,ENEX.UNKNOWN_PAIRING,true);return {enex:e,spawn,warping:true};}
  const length=Math.hypot(...d)||1;
  return {enex:e,spawn,warping:false,walk:[p[0]+d[0]/length*4,p[1]+d[1]/length*4,p[2]+d[2]/length*4]};
 }
 /** The fade-driven part of CEntryExit::TransitionFinished (0x4404A0, reconstructed): returns 'fade' with the black-out
  * seconds to start, 'teleport' once the screen is black, or undefined while waiting. */
 finishStep(fading:boolean):{fade:number}|'teleport'|undefined{
  const t=this.active;if(!t)return undefined;
  // Warps, food dates and vehicles black out over 0.5 s at once; a walk-in (state 1) fades over 1 s once its
  // CTaskComplexGotoDoorAndOpen is the primary task, the next frame.
  if(this.state===0){if(!t.walk){this.state=2;return {fade:.5};}this.state=1;return undefined;}
  if(this.state===1){this.state=2;return {fade:1};}
  if(this.state===2&&!fading){this.state=3;return 'teleport';}
  return undefined;
 }
 /** TransitionFinished's arrival: AddEntryExitToStack, the spawn point's entered-without-exit clear and DELETE_ENEX. */
 arrived(){
  const t=this.active;if(!t)return;
  this.push(t.enex);
  set(t.spawn,ENEX.ENTERED_WITHOUT_EXIT,false);
  if(has(t.spawn,ENEX.DELETE_ENEX))set(t.spawn,ENEX.ENABLE_ACCESS,false);
  this.active=undefined;
 }
 /** CEntryExitManager::AddEntryExitToStack (0x43E410). */
 private push(e:EntryExit){
  const top=e.link??e;
  if(this.stack.length&&this.stack[this.stack.length-1]===top)this.stack.pop();
  else if(top.area!==0)this.stack.push(top);
  else this.stack.length=0;
 }
}
/** The 16-point search of CEntryExit::FindValidTeleportPoint (0x43EAF0): the spawn exit unless a 0.35 sphere there hits
 * the world, then rings of 1.25 and 2 units, taking the first clear point with a clear line back. */
export function findValidTeleportPoint(exit:readonly [number,number,number],blocked:(p:[number,number,number])=>boolean,lineClear:(a:[number,number,number],b:[number,number,number])=>boolean):[number,number,number]{
 const origin:[number,number,number]=[exit[0],exit[1],exit[2]];
 if(!blocked(origin))return origin;
 for(const r of [1.25,2])for(let i=0;i<8;i++){
  const a=i*2*Math.PI/8,p:[number,number,number]=[origin[0]+Math.cos(a)*r,origin[1]+Math.sin(a)*r,origin[2]];
  if(!blocked(p)&&lineClear(origin,p))return p;
 }
 return origin;
}
