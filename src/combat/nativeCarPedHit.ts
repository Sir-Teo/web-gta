import {PED_PIECE,WEAPON} from './nativeDamageAnim';

/* A vehicle striking a pedestrian, pinned gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166.
 *
 * - `carHitsPed`: the branch of CPhysical::ApplyCollision (Entity/Physical.cpp) taken when
 *   the struck entity has bDisableTurnForce, as peds do. The vehicle's mass counts ten
 *   times (fThisMassFactor), so a car barely slows while the ped takes the impact.
 * - `killPedWithCarTask`: CTaskSimpleKillPedWithCar::ProcessPed
 *   (Tasks/TaskTypes/TaskSimpleKillPedWithCar.cpp): which side was struck, run over or
 *   thrown onto the bonnet, the ped's new speed, the damage event and the push back on
 *   the car.
 *
 * CPed::KillPedWithCar (0x5F0360), which decides between that task and a lesser
 * response from the impact intensity, is still a retail stub upstream; see
 * PED_CAR_KILL_INTENSITY. Native units: mass, units per 1/50 s frame, Z up. */

type V3={x:number;y:number;z:number};
const dot=(a:V3,b:V3)=>a.x*b.x+a.y*b.y+a.z*b.z;
const cross=(a:V3,b:V3):V3=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const scale=(v:V3,s:number):V3=>({x:v.x*s,y:v.y*s,z:v.z*s});
const length=(v:V3)=>Math.hypot(v.x,v.y,v.z);

/** CPed's constructor: m_fMass 70, m_fTurnMass 100, m_fElasticity 0.05. */
export const PED_MASS=70,PED_ELASTICITY=.05;
/** ApplyCollision's fThisMassFactor when the other entity has bDisableTurnForce. */
export const VEHICLE_MASS_FACTOR_AGAINST_PED=10;
/** Authored: the ped impact intensity (mass x units per frame) above which the
 * kill task runs. KillPedWithCar is a retail stub, so the retail gate is unknown.
 * 12 is about 8 m/s of closing speed on a 70 kg ped. */
export const PED_CAR_KILL_INTENSITY=12;
/** Authored: the gate for a two-wheeler. With the same 12 a BMX near its top speed (11 m/s) and a motorbike at 9 m/s
 * killed every ped they touched; SA's riders knock peds flat, and only a fast motorbike kills. Twice the car's gate,
 * about 17 m/s of closing speed: a BMX never reaches it. */
export const PED_BIKE_KILL_INTENSITY=24;

export interface VehicleAtContact {mass:number;turnMass:number;elasticity:number;
 /** Contact point relative to the vehicle's centre of mass. */
 offset:V3;moveSpeed:V3;turnSpeed:V3;hitWall?:boolean}
export interface PedCarImpact {
 /** thisDamageIntensity and entityDamageIntensity. */
 vehicleIntensity:number;pedIntensity:number;
 /** ApplyForce on the vehicle at `offset` and ApplyMoveForce on the ped. */
 vehicleForce:V3;pedForce:V3;
}

/** `normal` points from the ped towards the vehicle. Undefined when they separate. */
export function carHitsPed(vehicle:VehicleAtContact,pedMoveSpeed:V3,normal:V3,pedElasticity=PED_ELASTICITY,pedMass=PED_MASS):PedCarImpact|undefined{
 const f=VEHICLE_MASS_FACTOR_AGAINST_PED,{offset,turnSpeed}=vehicle;
 const pointSpeed={x:vehicle.moveSpeed.x+turnSpeed.y*offset.z-turnSpeed.z*offset.y,y:vehicle.moveSpeed.y+turnSpeed.z*offset.x-turnSpeed.x*offset.z,z:vehicle.moveSpeed.z+turnSpeed.x*offset.y-turnSpeed.y*offset.x};
 const vThis=dot(pointSpeed,normal),vPed=dot(pedMoveSpeed,normal);
 const arm=cross(offset,normal),thisMass=1/(dot(arm,arm)/(f*vehicle.turnMass)+1/(f*vehicle.mass));
 const common=(pedMass*vPed+thisMass*vThis)/(pedMass+thisMass),difference=vThis-common;
 if(difference>=0)return undefined;
 const e=(pedElasticity+vehicle.elasticity)*.5;
 const thisAfter=vehicle.hitWall?common:common-e*difference,pedAfter=common-(vPed-common)*e;
 const vehicleIntensity=(thisAfter-vThis)*thisMass,pedIntensity=-((pedAfter-vPed)*pedMass);
 const vehicleForce=scale(normal,vehicleIntensity/f);if(vehicleForce.z<0)vehicleForce.z=0;
 const pedForce=scale(normal,-pedIntensity);
 if(pedForce.z<0){
  pedForce.z=0;
  if(Math.abs(vThis)<.01){pedForce.x*=.5;pedForce.y*=.5;}
 }
 return {vehicleIntensity,pedIntensity,vehicleForce,pedForce};
}

/** eDirection as CEventDamage stores it: 0 front, 1 left, 2 back, 3 right. */
export type PedHitSide=0|1|2|3;
export interface KillPedWithCarInput {
 carPosition:V3;right:V3;forward:V3;up:V3;
 /** The vehicle collision model's bounding box. */
 boundsMin:V3;boundsMax:V3;
 carMoveSpeed:V3;carMass:number;
 pedPosition:V3;
 /** CPedGeometryAnalyser::ComputePedHitSide(ped, car): still a retail stub, so the
  * caller derives it from the car's speed in the ped's frame. */
 pedHitSide:PedHitSide;
}
export interface KillPedWithCarResult {
 weapon:number;pedPiece:number;direction:PedHitSide;
 /** The ped's new move speed, units per frame. */
 pedMoveSpeed:V3;
 /** bKnockedUpIntoAir: thrown up onto the bonnet. */
 knockedUpIntoAir:boolean;
 /** AE_PED_CRUNCH on the vehicle audio (with CLocalisation::KnockDownPeds). */
 crunch:boolean;
 /** The ped landed on the bonnet: DamageCarBonnet may tear an open bonnet off. */
 onBonnet:boolean;
 /** ApplyMoveForce on the vehicle. */
 vehicleForce:V3;
 /** CEventDamage's damage from CPedDamageResponseCalculator. */
 damage:number;
}

/** CTaskSimpleKillPedWithCar::ProcessPed (0x6564A0). */
export function killPedWithCarTask(o:KillPedWithCarInput):KillPedWithCarResult{
 const goingForward=dot(o.forward,o.carMoveSpeed)>=0;
 const pedToCar={x:o.pedPosition.x-o.carPosition.x,y:o.pedPosition.y-o.carPosition.y,z:o.pedPosition.z-o.carPosition.z};
 // "Ped's position in the car's object space". The reversed code calls TransformPoint,
 // which would map it into world space; the comparisons against the bounding box need
 // the object-space coordinates, so the inverse rotation is used.
 const local={x:dot(pedToCar,o.right),y:dot(pedToCar,o.forward),z:dot(pedToCar,o.up)};
 let direction=o.pedHitSide,weapon:number=WEAPON.rammedByCar,pedMoveSpeed:V3={x:0,y:0,z:0},crunch=false,onBonnet=false;
 let side:'left'|'right'|'back';
 const runOver=()=>{
  pedMoveSpeed={x:o.carMoveSpeed.x*.9,y:o.carMoveSpeed.y*.9,z:0};crunch=true;
  if(direction===1||direction===3)direction=0;
 };
 if(Math.abs(local.x)>o.boundsMax.x*.99){
  side=local.x<0?'left':'right';
  if(Math.abs(local.y)<Math.abs((goingForward?o.boundsMax.y:o.boundsMin.y)*.85)){weapon=WEAPON.runOverByCar;runOver();}
 }else if(local.z>.1){
  side='back';onBonnet=true;
  const speed=length(o.carMoveSpeed);
  const apply=(x:number,w:number)=>{const t=(x-o.pedPosition.z)/(w/speed);pedMoveSpeed=speed>0?scale(o.carMoveSpeed,t/speed):{x:0,y:0,z:0};};
  const b=o.boundsMin,B=o.boundsMax;
  if(o.forward.z<=-.2)apply(b.y*o.forward.z+B.x*o.up.z+o.carPosition.z,goingForward?B.y-b.y:-b.y);
  else if(o.forward.z>=.1)apply(B.y*o.forward.z+B.z*o.up.z+o.carPosition.z,B.y<=0?B.y-b.y:B.y);
  else apply(B.z*o.up.z+o.carPosition.z,goingForward?B.y:-b.y);
 }else{side='back';runOver();}
 const pedPiece=side==='left'?PED_PIECE.leftArm:side==='right'?PED_PIECE.rightArm:PED_PIECE.ass;
 const distance=length(pedToCar)||1,push=Math.min(1,o.carMass/1400)*-100/distance;
 return {weapon,pedPiece,direction,pedMoveSpeed,knockedUpIntoAir:side==='back',crunch,onBonnet,vehicleForce:scale(pedToCar,push),damage:1000};
}

/** The player struck by a vehicle. The player never takes the kill task:
 * CPhysical::ProcessCollisionSectorList calls KillPedWithCar on the player only when it is
 * stuck and the vehicle moves faster than 0.05 units per frame. Otherwise the collision
 * raises CEventVehicleCollision, answered by CEventHandler::ComputeVehicleCollisionResponse
 * (Events/EventHandler.cpp, 0x4BD6A0):
 * - vehicle at 0.5 units per frame or more: CTaskComplexHitPedWithCar with the impact
 *   intensity, reduced by the player's own forward walk into the car and capped at 20;
 * - otherwise, on the ground: a look at the car while moving or when it has no driver,
 *   else AnnoyPlayerPed and, holding a fist, knuckles, golf club or knife, a shaken fist;
 * - otherwise, in the air: CTaskComplexHitPedWithCar with the raw intensity.
 * Both KillPedWithCar (0x5F0360) and the hit task's CreateFirstSubTask and HitHurtsPed are
 * retail stubs; see PLAYER_CAR_HURT_INTENSITY for what the browser does with them. */
export interface PlayerCarCollision {
 /** Vehicle move speed squared, in units per frame. */
 carSpeedSq:number;
 /** The player's impact intensity from carHitsPed. */
 intensity:number;
 /** CEntity::m_bIsStuck: the player could not be moved out of the way. */
 stuck:boolean;standing:boolean;inAir:boolean;
 /** (forward x m_vecAnimMovingShiftLocal.y) . impact normal, in units per frame. */
 forwardImpactDot:number;
 /** CPlayerData::m_fMoveBlendRatio. */
 moveBlendRatio:number;
 hasDriver:boolean;
 /** Unarmed, brass knuckles, golf club or knife. */
 fistWeapon:boolean;
 pedMass?:number;
}
export type PlayerCarResponse={killWithCar?:number;
 event:{kind:'hit';intensity:number}|{kind:'look'}|{kind:'shakeFist'}|{kind:'annoy'}|{kind:'none'}};
export function playerVehicleCollision(o:PlayerCarCollision):PlayerCarResponse{
 const out:PlayerCarResponse={event:{kind:'none'}};
 if(o.stuck&&o.carSpeedSq>.0025)out.killWithCar=o.intensity;
 if(o.carSpeedSq>=.5*.5){
  let intensity=o.intensity;
  if(o.standing&&o.forwardImpactDot<0)intensity=Math.max(0,o.forwardImpactDot*(o.pedMass??PED_MASS)+intensity);
  out.event={kind:'hit',intensity:Math.min(20,intensity)};
 }else if(!o.inAir){
  if(o.moveBlendRatio!==0||!o.hasDriver)out.event={kind:'look'};
  else out.event={kind:o.fistWeapon?'shakeFist':'annoy'};
 }else if(o.carSpeedSq>=.001*.001)out.event={kind:'hit',intensity:o.intensity};
 return out;
}
/** What the browser does for the retail stubs. From the Vice City ancestor of
 * CPed::KillPedWithCar (reVC, PedFight.cpp): a player takes the non-lethal branch above an
 * impulse of 10, falling with the high-impact animation away from the car and losing 30
 * health to WEAPON_RAMMEDBYCAR, while the car gets ApplyMoveForce(-60 x min(1, mass / 1400))
 * along the line to the player. The same outcome stands in for CTaskComplexHitPedWithCar. */
export const PLAYER_CAR_HURT_INTENSITY=10,PLAYER_CAR_DAMAGE=30,PLAYER_CAR_PUSH_BACK=60;
