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
export const DISTANCE_TO_NEXT_NODE_TO_CONSIDER_SLOWING_DOWN=40,MAX_ANGLE_TO_STEER_AT_HIGH_SPEED=.2,MIN_SPEED_TO_START_LIMITING_STEER=.45,
 DISTANCE_TO_NEXT_NODE_TO_SELECT_NEW=5,DISTANCE_TO_FACING_NEXT_NODE_TO_SELECT_NEW=8,MIN_LOWERING_SPEED_COEFFICIENT=.4,MAX_ANGLE_FOR_SPEED_LIMITING=1.2,
 MIN_ANGLE_FOR_SPEED_LIMITING=.4,MIN_ANGLE_FOR_SPEED_LIMITING_BETWEEN_NODES=.1,DISTANCE_TO_SCAN_FOR_DANGER=14,SAFE_DISTANCE_TO_PED=3,ATTEMPTS_TO_FIND_NEXT_NODE=15;
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
/** CCarCtrl::FindPathDirection over three node positions. */
export function findPathDirection(prev:V2,cur:V2,next:V2){
 const a={x:cur.x-prev.x,y:cur.y-prev.y},b={x:next.x-cur.x,y:next.y-cur.y},la=Math.hypot(a.x,a.y),lb=Math.hypot(b.x,b.y);
 if(la===0||lb===0)return PATH_DIRECTION.NONE;
 const sin=a.x/la*(b.y/lb)-a.y/la*(b.x/lb);
 return sin>.77?PATH_DIRECTION.LEFT:sin<-.77?PATH_DIRECTION.RIGHT:PATH_DIRECTION.STRAIGHT;
}

export interface FollowPathCar {position:V2;forward:V2;moveSpeed:{x:number;y:number;z:number};forward3:{x:number;y:number;z:number}}
/** The node-change test at the top of SteerAICarWithPhysicsFollowPath: close to the current link's lane point,
 * nearly facing past it, or already moving away along the next segment. */
export function shouldPickNextNode(car:FollowPathCar,current:TravelLink,currentLane:number,next:TravelLink,nextLane:number){
 const here=lanePoint(current,currentLane),there=lanePoint(next,nextLane);
 const toCar={x:car.position.x-here.x,y:car.position.y-here.y},distance=Math.hypot(toCar.x,toCar.y);
 const between={x:there.x-here.x,y:there.y-here.y},d=dot(between,toCar);
 return distance<DISTANCE_TO_NEXT_NODE_TO_SELECT_NEW||d>0&&distance<DISTANCE_TO_FACING_NEXT_NODE_TO_SELECT_NEW||d/(distance*Math.hypot(between.x,between.y))>.7;
}
export interface Pedals {swerve:number;accel:number;brake:number;handbrake:boolean}
/** The rest of SteerAICarWithPhysicsFollowPath for a car cruising under STOP_FOR_CARS: steer at a point 0.4 of
 * the way back from the lane point towards the car, and cruise at the speed allowed by the heading error, the
 * turn onto the next link and the traffic ahead. `trafficSpeed` is FindMaximumSpeedForThisCarInTraffic. */
export function steerFollowPath(car:FollowPathCar,current:TravelLink,currentLane:number,next:TravelLink,o:{cruiseSpeed:number;trafficSpeed:number;stop:boolean}):Pedals{
 const here=lanePoint(current,currentLane),distance=Math.hypot(here.x-car.position.x,here.y-car.position.y);
 const projected=distance>DISTANCE_TO_NEXT_NODE_TO_CONSIDER_SLOWING_DOWN?here:{x:here.x-current.forward.x*distance*.4,y:here.y-current.forward.y*distance*.4};
 const angleForward=atanOf(car.forward),angleToPoint=atanOf({x:projected.x-car.position.x,y:projected.y-car.position.y});
 const move=Math.hypot(car.moveSpeed.x,car.moveSpeed.y,car.moveSpeed.z),maxAngle=findMaxSteerAngle(move);
 let steer=Math.min(maxAngle,Math.max(-maxAngle,limitRadianAngle(angleToPoint-angleForward)));
 if(move>MIN_SPEED_TO_START_LIMITING_STEER)steer=Math.min(MAX_ANGLE_TO_STEER_AT_HIGH_SPEED,Math.max(-MAX_ANGLE_TO_STEER_AT_HIGH_SPEED,steer));
 const forwardSpeed=(car.moveSpeed.x*car.forward3.x+car.moveSpeed.y*car.forward3.y+car.moveSpeed.z*car.forward3.z)*GAME_SPEED_TO_CARAI_SPEED;
 const styleMultiplier=o.stop?0:o.cruiseSpeed?o.trafficSpeed/o.cruiseSpeed:0;
 const angleMultiplier=findSpeedMultiplier(atanOf({x:here.x-car.position.x,y:here.y-car.position.y})-angleForward,MIN_ANGLE_FOR_SPEED_LIMITING,MAX_ANGLE_FOR_SPEED_LIMITING,MIN_LOWERING_SPEED_COEFFICIENT);
 const wide=findSpeedMultiplier(atanOf(current.forward)-atanOf(next.forward),MIN_ANGLE_FOR_SPEED_LIMITING_BETWEEN_NODES,MAX_ANGLE_FOR_SPEED_LIMITING,MIN_LOWERING_SPEED_COEFFICIENT);
 const nodesMultiplier=distance>DISTANCE_TO_NEXT_NODE_TO_CONSIDER_SLOWING_DOWN||o.cruiseSpeed<12?1:1-(1-distance/DISTANCE_TO_NEXT_NODE_TO_CONSIDER_SLOWING_DOWN)*(1-wide);
 const speed=o.cruiseSpeed*Math.min(styleMultiplier,angleMultiplier,nodesMultiplier),difference=speed-forwardSpeed;
 let accel=0,brake=0;
 if(speed<.05&&difference<.03)brake=1;
 else if(difference<=0)brake=Math.min(.5,-difference*.05);
 else accel=Math.min(1,difference*(forwardSpeed<2?.25:.125));
 return {swerve:steer,accel,brake,handbrake:false};
}

/** One outgoing connection from the node a car is approaching. */
export interface NextCandidate<T> {
 value:T;node:V2;
 /** The next node is the one the car came from. */
 uTurn:boolean;
 deadEnd:boolean;switchedOff:boolean;
 /** Lanes in the direction of travel along the connection, and against it. */
 lanes:number;oppositeLanes:number;
}
/** CCarCtrl::PickNextNodeRandomly's choice, with its three passes: first respecting the turns the current lane
 * allows, dead ends, switched-off roads and one-way roads; then only one-way and switched-off roads; then the
 * first usable connection in order, or a U-turn. `random` is CGeneral::GetRandomNumber() % count. */
export function pickNextNodeRandomly<T>(o:{previous:V2;current:V2;candidates:readonly NextCandidate<T>[];
 lanesOnCurrent:number;onOneWayRoad:boolean;nextLane:number;previousDeadEnd:boolean;previousSwitchedOff:boolean;random:(count:number)=>number}):{choice:NextCandidate<T>|undefined;uTurn:boolean}{
 const {candidates}=o;if(!candidates.length)return {choice:undefined,uTurn:true};
 let allowed=0;
 if(o.nextLane===0)allowed|=PATH_DIRECTION.LEFT;
 if(o.nextLane===o.lanesOnCurrent-1)allowed|=PATH_DIRECTION.RIGHT;
 if(o.lanesOnCurrent<3||allowed===0)allowed|=PATH_DIRECTION.STRAIGHT;
 // Each pass draws ATTEMPTS_TO_FIND_NEXT_NODE times and tests a draw at the start of the next attempt, so the last
 // draw is never tested.
 const pass=(accept:(c:NextCandidate<T>)=>boolean)=>{
  for(let attempt=1;attempt<ATTEMPTS_TO_FIND_NEXT_NODE;attempt++){const c=candidates[o.random(candidates.length)];if(accept(c))return c;}
  o.random(candidates.length);return undefined;
 };
 const strict=pass(c=>!c.uTurn&&!!(findPathDirection(o.previous,o.current,c.node)&allowed)&&(!c.deadEnd||o.previousDeadEnd)&&(!c.switchedOff||o.previousSwitchedOff)&&c.lanes>0&&(!o.onOneWayRoad||c.oppositeLanes>0));
 if(strict)return {choice:strict,uTurn:false};
 const loose=pass(c=>!c.uTurn&&(!c.switchedOff||o.previousSwitchedOff)&&c.lanes>0);
 if(loose)return {choice:loose,uTurn:false};
 const first=candidates.find(c=>c.lanes>0&&(!c.switchedOff||o.previousSwitchedOff));
 if(first)return {choice:first,uTurn:first.uTurn};
 return {choice:candidates.find(c=>c.uTurn),uTurn:true};
}
/** PickNextNodeRandomly's lane on the next link: when `change` (a one-in-four draw) is set, move a lane over on a
 * segment of 14 units or more, to the right when `right`; then clamp to the lanes in the direction of travel.
 * `slowLane` is CAutoPilot::bStayInSlowLane (SET_CAR_STAY_IN_SLOW_LANE): the outermost lane, the counterpart of VC's
 * m_bStayInFastLane, which takes lane 0 after the clamp. */
export function nextLaneOnLink(lane:number,lanesOnNext:number,segmentLength:number,change:boolean,right:boolean,slowLane=false){
 if(lanesOnNext<=0)return lane;
 let next=lane;
 if(change&&segmentLength>=14)next+=right?1:-1;
 if(slowLane)return lanesOnNext-1;
 return Math.max(0,Math.min(lanesOnNext-1,next));
}

/** A vehicle as TestCollisionBetween2MovingRects sees it: position, collision box extents. */
export interface MovingRect {position:V2;front:number;back:number;halfWidth:number}
/** CCarCtrl::TestCollisionBetween2MovingRects: the fraction of `projection` (A's velocity relative to B over the
 * look-ahead) at which one of A's corners enters B's box, or 1. VC's front-left corner mixes B's forward x into its
 * x offset; the slip is kept. */
export function testCollisionBetween2MovingRects(a:MovingRect,b:MovingRect,projection:V2,forwardA:V2,forwardB:V2){
 const toA={x:a.position.x-b.position.x,y:a.position.y-b.position.y};
 const lenB=b.front,widthB=b.halfWidth,backLenB=b.back,lenA=a.front,widthA=a.halfWidth,backLenA=a.back;
 const fullWidthB=2*widthB,fullLenB=lenB+backLenB;let proximity=1;
 const corners:V2[]=[
  {x:toA.x+widthA*forwardB.y+lenA*forwardB.x,y:toA.y+lenA*forwardB.y-widthA*forwardB.x},
  {x:toA.x-widthA*forwardB.x+lenA*forwardB.x,y:toA.y+lenA*forwardB.y+widthA*forwardB.x},
  {x:toA.x+widthA*forwardB.y-backLenA*forwardB.x,y:toA.y-backLenA*forwardB.y-widthA*forwardB.x},
  {x:toA.x-widthA*forwardB.y-backLenA*forwardB.x,y:toA.y-backLenA*forwardB.y+widthA*forwardB.x}];
 const axis=(distance:number,projected:number,near:number,far:number,full:number)=>{
  let base=0,whole=1;
  if(distance>near){
   if(projected<0){const t=-(distance-near)/projected;if(t<1){base=t;whole=Math.min(1,t-full/projected);}else base=1;}
   else{base=1;whole=1;}
  }else if(distance<-far){
   if(projected>0){const t=-(distance+far)/projected;if(t<1){base=t;whole=Math.min(1,t+full/projected);}else base=1;}
   else{base=1;whole=1;}
  }else if(projected>0)whole=(near-distance)/projected;
  else if(projected<0)whole=-(far+distance)/projected;
  return {base,whole};
 };
 for(const c of corners){
  const w=axis(c.x*forwardA.y-c.y*forwardA.x,projection.x*forwardA.y-projection.y*forwardA.x,widthB,widthB,fullWidthB);
  const l=axis(c.x*forwardA.x+c.y*forwardA.y,projection.x*forwardA.x+projection.y*forwardA.y,lenB,backLenB,fullLenB);
  const base=Math.max(w.base,l.base);
  if(base<w.whole&&base<l.whole)proximity=Math.min(proximity,base);
 }
 return proximity;
}
/** CCarCtrl::SlowCarDownForOtherCar: the cruise speed allowed by another vehicle ahead, `curSpeed` being the car's
 * cruise speed. Returns undefined when the other vehicle is behind or no collision is projected. */
export function slowCarDownForOtherCar(car:MovingRect&{forward:V2},other:MovingRect&{forward:V2;moveSpeed:V2},curSpeed:number){
 const fa=normal(car.forward),fb=normal(other.forward);
 if(dot({x:other.position.x-car.position.x,y:other.position.y-car.position.y},fa)<0)return undefined;
 const projection={x:GAME_SPEED_TO_CARAI_SPEED*other.moveSpeed.x-fa.x*curSpeed,y:GAME_SPEED_TO_CARAI_SPEED*other.moveSpeed.y-fa.y*curSpeed};
 const proximity=Math.min(testCollisionBetween2MovingRects(other,car,projection,fa,fb),testCollisionBetween2MovingRects(car,other,{x:-projection.x,y:-projection.y},fb,fa));
 if(proximity>=0&&proximity<1.5)return Math.max(0,(proximity-.2)/1.3)*curSpeed;
 return undefined;
}
function normal(v:V2){const l=Math.hypot(v.x,v.y);return l>0?{x:v.x/l,y:v.y/l}:{x:1,y:v.y};}
/** The vehicle half of CCarCtrl::SlowCarDownForPedsSectorList: a ped ahead, due to be reached within 4 s and within
 * the car's width plus 0.5 to the side, lowers the speed when less than 10 units away; under 2 units the car waits
 * 3 s (TEMPACT_WAIT). Returns undefined when the ped is no concern. */
export function slowCarDownForPed(car:{position:{x:number;y:number;z:number};forward:{x:number;y:number;z:number};right:{x:number;y:number;z:number};moveSpeed:{x:number;y:number;z:number};front:number;halfWidth:number;bike?:boolean},ped:{x:number;y:number;z:number},curSpeed:number){
 if(Math.abs(ped.z-car.position.z)>=4)return undefined;
 const to={x:ped.x-car.position.x,y:ped.y-car.position.y,z:ped.z-car.position.z};
 const along=car.forward.x*to.x+car.forward.y*to.y+car.forward.z*to.z,velocity=car.forward.x*car.moveSpeed.x+car.forward.y*car.moveSpeed.y+car.forward.z*car.moveSpeed.z;
 if(along<=car.front)return undefined;
 const untilHit=along-car.front;
 if(4*50*velocity<=untilHit)return undefined;
 const side=Math.abs(car.right.x*to.x+car.right.y*to.y+car.right.z*to.z),width=car.halfWidth*(car.bike?1.6:1);
 if(width+.5<side||untilHit>=10)return undefined;
 return {speed:Math.abs(untilHit-1)/10*curSpeed,wait:untilHit<2};
}

/** CAutoPilot temporary actions a cruising car can be given. */
export type TempAction='wait'|'swerveStop'|'reverse'|'handbrakeStraight';
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
 if(dot(sirenDir,{x:to.x/distance,y:to.y/distance})<=.8)return towardsSiren&&car.current!=='wait'?{action:'wait',ms:2000}:undefined;
 const sameDirection=dot(sirenDir,car.forward);
 if(sameDirection>.7||sameDirection< -.9){
  if(car.current==='swerveStop')return undefined;
  // Ahead in the siren's line the dot is always positive, so the pick is SWIRVELEFT_STOP, flipped for a car facing
  // the siren, and the flipped SWIRVERIGHT_STOP becomes a wait.
  return {action:sameDirection<0?'wait':'swerveStop',ms:2500};
 }
 return towardsSiren&&car.current!=='swerveStop'?{action:'wait',ms:4000}:undefined;
}
/** CCarCtrl::SteerAICarWithPhysics for a temporary action. TEMPACT_WAIT holds the brake at 0.2. SA's
 * TEMPACT_SWIRVELEFT_STOP is not reversed: it follows VC's TEMPACT_SWERVELEFT (a steer of −0.15, towards the
 * kerb, straightening over the last second) and brakes to a stop. */
export function tempActionPedals(action:TempAction,remainingMs:number,o:{follow?:Pedals;forwardSpeed?:number}={}):Pedals{
 if(action==='wait')return {swerve:0,accel:0,brake:.2,handbrake:false};
 // TEMPACT_HANDBRAKESTRAIGHT (VC; the SA steerer is a stub): wheel straight, no pedals, the handbrake on.
 if(action==='handbrakeStraight')return {swerve:0,accel:0,brake:0,handbrake:true};
 // TEMPACT_REVERSE: the mission's own steer, mirrored, backing at half gas (braking first while still rolling forward).
 if(action==='reverse'){const rolling=(o.forwardSpeed??0)>.04;return {swerve:-(o.follow?.swerve??0),accel:rolling?0:-.5,brake:rolling?.5:0,handbrake:false};}
 return {swerve:remainingMs<1000?.15:-.15,accel:0,brake:.5,handbrake:false};
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
