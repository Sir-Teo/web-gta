import type {Vec3} from '../core/math';
import {CRANE_LAS_VEGAS,CRANE_MAGNO,CRANE_QUARRY,CRANE_WRECKING_BALL} from '../engine/ScmPlayerInfo';
/* CRope and CRopes: the cranes' and winches' ropes. gta-reversed has the small pieces (Rope.cpp, Ropes.cpp) but not
 * CRope::Update, CRopes::RegisterRope or CRope::UpdateWeightInRope; those are read from the iOS executable
 * (0x10025d76c, 0x10025f220, 0x10025f900).
 *
 * A rope is 32 nodes hanging from its top (node 0). RegisterRope runs every frame for a rope's holder (the crane arm's
 * CObject::ProcessControlLogic) and winds the first `wound` nodes up into the top; the rest of the rope, (31 - wound)
 * node spacings of it, hangs down to the hook at node 31. Each frame a node drops 0.15 x the time step, is kept 0.3
 * above the ground under the top, and is pulled back to one spacing from the node above. The hook, or what it carries,
 * is a physical body of its own: the rope's last node follows it while it is within reach of the top
 * (UpdateWeightInRope solves the slack rope six times over), and once the rope is taut the body is held at the end of
 * it, its speed away from the top taken off, a share of the change (0.06, or by the load's mass) given to the holder.
 *
 * The field names of gta-reversed's CRope do not fit what the code does with them: its m_fMass is the rope's full
 * length, m_fTotalLength the spacing of the nodes, and m_fSegmentLength the height GET/SET_ROPE_HEIGHT_FOR_OBJECT read
 * and write (the share of the rope wound up, 0.01 to 0.9). Its GetObjectCarriedWithRope returns the hook; the iOS one
 * (0x1002d9de4) returns what the hook carries. */
export const ROPE_SEGMENTS=32,MAX_ROPES=8;
export const ROPE_CRANE_MAGNET1=1,ROPE_CRANE_HARNESS=2,ROPE_MAGNET=3,ROPE_CRANE_MAGNO=4,ROPE_WRECKING_BALL=5,
 ROPE_QUARRY_CRANE_ARM=6,ROPE_CRANE_TROLLEY=7,ROPE_SWAT=8;
/** CRope::Update does nothing for a rope whose top is this far from the camera, across. */
export const ROPE_UPDATE_RANGE=200;
/** CRope::Render draws a rope whose top is within this of the camera, across (and its middle node within 20 seen). */
export const ROPE_RENDER_RANGE=120;
/** The height (wound share) a rope starts with: a vehicle's winch nearly all wound up, a crane's half. */
export const ROPE_HEIGHT_VEHICLE=.9,ROPE_HEIGHT_OBJECT=.5;
export const ROPE_HEIGHT_MIN=.01,ROPE_HEIGHT_MAX=.9;
/** A helicopter's winch winds no further than this. */
export const ROPE_HEIGHT_WINCH_MAX=.84;
/** A node's drop per time step, and how far above the ground under the top it stays. */
export const ROPE_NODE_DROP=-.15,ROPE_GROUND_CLEARANCE=.3;
/** A freed top (no holder registered it this frame) falls: this onto its speed each time step. */
export const ROPE_FREED_TOP_GRAVITY=-.0015;
/** A rope no one registers is removed once its top is under this. */
export const ROPE_REMOVE_BELOW_Z=-50;
/** What the hook picks up must be within this of it (the top of the thing's bounds). */
export const ROPE_PICKUP_RANGE=2.5;
/** Frames before a hook that let go may pick something up again. */
export const ROPE_PICKUP_DELAY=60;
/** The share of the taut rope's speed change the holder takes: the empty hook's, and the load's as its mass gives it
 * (the Securicar's fixed). */
export const ROPE_HOOK_FACTOR=.06,ROPE_LOAD_FACTOR_PER_MASS=.000108333,ROPE_LOAD_FACTOR_MAX=.5,ROPE_SECURICAR_FACTOR=.14125;
export const MODEL_SECURICAR=428,MODEL_VORTEX=539,MODEL_DINGHY=473,MODEL_RCTIGER=564;
/** The crane controls' winding: a full button a time step winds this much (or the touch button's 0.00255). */
export const ROPE_WIND_PER_BUTTON=.00001,ROPE_WIND_TOUCH=.00255;
/** CAudioEngine's mission audio event for the winch. */
export const ROPE_WINCH_AUDIO_EVENT=104;

/** CRopes::RegisterRope's rope length by type: the RC magnet 10, the dock crane 50, the wrecking ball, quarry and Las
 * Venturas cranes 68, the rest (the helicopters' winches, SWAT) 20. The nodes are a 31st of it apart. */
export function ropeLength(type:number){
 switch(type){case ROPE_MAGNET:return 10;case ROPE_CRANE_MAGNO:return 50;
  case ROPE_WRECKING_BALL:case ROPE_QUARRY_CRANE_ARM:case ROPE_CRANE_TROLLEY:return 68;default:return 20;}
}
/** CRope::CreateHookObjectForRope's model: the cranes' magnet, the harness, the RC magnet, the wrecking ball. */
export function ropeHookModel(type:number){
 switch(type){
  case ROPE_CRANE_MAGNET1:case ROPE_CRANE_MAGNO:case ROPE_QUARRY_CRANE_ARM:case ROPE_CRANE_TROLLEY:return 'INDUS_MAGNET';
  case ROPE_CRANE_HARNESS:return 'CJ_PLAYER_HARNESS';case ROPE_MAGNET:return 'MINI_MAGNET';case ROPE_WRECKING_BALL:return 'DYN_WREKING_BALL';
  default:return undefined;
 }
}
/** The crane arms CObject::ProcessControlLogic registers a rope for, by model name. */
export const CRANE_ARM_MODELS={magno:'MAGNOCRANE_03',trolley:'TWRCRANE_M_02',quarry:'QUARRY_CRANEARM'} as const;
/** The objects each crane's hook takes (MI_OBJECTFORMAGNOCRANE1-5, MI_OBJECTFORBUILDINGSITECRANE1, the quarry's rocks and
 * MI_DEAD_TIED_COP, the RC magnet's MI_WONG_DISH; its other three ids are never given models on iOS). */
const PICKUP_OBJECTS:Readonly<Record<number,readonly string[]>>={
 [ROPE_CRANE_MAGNO]:['KMB_CONTAINER_RED','KMB_CONTAINER_YEL','KMB_CONTAINER_BLUE','BARREL4','KMB_CONTAINER_OPEN'],
 [ROPE_CRANE_TROLLEY]:['BLOCKPALLET'],
 [ROPE_QUARRY_CRANE_ARM]:['DYN_QUARRYROCK01','DYN_QUARRYROCK02','DYN_QUARRYROCK03','DEAD_TIED_COP'],
 [ROPE_MAGNET]:['WONG_DISH'],
};
/** Whether the crane's hook takes an object of this model at all. */
export function ropePicksUpObject(type:number,model:string){return PICKUP_OBJECTS[type]?.includes(model.toUpperCase())??false;}
/** The four containers: the hook takes one by whichever face is uppermost, and turns it that face up. */
const TURNED_CONTAINERS:readonly string[]=['KMB_CONTAINER_RED','KMB_CONTAINER_YEL','KMB_CONTAINER_BLUE','KMB_CONTAINER_OPEN'];

export interface RopeMatrix {right:Vec3;forward:Vec3;up:Vec3}
export interface Rope<E> {
 id:number;type:number;
 segments:Vec3[];speeds:Vec3[];
 /** The ground under the top, as last found (or under the load). */
 groundZ:number;
 /** The rope's full length and the spacing of its nodes (gta-reversed's m_fMass and m_fTotalLength). */
 length:number;spacing:number;
 /** GET/SET_ROPE_HEIGHT_FOR_OBJECT's height: the share of the rope wound up (m_fSegmentLength). */
 height:number;
 holder?:E;hook?:E;carried?:E;
 /** m_nTime: when an expiring rope's top is let fall (0 for one that does not expire). */
 expires:number;
 /** m_nSegments: the nodes wound up into the top. */
 wound:number;
 /** m_nFlags1: frames before the hook picks anything up. */
 pickupDelay:number;
 /** m_nFlags2: registered this frame (bit 0), and kept above the ground (bit 2). */
 registered:boolean;groundClamp:boolean;
}
const zero=():Vec3=>({x:0,y:0,z:0});
const sub=(a:Vec3,b:Vec3):Vec3=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const add=(a:Vec3,b:Vec3):Vec3=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const scale=(a:Vec3,k:number):Vec3=>({x:a.x*k,y:a.y*k,z:a.z*k});
const length3=(a:Vec3)=>Math.sqrt(a.x*a.x+a.y*a.y+a.z*a.z);
const dot=(a:Vec3,b:Vec3)=>a.x*b.x+a.y*b.y+a.z*b.z;
const cross=(a:Vec3,b:Vec3):Vec3=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
/** CVector::Normalise: a zero vector becomes (1, 0, 0). */
const normalise=(a:Vec3):Vec3=>{const l=length3(a);return l>0?scale(a,1/l):{x:1,y:0,z:0};};
/** The point at (0, 0, z) in a body's own axes. */
export const pointAbove=(position:Vec3,m:RopeMatrix,z:number):Vec3=>add(position,scale(m.up,z));
/** CMatrix::ForceUpVector (iOS 0x1002ca6fc): the up row set, the other two crossed from it, none normalised. */
export function forceUpVector(m:RopeMatrix,up:Vec3):RopeMatrix{
 const right=cross(m.forward,up);
 return {right,forward:cross(up,right),up:{...up}};
}

/** CRopes::RegisterRope (iOS 0x10025f220). A rope already there takes the new top: it and the `wound` nodes after it
 * are put at it at rest, and the rope counts as registered this frame. Otherwise the first free one of the eight is
 * made, its nodes hanging straight down from the top (the cranes) or laid out along x (the rest, which drop into
 * place), its height 0.9 under a vehicle and 0.5 under anything else. Nothing when all eight are taken. The caller
 * then gives a rope without a hook its hook (CreateHookObjectForRope). */
export function registerRope<E>(ropes:(Rope<E>|undefined)[],id:number,type:number,top:Vec3,expires:boolean,wound:number,
 groundClamp:boolean,holder:E|undefined,holderIsVehicle:boolean,expireMs:number,now:number):Rope<E>|undefined{
 const existing=ropes.find(r=>r&&r.type&&r.id===id);
 if(existing){
  existing.registered=true;existing.wound=wound;
  for(let i=0;i<=wound&&i<ROPE_SEGMENTS;i++){existing.segments[i]={...top};existing.speeds[i]=zero();}
  return existing;
 }
 let slot=-1;for(let i=0;i<MAX_ROPES;i++)if(!ropes[i]?.type){slot=i;break;}
 if(slot<0)return undefined;
 const length=ropeLength(type),spacing=length/31,segments=[{...top}],speeds=[zero()];
 const hangs=type>=ROPE_CRANE_MAGNO&&type<=ROPE_CRANE_TROLLEY;
 for(let i=1;i<ROPE_SEGMENTS;i++){
  const prev=segments[i-1];
  segments.push(hangs?{x:prev.x,y:prev.y,z:prev.z-spacing}:{x:i===1?prev.x+spacing:prev.x-spacing,y:prev.y,z:prev.z});
  speeds.push(zero());
 }
 const rope:Rope<E>={id,type,segments,speeds,groundZ:0,length,spacing,height:holderIsVehicle?ROPE_HEIGHT_VEHICLE:ROPE_HEIGHT_OBJECT,
  holder,expires:expires?now+expireMs:0,wound,pickupDelay:0,registered:true,groundClamp};
 ropes[slot]=rope;
 return rope;
}

/** CObject::ProcessControlLogic's rope for a crane arm (reversed): the nodes wound up are the height's share of 32,
 * and the top sits at the arm's rope point moved down by what of the wound length the whole nodes do not take up: the
 * dock crane's 36.64 along the arm and 1.69 under it, the trolley's own origin, the quarry arm's 59 along it. The
 * Las Venturas trolley (east of x = 0) carries a magnet, San Fierro's a wrecking ball. */
export function craneArmRope(model:string,position:Vec3,m:RopeMatrix,rope:{height:number;length:number;spacing:number}|undefined){
 const wound=rope?Math.trunc(rope.height*32)&0xff:0;
 const lift=rope?rope.length*rope.height-wound*rope.spacing:0;
 const at=(x:number,y:number,z:number)=>add(position,add(add(scale(m.right,x),scale(m.forward,y)),scale(m.up,z)));
 let top:Vec3,type:number;
 if(model===CRANE_ARM_MODELS.magno){top=at(0,36.64,-1.69);type=ROPE_CRANE_MAGNO;}
 else if(model===CRANE_ARM_MODELS.trolley){top=at(0,0,0);type=position.x>=0?ROPE_CRANE_TROLLEY:ROPE_WRECKING_BALL;}
 else if(model===CRANE_ARM_MODELS.quarry){top=at(0,0,59);type=ROPE_QUARRY_CRANE_ARM;}
 else return undefined;
 top.z+=lift;
 return {top,type,wound};
}

/** CRope::DoControlsApply (inlined in iOS's Update): the crane the player works, or any helicopter winch. */
export function ropeControlsApply(type:number,playerControlsCrane:number){
 return type===ROPE_CRANE_MAGNO&&playerControlsCrane===CRANE_MAGNO||type===ROPE_WRECKING_BALL&&playerControlsCrane===CRANE_WRECKING_BALL
  ||type===ROPE_CRANE_TROLLEY&&playerControlsCrane===CRANE_LAS_VEGAS||type===ROPE_QUARRY_CRANE_ARM&&playerControlsCrane===CRANE_QUARRY
  ||type>=ROPE_CRANE_MAGNET1&&type<=ROPE_MAGNET;
}

/** The rope's top and the nodes under it for a step, before the hook is weighed (CRope::Update's first part). A top
 * no one registered this frame falls once the rope has expired; every 8th frame the ground under the top is found again
 * (or, with a container or vehicle on the hook, taken as half a unit under the hook so the rope stays over its load);
 * then each hanging node drops, is held above that ground and is pulled back to a spacing from the node above. */
export function stepRopeNodes<E>(rope:Rope<E>,ts:number,now:number,frame:number,ground:{below(p:Vec3):number;hookZ?:number;loadHoldsRope?:boolean}){
 const s=rope.segments,v=rope.speeds;
 if(!rope.registered&&now>rope.expires){
  v[0].z+=ts*ROPE_FREED_TOP_GRAVITY;
  s[0]={x:s[0].x+ts*v[0].x,y:s[0].y+ts*v[0].y,z:s[0].z+ts*v[0].z};
 }
 if(rope.groundClamp&&(frame&7)===2)rope.groundZ=ground.below(s[0]);
 if(rope.groundClamp&&rope.carried!==undefined&&ground.loadHoldsRope&&ground.hookZ!==undefined)rope.groundZ=ground.hookZ-.5;
 // The jittered, blended speed the original works out first is overwritten at the end, so it is left out here.
 for(let i=rope.wound+1;i<ROPE_SEGMENTS;i++){
  const old=s[i];let z=old.z+ts*ROPE_NODE_DROP;
  if(rope.groundClamp)z=Math.max(z,rope.groundZ+ROPE_GROUND_CLEARANCE);
  const d={x:old.x-s[i-1].x,y:old.y-s[i-1].y,z:z-s[i-1].z},l=length3(d),k=rope.spacing/l;
  const next=l>0?add(s[i-1],scale(d,k)):{x:s[i-1].x,y:s[i-1].y,z:s[i-1].z-rope.spacing};
  s[i]=next;v[i]=scale(sub(next,old),1/ts);
 }
}

/** Crane controls' winding for a step (types 4 to 7, while the player works that crane): the raise button (pad Square,
 * PED_JUMPING) winds up when ENABLE_CRANE_CONTROLS' first flag allows it, the lower button (Cross, PED_SPRINT) unwinds
 * when the second does, each a 100000th of the button's 0 to 255 a time step; the winch sounds while it moves within
 * its stops. A helicopter's winch (types 1 to 3) winds by its stick (-128 to 128), down needing the first flag and up the
 * second, and stops at 0.84. Then the height is kept within 0.01 and 0.9. Returns whether the winch sounded. */
export function windRope<E>(rope:Rope<E>,ts:number,controls:{playerControlsCrane:number;enable:readonly [boolean,boolean,boolean];raise:number;lower:number;stick?:number}){
 const type=rope.type;let winch=false;
 if(type<ROPE_CRANE_MAGNET1||type>ROPE_CRANE_TROLLEY)return winch;
 if(!ropeControlsApply(type,controls.playerControlsCrane)){rope.height=Math.min(Math.max(rope.height,ROPE_HEIGHT_MIN),ROPE_HEIGHT_MAX);return winch;}
 if(type<=ROPE_MAGNET){
  const dir=Math.trunc(controls.stick??0);
  if(dir<0&&controls.enable[0]||dir>0&&controls.enable[1])rope.height+=dir*ts*-ROPE_WIND_PER_BUTTON;
  rope.height=Math.min(rope.height,ROPE_HEIGHT_WINCH_MAX);
 }else{
  if(controls.enable[0]){
   const step=ts*controls.raise*ROPE_WIND_PER_BUTTON;
   if(step>0&&rope.height+step<ROPE_HEIGHT_MAX)winch=true;
   rope.height+=step;
  }
  if(controls.enable[1]){
   const step=ts*controls.lower*ROPE_WIND_PER_BUTTON;
   if(step>0&&rope.height-step>ROPE_HEIGHT_MIN)winch=true;
   rope.height-=step;
  }
 }
 rope.height=Math.min(Math.max(rope.height,ROPE_HEIGHT_MIN),ROPE_HEIGHT_MAX);
 return winch;
}

/** CRope::UpdateWeightInRope (iOS 0x10025f900): the last node is put at the hook's (or load's) place. Within reach of
 * the top the slack rope is solved: six times over, each node from the hook up is pulled to a spacing of the one below
 * (stopping at the first already close enough, its speed what the pull moved it a time step), then each from the top
 * down to a spacing of the one above; then once more from the hook up. Out of reach the rope runs straight from the top
 * and the place it reaches is given back: the body is held there. */
export function updateWeightInRope<E>(rope:Rope<E>,end:Vec3,ts:number):Vec3|undefined{
 const s=rope.segments,top=s[rope.wound],reach=(31-rope.wound)*rope.spacing,d=sub(end,top),dist=length3(d);
 s[31]={...end};
 if(dist>=reach){
  const out=dist>0?add(top,scale(d,reach/dist)):{...top},n=normalise(d);
  for(let i=rope.wound+1;i<ROPE_SEGMENTS;i++)s[i]=add(top,scale(n,rope.spacing*(i-rope.wound)));
  return out;
 }
 const pull=(from:Vec3,to:Vec3)=>{const e=sub(to,from),l=length3(e);return l>rope.spacing?add(from,scale(e,rope.spacing/l)):undefined;};
 for(let pass=0;pass<6;pass++){
  for(let i=31;i>=rope.wound+2;i--){
   const moved=pull(s[i],s[i-1]);if(!moved)break;
   rope.speeds[i-1]=scale(sub(moved,s[i-1]),1/ts);s[i-1]=moved;
  }
  for(let j=rope.wound+1;j<31;j++){const moved=pull(s[j-1],s[j]);if(moved)s[j]=moved;}
 }
 for(let i=31;i>=rope.wound+2;i--){const moved=pull(s[i],s[i-1]);if(!moved)break;s[i-1]=moved;}
 return undefined;
}

/** The share of a taut rope's speed change the holder takes from what hangs on it (the rest goes to the hanging body):
 * 0.06 for the bare hook, else 0.06 and 0.000108333 of the load's mass, at most a half (the Securicar 0.14125). */
export function ropeLoadFactor(load:{mass:number;model:number|string}|undefined){
 if(!load)return ROPE_HOOK_FACTOR;
 return Math.min(load.model===MODEL_SECURICAR?ROPE_SECURICAR_FACTOR:load.mass*ROPE_LOAD_FACTOR_PER_MASS+ROPE_HOOK_FACTOR,ROPE_LOAD_FACTOR_MAX);
}
/** A taut rope on the hanging body's speed: relative to the top's speed (the holder's at that point; nothing for a crane,
 * which stands), any of it away from the top is taken off; the body gets (1 - factor) of that change and the holder
 * gives up factor of it. `direction` is the top to the body, normalised. */
export function tautRopeSpeeds(body:Vec3,topSpeed:Vec3,direction:Vec3,factor:number){
 let rel=sub(body,topSpeed);const away=dot(rel,direction);
 if(away>0)rel=sub(rel,scale(direction,away));
 const delta=sub(add(topSpeed,rel),body);
 return {body:add(body,scale(delta,1-factor)),holder:scale(delta,-factor)};
}
/** A load on a taut rope turns a tenth of the way a step toward hanging with its up along the rope. */
export function blendLoadMatrix(m:RopeMatrix,up:Vec3):RopeMatrix{
 const t=forceUpVector(m,up),mix=(a:Vec3,b:Vec3)=>({x:b.x*.1+a.x*.9,y:b.y*.1+a.y*.9,z:b.z*.1+a.z*.9});
 return {right:mix(m.right,t.right),forward:mix(m.forward,t.forward),up:mix(m.up,t.up)};
}

/** What a hook may take, as CRope::Update's scan reads it. `top` is the bounds' top in the body's own axes. */
export interface RopeCandidate<E> {
 entity:E;kind:'vehicle'|'ped'|'object';model:number|string;position:Vec3;matrix:RopeMatrix;top:number;
 /** Vehicles: the subtype (0 automobile, 1 monster truck, 9 bike), a rider on a bike, bWinchCanPickMeUp, scorched. */
 vehicleType?:number;ridden?:boolean;winchCanPickUp?:boolean;scorched?:boolean;
 /** Peds: dead or in a vehicle. */
 dead?:boolean;inVehicle?:boolean;
 /** Objects: objectFlags.bCanBeAttachedToMagnet (on unless WINCH_CAN_PICK_OBJECT_UP takes it off), hanging from
  * something. */
 magnetic?:boolean;attached?:boolean;
}
const VEHICLE_AUTOMOBILE=0,VEHICLE_MTRUCK=1,VEHICLE_BIKE=9;
/** CRope::Update's pickup scan from the hook point (iOS 0x10025e2c8 on): the vehicles for the dock, quarry and
 * Leviathan's magnets (cars, unridden bikes, the Vortex and the Dinghy, a script having let the winch take them; only
 * the RC Tiger for the RC magnet), the peds for the harness, and the objects each crane takes, whose bounds' top is
 * within 2.5 of the hook. A container is taken by its uppermost face, and `turns` says how many quarter turns about its
 * forward axis bring that face up. The vehicles are scanned first, then the peds, then the objects. */
export function findRopePickup<E>(type:number,hook:Vec3,candidates:readonly RopeCandidate<E>[]):{candidate:RopeCandidate<E>;point:Vec3;turns:number}|undefined{
 const vehicles=type===ROPE_CRANE_MAGNET1||type===ROPE_CRANE_MAGNO||type===ROPE_QUARRY_CRANE_ARM||type===ROPE_MAGNET;
 const objects=PICKUP_OBJECTS[type];
 const near=(p:Vec3)=>length3(sub(p,hook))<ROPE_PICKUP_RANGE;
 if(vehicles)for(const c of candidates){
  if(c.kind!=='vehicle')continue;
  const t=c.vehicleType??VEHICLE_AUTOMOBILE;
  const kind=t===VEHICLE_AUTOMOBILE||t===VEHICLE_MTRUCK||t===VEHICLE_BIKE&&!c.ridden||c.model===MODEL_VORTEX||c.model===MODEL_DINGHY;
  if(!kind||c.scorched||!c.winchCanPickUp||type===ROPE_MAGNET&&c.model!==MODEL_RCTIGER)continue;
  const point=pointAbove(c.position,c.matrix,c.top);
  if(near(point))return {candidate:c,point,turns:0};
 }
 if(type===ROPE_CRANE_HARNESS)for(const c of candidates){
  if(c.kind!=='ped'||c.dead||c.inVehicle)continue;
  if(near(c.position))return {candidate:c,point:pointAbove(c.position,c.matrix,c.top),turns:0};
 }
 if(objects)for(const c of candidates){
  if(c.kind!=='object'||!c.magnetic||c.attached&&type===ROPE_QUARRY_CRANE_ARM)continue;
  const name=String(c.model).toUpperCase();if(!objects.includes(name))continue;
  let point=pointAbove(c.position,c.matrix,c.top),turns=0;
  if(type===ROPE_CRANE_MAGNO&&TURNED_CONTAINERS.includes(name)){
   const faces:[Vec3,number][]=[[scale(c.matrix.up,-c.top),2],[scale(c.matrix.right,c.top),3],[scale(c.matrix.right,-c.top),1]];
   for(const [offset,t] of faces){const p=add(c.position,offset);if(p.z>point.z){point=p;turns=t;}}
  }
  if(near(point))return {candidate:c,point,turns};
 }
 return undefined;
}
/** The quarter turn the hook gives a container it takes by a side face, once per `turns`: its right row becomes its
 * up row and its up row the reverse of its old right. */
export function turnContainer(m:RopeMatrix,turns:number):RopeMatrix{
 let out={right:{...m.right},forward:{...m.forward},up:{...m.up}};
 for(let i=0;i<turns;i++)out={right:{...out.up},forward:out.forward,up:scale(out.right,-1)};
 return out;
}
/** CRope::PickUpObject's wind: a hook above the load's top lets out what reaches it, and one spacing more. */
export function heightAfterPickup(height:number,hookZ:number,pointZ:number,length:number,spacing:number){
 const over=hookZ-pointZ;
 return over>0?Math.max(height-over/length-spacing/length,ROPE_HEIGHT_MIN):height;
}
