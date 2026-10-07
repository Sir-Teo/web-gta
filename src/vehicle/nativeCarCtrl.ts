/* Ambient traffic driving: CCarCtrl's path following for cars the game drives with physics.
 *
 * In the pinned gta-reversed (0076f9017b4aeef7433957ac2bd8b6988e9df166) SteerAICarWithPhysics,
 * SteerAICarWithPhysicsFollowPath, PickNextNodeRandomly, FindMaximumSpeedForThisCarInTraffic,
 * SlowCarDownForOtherCar and TestCollisionBetween2MovingRects are all retail stubs. This follows their Vice City
 * ancestors (reVC CarCtrl.cpp), with SA's own pieces where they are known:
 * - CCarCtrl::FindMaxSteerAngle is reversed: clamp(0.9 − |move speed|, 0.2, 0.7).
 * - LANE_WIDTH is 5.4 in SA: CCarPathLink::OneWayLaneOffset divides the path width by 16 × 5.4
 *   (0.011574074). VC's lane width is 5. The two-way offset of half a lane is VC's; SA's function (0x44DB00)
 *   is not reversed.
 * - SA navigation links replace VC's car path links: a link's direction points at its attached node, and the
 *   lanes a car may use in its direction of travel follow DoPathSearch (pathDirection.ts).
 * Positions are native (x, y) on the ground plane; speeds are units per 1/50 s frame, and cruise speeds are CarAI
 * speeds (units per frame × 60). */

export const LANE_WIDTH=5.4,GAME_SPEED_TO_CARAI_SPEED=60;
export const DISTANCE_TO_NEXT_NODE_TO_CONSIDER_SLOWING_DOWN=40,
 DISTANCE_TO_NEXT_NODE_TO_SELECT_NEW=5,DISTANCE_TO_FACING_NEXT_NODE_TO_SELECT_NEW=8,MIN_LOWERING_SPEED_COEFFICIENT=.4,MAX_ANGLE_FOR_SPEED_LIMITING=1.2,
 MIN_ANGLE_FOR_SPEED_LIMITING=.4,MIN_ANGLE_FOR_SPEED_LIMITING_BETWEEN_NODES=.1;
export const PATH_DIRECTION={NONE:0,STRAIGHT:1,RIGHT:2,LEFT:4} as const;

type V2={x:number;y:number};
const dot=(a:V2,b:V2)=>a.x*b.x+a.y*b.y;
/** CGeneral::LimitRadianAngle. */
export function limitRadianAngle(angle:number){while(angle>Math.PI)angle-=2*Math.PI;while(angle<=-Math.PI)angle+=2*Math.PI;return angle;}
/** CGeneral::GetATanOfXY, as an angle comparable through limitRadianAngle. */
const atanOf=(v:V2)=>Math.atan2(v.y,v.x);

/** A navigation link as a car travels it: its point, its direction of travel (the link direction times the
 * travel sign) and CCarPathLink::OneWayLaneOffset. */
export interface TravelLink {position:V2;forward:V2;laneOffset:number}
/** CCarPathLink::OneWayLaneOffset (iOS 0x1001bdb54): lanes of a one-way road are spread about its line, and a
 * two-way road's first lane starts half a lane plus the link's width (its unsigned byte, sixteenths of a unit, over
 * 86.4, so the width over one 5.4 lane) to the right. Vice City's, which the port first took, had no width. */
export function oneWayLaneOffset(link:{sameLanes:number;oppositeLanes:number;width?:number}){
 const f=Math.fround;
 if(link.oppositeLanes===0)return f(.5-f(link.sameLanes*.5));
 if(link.sameLanes===0)return f(.5-f(link.oppositeLanes*.5));
 // The port reads the width byte signed, in sixteenths; the executable reads it unsigned.
 const raw=Math.round((link.width??0)*16)&0xff;
 return f(f(raw/f(86.4))+.5);
}
/** The lane's point on a link, LANE_WIDTH per lane to the right of the direction of travel. */
export function lanePoint(link:TravelLink,lane:number):V2{
 const d=(lane+link.laneOffset)*LANE_WIDTH;
 return {x:link.position.x+d*link.forward.y,y:link.position.y-d*link.forward.x};
}
/** CCarCtrl::FindMaxSteerAngle (0x427FE0 in SA, reversed). */
export const findMaxSteerAngle=(moveSpeed:number)=>Math.min(.7,Math.max(.2,.9-moveSpeed));
/** CCarCtrl::FindSpeedMultiplier. */
export function findSpeedMultiplier(angleChange:number,minAngle:number,maxAngle:number,coef:number){
 const n=Math.max(0,Math.abs(limitRadianAngle(angleChange))-minAngle),d=maxAngle-minAngle;
 return n>d?coef:1-n/d*(1-coef);
}
/** CCarCtrl::FindPathDirection as the iOS executable has it (0x100197f74): straight while the turn's cosine is over
 * 0.4 (up to 66.4 degrees), else left or right by the cross product (a dead reverse counts as right). `out.sharp` is
 * set for a turn sharper than 107.5 degrees (cosine under −0.3). Vice City's had split at a sine of ±0.77. */
export function findPathDirection(prev:V2,cur:V2,next:V2,out?:{sharp:boolean}){
 if(out)out.sharp=false;
 const a={x:cur.x-prev.x,y:cur.y-prev.y},b={x:next.x-cur.x,y:next.y-cur.y},la=Math.hypot(a.x,a.y),lb=Math.hypot(b.x,b.y);
 if(la===0||lb===0)return PATH_DIRECTION.NONE;
 const cos=(a.x*b.x+a.y*b.y)/(la*lb);
 if(cos>.4)return PATH_DIRECTION.STRAIGHT;
 if(out&&cos<-.3)out.sharp=true;
 return a.x*b.y-a.y*b.x>0?PATH_DIRECTION.LEFT:PATH_DIRECTION.RIGHT;
}

export interface FollowPathCar {position:V2;forward:V2;moveSpeed:{x:number;y:number;z:number};forward3:{x:number;y:number;z:number}}
/** The node-change test at the top of SteerAICarWithPhysicsFollowPath: close to the current link's lane point,
 * nearly facing past it, or already moving away along the next segment; or, as the iOS executable adds (0x10019a7f4),
 * the next link is the current one, as a U-turn leaves it, so the car picks again at once. */
export function shouldPickNextNode(car:FollowPathCar,current:TravelLink,currentLane:number,next:TravelLink,nextLane:number){
 if(next.position.x===current.position.x&&next.position.y===current.position.y)return true;
 const here=lanePoint(current,currentLane),there=lanePoint(next,nextLane);
 const toCar={x:car.position.x-here.x,y:car.position.y-here.y},distance=Math.hypot(toCar.x,toCar.y);
 const between={x:there.x-here.x,y:there.y-here.y},d=dot(between,toCar);
 return distance<DISTANCE_TO_NEXT_NODE_TO_SELECT_NEW||d>0&&distance<DISTANCE_TO_FACING_NEXT_NODE_TO_SELECT_NEW||d/(distance*Math.hypot(between.x,between.y))>.7;
}
export interface Pedals {swerve:number;accel:number;brake:number;handbrake:boolean}
/** The rest of SteerAICarWithPhysicsFollowPath for a car cruising under STOP_FOR_CARS, as the iOS executable has it
 * (0x10019a584): steer at a point 0.35 of the way back from the lane point towards the car (Vice City's 0.4), within
 * FindMaxSteerAngle alone (no high-speed cap), and cruise at the speed allowed by the heading error, the turn onto the
 * next link and the traffic ahead; over it, brake min(0.5, −difference / 12). `trafficSpeed` is
 * FindMaximumSpeedForThisCarInTraffic. */
export function steerFollowPath(car:FollowPathCar,current:TravelLink,currentLane:number,next:TravelLink,o:{cruiseSpeed:number;trafficSpeed:number;stop:boolean}):Pedals{
 const here=lanePoint(current,currentLane),distance=Math.hypot(here.x-car.position.x,here.y-car.position.y);
 const pull=Math.fround(.35),projected=distance>DISTANCE_TO_NEXT_NODE_TO_CONSIDER_SLOWING_DOWN?here:{x:here.x-current.forward.x*distance*pull,y:here.y-current.forward.y*distance*pull};
 const angleForward=atanOf(car.forward),angleToPoint=atanOf({x:projected.x-car.position.x,y:projected.y-car.position.y});
 const move=Math.hypot(car.moveSpeed.x,car.moveSpeed.y,car.moveSpeed.z),maxAngle=findMaxSteerAngle(move);
 const steer=Math.min(maxAngle,Math.max(-maxAngle,limitRadianAngle(angleToPoint-angleForward)));
 const forwardSpeed=(car.moveSpeed.x*car.forward3.x+car.moveSpeed.y*car.forward3.y+car.moveSpeed.z*car.forward3.z)*GAME_SPEED_TO_CARAI_SPEED;
 const styleMultiplier=o.stop?0:o.cruiseSpeed?o.trafficSpeed/o.cruiseSpeed:0;
 const angleMultiplier=findSpeedMultiplier(atanOf({x:here.x-car.position.x,y:here.y-car.position.y})-angleForward,MIN_ANGLE_FOR_SPEED_LIMITING,MAX_ANGLE_FOR_SPEED_LIMITING,MIN_LOWERING_SPEED_COEFFICIENT);
 const wide=findSpeedMultiplier(atanOf(current.forward)-atanOf(next.forward),MIN_ANGLE_FOR_SPEED_LIMITING_BETWEEN_NODES,MAX_ANGLE_FOR_SPEED_LIMITING,MIN_LOWERING_SPEED_COEFFICIENT);
 const nodesMultiplier=distance>DISTANCE_TO_NEXT_NODE_TO_CONSIDER_SLOWING_DOWN||o.cruiseSpeed<12?1:1-(1-distance/DISTANCE_TO_NEXT_NODE_TO_CONSIDER_SLOWING_DOWN)*(1-wide);
 const speed=o.cruiseSpeed*Math.min(styleMultiplier,angleMultiplier,nodesMultiplier),difference=speed-forwardSpeed;
 let accel=0,brake=0;
 if(speed<.05&&difference<.03)brake=1;
 else if(difference<=0)brake=Math.min(.5,difference/-12);
 else accel=Math.min(1,difference*(forwardSpeed<2?.25:.125));
 return {swerve:steer,accel,brake,handbrake:false};
}

/** One outgoing connection from the node a car is approaching. */
export interface NextCandidate<T> {
 value:T;node:V2;
 /** The next node is the one the car came from. */
 uTurn:boolean;
 deadEnd:boolean;switchedOff:boolean;
 /** Node flags 0x80 (water) and 0x400 (don't wander), and the behaviour type (bits 20 to 23). */
 water?:boolean;dontWander?:boolean;behaviour?:number;
 /** Lanes in the direction of travel along the connection, and against it. */
 lanes:number;oppositeLanes:number;
}
/** The junction node's own flags, which IsThisAnAppropriateNode judges a candidate against. */
export interface JunctionFlags {deadEnd:boolean;switchedOff:boolean;water?:boolean;dontWander?:boolean}
/** What PickNextNodeRandomly knows of the vehicle: ThisVehicleShouldTryNotToTurn, STATUS_SIMPLE, the Vortex (which may
 * cross between land and water), a mission car cruising (MISSION_CRUISE, m_nCreatedBy 2), and its collision box's
 * maxima (bbox.max). */
export interface PickingVehicle {tryNotToTurn?:boolean;onRails?:boolean;vortex?:boolean;missionCruiser?:boolean;boundsMax?:{x:number;y:number;z:number}}
/** ThisVehicleShouldTryNotToTurn (inlined in the iOS PickNextNodeRandomly): the linerunner, dumper, bus, coach,
 * packer, flatbed, tanker, roadtrain and cement truck go straight on. */
export const TRY_NOT_TO_TURN_MODELS:ReadonlySet<number>=new Set([403,406,431,437,443,455,514,515,524]);
/** CCarCtrl::IsThisAnAppropriateNode as the iOS executable has it (0x100197a14), for a candidate off the junction:
 * not the way back; no switch between land and water (but for the Vortex); node behaviour types 5 and 10 only for
 * vehicles 2 or more tall, 8 and 9 only for ones at most 1.5 tall, 2 wide and 4 long, and neither against a one-way
 * road; no don't-wander node for a mission car cruising, a dead end or a switched-off node from a junction that is
 * not one; and not against a one-way road. Behaviour types 1 and 2 (parallel and perpendicular parking spots) send a
 * random car to park, which the browser has not: they are refused. */
export function isThisAnAppropriateNode(c:NextCandidate<unknown>,junction:JunctionFlags,vehicle:PickingVehicle={}){
 const againstOneWay=c.lanes===0,size=vehicle.boundsMax;
 if(c.uTurn)return false;
 if(!!c.water!==!!junction.water&&!vehicle.vortex)return false;
 switch(c.behaviour){
  case 5:case 10:if(againstOneWay||!(size&&size.z>=2))return false;break;
  case 8:case 9:if(againstOneWay||!size||size.z>1.5||size.x>2||size.y>4)return false;break;
  case 1:case 2:return false;
 }
 if(vehicle.missionCruiser&&c.dontWander&&!junction.dontWander)return false;
 if(c.deadEnd&&!junction.deadEnd)return false;
 return !(c.switchedOff&&!junction.switchedOff||againstOneWay);
}
/** CCarCtrl::PickNextNodeRandomly's choice as the iOS executable makes it (0x10019052c): one draw for where to start
 * among the junction's links and one for which way to walk them, every link tried once a pass in that order:
 * - first the turns the lane allows (only straight on for ThisVehicleShouldTryNotToTurn; no turn sharper than 107.5
 *   degrees for a car on rails), never one-way onto one-way, and IsThisAnAppropriateNode;
 * - then any link with lanes the car's way that is not the way back, onto a switched-off road only from one;
 * - then any link with lanes the car's way that is not the way back;
 * - else the U-turn.
 * `random` is rand() % count (the direction is rand()'s bit 4). Vice City's drew 14 times a pass, with repeats. */
export function pickNextNodeRandomly<T>(o:{previous:V2;current:V2;candidates:readonly NextCandidate<T>[];
 lanesOnCurrent:number;onOneWayRoad:boolean;nextLane:number;junction:JunctionFlags;previousSwitchedOff:boolean;vehicle?:PickingVehicle;random:(count:number)=>number}):{choice:NextCandidate<T>|undefined;uTurn:boolean}{
 const {candidates}=o,n=candidates.length;if(!n)return {choice:undefined,uTurn:true};
 let allowed=0;
 if(o.nextLane===0)allowed|=PATH_DIRECTION.LEFT;
 if(o.nextLane===o.lanesOnCurrent-1)allowed|=PATH_DIRECTION.RIGHT;
 if(o.lanesOnCurrent<3||allowed===0)allowed|=PATH_DIRECTION.STRAIGHT;
 if(o.vehicle?.tryNotToTurn)allowed=PATH_DIRECTION.STRAIGHT;
 const start=o.random(n),onwards=o.random(2)===1,at=(k:number)=>candidates[onwards?(start+k)%n:(start+n-k)%n];
 const turn={sharp:false};
 for(let k=0;k<n;k++){
  const c=at(k),direction=findPathDirection(o.previous,o.current,c.node,turn);
  if(o.vehicle?.onRails&&turn.sharp)continue;
  if((c.oppositeLanes>0||!o.onOneWayRoad)&&(direction&allowed)&&isThisAnAppropriateNode(c,o.junction,o.vehicle))return {choice:c,uTurn:false};
 }
 for(let k=0;k<n;k++){const c=at(k);if(!c.uTurn&&c.lanes>0&&(!c.switchedOff||o.previousSwitchedOff))return {choice:c,uTurn:false};}
 for(let k=0;k<n;k++){const c=at(k);if(!c.uTurn&&c.lanes>0)return {choice:c,uTurn:false};}
 return {choice:candidates.find(c=>c.uTurn),uTurn:true};
}
/** CAutoPilot's lane-change countdown (field_50), 2 to 9 as the car is made. */
export const initialLaneChangeCountdown=(rand:()=>number)=>(rand()&7)+2;
/** PickNextNodeRandomly's lane-change rhythm (iOS 0x100191088): a new segment over 16 units node to node takes one off
 * the countdown; at 0 it restarts at 4 to 7 and the car moves a lane, outwards on an odd draw. `rand` is rand(). */
export function laneChangeCountdown(countdown:number,segmentLength:number,rand:()=>number){
 if(!(segmentLength*segmentLength>256))return {countdown,change:false,right:false};
 countdown=(countdown-1)&255;
 if(countdown!==0)return {countdown,change:false,right:false};
 countdown=(rand()&3)|4;
 return {countdown,change:true,right:(rand()&1)!==0};
}
/** PickNextNodeRandomly's lane on the next link: a lane over when the countdown says so (to the right when `right`),
 * clamped to the lanes in the direction of travel (0 when there are none). `slowLane` is CAutoPilot::bStayInSlowLane
 * (SET_CAR_STAY_IN_SLOW_LANE): the outermost lane. */
export function nextLaneOnLink(lane:number,lanesOnNext:number,change:boolean,right:boolean,slowLane=false,fastLane=false){
 // CAutoPilot's bStayInFastLane (SET_CAR_STAY_IN_FAST_LANE) forces lane 0 ahead of bStayInSlowLane's outermost lane.
 if(fastLane)return 0;
 if(slowLane)return Math.max(lanesOnNext-1,0);
 return Math.max(Math.min(change?lane+(right?1:-1):lane,lanesOnNext-1),0);
}

type V3={x:number;y:number;z:number};
/** A vehicle as the moving-rect tests see it: position and its collision box's front (max.y), back (−min.y) and
 * half-width (max.x). */
export interface MovingRect {position:V2;front:number;back:number;halfWidth:number}
/** The iOS executable's first moving-rect test (0x100194f4c): the fraction of `projection` (A's motion relative to B
 * over 60 frames) at which one of A's four corners crosses B's front bumper, between its two ends, from in front of
 * it; 1 when none does. A corner already inside B, or meeting its side or back, does not count. */
export function testFrontBumperCrossing(a:MovingRect,b:MovingRect,projection:V2,forwardB:V2,forwardA:V2){
 const rb={x:forwardB.y,y:-forwardB.x},ra={x:forwardA.y,y:-forwardA.x};
 const p1={x:b.position.x+forwardB.x*b.front+rb.x*b.halfWidth,y:b.position.y+forwardB.y*b.front+rb.y*b.halfWidth};
 const p2={x:b.position.x+forwardB.x*b.front-rb.x*b.halfWidth,y:b.position.y+forwardB.y*b.front-rb.y*b.halfWidth};
 let r=1;
 for(const [along,side] of [[a.front,1],[a.front,-1],[-a.back,1],[-a.back,-1]]){
  const c={x:a.position.x+forwardA.x*along+ra.x*a.halfWidth*side,y:a.position.y+forwardA.y*along+ra.y*a.halfWidth*side};
  const d0=(c.x-p1.x)*forwardB.x+(c.y-p1.y)*forwardB.y;if(!(d0>0))continue;
  const d1=(c.x+projection.x-p1.x)*forwardB.x+(c.y+projection.y-p1.y)*forwardB.y;if(!(d1<0))continue;
  const s1=(p1.x-c.x)*projection.y-(p1.y-c.y)*projection.x,s2=(p2.x-c.x)*projection.y-(p2.y-c.y)*projection.x;
  if(!(s1*s2<0))continue;
  const t=d0/(d0-d1);r=r<t?r:t;
 }
 return r;
}
/** The second (0x100195134): Vice City's TestCollisionBetween2MovingRects slab test for A's two front corners alone,
 * without VC's front-left slip: the fraction of `projection` (A's motion relative to B) at which one enters B's box,
 * or 1. */
export function testFrontCornersEnterRect(a:MovingRect,b:MovingRect,projection:V2,forwardB:V2,forwardA:V2){
 const to={x:a.position.x-b.position.x,y:a.position.y-b.position.y},width=b.halfWidth,front=b.front,back=-b.back;
 const lateral=forwardB.y*projection.x-forwardB.x*projection.y,longitudinal=forwardB.x*projection.x+forwardB.y*projection.y;
 const fullWidth=2*width/lateral,fullLength=(front-back)/longitudinal;
 // Where along the move the corner is inside the slab [far, near] on one axis: its entry (base) and exit (whole).
 const axis=(d:number,moving:number,near:number,far:number,full:number):[number,number]=>{
  if(d>near){if(moving>=0)return [1,1];const t=-(d-near)/moving;return t>=1?[1,1]:[t,Math.min(1,t-full)];}
  if(d<far){if(moving<=0)return [1,1];const t=-(d-far)/moving;return t>=1?[1,1]:[t,Math.min(1,t+full)];}
  return moving>0?[0,(near-d)/moving]:moving<0?[0,(far-d)/moving]:[0,1];
 };
 const ra={x:forwardA.y,y:-forwardA.x};let r=1;
 for(const side of [1,-1]){
  const c={x:to.x+forwardA.x*a.front+ra.x*a.halfWidth*side,y:to.y+forwardA.y*a.front+ra.y*a.halfWidth*side};
  const [bw,ww]=axis(c.x*forwardB.y-c.y*forwardB.x,lateral,width,-width,fullWidth);
  const [bl,wl]=axis(c.x*forwardB.x+c.y*forwardB.y,longitudinal,front,back,fullLength);
  const base=Math.max(bw,bl);
  if(base<wl&&base<ww)r=Math.min(r,base);
 }
 return r;
}
/** CCarCtrl::SlowCarDownForOtherCar as the iOS executable has it (0x100194b98): `speed` (the lowest so far) lowered
 * for another vehicle not behind the car, `curSpeed` being cruise × m_SpeedMult. The two tests above give the
 * proximity, a fraction of the 60 frames ahead; projected contact within 1 unit of travel stops the car, within 3 it
 * crawls at 1, and further it may go Vice City's max(0, proximity − 0.2) / 1.3 of curSpeed (so 0.615 of it with no
 * contact projected at all). Any vehicle ahead raises bHonkAtCar. Returns the new speed and the proximity the
 * standoff reads, or undefined for a vehicle behind. */
export function slowCarDownForOtherCar(car:MovingRect&{forward:V2},other:MovingRect&{forward:V2;moveSpeed:V2},speed:number,curSpeed:number){
 const fa=normal(car.forward);
 if(dot({x:other.position.x-car.position.x,y:other.position.y-car.position.y},fa)<0)return undefined;
 const fb=normal(other.forward);
 const projection={x:GAME_SPEED_TO_CARAI_SPEED*other.moveSpeed.x-fa.x*curSpeed,y:GAME_SPEED_TO_CARAI_SPEED*other.moveSpeed.y-fa.y*curSpeed};
 const p1=testFrontBumperCrossing(other,car,projection,fa,fb),p2=testFrontCornersEnterRect(car,other,{x:-projection.x,y:-projection.y},fb,fa);
 let proximity=p1<p2?p1:p2;
 if(proximity>=0&&proximity<1.5){
  if(proximity<1/curSpeed)speed=0;
  else if(proximity<3/curSpeed)speed=Math.min(speed,1);
  else{proximity=Math.max((proximity-.2)*.7692308,0);speed=Math.min(speed,proximity*curSpeed);}
 }
 return {speed,proximity};
}
function normal(v:V2){const l=Math.hypot(v.x,v.y);return l>0?{x:v.x/l,y:v.y/l}:{x:1,y:v.y};}
/** A vehicle as CCarCtrl's danger scans read it, in native coordinates: its position, its matrix's forward, the
 * collision model's bound centre in the world (CEntity::GetBoundCentre), its box and its move speed per frame. */
export interface DangerView extends MovingRect {position:V3;forward:V3;centre:V3;moveSpeed:V2}
/** FindMaximumSpeedForThisCarInTraffic's scan: half the side of the box centred on the car. */
export const DISTANCE_TO_SCAN_FOR_DANGER=14;
/** SlowCarDownForCarsSectorList's filter (iOS 0x100194058): the other vehicle's bound centre strictly inside the
 * ±14 box round the car, under 10 above or below it, and under 3 off the car's own slope (its unnormalised forward). */
export function inCarDangerZone(car:{position:V3;forward:V3},centre:V3){
 const dx=centre.x-car.position.x,dy=centre.y-car.position.y;
 if(!(Math.abs(dx)<DISTANCE_TO_SCAN_FOR_DANGER&&Math.abs(dy)<DISTANCE_TO_SCAN_FOR_DANGER&&Math.abs(centre.z-car.position.z)<10))return false;
 return Math.abs(centre.z-(car.position.z+(dx*car.forward.x+dy*car.forward.y)*car.forward.z))<3;
}
/** SlowCarDownForCarsSectorList over `others`: the lowest speed they allow, starting from `speed`, and whether any
 * raised bHonkAtCar. `standoff` sees each vehicle ahead with its proximity and the speed so far, and may change it. */
export function slowCarDownForCars<T extends DangerView>(car:DangerView,others:Iterable<T>,speed:number,curSpeed:number,standoff?:(other:T,proximity:number,speed:number)=>number){
 let honk=false;
 const rect={position:car.position,front:car.front,back:car.back,halfWidth:car.halfWidth,forward:car.forward};
 for(const other of others){
  if(other===car||!inCarDangerZone(car,other.centre))continue;
  const r=slowCarDownForOtherCar(rect,other,speed,curSpeed);if(!r)continue;
  honk=true;speed=standoff?standoff(other,r.proximity,r.speed):r.speed;
 }
 return {speed,honk};
}
/** The 15-second standoff at the end of SlowCarDownForOtherCar: two cars facing each other (their forwards' dot under
 * −0.5) with a proximity under 0.5, neither having moved for 15 s. The car this is asked of keeps at least 0.2 of
 * curSpeed and turns to DRIVINGSTYLE_AVOID_CARS. */
export function standoffApplies(proximity:number,o:{now:number;stillSince:number;otherStillSince:number;forward:V3;otherForward:V3}){
 return proximity>=0&&proximity<.5&&o.now-o.stillSince>=15001&&o.now-o.otherStillSince>=15001&&o.forward.x*o.otherForward.x+o.forward.y*o.otherForward.y<-.5;
}
/** The vehicle half of CCarCtrl::SlowCarDownForPedsSectorList as the iOS executable has it (0x1001941b8), over one
 * list of peds already in the ±14 box: a ped under 6 above or below the car and under 3 off its slope, ahead of its
 * nose, due to be reached within 4 s, within 13 of the nose and within the car's width plus 0.5 to the side keeps the
 * car to max(1, max(0, distance − 1) / 13 × curSpeed) and raises bHonkAtPed; within 4 the car waits (TEMPACT_WAIT),
 * within 2.5 it brakes (TEMPACT_BRAKE), each for 4 s, the last ped setting it. A car stopped dead never reaches the
 * test. The player is passed over by the car he fell off getting into (`ignored`). A bike's width grows by 1.6 for each
 * ped due within 4 s, compounding over the list (the executable stores it back). */
export function slowCarDownForPeds(car:{position:V3;forward:V3;right:V3;moveSpeed:V3;front:number;halfWidth:number;bike?:boolean},peds:Iterable<V3&{ignored?:boolean}>,speed:number,curSpeed:number){
 const p=car.position,f=car.forward,reach=(f.x*car.moveSpeed.x+f.y*car.moveSpeed.y+f.z*car.moveSpeed.z)*50*4;
 let width=car.halfWidth,honk=false,action:'wait'|'brake'|undefined;
 for(const ped of peds){
  if(!(Math.abs(ped.z-p.z)<6))continue;
  const d={x:ped.x-p.x,y:ped.y-p.y,z:ped.z-p.z};
  if(!(Math.abs(ped.z-(p.z+(d.x*f.x+d.y*f.y)*f.z))<3))continue;
  const along=d.x*f.x+d.y*f.y+d.z*f.z;
  if(!(along>car.front)||ped.ignored)continue;
  const distance=along-car.front;if(!(distance<reach))continue;
  const side=Math.abs(d.x*car.right.x+d.y*car.right.y+d.z*car.right.z);
  if(car.bike)width*=1.6;
  if(distance<13&&side<=width+.5){
   speed=Math.min(speed,Math.max(Math.max(distance-1,0)/13*curSpeed,1));honk=true;
   if(distance<4)action='wait';
   if(distance<2.5)action='brake';
  }
 }
 return {speed,honk,action};
}

/** CAutoPilot temporary actions a cruising car can be given. */
export type TempAction='wait'|'brake'|'swerveStop'|'reverse'|'handbrakeStraight';
/** CCarAI::MakeWayForCarWithSiren (0x41D660, reversed) for one random car against one car sounding its siren:
 * a car more than 0.8 inside the siren's line of travel that faces along it (or nearly straight against it)
 * swerves and stops for 2.5 s (TEMPACT_SWIRVELEFT_STOP; the right-hand variant, taken by cars facing the siren,
 * becomes TEMPACT_WAIT); cars heading towards the siren otherwise wait 2 s, or 4 s when in its line. Only cars
 * moving faster than √0.05 units per frame within 45 × the siren's speed + 40 units, and 5 units vertically,
 * react. Returns the action and its length in milliseconds, or undefined. */
export function makeWayForCarWithSiren(car:{position:{x:number;y:number;z:number};moveSpeed:V2;forward:V2;current?:TempAction},siren:{position:{x:number;y:number;z:number};moveSpeed:V2}):{action:TempAction;ms:number}|undefined{
 const sirenSpeed=Math.hypot(siren.moveSpeed.x,siren.moveSpeed.y),sirenDir=sirenSpeed>0?{x:siren.moveSpeed.x/sirenSpeed,y:siren.moveSpeed.y/sirenSpeed}:{x:1,y:0};
 const to={x:car.position.x-siren.position.x,y:car.position.y-siren.position.y},dz=car.position.z-siren.position.z;
 if(Math.abs(dz)>=5)return undefined;
 const distance=Math.hypot(to.x,to.y);
 if(distance>=sirenSpeed*45+40||car.moveSpeed.x**2+car.moveSpeed.y**2<=.05)return undefined;
 const towardsSiren=dot(to,car.moveSpeed)<0;
 if(dot(sirenDir,{x:to.x/distance,y:to.y/distance})<=.8)return towardsSiren&&car.current!=='wait'&&car.current!=='brake'?{action:'wait',ms:2000}:undefined;
 const sameDirection=dot(sirenDir,car.forward);
 if(sameDirection>.7||sameDirection< -.9){
  if(car.current==='swerveStop')return undefined;
  // Ahead in the siren's line the dot is always positive, so the pick is SWIRVELEFT_STOP, flipped for a car facing
  // the siren, and the flipped SWIRVERIGHT_STOP becomes a wait.
  return {action:sameDirection<0?'wait':'swerveStop',ms:2500};
 }
 return towardsSiren&&car.current!=='swerveStop'?{action:'wait',ms:4000}:undefined;
}
/** TEMPACT_SWIRVELEFT and _RIGHT and their _STOP variants as the iOS SteerAICarWithPhysics has them (0x100198610): a
 * steer of 0.25 (negative to the left, towards the kerb), turned the other way over the last 1250 ms, no gas and a
 * touch of brake (0.001). As they run out the _STOP variants wait 4 s (SWIRVE_STOP_WAIT_MS). Vice City's swerve had
 * steered 0.15, straightened over the last second and braked at 0.5. */
export function swirvePedals(right:boolean,remainingMs:number):Pedals{
 const steer=right?.25:-.25;
 return {swerve:remainingMs<1250?-steer:steer,accel:0,brake:.001,handbrake:false};
}
export const SWIRVE_STOP_WAIT_MS=4000;
/** CCarCtrl::SteerAICarWithPhysics for a temporary action. TEMPACT_WAIT holds the brake at 0.2, TEMPACT_BRAKE at 1;
 * `swerveStop` is TEMPACT_SWIRVELEFT_STOP. */
export function tempActionPedals(action:TempAction,remainingMs:number,o:{follow?:Pedals;forwardSpeed?:number}={}):Pedals{
 if(action==='wait')return {swerve:0,accel:0,brake:.2,handbrake:false};
 if(action==='brake')return {swerve:0,accel:0,brake:1,handbrake:false};
 // TEMPACT_HANDBRAKESTRAIGHT (VC; the SA steerer is a stub): wheel straight, no pedals, the handbrake on.
 if(action==='handbrakeStraight')return {swerve:0,accel:0,brake:0,handbrake:true};
 // TEMPACT_REVERSE: the mission's own steer, mirrored, backing at half gas (braking first while still rolling forward).
 if(action==='reverse'){const rolling=(o.forwardSpeed??0)>.04;return {swerve:-(o.follow?.swerve??0),accel:rolling?0:-.5,brake:rolling?.5:0,handbrake:false};}
 return swirvePedals(false,remainingMs);
}
/** CCarAI::UpdateCarAI's jam handling for a random car cruising under STOP_FOR_CARS (0x41FB1B–0x41FD3C). The
 * decompiled test reads as if only stationary and escort missions qualified; that is the list VC excludes, so the
 * test is taken as inverted, as for the police. `timeToStartMission` is reset while the car moves faster than 0.05
 * units per frame or has touched nothing for 500 ms; a car slower than 0.012 for 500 × (seed mod 16) + 40 ms after
 * that reverses for 750 ms, turns to DRIVINGSTYLE_AVOID_CARS and sounds its horn. One car in eight (seed mod 8 = 0)
 * that has not moved faster than 0.05 for 30 s also switches to AVOID_CARS and reverses for 400 ms. */
export function carAIJam(o:{now:number;previousNow:number;moveSpeed2D:number;collisionAgeMs:number;seed:number;tempAction:boolean;timeToStartMission:number;timeSwitchedToRealPhysics:number;stopForCars?:boolean}){
 let {timeToStartMission,timeSwitchedToRealPhysics}=o;
 if(o.moveSpeed2D>=.05){timeSwitchedToRealPhysics=o.now;timeToStartMission=o.now;}
 let action:{ms:number;horn:boolean}|undefined;
 if(!o.tempAction){
  if(o.collisionAgeMs>500)timeToStartMission=o.now;
  // The seeded interval is the STOP_FOR_CARS styles'; any other waits a second.
  const interval=o.stopForCars===false?1000:500*(o.seed%16)+40;
  if(o.moveSpeed2D<=.012&&o.now-timeToStartMission>interval){action={ms:750,horn:true};timeToStartMission=o.now;}
 }
 // Checked after the jam, so on the frame both fire its 400 ms reverse replaces the 750 (the horn has already sounded).
 if(o.seed%8===0&&o.now-timeSwitchedToRealPhysics>30000&&o.previousNow-timeSwitchedToRealPhysics<=30000)action={ms:400,horn:action?.horn??false};
 return {timeToStartMission,timeSwitchedToRealPhysics,action};
}

export const MIN_ANGLE_TO_APPLY_HANDBRAKE=.7,MIN_SPEED_TO_APPLY_HANDBRAKE=.3;
/** CCarCtrl::SteerAICarWithPhysicsHeadingForTarget (VC; stub in SA): steer straight at the target within
 * FindMaxSteerAngle, pulling the handbrake for a sharp turn above 0.3 units per frame, and drive at the cruise speed
 * lowered by the heading error. Speeds as in steerFollowPath; `moveSpeed` is 3-D, per frame. */
export function steerHeadingForTarget(car:{position:V2;forward:V2;moveSpeed:{x:number;y:number;z:number}},target:V2,cruiseSpeed:number):Pedals{
 const angleForward=atanOf(car.forward),angleToTarget=atanOf({x:target.x-car.position.x,y:target.y-car.position.y});
 let steer=limitRadianAngle(angleToTarget-angleForward);
 const move=Math.hypot(car.moveSpeed.x,car.moveSpeed.y,car.moveSpeed.z);
 const handbrake=move>MIN_SPEED_TO_APPLY_HANDBRAKE&&Math.abs(steer)>MIN_ANGLE_TO_APPLY_HANDBRAKE;
 const maxAngle=findMaxSteerAngle(move);steer=Math.min(maxAngle,Math.max(-maxAngle,steer));
 const speed=cruiseSpeed*findSpeedMultiplier(angleToTarget-angleForward,MIN_ANGLE_FOR_SPEED_LIMITING,MAX_ANGLE_FOR_SPEED_LIMITING,MIN_LOWERING_SPEED_COEFFICIENT);
 const current=move*GAME_SPEED_TO_CARAI_SPEED,difference=speed-current;
 if(difference<=0)return {swerve:steer,accel:0,brake:Math.min(.5,-difference/20),handbrake};
 return {swerve:steer,accel:current<25?Math.min(1,difference*.1):1,brake:0,handbrake};
}
/** MISSION_BLOCKPLAYER_CLOSE's target, SteerAICarWithPhysicsTryingToBlockTarget (re3; SA's own steering is unreversed):
 * the player's spot a CARAI second of his speed ahead, the speed capped at MAX_SPEED_TO_ACCOUNT_IN_INTERCEPTING (0.13 a
 * frame). Within DISTANCE_TO_SWITCH_FROM_BLOCK_TO_STOP (5) of it the car goes to BLOCKPLAYER_HANDBRAKESTOP, which
 * brakes with the handbrake on and goes back to blocking beyond DISTANCE_TO_SWITCH_FROM_STOP_TO_BLOCK (10) of the player. */
export const BLOCK_TO_STOP_DISTANCE=5,STOP_TO_BLOCK_DISTANCE=10;
export function blockPlayerTarget(player:V2,playerSpeed:V2):V2{
 const l=Math.hypot(playerSpeed.x,playerSpeed.y),f=l>.13?.13/l:1;
 return {x:player.x+playerSpeed.x*f*GAME_SPEED_TO_CARAI_SPEED,y:player.y+playerSpeed.y*f*GAME_SPEED_TO_CARAI_SPEED};
}
/** MISSION_RAMPLAYER_CLOSE's target in SteerAICarWithPhysics_OnlyMission (VC): a car on an odd seed that runs with the
 * player's car (forward dot above 0.5) lines up beside it, on the side seed bit 2 picks, and turns into it
 * (TEMPACT_TURNLEFT or TURNRIGHT for 250 ms) once within 12 × its speed + 2; other cars aim at a point up to 0.8 of a
 * unit to either side, by seed. Without a player car the target is the player. */
export function ramPlayerCloseTarget(o:{seed:number;player:V2;car:{position:V2;forward:V2;halfWidth:number};
 playerVehicle?:{position:V2;forward:V2;right:V2;halfWidth:number;speed:number}}):{target:V2;turn?:'left'|'right'}{
 const v=o.playerVehicle;if(!v)return {target:{...o.player}};
 if(o.seed&1&&dot(v.forward,o.car.forward)>.5){
  const side=(v.halfWidth+o.car.halfWidth-.2)*(o.seed&2?1:-1),target={x:v.position.x+v.right.x*side,y:v.position.y+v.right.y*side};
  const close=12*v.speed+2>Math.hypot(o.car.position.x-target.x,o.car.position.y-target.y);
  return {target,turn:close?o.seed&2?'left':'right':undefined};
 }
 const shift=((o.seed&0xff)-128)/160;
 return {target:{x:v.position.x+v.right.x*shift,y:v.position.y+v.right.y*shift}};
}
/** TEMPACT_TURNLEFT and TURNRIGHT: full lock at full gas. */
export const turnPedals=(turn:'left'|'right'):Pedals=>({swerve:turn==='left'?1:-1,accel:1,brake:0,handbrake:false});
