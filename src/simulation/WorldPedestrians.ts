import {deadPedWeaponDrops} from './WeaponDrops';
import {GROUP_TELEPORT_OFFSETS} from './groupFormation';
import { CHEATS, megaPunchBlow } from './nativeCheats';
import {GangPedRoster,ZonePedRoster,type PedZoneGroups} from './nativePedRoster';
import {newPedTypeOrder,gangToCreateMembersOf,type PopulationTargets} from '../assets/populationCycle';
import type {WorldAttractor} from './nativeScene';
import {PED_ATTRACTOR} from '../assets/twoDEffect';
import {AttractorQueue,attractorHeading} from './nativeAttractors';
import {startLookAt,stepLookAt,shouldStartLookAt,lookAtDurationMs,LOOK_AT_RANGE,type LookAtTask} from './nativeIkLookAt';
import {NATIVE_JUMP_GRAVITY,NATIVE_PED_AIR_RESISTANCE} from './nativePlayerLocomotion';
import {landingDamage} from './health';
import {deadPedDecisionTask} from '../ped/nativeDeadPedDecision';
import {gangMemberArmed,randomGangWeapon} from './nativeGangWeapons';
import {draggedOutDecisionTask} from '../ped/nativeJackedDecision';
/** The attractor types the street uses: ATMs, seats, bus stops, pizza counters, shop windows (LOOK_AT) and steps. */
const ATTRACTOR_TYPES=new Set<number>([PED_ATTRACTOR.atm,PED_ATTRACTOR.seat,PED_ATTRACTOR.stop,PED_ATTRACTOR.pizza,PED_ATTRACTOR.shelter,PED_ATTRACTOR.lookAt,PED_ATTRACTOR.step]);
import {SpecificDrivers} from './nativeCarDrivers';
import {deadPedMoney,pedMoneyCount} from './MoneyDrops';
import {stepNpcGun,npcAimSpread,type NpcGunState} from '../weapons/gunnery';
import type {DamageKind} from '../weapons/WeaponSystem';
import {WALK_ROUND_PAD,walkRoundCar} from '../ped/nativeWalkRoundCar';
import {followersToRemove} from '../ped/nativePedGroup';
import {FOLLOW_NODE_POINT_RADIUS,FOLLOW_NODE_SLOW_DOWN_DISTANCE,FOLLOW_NODE_TARGET_TOLERANCE,planFollowNodeRoute} from './nativeFollowNodeRoute';
import {GO_STRAIGHT_MOVE_STATE_RADIUS,achieveHeadingStep,goToPointArrived,goToPointMoveState,nextRoutePoint,type ScriptedPedOrder} from './nativeScriptedPedTasks';
import {ACQUAINTANCE_DISLIKE,ACQUAINTANCE_HATE,ACQUAINTANCE_IGNORE,ACQUAINTANCE_LIKE,ACQUAINTANCE_RESPECT,NATIVE_PED_TYPES,NativeAcquaintance,nativePedType} from '../ped/nativeAcquaintance';
import {characterMovement} from './characterMovement';
import {ANIM_ID,NATIVE_DAMAGE_CLIPS,PED_PIECE,PEDMOVE,WEAPON,browserLocalDirection,computeDamageEventAnim,computeDeathAnim,type DamageAnimResult} from '../combat/nativeDamageAnim';
import {CANNON_PUSH_RANGE2,waterCannonPedSpeed} from './nativeWaterCannon';
import {PED_ORIGIN_HEIGHT,pedFloatDepth} from './nativeSwim';
import {PED_CAR_KILL_INTENSITY,PED_MASS,carHitsPed,killPedWithCarTask} from '../combat/nativeCarPedHit';
import {VEHICLE_ELASTICITY} from './nativeObjectDamage';
import {PED_SOLVER_GROUPS} from './solverGroups';
import {getUpClip,getUpBlockedBy,isFrontClip,GET_UP_CLEAR_RADIUS} from '../ped/nativeGetUp';
import {gangAbuseContext,stareInRange,stareStandSeconds,stareTalkClip,stareTimeoutSeconds,stepStare,type StareState} from '../ped/nativeStareAtPed';
import {WindowsCrtRandom} from '../core/WindowsCrtRandom';
import {playerCollisionWithPedResponse} from '../ped/nativePlayerBump';
import { NATIVE_UNARMED_STAGES, NATIVE_UNARMED_RANGE, NATIVE_MELEE_COMBOS, MELEE_SWING_CLIPS, attackLineDistance, fightingStyleCombo, meleeAttackFalls } from './nativeMelee';
import { nextChainIndex, resolveStrike, chainCooldown, inStrikeCone } from '../combat/meleeChain';
import { decideDamageResponse, applyDamageResponse, PedTaskAdapter } from '../ped/brain';
import { playerPunchDamage, scaleBlow, npcPunchDamage } from '../ped/damage';
import {ARREST_DOWN_TIME,copCanArrest,policePursuitWeapon,type CopWeapon} from '../police/nativeArrest';
import {ReactToGunAimedAt,GANG_SEEING_RANGE,gunAimedAtAffects,gunAimedAtResponse} from '../ped/nativeGunAimedAt';
import {EVENT,RELATIONSHIP,TASK,isKillTaskAppropriate,makeDecision,sourceRelationship,takesPriorityOverCurrentEvent,type DecisionMaker,type Relationship} from '../ped/nativeDecisionMaker';
import {potentialGetRunOver,vehiclePotentialCollisionResponse,type GetRunOverVehicle} from '../ped/nativeGetRunOver';
import {deadPedTyreBlood} from './nativeTyreBlood';
import {bulletTyreHit,pushShotVehicle} from '../weapons/bulletVehicle';
import {findNextNodeWandering,wanderSector,wanderStep,wanderTargetOffset} from '../ped/nativeWander';
import {TRAFFIC_LIGHT,nativeTrafficLights} from '../world/nativeTrafficLights';
import { onscreenSpawnBand, offscreenSpawnBand, pedCreationDistMultiplier, gangPartySize, gangFormationOffset, gangHostile, separationPush, maxGroupMembers, PED_SEEING_RANGE, TURF_KILL_THREATS_CHANCE, gangPedType } from './nativePopulation';
import RAPIER from '@dimforge/rapier3d-compat';
import {Quaternion,Vector3,type Scene} from 'three';
import {modelObject} from '../assets/ModelObjects';
import type {WantedSystem} from './WantedSystem';
import {CRIME} from './nativeWanted';
import {NativeCharacter} from '../render/NativeCharacter';
import {openWorldPedestrians} from '../assets/worldPedestrians';
import type {PathNode} from '../assets/pathNodes';
import type {Simulation} from './Simulation';
import type {WorldCar} from './WorldCar';
/** A vehicle the ped strike pass tests: a car, or a bike, which CPhysical::ApplyCollision treats alike. */
type PedStriker={body:RAPIER.RigidBody;nativeBody:WorldCar['nativeBody'];occupied:boolean;boundRadius?:number;car?:WorldCar};

type Catalog=Awaited<ReturnType<typeof openWorldPedestrians>>;
/** The weapons that choke (WEAPON_SPRAYCAN, WEAPON_EXTINGUISHER, WEAPON_TEARGAS). */
const CHOKING_WEAPONS=new Set([41,42,17]);
/** The Grove Street Families' gang index, PED_TYPE_GANG2. */
const GANG_GROVE=1;
/** eTaskType TASK_COMPLEX_AVOID_OTHER_PED_WHILE_WANDERING. */
const TASK_AVOID_OTHER_PED_WHILE_WANDERING=917;
const PED_VEHICLE_PROBE = new RAPIER.Capsule(.6,.42);
/** CEventGunShot::AffectsPed's hearing range for game peds. */
export const GUN_SHOT_SENSE_RANGE=45;
const PED_STAND_PROBE = new RAPIER.Capsule(.6,.3);
/** CPedPlacement::IsPositionClearOfCars: the sphere at the ped's origin a car must be clear of before the get-up. */
const GET_UP_PROBE=new RAPIER.Ball(GET_UP_CLEAR_RADIUS),NO_ROTATION={x:0,y:0,z:0,w:1};
/** The attacker's CTaskSimpleFight move, with its combo group's victim clips (FIGHT_HIT_1..3). */
export interface MeleeFight {move:number;group?:string;hits?:readonly import('../assets/ifp').NativeAnimation[]}
export interface Pedestrian {
 /** peds.ide ped type. */
 pedType?:string;
 /** CTaskComplexAvoidOtherPedWhileWandering: the ped in the way, the detour point, its time and any stand-still left. */
 avoid?:{ped:Pedestrian;detour:{x:number;z:number};time:number;stand:number};
 /** The attractor scan's countdown, the attractors already rolled, and whether the head-look is one. */
 attractScan:number;attractorsTried:Set<string>;lookAtAttractor?:boolean;
 /** CTaskComplexWander::m_bAllNodesBlocked. */
 allNodesBlocked?:boolean;
 /** The eWeaponType a script gave the ped with GIVE_WEAPON_TO_CHAR, which it can ask after at once even while
  * the held model is still loading, and CWeapon::m_TotalAmmo for it. Ammo a script did not set is not counted:
  * the browser's own armed peds, a police unit's above all, reload without end as the original's do. */
 weaponType?:number;totalAmmo?:number;
 /** physicalFlags.bDontApplySpeed, which FREEZE_CHAR_POSITION sets: the ped keeps its place. */
 frozen?:boolean;
 /** bNeverEverTargetThisPed, which SET_CHAR_NEVER_TARGETTED sets: the player's lock-on passes it by. */
 neverTargeted?:boolean;
 /** CEntity::m_nAreaCode, which SET_CHAR_AREA_VISIBLE sets: the ped is drawn only in the area it belongs to.
  * A ped with no area of its own belongs wherever it stands, as a street ped does. */
 areaCode?:number;
 /** SET_CHAR_VISIBLE cleared, which is CEntity::bIsVisible inverted. */
 hidden?:boolean;
 /** CPed::bIsTalking and the gate SHUT_CHAR_UP_FOR_SCRIPTED_SPEECH sets, with the seconds of facial talk a
  * script started. The depot carries no speech banks, so nothing in this browser speaks or moves a jaw: these
  * are the CPed bits the commands set, held so a script that gates and ungates speech keeps running. */
 shutUp?:boolean;facialTalk?:number;
 /** CPed::m_pLastEntityDamage: whoever last hurt this ped — the player, another ped, or a car that hit it. */
 lastDamagedBy?:{player?:true;ped?:Pedestrian;car?:WorldCar};
 /** CPed::bDoesntListenToPlayerGroupCommands (LISTEN_TO_PLAYER_GROUP_COMMANDS off): the player's dismissal passes it by. */
 ignoresGroupCommands?:boolean;
 /** CPed::m_nLastWeaponDamage: the weapon of the last hit that took health, -1 until one has. */
 lastWeaponDamage?:number;
 /** The weapon hidden for a scripted cutscene, which is the held model taken out of sight rather than away. */
 weaponHidden?:boolean;
 /** bNoCriticalHits inverted, which SET_CHAR_SUFFERS_CRITICAL_HITS sets: the player's point-blank shot deals
  * its ordinary damage rather than the hundred and fifty CWeapon::FireInstantHit gives it. */
 noCriticalHits?:boolean;
 /** The CPed bits SET_CHAR_* commands set, each held the way the command gives it rather than inverted:
  * whether the ped may duck, stays in a car being jacked, drops its weapons when it dies, gets out of a car
  * that has landed upside down, bleeds, drowns in water and may be told to leave the player's group. */
 flags?:{notAllowedToDuck?:boolean;stayInCarOnJack?:boolean;doesntDropWeaponsWhenDead?:boolean;targetPriority?:boolean;stayOnBike?:boolean;
  getOutUpsideDownCar?:boolean;bleeding?:boolean;drownsInWater?:boolean;neverLeavesGroup?:boolean;
  canBeShotInVehicle?:boolean;cantBeDraggedOut?:boolean;loadsCollision?:boolean;kindaStayInSamePlace?:boolean;deathPickupsPersist?:boolean;
  /** bUpperBodyDamageAnimsOnly (SET_CHAR_USES_UPPERBODY_DAMAGE_ANIMS_ONLY): ComputeDamageAnim keeps it on its feet. */
  upperBodyDamageAnimsOnly?:boolean};
 /** CPed::m_nWeaponSkill, and whether the ped has used an entry-exit, which the script sets on it. */
 weaponSkill?:number;usedEntryExit?:boolean;
 /** The ranges a script sets on a ped: how far it tells respected friends about what it sees, how near a path
  * node counts as reached, and how far it senses. */
 ranges?:{informFriends?:number;followNodeThreshold?:number;sense?:number};
 /** CPed::m_acquaintance once a script has changed it: how this ped regards each ped type, which outranks the
  * ped.dat table its own type came with. */
 acquaintance?:NativeAcquaintance;
 /** CPhysical::physicalFlags, as SET_CHAR_PROOFS grants them: damage of a kind the ped is proof against
  * never reaches its health, which CPhysical's damage-response routine decides by the weapon's class. */
 proofs?:{bullet:boolean;fire:boolean;explosion:boolean;collision:boolean;melee:boolean};
 /** physicalFlags.bInvulnerable, which SET_CHAR_ONLY_DAMAGED_BY_PLAYER sets: CEventDamage::AffectsPed turns away
  * everyone else's damage but drowning and blasts (npcDamageReaches). */
 onlyDamagedByPlayer?:boolean;
 /** What a script's task is asking of this ped right now, for the two orders that take time: standing still
  * until the task's own time runs out, and turning to a heading at CTaskSimpleAchieveHeading's half rate until
  * it is within that task's tolerance. A browser yaw in radians; seconds for the stand. */
 order?:{kind:'standStill';remaining:number;
  /** The looped CTaskSimpleStandStill CPed's constructor makes the default task: what a script's ped does with no
   * task of the script's own, which GET_SCRIPT_TASK_STATUS does not count as one. */
  isDefault?:boolean}|{kind:'achieveHeading';heading:number}
  /** CTaskComplexGoToPointAndStandStill(Timed): a renderer point, with its origin height (undefined for a point the
   * script put on the ground), eMoveState and radii, and the seconds left of a timed task (Infinity otherwise). */
  |{kind:'goToPoint';x:number;z:number;y?:number;moveState:number;radius:number;moveStateRadius:number;remaining:number}
  /** CTaskComplexKillPedOnFoot: the retaliation combat held on a foe (undefined for the player) until it dies. */
  |{kind:'killPed';foe?:Pedestrian;remaining:number}
  /** CTaskSimpleRunNamedAnim: the clip (by its lower-case name) once its block has loaded, and how long it has run. */
  |{kind:'playAnim';clip:string;loop:boolean;hold:boolean;release:boolean;remaining:number;started:boolean;elapsed:number}
  /** CTaskComplexEnterCar(…Timed): the car's script handle and seat, the time left before the ped is set in the seat,
   * and CTaskComplexGoToCarDoorAndStandStill's 30 s of seeking the door. */
  |{kind:'enterCar';vehicle:number;seat:'driver'|number;remaining:number;seek:number;moveState:number}
  /** CTaskComplexFollowPointRoute over renderer points (x, z, and the origin height y). */
  |{kind:'followRoute';points:{x:number;y:number;z:number}[];at:number;mode:number;traversals:number;moveState:number}
  /** CTaskComplexSeekEntity after a ped (undefined for the player), to within the radius. */
  |{kind:'gotoPed';target?:Pedestrian;radius:number;remaining:number;offset?:{radius:number;angle:number}}
  /** TASK_DIVE_AND_GET_UP: over when the evasive dive it started is. */
  |{kind:'dive'}
  /** CTaskSimpleDuck for its time: ducked where it stands. */
  |{kind:'duckFor';remaining:number}
  /** CTaskSimpleGunControl: a renderer point or a ped (the player when neither) to aim at, firing or not. */
  |{kind:'gunAt';point?:{x:number;y:number;z:number};target?:Pedestrian;player:boolean;fire:boolean;remaining:number}
  /** CTaskComplexGoToPointShooting: the go-to point (renderer, with the origin height) and the ped fired at. */
  |{kind:'goToPointShooting';x:number;z:number;y?:number;moveState:number;radius:number;target?:Pedestrian;player:boolean}
  /** CTaskComplexDestroyCar on a script car: armed or melee, and the subtask it is in. `seek` is CTaskComplexSeekEntity;
   * `attack` is CTaskSimpleGunControl (for `remaining` seconds) or CTaskSimpleFightingControl; `first` is before
   * CreateFirstSubTask has looked at the range. */
  |{kind:'destroyCar';vehicle:number;melee:boolean;phase:'first'|'seek'|'attack';remaining:number;
   /** While fighting: the point of the car's collision nearest the ped, which the fists aim at. */
   face?:{x:number;z:number}}
  /** The points in the renderer's terms, the target (its origin height) last when `lastIsTarget`. */
  /** CTaskComplexChat: `partner` is nothing for the player, who never holds a chat task. */
  |{kind:'chat';partner?:Pedestrian;chatter:boolean;stage:number;finished:boolean;noChat:number;remaining:number}
  |{kind:'followNodeRoute';target:{x:number;y:number;z:number};points:{x:number;y:number;z:number}[];at:number;lastIsTarget:boolean;moveState:number;remaining:number};
 /** A script's TASK_WANDER_STANDARD is the ped's primary task, which no default stand takes over from. */
 scriptWanders?:boolean;
 /** CTaskSimpleTogglePedThreatScanner's three switches, kept on the ped (its threat scan is not modelled). */
 threatScanner?:{onFoot:boolean;inCar:boolean;duringScriptTask:boolean};
 /** The clip a finished TASK_PLAY_ANIM left held on its last frame (ANIMATION_FREEZE_LAST_FRAME). */
 heldScriptClip?:string;
 /** CTaskComplexSequence: the tasks a script queued, the index of the one running, and whether the whole
  * sequence starts again when the last one ends. The original's array holds eight. */
 sequence?:{orders:ScriptedPedOrder[];at:number;repeat:boolean;
  /** A PERFORM_SEQUENCE_TASK sequence, rather than one task given alone. */
  sequence:boolean};
 /** ePedCreatedBy::PED_MISSION: a ped a script made, which CPed::CanBeDeleted refuses to let the population
  * manager remove until CTheScripts::CleanUpThisPed hands it back. */
 mission?:boolean;
 /** CPed::m_nFightingStyle and m_nAllowedAttackMoves, which GIVE_MELEE_ATTACK_TO_CHAR sets on a script's ped. */
 fightingStyle?:number;allowedAttackMoves?:number;
 /** bMoneyHasBeenGivenByScript: SET_CHAR_MONEY set m_nMoneyCount, which a script's ped then drops when it dies. */
 moneyByScript?:boolean;
 /** CTaskComplexWander's direction in eighths of a turn, and CPed::m_nRandomSeed. */
 wanderDir:number;seed:number;
 /** Seconds left of CTaskSimpleScratchHead (XPRESSscratch) after the wander got stuck. */
 scratch:number;
 /** CTaskComplexKillPedOnFootMelee's water sequence: seconds left of the fist shake and the 2 s stand after it. */
 taunt?:number;
 /** Where the walker last moved a quarter unit from, and the seconds since (m_AnotherStaticCounter). */
 stuck?:{x:number;z:number;seconds:number};
 /** Before a link that crosses a road: CTaskComplexCrossRoadLookAndAchieveHeading, or with a pedestrian light
  * CTaskComplexObserveTrafficLightsAndAchieveHeading. */
 crossing?:{heading:number;lights:boolean;phase:'heading'|'anim'|'stand';time:number;standFor:number};
 /** m_nMoneyCount. */
 money:number;
 id:number;deadTime:number; officer:boolean;arrest:number;
 /** CTaskComplexWanderCop's retry time (this.clock) after a pursuit it could not take up. */
 pursuitRetry?:number;gun?:ReturnType<typeof modelObject>; health:number; actor:Pick<Simulation,'player'>; body:RAPIER.RigidBody; collider:RAPIER.Collider;
 controller:RAPIER.KinematicCharacterController; view:NativeCharacter; target:PathNode; previousNode?:PathNode;
 /** The decision maker's answer to the last ped this one was about to walk into (event 13). */
 walkIntoDecision?:{ped:Pedestrian;avoid:boolean};
 weapon?:NonNullable<Catalog['weapon']>;gunState?:NpcGunState;aimPoint?:{x:number;y:number;z:number};flash:number;
 /** CCopPed shooting accuracy (street 60, SWAT 68, FBI 76, army 84). */
 gunAccuracy:number;
 /** CPed::m_nWeaponShootingRate: 40, or the CCopPed type's (30 city, 70 SWAT, 60 FBI, 80 army). */
 shootingRate?:number;
 /** CTaskComplexKillPedOnFootArmed: whether the gun-control subtask runs, and the clock of its last attack. */
 gunFight?:{shooting:boolean;lastAttack:number};
 down:number; flee:number;fleeFrom?:{x:number;z:number};
 /** The clock at which this ped last started a stare, so one approach does not restart it every frame. */
 staredAt?:number;
 /** The clip the ped fell with (its ANIMATION_IS_FRONT flag picks the get-up) and CPed::bStuckUnderCar. */
 fallClip?:string;stuckUnderCar?:boolean; impulse:{x:number;z:number}; blocked:number;
 /** CTaskComplexSmartFleeEntity from the player (or `from`, another ped): the safe distance and the seconds to the next
  * position check. */
 /** CTaskComplexSmartFleeEntity: `from` a ped, `point` a stopped car, else the player; `safe` ends the flight. */
 fleePlayer?:{safe:number;check:number;from?:Pedestrian;point?:{x:number;z:number};entity?:()=>{x:number;z:number}|undefined};
 /** CEventHandlerHistory's current event while the ped answers it: its type, its source ped (the player when
  * undefined) and, for damage, the weapon. */
 event?:{type:number;source?:Pedestrian;weapon?:number};
 /** Seconds into CTaskSimpleStealthKill as the victim. */
 stealth?:number;
 /** Street brawl: counts down while this ped fights the player back (EVENT_DAMAGE). */
 retaliate:number;retaliateCooldown:number;
 /** The player came into this gang member's view (it rolls its group's answer once a sighting), and the group set on
  * him (CTaskAllocatorKillThreatsBasic). */
 turfSighted?:boolean;turfFoe?:boolean;
 /** CGangWars::TellGangMembersTo(false)'s CTaskComplexKillPedOnFoot at the player, handed to the gangsters there at the time. */
 warFoe?:boolean;
  /** A cop who left a police car seat (CPed::m_pVehicle), and the door point it is heading back to. */
  crew?:{unit:object;seat:number;roadblock?:boolean};goTo?:{x:number;z:number;walk:boolean;arrive?:number};
  /** CTaskComplexWanderCop::LookForCriminals' answer: the cop seeks the criminal (CTaskComplexSeekEntity, 30 s). */
  chase?:{target:Pedestrian;seconds:number};
  /** The cop wander's 50 ms ScanForStuff timer, the 30 s wait after a criminal was found, and that criminal. */
  copScan:number;criminalsAt:number;lastCriminal?:Pedestrian;
  /** Nightstick beat-down pacing per officer. */
  meleeCooldown:number;
  /** Gun drop already reported for this death. */
  dropped:boolean;
 /** Variant root-motion speeds (animgrp.dat walkcycle via peds.ide), defaulting to `man`. */
 walkSpeed:number;runSpeed:number;sprintSpeed:number;
 /** pedstats.dat damage multipliers for this ped's stat row (1.0/1.0 ordinary). */
 attackMult:number;defendMult:number;
 /** CTaskComplexPolicePursuit::SetWeapon's pick, the nightstick model, and the BBALLBAT combo swing in progress. */
 copWeapon:CopWeapon;stick?:ReturnType<typeof modelObject>;fight?:{stage:0|1|2;time:number;struck:boolean};
 /** pedstats decision maker, flags and heading change rate (degrees per frame), and CTaskComplexReactToGunAimedAt in progress. */
 decisionMaker:number;statFlags:number;headingChange:number;gunReact?:ReactToGunAimedAt;
 /** pedstats.dat temper: 60+ hotheads trade punches, the rest flee. */
 temper:number;
 /** Hit-reaction stagger: a struck ped reels briefly instead of sprinting on
  * (CTaskSimpleHit tasks own locomotion mid-reaction; 0.5 s authored). */
 stagger:number;
 /** CTaskComplexOnFire: seconds the latest fire damage keeps the task alive, and the pain line cooldown. */
 onFire:number;onFireSpeech:number;
 /** CTaskComplexEvasiveStep / CTaskComplexEvasiveDiveAndGetUp from CEventPotentialGetRunOver. */
 evade?:{kind:'step'|'dive';phase:'turn'|'move'|'lie'|'getup';time:number;heading:number;avoid:{x:number;z:number};/** The vehicle is the player's. */byPlayer?:boolean;
  /** CTaskSimplePause's time on the ground after the dive (TASK_DIVE_AND_GET_UP's), seconds. */lie?:number};
 /** The response's simpler tasks: hands up, a shaken fist or a turn towards the vehicle. */
 carReact?:{clip?:string;time:number;duration:number;face:{x:number;z:number};turned:boolean;fromFarHorn:boolean};
 /** Bump shove cooldown (CEventPlayerCollisionWithPed complain-and-shove). */
 bumpCooldown:number;
 /** Smoothed locomotion speed toward the gait target (CPed velocity easing). */
 gait:number;
 /** pedgrp.dat gang index for turf party members; civilians stay undefined. */
 gang?:number;
 /** Roster reference for re-spawns (ambient index or gang model name). */
 modelRef:number|string;
 /** Recruited Grove crew: shadows the player and shares their enemies. */
 follow:boolean;
 /** Told to stay in position (GROUP_CONTROL_BWD): the member holds this spot until told to follow again. */
 holdPosition?:{x:number;y:number;z:number};
 /** Animation id of the last CEventDamage reaction, for the native re-pick. */
 damageAnimId?:number;
 /** Current enemy for crew and brawlers (undefined means the player). */
 foe?:Pedestrian;
  /** Corner dealers hold their post instead of wandering until spooked. */
  loiter:boolean;
  /** CPed::m_nTimeTillWeNeedThisPed in seconds of the update clock: an off-screen ped past 25 units goes after it. */
  neededUntil:number;
  /** The clump alpha (0 to 255): a new ped fades in 16 a frame, a ped marked `fadeOut` fades 8 a frame and goes at 0. */
  alpha:number;fadeOut:boolean;
  /** CPed::bHasBeenPhotographed, which TakePhotograph sets and HAS_CHAR_BEEN_PHOTOGRAPHED takes. */
  photographed?:boolean;
  /** CPed::bCullExtraFarAway: removed only past 65 units, not 54.5. */
  cullExtraFarAway?:boolean;
  /** CTaskSimpleInAir: off the ground the ped falls under CPhysical::ApplyGravity (0.008 units a frame²) with the
   * ped air resistance; `vz` is the vertical speed (m/s), `minVz` the fastest fall, `clip` the fall clip playing
   * (FALL_glide, then FALL_fall past 0.1 units a frame), `seconds` the time in the air. */
  air?:{vz:number;minVz:number;clip?:'fall_glide'|'fall_fall';seconds:number};
  /** CTaskSimpleLand: the landing clip's remaining seconds (FALL_land, or FALL_collapse after a real fall). */
  landing?:number;
  /** CTaskComplexRoadRage after the driver left his car: turn to face the rammer, then shake a fist (its clip's
   * remaining seconds) before CTaskComplexSeekEntity and the fight. */
  rage?:{phase:'face'|'shake';time:number};
  /** CTaskComplexInvestigateDeadPed: stand a second, run to 2 units from the body, face it, look at it 5 to 7 s,
   * the ROADCROSS gesture, then walk back to where the ped started. */
  investigate?:{phase:'stand'|'go'|'face'|'look'|'shocked'|'back';time:number;body:Pedestrian;start:{x:number;z:number};lookMs:number};
  /** A jacked driver stealing his car back (CEventDraggedOutCar's KILL_PED_ON_FOOT answer): a pause or a fist shake at
   * the jacker, then CTaskComplexStealCar's 10 s run at the car (`time` counts each phase down). */
  stealBack?:{phase:'pause'|'face'|'shake'|'go';time:number;car:{position:()=>{x:number;y:number;z:number}}};
  /** CGangWars' bPartOfAttackWave: a gang war attacker (PED_MISSION, never culled, hostile until released). */
  attackWave?:boolean;
  /** A gang party (CPedGroup): its leader and members; `hangout` on the leader is CTaskComplexGangLeader's subtask
   * (stand 5 s, turn to face a member, or a 0 to 15 s walk that ends the party). */
  party?:{leader:Pedestrian;members:Pedestrian[]};
  hangout?:{phase:'stand'|'face'|'wander';time:number;facing?:Pedestrian};
 /** CTaskComplexStareAtPed: the whole party turns on whoever walks up to its leader. */
 stare?:StareState;
  /** A ped the head look-at follows instead of the player (a fellow gang member). */
  lookTarget?:Pedestrian;
  /** Where the head look-at points instead of the player (a dead ped under investigation). */
  lookAt?:{x:number;y:number;z:number};
    /** CPed::ProcessBuoyancy and CTaskComplexInWater: a street ped in deep water floats at the surface and drowns
   * (the DROWN clip, then death); `until` is the update clock when the clip ends. A drowned body floats higher. */
  drowning?:{until:number};drowned?:boolean;
    /** CTaskSimpleIKLookAt from LookAtInterestingEntities: the head follows the player for 3 to 5 s. */
  look?:LookAtTask;
    /** CTaskComplexUseAttractor: the ped stands at a 2dfx ped attractor (ATM, seat, bus stop, shop window) and runs
   * its use task; `heading` faces the effect's use direction, `phase` is the sub task, `until` its end. */
  attract?:{key:string;type:number;phase:'go'|'wait'|'use'|'sit'|'idle'|'up'|'stand';time:number;until:number;heading:number;
   /** CTaskComplexGoToAttractor: the slot's point (browser space) to walk to, after `startAt` seconds of standing. */
   goal?:{x:number;z:number};slot:number;startAt:number;};
  /** A corner dealer (PED_TYPE_DEALER) for the popcycle's dealer count. */
  dealer:boolean;
  /** 1:1-track brain mirror (src/ped/brain.ts): synced from legacy timers each
   * step; legacy timers stay authoritative until the task cutover completes. */
  brain:PedTaskAdapter;
  /** NPC brawl chain stage (melee.dat jab/cross/hook cycle for cooldown pacing). */
  fightStage:0|1|2;
}
/** Bounded civilian population on native sidewalk links, sharing the physics world. */
/** Native ped locomotion speeds (m/s) from ped.ifp root motion in the verified
 * depot: WALK_civi 1.725m/1.133s = 1.522, RUN_civi 3.156m/0.733s = 4.304,
 * SPRINT_panic 3.542m/0.6s = 5.903. Replaces authored 1.2/3.7/3.8. */
export const NATIVE_PED_WALK_SPEED = 1.522;
export const NATIVE_PED_RUN_SPEED = 4.304;
export const NATIVE_PED_SPRINT_SPEED = 5.903;
/** pedstats.dat STAT_PLAYER row: attack strength 3.0x, defend weakness 0.4x.
 * Ordinary street peds use 1.0/1.0. Applied to player punch damage dealt and
 * damage taken so brawls match the native stat table instead of flat values. */
export const NATIVE_PLAYER_ATTACK_MULT = 3.0;
export const NATIVE_PLAYER_DEFEND_MULT = 0.4;
/** melee.dat UNARMED range re-exported from the native table (targetRange 10.0
 * is the AI acquisition range). The browser punch uses the 1.6 m strike reach. */
export { NATIVE_UNARMED_RANGE } from './nativeMelee';
/** Authored obstacle slide: rotate the desired direction ±65° while blocked so
 * pedestrians slide around obstacles instead of pushing straight into them. */
export function sidestepDirection(dx:number,dz:number,side:1|-1){const a=side*Math.PI*.36,c=Math.cos(a),s=Math.sin(a);return {x:dx*c-dz*s,z:dx*s+dz*c};}
/** CTaskComplexSmartFleeEntity's defaults: 1,000,000 ms to flee, the threat's position read every 1000 ms and taken
 * once it has moved 1 unit. */
const SMART_FLEE_SECONDS=1000,SMART_FLEE_CHECK_SECONDS=1,SMART_FLEE_TOLERANCE=1;
/** How long a decision maker's kill task lasts (authored; CTaskComplexKillPedOnFoot runs until its target dies). */
const KILL_PED_ON_FOOT_SECONDS=10;
/** CTaskComplexRoadRage's CTaskComplexSeekEntityStandard: 20 s after the rammer. */
const ROAD_RAGE_SEEK_SECONDS=20;
/** CTaskComplexWander's CTaskSimpleGoToPoint target radius. */
const WANDER_TARGET_RADIUS=.5;
/** m_AnotherStaticCounter's 30 frames at the PC frame limiter's 30 fps. */
const WANDER_STUCK_SECONDS=1;
/** WEAPON_CANE, the last melee weapon type. */
const WEAPON_LAST_MELEE=15;
/** CTaskSimpleFightingControl's FIGHT_CTRL_MAX_ATTACK_ANGLE_RAD. */
const FIGHT_CTRL_MAX_ATTACK_ANGLE=15*Math.PI/180;
/** CPedDamageResponseCalculator::ComputeWillKillPed (0x4B3210): a blow that leaves under 1 HP kills. */
/** RpAnimBlendClumpGetAssociation by name (any case), then SetSpeed or SetCurrentTime at a fraction of the clip. */
export function setCharacterAnim(view:{readonly reactionName:string|undefined;setReactionSpeed(name:string,speed:number):boolean;setReactionProgress(name:string,fraction:number):boolean},animation:string,change:{speed?:number;progress?:number}){
 const name=view.reactionName;if(!name||name.toLowerCase()!==animation.toLowerCase())return;
 if(change.speed!==undefined)view.setReactionSpeed(name,change.speed);
 if(change.progress!==undefined)view.setReactionProgress(name,change.progress);
}
export const healthAfter=(health:number,damage:number)=>health-damage<1?0:health-damage;
/** CPhysical's damage response by weapon class (0x5426C0): melee, bullet, explosion and fire each have their
 * proof, and a spray can damages whatever it hits. Collision proof belongs to the brass knuckles, golf club
 * and shovel, which this browser counts as melee, so it guards nothing of its own yet. */
/** Whether a street ped's blow or bullet reaches another ped. CEventDamage::AffectsPed: an invulnerable ped
 * (SET_CHAR_ONLY_DAMAGED_BY_PLAYER) takes nothing but drowning and blasts from anyone else while alive; and
 * CWeapon::DoBulletImpact: a bullet leaves a ped of the shooter's own ped type alone unless that is a civilian. */
export function npcDamageReaches(victim:{onlyDamagedByPlayer?:boolean;health:number;pedType?:string},shooter:{pedType?:string},weapon:number,bullet:boolean){
 if(victim.onlyDamagedByPlayer&&weapon!==WEAPON.drowning&&weapon!==WEAPON.explosion&&victim.health>0)return false;
 if(bullet&&shooter.pedType!==undefined&&shooter.pedType===victim.pedType&&victim.pedType!=='CIVMALE'&&victim.pedType!=='CIVFEMALE')return false;
 return true;
}
/** Browser stand-in for the CPedModelInfo hit spheres a bullet meets (the table is retail data): height above the feet
 * picks head, torso, midsection or legs and the side of the ped picks the limb, for a ped at `feet` facing `heading`. */
export function pedPieceAt(feet:{x:number;y:number;z:number},heading:number,point?:{x:number;y:number;z:number}){
 if(!point)return PED_PIECE.torso;
 const height=point.y-feet.y;
 // The ped's left on the browser x/z plane when it faces (sin h, cos h).
 const left=(point.x-feet.x)*Math.cos(heading)-(point.z-feet.z)*Math.sin(heading);
 if(height>=1.45)return PED_PIECE.head;
 if(height>=1)return Math.abs(left)>.22?left>0?PED_PIECE.leftArm:PED_PIECE.rightArm:PED_PIECE.torso;
 if(height>=.85)return PED_PIECE.ass;
 return left>=0?PED_PIECE.leftLeg:PED_PIECE.rightLeg;
}
export const pedProofedAgainst=(p:{proofs?:{bullet:boolean;fire:boolean;explosion:boolean;collision:boolean;melee:boolean}},kind:DamageKind)=>
 kind==='spray'?false:!!p.proofs?.[kind];
/** CCopPed: every cop has 100 health, and CPed::SetArmour gives SWAT 50 and the FBI and army 100. Browser peds have
 * no armour of their own, so a cop's armour is folded into its health. */
export function copHealth(model:string){const m=model.toLowerCase();return 100+(m==='swat'?50:m==='fbi'||m==='army'?100:0);}
/** CAttractorScanner stand-in (unreversed): how far and how often a wanderer looks for attractors. */
const ATTRACTOR_SCAN_RANGE=3,ATTRACTOR_SCAN_SECONDS=1;
/** CTaskComplexEnterCar's CTaskComplexGoToCarDoorAndStandStill: PEDMOVE_RUN, a 0.5 target radius, slowing to a walk
 * inside 4 units, and giving the door up after 30 s of seeking it. */
const ENTER_CAR_DOOR_RADIUS=.5,ENTER_CAR_SLOW_DOWN_DISTANCE=4,ENTER_CAR_SEEK_SECONDS=30;
/** CTaskSimpleGoToPoint's radius in CTaskComplexFollowPointRoute; the seek task's walk inside 2 units of its target
 * (CEntitySeekPosCalculator's move-state radius, taken as the go-to task's). */
const GO_TO_POINT_RADIUS=.5,GO_TO_PED_WALK_DISTANCE=2;
/** CTaskComplexChat's sub-tasks run 999999 ms; its lead speaker gives up after fifty silent frames. */
const CHAT_SECONDS=999.999,CHAT_SILENT_FRAMES=50,CHAT_CLIP='idle_chat';
/** CTaskComplexDestroyCarArmed's CTaskSimpleGunControl lasts 5000 ms. The melee task fights inside the car's bound
 * radius and 0.35, and seeks again once the ped is 0.6 past that. */
const DESTROY_CAR_GUN_SECONDS=5,DESTROY_CAR_MELEE_REACH=.35,DESTROY_CAR_MELEE_SLACK=.6;
/** MAP_Z_LOW_LIMIT: a script point at or below it is on the ground wherever that is. */
const MAP_Z_LOW_LIMIT=-100;
/** CTempColModels::ms_colModelPed1's bounding sphere radius. */
const PED_BOUND_RADIUS=1;
/** Heights above the feet of the stand-in ped hit spheres (see hideNearCamera). */
const HIT_SPHERE_HEIGHTS=[.25,.6,.95,1.3,1.6];
/** What a ped carries into a car and out again as CJ's passenger. */
interface PassengerKeep {weapon:Pedestrian['weapon'];health:number;gang?:number;gangClips:boolean}
export class WorldPedestrians {
 private people:Pedestrian[]=[];
  /** `shooter` is the ped's id and live position (renderer frame), for the ped's own CAEPedWeaponAudioEntity. */
  onShot?:(from:{x:number;y:number;z:number},to:{x:number;y:number;z:number},weapon:number,hit:boolean,shooter?:{id:string;position:()=>{x:number;y:number;z:number}|undefined})=>void;
  /** Landed fist/nightstick blows (combat bank unarmed impact sample). */
  onMeleeHit?:(position:{x:number;y:number;z:number},byPlayer:boolean)=>void;
  /** Dead armed peds drop their gun with leftover rounds (one-shot pickup). */
  onDropWeapon?:(position:{x:number;y:number;z:number},weapon:number,rounds:number,persist?:boolean)=>void;
  /** CPed::CreateDeadPedMoney: the cash a dead ped leaves. */
  /** A script's car by its handle, for CTaskComplexEnterCar: whether it is still there, the renderer point by the
   * door of a seat (a passenger seat of -1 resolves to a free one, or nothing when none is), and setting the ped in. */
  resolveScriptVehicle?:(handle:number)=>{alive():boolean;entity():WorldCar|undefined;seatFor(seat:'driver'|number):'driver'|number|undefined;/** Where the ped gets in from, for a ped at `from` (a bike is got on from its nearer side). */
  doorPoint(seat:'driver'|number,from:{x:number;z:number}):{x:number;y:number;z:number}|undefined;board(ped:Pedestrian,seat:'driver'|number):boolean}|undefined;
  /** The ped (or the player) a script's handle names, for the tasks that target one. */
  resolveScriptPed?:(handle:number)=>Pedestrian|'player'|undefined;
  onDropMoney?:(position:{x:number;y:number;z:number},amount:number)=>void;
 /** A ped killed by player damage (mission kill tracking; NPC-vs-NPC deaths excluded). */
 /** AE_PED_CRUNCH: a ped killed by a fall hits the ground. */
 onCrunch?:(ped:object,position:{x:number;y:number;z:number})=>void;
 onKill?:(victim:{id:number;officer:boolean;gang?:number;pedType?:string;recruit?:boolean;byPlayer:boolean;/** Killed by the player's vehicle. */byPlayerVehicle?:boolean})=>void;
 /** CTaskSimpleKillPedWithCar's AE_PED_CRUNCH on the striking vehicle. */
 onCarCrunch?:(car:WorldCar)=>void;
 /** A car striking a ped: the collision audio's report (car impulse, ped impulse), renderer space. */
 onCarPedCollision?:(car:WorldCar,pedHandle:number,point:{x:number;y:number;z:number},normal:{x:number;y:number;z:number},carImpulse:number,pedImpulse:number)=>void;
 /** CWeather::Rain for the shelter attractors (CTaskComplexWaitForDryWeather). */
 rain?:()=>number;
 /** The prt_smokeII_3_expand puffs CWaterCannon::PushPeds adds around a pushed ped (native position and speed). */
 onWaterCannonSmoke?:(position:{x:number;y:number;z:number},velocity:{x:number;y:number;z:number})=>void;
 /** CWaterCannon::PushPeds and CEventHandler::ComputeWaterCannonResponse: a ped within √5 units of a live section is
  * pushed toward 0.6 of the water's speed (capped at 0.2 a step) and falls (CTaskComplexFallAndGetUp by hit side). */
 waterCannonPush(sections:readonly {point:{x:number;y:number;z:number};speed:{x:number;y:number;z:number}}[]){
  if(!sections.length)return;
  for(const p of this.people){
   if(p.health<=0||p.down>0)continue;
   // CPed::GetPosition is the ped's origin at pelvis height, a unit above the actor's feet.
   const q=p.actor.player.position,pos={x:q.x,y:-q.z,z:q.y+1};
   for(const s of sections){
    const dx=pos.x-s.point.x,dy=pos.y-s.point.y,dz=pos.z-s.point.z;
    if(dx*dx+dy*dy+dz*dz>=CANNON_PUSH_RANGE2)continue;
    const h=p.actor.player.heading,sp=p.actor.player.speed;
    const v=waterCannonPedSpeed({x:(Math.sin(h)*sp+p.impulse.x)/50,y:-(Math.cos(h)*sp+p.impulse.z)/50},s.speed);
    const vx=v.x*50,vz=-v.y*50;
    const clip=(['ko_skid_front','ko_spin_r','ko_skid_back','ko_spin_l'] as const)[browserLocalDirection(h,-s.speed.x,s.speed.y) as 0|1|2|3];
    this.hit(p,vx||1e-6,vz,Math.hypot(vx,vz),clip);
    this.onWaterCannonSmoke?.(pos,{x:v.x*.3,y:v.y*.3,z:0});this.onWaterCannonSmoke?.(pos,{x:-v.x*.3,y:-v.y*.3,z:.5});
    break;
   }
  }
 }
 /** Pain, flee and threat vocals (CAEPedSpeechAudioEntity comments). */
 onPain?:(ped:object,position:{x:number;y:number;z:number})=>void;
 onFlee?:(ped:object,position:{x:number;y:number;z:number})=>void;
 onThreat?:(ped:object,position:{x:number;y:number;z:number})=>void;
 /** CPed::PlayFootSteps for a walking, running or sprinting pedestrian (browser position one unit above the feet, like the player's). */
 onFootstep?:(ped:object,position:{x:number;y:number;z:number},move:'walk'|'run'|'sprint',foot:'left'|'right')=>void;
 playerArmed:()=>boolean=()=>false;
 canSpawn:(point:{x:number;y:number;z:number},radius:number)=>boolean=()=>true;
 private catalog?:Catalog;
 /** The catalog's load, settling on the catalog or on nothing when it failed or the crowd was disposed. */
 private readonly catalogLoad:Promise<Catalog|undefined>;
 private disposed=false;
 private busy=false;
 private nextCheck=0;
 private nextId=0;
 /** CTimer::m_FrameCounter, for the wander's draws. */
 private frame=0;
 /** Seconds since this crowd started, the light clock when no `lightClock` is given. */
 private elapsed=0;
 /** CTimer::m_snTimeInMilliseconds as the traffic lights read it, shared with the traffic (see WorldTraffic.lightMs). */
 lightClock?:()=>number|undefined;
  private cooldown=0;
  private combo=0;
  private lastPunchAt=-10;
  private pendingStrikes:{target:number;heading:number;damage:number;delay:number;ground:boolean;combo:number}[]=[];
  private hits=0;
 /** CGeneral samples for the damage re-pick. A private stream: the engine-wide CRT stream is not shared yet. */
 private damageRandom=new WindowsCrtRandom(1);
 private error?:string;
 constructor(private sim:Simulation,private scene:Scene,base:string,private playerView:()=>NativeCharacter|undefined,private law?:WantedSystem){
  this.catalogLoad=openWorldPedestrians(base,!!law).then(c=>{if(this.disposed)return undefined;this.catalog=c;this.installPlayerReactions();return c;}).catch(e=>{this.error=String(e);return undefined;});
 }
  private reactions(c:Catalog){return {...Object.fromEntries([...new Set(['xpressscratch','gas_cwr','atm','seat_down','seat_idle','seat_up','drown','fall_glide','fall_fall','fall_land','fall_collapse','ko_skid_back','fighta_1','fighta_2','fighta_3','hita_1','hita_2','hita_3','ko_skid_front','getup_front','getup','hit_front','hit_back','hit_l','hit_r','fucku','arrestgun','handsup','handscower','ev_step','ev_dive','getup_front','gun_butt','gun_butt_crouch','hit_gun_butt','car_rollout_lhs','car_rollout_rhs',...NATIVE_DAMAGE_CLIPS])].filter(n=>c.animations[n]).map(n=>[n,c.animations[n]])),...Object.fromEntries(['kill_knife_ped_damage','kill_knife_ped_die','kill_knife_player'].filter(n=>c.stealth[n]).map(n=>[n,c.stealth[n]])),...c.attractorClips};}
 private reactionOwner?:NativeCharacter;
 /** The player uses KILL_Partial as an upper-body partial and KILL_Knife_Player as a full-body clip. */
 installPlayerReactions(){const view=this.playerView(),c=this.catalog;if(!view||!c||view===this.reactionOwner)return;this.reactionOwner=view;view.installReactions(this.reactions(c));if(c.stealth.kill_partial)view.installReactions({kill_partial:c.stealth.kill_partial},true);}
 /** CPedIntelligence::TestForStealthKill(target,false): a standing, unhurried victim within 2.5 m, facing away. */
 /** The player's stealth-kill victim. CPedIntelligence::TestForStealthKill (reversed) rules out a ped that is floored or
  * under 1 HP, running or sprinting, beyond STEALTH_KILL_RANGE 2.5, facing the player, or on a kill task against him.
  * The victim is m_p3rdPersonMouseTarget with the mouse; Compute3rdPersonMouseTarget is a stub, so the candidate
  * nearest the crosshair ray stands in for it (the nearest one without a ray). */
 stealthTarget(origin:{x:number;y:number;z:number},aim?:{origin:{x:number;y:number;z:number};direction:{x:number;y:number;z:number}}){
  if(!this.catalog?.stealth.kill_knife_ped_die)return undefined;
  // TestForStealthKill refuses a ducking target (bIsDucking).
  const candidates=this.people.filter(p=>p.health>=1&&p.down===0&&p.stealth===undefined&&!p.actor.player.crouched&&this.moveState(p)<PEDMOVE.run&&!this.attackingPlayer(p)).map(p=>{const q=p.actor.player.position,dx=q.x-origin.x,dz=q.z-origin.z,dy=q.y-origin.y;return {p,dx,dz,d2:dx*dx+dy*dy+dz*dz};})
   .filter(t=>t.d2<=2.5*2.5&&t.dx*Math.sin(t.p.actor.player.heading)+t.dz*Math.cos(t.p.actor.player.heading)>0);
  const off=(p:Pedestrian)=>{if(!aim)return 0;const q=p.actor.player.position,v={x:q.x-aim.origin.x,y:q.y+1-aim.origin.y,z:q.z-aim.origin.z},l=Math.hypot(v.x,v.y,v.z)||1,dl=Math.hypot(aim.direction.x,aim.direction.y,aim.direction.z)||1;return -(v.x*aim.direction.x+v.y*aim.direction.y+v.z*aim.direction.z)/(l*dl);};
  const t=candidates.sort((a,b)=>off(a.p)-off(b.p)||a.d2-b.d2)[0];
  return t&&{id:t.p.id,officer:t.p.officer,handle:t.p.collider.handle,position:{...t.p.actor.player.position},heading:t.p.actor.player.heading};
 }
 /** A ped on a kill task against the player: brawling with him, or a cop's beat-down or arrest. */
 private attackingPlayer(p:Pedestrian){return p.retaliate>0&&!p.foe||!!p.fight||p.arrest>0;}
 /** A default decision maker as the files load it, for a script's copy. */
 defaultDecisionMaker(index:number){return this.catalog?.decisionMakers[index];}
 /** CDecisionMakerTypes::MakeDecision for a ped on foot by its pedstats decision maker, or undefined when the decision
  * files are not published (the caller keeps its authored answer). */
 private decide(p:Pedestrian,event:number,relationship:Relationship,random=()=>this.damageRandom.next()/32768){
  // A decision maker a script built itself answers before the ones the files carry, which is what wearing it
  // means; CDecisionMakerTypes holds both in the one table.
  const dm=this.scriptDecisionMaker?.(p.decisionMaker)??this.catalog?.decisionMakers[p.decisionMaker];
  return dm&&makeDecision(dm,event,relationship,false,random);
 }
 /** The decision column for an event `source` raised (the player when undefined). The Families respect the player: the
  * script sets that relationship, which ComputeEventSourceType reads (authored; see nativeDecisionMaker). */
 private relationshipTo(p:Pedestrian,source?:Pedestrian){
  // A relationship a script set on this ped answers first: CPed's own acquaintance table is consulted before
  // the one its ped type came with. Respect and like are a friend, dislike and hate a threat, and a type in
  // no list at all falls back to the table from ped.dat.
  const table=p.acquaintance??(p.pedType&&this.editedTypes.has(p.pedType)?this.typeTables.get(p.pedType):undefined);
  const own=table&&nativePedType(source?source.pedType:'PLAYER1');
  if(table&&own!==undefined){
   const id=table.idFor(own);
   if(id===ACQUAINTANCE_RESPECT||id===ACQUAINTANCE_LIKE)return RELATIONSHIP.friend;
   if(id===ACQUAINTANCE_DISLIKE||id===ACQUAINTANCE_HATE)return RELATIONSHIP.threat;
   if(id===ACQUAINTANCE_IGNORE)return RELATIONSHIP.neutral;
  }
  if(!source&&p.gang===1)return RELATIONSHIP.friend;
  return sourceRelationship(this.catalog?.acquaintances,p.pedType,source?source.pedType:'PLAYER');
 }
 /** CEventDamage::AffectsPed for a street ped's blow on the player: none from the player's own group (his recruits)
  * short of an explosion, and none from a Grove Street Families member (PED_TYPE_GANG2) with a grenade or anything
  * above it unless his kill task is on the player. */
 private damagesPlayer(p:Pedestrian,weapon:number){
  if(p.follow&&weapon!==WEAPON.explosion)return false;
  if(p.gang===GANG_GROVE&&weapon>=WEAPON.grenade&&!(p.retaliate>0&&!p.foe))return false;
  return true;
 }
 /** Whether the response to the ped's current event still runs. */
 /** Whether the ped is still carrying out its current event's response: a fight, a flee, the gun-aimed-at reaction,
  * or the evasive step/dive and hands-up of CEventPotentialGetRunOver (priority 51, above an aimed gun's 50). */
 /** CPedGroupMembership::RemoveMember only frees the slot: a member fighting an enemy keeps that kill task (it never
  * turns on the player), and one with no enemy left stops fighting. */
 private leaveGroup(p:Pedestrian){
  p.follow=false;p.holdPosition=undefined;this.rejoinWander(p);
  if(!(p.retaliate>0&&p.foe&&p.foe.health>0&&this.people.includes(p.foe))){p.foe=undefined;p.retaliate=0;p.fight=undefined;}
 }
 /** A fresh CTaskComplexWander resets its nodes and picks the next from where the ped stands (TaskComplexWander.cpp:
  * 124-131, 223-227): a ped let go after following, a script's task or a warp walks on from the nearest node, not
  * toward one left wherever it was taken from. */
 private rejoinWander(p:Pedestrian){
  const q=p.actor.player.position;
  if(Math.hypot(p.target.position[0]-q.x,-p.target.position[1]-q.z)<=20)return;
  const n=this.nearestNode(q);if(n){p.target=n;p.previousNode=undefined;}
 }
 private answering(p:Pedestrian){return p.retaliate>0||p.flee>0||!!p.gunReact||!!p.evade||!!p.carReact;}
 /** Whether an event of `type` from `source` (the player when undefined) displaces the one the ped answers. */
 private takesPriority(p:Pedestrian,type:number,source?:Pedestrian){return takesPriorityOverCurrentEvent(p.event&&this.answering(p)?p.event:undefined,type,source);}
 /** A kill task on `source` (the player when undefined): CTaskComplexKillPedOnFoot's ControlSubTask is a stub, so the
  * ped fights for KILL_PED_ON_FOOT_SECONDS (authored). */
 private killPedOnFoot(p:Pedestrian,source?:Pedestrian){p.retaliate=Math.max(p.retaliate,KILL_PED_ON_FOOT_SECONDS);p.flee=0;p.fleePlayer=undefined;p.foe=source;}
 /** CEventHandler::ComputePersonalityResponseToDamage (0x4BF9B0) for weapon damage from the player. Returns false when
  * the decision files are missing. A ped still answering damage (or a higher event) keeps its answer. Ducking is not
  * modelled, so DUCK answers nothing here. */
 private damageResponse(p:Pedestrian,weapon:number){
  if(p.officer||p.health<=0)return true;
  // ComputeDamageResponse keeps the running CTaskComplexKillPedOnFoot for a repeat of the damage event, and that task
  // never times out: every blow the player lands while the ped fights him renews the authored fight window.
  if(p.event?.type===EVENT.damage&&p.retaliate>0&&!p.foe){p.retaliate=Math.max(p.retaliate,KILL_PED_ON_FOOT_SECONDS);return true;}
  if(!this.takesPriority(p,EVENT.damage))return true;
  const task=this.decide(p,EVENT.damage,this.relationshipTo(p));if(task===undefined)return false;
  p.event={type:EVENT.damage,weapon};
  switch(task){
   case TASK.killPedOnFoot:
    // IsKillTaskAppropriate: melee against melee, or a gun against anything.
    if(isKillTaskAppropriate({createdByMission:!!p.mission,holdsGun:this.holdsGun(p),attackerHoldsGun:weapon>WEAPON_LAST_MELEE}))this.killPedOnFoot(p);else this.fleeFromPlayer(p,60);break;
   // ComputePersonalityResponseToDamage (0x4BFDD7): on foot this is KillPedOnFoot outright, with no appropriateness test.
   case TASK.carDriveMissionKillPed:this.killPedOnFoot(p);break;
   case TASK.killPedOnFootStealth:this.killPedOnFoot(p);break;
   // Says CTX_GLOBAL_RUN_FROM_FIGHT first; the speech banks are not in the depot.
   case TASK.smartFleeEntity:case TASK.fleeEntity:case TASK.fleeAnyMeans:case TASK.carDriveMissionFleeScene:this.fleeFromPlayer(p,60);break;
  }
  return true;
 }
 /** CEventHandler::ComputeShotFiredResponse (0x4BC710) for a ped hearing `shooter` (the player when undefined). Returns
  * false when the decision files are missing. */
 private shotFiredResponse(p:Pedestrian,shooter?:Pedestrian){
  const task=this.decide(p,EVENT.shotFired,this.relationshipTo(p,shooter));if(task===undefined)return false;
  switch(task){
   case TASK.killPedOnFoot:
    if(shooter&&shooter.pedType===p.pedType)break;
    p.event={type:EVENT.shotFired,source:shooter};
    if(isKillTaskAppropriate({createdByMission:!!p.mission,holdsGun:this.holdsGun(p),attackerHoldsGun:true}))this.killPedOnFoot(p,shooter);else this.fleeFromPlayer(p,60,shooter);break;
   // ComputeShotFiredResponse (0x4BCB16): the stealth kill goes for whoever fired, a street ped too.
   case TASK.killPedOnFootStealth:p.event={type:EVENT.shotFired,source:shooter};this.killPedOnFoot(p,shooter);break;
   // 0x4BCA16: a criminal of another ped type who fired is hunted, or fled when the kill is not appropriate; the
   // player is left alone.
   case TASK.killCriminal:
    if(!shooter||shooter.pedType===p.pedType)break;
    p.event={type:EVENT.shotFired,source:shooter};
    if(isKillTaskAppropriate({createdByMission:!!p.mission,holdsGun:this.holdsGun(p),attackerHoldsGun:true}))this.killPedOnFoot(p,shooter);else this.fleeFromPlayer(p,60,shooter);break;
   case TASK.smartFleeEntity:p.event={type:EVENT.shotFired,source:shooter};this.fleeFromPlayer(p,60,shooter);break;
  }
  return true;
 }
 /** CTaskSimpleStealthKill victim: KILL_Knife_Ped_Damage, then KILL_Knife_Ped_Die with death. */
 stealthKill(id:number,attacker:{x:number;z:number}){
  const p=this.people.find(p=>p.id===id);if(!p||p.health<=0||p.down>0)return false;
  const q=p.actor.player.position;p.actor.player.heading=Math.atan2(q.x-attacker.x,q.z-attacker.z);p.stealth=0;p.flee=0;p.impulse={x:0,z:0};p.actor.player.speed=0;
  p.view.playReaction('kill_knife_ped_damage');return true;
 }
 /** Development: stand a living civilian still at a renderer-frame point. Returns its id. */
 debugPlace(point:{x:number;y:number;z:number},heading=0){
  // A ped already fading out would vanish under the test; one still solid is preferred and the fade is cleared.
  const p=this.people.find(p=>!p.officer&&p.health>0&&p.down===0&&!p.fadeOut)??this.people.find(p=>!p.officer&&p.health>0&&p.down===0);if(!p)return undefined;
  p.fadeOut=false;p.actor.player.position={...point};p.actor.player.heading=heading;p.actor.player.speed=0;p.impulse={x:0,z:0};p.flee=0;p.loiter=true;
  p.body.setTranslation({x:point.x,y:point.y+.9,z:point.z},true);p.collider.setTranslation({x:point.x,y:point.y+.9,z:point.z});
  return p.id;
 }
 /** Every pedestrian's position, living or dead, in browser space. */
 positions(){return this.people.map(p=>({...p.actor.player.position}));}
 /** CPedType::PoliceDontCareAboutCrimesAgainstPedType for a `ped:<id>` victim: gangs 1–10, criminals and dealers. */
 /** CGangWars::GangWarFightingGoingOn, which hurries dead bodies away. */
 gangWarFighting?:()=>boolean;
 /** CWeapon::TakePhotograph: every ped whose head the photo catches is marked photographed. */
 markPhotographed(caught:(head:Vector3)=>boolean){for(const p of this.people){const head=p.view.headPosition();if(head&&caught(head))p.photographed=true;}}
 /** CPed::bBeingChasedByPolice: a beat cop is chasing this ped as a criminal; `alive` is !IsStateDying. */
 chasedByPolice(victim:string|undefined){
  const id=victim?.startsWith('ped:')?Number(victim.slice(4)):NaN,ped=this.people.find(p=>p.id===id);
  if(!ped||!this.people.some(p=>p.officer&&p.chase?.target===ped))return undefined;
  return {alive:ped.health>0};
 }
 policeDontCare(victim:string|undefined){
  const id=victim?.startsWith('ped:')?Number(victim.slice(4)):NaN,type=this.people.find(p=>p.id===id)?.pedType;
  return !!type&&(/^GANG([1-9]|10)$/i.test(type)||/^(CRIMINAL|DEALER)$/i.test(type));
 }
 snapshot(){return {ready:!!this.catalog,pending:this.busy,error:this.error??null,hits:this.hits,roster:this.roster?.loaded??[],targets:this.pedTargets?.()??null,zone:this.pedZone?.()??null,gangs:this.gangRoster?Array.from({length:10},(_,g)=>this.gangRoster!.resident(g)):[],playerLook:+(this.playerLook?.blend??0).toFixed(2),attractors:[...this.attractorQueues.values()].reduce((n,q)=>n+q.peds.length,0),queues:[...this.attractorQueues.entries()].map(([key,q])=>({key,peds:[...q.peds]})),attractorTry:this.attractorDebug,people:this.people.map(p=>({id:p.id,model:p.modelRef,attract:p.attract?{key:p.attract.key,type:p.attract.type,phase:p.attract.phase,slot:p.attract.slot}:null,look:p.look?+p.look.blend.toFixed(2):null,drowning:!!p.drowning,drowned:!!p.drowned,chase:p.chase?p.chase.target.id:null,attackWave:!!p.attackWave,rage:p.rage?.phase??null,investigate:p.investigate?.phase??null,hangout:p.hangout?.phase??null,party:p.party?p.party.leader.id:null,stealBack:p.stealBack?.phase??null,air:p.air?{vz:+p.air.vz.toFixed(2),clip:p.air.clip??null}:null,landing:p.landing!==undefined,alpha:Math.round(p.alpha),fadeOut:p.fadeOut,officer:p.officer,copWeapon:p.officer?p.copWeapon:undefined,fight:p.fight?.stage??null,gunReact:p.gunReact?.phase??null,evade:p.evade?`${p.evade.kind}:${p.evade.phase}`:null,carReact:p.carReact?.clip??(p.carReact?'face':null),decisionMaker:p.decisionMaker,handle:p.collider.handle,stare:p.stare?`${p.stare.phase}:${p.stare.remaining.toFixed(1)}`:null,reaction:p.view.reactionName??null,downSeconds:Number.isFinite(p.down)?+p.down.toFixed(2):null,stuckUnderCar:!!p.stuckUnderCar,loiter:p.loiter,crossing:p.crossing?p.crossing.phase:null,blocked:+p.blocked.toFixed(2),stuck:+(p.stuck?.seconds??0).toFixed(2),gait:+p.gait.toFixed(2),scratch:+p.scratch.toFixed(2),stagger:+p.stagger.toFixed(2),retaliate:+p.retaliate.toFixed(2),flee:+p.flee.toFixed(2),target:[+p.target.position[0].toFixed(1),+p.target.position[1].toFixed(1),+p.target.position[2].toFixed(1)],gang:p.gang,follow:p.follow,down:p.down,weapon:p.weapon?.info.type,gun:p.gunState&&{...p.gunState},position:{...p.actor.player.position},heading:p.actor.player.heading,health:p.health,state:p.stealth!==undefined&&p.health>0?'stealth':p.health<=0?'dead':p.down>0?'down':p.gunState?.reload?'reload':p.gunState?.active?'shoot':p.flee>0?'flee':'walk',brain:p.brain.stack.current?.name??null,visible:p.view.root.visible}))};}
   /** CWeapon::DoBulletImpact's skill test for a ped, before the damage lands: alive and not in the player's group. */
   trainsSkill(handle:number){const p=this.people.find(p=>p.collider.handle===handle);return !!p&&p.health>0&&!p.follow;}
   /** Player damage to a pedestrian; the weapon system reports the native crime for the returned victim. */
   damageCollider(handle:number,damage:number,direction:{x:number;z:number},kind:DamageKind='bullet',hit?:{weapon?:number;point?:{x:number;y:number;z:number};fight?:MeleeFight;pistolWhip?:boolean;push?:{x:number;z:number};noSource?:boolean;byPlayer?:boolean},ignoreProofs=false){
    const p=this.people.find(p=>p.collider.handle===handle);if(!p)return false;
    if(p.health<=0){
     // CWeapon::GenerateDamageEvent: a bullet or blow on a body done dying (TASK_SIMPLE_DEAD) blends FLOOR_HIT, or
     // FLOOR_HIT_F on its front, held at its end, and counts as a hit with no damage event.
     if((kind!=='bullet'&&kind!=='melee')||hit?.noSource)return false;
     const dying=p.view.reactionName,length=dying?p.view.reactionDuration(dying)??0:0;
     if(p.deadTime<length)return false;
     const clip=isFrontClip(dying)?'floor_hit_f':'floor_hit';
     if(p.view.hasReaction(clip))p.view.playReaction(clip,Infinity);
     return true;
    }
    // CPhysical::CanPhysicalBeDamaged: drowning always gets through, a fall only past collision proofing.
    const proofed=hit?.weapon===WEAPON.drowning?false:hit?.weapon===WEAPON.fall?!!p.proofs?.collision:pedProofedAgainst(p,kind);
    if(!ignoreProofs&&proofed)return false;
    // CPed::m_pLastEntityDamage: the player, unless nobody did it (`noSource`: drowning, a fall, the script's TASK_DIE)
    // or someone else did (`byPlayer` false: a blast or a fire he did not start).
    const byPlayer=!hit?.noSource&&hit?.byPlayer!==false;
    if(byPlayer)p.lastDamagedBy={player:true};
    if(kind==='fire')return this.burn(p,damage,byPlayer);
    // Shared pedstats scaling (src/ped/damage.ts); ground finishers share the 25 row.
    const base=kind==='melee'&&p.down>0?25:damage;
    // CPedDamageResponseCalculator::ComputeWillKillPed: the mega punch cheat makes fists, knuckles and the parachute
    // deal the victim's whole health.
    const megaPunch=kind==='melee'&&megaPunchBlow(hit?.weapon??WEAPON.unarmed);
    const applied=megaPunch?p.health:base*(kind==='melee'?playerPunchDamage(1,p.defendMult):1);
    p.health=healthAfter(p.health,applied);
    const q=p.actor.player.position,from={x:q.x-direction.x,z:q.z-direction.z};
    const weapon=hit?.weapon??(kind==='melee'?WEAPON.unarmed:kind==='explosion'?WEAPON.explosion:kind==='spray'?WEAPON.spraycan:WEAPON.pistol);
    if(applied>0)p.lastWeaponDamage=weapon;
    // A recruit the player shoots or strikes with a weapon leaves his group, as one he punches does; the damage response
    // below then answers the player as it would a stranger's (CDarkel asks IsMember first, so a kill still counts him).
    const wasRecruit=!!p.follow;
    if(byPlayer&&p.follow){p.follow=false;p.holdPosition=undefined;p.foe=undefined;}
    // Every hit and death takes CEventDamage::ComputeAnim, melee with the attacker's fight move. Surviving blast
    // victims fall with the knockout clip for the hit direction at the push CWorld::TriggerExplosionSectorList
    // computed (explosionOnPed in the weapon system).
    const fight=kind==='melee'?hit?.fight:undefined;
    // CTaskSimpleBeHit plays FIGHT_HIT_1 + move from the attacker's combo group.
    const hitClip=fight&&fight.move<=2?fight.hits?.[fight.move]:undefined;
    if(hitClip&&!p.view.hasReaction(hitClip.name.toLowerCase()))p.view.installReactions({[hitClip.name.toLowerCase()]:hitClip});
    const reaction=this.damageReaction(p,weapon,applied,from,hit?.point,byPlayer,fight,hit?.pistolWhip);
    if(p.health>0&&kind==='explosion'){
     const knockout=computeDeathAnim({weapon:WEAPON.explosion,pedPiece:PED_PIECE.torso,direction:browserLocalDirection(p.actor.player.heading,q.x-from.x,q.z-from.z),health:0,damageArmour:0,damageHealth:applied,victim:{player:false,inVehicle:false,moveState:PEDMOVE.still},source:{ped:true,player:true}});
     // An explosion's ApplyMoveForce sets the push; other blows keep the authored strength.
     this.hit(p,direction.x,direction.z,hit?.push?Math.hypot(hit.push.x,hit.push.z):Math.min(7,damage*.1),knockout.clip);
    }else if(p.health>0&&CHOKING_WEAPONS.has(weapon)&&!hit?.pistolWhip&&p.view.hasReaction('gas_cwr')){
     // CEventHandler::ComputeDamageResponse: a spray can, extinguisher or teargas hit gives CTaskSimpleChoking instead of
     // the hit clip (UpdateChoke: GAS_CWR, 1-2 s to go). ProcessPed is not reversed; the ped holds still for that
     // time, and the personality response below follows as DoComputeDamageAndResponseForPersonality does.
     if(!p.view.reactionName||p.view.reactionName!=='gas_cwr')p.view.playReaction('gas_cwr');
     p.stagger=Math.max(p.stagger,1+Math.random());
     if(byPlayer&&!this.damageResponse(p,weapon))this.fleeFromPlayer(p,60);
    }else{
     const floored=this.applyReaction(p,reaction,from);
     // ComputeDamageResponse: a victim of a weapon (not a blast) answers from its decision maker, standing or floored.
     // Without the decision files the victim flees its attacker to 60 and peds within 12 flee him to 45 (authored).
     if(byPlayer&&p.health>0&&!this.damageResponse(p,weapon)&&!floored){
      this.fleeFromPlayer(p,60);
      for(const o of this.people)if(o!==p&&!o.officer&&o.health>0&&!o.fleePlayer&&Math.hypot(o.actor.player.position.x-q.x,o.actor.player.position.z-q.z)<12)this.fleeFromPlayer(o,45);
     }
     if(p.health>0&&!floored)this.onPain?.(p,{...q});
    }
    if(p.health===0)this.onKill?.({id:p.id,officer:p.officer,gang:p.gang,pedType:p.pedType,recruit:wasRecruit,byPlayer});
    return {id:p.id,officer:p.officer};
   }
 /** Browser stand-in for the twelve CPedModelInfo hit spheres. Their bone,
  * offset and radius table lives in retail data (0x8A6308) and is not in the
  * reversed source, so height above the feet picks head, torso, midsection
  * or legs and the side of the ped picks the limb. */
 private hitPiece(p:Pedestrian,point?:{x:number;y:number;z:number}){return pedPieceAt(p.actor.player.position,p.actor.player.heading,point);}
 private moveState(p:Pedestrian){
  const speed=p.actor.player.speed;
  return speed<.1?PEDMOVE.still:speed<(p.walkSpeed+p.runSpeed)/2?PEDMOVE.walk:speed<(p.runSpeed+p.sprintSpeed)/2?PEDMOVE.run:PEDMOVE.sprint;
 }
 /** CEventDamage::ComputeAnim for a pedestrian struck from `from`. */
 private damageReaction(p:Pedestrian,weapon:number,damage:number,from:{x:number;z:number},point:{x:number;y:number;z:number}|undefined,attackerIsPlayer:boolean,fight?:MeleeFight,pistolWhip=false):DamageAnimResult{
  const q=p.actor.player.position;
  // The attacker's CTaskSimpleFight: combo set UNARMED_1 or a weapon set (4 and above) and
  // its current move (0–2 the attacks, 3 the ground attack, 4 the moving attack). IsComboSet
  // is a retail stub; it is taken as the combo's final move, so the third hit floors the victim.
  const sourceFight=fight&&{comboSet:4,currentMove:fight.move,comboActive:fight.move===2,hitComboActive:false,hitClip:(move:number)=>fight.hits?.[move]?.name.toLowerCase()??`hita_${move+1}`,group:fight.group??'melee_1'};
  const result=computeDamageEventAnim({weapon,pedPiece:point?this.hitPiece(p,point):fight?PED_PIECE.torso:this.hitPiece(p,point),direction:weapon===WEAPON.explosion?browserLocalDirection(p.actor.player.heading,q.x-from.x,q.z-from.z):browserLocalDirection(p.actor.player.heading,from.x-q.x,from.z-q.z),
   health:p.health,damageArmour:0,damageHealth:damage,
   victim:{player:false,inVehicle:false,taskRefusesAbort:this.fallRefusesDamage(p),moveState:this.moveState(p),upperBodyOnly:!!p.flags?.upperBodyDamageAnimsOnly,fallingOrGettingUp:p.down>0,headBelowRoot:this.headBelowRoot(p),lyingOnFront:isFrontClip(p.fallClip)},
   source:{ped:true,player:attackerIsPlayer,adrenaline:attackerIsPlayer&&this.sim.player.adrenaline>0,fight:sourceFight,pistolWhip:pistolWhip?{group:'melee_1',clip:'hita_2'}:undefined},megaPunch:megaPunchBlow(weapon),previousAnimId:p.damageAnimId,nextRandom:()=>this.damageRandom.next()});
  p.damageAnimId=result.id;return result;
 }
 /** CEventHandler::IsKillTaskAppropriate's `!GetActiveWeapon().IsTypeMelee()`: a knife or a bat is no gun. */
 private holdsGun(p:Pedestrian){return !!p.weapon&&p.weapon.info.type>WEAPON_LAST_MELEE;}
 /** CTaskSimpleFall::MakeAbortable(ABORT_PRIORITY_URGENT): through the fall and the time lying down, damage that
  * leaves the ped alive does not abort the fall (only CTaskSimpleGetUp gives way). The hit lands but plays nothing,
  * and he gets up on his first timer. Health is already reduced by the hit here, as ComputeDamageResponse has run. */
 private fallRefusesDamage(p:Pedestrian){
  if(!(p.health>=1)||!(p.down>0)||!Number.isFinite(p.down)||p.landing!==undefined||p.air)return false;
  return p.down>(p.view.reactionDuration(getUpClip(p.fallClip??'ko_skid_front'))??1.37);
 }
 /** The ped's root is over its head bone: down and not yet half way through its get-up clip (CTaskSimpleGetUp's
  * time progress under 0.5, past which EventHandler gives a normal death clip). */
 private headBelowRoot(p:Pedestrian){
  if(!(p.down>0))return false;if(!Number.isFinite(p.down))return true;
  const getUp=p.view.reactionDuration(getUpClip(p.fallClip??'ko_skid_front'))??1.37;
  return p.down>getUp*.5;
 }
 /** CPhysical::ApplyMoveForce divides by the ped's 70 mass into move speed per 1/50 s frame. */
 private static nativeImpulse(force:number){return force*50/70;}
 /** Plays a native reaction. Deaths hold their clip; floored victims are
  * pushed away from the source; everyone else staggers. Returns whether the
  * victim was floored. The native vertical force of 5 is not applied: NPC
  * bodies are kinematic here. */
 private applyReaction(p:Pedestrian,result:DamageAnimResult,from:{x:number;z:number}){
  const q=p.actor.player.position,away={x:q.x-from.x,z:q.z-from.z};
  if(p.health<=0){
   this.hit(p,away.x,away.z,WorldPedestrians.nativeImpulse(result.force),result.clip??'ko_shot_front');
   p.down=Infinity;p.view.playReaction(result.clip??'ko_shot_front',Infinity);return true;
  }
  // The fall refused the hit (fallRefusesDamage): EventHandler drops the response, so nothing plays.
  if(result.id===ANIM_ID.doorLHingeO)return false;
  // Once he is getting up, a new CTaskComplexFallAndGetUp replaces the one he is in: the KO_SKID clip plays and his
  // time down starts again. A landing's own fall damage leaves the landing's knockdown alone.
  if(result.fallDown){if(p.down>0&&Number.isFinite(p.down)&&p.landing===undefined&&!p.air)p.down=0;this.hit(p,away.x,away.z,WorldPedestrians.nativeImpulse(result.force),result.clip??'ko_skid_front');return true;}
  this.hits++;if(result.clip)p.view.playReaction(result.clip);
  // CTaskSimpleBeHit holds the victim until its hit clip ends.
  p.stagger=result.clip?p.view.reactionDuration(result.clip)??.5:.5;return false;
 }
 /** CWanted::WorkOutPolicePresence: living officers within `radius` of a point. */
 policePresence(point:{x:number;y:number;z:number},radius:number){return this.people.filter(p=>p.officer&&p.health>0&&Math.hypot(p.actor.player.position.x-point.x,p.actor.player.position.y+1-point.y,p.actor.player.position.z-point.z)<radius).length;}
  /** CEventGunShot::AffectsPed: street peds within 45 units of the shooter hear a shot, and a
   * silenced shot only reaches peds facing the muzzle with a clear line of sight. They answer from their decision
   * maker; without the decision files they flee as frighten() makes them. */
  gunShot(start:{x:number;y:number;z:number},silent:boolean,shooter?:number){
   this.onGunShot?.(start,silent,shooter===undefined);
   const source=shooter===undefined?undefined:this.people.find(o=>o.id===shooter);
   for(const p of this.people){
    // Not the shooter itself, nor anyone in its group (the player's recruits when the player fires).
    if(p.officer||p.health<=0||p.id===shooter||shooter===undefined&&p.follow)continue;
    // CPedGroups::AreInSameGroup(ped, firedBy): a gang party's or the player's group's own shots go unheard by it.
    if(source&&(source.party&&p.party===source.party||source.follow&&p.follow))continue;
    const q=p.actor.player.position,d={x:start.x-q.x,y:start.y-(q.y+1),z:start.z-q.z};
    if(d.x*d.x+d.y*d.y+d.z*d.z>GUN_SHOT_SENSE_RANGE*GUN_SHOT_SENSE_RANGE)continue;
    if(silent){
     const h=p.actor.player.heading;if(d.x*Math.sin(h)+d.z*Math.cos(h)<=0)continue;
     const eye={x:q.x,y:q.y+1,z:q.z},length=Math.hypot(d.x,d.y,d.z);
     if(length>1e-3&&this.sim.world.castRay(new RAPIER.Ray(eye,{x:d.x/length,y:d.y/length,z:d.z/length}),length,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS|RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC,undefined,p.collider,p.body))continue;
    }
    // Peds answering shots, an aimed gun or damage keep at it.
    if(!this.takesPriority(p,EVENT.shotFired,source))continue;
    if(this.shotFiredResponse(p,source))continue;
    // CEventGunShot's flee answer is CTaskComplexSmartFleeEntity(firedBy, 60).
    if(shooter===undefined){this.fleeFromPlayer(p,60);continue;}
    if(!p.fleePlayer){p.flee=Math.max(p.flee,8);p.fleeFrom={x:start.x,z:start.z};this.onFlee?.(p,{...q});}
   }
  }
  /** CTaskComplexSmartFleeEntity on the player (safe distance 60 for damage, gunshots and aimed guns, 45 for a panicked
   * ped seen): sprint from where he stands, re-reading his position each second once he has moved a unit, until the
   * ped is `safe` from that point. CTaskComplexSmartFleePoint's route is a stub, so the ped runs straight away. */
  fleeFromPlayer(p:Pedestrian,safe:number,from?:Pedestrian){
   const player=from?from.actor.player.position:this.sim.player.position,q=p.actor.player.position;
   // Join the path network when the ped has strayed from its route.
   if(Math.hypot(p.target.position[0]-q.x,-p.target.position[1]-q.z)>20){const n=this.closestNode(q,20);if(n){p.target=n;p.previousNode=undefined;}}
   p.flee=Math.max(p.flee,SMART_FLEE_SECONDS);p.fleeFrom={x:player.x,z:player.z};p.fleePlayer={safe,check:SMART_FLEE_CHECK_SECONDS,from};p.retaliate=0;
   this.onFlee?.(p,{...p.actor.player.position});
  }
  /** CTaskComplexWanderCop::LookForCarAlarms: the player's automobile with its alarm sounding within 20 units of a
   * wandering cop sets one star (SetWantedLevelNoDrop). */
  private lookForCarAlarms(p:Pedestrian){
   const v=this.playerVehicle?.();if(!v||!v.alarm||v.wrecked)return;
   const q=p.actor.player.position;
   if(Math.hypot(q.x-v.position.x,q.z-v.position.z)<20)this.law?.setLevelNoDrop(1);
  }
  /** CTaskComplexWanderCop::LookForStolenCopCars: a clean player driving a law enforcer earns one star. */
  private lookForStolenCopCars(){
   const v=this.playerVehicle?.();
   if(v&&v.law&&this.law&&!this.law.level)this.law.setLevelNoDrop(1);
  }
  /** CTaskComplexWanderCop::LookForCriminals: the first gangster or criminal wandering within 10 units ahead of the
   * cop in clear sight is chased (CEventPedToChase, a 30 s seek) and flees him for good (CEventPedToFlee's
   * CTaskComplexSmartFleeEntity, 100 units safe); the cop looks again 30 s later, never for the same criminal. */
  private lookForCriminals(p:Pedestrian){
   const q=p.body.translation(),fx=Math.sin(p.actor.player.heading),fz=Math.cos(p.actor.player.heading);
   for(const o of this.people){
    if(o===p||o.officer||o.health<=0)continue;
    const gangster=o.gang!==undefined,criminal=/^CRIMINAL$/i.test(o.pedType??'');
    if(!gangster&&(!criminal||o===p.lastCriminal))continue;
    // The active task must be the wander: no flight, fight, reaction, attractor, errand or crew duty.
    if(o.down>0||o.flee>0||o.retaliate>0||o.stagger>0||o.attract||o.follow||o.gunReact||o.evade||o.carReact||o.fight||o.drowning||o.air||o.landing!==undefined)continue;
    const c=o.body.translation(),dx=c.x-q.x,dy=c.y-q.y,dz=c.z-q.z,d=Math.hypot(dx,dy,dz);
    if(d>=10||dx*fx+dz*fz<=0||d<1e-3)continue;
    if(this.sim.world.castRay(new RAPIER.Ray(q,{x:dx/d,y:dy/d,z:dz/d}),d,true,RAPIER.QueryFilterFlags.ONLY_FIXED))continue;
    p.chase={target:o,seconds:30};p.criminalsAt=30;p.lastCriminal=o;
    o.flee=Math.max(o.flee,SMART_FLEE_SECONDS);o.fleeFrom={x:q.x,z:q.z};o.fleePlayer={safe:100,check:SMART_FLEE_CHECK_SECONDS,from:p};o.retaliate=0;o.gunReact=undefined;
    this.onFlee?.(o,{...o.actor.player.position});
    return;
   }
  }
  /** CEventDeadPed for a ped killed by stealth (CEventDeadPed::AffectsPed: only stealth kills, the living peds
   * within 8 units in 3D with the body ahead of them, never a body under water). Each answers by its decision
   * maker (event 11): CTaskComplexInvestigateDeadPed, CTaskComplexSmartFleeEntity from the body for good, or
   * nothing, which is all the Cop decision maker has; a script's decision maker can still give a cop a response. */
  private deadPedEvent(dead:Pedestrian){
   const b=dead.actor.player.position;
   if(dead.drowning||dead.drowned)return;
   for(const o of this.people){
    // CEventDeadPed is priority 15: a ped answering a stronger event (a fight, a flee from a shot) ignores the body.
    if(o===dead||o.health<=0||o.down>0||o.investigate||o.follow||!this.takesPriority(o,EVENT.deadPed,dead))continue;
    const q=o.actor.player.position,dx=b.x-q.x,dy=b.y-q.y,dz=b.z-q.z;
    if(dx*dx+dy*dy+dz*dz>64||dx*Math.sin(o.actor.player.heading)+dz*Math.cos(o.actor.player.heading)<0)continue;
    const relationship=this.relationshipTo(o,dead);
    const task=this.decide(o,EVENT.deadPed,relationship,this.deadPedRandom)??deadPedDecisionTask(o.decisionMaker,relationship,this.deadPedRandom);
    if(task===TASK.investigateDeadPed){o.investigate={phase:'stand',time:1,body:dead,start:{x:q.x,z:q.z},lookMs:5000+Math.floor(this.deadPedRandom()*2000)};o.loiter=false;}
    else if(task===TASK.smartFleeEntity){o.flee=Math.max(o.flee,SMART_FLEE_SECONDS);o.fleeFrom={x:b.x,z:b.z};o.fleePlayer={safe:100000,check:SMART_FLEE_CHECK_SECONDS,from:dead};o.retaliate=0;o.event={type:EVENT.deadPed};}
   }
  }
  /** CEventDanger (priority 20), which a low aircraft raises (CAutomobile::DoHeliDustEffect): AffectsPed reaches the living
   * peds within `radius` of it across the ground. The decision files answer it (event 75): street peds smart-flee the
   * aircraft with a safe distance of 100000 (ComputeDangerResponse), gang members inform their group (an avoided task,
   * so nothing) and cops have no answer. The source is the pilot: the player, a cop, or no one in an empty aircraft,
   * whose source type the unreversed ComputeEventSourceType leaves unknown (neutral here). The player's recruits answer
   * as a group, which is not modelled. */
  danger(at:()=>{x:number;z:number}|undefined,radius:number,pilot:'player'|'cop'|undefined){
   const c=at();if(!c)return;
   for(const p of this.people){
    if(p.health<=0||p.follow)continue;
    const q=p.actor.player.position;if((q.x-c.x)**2+(q.z-c.z)**2>radius*radius)continue;
    if(!this.takesPriority(p,EVENT.danger))continue;
    const relationship=pilot==='player'?this.relationshipTo(p):pilot==='cop'?this.relationshipTo(p,{pedType:'COP'} as Pedestrian):RELATIONSHIP.neutral;
    const task=this.decide(p,EVENT.danger,relationship);
    // CAR_DRIVE_MISSION_FLEE_SCENE falls through to the smart flee for a ped on foot.
    if(task!==TASK.smartFleeEntity&&task!==TASK.carDriveMissionFleeScene)continue;
    p.event={type:EVENT.danger};p.flee=Math.max(p.flee,SMART_FLEE_SECONDS);p.fleeFrom={...c};
    p.fleePlayer={safe:100000,check:SMART_FLEE_CHECK_SECONDS,entity:at};p.retaliate=0;p.gunReact=undefined;p.investigate=undefined;
    this.onFlee?.(p,{...q});
   }
  }
  // Not the player's recruits (they answer as his group) nor a mission ped carrying out a script task: neither drops
  // what it is doing for this authored fright (an explosion raises no event for bystanders in CExplosion).
  frighten(position:{x:number;z:number},radius:number){for(const p of this.people)if(!p.officer&&!p.follow&&!(p.mission&&this.hasScriptTask(p))&&p.health>0&&!p.fleePlayer&&Math.hypot(p.actor.player.position.x-position.x,p.actor.player.position.z-position.z)<radius){p.flee=Math.max(p.flee,8);p.fleeFrom={...position};this.onFlee?.(p,{...p.actor.player.position});}}
  /** A ped by collider, living or dead, while it is in the world: where a fire on it burns (CFire::ProcessFire). */
  pedPosition(handle:number){const p=this.people.find(q=>q.collider.handle===handle);return p&&{position:{...p.body.translation()},dead:p.health<=0,submerged:this.submerged(p)};}
  // bNeverEverTargetThisPed keeps a ped out of the lock-on the weapon system draws its targets from.
  /** Living peds for the weapons; `all` keeps those SET_CHAR_NEVER_TARGETTED hides from targeting. */
  targets(all=false){return this.people.filter(p=>p.health>0&&(all||!p.neverTargeted)).map(p=>({handle:p.collider.handle,position:{...p.body.translation()},officer:p.officer,armed:!!p.weapon,attacking:p.retaliate>0,down:p.down>0,noCriticalHits:!!p.noCriticalHits}));}
 /** CPopulation::RemovePed by collider handle; false when the handle is not a ped. */
 removeCollider(handle:number){const p=this.people.find(p=>p.collider.handle===handle);if(!p)return false;this.remove(p);this.people.splice(this.people.indexOf(p),1);return true;}
 /** ClearSpaceForMissionEntity's removal: only a ped CPed::CanBeDeleted allows, which is neither one a mission made nor
  * a follower of the player's group. */
 removeDeletableCollider(handle:number){const p=this.people.find(p=>p.collider.handle===handle);if(!p||p.mission||p.follow)return false;return this.removeCollider(handle);}
 /** The peds' rigid body handles (the camera's cone cast never tests peds). */
 readonly bodyHandles=new Set<number>();
 /** CPopulation::RemovePed; CPedGroupMembership drops a deleted member, which breaks up a party left without its leader
  * or with one member. */
 private remove(p:Pedestrian){this.leaveParty(p);this.bodyHandles.delete(p.body.handle);if(p.attract)this.departAttractor(p);p.gun?.dispose();p.stick?.dispose();p.view.dispose();this.sim.world.removeCharacterController(p.controller);this.sim.world.removeRigidBody(p.body);}
  update(now:number){
   if(this.disposed||!this.catalog||this.busy||now<this.nextCheck)return;
   this.nextCheck=now+1500;
   const player=this.sim.player.position;
   // Native ManagePed bands (re3/CPopulation): live peds survive to 51 m
   // (65 m far-cull), dead peds fade after 30 s. Visible peds are never
   // removed outright; the grace keeps recent spawns from flickering.
   // A culled ped gives its body, collider, character controller and view back (CPopulation::RemovePed);
   // dropping it from the list alone leaked ten of each a second wherever spawns were culled at once.
   // CPopulation::ManagePed: the removal distance (gang members count 30 units nearer, all over the creation
   // distance multiplier) removes a ped past 54.5 units off screen (on screen the original fades it; the browser
   // keeps it until it leaves the view); within 25 units or on screen the ped is needed for another 4 s (10 s for
   // a cop), and an off-screen ped past that time goes. Dead peds fade after 30 s.
   const pcdm=this.pcdm(),clock=now/1000;this.clock=Math.max(this.clock,clock);
   this.people=this.people.filter(p=>{const keep=(()=>{
    // CPedGroupMembership::Process drops a dead member from the group at once (PedGroupMembership.cpp:126-136), and a
    // body is no police car's crew: the dead fade like anyone else.
    if(p.health<=0){p.follow=false;p.crew=undefined;}
    // CPed::CanBeDeleted: a recruited crew member or a police car's crew is never removed by the population manager.
    if(p.follow||p.crew||p.attackWave||p.mission)return true;
    const visible=!this.canSpawn(p.actor.player.position,2),d=Math.hypot(p.actor.player.position.x-player.x,p.actor.player.position.z-player.z);
    // A dead ped fades out after 30 s; a ped faded to nothing goes.
    // CPopulation::ManagePed: sooner during a gang war (8 s).
    if(p.health<=0&&(p.deadTime>30||this.gangWarFighting?.()&&p.deadTime>8))p.fadeOut=true;
    if(p.fadeOut&&p.alpha<=0)return false;
    if(p.actor.player.position.y<=player.y-25&&!visible)return false;
    const removal=(p.gang!==undefined?d-30:d)/pcdm;
    // bCullExtraFarAway (set-piece cops and the criminals they chase) stretches the far cull from 54.5 to 65.
    if(removal>=(p.cullExtraFarAway?65:54.5)){if(visible){p.fadeOut=true;return true;}return false;}
    if(removal<=25||visible)return true;
    return clock<=p.neededUntil;
   })();if(!keep)this.remove(p);return keep;});

   const catalog=this.catalog;this.busy=true;
   // The check runs every 1.5 s: 45 game frames of CStreaming::StreamZoneModels at the frame limiter's 30 fps.
   this.roster??=new ZonePedRoster(catalog.popcycleGroups);this.roster.update(this.pedZone?.(),45,name=>this.wearing(name));
   this.gangRoster??=new GangPedRoster(catalog.gangs);this.gangRoster.update(this.gangsNeeded?.(player.x,player.z)??0,45);
   // The original populates once the zone's popcycle data and streamed models exist: with a fleet providing the
   // targets and the zone, wait for them (the first seconds used to fill the street with fallback-dressed
   // civilians and turf parties before the targets arrived).
   const hold=!!(this.pedTargets&&!this.pedTargets()||this.pedZone&&this.pedZone()&&!this.roster.loaded.length);
   void catalog.loadAround(player.x,player.z).then(async()=>{
    if(this.disposed||hold)return;
    const center=this.sim.player.position;
    // CPopulation::Update's creation bands: a spot the camera sees takes the on-screen band (42.5-50.5 at PCDM 1),
    // a hidden one the off-screen band (15-25); the ped fades in either way.
    const pcdm=this.pcdm(),on=onscreenSpawnBand(pcdm),off=offscreenSpawnBand(pcdm);
    const minD=Math.min(on.min,off.min),maxD=Math.max(on.max,off.max);
    // The band's nodes nearest first: each distance is taken once, not again in every comparison of the sort.
    const band:{node:PathNode;d:number}[]=[];
    for(const a of catalog.areas.values())for(const n of a.nodes){const d=Math.hypot(n.position[0]-center.x,-n.position[1]-center.z);if(d<maxD&&d>minD&&this.allowed(n))band.push({node:n,d});}
    band.sort((a,b)=>a.d-b.d);
    for(const {node} of band){
     const desiredOfficers=this.footOfficerLimit(),officer=!!catalog.officer&&this.people.filter(p=>p.officer&&p.health>0).length<desiredOfficers;
     const cap=this.limits?.()??{civilians:18,total:26};
     if(this.people.length>=cap.total||!officer&&(this.people.filter(p=>!p.officer).length>=cap.civilians||this.noCivilians()))break;
    const x=node.position[0],z=-node.position[1];
    if(officer&&Math.hypot(x-center.x,z-center.z)<35)continue;
    // A node more than 25 m below the player would be culled the moment its ped stood up (the keep band above).
    if(node.position[2]<=center.y-25)continue;
    // Foot officers keep the browser's own rule (hidden, at least 35 units out); FindNewPedType's cops are refused.
    if(officer){if(!this.canSpawn({x,y:node.position[2]+1,z},2))continue;}
    else{const d=Math.hypot(x-center.x,z-center.z),band=this.canSpawn({x,y:node.position[2]+1,z},2)?off:on;if(d<band.min||d>band.max)continue;}
    // CPopCycle::FindNewPedType: the type whose popcycle target exceeds its living count by the most (the fleet
    // provides the targets; without them the turf rolls below stand in). Cops are refused: reinforcements arrive
    // with their cars (footOfficerLimit).
    const targets=officer?undefined:this.pedTargets?.();
    if(targets){
     const living={civilians:0,cops:0,dealers:0,gangs:0},byGang=Array(10).fill(0);
     for(const p of this.people){if(p.health<=0)continue;if(p.officer)living.cops++;else if(p.dealer)living.dealers++;else if(p.gang!==undefined){living.gangs++;byGang[p.gang]++;}else living.civilians++;}
     const order=newPedTypeOrder(targets,living,Math.random,{cops:true,gangs:!this.gangTurf||!!this.dontCreateRandomGangMembers?.(),dealers:!this.dealerTurf,onlyGangs:!!this.onlyCreateRandomGangMembers?.()});
     if(!order.length)break;
     let produced=false;
     for(const type of order){
      if(type==='gang'){
       const gang=gangToCreateMembersOf(targets.gangStrengths,byGang,targets.gangs);
       if(gang<0||!this.gangResident(gang).length&&!this.catalog?.gangs[gang]?.length)continue;
       const size=gangPartySize(Math.floor(Math.random()*100));
       if(size>0&&this.people.length+size<=cap.total)await this.spawnGangParty(gang,size,node,center,targets.gangStrengths?.[gang]??255);
       produced=true;break;
      }
      if(type==='dealer'){
       if(!this.catalog?.dealers?.length)continue;
       if(this.people.length<cap.total)await this.spawnDealer(node,center);
       produced=true;break;
      }
      if(type==='civilian')break;
     }
     if(produced)continue;
     if(!order.includes('civilian'))continue;
    }
    // Turf gangs claim the node first (CPopulation gang-density roll): the
    // party holds formation instead of joining the civilian round-robin.
    else if(!officer){
     const turf=this.dontCreateRandomGangMembers?.()?undefined:this.gangTurf?.(x,z);
     if(turf&&turf.gang>=0&&turf.gang<10&&Math.random()*255<turf.strength){
      const size=gangPartySize(Math.floor(Math.random()*100));
      if(size>0&&this.people.length+size<=cap.total){await this.spawnGangParty(turf.gang,size,node,center,turf.strength);}
      continue;
     }
     // Corner dealers loiter on dealer turf instead of wandering past it.
     const dealerStrength=this.dealerTurf?.(x,z)??0;
     if(dealerStrength>0&&Math.random()*255<dealerStrength&&this.people.length<cap.total){await this.spawnDealer(node,center);continue;}
    }
    if(this.people.some(p=>Math.hypot(p.actor.player.position.x-x,p.actor.player.position.z-z)<5))continue;
    const top=node.position[2]+3,hit=this.sim.world.castRay(new RAPIER.Ray({x,y:top,z},{x:0,y:-1,z:0}),6,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
    if(!hit)continue;
    const position={x,y:top-hit.timeOfImpact+.03,z},modelIndex=this.nextId%catalog.models.length;
    // The zone's resident roster (CStreaming's eight ped slots) dresses civilians; the packaged trio stands in
    // while the roster is empty or a model is missing from the archive.
    const resident=officer?undefined:this.roster?.choose(name=>this.wearing(name),this.rainSkip());
    let source=officer?catalog.officer!:catalog.models[modelIndex],speeds=officer?catalog.officerSpeeds??{walk:NATIVE_PED_WALK_SPEED,run:NATIVE_PED_RUN_SPEED,sprint:NATIVE_PED_SPRINT_SPEED}:catalog.modelSpeeds[modelIndex]??{walk:NATIVE_PED_WALK_SPEED,run:NATIVE_PED_RUN_SPEED,sprint:NATIVE_PED_SPRINT_SPEED};
    let stats=officer?catalog.officerStats??{attack:1,defend:1}:catalog.modelStats[modelIndex]??{attack:1,defend:1},modelRef:number|string=officer?'lapd1':modelIndex;
    if(resident&&catalog.hasModel(resident)){
     try{const built=await Promise.all([catalog.character(resident),catalog.characterSpeeds(resident),catalog.characterStats(resident)]);source=built[0];speeds=built[1];stats=built[2];modelRef=resident;}catch{}
     if(this.disposed)return;
    }
    const p=this.createPed({position,heading:this.sim.player.heading,source,officer,node,weapon:officer?catalog.weapon:undefined,speed:speeds.walk,speeds,stats,modelRef});
    this.chooseTarget(p);
    // CPopulation::Update: every successful AddToPopulation is followed by GeneratePedsAtAttractors for one ped.
    if(!officer){await this.spawnAtAttractor(center);if(this.disposed)return;}
   }
  }).catch(e=>{this.error=String(e);}).finally(()=>{this.busy=false;});
 }
   /** The popcycle zone type, city and group percentages the civilian roster streams for (fleet provider). */
   pedZone?:()=>PedZoneGroups|undefined;
   private roster?:ZonePedRoster;
   /** The update clock in seconds (the `now` of update), for m_nTimeTillWeNeedThisPed. */
   private clock=0;
   /** The player's vehicle speed on the plane in game units a frame (m/s over 50), 0 on foot: CPopulation::
    * PedCreationDistMultiplier stretches the creation and removal bands up to 1.5× at speed. */
   playerVehicleSpeed?:()=>number;
   private pcdm(){return pedCreationDistMultiplier(this.playerVehicleSpeed?.()??0);}
   /** CPlayerPed's own LookAtInterestingEntities: CJ glances at a street ped within 15 units, 1 frame in 100. */
   private playerLook?:LookAtTask;private playerLookTarget?:Pedestrian;private playerLookPoint?:{x:number;y:number;z:number};
   get playerLookBlend(){return this.playerLook?.blend??0;}
   /** CTaskSimpleTriggerLookAt on the player's own ped: his head turns to the ped for the task's time. */
   playerLookAtPed(target:Pedestrian,seconds:number){this.playerLookTarget=target;this.playerLookPoint=undefined;this.playerLook=startLookAt(this.clock*1000,seconds*1000);}
   /** TASK_LOOK_AT_COORD on the player: the head looks at a point (renderer space) for `seconds`. */
   playerLookAtPoint(point:{x:number;y:number;z:number},seconds:number){this.playerLookTarget=undefined;this.playerLookPoint={...point};this.playerLook=startLookAt(this.clock*1000,seconds*1000);}
   private stepPlayerLook(dt:number,clock:number){
    const view=this.playerView();if(!view)return;
    const pl=this.sim.player.position,nowMs=clock*1000;
    // The aim's LookAt (priority 3) takes over the chain's one look task, so the glance is gone rather than waiting.
    if(view.aimLooking){this.playerLook=undefined;this.playerLookTarget=undefined;this.playerLookPoint=undefined;}
    else if(this.playerLook){
     const target=this.playerLookTarget,point=this.playerLookPoint;
     if(!stepLookAt(this.playerLook,nowMs,dt*1000)||!point&&(!target||target.health<=0||!this.people.includes(target))){this.playerLook=undefined;this.playerLookTarget=undefined;this.playerLookPoint=undefined;}
    }else if(this.frameDue&&this.sim.player.health>0&&shouldStartLookAt(true,false,Math.random)){
     const near=this.people.filter(p=>p.health>0&&p.down===0&&Math.hypot(p.actor.player.position.x-pl.x,p.actor.player.position.z-pl.z)<=LOOK_AT_RANGE);
     if(near.length){this.playerLookTarget=near[Math.floor(Math.random()*near.length)];this.playerLook=startLookAt(nowMs,lookAtDurationMs(Math.random));}
    }
    const t=this.playerLookTarget?.actor.player.position,point=this.playerLookPoint;
    view.setHeadLook(this.playerLook&&point?new Vector3(point.x,point.y,point.z):this.playerLook&&t?new Vector3(t.x,t.y+0.9,t.z):undefined,this.playerLook?.blend??0);
   }
   /** CWaterLevel::GetWaterLevel at a native point (main wires the water), for CPed::ProcessBuoyancy. */
   waterLevel?:(x:number,y:number)=>number|undefined;
  /** The area the camera is in, which decides whether a ped with an area of its own is drawn. */
  visibleArea?:()=>number;
  /** The rows a script has written for a decision maker, by the slot a ped wears. */
  scriptDecisionMaker?:(slot:number)=>DecisionMaker|undefined;
   /** The placed 2dfx ped attractors within a radius of a native point (the installed scene provides them). */
   attractorsNear?:(x:number,y:number,radius:number)=>WorldAttractor[];
   /** CPedAttractorManager's attractors: one queue per placed effect a ped has registered with. */
   private attractorQueues=new Map<string,AttractorQueue>();
   /** The last GeneratePedsAtAttractors attempt, for the dev state. */
   private attractorDebug:{near:number;candidates:number;outcome:string}={near:0,candidates:0,outcome:'untried'};
   /** CPopulation::GeneratePedsAtAttractors for one ped: a free attractor of a supported type in the creation band
    * (42.5 to 50.5 units on screen, 15 to 25 off it), ATMs, seats and bus stops between 9:00 and 20:00, a roster
    * model that may stand on foot and is no dealer, medic, fireman, criminal, bum or prostitute; the ped is placed
    * 0.02 units along the effect's forward direction facing its use direction and uses it at once. */
   private async spawnAtAttractor(center:{x:number;y:number;z:number}){
    const catalog=this.catalog,roster=this.roster,near=this.attractorsNear;if(!catalog||!roster||!near)return false;
    const hour=Math.floor(this.sim.timeMinutes/60)%24,daytime=hour>=9&&hour<20;
    const pcdm=this.pcdm(),onMin=42.5*pcdm,onMax=50.5*pcdm,offMin=pcdm*25-10,offMax=pcdm*25;
    const candidates=near(center.x,-center.z,onMax+2).filter(a=>{
     if(!ATTRACTOR_TYPES.has(a.type))return false;
     // GetRandom2dEffect(mustBeFree) and HasQueueTailArrivedAtSlot: a free slot, and the tail already standing in its own.
     const queue=this.attractorQueues.get(a.key);
     if(queue&&(!queue.hasEmptySlot||queue.peds.some(id=>this.people.find(p=>p.id===id)?.attract?.phase==='go')))return false;
     if((a.type===PED_ATTRACTOR.atm||a.type===PED_ATTRACTOR.seat||a.type===PED_ATTRACTOR.stop)&&!daytime)return false;
     const x=a.position[0],z=-a.position[1],y=a.position[2],d=Math.hypot(x-center.x,z-center.z);
     const hidden=this.canSpawn({x,y:y+1,z},2);
     return hidden?d>=offMin&&d<=offMax:d>=onMin&&d<=onMax;
    });
    for(let i=candidates.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
    this.attractorDebug={near:near(center.x,-center.z,onMax+2).length,candidates:candidates.length,outcome:'none'};
    for(const a of candidates){
     const model=roster.choose(name=>this.wearing(name)+(catalog.onFoot(name)?0:1000),this.rainSkip());
     if(!model||!catalog.onFoot(model)||!catalog.hasModel(model)){this.attractorDebug.outcome=`model:${model}`;continue;}
     let built:{source:import('../render/NativeCharacter').CharacterSource;speeds:{walk:number;run:number;sprint:number};stats:{attack:number;defend:number;temper?:number;pedType?:string}};
     try{built={source:await catalog.character(model),speeds:await catalog.characterSpeeds(model),stats:await catalog.characterStats(model)};}catch{continue;}
     if(this.disposed)return false;
     if(built.stats.pedType&&/^(DEALER|MEDIC|FIREMAN|CRIMINAL|BUM|PROSTITUTE)$/i.test(built.stats.pedType))continue;
     // The queue is read after the model loads: while it loaded the queue may have emptied and gone, or a passer-by
     // may have joined or begun a fresh one, and writing back a queue read before would orphan them.
     const queue=this.attractorQueues.get(a.key)??new AttractorQueue(a);
     if(!queue.hasEmptySlot)continue;
     const slot=queue.peds.length,slotPos=queue.slotPosition(slot);
     const x=slotPos[0]+(slot?0:a.forwardDir[0]*.02),z=-(slotPos[1]+(slot?0:a.forwardDir[1]*.02)),y=slotPos[2];
     if(this.people.some(p=>Math.hypot(p.actor.player.position.x-x,p.actor.player.position.z-z)<=.015))continue;
     const node=this.nearestNode({x,z});if(!node)continue;
     const top=y+2,hit=this.sim.world.castRay(new RAPIER.Ray({x,y:top,z},{x:0,y:-1,z:0}),4,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
     const position={x,y:hit?top-hit.timeOfImpact+.03:y+.03,z},heading=queue.slotHeading(slot);
     const p=this.createPed({position,heading,source:built.source,officer:false,node,speed:0,speeds:built.speeds,stats:built.stats,modelRef:model});
     this.attractorQueues.set(a.key,queue);queue.register(p.id);p.attractorsTried.add(a.key);
     if(!queue.atHead(slot))p.attract={key:a.key,type:a.type,phase:'wait',time:0,until:Infinity,heading,slot,startAt:0};
     else this.beginAttractor(p,a.key,a.type,heading);
     p.actor.player.heading=heading;
     this.attractorDebug.outcome=`spawned:${a.key}:${slot}`;
     return true;
    }
    return false;
   }
   /** CTaskComplexUseAttractor::CreateFirstSubTask: the use task for the attractor type. Seats and steps sit down,
    * idle (40% for 15 to 60 s, else until something interrupts) and stand up (CTaskSimpleSitDown/SitIdle/StandUp:
    * steps on the attractors block's Stepsit_in/loop/out, seats on SEAT_down/idle/up); ATMs run the ATM clip once
    * and pay 20 + 20 × [0, 50); bus stops wait (no bus comes: 20 to 60 s, authored); shop windows hold 3 to 6 s and
    * pizza counters 6 to 12 s. */
   private sitClips(type:number){return type===PED_ATTRACTOR.step?{down:'stepsit_in',idle:'stepsit_loop',up:'stepsit_out'}:{down:'seat_down',idle:'seat_idle',up:'seat_up'};}
   private beginAttractor(p:Pedestrian,key:string,type:number,heading:number){
    const seconds=(a:number,b:number)=>a+Math.random()*(b-a);
    if(type===PED_ATTRACTOR.seat||type===PED_ATTRACTOR.step){
     const clips=this.sitClips(type);
     p.attract={key,type,phase:'sit',time:0,until:p.view.reactionDuration(clips.down)??1,heading,slot:0,startAt:0};
     if(p.view.hasReaction(clips.down))p.view.playReaction(clips.down);
    }else if(type===PED_ATTRACTOR.atm){
     p.attract={key,type,phase:'use',time:0,until:p.view.reactionDuration('atm')??4,heading,slot:0,startAt:0};
     if(p.view.hasReaction('atm'))p.view.playReaction('atm');
    }else{
     // CTaskComplexWaitForDryWeather stands still 1000 ms at a time while CWeather::Rain is 0.2 or more.
     const until=type===PED_ATTRACTOR.shelter?1:type===PED_ATTRACTOR.stop?seconds(20,60):type===PED_ATTRACTOR.pizza?seconds(6,12):seconds(3,6);
     p.attract={key,type,phase:'stand',time:0,until,heading,slot:0,startAt:0};
    }
    p.actor.player.heading=heading;
   }
   /** CTaskComplexGoToAttractor's arrival (BroadcastArrival): the head uses the effect, the others wait in line. */
   private arriveAttractor(p:Pedestrian){
    const a=p.attract!,queue=this.attractorQueues.get(a.key);
    if(!queue){p.attract=undefined;this.chooseTarget(p);return;}
    const slot=queue.slotOf(p.id);if(slot<0){p.attract=undefined;this.chooseTarget(p);return;}
    const heading=queue.slotHeading(slot);
    if(queue.atHead(slot))this.beginAttractor(p,a.key,a.type,heading);
    else{a.phase='wait';a.goal=undefined;a.slot=slot;a.heading=heading;a.time=0;a.until=Infinity;}
   }
   private stepAttractor(p:Pedestrian,dt:number){
    const a=p.attract!;a.time+=dt;
    if(a.time<a.until)return;
    switch(a.phase){
     case 'sit':{
      // CTaskComplexUseAttractor: 40% of sitters idle 15 to 60 s, the rest until something interrupts.
      const idle=Math.random()<.4?15+Math.random()*45:Infinity;
      a.phase='idle';a.time=0;a.until=idle;
      const clips=this.sitClips(a.type);if(p.view.hasReaction(clips.idle))p.view.playReaction(clips.idle,Number.isFinite(idle)?idle:1e6);
      return;
     }
     case 'idle':{const clips=this.sitClips(a.type);a.phase='up';a.time=0;a.until=p.view.reactionDuration(clips.up)??1;if(p.view.hasReaction(clips.up))p.view.playReaction(clips.up);return;}
     case 'use':p.money+=20+20*Math.floor(Math.random()*50);this.leaveAttractor(p);return;
     case 'stand':if(a.type===PED_ATTRACTOR.shelter&&(this.rain?.()??0)>=.2){a.time=0;a.until=1;return;}
      // A pizza counter takes 10 from the customer when he is done (CTaskComplexUseAttractor::CreateNextSubTask).
      if(a.type===PED_ATTRACTOR.pizza)p.money=Math.max(0,p.money-10);
      this.leaveAttractor(p);return;
     default:this.leaveAttractor(p);
    }
   }
   /** CPedAttractorManager::BroadcastDeparture: the slot frees, the peds behind walk up a slot (2 s a slot) and the
    * ped wanders on. */
   private leaveAttractor(p:Pedestrian){
    if(!p.attract)return;
    this.departAttractor(p);p.attract=undefined;
    if(p.view.reactionName&&/^(atm|seat_down|seat_idle|seat_up|stepsit_in|stepsit_loop|stepsit_out)$/.test(p.view.reactionName))p.view.clearReaction();
    this.chooseTarget(p);
   }
   private departAttractor(p:Pedestrian){
    const a=p.attract!,queue=this.attractorQueues.get(a.key);if(!queue)return;
    for(const move of queue.depart(p.id)){
     const q=this.people.find(o=>o.id===move.ped);if(!q?.attract)continue;
     const pos=queue.slotPosition(move.slot);
     q.attract.phase='go';q.attract.goal={x:pos[0],z:-pos[1]};q.attract.slot=move.slot;q.attract.startAt=move.delaySeconds;q.attract.time=0;q.attract.until=Infinity;
    }
    if(!queue.peds.length)this.attractorQueues.delete(a.key);
   }
   /** CPopCycle::Update's ped targets for the player's zone (fleet provider); without them the turf rolls decide. */
   pedTargets?:()=>(PopulationTargets&{gangStrengths?:readonly number[];noCops?:boolean})|undefined;
   /** Bit mask of the gangs with INITIAL strength in the zone at a point (fleet/zone provider). */
   gangsNeeded?:(x:number,z:number)=>number;
   private gangRoster?:GangPedRoster;
   /** The gang models CStreaming keeps resident (two of each active gang), for drive-by crews. */
   gangResident(gang:number){return this.gangRoster?.resident(gang)??[];}
   private specificDrivers=new SpecificDrivers();
   /** The fixed driver some cars come with (FindSpecificDriverModelForCar_ToUse), when the archive has the model. */
   specificDriver(modelName:string|undefined,level:number){
    const catalog=this.catalog;if(!catalog)return undefined;
    const name=this.specificDrivers.forCar(modelName,level);
    return name&&catalog.hasModel(name)?name:undefined;
   }
   /** A gang car's driver: a resident model of the gang (any member while none is resident). */
   gangDriver(gang:number){
    const members=this.catalog?.gangs[gang]??[];
    return this.gangRoster?.choose(gang)??(members.length?members[Math.floor(Math.random()*members.length)]:undefined);
   }
   /** Living civilians wearing a model, for the roster's slot reuse and spawn choice. */
   private wearing(name:string){return this.people.filter(p=>!p.officer&&p.health>0&&p.modelRef===name).length;}
   /** CPopulation::ChooseCivilianOccupationForVehicle: a resident model that may drive the vehicle's class, the one
    * with the fewest living peds first; failing that any resident model; undefined while the roster is empty. */
   rosterDriver(vehicleClass:string|undefined){
    const catalog=this.catalog,roster=this.roster;if(!catalog||!roster)return undefined;
    const rank=(names:string[])=>names.map(name=>({name,n:this.wearing(name)})).sort((a,b)=>a.n-b.n)[0]?.name;
    const admitted=roster.loaded.filter(name=>roster.acceptable(name));
    return rank(admitted.filter(name=>catalog.canDrive(name,vehicleClass)))??rank(admitted);
   }
   /** Officers the street spawner may add: the native pursuit cap (CWanted::m_MaxCopsInPursuit) less cops already committed elsewhere. */
   footOfficerLimit:()=>number=()=>this.law?.native.maxCopsInPursuit??0;
  /** The dead-ped decision draw (CDecision::MakeDecision's random), overridable by probes. */
  deadPedRandom:()=>number=()=>this.damageRandom.next()/32768;
  /** CGangWars::ClearTheStreets: wandering civilians sprint. */
  clearStreets=false;
  /** CGangWars::DontCreateCivilians: no civilian spawns while a war runs. */
  noCivilians:()=>boolean=()=>false;
  /** CPopulation::AddPed's gang weapon draws (RandomBool(33) and CGangInfo::GetRandomWeapon), overridable by probes. */
  gangWeaponRandom:()=>number=Math.random;
  /** CTaskComplexGangLeader's draws (talk anims, looks, the 5 % walk), overridable by probes. */
  hangoutRandom:()=>number=Math.random;
  /** The group's decision draw when a hating gang member sights the player (RANDOM.grp's kill-threats share). */
  turfRandom:()=>number=Math.random;
  /** The jacked driver's decision draw and CreateStealCarBackSeq's coin, overridable by probes. */
  jackedRandom:()=>number=()=>this.damageRandom.next()/32768;
  /** The player's vehicle for the cop wander's LookForCarAlarms and LookForStolenCopCars: where it is, whether its
   * alarm sounds (m_nAlarmState counting down), whether it is a law enforcer and whether it is wrecked. */
  playerVehicle?:()=>{position:{x:number;y:number;z:number};alarm:boolean;law:boolean;wrecked:boolean}|undefined;
  /** The same CEventGunShot for the peds in vehicles (the traffic drivers): the shot's point, whether it was silenced,
   * and whether the player fired it. */
  onGunShot?:(from:{x:number;y:number;z:number},silent:boolean,byPlayer:boolean)=>void;
  /** The bikes the ped strike pass tests with the cars. */
  bikes?:()=>Iterable<PedStriker>;
  /** The body of the bike, boat or aircraft the player rides (his own collider is off while he does), and whether it
   * is a bike, whose rider a bullet can strike. */
  playerRide?:()=>{body:RAPIER.RigidBody;bike:boolean}|undefined;
   /** Popcycle density caps for the current zone and clock (fleet provider; 18/26 fallback). */
   limits?:()=>{civilians:number;total:number}|undefined;
   /** Gang turf at a native point: pedgrp.dat gang index 0–9 with INITIAL strength 0–255. */
   gangTurf?:(x:number,z:number)=>{gang:number;strength:number}|undefined;
   /** CPopulation::m_bDontCreateRandomGangMembers, which a script sets with SET_CREATE_RANDOM_GANG_MEMBERS. */
   dontCreateRandomGangMembers?:()=>boolean;
   /** CPopulation::m_bOnlyCreateRandomGangMembers, which SET_ONLY_CREATE_GANG_MEMBERS sets. */
   onlyCreateRandomGangMembers?:()=>boolean;
   /** Dealer corner strength (INITIAL SET_ZONE_DEALER_STRENGTH 0–255). */
   dealerTurf?:(x:number,z:number)=>number|undefined;
  /** A corner dealer (pedgrp.dat dealers): loiters on the spot until spooked. */
  private async spawnDealer(node:PathNode,center:{x:number;z:number}){
   const catalog=this.catalog!;
   const dealers=catalog.dealers??[];
   if(!dealers.length)return;
   const model=dealers[Math.floor(Math.random()*dealers.length)];
   const x=node.position[0],z=-node.position[1];
   if(Math.hypot(x-center.x,z-center.z)>65)return;
   if(!this.canSpawn({x,y:node.position[2]+1,z},2))return;
   const top=node.position[2]+3,hit=this.sim.world.castRay(new RAPIER.Ray({x,y:top,z},{x:0,y:-1,z:0}),6,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
   if(!hit||this.disposed)return;
   let built:{source:import('../render/NativeCharacter').CharacterSource;speeds:{walk:number;run:number;sprint:number};stats:{attack:number;defend:number;temper?:number}};
   try{built={source:await catalog.character(model),speeds:await catalog.characterSpeeds(model),stats:await catalog.characterStats(model)};}
   catch{return;}
   const position={x,y:top-hit.timeOfImpact+.03,z};
   const p=this.createPed({position,heading:Math.random()*Math.PI*2,source:built.source,officer:false,node,weapon:undefined,speed:0,speeds:built.speeds,stats:built.stats,modelRef:model,loiter:true,dealer:true});
   p.target=node;p.previousNode=undefined;
  }
  /** A turf gang party (CPopulation::AddToPopulation + PlaceGangMembers):
   * native party size with formation offsets around the leader's node. */
  private async spawnGangParty(gang:number,size:number,node:PathNode,center:{x:number;z:number},strength=255){
   const catalog=this.catalog!;
   const members=catalog.gangs[gang]??[];
   if(!members.length)return;
   // CPopulation::AddPed: a third of the gang members draw one of the gang's weapons (CGangs, script-set); a melee
   // choice the ped catalog cannot arm (the Families' knife) leaves the member unarmed.
   let leader:Pedestrian|undefined;void strength;const party:Pedestrian[]=[];
   for(let i=0;i<size;i++){
    if(this.disposed)return;
    const model=this.gangRoster?.choose(gang)??members[Math.floor(Math.random()*members.length)];
    const offset=i===0?{x:0,z:0}:gangFormationOffset(i);
    const x=node.position[0]+offset.x,z=-node.position[1]+offset.z;
    if(Math.hypot(x-center.x,z-center.z)>65)continue;
    if(!this.canSpawn({x,y:node.position[2]+1,z},2))continue;
    const top=node.position[2]+3,hit=this.sim.world.castRay(new RAPIER.Ray({x,y:top,z},{x:0,y:-1,z:0}),6,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
    if(!hit)continue;
    let built:{source:import('../render/NativeCharacter').CharacterSource;speeds:{walk:number;run:number;sprint:number};stats:{attack:number;defend:number}};
    try{built={source:await catalog.character(model),speeds:await catalog.characterSpeeds(model),stats:await catalog.characterStats(model)};}
    catch{return;}
   const position={x,y:top-hit.timeOfImpact+.03,z};
   let armed:Awaited<Catalog['weapon']>|undefined;
   if(gangMemberArmed(this.gangWeaponRandom)){const id=randomGangWeapon(gang,this.gangWeaponRandom);if(id&&this.law){try{armed=await catalog.armedWith(id);}catch{armed=undefined;}}}
   if(this.disposed)return;
   const p=this.createPed({position,heading:this.sim.player.heading,source:built.source,officer:false,node,weapon:armed,speed:built.speeds.walk,speeds:built.speeds,stats:built.stats,gang,modelRef:model});
    if(leader){p.target=leader.target;p.previousNode=leader.previousNode;}
    else{this.chooseTarget(p);leader=p;}
    party.push(p);p.view.installReactions(catalog.gangClips,true);
   }
   // CTaskComplexGangLeader::CreateFirstSubTask: a walk (5 %, or fewer than three members) or a 5 s stand.
   // The members load one by one, so the player may have recruited one before the party forms; he stays in his group.
   const formed=party.filter(m=>!m.follow&&this.people.includes(m));leader=formed.includes(leader!)?leader:formed[0];
   if(leader&&formed.length>=2){for(const m of formed)m.party={leader,members:formed};leader.hangout=this.hangoutRandom()<.05||formed.length<3?{phase:'wander',time:this.hangoutRandom()*15}:{phase:'stand',time:5};}
  }
  private createPed(o:{position:{x:number;y:number;z:number};heading:number;source:import('../render/NativeCharacter').CharacterSource;officer:boolean;node:PathNode;weapon?:Awaited<Catalog['weapon']>;flee?:number;speed?:number;speeds?:{walk:number;run:number;sprint:number};stats?:{attack:number;defend:number;temper?:number;decisionMaker?:number;flags?:number;headingChange?:number;pedType?:string;rich?:boolean};gang?:number;modelRef:number|string;loiter?:boolean;dealer?:boolean;gunAccuracy?:number}){
  const catalog=this.catalog!,body=this.sim.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(o.position.x,o.position.y+.9,o.position.z));this.bodyHandles.add(body.handle);
  const collider=this.sim.world.createCollider(RAPIER.ColliderDesc.capsule(.6,.3).setSolverGroups(PED_SOLVER_GROUPS),body),controller=this.sim.world.createCharacterController(.025);
  controller.enableAutostep(.3,.2,false);controller.enableSnapToGround(.25);
  const view=new NativeCharacter(o.source);view.installReactions(this.reactions(catalog));view.startFirstCycleAt(Math.random());this.scene.add(view.root);
  let gun:ReturnType<typeof modelObject>|undefined;
  if(o.weapon?.asset){const asset=o.weapon.asset;gun=modelObject(asset.model,asset.textures);gun.root.rotation.set(0,0,0);gun.root.traverse(obj=>{const i=obj.userData.nativeFrame;if(i!==undefined&&asset.model.frames[i].parent<0)obj.matrix.identity();delete obj.userData.nativeFrame;});view.hand()?.add(gun.root);if(o.weapon.clip)view.installReactions({police_fire:o.weapon.clip},true);if(o.weapon.reloadClip)view.installReactions({police_reload:o.weapon.reloadClip},true);}
  let stick:ReturnType<typeof modelObject>|undefined;const nightstick=o.officer?catalog.nightstick:undefined;
  if(nightstick?.asset){const asset=nightstick.asset;stick=modelObject(asset.model,asset.textures);stick.root.rotation.set(0,0,0);stick.root.traverse(obj=>{const i=obj.userData.nativeFrame;if(i!==undefined&&asset.model.frames[i].parent<0)obj.matrix.identity();delete obj.userData.nativeFrame;});stick.root.visible=false;view.hand()?.add(stick.root);}
  if(nightstick?.melee)view.installReactions(Object.fromEntries(nightstick.melee.attacks.map((clip,i)=>[`cop_bat_${i+1}`,clip])));
  const p:Pedestrian={pedType:o.stats?.pedType,attractScan:Math.random()*ATTRACTOR_SCAN_SECONDS,attractorsTried:new Set(),copScan:0,criminalsAt:0,wanderDir:Math.floor(Math.random()*8),seed:Math.floor(Math.random()*32768),scratch:0,money:pedMoneyCount(Math.random,!!o.stats?.rich),copWeapon:'unarmed',stick,id:this.nextId++,weapon:o.weapon,gunState:o.weapon?{time:0,rounds:o.weapon.info.clip,reload:0,active:false}:undefined,flash:0,deadTime:0,officer:o.officer,arrest:0,gun,health:o.officer?copHealth(String(o.modelRef)):100,actor:{player:{...this.sim.player,position:{...o.position},previous:{...o.position},heading:o.heading,health:100,stamina:100,crouched:false,grounded:true,speed:o.speed??0}},body,collider,controller,view,target:o.node,down:0,flee:o.flee??0,impulse:{x:0,z:0},blocked:0,retaliate:0,retaliateCooldown:0,meleeCooldown:0,walkSpeed:o.speeds?.walk??NATIVE_PED_WALK_SPEED,runSpeed:o.speeds?.run??NATIVE_PED_RUN_SPEED,sprintSpeed:o.speeds?.sprint??NATIVE_PED_SPRINT_SPEED,onFire:0,onFireSpeech:0,attackMult:o.stats?.attack??1,decisionMaker:o.stats?.decisionMaker??(o.officer?1:2),statFlags:o.stats?.flags??40,headingChange:o.stats?.headingChange??7.5,defendMult:o.stats?.defend??1,temper:o.stats?.temper??50,gunAccuracy:o.gunAccuracy??60,stagger:0,bumpCooldown:0,dropped:false,gait:o.speed??0,gang:o.gang,modelRef:o.modelRef,loiter:!!o.loiter,dealer:!!o.dealer,neededUntil:this.clock+4,alpha:0,fadeOut:false,follow:false,foe:undefined,brain:new PedTaskAdapter(),fightStage:0};
  this.people.push(p);return p;
 }
 /** The allowed path node nearest a point within `range`, by one scan. */
 private closestNode(position:{x:number;z:number},range:number){
  let best:PathNode|undefined,d2=range*range;
  for(const a of this.catalog?.areas.values()??[])for(const n of a.nodes){const dx=n.position[0]-position.x,dz=-n.position[1]-position.z,e=dx*dx+dz*dz;if(e<d2&&this.allowed(n)){d2=e;best=n;}}
  return best;
 }
 /** ThePaths.FindNodeClosestToCoors(PATH_TYPE_PED) over the loaded areas: the nearest pedestrian node's browser position. */
 nearestPedNode(position:{x:number;y:number;z:number}){
  let best:{x:number;y:number;z:number}|undefined,d2=Infinity;
  for(const a of this.catalog?.areas.values()??[])for(const n of a.nodes){
   if(n.kind!=='pedestrian')continue;const x=n.position[0],y=n.position[2],z=-n.position[1],e=(x-position.x)**2+(y-position.y)**2+(z-position.z)**2;
   if(e<d2){d2=e;best={x,y,z};}
  }
  return best;
 }
 /** The allowed path node nearest a point, however far: one scan rather than a sort of every node. */
 private nearestNode(position:{x:number;z:number}){return this.closestNode(position,Number.POSITIVE_INFINITY);}
  /** Living on-foot pedestrians as wading walkers for foot splashes (stable keys). */
  walkers(){return this.people.filter(p=>p.health>0&&p.down===0).map(p=>({key:p as object,position:{...p.actor.player.position},speed:p.actor.player.speed,grounded:true}));}
  /** A driver dragged out or leaving a car becomes a street ped that flees (the usual decision-maker response to EVENT_DRAGGED_OUT_CAR). */
  /** A driver put out of his car. `flee` is CTaskComplexSmartFleeEntity from the car (its stopped position, `safe`
   * units); without it the ped runs 8 s from the jacking. */
  spawnFleeing(modelRef:number|string,position:{x:number;y:number;z:number},heading:number,gang?:number,flee?:{from:{x:number;z:number};safe:number}){
  return this.spawnFromCar(modelRef,position,heading,gang,8,p=>this.fleeCar(p,flee));
 }
 /** CGangWars::CreateDefendingGroup's ped spawn (and the host's authored CreateAttackWave): `count` gangsters of
  * `gang` in a ring 2 to 5 units round the path node nearest `center` (browser space), each on a kill task at the
  * player with a pistol, Micro SMG, shotgun or MP5 in turn and `accuracy` (90 − difficulty × 60), flagged
  * bPartOfAttackWave. Resolves to how many stood. */
 /** A gang war's attackers or defenders. CreateAttackWave (unreversed) is stood in for by a ring 2 to 5 units round the
  * nearest ped node. With `defenders`, `center` is CreateDefendingGroup's car node: each ped stands at the node plus
  * (sin, cos)(angle) × a random 0 to 3, plus 2 on both axes, on the ground found from 2 above the node. */
 async spawnAttackWave(gang:number,count:number,center:{x:number;y:number;z:number},accuracy:number,defenders=false){
  const catalog=this.catalog;if(!catalog||this.disposed)return 0;
  const node=this.nearestNode(center);if(!node)return 0;
  const members=catalog.gangs[gang]??[];if(!members.length)return 0;
  const guns=[22,28,25,29];let spawned=0;
  for(let i=0;i<count;i++){
   if(this.disposed)return spawned;
   const model=this.gangRoster?.choose(gang)??members[Math.floor(Math.random()*members.length)];
   const angle=i*2*Math.PI/count;let x:number,z:number,top:number;
   if(defenders){x=center.x+Math.sin(angle)*Math.random()*3+2;z=-(-center.z+Math.cos(angle)*Math.random()*3+2);top=center.y+2;}
   else{const r=2+Math.random()*3;x=node.position[0]+Math.sin(angle)*r;z=-node.position[1]+Math.cos(angle)*r;top=node.position[2]+3;}
   const hit=this.sim.world.castRay(new RAPIER.Ray({x,y:top,z},{x:0,y:-1,z:0}),6,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
   if(!hit)continue;
   let built:{source:import('../render/NativeCharacter').CharacterSource;speeds:{walk:number;run:number;sprint:number};stats:{attack:number;defend:number;pedType?:string;decisionMaker?:number}},weapon:Awaited<Catalog['weapon']>|undefined;
   try{built={source:await catalog.character(model),speeds:await catalog.characterSpeeds(model),stats:await catalog.characterStats(model)};}catch{continue;}
   try{weapon=await catalog.armedWith(guns[i%4]);}catch{try{weapon=await catalog.armedWith(22);}catch{weapon=undefined;}}
   if(this.disposed)return spawned;
   const position={x,y:top-hit.timeOfImpact+.03,z};
   const p=this.createPed({position,heading:angle,source:built.source,officer:false,node,weapon,speed:built.speeds.walk,speeds:built.speeds,stats:built.stats,gang,modelRef:model,gunAccuracy:accuracy});
   p.attackWave=true;p.retaliate=KILL_PED_ON_FOOT_SECONDS;p.flee=0;this.chooseTarget(p);spawned++;
  }
  return spawned;
 }
 /** CGangWars::AttackWaveOvercome: at most one attacker still living and none within 45 units of the player. */
 attackWaveOvercome(){
  let living=0,near=0;const pp=this.sim.player.position;
  for(const p of this.people){
   if(!p.attackWave)continue;
   if(p.health<=0){p.attackWave=false;continue;}
   living++;if(Math.hypot(p.actor.player.position.x-pp.x,p.actor.player.position.z-pp.z)<45)near++;
  }
  return living<=1&&near===0;
 }
 /** CGangWars::ReleasePedsInAttackWave: the attackers become ordinary peds (wandering again when `restoreWander`). */
 releaseAttackWave(restoreWander:boolean){
  let released=0;
  for(const p of this.people){if(!p.attackWave)continue;p.attackWave=false;released++;if(restoreWander){p.retaliate=0;p.foe=undefined;}}
  return released;
 }
 /** Living attackers' browser positions, for the radar. */
 attackWavePositions(){return this.people.filter(p=>p.attackWave&&p.health>0).map(p=>({x:p.actor.player.position.x,z:p.actor.player.position.z,gang:p.gang}));}
 /** CGangWars::TellGangMembersTo: at a war's start every gangster then in the pool but the Families is given
  * CTaskComplexKillPedOnFoot at the player (GangWars.cpp:677-693), once; gangsters made later are not. At its end
  * they wander again. */
 tellGangMembersTo(warEnding:boolean){
  for(const p of this.people){
   if(p.gang===undefined||p.gang===1)continue;
   if(!warEnding){p.warFoe=true;continue;}
   p.warFoe=false;if(!p.attackWave){p.retaliate=0;p.foe=undefined;}
  }
  if(warEnding)this.clearStreets=false;
 }
 /** CEventHandler::ComputeVehicleDiedResponse: the occupant of a car that blew up dies where he sat (health 0,
  * CTaskComplexDie by WEAPON_EXPLOSION with KO_shot_front). The ped stands in as the body at the seat and takes the
  * explosion at once. Authored: bRenderScorched (no scorched ped shader). */
 spawnDead(modelRef:number|string,position:{x:number;y:number;z:number},heading:number,gang?:number,recruit=false){
  // A recruit dies still a member of the group: CDarkel::RegisterKillByPlayer asks IsMember and counts him as one.
  // CPed::CreateDeadPedMoney returns at once for a ped that died bInVehicle (Ped.cpp:590-592): the body leaves no cash.
  return this.spawnFromCar(modelRef,position,heading,gang,0,p=>{if(recruit)p.follow=true;p.money=0;this.damageCollider(p.collider.handle,1000,{x:Math.sin(heading),z:Math.cos(heading)},'explosion');});
 }
 /** A driver the player dragged out (CEventDraggedOutCar answered by his decision maker, event 7; the car is the
  * one he lost). Only KILL_PED_ON_FOOT acts in the reversed handler: when the kill is appropriate (an unarmed victim
  * takes on an unarmed jacker) CreateStealCarBackSeq pauses 500 to 1500 ms or faces the jacker and shakes a fist,
  * then CTaskComplexStealCar runs at the car for 10 s; otherwise CTaskComplexSmartFleeEntity from the jacker for
  * good. A drawn flee or steal leaves no task: the victim walks off. Authored: re-entering and driving the car away.
  */
 spawnJacked(modelRef:number|string,position:{x:number;y:number;z:number},heading:number,gang:number|undefined,car:{position:()=>{x:number;y:number;z:number}},coach=false){
  return this.spawnFromCar(modelRef,position,heading,gang,0,p=>{
   // ComputeDraggedOutCarResponse (0x4BCC7E): a driver pulled out of a COACHCARANIMS vehicle always flees.
   if(coach){this.fleeFromPlayer(p,100000);return;}
   const task=this.decide(p,EVENT.draggedOutCar,this.relationshipTo(p),this.jackedRandom)??draggedOutDecisionTask(this.decisionMakerOf(modelRef)??p.decisionMaker,this.relationshipTo(p),this.jackedRandom);
   if(task!==TASK.killPedOnFoot)return;
   if(!isKillTaskAppropriate({createdByMission:!!p.mission,holdsGun:this.holdsGun(p),attackerHoldsGun:this.playerArmed()})){this.fleeFromPlayer(p,100000);return;}
   p.loiter=false;p.stealBack=this.jackedRandom()<.5?{phase:'pause',time:.5+this.jackedRandom(),car}:{phase:'face',time:0,car};
  });
 }
 /** CTaskComplexRoadRage after the driver's CTaskComplexLeaveCar: the ped turns to face the player, shakes a fist and
  * comes for him (CTaskComplexKillPedOnFoot after a 20 s seek). Authored: the bat, golf club or shovel half the
  * ragers draw and a gangster's pistol are not modelled; the fight is unarmed. */
 spawnRoadRage(modelRef:number|string,position:{x:number;y:number;z:number},heading:number,gang?:number){
  return this.spawnFromCar(modelRef,position,heading,gang,0,p=>{p.loiter=true;p.rage={phase:'face',time:0};});
 }
 /** The pedstats default decision maker of a driver's model (0 gang member, 1 cop, 2 normal, 3 tough, 4 weak), once
  * its stats are loaded; a roster name is fetched on first ask. */
 decisionMakerOf(modelRef:number|string):number|undefined{
  const c=this.catalog;if(!c)return undefined;
  if(typeof modelRef==='number')return c.modelStats[modelRef%Math.max(1,c.modelStats.length)]?.decisionMaker;
  if(this.decisionMakers.has(modelRef))return this.decisionMakers.get(modelRef);
  this.decisionMakers.set(modelRef,undefined);
  void c.characterStats(modelRef).then(stats=>{this.decisionMakers.set(modelRef,stats.decisionMaker);}).catch(()=>{});
  return undefined;
 }
 private decisionMakers=new Map<string,number|undefined>();
 private spawnFromCar(modelRef:number|string,position:{x:number;y:number;z:number},heading:number,gang:number|undefined,flee:number,after:(p:Pedestrian)=>void){
  const catalog=this.catalog;if(!catalog||this.disposed)return false;
  // A driver drawn from the packaged roster before the zone roster streamed (the occupants' fallback) steps out as a
  // resident of the zone instead: native drivers are zone residents (ChooseCivilianOccupationForVehicle), so the
  // zone's race mask holds for the ped on the street.
  if(typeof modelRef==='number'&&this.roster?.loaded.length)modelRef=this.roster.loaded[modelRef%this.roster.loaded.length];
  const node=this.nearestNode(position);if(!node)return false;
  if(typeof modelRef==='string'){
   // A zone roster driver keeps his model when dragged out (the ped catalog has it resident already).
   void Promise.all([catalog.character(modelRef),catalog.characterSpeeds(modelRef),catalog.characterStats(modelRef)]).then(([source,speeds,stats])=>{if(!this.disposed)after(this.createPed({position,heading,source,officer:false,node,flee,speed:speeds.walk,speeds,stats,modelRef,gang}));}).catch(()=>{});
   return true;
  }
  const modelIndex=modelRef;
  after(this.createPed({position,heading,source:catalog.models[modelIndex%catalog.models.length],officer:false,node,flee,speeds:catalog.modelSpeeds[modelIndex%catalog.models.length],stats:catalog.modelStats[modelIndex%catalog.models.length],modelRef:modelIndex%catalog.models.length,gang}));return true;
 }
 private fleeCar(p:Pedestrian|undefined,flee?:{from:{x:number;z:number};safe:number}){
  if(!p||!flee)return;
  p.flee=SMART_FLEE_SECONDS;p.fleeFrom={...flee.from};p.fleePlayer={safe:flee.safe,check:SMART_FLEE_CHECK_SECONDS,point:{...flee.from}};
 }
 /** CEventVehicleOnFire reaching the peds on foot within 10 units: gang members' decision (GangMbr.ped) is
  * CTaskComplexSmartFleeEntity 15 units from the car; random civilians (R_*.ped) have no on-foot choice and stay. */
 vehicleOnFire(at:{x:number;z:number}){
  for(const p of this.people){
   if(p.officer||p.health<=0||p.down>0||p.gang===undefined||p.follow)continue;
   const q=p.actor.player.position;if(Math.hypot(q.x-at.x,q.z-at.z)>10)continue;
   // Priority 54: a ped answering damage (65) keeps fighting.
   if(!this.takesPriority(p,EVENT.vehicleOnFire))continue;
   p.event={type:EVENT.vehicleOnFire};p.flee=Math.max(p.flee,SMART_FLEE_SECONDS);p.fleeFrom={...at};p.fleePlayer={safe:15,check:SMART_FLEE_CHECK_SECONDS,point:{...at}};p.retaliate=0;
  }
 }
 /** A police crew member stepping out of a cop car (CCopPed type model and weapon). */
 async spawnOfficer(model:string,weapon:number,position:{x:number;y:number;z:number},heading:number,crew?:{unit:object;seat:number;roadblock?:boolean},accuracy=60,cullExtraFarAway=false){
  const catalog=this.catalog;if(!catalog||this.disposed)return false;
  const [built,armed]=await Promise.all([catalog.character(model).then(async source=>({source,speeds:await catalog.characterSpeeds(model),stats:await catalog.characterStats(model)})),catalog.armedWith(weapon,true)]);
  const node=this.nearestNode(position);if(!node||this.disposed)return false;
  const cop=this.createPed({position,heading,source:built.source,officer:true,node,weapon:armed,speeds:built.speeds,stats:built.stats,gunAccuracy:accuracy,modelRef:model});cop.crew=crew;
  // CCopPed's constructor sets the shooting rate with the accuracy: 30/60 city, 70/68 SWAT, 60/76 FBI, 80/84 army.
  cop.shootingRate=({60:30,68:70,76:60,84:80} as Record<number,number>)[accuracy]??30;cop.cullExtraFarAway=cullExtraFarAway;return cop.id;
 }
 /** A police unit's living crew on foot. */
 /** The police dropped this unit: its crew on foot lose the car's protection from the population manager. */
 releaseCrew(unit:object){for(const p of this.people)if(p.crew?.unit===unit)p.crew=undefined;}
 footCrew(unit:object){return this.people.filter(p=>p.crew?.unit===unit&&p.health>0).map(p=>({id:p.id,seat:p.crew!.seat,position:{...p.actor.player.position},down:p.down>0||p.stealth!==undefined}));}
 /** CTaskComplexGoToCarDoorAndStandStill: run to a car door point, walking within 4 units; undefined resumes the pursuit. */
 /** An officer's go-to; with `arrive` (CTaskComplexGoToPointAndStandStill's radius) the task ends on arrival. */
 sendOfficer(id:number,point?:{x:number;z:number},walk=false,arrive?:number){const p=this.people.find(p=>p.id===id);if(p)p.goTo=point&&{...point,walk,arrive};}
 /** The cop reached the door: the car's entry sequence takes over from the street ped. */
 boardOfficer(id:number){const i=this.people.findIndex(p=>p.id===id);if(i<0)return false;this.remove(this.people[i]);this.people.splice(i,1);return true;}
 /** A follower climbs into a passenger seat: leaves the street, keeping crew state for the ride. */
 boardPassenger(id:number){
  const i=this.people.findIndex(p=>p.id===id);if(i<0)return undefined;
  const [p]=this.people.splice(i,1);this.remove(p);
  // The same ped rides and gets out: CPed keeps his weapons, health and gang in the car.
  const keep:PassengerKeep={weapon:p.weapon,health:p.health,gang:p.gang,gangClips:p.gang!==undefined};
  return {modelRef:p.modelRef,follow:p.follow,gang:p.gang,keep};
 }
 /** CPopulation::AddPed (0x612710) through a script's CREATE_CHAR: the model loaded, the ped stood where the
  * script says and flagged PED_MISSION, so the population manager leaves it alone until the script lets go.
  * Resolves to nothing when the model cannot be loaded, which is the handle the script then finds empty. */
 async spawnScripted(modelRef:number|string,position:{x:number;y:number;z:number},heading:number){
  // CREATE_CHAR never fails for want of the model: the script streamed it first. A script that runs before the
  // browser's ped catalog has finished loading waits for it instead of losing the ped.
  const catalog=this.catalog??await this.catalogLoad;if(!catalog||this.disposed)return undefined;
  // The ped's wander target is its nearest path node. The path areas stream in around the player with the
  // population's own checks, so a script that runs first loads them rather than losing the ped.
  if(!this.nearestNode(position)){const at=this.sim.player.position;await catalog.loadAround(at.x,at.z);if(this.disposed)return undefined;}
  const node=this.nearestNode(position);if(!node)return undefined;
  let made:Pedestrian|undefined;
  if(typeof modelRef==='number'){
   const index=((modelRef%catalog.models.length)+catalog.models.length)%catalog.models.length;
   made=this.createPed({position,heading,source:catalog.models[index],officer:false,node,speed:0,speeds:catalog.modelSpeeds[index],stats:catalog.modelStats[index],modelRef:index});
  }else{
   let built:{source:import('../render/NativeCharacter').CharacterSource;speeds:{walk:number;run:number;sprint:number};stats:{attack:number;defend:number;temper?:number}};
   try{built={source:await catalog.character(modelRef),speeds:await catalog.characterSpeeds(modelRef),stats:await catalog.characterStats(modelRef)};}
   catch{return undefined;}
   if(this.disposed)return undefined;
   made=this.createPed({position,heading,source:built.source,officer:false,node,speed:0,speeds:built.speeds,stats:built.stats,modelRef});
  }
  made.mission=true;made.flee=0;made.order=this.defaultOrder(made);
  return made;
 }
 /** CPed::ProcessBuoyancy's physicalFlags.bSubmergedInWater: the origin, a unit above the feet, 0.6 under the
  * surface, which is the same test the drowning pass makes. */
 submerged(ped:Pedestrian){
  const q=ped.actor.player.position,water=this.waterLevel?.(q.x,-q.z);
  return water!==undefined&&q.y+PED_ORIGIN_HEIGHT+0.6<water;
 }
 /** CTheScripts::IsPedStopped for a ped on foot: standing in place, on the ground, and not shifting. */
 standingStill(ped:Pedestrian){return !ped.air&&ped.landing===undefined&&ped.down===0&&ped.actor.player.speed<=0.01;}
 /** Whether the ped is where the camera can see it, which the population pass already decides. */
 onScreen(ped:Pedestrian){return !this.canSpawn(ped.actor.player.position,2);}
 /** A script's task, carried out. CTaskComplexWanderStandard is what a street ped does unasked, so wandering
  * is the absence of an order; CTaskComplexDie kills the ped whatever it is proof against, because the task is
  * not damage; a smart flight sets the same flee the browser's own jacking and fright already use. */
 /** A round from a shooter the peds do not hold themselves (a script's drive-by rider) meeting a ped's collider: the
  * ped takes it and reacts as it does to one of the peds' own rounds, unless proofed or only the player may hurt it.
  * Whether the collider was a ped's. */
 bulletHit(collider:number,damage:number,weapon:number,direction:{x:number;z:number},end:Vector3){
  const victim=this.people.find(other=>other.collider.handle===collider);if(!victim)return false;
  if(pedProofedAgainst(victim,'bullet')||!npcDamageReaches(victim,{},weapon,true))return true;
  victim.lastDamagedBy={};victim.health=healthAfter(victim.health,damage);if(damage>0)victim.lastWeaponDamage=weapon;
  if(!victim.health)this.onKill?.({id:victim.id,officer:victim.officer,gang:victim.gang,pedType:victim.pedType,recruit:!!victim.follow,byPlayer:false});
  const vq=victim.actor.player.position,vfrom={x:vq.x-direction.x,z:vq.z-direction.z};
  this.applyReaction(victim,this.damageReaction(victim,weapon,damage,vfrom,end,false),vfrom);
  return true;
 }
 giveOrder(ped:Pedestrian,order:ScriptedPedOrder){this.giveSequence(ped,[order],false,false);}
 /** CTaskComplexSequence through PERFORM_SEQUENCE_TASK: the tasks run in the order they were added, and a
  * repeating sequence starts again at the first when the last one ends. Each sequence the script records holds
  * eight tasks at most; nested ones arrive run inline, so the list can be longer. PERFORM_SEQUENCE_TASK_FROM_PROGRESS
  * starts part way in (`start`), and a repeat still starts again from the first. */
 giveSequence(ped:Pedestrian,orders:readonly ScriptedPedOrder[],repeat:boolean,sequence=true,start=0){
  if(ped.health<=0)return;
  // CPedIntelligence::SetTaskDuringLife replaces the primary task, so whatever the ped was busy with stops:
  // an attractor it had queued for, and a road crossing it had begun.
  if(ped.attract)this.leaveAttractor(ped);
  ped.crossing=undefined;
  ped.sequence={orders:[...orders],at:Math.min(Math.max(0,start),orders.length),repeat,sequence};
  this.startNextOrder(ped);
 }
 /** CTaskComplexSequence::m_CurrentTaskIndex of the ped's script sequence (GET_SEQUENCE_PROGRESS), -1 with none: a
  * single task given on its own is no sequence. */
 sequenceProgress(ped:Pedestrian){const s=ped.sequence;return s?.sequence?s.at-1:-1;}
 /** Begin the sequence's next task, skipping past the ones that are over as soon as they start. A repeating
  * sequence of nothing but those would never yield, so it is given one pass through its tasks. */
 private startNextOrder(ped:Pedestrian){
  for(let step=0,steps=ped.sequence?.orders.length??0;step<=steps;step++){
   const sequence=ped.sequence;
   if(!sequence){ped.order=this.defaultOrder(ped);return;}
   if(sequence.at>=sequence.orders.length){
    if(!sequence.repeat){ped.sequence=undefined;ped.order=this.defaultOrder(ped);return;}
    sequence.at=0;
   }
   this.applyOrder(ped,sequence.orders[sequence.at++]);
   if(ped.order)return;
  }
  ped.sequence=undefined;ped.order=this.defaultOrder(ped);
 }
 /** TASK_PRIMARY_DEFAULT for a ped with no primary task. CPed's constructor sets the looped CTaskSimpleStandStill
  * (Ped.cpp), and only CPopulation::AddPed with makeWander swaps in the wander. So a ped a script made stands where
  * it is between the script's tasks, and a street ped goes back to wandering. */
 private defaultOrder(ped:Pedestrian):Pedestrian['order']{
  return ped.mission&&!ped.scriptWanders?{kind:'standStill',remaining:Number.POSITIVE_INFINITY,isDefault:true}:undefined;
 }
 /** A script's task, carried out. CTaskComplexWanderStandard is what a street ped does unasked, so wandering
  * is the absence of an order; CTaskComplexDie kills the ped whatever it is proof against, because the task is
  * not damage; a smart flight sets the same flee the browser's own jacking and fright already use. */
 private applyOrder(ped:Pedestrian,order:ScriptedPedOrder){
  ped.order=undefined;ped.scriptWanders=order.kind==='wander';
  // A clip a script left on its last frame holds the pose until the ped's next task replaces it.
  if(ped.heldScriptClip!==undefined){if(ped.view.reactionName===ped.heldScriptClip)ped.view.clearReaction();ped.heldScriptClip=undefined;}
  switch(order.kind){
   case 'standStill':ped.order={kind:'standStill',remaining:order.seconds};ped.flee=0;ped.loiter=false;break;
   // The script's point is (x, y, z) up; the renderer's is (x, z, -y) with y up.
   case 'goToPoint':ped.order={kind:'goToPoint',x:order.x,z:-order.y,y:order.z>MAP_Z_LOW_LIMIT?order.z:undefined,moveState:order.moveState,
    radius:order.radius,moveStateRadius:order.moveStateRadius,remaining:order.seconds};ped.flee=0;ped.loiter=false;break;
   // The script's degrees clockwise from north are the browser's yaw plus half a turn.
   case 'achieveHeading':ped.order={kind:'achieveHeading',heading:order.degrees*Math.PI/180+Math.PI};break;
   // Wandering is what the ped does with no task at all, so it ends the sequence rather than joining it.
   case 'wander':ped.sequence=undefined;ped.flee=0;ped.loiter=false;this.chooseTarget(ped);break;
   case 'killPed':{
    const target=this.resolveScriptPed?.(order.target);if(!target)break;
    ped.order={kind:'killPed',foe:target==='player'?undefined:target,remaining:order.seconds};
    ped.flee=0;ped.fleePlayer=undefined;ped.loiter=false;ped.foe=ped.order.foe;ped.retaliate=Math.max(ped.retaliate,1);
    break;
   }
   case 'playAnim':{
    const clip=order.name.toLowerCase(),own={kind:'playAnim' as const,clip,loop:order.loop,hold:order.keepLastFrame,release:!!order.release,remaining:order.seconds,started:false,elapsed:0};
    ped.order=own;ped.flee=0;ped.loiter=false;
    const catalog=this.catalog;
    // A PED clip may already be on the ped; any other is fetched from its block and put on it once read. A block or
    // clip that is not there ends the task.
    if(!ped.view.hasReaction(clip)||order.file.toLowerCase()!=='ped'){
     const loading=catalog?.scriptAnimation(order.file,order.name)??Promise.resolve(undefined);
     void loading.then(animation=>{
      if(this.disposed||ped.order!==own)return;
      if(!animation){this.startNextOrder(ped);return;}
      ped.view.installReactions({[clip]:animation});own.started=false;
     });
     own.started=true;own.elapsed=-1;
    }
    break;
   }
   // g_ikChainMan.LookAt through the trigger task, which ends at once: the look outlives it.
   case 'lookAt':{
    const target=this.resolveScriptPed?.(order.target);if(!target)break;
    ped.lookTarget=target==='player'?undefined:target;ped.lookAt=undefined;ped.lookAtAttractor=false;
    ped.look=startLookAt(this.clock*1000,order.seconds*1000);
    break;
   }
   // CTaskComplexEvasiveDiveAndGetUp with its heading first (the dive's way, script x and y): the evasive dive the
   // ped already makes from cars, with the script's time lying down.
   case 'diveAndGetUp':
    ped.evade={kind:'dive',phase:'turn',time:0,heading:Math.atan2(order.x,-order.y),avoid:{x:order.x,z:-order.y},lie:order.seconds};
    ped.order={kind:'dive'};
    break;
   case 'lookAtPoint':
    ped.lookTarget=undefined;ped.lookAt={x:order.x,y:order.z,z:-order.y};ped.lookAtAttractor=false;
    ped.look=startLookAt(this.clock*1000,order.seconds*1000);
    break;
   case 'threatScanner':ped.threatScanner={onFoot:order.onFoot,inCar:order.inCar,duringScriptTask:order.duringScriptTask};break;
   case 'decisionMaker':ped.decisionMaker=order.index;break;
   case 'kindaStayInSamePlace':this.setFlag(ped,'kindaStayInSamePlace',order.state);break;
   case 'goToPointShooting':{
    const resolved=this.resolveScriptPed?.(order.target);if(!resolved)break;
    ped.order={kind:'goToPointShooting',x:order.x,z:-order.y,y:order.z>MAP_Z_LOW_LIMIT?order.z:undefined,moveState:order.moveState,radius:order.radius,
     target:resolved==='player'?undefined:resolved,player:resolved==='player'};ped.flee=0;ped.loiter=false;
    break;
   }
   case 'gunAt':{
    // An unarmed ped has no gun to control: the task is over at once.
    if(!ped.weapon&&ped.weaponType===undefined)break;
    let target:Pedestrian|undefined,player=false;
    if(order.target!==undefined){const resolved=this.resolveScriptPed?.(order.target);if(!resolved)break;if(resolved==='player')player=true;else target=resolved;}
    ped.order={kind:'gunAt',point:order.point&&{x:order.point.x,y:order.point.z,z:-order.point.y},target,player,fire:order.fire,remaining:order.seconds};
    ped.flee=0;ped.loiter=false;
    break;
   }
   case 'destroyCar':
    // IsTypeMelee on the active weapon: no gun (or a melee weapon, types below 16) fights the car with fists.
    ped.order={kind:'destroyCar',vehicle:order.vehicle,melee:!ped.weapon&&(ped.weaponType===undefined||ped.weaponType<16),phase:'first',remaining:0};
    ped.flee=0;ped.loiter=false;
    break;
   case 'duck':
    ped.actor.player.crouched=order.crouch;
    if(order.seconds!==undefined)ped.order={kind:'duckFor',remaining:order.seconds};
    break;
   case 'chat':{
    const resolved=this.resolveScriptPed?.(order.partner);if(!resolved)break;
    // CreateFirstSubTask: the listener stands (CTaskSimpleStandStill 999999 ms); the lead speaker chats
    // (CTaskSimpleChat, IDLE_chat for the same time).
    const own={kind:'chat' as const,partner:resolved==='player'?undefined:resolved,chatter:order.chatter,stage:order.stage,finished:false,noChat:0,remaining:CHAT_SECONDS};
    ped.order=own;ped.flee=0;ped.loiter=false;
    if(order.chatter){
     const play=()=>{if(!this.disposed&&ped.order===own&&ped.view.hasReaction(CHAT_CLIP))ped.view.playReaction(CHAT_CLIP,Number.POSITIVE_INFINITY,false,0,true);};
     if(ped.view.hasReaction(CHAT_CLIP))play();
     else void (this.catalog?.scriptAnimation('PED','IDLE_chat')??Promise.resolve(undefined)).then(animation=>{
      if(!animation||this.disposed||ped.order!==own)return;
      ped.view.installReactions({[CHAT_CLIP]:animation});play();
     });
    }
    break;
   }
   case 'followNodeRoute':{
    // ComputePathNodes: the target is put a unit above the ground under it first. A point on the map's floor
    // (MAP_Z_LOW_LIMIT) is looked for from above the ped instead of from under the map.
    const q=ped.actor.player.position,top=order.z>MAP_Z_LOW_LIMIT?order.z+1:q.y+PED_ORIGIN_HEIGHT+50;
    const ground=this.groundUnder(order.x,-order.y,top),target={x:order.x,y:ground===undefined?Math.max(order.z,q.y+PED_ORIGIN_HEIGHT):ground+1,z:-order.y};
    ped.order={kind:'followNodeRoute',target,...this.planNodeRoute(ped,target),at:0,moveState:order.moveState,remaining:order.seconds};ped.flee=0;ped.loiter=false;
    break;
   }
   case 'followRoute':
    ped.order={kind:'followRoute',points:order.points.map(q=>({x:q.x,y:q.z,z:-q.y})),at:0,mode:order.mode,traversals:0,moveState:order.moveState};ped.flee=0;ped.loiter=false;
    break;
   case 'gotoPed':{
    const target=this.resolveScriptPed?.(order.target);if(!target)break;
    ped.order={kind:'gotoPed',target:target==='player'?undefined:target,radius:order.radius,remaining:order.seconds,offset:order.offset};ped.flee=0;ped.loiter=false;
    break;
   }
   case 'enterCar':{
    if(!this.resolveScriptVehicle?.(order.vehicle))break;
    ped.order={kind:'enterCar',vehicle:order.vehicle,seat:order.seat,remaining:order.seconds,seek:ENTER_CAR_SEEK_SECONDS,moveState:order.moveState??6};ped.flee=0;ped.loiter=false;
    break;
   }
   case 'die':{
    if(!order.name){this.damageCollider(ped.collider.handle,10000,{x:0,z:1},'bullet',{noSource:true},true);break;}
    // TASK_DIE_NAMED_ANIM: the ped dies with the script's clip, held on its last frame, once the clip is on it.
    const clip=order.name.toLowerCase(),die=()=>{
     if(ped.health<=0||!this.people.includes(ped))return;
     ped.health=0;this.hit(ped,0,1,0,clip,1000);ped.down=Infinity;ped.view.playReaction(clip,Infinity);
     this.onKill?.({id:ped.id,officer:ped.officer,gang:ped.gang,pedType:ped.pedType,recruit:!!ped.follow,byPlayer:false});
    };
    if(ped.view.hasReaction(clip)&&(order.file??'ped').toLowerCase()==='ped'){die();break;}
    void (this.catalog?.scriptAnimation(order.file??'ped',order.name)??Promise.resolve(undefined)).then(animation=>{
     if(this.disposed)return;
     if(animation)ped.view.installReactions({[clip]:animation});
     if(animation)die();else this.damageCollider(ped.collider.handle,10000,{x:0,z:1},'bullet',{noSource:true},true);
    });
    break;
   }
   case 'smartFlee':{
    ped.flee=Math.max(ped.flee,order.seconds===Number.POSITIVE_INFINITY?Number.MAX_SAFE_INTEGER:order.seconds);
    // The script's point is in its own coordinates; the browser's are the renderer's. A point at the very spot the ped
    // stands on leaves CTaskComplexSmartFleePoint no direction; CVector::Normalise turns that zero vector into (1, 0, 0),
    // so the ped flees east rather than standing for the whole flight.
    const q=ped.actor.player.position,from={x:order.from.x,z:-order.from.y};
    ped.fleeFrom=from.x===q.x&&from.z===q.z?{x:from.x-1e-3,z:from.z}:from;
    this.onFlee?.(ped,{...ped.actor.player.position});
    break;
   }
  }
 }
 /** The weapons a ped carries with their CWeapon::m_TotalAmmo. CPopulation::AddPed arms a street ped with 25001
  * rounds and CCopPed's constructor a police unit with 1000, a plain cop with a nightstick as well as the pistol;
  * a script's GIVE_WEAPON_TO_CHAR sets its own. */
 private carriedWeapons(p:Pedestrian){
  const out:{type:number;totalAmmo:number}[]=[];
  if(p.weaponType!==undefined)out.push({type:p.weaponType,totalAmmo:p.totalAmmo??0});
  if(p.weapon)out.push({type:p.weapon.info.type,totalAmmo:p.officer?1000:25001});
  if(p.officer&&p.weapon?.info.type===WEAPON.pistol)out.push({type:WEAPON.nightstick,totalAmmo:1000});
  return out;
 }
 /** CPed::SetWeaponSkill (SET_CHAR_WEAPON_SKILL): the ped's weapon takes that skill's weapon.dat row. */
 setWeaponSkill(ped:Pedestrian,skill:number){
  if(ped.weaponSkill===skill)return;ped.weaponSkill=skill;
  if(ped.weaponType!==undefined)this.giveWeapon(ped,ped.weaponType,ped.totalAmmo??0);
 }
 /** CPed::GiveWeapon through a script's GIVE_WEAPON_TO_CHAR. The type and the ammo are the ped's at once,
  * because the script asks after them on its very next instruction; the held model follows when it loads. */
 giveWeapon(ped:Pedestrian,weaponType:number,ammo:number){
  ped.weaponType=weaponType;ped.totalAmmo=ammo;
  const catalog=this.catalog;if(!catalog)return;
  // CPed::GetWeaponSkill: a script's ped reads its m_nWeaponSkill row (POOR 0, STD 1, PRO 2).
  void catalog.armedWith(weaponType,false,ped.weaponSkill??1).then(armed=>{
   if(this.disposed||!this.people.includes(ped)||ped.weaponType!==weaponType)return;
   ped.gun?.dispose();ped.gun=undefined;
   ped.weapon=armed;ped.gunState={time:0,rounds:armed.info.clip,reload:0,active:false};
   const asset=armed.asset;
   if(asset){
    const gun=modelObject(asset.model,asset.textures);gun.root.rotation.set(0,0,0);
    gun.root.traverse(obj=>{const i=obj.userData.nativeFrame;if(i!==undefined&&asset.model.frames[i].parent<0)obj.matrix.identity();delete obj.userData.nativeFrame;});
    ped.view.hand()?.add(gun.root);ped.gun=gun;
   }
   if(armed.clip)ped.view.installReactions({police_fire:armed.clip},true);
   if(armed.reloadClip)ped.view.installReactions({police_reload:armed.reloadClip},true);
  }).catch(()=>{});
 }
 /** CPed's look task, which CLEAR_LOOK_AT ends: the head goes back to following the ped's own facing. */
 clearLookAt(ped:Pedestrian){ped.look=undefined;ped.lookTarget=undefined;ped.view.setHeadLook(undefined,0);}
 /** CPedIntelligence::ClearTasks through a script's CLEAR_CHAR_TASKS: the ped drops what it was told to do and
  * goes back to the wander a street ped does unasked. */
 /** CPed::ClearWeapon on a street or script ped: it carries one weapon, which goes only if it is that one. */
 clearWeapon(ped:Pedestrian,weaponType:number){
  const held=ped.weapon?.info.type??ped.weaponType;if(held!==weaponType)return;
  ped.gun?.dispose();ped.gun=undefined;ped.weapon=undefined;ped.weaponType=undefined;ped.totalAmmo=undefined;ped.gunState=undefined;
 }
 /** CPedPlacement::FindZCoorForPed then SetPosn: the highest ground under two probes from half a unit above the
  * point (its origin height, or well above for a point on the ground), the ped's feet set on it. */
 private placeOnGround(ped:Pedestrian,x:number,z:number,originY?:number){
  const ground=this.groundUnder(x,z,(originY??ped.actor.player.position.y+PED_ORIGIN_HEIGHT+50)+.5);
  if(ground===undefined)return;
  const feet={x,y:ground,z};
  ped.actor.player.position={...feet};ped.actor.player.previous={...feet};
  ped.body.setTranslation({x,y:ground+.9,z},true);ped.collider.setTranslation({x,y:ground+.9,z});
 }
 /** The way a script ped walks toward `target` this frame, as a direction: straight, or round the nearest car in the
  * way by its corners (CTaskComplexWalkRoundCar, see nativeWalkRoundCar). Cars more than 10 units off are not looked at. */
 private roundCars(p:Pedestrian,target:{x:number;z:number},cars:Iterable<WorldCar>){
  const q=p.actor.player.position;
  let aim:{x:number;z:number}=target,nearest=Infinity;
  for(const car of cars){
   if(car.disposed)continue;
   const c=car.car.body.translation(),d2=(c.x-q.x)**2+(c.z-q.z)**2;if(d2>100||d2>=nearest)continue;
   const b=car.nativeBody,center=car.worldPoint({x:(b.boundsMin.x+b.boundsMax.x)/2,y:(b.boundsMin.y+b.boundsMax.y)/2,z:0}),ahead=car.worldPoint({x:0,y:1,z:0});
   const fx=ahead.x-c.x,fz=ahead.z-c.z,fl=Math.hypot(fx,fz);if(fl<1e-6)continue;
   const via=walkRoundCar(q,target,{center:{x:center.x,z:center.z},forward:{x:fx/fl,z:fz/fl},halfLength:(b.boundsMax.y-b.boundsMin.y)/2,halfWidth:(b.boundsMax.x-b.boundsMin.x)/2},
    WALK_ROUND_PAD,(from,to)=>this.fixedBetween(from,to,q.y+.5));
   if(via){aim=via;nearest=d2;}
  }
  return {x:aim.x-q.x,z:aim.z-q.z};
 }
 /** Whether the world's fixed geometry lies across a line at height `y` (a ped's knees): a wall or a kerb face. */
 private fixedBetween(from:{x:number;z:number},to:{x:number;z:number},y:number){
  const dx=to.x-from.x,dz=to.z-from.z,length=Math.hypot(dx,dz);if(length<1e-3)return false;
  return !!this.sim.world.castRay(new RAPIER.Ray({x:from.x,y,z:from.z},{x:dx/length,y:0,z:dz/length}),length,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
 }
 /** CTaskComplexFollowNodeRoute::SetTarget's ComputePathNodes and ComputeRoute from where the ped stands, in the
  * renderer's terms. */
 private planNodeRoute(ped:Pedestrian,target:{x:number;y:number;z:number}){
  const q=ped.actor.player.position,areas=this.catalog?.areas??new Map();
  const plan=planFollowNodeRoute({areas,clear:(from,to,maxHeightChange)=>this.wanderPathClear(from,to,maxHeightChange)},
   {x:q.x,y:-q.z,z:q.y+PED_ORIGIN_HEIGHT},{x:target.x,y:-target.z,z:target.y});
  return {points:plan.points.map(n=>({x:n.x,y:n.z,z:-n.y})),lastIsTarget:plan.lastIsTarget};
 }
 /** CPedGeometryAnalyser::IsWanderPathClear(from, to, maxHeightChange, 4) (unreversed), in native Z-up points: nothing
  * fixed across the line at the ped's middle, and the ground found at four steps along it, none rising or falling past
  * `maxHeightChange` from the one before. */
 private wanderPathClear(from:{x:number;y:number;z:number},to:{x:number;y:number;z:number},maxHeightChange:number){
  const ax=from.x,ay=from.z,az=-from.y,bx=to.x,by=to.z,bz=-to.y,length=Math.hypot(bx-ax,by-ay,bz-az);
  if(length>1e-3){
   const hit=this.sim.world.castRay(new RAPIER.Ray({x:ax,y:ay,z:az},{x:(bx-ax)/length,y:(by-ay)/length,z:(bz-az)/length}),length,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
   if(hit)return false;
  }
  let previous=from.z-PED_ORIGIN_HEIGHT;
  for(let i=1;i<=4;i++){
   const t=i/4,ground=this.groundUnder(ax+(bx-ax)*t,az+(bz-az)*t,Math.max(ay,by)+maxHeightChange);
   if(ground===undefined||Math.abs(ground-previous)>=maxHeightChange)return false;
   previous=ground;
  }
  return true;
 }
 /** SET_ANIM_GROUP_FOR_CHAR: the walkcycle's moves and their speeds on the ped. */
 setAnimGroup(ped:Pedestrian,group:string){
  const loco=this.catalog?.walkcycleLocomotion(group);if(!loco)return false;
  ped.view.setLocomotion({walk:loco.walk,run:loco.run,sprint:loco.sprint,idle:loco.idle});
  ped.walkSpeed=loco.speeds.walk;ped.runSpeed=loco.speeds.run;ped.sprintSpeed=loco.speeds.sprint;
  return true;
 }
 /** Whether a ped is still in the world. */
 hasPed(ped:Pedestrian){return this.people.includes(ped);}
 /** A clip from a script's animation block, for the player's own tasks too. */
 scriptAnimation(file:string,name:string){return this.catalog?.scriptAnimation(file,name)??Promise.resolve(undefined);}
 /** CPedPlacement::FindZCoorForPed for any point: the highest ground under two probes from half a unit above it. */
 groundUnder(x:number,z:number,top:number){
  let ground:number|undefined;
  for(const [ox,oz] of [[0,0],[.1,-.1]]){
   const hit=this.sim.world.castRay(new RAPIER.Ray({x:x+ox,y:top,z:z+oz},{x:0,y:-1,z:0}),100,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
   if(hit)ground=Math.max(ground??-Infinity,top-hit.timeOfImpact);
  }
  return ground;
 }
 /** CLEAR_CHAR_TASKS: the primary task goes, leaving the default. */
 clearTasks(ped:Pedestrian){
  // A named clip the task was running goes with it, and so does one held on its last frame.
  const clip=ped.order?.kind==='playAnim'?ped.order.clip:ped.heldScriptClip;
  if(clip!==undefined&&ped.view.reactionName===clip)ped.view.clearReaction();
  ped.heldScriptClip=undefined;ped.sequence=undefined;ped.goTo=undefined;ped.scriptWanders=false;ped.order=this.defaultOrder(ped);
 }
 /** Whether a script's own task still runs on the ped (the default stand is not one). */
 /** Whether the ped holds a task a script gave it. A dead ped holds none: CTaskComplexDie takes over its primary task,
  * and the scripted task's record is flushed (FINISHED_TASK). */
 hasScriptTask(ped:Pedestrian){return ped.health>0&&!!(ped.order&&!(ped.order.kind==='standStill'&&ped.order.isDefault)||ped.sequence||ped.goTo);}
 /** The teleport behind WARP_CHAR_FROM_CAR_TO_COORD: the ped's tasks are flushed, the point is dropped to the
  * ground and the ped set down on it. A browser ped a script made is never in a car, so there is nothing to
  * climb out of first. */
 warpToCoord(ped:Pedestrian,position:{x:number;y:number;z:number}){
  this.clearTasks(ped);
  const state=ped.actor.player;
  state.position={...position};state.previous={...position};
  ped.body.setTranslation({x:position.x,y:position.y+.9,z:position.z},true);
  this.rejoinWander(ped);
 }
 /** SET_CHAR_RELATIONSHIP and its clearing forms, through CAcquaintance's own routines. */
 setRelationship(ped:Pedestrian,acquaintance:number,pedType:number){
  this.acquaintanceOf(ped).setAs(acquaintance,1<<pedType);
 }
 clearRelationship(ped:Pedestrian,acquaintance:number,pedType:number){this.acquaintanceOf(ped).clearAs(acquaintance,1<<pedType);}
 /** CPed's m_acquaintance: CPed's constructor copies its ped type's ped.dat table, which the script's relationship
  * commands then edit. The copy is made when a command first needs it. */
 /** The acquaintance a ped holds the player in (PLAYER1): its own table once a command gave it one, else its type's
  * as ped.dat and the script's SET_RELATIONSHIP left it. */
 regardForPlayer(ped:Pedestrian){return (ped.acquaintance??this.pedTypeTable(ped.pedType)).idFor(0);}
 /** Whether a street gang's ped type (CGangs index) hates the player, as ped.dat and the script's relationships stand. */
 gangHatesPlayer(gang:number){const type=NATIVE_PED_TYPES[gangPedType(gang)];return !!type&&this.pedTypeTable(type).idFor(0)===ACQUAINTANCE_HATE;}
 acquaintanceOf(ped:Pedestrian){
  return ped.acquaintance??=this.copyOf(this.pedTypeTable(ped.pedType));
 }
 /** CPedType::ms_apPedTypes: each ped type's CAcquaintance, from ped.dat, which SET_RELATIONSHIP and CLEAR_RELATIONSHIP
  * edit. A ped copies its type's table when it is made (here, when a command first needs its own). */
 private readonly typeTables=new Map<string,NativeAcquaintance>();
 /** The ped types a script has edited: a ped of such a type with no table of its own reads its type's. */
 private readonly editedTypes=new Set<string>();
 pedTypeTable(pedType:string|undefined){
  const key=pedType??'';let table=this.typeTables.get(key);
  if(!table){table=this.pedTypeAcquaintance(pedType);this.typeTables.set(key,table);}
  return table;
 }
 private copyOf(table:NativeAcquaintance){const copy=new NativeAcquaintance();for(let id=0;id<5;id++)copy.set(id,table.get(id));return copy;}
 /** CPedType::SetPedTypeAsAcquaintance and ClearPedTypeAsAcquaintance with GetPedFlag(other), by ePedType index. */
 setPedTypeRelationship(acquaintance:number,pedType:number,other:number,on:boolean){
  const name=NATIVE_PED_TYPES[pedType];if(name===undefined||!(other>=0&&other<32))return;
  const table=this.pedTypeTable(name);if(on)table.setAs(acquaintance,1<<other);else table.clearAs(acquaintance,1<<other);
  this.editedTypes.add(name);
 }
 /** GetPedTypeAcquaintances(id, type) & GetPedFlag(other). */
 pedTypeRelationshipSet(acquaintance:number,pedType:number,other:number){
  const name=NATIVE_PED_TYPES[pedType];if(name===undefined||!(other>=0&&other<32))return false;
  return (this.pedTypeTable(name).get(acquaintance)&(1<<other)>>>0)!==0;
 }
 /** The player's own m_acquaintance, which SET_CHAR_RELATIONSHIP on the player edits: PLAYER1's ped.dat table. */
 get playerAcquaintance(){return this.playerOwnAcquaintance??=this.pedTypeAcquaintance('PLAYER1');}
 private playerOwnAcquaintance?:NativeAcquaintance;
 private pedTypeAcquaintance(pedType:string|undefined){
  const table=new NativeAcquaintance(),lists=pedType?this.catalog?.acquaintances.get(pedType):undefined;
  if(lists)for(const [id,names] of [[ACQUAINTANCE_RESPECT,lists.respect],[ACQUAINTANCE_LIKE,lists.like],[ACQUAINTANCE_DISLIKE,lists.dislike],[ACQUAINTANCE_HATE,lists.hate]] as const){
   let mask=0;for(const name of names){const type=nativePedType(name);if(type!==undefined)mask|=1<<type;}table.set(id,mask);
  }
  return table;
 }
 /** CLEAR_LOOK_AT on the player: the look it was given ends. */
 clearPlayerLookAt(){this.playerLook=undefined;this.playerLookTarget=undefined;this.playerLookPoint=undefined;}
 /** Whether the named animation is the reaction the ped is playing. */
 isPlayingAnim(ped:Pedestrian,animation:string){return (ped.view.reactionName??'').toLowerCase()===animation.toLowerCase();}
 /** How far through that animation the ped is, or nothing when it is playing something else. */
 animProgress(ped:Pedestrian,animation:string){return this.isPlayingAnim(ped,animation)?ped.view.reactionProgress:undefined;}
 /** A clip from a script's animation block, for a ped the host draws in a seat rather than on foot. */
 loadScriptAnimation(file:string,name:string){return this.catalog?.scriptAnimation(file,name)??Promise.resolve(undefined);}
 /** The combo a ped's fists swing: its fighting style's, once that style's clips are on its body, else UNARMED_1. */
 private fists(p:Pedestrian):{combo:string;clips:readonly [string,string,string]}{
  const combo=fightingStyleCombo(p.fightingStyle??4),swings=MELEE_SWING_CLIPS[combo];
  if(combo!=='UNARMED'&&swings){const clips=swings.attacks.map(n=>n.toLowerCase()) as unknown as [string,string,string];if(clips.every(c=>p.view.hasReaction(c)))return {combo,clips};}
  return {combo:'UNARMED',clips:['fighta_1','fighta_2','fighta_3']};
 }
 /** GIVE_MELEE_ATTACK_TO_CHAR on a ped: its style and moves, and the style's swings read from their block and put on
  * its body (the gym trainers box, fight kung fu or kickbox with the player). */
 setFightingStyle(p:Pedestrian,style:number,moves:number){
  p.fightingStyle=style;p.allowedAttackMoves=moves;
  const swings=MELEE_SWING_CLIPS[fightingStyleCombo(style)];if(!swings?.file)return;
  for(const name of swings.attacks)void this.loadScriptAnimation(swings.file,name).then(clip=>{if(clip&&!this.disposed&&p.fightingStyle===style)p.view.installReactions({[name.toLowerCase()]:clip});});
 }
 /** SET_CHAR_ANIM_SPEED and SET_CHAR_ANIM_CURRENT_TIME: the association the ped is playing under that name, if any. */
 setAnim(ped:Pedestrian,animation:string,change:{speed?:number;progress?:number}){setCharacterAnim(ped.view,animation,change);}
 /** HIDE_CHAR_WEAPON_FOR_SCRIPTED_CUTSCENE: the held model goes out of sight, and the ped keeps the weapon. */
 hideWeapon(ped:Pedestrian,hidden:boolean){ped.weaponHidden=hidden;if(ped.gun)ped.gun.root.visible=!hidden;}
 /** One of the CPed bits a script sets by name. */
 setFlag(ped:Pedestrian,flag:keyof NonNullable<Pedestrian['flags']>,value:boolean){(ped.flags??={})[flag]=value;}
 /** The civilian model the zone's own roster would have used, which is what CREATE_RANDOM_CHAR asks the game
  * to pick. Nothing while the roster has not streamed a model yet. */
 /** ChooseCivilianOccupation: with CWeather::Rain at 0.1 or more, no sunbather (BEACH_GUY or BEACH_GIRL) is chosen. */
 private rainSkip(){const catalog=this.catalog;return catalog&&(this.rain?.()??0)>=.1?(name:string)=>catalog.sunbather(name):undefined;}
 rosterCivilian(){return this.roster?.choose(name=>this.wearing(name),this.rainSkip());}
 /** CTheScripts::CleanUpThisPed: the ped becomes the population manager's again. */
 releaseScripted(ped:Pedestrian,keepTask=false){
  ped.mission=false;
  // bKeepTasksAfterCleanUp: the ped carries on with what it was doing.
  if(keepTask)return;
  // CleanUpThisPed on foot: a ped already wandering keeps it; any other primary task gives way to the wander.
  if(!ped.scriptWanders){ped.sequence=undefined;ped.order=undefined;ped.scriptWanders=true;this.rejoinWander(ped);this.chooseTarget(ped);}
 }
 /** CPopulation::RemovePed through a script's DELETE_CHAR. */
 removeScripted(ped:Pedestrian){
  const at=this.people.indexOf(ped);if(at<0)return false;
  this.remove(ped);this.people.splice(at,1);return true;
 }
 /** Whether the world still holds this ped, which a handle the streamer reclaimed no longer names. */
 holdsScripted(ped:Pedestrian){return this.people.includes(ped);}
 /** A passenger climbs out at a door point and rejoins the street. */
 /** CTaskSimpleCarJumpOut for a ped leaving a moving car: CAR_rollout_LHS or _RHS carries it on with the car's move
  * speed (m_initialVehSpeed), and it gets up from the front. Unlike a knockdown, nothing frightens it. */
 rollOut(p:Pedestrian,velocity:{x:number;z:number},clip:'car_rollout_lhs'|'car_rollout_rhs'){
  const fall=p.view.reactionDuration(clip);if(fall===undefined)return;
  const getUp=p.view.reactionDuration(getUpClip(clip))??1.37;
  p.down=fall+getUp;p.fallClip=clip;p.stuckUnderCar=false;p.impulse={x:velocity.x,z:velocity.z};
  p.view.playReaction(clip,fall);p.collider.setShape(new RAPIER.Ball(.3));
 }
 async spawnPassenger(modelRef:number|string,position:{x:number;y:number;z:number},heading:number,follow:boolean,keepValue?:unknown,rollout?:{velocity:{x:number;z:number};clip:'car_rollout_lhs'|'car_rollout_rhs'}){
  const keep=keepValue as PassengerKeep|undefined;
  const catalog=this.catalog;if(!catalog||this.disposed)return false;
  const node=this.nearestNode(position);if(!node)return false;
  if(typeof modelRef==='number'){
   const index=((modelRef%catalog.models.length)+catalog.models.length)%catalog.models.length;
   this.createPed({position,heading,source:catalog.models[index],officer:false,node,weapon:keep?.weapon,gang:keep?.gang,speed:catalog.modelSpeeds[index]?.walk??NATIVE_PED_WALK_SPEED,speeds:catalog.modelSpeeds[index],stats:catalog.modelStats[index],modelRef:index});
  }else{
   let built:{source:import('../render/NativeCharacter').CharacterSource;speeds:{walk:number;run:number;sprint:number};stats:{attack:number;defend:number;temper?:number}};
   try{built={source:await catalog.character(modelRef),speeds:await catalog.characterSpeeds(modelRef),stats:await catalog.characterStats(modelRef)};}
   catch{return false;}
   if(this.disposed)return false;
   this.createPed({position,heading,source:built.source,officer:false,node,weapon:keep?.weapon,gang:keep?.gang,speed:built.speeds.walk,speeds:built.speeds,stats:built.stats,modelRef});
  }
  const p=this.people[this.people.length-1];
  p.follow=follow;p.flee=0;
  if(keep){p.health=keep.health;if(keep.gangClips)p.view.installReactions(catalog.gangClips,true);}
  if(rollout)this.rollOut(p,rollout.velocity,rollout.clip);
  return true;
 }
 private allowed(n:PathNode){return n.kind==='pedestrian'&&!n.water&&!n.switchedOff&&!n.dontWander&&n.linkCount>0;}
 /** CTaskComplexSmartFleePoint hands a flee direction to a wander task (ComputeFleeDir and
  * CPathFind::FindNextNodeWandering are stubs). The browser follows the ped path network from the current node along
  * the link heading most directly away from the threat, and runs straight away when no link leads away or the network
  * is out of reach. */
 private fleeNode(p:Pedestrian,ax:number,az:number){
  const q=p.actor.player.position,al=Math.hypot(ax,az)||1,ux=ax/al,uz=az/al;
  const at=(n:PathNode)=>({x:n.position[0],z:-n.position[1]});
  let t=at(p.target),tx=t.x-q.x,tz=t.z-q.z,td=Math.hypot(tx,tz);
  if(td>20)return undefined;
  // Heading toward the threat along the current link: turn back to the node behind when that leads away.
  if((tx*ux+tz*uz)/(td||1)<-.2&&p.previousNode){
   const b=at(p.previousNode),bx=b.x-q.x,bz=b.z-q.z;
   if(bx*ux+bz*uz>0){const back=p.previousNode;p.previousNode=p.target;p.target=back;t=b;tx=bx;tz=bz;td=Math.hypot(bx,bz);}
  }
  if(td<.8||p.blocked>1||(tx*ux+tz*uz)/(td||1)<-.2){
   const a=this.catalog?.areas.get(p.target.address.area);if(!a)return undefined;
   const from=p.target;let best:PathNode|undefined,score=0;
   for(const ref of a.links.slice(from.baseLink,from.baseLink+from.linkCount)){
    const n=this.catalog?.areas.get(ref.area)?.nodes[ref.node];if(!n||!this.allowed(n))continue;
    const c=at(n),vx=c.x-t.x,vz=c.z-t.z,l=Math.hypot(vx,vz)||1,d=(vx*ux+vz*uz)/l;
    if(d>score){score=d;best=n;}
   }
   if(!best)return undefined;
   p.previousNode=from;p.target=best;p.blocked=0;t=at(best);
  }
  return t;
 }
 /** CTaskComplexWander::ScanForBlockedNode (0x671EF0, reversed): within 3 of its point beside the next node, the ped
  * re-routes when the closest ped's, then the closest vehicle's, collision bounding radius plus 1 covers that point. A
  * ped's is CTempColModels::ms_colModelPed1's bounding sphere, radius 1. */
 private wanderNodeBlocked(p:Pedestrian,to:{x:number;z:number},cars:Iterable<WorldCar>){
  const q=p.actor.player.position;if((to.x-q.x)**2+(to.z-q.z)**2>9)return false;
  let nearest:Pedestrian|undefined,nearestDistance=Infinity;
  for(const o of this.people){if(o===p||o.health<=0)continue;const d=(o.actor.player.position.x-q.x)**2+(o.actor.player.position.z-q.z)**2;if(d<nearestDistance){nearestDistance=d;nearest=o;}}
  if(nearest){const o=nearest.actor.player.position;if((o.x-to.x)**2+(o.z-to.z)**2<(PED_BOUND_RADIUS+1)**2)return true;}
  let closest:WorldCar|undefined,best=Infinity;
  for(const car of cars){const t=car.car.body.translation(),d=(t.x-q.x)**2+(t.z-q.z)**2;if(d<best){best=d;closest=car;}}
  const radius=closest?.assets?.collision?.bounds.radius;if(!closest||radius===undefined)return false;
  const t=closest.car.body.translation(),r=radius+1;
  return (t.x-to.x)**2+(t.z-to.z)**2<r*r;
 }
 /** CTrafficLights::LightForPeds on the shared light timer. */
 private lightForPeds(){return nativeTrafficLights(Math.floor(this.lightClock?.()??this.elapsed*1000)>>>0).pedestrians;}
 /** CTaskComplexWander starting a road crossing: CPathFind::TestCrossesRoad and TestForPedTrafficLight (reversed) read
  * the link's intersection flags (bit 0 road cross, bit 1 pedestrian light). The ped first turns to the heading of its
  * point at the next node (ComputeTargetHeading). CreateNextSubTask, which picks the task, is a retail stub. */
 private startCrossing(p:Pedestrian){
  const from=p.previousNode,to=p.target,a=from&&this.catalog?.areas.get(from.address.area);if(!from||!a)return;
  for(let i=0;i<from.linkCount;i++){
   const ref=a.links[from.baseLink+i];if(ref.area!==to.address.area||ref.node!==to.address.node)continue;
   const bits=a.intersections[from.baseLink+i]??0;
   if(bits&1){const w=this.wanderPoint(p),q=p.actor.player.position;p.crossing={heading:Math.atan2(w.x-q.x,w.z-q.z),lights:!!(bits&2),phase:'heading',time:0,standFor:0};}
   return;
  }
 }
 /** The ped's group ROADCROSS clip (animgrp.dat's fifth), installed on first use. */
 private playRoadCross(p:Pedestrian){
  const c=this.catalog;if(!c)return 0;
  const name=typeof p.modelRef==='string'?p.modelRef:c.modelNames[p.modelRef%Math.max(1,c.modelNames.length)],clipName=(name&&c.walkcycles.get(c.animGroupOf(name))?.roadcross)??'roadcross',clip=c.animations[clipName];
  if(!clip)return 0;
  if(!p.view.hasReaction('roadcross'))p.view.installReactions({roadcross:clip});
  p.view.playReaction('roadcross');return p.view.reactionDuration('roadcross')??clip.duration;
 }
 /** One frame of the crossing tasks; returns 0 while the ped waits, undefined once it may cross.
  * - CTaskSimpleAchieveHeading(heading, 0.5, 0.2): half the heading change rate until within 0.2 rad.
  * - Without a light: ROADCROSS once (CTaskSimpleRunAnim, blend 4), then cross.
  * - With one, CTaskComplexObserveTrafficLights: ROADCROSS, then CTaskSimpleStandStill for 3 to 5 s, repeated while
  *   LightForPeds is not green. Green ends a stand at once and a look when it finishes. */
 private stepCrossing(p:Pedestrian,dt:number){
  const c=p.crossing!,state=p.actor.player;
  if(p.health<=0||p.down>0||p.flee>0||p.retaliate>0||p.gunReact||p.evade||p.carReact||p.stagger>0){p.crossing=undefined;if(p.view.reactionName==='roadcross')p.view.clearReaction();return undefined;}
  if(c.phase==='heading'){
   let delta=c.heading-state.heading;delta=Math.atan2(Math.sin(delta),Math.cos(delta));
   const turn=p.headingChange*Math.PI/180*.5*50*dt;state.heading+=Math.max(-turn,Math.min(turn,delta));
   if(Math.abs(delta)<=.2){c.phase='anim';c.time=0;c.standFor=this.playRoadCross(p);}
   return 0;
  }
  c.time+=dt;
  const green=c.lights&&this.lightForPeds()===TRAFFIC_LIGHT.green;
  if(c.phase==='anim'){
   if(c.time<c.standFor)return 0;
   if(!c.lights||green){p.crossing=undefined;return undefined;}
   c.phase='stand';c.time=0;c.standFor=(3000+Math.floor(Math.random()*2000))/1000;return 0;
  }
  if(green){p.crossing=undefined;return undefined;}
  if(c.time>=c.standFor){c.phase='anim';c.time=0;c.standFor=this.playRoadCross(p);}
  return 0;
 }
 /** One frame of the melee kill task's water sequence: CTaskComplexTurnToFaceEntityOrCoord, then CTaskSimpleShakeFist
  * (FUCKU, blend 4), then CTaskSimpleStandStill(2000), repeated. */
 private stepShoreTaunt(p:Pedestrian,dx:number,dz:number,dt:number){
  const state=p.actor.player;let delta=Math.atan2(dx,dz)-state.heading;delta=Math.atan2(Math.sin(delta),Math.cos(delta));
  const turn=p.headingChange*Math.PI/180*50*dt;state.heading+=Math.max(-turn,Math.min(turn,delta));
  if(p.taunt===undefined){if(Math.abs(delta)>.2)return;p.taunt=0;}
  p.taunt-=dt;
  if(p.taunt<=0&&Math.abs(delta)<=.2){const shake=p.view.hasReaction('fucku')?p.view.reactionDuration('fucku')??1:1;if(p.view.hasReaction('fucku'))p.view.playReaction('fucku');p.taunt=shake+2;}
 }
 /** The ped's point beside its target node (TakeWidthIntoAccountForWandering), in browser x and z. */
 private wanderPoint(p:Pedestrian){const n=p.target,o=wanderTargetOffset(n.width,p.seed);return {x:n.position[0]+o.x,z:-(n.position[1]+o.y)};}
 /** CEventAttractor::AffectsPed (0x4AF4B0) for a wandering civilian passing a 2dfx attractor: it rolls under the effect's
  * ped-existing probability or ignores it; then under the second byte it only turns its head to it for 2 to 4 s, and
  * otherwise, when its decision maker answers with the effect, uses it, registering in the queue and walking to its slot. A shelter draws only while it rains. Which
  * attractors are near is CAttractorScanner's business, unreversed: those within ATTRACTOR_SCAN_RANGE, each rolled
  * once per ped. */
 private noticeAttractor(p:Pedestrian){
  const q=p.actor.player.position,near=this.attractorsNear?.(q.x,-q.z,ATTRACTOR_SCAN_RANGE);if(!near)return;
  for(const a of near){
   if(!ATTRACTOR_TYPES.has(a.type)||p.attractorsTried.has(a.key))continue;
   if(Math.hypot(a.position[0]-q.x,-a.position[1]-q.z)>ATTRACTOR_SCAN_RANGE)continue;
   p.attractorsTried.add(a.key);
   if(a.type===PED_ATTRACTOR.shelter&&(this.rain?.()??0)<.2)continue;
   const existing=a.probability&255,look=a.probability>>8&255;
   if(Math.random()*100>=existing)continue;
   if(Math.random()*100<look){
    if(!p.look){p.lookAt={x:a.position[0],y:a.position[2],z:-a.position[1]};p.lookAtAttractor=true;p.look=startLookAt(this.clock*1000,2000+Math.random()*2000);}
    continue;
   }
   // The event (made with no task of its own) then goes to the decision maker: street peds use the effect or let it be
   // (their row 27, source neutral), cops always would, and gang members and tough peds have no row, so never do.
   // ComputeAttractorResponse builds CTaskComplexUseEffect only for that answer. Without the files the ped uses it.
   const task=this.decide(p,EVENT.attractor,RELATIONSHIP.neutral);
   if(task!==undefined&&task!==TASK.useEffect)continue;
   const queue=this.attractorQueues.get(a.key)??new AttractorQueue(a),slot=queue.register(p.id);
   if(slot<0)continue;
   this.attractorQueues.set(a.key,queue);
   const pos=queue.slotPosition(slot);
   p.attract={key:a.key,type:a.type,phase:'go',goal:{x:pos[0],z:-pos[1]},time:0,until:Infinity,heading:queue.slotHeading(slot),slot,startAt:0};
   return;
  }
 }
 /** CTaskComplexAvoidOtherPedWhileWandering for a wanderer (its target does not move, so the task quits when its first
  * 200 ms timer runs out or the detour point is reached, and the wander takes over again). The avoid sphere is
  * reversed: 1.05 round the ped in the way, grown (ComputeSphere) to cover every nearby ped whose 1.05 sphere touches
  * it, same-group peds left out; so are the quits: over 3 in height, past 2.5 (+1 squared) away, and 30 frames of being stuck turning into a 0.5-2.5 s stand. What starts it
  * (CEventPotentialWalkIntoPed) and the route round the sphere (CPedGeometryAnalyser::ComputeRouteRoundSphere) are
  * unreversed: a ped closer than 2.5 ahead on the walking line starts it, and the detour is the point past the
  * sphere on the side the walker already leans to. Returns the direction to walk, a zero vector to stand, or undefined. */
 private avoidOtherPeds(p:Pedestrian,dt:number,dir:{x:number;z:number},target:{x:number;z:number}):{x:number;z:number}|undefined{
  const q=p.actor.player.position;
  if(p.avoid){
   const a=p.avoid,o=a.ped.actor.player.position;
   if(a.stand>0){a.stand-=dt;if(a.stand<=0)p.avoid=undefined;return {x:0,z:0};}
   // m_AnotherStaticCounter > 30 (a second at 30 fps: p.stuck) stands the ped still for 0.5-2.5 s, checked before the
   // height, distance and timer quits; standing is no go-to task, so the counter restarts. (It also asks for a touch
   // within four frames, which is not modelled.)
   if((p.stuck?.seconds??0)>WANDER_STUCK_SECONDS){a.stand=.5+Math.random()*2;p.stuck=undefined;return {x:0,z:0};}
   a.time+=dt;
   if(a.ped.health<=0||Math.abs(o.y-q.y)>=3||a.time>=.2){p.avoid=undefined;return undefined;}
   // (The same-heading quit waits 2 s, longer than a wanderer's 200 ms detour lasts, so it never comes into play here.)
   const d2=(o.x-q.x)**2+(o.z-q.z)**2;
   if(d2>=2.5**2+1){p.avoid=undefined;return undefined;}
   const dx=a.detour.x-q.x,dz=a.detour.z-q.z;
   if(dx*dx+dz*dz<.25){p.avoid=undefined;return undefined;}
   return {x:dx,z:dz};
  }
  const len=Math.hypot(dir.x,dir.z);if(!len)return undefined;
  const ux=dir.x/len,uz=dir.z/len;
  let blocker:Pedestrian|undefined,nearest=2.5;
  for(const o of this.people){
   if(o===p||o.health<=0||(p.party&&o.party===p.party)||(p.follow&&o.follow))continue;
   const r=o.actor.player.position,rx=r.x-q.x,rz=r.z-q.z,along=rx*ux+rz*uz;
   if(along<=0||along>=nearest||Math.abs(r.y-q.y)>=3)continue;
   if(Math.abs(rx*uz-rz*ux)<1.05+.35){nearest=along;blocker=o;}
  }
  if(!blocker)return undefined;
  // CEventPotentialWalkIntoPed goes to the decision maker (event 13): TASK_COMPLEX_AVOID_OTHER_PED_WHILE_WANDERING, or
  // no response (R_Tough's neutral column is half and half). The draw is made once for each ped met.
  if(p.walkIntoDecision?.ped!==blocker){const task=this.decide(p,EVENT.potentialWalkIntoPed,this.relationshipTo(p,blocker));p.walkIntoDecision={ped:blocker,avoid:task===undefined||task===TASK_AVOID_OTHER_PED_WHILE_WANDERING};}
  if(!p.walkIntoDecision.avoid)return undefined;
  // ComputeAvoidSphere: grow the 1.05 sphere to the cluster.
  const members=[blocker];let centre={x:blocker.actor.player.position.x,z:blocker.actor.player.position.z},radius=1.05;
  for(let grew=true;grew;){
   grew=false;
   for(const o of this.people){
    if(members.includes(o)||o===p||o.health<=0)continue;
    const r=o.actor.player.position;
    if(Math.hypot(r.x-centre.x,r.z-centre.z)<radius+1.05){members.push(o);grew=true;}
   }
   if(grew){
    centre={x:members.reduce((t,m)=>t+m.actor.player.position.x,0)/members.length,z:members.reduce((t,m)=>t+m.actor.player.position.z,0)/members.length};
    radius=Math.max(...members.map(m=>Math.hypot(m.actor.player.position.x-centre.x,m.actor.player.position.z-centre.z)));
   }
  }
  // The side the walker already leans to (its offset from the sphere's centre across the walking line), or its target's.
  const across=(q.x-centre.x)*uz-(q.z-centre.z)*ux,targetAcross=(target.x-centre.x)*uz-(target.z-centre.z)*ux;
  const side=Math.sign(across||targetAcross||1),clear=radius+1.05;
  const detour={x:centre.x+uz*side*clear+ux*.5,z:centre.z-ux*side*clear+uz*.5};
  p.avoid={ped:blocker,detour,time:0,stand:0};
  return {x:detour.x-q.x,z:detour.z-q.z};
 }
 /** CTaskSimpleGoToPoint::ProcessPed's arrival: within the 0.5 radius on the same level (under 2 in height from the
  * ped's origin, a unit above its feet), or its next step's predicted position has already passed the point. */
 private wanderArrived(p:Pedestrian,to:{x:number;z:number},dt:number){
  const state=p.actor.player,q=state.position,dx=to.x-q.x,dz=to.z-q.z,move=state.speed*dt;
  const nx=q.x+Math.sin(state.heading)*move,nz=q.z+Math.cos(state.heading)*move;
  if(dx*(to.x-nx)+dz*(to.z-nz)<=0)return true;
  return Math.hypot(dx,dz)<WANDER_TARGET_RADIUS&&Math.abs(q.y+1-p.target.position[2])<2;
 }
 /** CTaskComplexWander::ControlSubTask: a walker pressed against something for 30 frames without moving a quarter
  * unit (m_AnotherStaticCounter) scratches its head, then CreateNextSubTask turns the wander an eighth and takes the
  * link from its next node closest to that (UpdatePathNodes). */
 private scratchHead(p:Pedestrian){
  p.blocked=0;p.stuck=undefined;p.scratch=p.view.reactionDuration('xpressscratch')??1;if(p.view.hasReaction('xpressscratch'))p.view.playReaction('xpressscratch');
  const a=this.catalog?.areas.get(p.target.address.area);if(!a)return;
  const at=p.target.position,options=a.links.slice(p.target.baseLink,p.target.baseLink+p.target.linkCount).map(ref=>this.catalog?.areas.get(ref.area)?.nodes[ref.node]).filter((n):n is PathNode=>!!n&&this.allowed(n));
  const next=findNextNodeWandering(options.map(n=>({node:n,x:n.position[0]-at[0],y:n.position[1]-at[1],back:n===p.previousNode})),(p.wanderDir+1)%8);
  if(next){p.previousNode=p.target;p.target=next.node;p.wanderDir=next.dir;}
 }
 /** The wander's next node on reaching `p.target` (see ped/nativeWander). */
 /** `reroute`: ScanForBlockedNodes' UpdatePathNodes, which keeps the wander's direction (no UpdateDir draw). */
 private chooseTarget(p:Pedestrian,reroute=false){
  const a=this.catalog?.areas.get(p.target.address.area);if(!a)return;
  const at=p.target.position,options=a.links.slice(p.target.baseLink,p.target.baseLink+p.target.linkCount).map(ref=>this.catalog?.areas.get(ref.area)?.nodes[ref.node]).filter((n):n is PathNode=>!!n&&this.allowed(n));
  const links=options.map(n=>({node:n,x:n.position[0]-at[0],y:n.position[1]-at[1],back:n===p.previousNode}));
  const step=reroute?findNextNodeWandering(links,p.wanderDir):wanderStep(p.wanderDir,p.target.linkCount,this.frame,p.seed,links);
  if(step){p.previousNode=p.target;p.target=step.node;p.wanderDir=step.dir;}
 }
  /** Crew share the player's attackers (gang backup); homie-on-player violence never recruits the crew.
   * CPlayerPed::MakeGroupRespondToPlayerTakingDamage sends the whole group, however far each member is. */
  private defendPlayer(attacker:Pedestrian){
   if(attacker.follow)return;
   // CPlayerPed::MakeGroupRespondToPlayerTakingDamage returns while m_bMembersEnterLeadersVehicle is off, which
   // TellGroupToStartFollowingPlayer(false) clears: a group told to wait (H) stays where it was put.
   if(this.people.some(m=>m.follow&&m.holdPosition))return;
   for(const m of this.people){
    if(m===attacker||m.officer||!m.follow||m.health<=0||m.down>0)continue;
    m.foe=attacker;m.retaliate=Math.max(m.retaliate,4);m.flee=0;
   }
  }
  /** A brawler's blow landing on another ped: melee.dat damage scaled by the pedstats pair, the victim's
   * CEventDamage::ComputeAnim with the attacker's fight move, and the victim answers the attacker. */
  private strikeFoe(p:Pedestrian,foe:Pedestrian,stage:0|1|2,damage:number){
   if(pedProofedAgainst(foe,'melee')||!npcDamageReaches(foe,p,WEAPON.unarmed,false))return;
   foe.lastDamagedBy={ped:p};
   const applied=megaPunchBlow(WEAPON.unarmed)?foe.health:scaleBlow(damage,p.attackMult,foe.defendMult);foe.health=healthAfter(foe.health,applied);
   if(applied>0)foe.lastWeaponDamage=WEAPON.unarmed;
   this.onMeleeHit?.({...foe.actor.player.position},false);
   const q=p.actor.player.position,from={x:q.x,z:q.z};
   const reaction=this.damageReaction(foe,WEAPON.unarmed,applied,from,undefined,false,{move:stage});
   if(!this.applyReaction(foe,reaction,from)&&foe.health>0)foe.stagger=.5;
   if(!foe.health){p.foe=undefined;p.retaliate=0;p.fight=undefined;this.onKill?.({id:foe.id,officer:foe.officer,gang:foe.gang,pedType:foe.pedType,recruit:!!foe.follow,byPlayer:false});return;}
   if(!foe.officer){foe.foe=p;foe.retaliate=Math.max(foe.retaliate,4);foe.flee=0;}
  }
  /** SET_SCRIPT_LIMIT_TO_GANG_SIZE (m_nScriptLimitToGangSize, 99 at start) and the player group's
   * CPedGroupMembership::m_separationRange (60, SET_GROUP_SEPARATION_RANGE). */
  scriptGangLimit=99;groupSeparationRange=60;
  /** CPlayerPed::ProcessGroupBehaviour's buttons, GROUP_CONTROL_FWD (G) and GROUP_CONTROL_BWD (H), on foot. The function
   * is unreversed; the game's own help text states the rules: "Hold PED_LOCK_TARGET to target a gang member and press
   * GROUP_CONTROL_FWD or GROUP_CONTROL_BWD to recruit him to your group"; "Press GROUP_CONTROL_BWD to instruct your gang
   * to stay in position or GROUP_CONTROL_FWD to instruct them to follow you"; holding either for a few seconds disbands
   * the group (see `disbandGroup`). `target` is what the player targets while holding the target button: the ped under
   * a gun's crosshair (`handle`, -1 for none), else the nearest ped ahead within the weapon's target range. */
  groupControl(button:'forward'|'back',target?:{handle?:number;range:number}):'joined'|'full'|'follow'|'stay'|'none'{
   if(this.sim.player.health<=0)return 'none';
   const crew=this.people.filter(p=>p.follow&&p.health>0);
   const mark=target&&this.targetedRecruit(target);
   if(mark){
    // CPlayerPed::MakeThisPedJoinOurGroup's cap: FindMaxNumberOfGroupMembers, at most the script's limit.
    if(crew.length>=Math.min(maxGroupMembers(),this.scriptGangLimit))return 'full';
    mark.follow=true;mark.holdPosition=undefined;mark.flee=0;mark.foe=undefined;this.leaveParty(mark);
    return 'joined';
   }
   const listening=crew.filter(m=>!m.ignoresGroupCommands);if(!listening.length)return 'none';
   for(const m of listening)m.holdPosition=button==='back'?{...m.actor.player.position}:undefined;
   return button==='back'?'stay':'follow';
  }
  /** Holding a group button, or leaving the group behind, disbands it: every member that listens to the player's group
   * commands leaves. */
  disbandGroup(){
   const listening=this.people.filter(p=>p.follow&&p.health>0&&!p.ignoresGroupCommands);
   for(const m of listening)this.leaveGroup(m);
   return listening.length>0;
  }
  /** The living Families member the player targets, not yet in his group. */
  private targetedRecruit(target:{handle?:number;range:number}){
   const candidates=this.people.filter(p=>!p.officer&&p.health>0&&p.down===0&&p.gang===1&&!p.follow);
   if(target.handle!==undefined)return candidates.find(p=>p.collider.handle===target.handle);
   const origin=this.sim.player.position,h=this.sim.player.heading,ahead={x:Math.sin(h),z:Math.cos(h)};
   return candidates.map(p=>{const dx=p.actor.player.position.x-origin.x,dz=p.actor.player.position.z-origin.z,d=Math.hypot(dx,dz);return {p,d,along:d?(dx*ahead.x+dz*ahead.z)/d:1};})
    .filter(t=>t.d<=target.range&&t.along>Math.SQRT1_2).sort((a,b)=>a.d-b.d)[0]?.p;
  }
  /** MAKE_ROOM_IN_PLAYER_GANG_FOR_MISSION_PEDS (unreversed): room for `room` more in the player's group, whose size is
   * FindMaxNumberOfGroupMembers (at most the script's limit). The street recruits go first, as
   * CPedGroupMembership::RemoveNFollowers passes over the members a mission made, which `missionMembers` counts. */
  makeRoomForMissionPeds(room:number,missionMembers:number){
   const crew=this.people.filter(p=>p.follow&&p.health>0&&!p.mission);
   for(const m of crew.slice(0,followersToRemove(crew.length,missionMembers,room,Math.min(maxGroupMembers(),this.scriptGangLimit))))this.leaveGroup(m);
  }
  /** CPedGroupMembership::AddFollower takes a ped out of the group it was in: a recruit leaves his street gang's
   * party, and a party that loses its leader, or is left with one member, breaks up. */
  private leaveParty(p:Pedestrian){
   const party=p.party;if(!party)return;
   p.party=undefined;p.hangout=undefined;p.lookTarget=undefined;
   const rest=party.members.filter(m=>m!==p);
   if(party.leader===p||rest.length<2){for(const m of rest){m.party=undefined;m.hangout=undefined;m.lookTarget=undefined;}return;}
   party.members.splice(0,party.members.length,...rest);
  }
  /** A car touching an upright pedestrian. The response is the ped branch of
   * CPhysical::ApplyCollision, with the car counting ten times its mass; car and ped
   * colliders do not push each other in the solver. Above PED_CAR_KILL_INTENSITY
   * (authored, because CPed::KillPedWithCar is a retail stub) the reversed
   * CTaskSimpleKillPedWithCar runs. Faster than 2 m/s the ped is knocked down;
   * slower, it is only pushed. Normal and contact point are taken from the ped
   * centre towards the car's centre of mass. */
  private carStrikesPed(striker:PedStriker,p:Pedestrian){
   type V={x:number;y:number;z:number};
   const toNative=(v:V):V=>({x:v.x,y:-v.z,z:v.y}),fromNative=(v:V):V=>({x:v.x,y:v.z,z:-v.y}),car=striker.car;
   const body=striker.body,com=body.worldCom(),at=p.body.translation(),linvel=body.linvel(),angvel=body.angvel();
   const flat={x:com.x-at.x,z:com.z-at.z},reach=Math.hypot(flat.x,flat.z);if(reach<1e-4)return;
   const normal={x:flat.x/reach,y:0,z:flat.z/reach},physics=striker.nativeBody;
   const heading=p.actor.player.heading,pedSpeed=p.actor.player.speed;
   const pedMove={x:(Math.sin(heading)*pedSpeed+p.impulse.x)/50,y:0,z:(Math.cos(heading)*pedSpeed+p.impulse.z)/50};
   const impact=carHitsPed({mass:physics.mass,turnMass:physics.turnMass,elasticity:VEHICLE_ELASTICITY,offset:toNative({x:at.x-com.x,y:at.y-com.y,z:at.z-com.z}),
    moveSpeed:toNative({x:linvel.x/50,y:linvel.y/50,z:linvel.z/50}),turnSpeed:toNative({x:angvel.x/50,y:angvel.y/50,z:angvel.z/50})},toNative(pedMove),toNative(normal));
   if(!impact)return;
   // ApplyCollision's ReportCollision both ways: the car's intensity over its mass, the ped's over his.
   if(car)this.onCarPedCollision?.(car,p.collider.handle,{x:at.x,y:at.y,z:at.z},normal,impact.vehicleIntensity/physics.mass,impact.pedIntensity/PED_MASS);
   const addCarForce=(force:V)=>{const dv=fromNative(force);body.setLinvel({x:linvel.x+dv.x/physics.mass*50,y:linvel.y+dv.y/physics.mass*50,z:linvel.z+dv.z/physics.mass*50},true);};
   const speed=Math.hypot(linvel.x,linvel.z),crime=()=>{if(striker.occupied)this.law?.registerCrime(p.officer?CRIME.killCopPedWithCar:CRIME.killPedWithCar,`ped:${p.id}`,this.policeDontCare(`ped:${p.id}`));};
   if(impact.pedIntensity>PED_CAR_KILL_INTENSITY){
    const r=body.rotation(),q=new Quaternion(r.x,r.y,r.z,r.w),axis=(x:number,y:number,z:number)=>toNative(new Vector3(x,y,z).applyQuaternion(q));
    // CPedGeometryAnalyser::ComputePedHitSide(ped, car) is a retail stub: the side facing the car's approach.
    const pos=p.actor.player.position,side=browserLocalDirection(heading,-linvel.x,-linvel.z) as 0|1|2|3;
    const t=body.translation();
    const kill=killPedWithCarTask({carPosition:toNative(t),right:axis(1,0,0),forward:axis(0,0,-1),up:axis(0,1,0),boundsMin:physics.boundsMin,boundsMax:physics.boundsMax,
     carMoveSpeed:toNative({x:linvel.x/50,y:linvel.y/50,z:linvel.z/50}),carMass:physics.mass,pedPosition:toNative(at),pedHitSide:side});
    if(p.onlyDamagedByPlayer||p.proofs?.collision){addCarForce(impact.vehicleForce);return;}
    p.health=0;
    const death=computeDeathAnim({weapon:kill.weapon,pedPiece:kill.pedPiece,direction:kill.direction,health:0,damageArmour:0,damageHealth:kill.damage,
     victim:{player:false,inVehicle:false,moveState:this.moveState(p),upperBodyOnly:!!p.flags?.upperBodyDamageAnimsOnly,fallingOrGettingUp:false,headBelowRoot:false},source:{ped:false,player:striker.occupied},nextRandom:()=>this.damageRandom.next()});
    const thrown=fromNative(kill.pedMoveSpeed),clip=death.clip??'ko_skid_front';
    this.hit(p,thrown.x||pos.x-t.x,thrown.z||pos.z-t.z,0,clip,1000);
    p.impulse={x:thrown.x*50,z:thrown.z*50};p.down=Infinity;p.view.playReaction(clip,Infinity);
    addCarForce({x:impact.vehicleForce.x+kill.vehicleForce.x,y:impact.vehicleForce.y+kill.vehicleForce.y,z:impact.vehicleForce.z+kill.vehicleForce.z});
    if(kill.crunch&&car)this.onCarCrunch?.(car);
    // RegisterKill's source is the car, not the player ped: his own car only counts STAT_PEOPLE_YOUVE_WASTED.
    crime();this.onKill?.({id:p.id,officer:p.officer,gang:p.gang,pedType:p.pedType,recruit:!!p.follow,byPlayer:false,byPlayerVehicle:striker.occupied});
    return;
   }
   addCarForce(impact.vehicleForce);
   const push=fromNative(impact.pedForce);
   if(speed>=2){this.hit(p,linvel.x,linvel.z,Math.min(10,speed*.6),'ko_skid_front',1000);crime();}
   else{p.impulse.x+=push.x/PED_MASS*50;p.impulse.z+=push.z/PED_MASS*50;}
  }
  /** CPedPlacement::IsPositionClearOfCars for a fallen ped: the first car whose collision covers the 0.25 sphere at the
   * ped's origin (a unit above the feet). Bikes are not in the car list, so any car found holds the ped down. */
  private carOver(p:Pedestrian,cars:Iterable<WorldCar>){
   const q=p.actor.player.position,origin={x:q.x,y:q.y+1,z:q.z};
   for(const car of cars){
    if(!car.car.body.isEnabled())continue;
    const c=car.car.body.translation(),reach=(car.boundRadius??Infinity)+GET_UP_CLEAR_RADIUS;
    if((c.x-origin.x)**2+(c.z-origin.z)**2>reach*reach)continue;
    for(let i=0;i<car.car.body.numColliders();i++){const collider=car.car.body.collider(i);if(!collider.isSensor()&&collider.intersectsShape(GET_UP_PROBE,origin,NO_ROTATION))return car;}
   }
   return undefined;
  }
  /** CTaskComplexFallAndGetUp: the fall clip, `lieMs` on the ground, then the get-up. A weapon's knockdown lies
   * 1000 / (m_nWeaponShootingRate / 40) ms; a car, a fall or being run over, 1000 ms (EventHandler::ComputeDamageResponse). */
  private hit(p:Pedestrian,x:number,z:number,strength:number,clip='ko_skid_front',lieMs=1000/((p.shootingRate??40)/40)){
  if(p.down>0)return;
  const fall=p.view.reactionDuration(clip)??1,getUp=p.view.reactionDuration(getUpClip(clip))??1.37;
  p.down=fall+lieMs/1000+getUp;p.flee=Math.max(p.flee,8);this.hits++;p.fallClip=clip;p.stuckUnderCar=false;
  const length=Math.hypot(x,z)||1;p.impulse={x:x/length*strength,z:z/length*strength};
  p.view.playReaction(clip,fall+lieMs/1000);
  // A low collider allows the vehicle to pass over a knocked-down civilian.
  p.collider.setShape(new RAPIER.Ball(.3));
  this.frighten(p.actor.player.position,12);p.fleeFrom={x:p.actor.player.position.x-x/length*2,z:p.actor.player.position.z-z/length*2};
 }
   punch(){
    if(this.cooldown>0||this.sim.player.health<=0||!this.sim.player.grounded||this.sim.player.crouched)return false;
    // Module 1 shared chain (src/combat/meleeChain.ts, melee.dat UNARMED_1):
    // landed strikes link jab->cross->hook inside chain+0.25 s, whiffs reset.
    const now=typeof performance!=='undefined'?performance.now()/1000:0;
    const prevStage=NATIVE_UNARMED_STAGES[this.combo];
    const next=this.combo=nextChainIndex(this.combo, now-this.lastPunchAt, prevStage.chain);
    const stage=NATIVE_UNARMED_STAGES[next];
    const anim=next===1?'fighta_2':next===2?'fighta_3':'fighta_1';
    this.cooldown=chainCooldown(NATIVE_MELEE_COMBOS.UNARMED, next);
   // Lock on via FindPedToAttack: closest to the camera-forward line (gang discount).
   // Lock-on only corrects inside the frontal cone: swings from behind whiff
   // instead of snapping the fighter 180° (CTaskSimpleFight faces first, the
   // hit lands only while aligned at its hit frame).
    const origin=this.sim.player.position;let heading=this.sim.player.heading;
    const fwd={x:Math.sin(heading),z:Math.cos(heading)};
    const frontal=(dx:number,dz:number,hx:number,hz:number)=>inStrikeCone(dx,dz,hx,hz);
    const candidate=this.people.filter(p=>p.health>0).map(p=>({p,dx:p.actor.player.position.x-origin.x,dz:p.actor.player.position.z-origin.z,dy:p.actor.player.position.y-origin.y}))
     .filter(t=>Math.hypot(t.dx,t.dz)<NATIVE_UNARMED_RANGE+0.6&&Math.abs(t.dy)<1&&frontal(t.dx,t.dz,fwd.x,fwd.z))
     .sort((a,b)=>attackLineDistance(origin,fwd,{x:a.p.actor.player.position.x,z:a.p.actor.player.position.z},false)-attackLineDistance(origin,fwd,{x:b.p.actor.player.position.x,z:b.p.actor.player.position.z},false))[0];
    if(candidate){heading=Math.atan2(candidate.dx,candidate.dz);this.sim.player.heading=heading;}
    this.playerView()?.playReaction(this.catalog?.animations[anim]?anim:'fighta_1',.55);
    const moving=this.sim.player.speed>6;
    const target=this.people.filter(p=>p.health>0).map(p=>({p,dx:p.actor.player.position.x-origin.x,dz:p.actor.player.position.z-origin.z,dy:p.actor.player.position.y-origin.y})).filter(t=>Math.hypot(t.dx,t.dz)<NATIVE_UNARMED_RANGE&&Math.abs(t.dy)<1&&inStrikeCone(t.dx,t.dz,Math.sin(heading),Math.cos(heading))).sort((a,b)=>Math.hypot(a.dx,a.dz)-Math.hypot(b.dx,b.dz))[0];
    if(target){
     const distance=Math.hypot(target.dx,target.dz),ray=new RAPIER.Ray({...origin,y:origin.y+1},{x:distance>1e-4?target.dx/distance:Math.sin(heading),y:0,z:distance>1e-4?target.dz/distance:Math.cos(heading)});
     if(distance>.01&&this.sim.world.castRay(ray,distance,true,RAPIER.QueryFilterFlags.ONLY_FIXED)){this.combo=0;return false;}
     const ground=target.p.down>0;
     // Shared melee.dat resolution: AGROUND 25, AMOVING 5, else stage damage.
     const struck=resolveStrike(NATIVE_MELEE_COMBOS.UNARMED, { stage: next, moving, victimDown: ground });
     this.lastPunchAt=now;
     this.pendingStrikes.push({target:target.p.id,heading,damage:struck.damage,delay:struck.delay,ground,combo:next});
     return true;
    }
   this.combo=0;
   return false;
  }
  private resolveStrike(s:{target:number;heading:number;damage:number;ground:boolean;combo:number}){
   const target=this.people.find(p=>p.id===s.target);if(!target||target.health<=0)return;
   const origin=this.sim.player.position;
   const dx=target.actor.player.position.x-origin.x,dz=target.actor.player.position.z-origin.z;
   if(Math.hypot(dx,dz)>NATIVE_UNARMED_RANGE+0.3||Math.abs(target.actor.player.position.y-origin.y)>1.2)return;
   // Hit-frame alignment: turning away during the swing wastes the strike.
   const hx=Math.sin(this.sim.player.heading),hz=Math.cos(this.sim.player.heading),flat=Math.hypot(dx,dz);
   if(flat>1e-4&&(dx*hx+dz*hz)/flat<=.35)return;
    // GenerateDamageEvent reports DAMAGED_PED at once; CEventDamage queues the cop variant for a cop.
    const dontCare=this.policeDontCare(`ped:${target.id}`);this.law?.crime(CRIME.damagedPed,`ped:${target.id}`,dontCare);this.law?.registerCrime(target.officer?CRIME.damagedCop:CRIME.damagedPed,`ped:${target.id}`,dontCare);
    if(!pedProofedAgainst(target,'melee'))target.health=healthAfter(target.health,playerPunchDamage(s.damage,target.defendMult));
   // CDarkel::RegisterKillByPlayer asks IsMember before the member is let go: whether he was a recruit when hit.
   const wasRecruit=!!target.follow;
   if(target.follow){target.follow=false;target.foe=undefined;}
   if(!target.health)this.onKill?.({id:target.id,officer:target.officer,gang:target.gang,pedType:target.pedType,recruit:wasRecruit,byPlayer:true});
   if(!target.health){const tq=target.actor.player.position,tfrom={x:tq.x-Math.sin(s.heading),z:tq.z-Math.cos(s.heading)};this.applyReaction(target,this.damageReaction(target,WEAPON.unarmed,s.damage,tfrom,undefined,true),tfrom);}
   else if(s.combo===2||s.ground)this.hit(target,Math.sin(s.heading),Math.cos(s.heading),4);
   else{this.hits++;target.view.playReaction('hit_front');target.stagger=0.5;if(!this.catalog?.decisionMakers[target.decisionMaker])this.frighten(target.actor.player.position,12);this.onPain?.(target,{...target.actor.player.position});}
    this.onMeleeHit?.({...target.actor.player.position},true);
    // The decision maker's answer to EVENT_DAMAGE; without the decision files, the shared temper routing
    // (src/ped/brain.ts): hotheads fight, the rest flee.
    if(!this.damageResponse(target,WEAPON.unarmed)){
     const decision=decideDamageResponse({ temper: target.temper, officer: target.officer, alreadyFighting: target.retaliate>0, healthAfter: target.health });
     applyDamageResponse(target, decision);
     if(decision==='flee')target.fleeFrom={...origin};
    }
  }
  /** A vehicle as CEventPotentialGetRunOver needs it, or undefined when it is not moving. */
  /** The moving vehicles for this step's run-over scan, built once in beforeStep for every ped. */
  private runOverVehicles=new Map<WorldCar,GetRunOverVehicle>();
  /** CPed::DeadPedMakesTyresBloody for a body lying at `at` (browser space); see nativeTyreBlood.ts. */
  private deadPedMakesTyresBloody(at:{x:number;y:number;z:number},cars:Iterable<WorldCar>){
   const ped={x:at.x,y:-at.z,z:at.y};
   for(const car of cars){
    const body=car.car.body;if(!body.isEnabled()||car.wrecked)continue;
    const t=body.translation();if(Math.abs(t.x-ped.x)>=10||Math.abs(-t.z-ped.y)>=10)continue;
    const r=body.rotation(),q=new Quaternion(r.x,r.y,r.z,r.w),v=body.linvel(),native=(w:Vector3)=>({x:w.x,y:-w.z,z:w.y});
    const physics=car.nativeBody;
    const hits=deadPedTyreBlood(ped,{position:{x:t.x,y:-t.z,z:t.y},right:native(new Vector3(1,0,0).applyQuaternion(q)),forward:native(new Vector3(0,0,-1).applyQuaternion(q)),
     moveSpeed2DSq:(v.x**2+v.z**2)/2500,mass:physics.mass,boundsMin:physics.boundsMin,boundsMax:physics.boundsMax,wheelsOnGround:car.wheelGround.map(g=>!!g),bloody:car.wheelBlood});
    for(const hit of hits){
     car.wheelBlood[hit.wheel]=true;
     if(hit.moveForce){const lv=body.linvel();body.setLinvel({x:lv.x,y:lv.y+hit.moveForce.z/physics.mass*50,z:lv.z},true);}
     if(hit.turnForce){
      // ApplyTurnForce: the arm from the centre of mass, crossed with the force, over the turn mass.
      const com=body.worldCom(),f=hit.turnForce.force,point={x:t.x+hit.turnForce.point.x,y:t.y+hit.turnForce.point.z,z:t.z-hit.turnForce.point.y};
      const arm={x:point.x-com.x,y:-(point.z-com.z),z:point.y-com.y},turn={x:arm.y*f.z-arm.z*f.y,y:arm.z*f.x-arm.x*f.z,z:arm.x*f.y-arm.y*f.x};
      const w=body.angvel(),k=50/physics.turnMass;body.setAngvel({x:w.x+turn.x*k,y:w.y+turn.z*k,z:w.z-turn.y*k},true);
     }
    }
   }
  }
  private runOverVehicle(car:WorldCar):GetRunOverVehicle|undefined{
   const body=car.car.body;if(!body.isEnabled())return undefined;
   const v=body.linvel(),q=body.rotation(),rot=new Quaternion(q.x,q.y,q.z,q.w);
   const f=new Vector3(0,0,-1).applyQuaternion(rot),r=new Vector3(1,0,0).applyQuaternion(rot);
   const fl=Math.hypot(f.x,f.z),rl=Math.hypot(r.x,r.z);if(fl<1e-3||rl<1e-3)return undefined;
   const forward={x:f.x/fl,z:f.z/fl},forwardSpeed=(v.x*forward.x+v.z*forward.z)/50;
   if(Math.abs(forwardSpeed)<.01)return undefined;
   const t=body.translation(),b=car.nativeBody;
   return {position:{x:t.x,z:t.z},height:t.y,forward,right:{x:r.x/rl,z:r.z/rl},boundsMin:{x:b.boundsMin.x,y:b.boundsMin.y},boundsMax:{x:b.boundsMax.x,y:b.boundsMax.y},forwardSpeed,horn:(car.horn?.counter??0)>0,playerDriven:!!car.occupied};
  }
  /** CEventPotentialGetRunOver on a street ped: the scan stand-in, the reversed response and the tasks it
   * starts. Returns the speed the task asks for, or undefined when no task drives the ped. */
  private stepGetRunOver(p:Pedestrian,dt:number,cars:Iterable<WorldCar>):number|undefined{
   const state=p.actor.player;
   if(p.health<=0||p.down>0||p.stealth!==undefined||p.onFire>0){
    if(p.evade)p.impulse={x:0,z:0};
    p.evade=undefined;p.carReact=undefined;return undefined;
   }
   // CEventPotentialGetRunOver (priority 51) displaces a gun aimed at the ped (50) but not a hurt ped's CEventDamage
   // (65), and HandleEvents drops a repeat while its response runs: a ped fleeing a horn rolls no new horn reaction.
   // Its AffectsPed has no combat test: a ped fighting over a shot (35) or a hated sighting (26) still gets out of the
   // way, the kill task (the non-temporary response) resuming after the dodge.
   // The vehicle-collision scan raises the event once a 30 fps game frame, so its random response rolls that often.
   if(this.frameDue&&!p.evade&&!p.carReact&&this.takesPriority(p,EVENT.potentialGetRunOver)){
    for(const car of cars){
     const v=this.runOverVehicles.get(car);
     if(!v||!potentialGetRunOver({x:state.position.x,z:state.position.z,height:state.position.y},v))continue;
     const r=vehiclePotentialCollisionResponse({ped:state.position,isCop:p.officer,createdByGame:!p.mission,vehicle:v,random01:this.damageRandom.next()/32768,randomInt1000:this.damageRandom.next()%1000,respondingToRunOver:false,randomRange:(a,b)=>a+this.damageRandom.next()%(b-a)});
     const face={...v.position};
     if(r.task==='evasiveStep'||r.task==='evasiveDive'){
      const along=r.task==='evasiveStep'?-1:1;
      p.evade={kind:r.task==='evasiveStep'?'step':'dive',phase:'turn',time:0,heading:Math.atan2(r.avoid.x*along,r.avoid.z*along),avoid:r.avoid,byPlayer:car.occupied};
     }else if(r.task==='handsUp'){
      // CTaskSimpleHandsUp(3000), turned to the vehicle at once.
      state.heading=Math.atan2(face.x-state.position.x,face.z-state.position.z);
      p.carReact={clip:'handsup',time:0,duration:3,face,turned:true,fromFarHorn:false};p.view.playReaction('handsup',3);
     }else if(r.task==='shakeFist'){
      p.carReact={clip:'fucku',time:0,duration:p.view.reactionDuration('fucku')??1.3,face,turned:!r.face,fromFarHorn:false};
     }else if(r.task==='face'){
      p.carReact={time:0,duration:0,face,turned:false,fromFarHorn:true};
     }else if(r.task==='flee'){p.flee=Math.max(p.flee,r.seconds);p.fleeFrom={...v.position};}
     if(r.task!=='none'){p.event={type:EVENT.potentialGetRunOver};p.gunReact=undefined;break;}
    }
   }
   const turn=(heading:number,rate:number)=>{let d=heading-state.heading;d=Math.atan2(Math.sin(d),Math.cos(d));const step=p.headingChange*Math.PI/180*rate*50*dt;state.heading+=Math.max(-step,Math.min(step,d));return Math.abs(d)<=.2;};
   if(p.evade){
    const e=p.evade;e.time+=dt;
    if(e.phase==='turn'){
     // CTaskSimpleAchieveHeading(heading, 2.0, 0.2).
     if(turn(e.heading,2)){
      e.phase='move';e.time=0;p.view.playReaction(e.kind==='step'?'ev_step':'ev_dive',e.lie?(p.view.reactionDuration('ev_dive')??2.33)+e.lie:undefined);
      // CTaskSimpleEvasiveDive::StartAnim: a cop diving from the player's car registers CRIME_VEHICLE_DAMAGE and
      // CRIME_SPEEDING at once.
      if(e.kind==='dive'&&p.officer&&e.byPlayer){this.law?.registerCrimeImmediately(CRIME.vehicleDamage,`ped:${p.id}`);this.law?.registerCrimeImmediately(CRIME.speeding,`ped:${p.id}`);}
     }
     return 0;
    }
    const clip=e.kind==='step'?'ev_step':'ev_dive',length=p.view.reactionDuration(clip)??(e.kind==='step'?1.07:2.33);
    if(e.phase==='move'){
     // The clips' root motion: EV_step backs 1.03 units away, EV_dive carries 6.76 units forward.
     const distance=e.kind==='step'?1.03:6.76,dir=e.kind==='step'?e.avoid:{x:Math.sin(state.heading),z:Math.cos(state.heading)};
     p.impulse={x:dir.x*distance/length,z:dir.z*distance/length};
     if(e.time>=length){
      p.impulse={x:0,z:0};
      if(e.kind==='step'){p.evade=undefined;return undefined;}
      // CTaskSimplePause for the script's time, the dive's last pose held.
      if(e.lie){e.phase='lie';e.time=0;return 0;}
      // No unconscious time; the ped turns a quarter and gets up with GETUP_FRONT (EV_DIVE is a front anim).
      state.heading-=Math.PI/2;e.phase='getup';e.time=0;p.view.playReaction('getup_front');
     }
     return 0;
    }
    if(e.phase==='lie'){if(e.time>=e.lie!){state.heading-=Math.PI/2;e.phase='getup';e.time=0;p.view.playReaction('getup_front');}return 0;}
    if(e.time>=(p.view.reactionDuration('getup_front')??1.37))p.evade=undefined;
    return 0;
   }
   if(p.carReact){
    const c=p.carReact,want=Math.atan2(c.face.x-state.position.x,c.face.z-state.position.z);
    if(!c.turned){if(!turn(want,.5))return 0;c.turned=true;if(c.clip)p.view.playReaction(c.clip);}
    c.time+=dt;if(c.time>=c.duration)p.carReact=undefined;
    return 0;
   }
   return undefined;
  }
  /** CTaskComplexOnFire::ComputeFireDamage and ControlSubTask: fire damage only lowers health, with no
   * CEventDamage and so no flinch. At zero health the ped runs CTaskComplexDie with KO_SHOT_FRONT_0. */
  /** `byPlayer`: the fire was started by the player (TaskComplexOnFire registers the kill to GetEntityStartedFire). */
  private burn(p:Pedestrian,damage:number,byPlayer:boolean){
   p.health=healthAfter(p.health,damage);p.onFire=.25;
   // A fire hurts as WEAPON_FLAMETHROWER.
   if(damage>0)p.lastWeaponDamage=WEAPON.flamethrower;
   if(p.health===0){
    p.onFire=0;p.down=Infinity;p.collider.setShape(new RAPIER.Ball(.3));p.view.playReaction('ko_shot_front',Infinity);
    this.onKill?.({id:p.id,officer:p.officer,gang:p.gang,pedType:p.pedType,recruit:!!p.follow,byPlayer});
   }
   return {id:p.id,officer:p.officer};
  }
  /** CEventGunAimedAt from the player's lock-on (see ped/nativeGunAimedAt). Returns whether the ped was affected. */
  gunAimedAt(handle:number,aimer:{x:number;y:number;z:number}){
   const p=this.people.find(q=>q.collider.handle===handle);if(!p)return false;
   const state=p.actor.player,forward={x:Math.sin(state.heading),z:Math.cos(state.heading)};
   if(!gunAimedAtAffects({ped:state.position,forward,aimer,alive:p.health>0&&p.down===0&&p.stealth===undefined,reacting:!!p.gunReact,sameGroup:p.follow,
    // CPedIntelligence's constructor gives gang members 40 units of sight and hearing, everyone else 15.
    seeingRange:p.gang!==undefined?GANG_SEEING_RANGE:undefined}))return false;
   // AffectsPed: a cop reports CRIME_AIM_GUN and answers from its own decision maker.
   if(p.officer){this.law?.crime(CRIME.aimGun,`ped:${p.id}`);return true;}
   if(!this.takesPriority(p,EVENT.gunAimedAt))return false;
   // IsFriendlyWith: the player's recruits, and the Families, whom the script sets to respect him.
   const response=gunAimedAtResponse({fleeing:p.flee>0,createdByGame:true,inVehicle:false,holdsGun:!!p.weapon,friendly:p.follow||p.gang===1});
   if(response==='flee'){p.event={type:EVENT.gunAimedAt};this.fleeFromPlayer(p,60);return true;}
   if(response==='kill'){p.event={type:EVENT.gunAimedAt};this.killPedOnFoot(p);return true;}
   const task=this.decide(p,EVENT.gunAimedAt,this.relationshipTo(p));
   // Without the decision files: street peds on the rand_norm and rand_weak makers react, rand_tough peds keep going.
   if(task===undefined?p.decisionMaker!==2&&p.decisionMaker!==4:task!==TASK.reactToGunAimedAt){
    if(task===TASK.smartFleeEntity||task===TASK.fleeEntity||task===TASK.fleeAnyMeans){p.event={type:EVENT.gunAimedAt};this.fleeFromPlayer(p,60);return true;}
    // COWER, HANDS_UP and DUCK come only from the mission and RANDOM.ped makers, which street peds do not use.
    return false;
   }
   p.event={type:EVENT.gunAimedAt};
   p.gunReact=new ReactToGunAimedAt({x:aimer.x,z:aimer.z},p.statFlags,this.damageRandom.next(),p.view.reactionDuration('handscower')??1);
   return true;
  }
  /** One frame of CTaskComplexReactToGunAimedAt. Returns the speed it asks for, or undefined when it no longer drives the ped. */
  private stepGunReact(p:Pedestrian,dt:number,steer:(x:number,z:number)=>void){
   const task=p.gunReact!,state=p.actor.player;
   // A hit, a knockdown, a fight or a fresh scare takes over, as a higher-priority event would.
   if(p.health<=0||p.down>0||p.retaliate>0||p.flee>0){p.gunReact=undefined;if(p.view.reactionName==='handsup'||p.view.reactionName==='handscower')p.view.clearReaction();return undefined;}
   const want=Math.atan2(task.aimer.x-state.position.x,task.aimer.z-state.position.z);
   let delta=want-state.heading;delta=Math.atan2(Math.sin(delta),Math.cos(delta));
   // CTaskSimpleAchieveHeading(heading, 0.5, 0.2): half the ped's heading change rate, done within 0.2 rad.
   const before=task.phase,phase=task.step(dt,Math.abs(delta)<=.2);
   switch(phase){
    case 'heading':{const turn=p.headingChange*Math.PI/180*.5*50*dt;state.heading+=Math.max(-turn,Math.min(turn,delta));return 0;}
    case 'handsUp':if(before!=='handsUp')p.view.playReaction('handsup',task.handsUpSeconds);return 0;
    case 'cower':if(before!=='cower')p.view.playReaction('handscower');return 0;
    case 'flee':p.gunReact=undefined;this.fleeFromPlayer(p,60);return undefined;
    // CTaskComplexWanderStandard(PEDMOVE_WALK, NodeHeading of the aimer to the ped), TaskComplexReactToGunAimedAt.cpp:
    // 65-70: a fresh wander along the path network from the nearest node, setting off the way away from the aimer.
    // The walk is the ordinary wander's; steering straight away ground the ped along whatever wall stood behind it.
    case 'wander':{
     if(before!=='wander'){
      p.wanderDir=wanderSector(state.position.x-task.aimer.x,-(state.position.z-task.aimer.z));
      const n=this.nearestNode(state.position);if(n){p.target=n;p.previousNode=undefined;this.chooseTarget(p,true);}
     }
     return undefined;
    }
    default:p.gunReact=undefined;return undefined;
   }
  }
  /** CTaskSimpleFight on a melee.dat combo, for a ped attacking the player or another ped. CTaskSimpleFight and
   * CTaskSimpleFightingControl::ProcessPed are still mostly retail stubs, so the cadence is melee.dat's:
   * - each move lands on its hit frame if the target is still inside the combo's range plus the move's radius;
   * - the next move starts on the chain frame (or at the end of its clip) while the target stays in reach;
   * - after the third, or when the target leaves reach, the ped waits half a second (authored) before another combo.
   * CTaskSimpleFightingControl::CalcMoveCommand (reversed) starts no move while the target is 15° or more off the ped's
   * heading; the ped turns toward it at its pedstats heading change rate (CPed::UpdateHeading, degrees per frame).
   * Returns whether a move is in progress. */
  private stepFight(p:Pedestrian,combo:string,clips:readonly [string,string,string],target:{x:number;z:number},canReach:boolean,dt:number,strike:(stage:0|1|2,damage:number)=>void){
   const table=NATIVE_MELEE_COMBOS[combo],state=p.actor.player,dx=target.x-state.position.x,dz=target.z-state.position.z,distance=Math.hypot(dx,dz);
   let delta=Math.atan2(dx,dz)-state.heading;while(delta>Math.PI)delta-=2*Math.PI;while(delta<-Math.PI)delta+=2*Math.PI;
   const turn=p.headingChange*Math.PI/180*50*dt,step=Math.max(-turn,Math.min(turn,delta));state.heading+=step;
   if(!p.fight){
    if(!canReach||distance>table.range||p.meleeCooldown>0||Math.abs(delta-step)>=FIGHT_CTRL_MAX_ATTACK_ANGLE)return false;
    p.fight={stage:0,time:0,struck:false};p.view.playReaction(clips[0]);
   }
   const fight=p.fight,stage=table.stages[fight.stage],reach=table.range+stage.radius;
   fight.time+=dt;
   if(!fight.struck&&fight.time>=stage.hit){fight.struck=true;if(canReach&&distance<=reach)strike(fight.stage,stage.damage);}
   const clip=p.view.reactionDuration(clips[fight.stage])??stage.chain;
   if(fight.time>=Math.min(stage.chain,clip)){
    if(fight.stage<2&&canReach&&distance<=reach){fight.stage=(fight.stage+1) as 1|2;fight.time=0;fight.struck=false;p.view.playReaction(clips[fight.stage]);}
    else{p.fight=undefined;p.meleeCooldown=.5;return false;}
   }
   return true;
  }
  /** A cop's BBALLBAT combo on the player (weapon.dat gives the nightstick that combo); its third move carries
   * FALL_3 in the combo's FLAGS and knocks the player down. */
  private stepNightstick(p:Pedestrian,visible:boolean,dt:number){
   // CTaskSimpleBeHit runs in the physical-response slot above the kill task: while the ped flinches it does not
   // fight, and the fight task it comes back to starts its combo afresh (he stands meanwhile).
   if(p.stagger>0){p.fight=undefined;return true;}
   return this.stepFight(p,'BBALLBAT',['cop_bat_1','cop_bat_2','cop_bat_3'],this.sim.player.position,visible&&this.sim.knockdown===0&&this.playerOnFoot(),dt,(stage,damage)=>{
    const from={x:p.actor.player.position.x,z:p.actor.player.position.z};
    // The group answers only a CEventDamage the player took (MakeGroupRespondToPlayerTakingDamage).
    if(this.damagesPlayer(p,WEAPON.nightstick)){this.sim.damagePlayer(npcPunchDamage(damage,p.attackMult),false,{weapon:WEAPON.nightstick,from,fall:meleeAttackFalls('BBALLBAT',stage)});this.defendPlayer(p);}
    this.onMeleeHit?.({...this.sim.player.position},false);
   });
  }
  /** A fist or a nightstick lands only on the ped's collision: a player shut inside a car, boat or aircraft has none
   * to reach (his capsule is off from the entry until he is set out). A bike's rider stays exposed. */
  private playerOnFoot(){return this.sim.playerCollider.isEnabled()&&this.sim.playerBody.isEnabled()||!!this.playerRide?.()?.bike;}
  /** A street ped's fist combo (UNARMED_1) on the player or another ped: melee.dat damage times its pedstats attack
   * strength, with the victim's HitA reaction for the move. */
  private stepBrawl(p:Pedestrian,foe:Pedestrian|undefined,dt:number){
   if(p.stagger>0){p.fight=undefined;return false;}
   const target=foe?foe.actor.player.position:this.sim.player.position,canReach=foe?foe.health>0:this.sim.knockdown===0&&this.sim.player.health>0&&this.playerOnFoot();
   const fists=this.fists(p);
   return this.stepFight(p,fists.combo,fists.clips,target,canReach,dt,(stage,damage)=>{
    const q=p.actor.player.position,from={x:q.x,z:q.z};this.onThreat?.(p,{...q});
    if(foe){this.strikeFoe(p,foe,stage,damage);return;}
    if(this.damagesPlayer(p,WEAPON.unarmed)){this.sim.damagePlayer(npcPunchDamage(damage,p.attackMult),false,{weapon:WEAPON.unarmed,from,fall:meleeAttackFalls(fists.combo,stage),fight:{move:stage}});this.defendPlayer(p);}
    this.onMeleeHit?.({...this.sim.player.position},false);
   });
  }
  /** The fist combo on a car. CTaskSimpleFight::FightHitCar is unreversed, so a strike that lands does the move's
   * melee.dat damage, times the ped's attack strength, to the car as melee damage, at `face` (the nearest point of the
   * car's collision). */
  private stepCarBrawl(p:Pedestrian,vehicle:number,face:{x:number;z:number},dt:number){
   const car=this.resolveScriptVehicle?.(vehicle)?.entity();if(!car||car.wrecked)return;
   const q=p.actor.player.position,fists=this.fists(p);
   this.stepFight(p,fists.combo,fists.clips,face,true,dt,(stage,damage)=>{
    car.damage(npcPunchDamage(damage,p.attackMult),undefined,false,undefined,{kind:'melee',weapon:WEAPON.unarmed,by:{ped:p}});
    this.onMeleeHit?.({x:face.x,y:q.y+PED_ORIGIN_HEIGHT,z:face.z},false);
   });
  }
  /** CTaskSimpleArrestPed::StartAnim on the player: ARRESTgun on the cop, PEDSTATE_ARRESTED on the
   * player, and SetDownTime(100'000) so the player stays on the ground. */
  private arrestPlayer(p:Pedestrian){
   // ProcessPed swaps a melee weapon for the pistol before the clip.
   p.arrest=1;p.fight=undefined;p.copWeapon='pistol';p.view.playReaction('arrestgun');
   this.sim.knockdown=Math.max(this.sim.knockdown,ARREST_DOWN_TIME+this.sim.knockdownGetUp);
   this.playerView()?.holdReaction();
   this.law?.arrest();
  }
  /** Eye/aim raycast against the suspect (shared by foot officers and armed turf gangs). */
  /** LineOfSightClearForAttack toward the player or, given `foe`, toward that ped. */
  private spotTarget(p:Pedestrian,target:{x:number;y:number;z:number},cars:Iterable<WorldCar>,foe?:Pedestrian){
   const state=p.actor.player,eye={...state.position,y:state.position.y+1.3},aim={...target,y:target.y+1},offset=new Vector3(aim.x-eye.x,aim.y-eye.y,aim.z-eye.z),distance=offset.length();
   // LineOfSightClearForAttack passes peds=false: bystanders do not block the line.
   const peds=new Set(this.people.map(q=>q.collider.handle));
   const hit=distance>0?this.sim.world.castRay(new RAPIER.Ray(eye,offset.clone().normalize()),distance+.5,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,p.collider,p.body,c=>!peds.has(c.handle)):null;
   // The foe's own collider is one of the skipped peds, so it is in sight when nothing else stands in front of it.
   // A player on a bike, boat or aircraft sits on its body with his own collider off: the line reaches him when it
   // meets that body or nothing short of him (the target's own vehicle does not block the line).
   const occupied=[...cars].find(c=>c.occupied),ride=foe?undefined:this.playerRide?.()?.body;
   const visible=foe?!hit||hit.timeOfImpact>=distance:ride?!hit||hit.timeOfImpact>=distance||hit.collider.parent()?.handle===ride.handle:!!hit&&(hit.collider.handle===this.sim.playerCollider.handle||!!occupied&&hit.collider.parent()?.handle===occupied.car.body.handle);
   return {eye,aim,offset,distance,visible};
  }
  /** The player's capsule, for a bullet line to try while he rides a bike. */
  private riderShape?:RAPIER.Capsule;
  /** Muzzle-ray firing sequence with reloads, flashes and dispersion. */
  private stepPedGun(p:Pedestrian,weapon:NonNullable<Pedestrian['weapon']>,eye:{x:number;y:number;z:number},aim:{x:number;y:number;z:number},aimOffset:Vector3,cars:Iterable<WorldCar>,dt:number,engaged:boolean){
   const state=p.actor.player,gun=p.gunState!;
   // A weapon a script handed over runs out: CWeapon::m_TotalAmmo falls a round at a time and an empty one
   // stops the ped firing. A ped the browser armed itself has no count and keeps going.
   if(p.totalAmmo!==undefined&&p.totalAmmo<=0)engaged=false;
   if(gun.reload>0)p.view.setWeaponAim();
   if(engaged&&!gun.active&&!gun.reload){p.aimPoint={...aim};p.view.playReaction('police_fire',weapon.info.loop.end);}
   const oldTime=gun.time,oldReload=gun.reload;
   const fire=stepNpcGun(gun,weapon.info,weapon.reloadSeconds,dt,engaged,{rate:p.shootingRate??40});
   if(gun.reload>oldReload&&weapon.reloadClip)p.view.playReaction('police_reload',weapon.reloadSeconds,true);
   if(fire){
    // CWeapon::Fire counts a ped's rounds only under 25,000; a ped given more never runs out.
    if(p.totalAmmo!==undefined&&p.totalAmmo<25000)p.totalAmmo=Math.max(0,p.totalAmmo-1);
    if(p.gunFight)p.gunFight.lastAttack=this.clock;
    // A ped shooting on the move (CTaskComplexGoToPointShooting) keeps walking its way and aims the gun alone.
    if(p.order?.kind!=='goToPointShooting')state.heading=Math.atan2(aimOffset.x,aimOffset.z);
    p.view.update(p.actor,1);
    const muzzle=p.gun?.root.getObjectByName('gunflash')?.getWorldPosition(new Vector3())??p.view.hand()?.getWorldPosition(new Vector3())??new Vector3(eye.x,eye.y,eye.z);
    const direction=new Vector3().copy(p.aimPoint??aim).sub(muzzle).normalize();
    // Native weapon dispersion: the muzzle ray scatters inside the
    // weapon.dat radius instead of striking the aim point every shot.
    const scattered=npcAimSpread(direction,weapon.info,p.gunAccuracy);
    direction.set(scattered.vector.x,scattered.vector.y,scattered.vector.z);
    const shot=this.sim.world.castRayAndGetNormal(new RAPIER.Ray(muzzle,direction),weapon.info.weaponRange,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,p.collider,p.body);
    // CWorld::bIncludeBikers, which FireInstantHit sets: the line meets a biker's own collision too. CJ's is off while
    // he rides, so his capsule on the bike is tried here, short of whatever else the line struck.
    let riderAt=-1;
    if(this.playerRide?.()?.bike&&this.sim.player.health>0)riderAt=(this.riderShape??=new RAPIER.Capsule(.6,.3)).castRay(new RAPIER.Ray(muzzle,direction),this.sim.playerBody.translation(),{x:0,y:0,z:0,w:1},shot?.timeOfImpact??weapon.info.weaponRange,true);
    const riderHit=riderAt>=0;
    // FireInstantHit includes car tyres for every shooter: a wheel sphere before the hit takes the round.
    const reach=riderHit?riderAt:shot?.timeOfImpact??weapon.info.weaponRange,tyre=bulletTyreHit(cars,muzzle,direction,reach);
    const end=muzzle.clone().addScaledVector(direction,tyre?tyre.t:reach);p.flash=.06;
    // SetUpPelletCol (reversed, shooter-blind): a shotgun's fifteen pellet lines spread with the distance to what the
    // first line hit, and every pellet on that same victim adds the weapon's damage.
    let pellets=1;
    if(shot&&!tyre&&!riderHit&&(weapon.info.type===25||weapon.info.type===26||weapon.info.type===27)){
     const depth=Math.max(.05,reach*(.05/weapon.info.accuracy)*1.3),right=new Vector3(-direction.z,0,direction.x).normalize(),up=new Vector3().crossVectors(right,direction).normalize();
     for(let i=1;i<15;i++){
      const angle=(Math.random()*2-1)*Math.PI,spread=Math.random()*depth*.8,target=end.clone().addScaledVector(right,Math.cos(angle)*spread).addScaledVector(up,Math.sin(angle)*spread);
      const dir=target.sub(muzzle),length=dir.length();dir.divideScalar(length||1);
      const pellet=this.sim.world.castRay(new RAPIER.Ray(muzzle,dir),length+.5,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,p.collider,p.body);
      if(pellet?.collider.handle===shot.collider.handle)pellets++;
     }
    }
    const shotDamage=weapon.info.damage*pellets;
    this.onShot?.(muzzle,end,weapon.info.type,!!shot||!!tyre,{id:`ped:${p.id}`,position:()=>p.health>0||this.people.includes(p)?{...p.actor.player.position,y:p.actor.player.position.y+1}:undefined});this.gunShot({...state.position,y:state.position.y+1},false,p.id);
    if(tyre)tyre.car.burstTyre(tyre.wheel,true,'ped');
    else if(riderHit||shot?.collider.handle===this.sim.playerCollider.handle){if(this.damagesPlayer(p,weapon.info.type)){this.sim.damagePlayer(shotDamage,false,{weapon:weapon.info.type,from:{x:state.position.x,z:state.position.z},piece:pedPieceAt(this.sim.player.position,this.sim.player.heading,end)});this.defendPlayer(p);}}
    else if(shot){const car=[...cars].find(c=>shot.collider.parent()?.handle===c.car.body.handle);if(car){pushShotVehicle(car,shot.normal,end,weapon.info.type);if(!car.onlyDamagedByPlayer)car.damage(shotDamage,undefined,false,undefined,{weapon:weapon.info.type,by:{ped:p}});}else {const victim=this.people.find(other=>other.collider.handle===shot.collider.handle);if(victim&&!pedProofedAgainst(victim,'bullet')&&npcDamageReaches(victim,p,weapon.info.type,true)){victim.lastDamagedBy={ped:p};victim.health=healthAfter(victim.health,shotDamage);if(shotDamage>0)victim.lastWeaponDamage=weapon.info.type;if(!victim.health)this.onKill?.({id:victim.id,officer:victim.officer,gang:victim.gang,pedType:victim.pedType,recruit:!!victim.follow,byPlayer:false});const vq=victim.actor.player.position,vfrom={x:vq.x-direction.x,z:vq.z-direction.z};this.applyReaction(victim,this.damageReaction(victim,weapon.info.type,shotDamage,vfrom,end,false),vfrom);}}}
   }
   if(gun.active&&gun.time<oldTime){p.aimPoint={...aim};p.view.playReaction('police_fire',weapon.info.loop.end,false,weapon.info.loop.start);}
  }
  /** CWanted::SetPursuitCop's m_CopsInPursuit for the foot cops: m_MaxCopsInPursuit of them, the ones nearest the
   * player (ComputePursuitCopToDisplace gives a farther one's place to a nearer one). Cops still in cars are not
   * counted here. */
  private pursuers=new Set<Pedestrian>();
  /** The player's vehicle's velocity (renderer frame, m/s) while he drives one, for the pursuit's speed test. */
  playerVehicleVelocity?:()=>{x:number;y:number;z:number}|undefined;
  /** Whether this 60 Hz step starts one of the game's 30 fps frames: the rolls natives make once a frame, unscaled by
   * the timestep (look-ats, gang chatter, stare talk, on-fire screams), only roll then. */
  private frameClock=0;private frameDue=true;
  beforeStep(dt:number,cars:Iterable<WorldCar>){
   this.frameClock+=dt;this.frameDue=this.frameClock>=1/30;if(this.frameDue)this.frameClock-=1/30;
   {const law=this.law,pl=this.sim.player.position,chasing=new Set(this.pursuers);this.pursuers.clear();
    if(law?.level&&!law.native.backOff){
     // A cop does not join the pursuit of a player driving fast enough past it (distSq × speedSq ≥ 16, the reversed
     // `*`) and waits 3 s. That test is CTaskComplexPolicePursuit::SetPursuit's, from CreateFirstSubTask only:
     // PersistPursuit keeps a cop already in the chase whatever the player's speed.
     const vehicle=this.playerVehicleVelocity?.(),speedSq=vehicle?((vehicle.x/50)**2+(vehicle.y/50)**2+(vehicle.z/50)**2):0;
     const cops=this.people.filter(p=>{
      if(!p.officer||p.health<=0||p.goTo)return false;
      if((p.pursuitRetry??0)>this.clock)return false;
      const q=p.actor.player.position,distSq=(q.x-pl.x)**2+(q.y-pl.y)**2+(q.z-pl.z)**2;
      if(vehicle&&!chasing.has(p)&&distSq*speedSq>=16){p.pursuitRetry=this.clock+3;return false;}
      return true;
     }).sort((a,b)=>Math.hypot(a.actor.player.position.x-pl.x,a.actor.player.position.z-pl.z)-Math.hypot(b.actor.player.position.x-pl.x,b.actor.player.position.z-pl.z));
     for(const cop of cops.slice(0,law.native.maxCopsInPursuit))this.pursuers.add(cop);
    }}
   const carBodies=new Set<number>();for(const car of cars)carBodies.add(car.car.body.handle);
   const notCarCollider=(c:RAPIER.Collider)=>{const b=c.parent();return !b||!carBodies.has(b.handle);};
   this.clock+=dt;
   // CPopulation::ManagePed runs every frame: within 25 units (over the creation distance multiplier) or on screen a
   // ped is needed for another 4 s, 10 s for a cop.
   this.stepPlayerLook(dt,this.clock);
   {const pl=this.sim.player.position,pcdm=this.pcdm(),clock=this.clock;
    for(const p of this.people){const q=p.actor.player.position,d=Math.hypot(q.x-pl.x,q.z-pl.z),removal=(p.gang!==undefined?d-30:d)/pcdm;
     if(removal<=25||!this.canSpawn(q,2))p.neededUntil=clock+(p.officer?10:4);
     // CPed::ProcessBuoyancy: with the water 0.6 above the ped's centre (0.9 above the feet) the ped is submerged;
     // CTaskComplexInWater then drowns a street ped (bDrownsInWater): the DROWN clip, and death when it ends.
     // bDrownsInWater, which a script can clear: a ped that does not drown stays in the water.
    if(p.health>0&&p.down===0&&!p.drowning&&!p.follow&&p.flags?.drownsInWater!==false&&this.waterLevel){
      const water=this.waterLevel(q.x,-q.z);
      // CPed::ProcessBuoyancy: the origin (a unit above the feet) 0.6 under the surface.
      if(water!==undefined&&q.y+PED_ORIGIN_HEIGHT+0.6<water){
       const duration=p.view.reactionDuration('drown')??4;
       if(p.view.hasReaction('drown'))p.view.playReaction('drown',duration);
       p.drowning={until:clock+duration};p.flee=0;p.retaliate=0;
       if(p.attract)this.leaveAttractor(p);
      }
     }
     if(p.drowning&&p.health>0&&clock>=p.drowning.until){p.drowned=true;this.damageCollider(p.collider.handle,1000,{x:0,z:1},'bullet',{weapon:WEAPON.drowning,noSource:true});}
     // CPedIntelligence::LookAtInterestingEntities: an on-screen ped that is not looking rolls one frame in a
     // hundred to look at an interesting entity within 15 units (the player, authored: the entity list is not
     // reversed) for 3 to 5 s; CTaskSimpleIKChain blends the head over 500 ms.
     if(p.health>0&&p.down===0){
      const nowMs=clock*1000;
      if(p.look){if(!stepLookAt(p.look,nowMs,dt*1000))p.look=undefined;}
      else if(this.frameDue&&d<=LOOK_AT_RANGE&&shouldStartLookAt(!this.canSpawn(q,2),false,Math.random))p.look=startLookAt(nowMs,lookAtDurationMs(Math.random));
      if(!p.look){p.lookTarget=undefined;if(p.lookAtAttractor){p.lookAt=undefined;p.lookAtAttractor=false;}}
      const lt=p.lookTarget&&p.lookTarget.health>0?{x:p.lookTarget.actor.player.position.x,y:p.lookTarget.actor.player.position.y+0.9,z:p.lookTarget.actor.player.position.z}:p.lookAt;
      p.view.setHeadLook(p.look?lt?new Vector3(lt.x,lt.y,lt.z):new Vector3(pl.x,pl.y+0.9,pl.z):undefined,p.look?.blend??0);
     }else if(p.look){p.look=undefined;p.view.setHeadLook(undefined,0);}
     // CVehicle::UpdateClumpAlpha's step, which peds share: 8 a frame out, 16 a frame in, once per ProcessControl
     // frame at the PC frame limiter's 30 fps.
     const frames=dt*30,alpha=p.fadeOut?Math.max(0,p.alpha-8*frames):Math.min(255,p.alpha+16*frames);
     if(alpha!==p.alpha){p.alpha=alpha;p.view.setAlpha(alpha/255);}}}
   this.frame++;this.elapsed+=dt;this.cooldown=Math.max(0,this.cooldown-dt);
   this.runOverVehicles.clear();for(const car of cars){const v=this.runOverVehicle(car);if(v)this.runOverVehicles.set(car,v);}
   const strikers:PedStriker[]=[...[...cars].map(car=>({body:car.car.body,nativeBody:car.nativeBody,occupied:car.occupied,boundRadius:car.boundRadius,car})),...(this.bikes?.()??[])];
   for(let i=this.pendingStrikes.length-1;i>=0;i--){const s=this.pendingStrikes[i];s.delay-=dt;if(s.delay<=0){this.pendingStrikes.splice(i,1);this.resolveStrike(s);}}
   this.installPlayerReactions();
   const bodies=this.people.filter(p=>p.health>0&&p.down===0).map(p=>p.actor.player.position);
   for(const p of this.people){
    const state=p.actor.player;if(p.health<=0)p.deadTime+=dt;state.previous={...state.position};
   // Crowd separation: standing bodies push apart before anything steers.
   // Scaled by the impulse decay so overlapping peds part at ~push speed.
   if(p.health>0&&p.down===0){
    const push=separationPush(state.position,bodies.filter(q=>q!==state.position));
    p.impulse.x+=push.x*dt*5;p.impulse.z+=push.z*dt*5;
   }
    // bDoesntDropWeaponsWhenDead: the body keeps what it was carrying.
    if(p.health<=0&&!p.dropped){p.dropped=true;if(!p.flags?.doesntDropWeaponsWhenDead)for(const d of deadPedWeaponDrops(this.carriedWeapons(p)))this.onDropWeapon?.({...state.position},d.weapon,d.ammo,!!p.flags?.deathPickupsPersist);
     const cash=deadPedMoney({money:p.money,pedType:p.pedType,officer:p.officer,mission:p.mission,moneyByScript:p.moneyByScript});if(cash){p.money=0;this.onDropMoney?.({...state.position},cash);}}
    if(p.health<=0)this.deadPedMakesTyresBloody(state.position,cars);
   if(p.stealth!==undefined&&p.health>0){
    const damage=this.catalog?.stealth.kill_knife_ped_damage?.duration??2.23;p.stealth+=dt;
    // CTaskSimpleStealthKill::ManageAnim kills through a CEventDamage from the attacker: the kill is the player's, by
    // the knife, like any other he makes.
    if(p.stealth>=damage){const recruit=!!p.follow;p.lastDamagedBy={player:true};p.lastWeaponDamage=WEAPON.knife;p.health=0;p.down=Infinity;p.collider.setShape(new RAPIER.Ball(.3));p.view.playReaction('kill_knife_ped_die',Infinity);this.deadPedEvent(p);this.onKill?.({id:p.id,officer:p.officer,gang:p.gang,pedType:p.pedType,recruit,byPlayer:true});}
    else{p.view.step(dt,{x:0,y:0,cameraYaw:state.heading,walk:true,sprint:false,jump:false},p.actor);continue;}
   }
   const at=p.body.translation();
   for(const striker of strikers){
    if(!striker.body.isEnabled()||p.down>0||p.health<=0)continue;
    // Only vehicles whose bounds can reach the probe get the per-collider test.
    const c=striker.body.translation(),reach=(striker.boundRadius??Infinity)+1.2;
    if((c.x-at.x)**2+(c.z-at.z)**2>reach*reach)continue;
     for(let i=0;i<striker.body.numColliders();i++){
      const collider=striker.body.collider(i);
      if(!collider.isSensor()&&collider.intersectsShape(PED_VEHICLE_PROBE,p.body.translation(),p.body.rotation())){this.carStrikesPed(striker,p);break;}
    }
   }
   if(p.down>0){
    // CTaskSimpleGetUp: GETUP_FRONT after a front fall, GETUP otherwise, at the clip's own pace; StartAnim first tests
    // the origin sphere against the cars and a car over the ped holds it down (bStuckUnderCar) until the car moves.
    const clip=getUpClip(p.fallClip),getUp=p.view.reactionDuration(clip)??1.37;
    p.down=Math.max(0,p.down-dt);
    if(p.down<=getUp&&p.view.reactionName!==clip){
     if(getUpBlockedBy(this.carOver(p,cars)?{bike:false,standingOn:false,attached:false}:undefined)){p.stuckUnderCar=true;p.down=getUp;p.view.holdReaction();}
     else{p.stuckUnderCar=false;p.view.playReaction(clip);}
    }
    if(p.down===0){
      const position=p.body.translation(),standing={...position,y:position.y+.6};
      if(this.sim.world.intersectionWithShape(standing,p.body.rotation(),PED_STAND_PROBE,undefined,undefined,p.collider,p.body)){p.down=.8;p.view.playReaction('ko_skid_front',.8);}
     else {p.collider.setShape(PED_STAND_PROBE);p.body.setTranslation(standing,true);p.collider.setTranslation(standing);}
    }
   }else p.flee=Math.max(0,p.flee-dt);
   // CTaskComplexSmartFleeEntity::ControlSubTask: a ped fled from is followed, dead or alive, while it exists; once it
   // is removed the flee is abandoned.
   if(p.fleePlayer?.from&&!this.people.includes(p.fleePlayer.from)||p.fleePlayer?.entity&&!p.fleePlayer.entity()){p.flee=0;p.fleePlayer=undefined;}
   // CTaskComplexKillPedOnFoot keeps the target it was built with, and CTaskComplexKillPedOnFootMelee ends once that
   // target is dead or gone (!m_target || m_fHealth <= 0): the fight is over, it never turns on the player instead.
   // A group member's kill task ends the same way, and he goes back to following.
   if(p.foe&&(p.foe.health<=0||!this.people.includes(p.foe))){p.foe=undefined;p.retaliate=0;p.fight=undefined;}
   if(p.fleePlayer&&p.flee>0&&p.fleeFrom){
    const f=p.fleePlayer,player=f.from?f.from.actor.player.position:f.entity?.()??f.point??this.sim.player.position,q=p.actor.player.position;f.check-=dt;
    // Each moved check re-aims the flee. It also raises CEventSeenPanickedPed, but that event (priority 13) only
    // displaces low-priority events (a chat partner, an attractor) that are not modelled, so bystanders ignore it.
    if(f.check<=0){f.check=SMART_FLEE_CHECK_SECONDS;if(Math.hypot(player.x-p.fleeFrom.x,player.z-p.fleeFrom.z)>=SMART_FLEE_TOLERANCE)p.fleeFrom={x:player.x,z:player.z};}
    if(Math.hypot(q.x-p.fleeFrom.x,q.z-p.fleeFrom.z)>=f.safe)p.flee=0;
   }
   if(p.flee<=0)p.fleePlayer=undefined;
   if(p.event&&!this.answering(p))p.event=undefined;
   // CTaskComplexOnFire's CTaskComplexSmartFleeEntity: sprint away from the player while the fire lasts,
   // with CTX_GLOBAL_PAIN_ON_FIRE said at a tenth probability (one line at a time).
   // CTaskComplexOnFire: a ped under water has his fire put out (Extinguish) and burns no more.
   if(p.onFire>0&&this.submerged(p))p.onFire=0;
   if(p.onFire>0&&p.health>0&&p.down===0){
    p.onFire=Math.max(0,p.onFire-dt);p.flee=Math.max(p.flee,.5);p.fleeFrom={x:this.sim.player.position.x,z:this.sim.player.position.z};p.retaliate=0;p.gunReact=undefined;
    p.onFireSpeech=Math.max(0,p.onFireSpeech-dt);if(this.frameDue&&p.onFireSpeech===0&&Math.random()<.1){p.onFireSpeech=2;this.onPain?.(p,{...state.position});}
   }
   p.scratch=Math.max(0,p.scratch-dt);p.retaliate=Math.max(0,p.retaliate-dt);if(p.retaliate<=0||!this.sim.player.swimming)p.taunt=undefined;p.retaliateCooldown=Math.max(0,p.retaliateCooldown-dt);p.meleeCooldown=Math.max(0,p.meleeCooldown-dt);p.stagger=Math.max(0,p.stagger-dt);p.bumpCooldown=Math.max(0,p.bumpCooldown-dt);
   // The kill task that named the foe is over once its window runs out: a later fight (turf, a bump) is with the player,
   // not the ped the last one was with. A script's kill order keeps its own target.
   if(p.retaliate<=0&&p.foe&&!p.order)p.foe=undefined;
   // The fight move belongs to CTaskSimpleFight inside the kill task: a knockdown, death, flee or fire that ends the
   // kill task ends the move with it, so none is resumed (or lands) later.
   if(p.fight&&(p.down>0||p.health<=0||p.retaliate<=0&&!p.officer&&!(p.order?.kind==='destroyCar'&&p.order.melee)))p.fight=undefined;
   // 1:1-track mirror: brain task follows legacy timers (authoritative this round).
   p.brain.syncFromTimers(p, typeof performance!=='undefined'?performance.now()/1000:0);
   // CTaskComplexWander::ComputeTargetPos: each ped walks to its own point beside the node.
   let to=this.wanderPoint(p),dx=to.x-state.position.x,dz=to.z-state.position.z;
   // CTaskComplexRoadRage out of the car: CTaskComplexTurnToFaceEntity at the player, CTaskSimpleShakeFist (FUCKU),
   // then CTaskComplexSeekEntity and CTaskComplexKillPedOnFoot for 20 s.
   if(p.rage&&p.health>0&&p.down===0){
    const pp=this.sim.player.position;let delta=Math.atan2(pp.x-state.position.x,pp.z-state.position.z)-state.heading;delta=Math.atan2(Math.sin(delta),Math.cos(delta));
    const turn=p.headingChange*Math.PI/180*50*dt;state.heading+=Math.max(-turn,Math.min(turn,delta));dx=0;dz=0;
    if(p.rage.phase==='face'){if(Math.abs(delta)<=.2){const shake=p.view.hasReaction('fucku')?p.view.reactionDuration('fucku')??1.3:1.3;if(p.view.hasReaction('fucku'))p.view.playReaction('fucku');p.rage={phase:'shake',time:shake};}}
    else{p.rage.time-=dt;if(p.rage.time<=0){p.rage=undefined;p.loiter=false;this.killPedOnFoot(p);p.retaliate=Math.max(p.retaliate,ROAD_RAGE_SEEK_SECONDS);}}
   }
   // A script's task outranks the wander it replaced, and lasts until its own time or tolerance says it is
   // done. The wander's own arrival and crossing are held off while it does, because the ped is not wandering.
   let orderSpeed:number|undefined;
   if(p.order&&p.health>0&&p.down===0){
    if(p.order.kind==='dive'){dx=0;dz=0;if(!p.evade)this.startNextOrder(p);}
    else if(p.order.kind==='standStill'){
     dx=0;dz=0;p.order.remaining-=dt;if(p.order.remaining<=0)this.startNextOrder(p);
    }else if(p.order.kind==='killPed'){
     // Over once the target is dead or gone (or the player dead), or when the task's own time runs out; the
     // retaliation it holds up ends with it. Until then the combat below moves and fights.
     const o=p.order;dx=0;dz=0;o.remaining-=dt;
     const over=o.foe?o.foe.health<=0||!this.people.includes(o.foe):this.sim.player.health<=0;
     if(over||o.remaining<=0){p.retaliate=0;p.foe=undefined;p.fight=undefined;this.startNextOrder(p);}
     else{p.foe=o.foe;p.retaliate=Math.max(p.retaliate,1);}
    }else if(p.order.kind==='playAnim'){
     const o=p.order;dx=0;dz=0;
     // elapsed -1 marks a clip still being read.
     if(!o.started){p.view.playReaction(o.clip,o.loop||o.hold?Number.POSITIVE_INFINITY:undefined,false,0,o.loop);o.started=true;o.elapsed=0;}
     else if(o.elapsed>=0){
      o.elapsed+=dt;o.remaining-=dt;
      // The script's time ends the task, a looped clip included; otherwise it ends as the clip does, or when something
      // else (a fall, a hit) has taken the ped's pose.
      // A held clip the task lets go (hands up) lasts the task's time rather than the clip's.
      // The clip ends when its own time does (SET_CHAR_ANIM_SPEED can stop it, SET_CHAR_ANIM_CURRENT_TIME move it).
      const replaced=p.view.reactionName!==o.clip,ended=!o.loop&&!(o.hold&&o.release)&&(p.view.reactionProgress??1)>=1;
      if(o.remaining<=0||replaced||ended){
       if(!replaced){if(o.hold&&!o.release)p.heldScriptClip=o.clip;else p.view.clearReaction();}
       this.startNextOrder(p);
      }
     }
    }else if(p.order.kind==='goToPointShooting'){
     const o=p.order,q=p.actor.player.position,gx=o.x-q.x,gz=o.z-q.z,distance=Math.hypot(gx,gz);dx=0;dz=0;
     if(goToPointArrived(distance,o.y===undefined?undefined:q.y+PED_ORIGIN_HEIGHT-o.y,o.radius,state.speed*dt))this.startNextOrder(p);
     else{({x:dx,z:dz}=this.roundCars(p,o,cars));const moveState=goToPointMoveState(o.moveState,distance,GO_STRAIGHT_MOVE_STATE_RADIUS);orderSpeed=moveState>=7?p.sprintSpeed:moveState>=5?p.runSpeed:p.walkSpeed;}
    }else if(p.order.kind==='destroyCar'){
     const o=p.order,car=this.resolveScriptVehicle?.(o.vehicle)?.entity();dx=0;dz=0;
     // ControlSubTask: the task is over once the car's health is gone (or the car is).
     if(!car||car.wrecked||car.disposed){if(o.melee)p.fight=undefined;this.startNextOrder(p);}
     else{
      const q=p.actor.player.position,c=car.car.body.translation(),distance=Math.hypot(c.x-q.x,c.y-(q.y+PED_ORIGIN_HEIGHT),c.z-q.z);
      // CalculateSearchPositionAndRanges: half the weapon's range, fired at from 0.9 of it (at least 0.8) and sought
      // again past 1.1 of it; the melee task's reach is the car's bound radius and 0.35.
      const half=(p.weapon?.info.weaponRange??0)/2,fireFrom=Math.max(.8,half*.9),seekPast=half*1.1,reach=car.boundRadius+DESTROY_CAR_MELEE_REACH;
      if(o.phase==='first')o.phase=distance<=(o.melee?reach:fireFrom)?'attack':'seek',o.remaining=DESTROY_CAR_GUN_SECONDS;
      if(o.phase==='seek'){
       if(o.melee?distance<=reach:distance<seekPast||!!p.flags?.kindaStayInSamePlace){o.phase='attack';o.remaining=DESTROY_CAR_GUN_SECONDS;}
       else{({x:dx,z:dz}=this.roundCars(p,c,[...cars].filter(other=>other!==car)));orderSpeed=p.runSpeed;}
      }else if(o.melee){
       if(distance>reach+DESTROY_CAR_MELEE_SLACK){o.phase='seek';o.face=undefined;p.fight=undefined;}
       else{
        // A strike has to reach the body, so the fight closes on the car's collision where it is nearest.
        const body=car.car.body.handle,near=this.sim.world.projectPoint({x:q.x,y:q.y+PED_ORIGIN_HEIGHT,z:q.z},true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,undefined,undefined,cl=>cl.parent()?.handle===body);
        o.face=near?{x:near.point.x,z:near.point.z}:{x:c.x,z:c.z};
        if(!p.fight&&Math.hypot(o.face.x-q.x,o.face.z-q.z)>NATIVE_MELEE_COMBOS.UNARMED.range*.8){dx=o.face.x-q.x;dz=o.face.z-q.z;orderSpeed=p.walkSpeed;}
       }
      }
      // The gun control runs its time, then the seek, which hands straight back while the car is in range.
      else if((o.remaining-=dt)<=0){o.remaining=DESTROY_CAR_GUN_SECONDS;if(distance>=seekPast&&!p.flags?.kindaStayInSamePlace)o.phase='seek';}
     }
    }else if(p.order.kind==='gunAt'){
     // Standing to aim; the gun block below points and fires. The task ends with its time or its target.
     const o=p.order;dx=0;dz=0;o.remaining-=dt;
     const gone=o.target!==undefined&&(o.target.health<=0||!this.people.includes(o.target))||o.player&&this.sim.player.health<=0;
     if(o.remaining<=0||gone)this.startNextOrder(p);
    }else if(p.order.kind==='duckFor'){
     dx=0;dz=0;p.order.remaining-=dt;
     if(p.order.remaining<=0){p.actor.player.crouched=false;this.startNextOrder(p);}
    }else if(p.order.kind==='followRoute'){
     // CTaskSimpleGoToPoint to each point at a 0.5 radius (no stand at the last: standStillAfterMove is false).
     const o=p.order,q=p.actor.player.position,point=o.points[o.at];dx=0;dz=0;
     const gx=point.x-q.x,gz=point.z-q.z,distance=Math.hypot(gx,gz);
     if(goToPointArrived(distance,point.y>MAP_Z_LOW_LIMIT?q.y+PED_ORIGIN_HEIGHT-point.y:undefined,GO_TO_POINT_RADIUS,state.speed*dt)){if(!nextRoutePoint(o))this.startNextOrder(p);}
     else{({x:dx,z:dz}=this.roundCars(p,point,cars));orderSpeed=o.moveState>=7?p.sprintSpeed:o.moveState>=5?p.runSpeed:p.walkSpeed;}
    }else if(p.order.kind==='chat'){
     // CTaskComplexChat::ControlSubTask. A partner that is gone ends it, as does a finish flagged last frame. Either
     // ped finishes when the other's chat is at an earlier stage, or holds the same part and is still going. The lead
     // speaker, never talking (no speech plays for script peds), finishes both at once when the other listens, and
     // gives up after fifty frames of silence otherwise.
     const o=p.order;dx=0;dz=0;o.remaining-=dt;
     const gone=o.partner!==undefined&&!this.people.includes(o.partner);
     if(gone||o.finished||o.remaining<=0){if(p.view.reactionName===CHAT_CLIP)p.view.clearReaction();this.startNextOrder(p);}
     else{
      const other=o.partner?.order?.kind==='chat'?o.partner.order:undefined;
      if(other&&(other.stage<o.stage||!other.finished&&o.chatter===other.chatter))o.finished=true;
      if(o.chatter){
       if(other&&!other.finished&&!other.chatter)other.finished=o.finished=true;
       if(++o.noChat>CHAT_SILENT_FRAMES){o.finished=true;if(other)other.finished=true;}
      }
     }
    }else if(p.order.kind==='followNodeRoute'){
     const o=p.order,q=p.actor.player.position;dx=0;dz=0;
     // Out of time, the stand-still sub-task teleports the ped onto the target and the task is over.
     if(o.remaining!==Number.POSITIVE_INFINITY)o.remaining-=dt;
     if(o.remaining<=0){this.placeOnGround(p,o.target.x,o.target.z,o.target.y);this.startNextOrder(p);}
     else{
      const point=o.points[o.at],gx=point.x-q.x,gz=point.z-q.z,distance=Math.hypot(gx,gz),last=o.lastIsTarget&&o.at===o.points.length-1;
      // The legs between nodes are CTaskSimpleGoToPoint at the task's move state; the last, to the target, is
      // CTaskComplexGoToPointAndStandStill with the task's tolerance and slow-down distance.
      if(goToPointArrived(distance,q.y+PED_ORIGIN_HEIGHT-point.y,last?FOLLOW_NODE_TARGET_TOLERANCE:FOLLOW_NODE_POINT_RADIUS,state.speed*dt)){
       if(last)this.startNextOrder(p);
       else if(++o.at>=o.points.length){Object.assign(o,this.planNodeRoute(p,o.target));o.at=0;}
      }else{
       ({x:dx,z:dz}=this.roundCars(p,point,cars));
       const moveState=last?goToPointMoveState(o.moveState,distance,FOLLOW_NODE_SLOW_DOWN_DISTANCE):o.moveState;
       orderSpeed=moveState>=7?p.sprintSpeed:moveState>=5?p.runSpeed:p.walkSpeed;
      }
     }
    }else if(p.order.kind==='gotoPed'){
     const o=p.order,q=p.actor.player.position;dx=0;dz=0;
     const holder=o.target?(o.target.health>0&&this.people.includes(o.target)?o.target.actor.player:undefined):this.sim.player;
     // The offset point: the target's native heading is its yaw less half a turn; the native offset (-sin a, cos a)
     // runs (-sin a, -cos a) here.
     const target=holder&&(o.offset?(()=>{const a=holder.heading-Math.PI+o.offset!.angle;return {x:holder.position.x-Math.sin(a)*o.offset!.radius,y:holder.position.y,z:holder.position.z-Math.cos(a)*o.offset!.radius};})():holder.position);
     if(o.remaining!==Number.POSITIVE_INFINITY)o.remaining-=dt;
     if(!target||o.remaining<=0)this.startNextOrder(p);
     else{
      const gx=target.x-q.x,gz=target.z-q.z,distance=Math.hypot(gx,gz);
      // Achieved: CTaskComplexTurnToFaceEntityOrCoord (bFaceEntityWhenDone), then the task is over.
      if(distance<=o.radius)p.order={kind:'achieveHeading',heading:o.offset&&holder?Math.atan2(holder.position.x-q.x,holder.position.z-q.z):Math.atan2(gx,gz)};
      else{({x:dx,z:dz}=this.roundCars(p,target,cars));orderSpeed=goToPointMoveState(6,distance,GO_TO_PED_WALK_DISTANCE)>=6?p.runSpeed:p.walkSpeed;}
     }
    }else if(p.order.kind==='enterCar'){
     const o=p.order,car=this.resolveScriptVehicle?.(o.vehicle);dx=0;dz=0;
     const seat=car?.alive()?car.seatFor(o.seat):undefined;
     if(!car||seat===undefined)this.startNextOrder(p);
     else{
      o.remaining-=dt;o.seek-=dt;
      const q=p.actor.player.position,door=car.doorPoint(seat,q);
      const distance=door?Math.hypot(door.x-q.x,door.z-q.z):Infinity;
      // The Timed task sets the ped in once its time is out (CTaskSimpleCarSetPedInAsPassenger / AsDriver). Getting to
      // the door does the same here, since the open-door, get-in and close-door clips are not played for script peds.
      // Setting the ped in swaps its body for a rider's, so it waits until the frame is done with this one.
      if(o.remaining<=0||door&&goToPointArrived(distance,undefined,ENTER_CAR_DOOR_RADIUS,state.speed*dt)){p.order={kind:'standStill',remaining:Number.POSITIVE_INFINITY};queueMicrotask(()=>{if(!this.disposed&&this.people.includes(p)&&!car.board(p,seat))this.startNextOrder(p);});}
      else if(!door||o.seek<=0)this.startNextOrder(p);
      else{({x:dx,z:dz}=this.roundCars(p,door,cars));const moveState=goToPointMoveState(o.moveState,distance,ENTER_CAR_SLOW_DOWN_DISTANCE);orderSpeed=moveState>=7?p.sprintSpeed:moveState>=5?p.runSpeed:p.walkSpeed;}
     }
    }else if(p.order.kind==='goToPoint'){
     const o=p.order;dx=0;dz=0;
     // CTaskComplexGoToPointAndStandStillTimed::ControlSubTask: out of time and not yet standing, the ped is put on
     // the point, CPedPlacement::FindZCoorForPed's ground under it.
     if(o.remaining!==Number.POSITIVE_INFINITY){o.remaining-=dt;if(o.remaining<=0){o.remaining=Number.POSITIVE_INFINITY;this.placeOnGround(p,o.x,o.z,o.y);}}
     const q=p.actor.player.position,gx=o.x-q.x,gz=o.z-q.z,distance=Math.hypot(gx,gz);
     const moveState=goToPointMoveState(o.moveState,distance,o.moveStateRadius);
     const speed=moveState>=7?p.sprintSpeed:moveState>=5?p.runSpeed:p.walkSpeed;
     if(goToPointArrived(distance,o.y===undefined?undefined:q.y+PED_ORIGIN_HEIGHT-o.y,o.radius,state.speed*dt))this.startNextOrder(p);
     else{({x:dx,z:dz}=this.roundCars(p,o,cars));orderSpeed=speed;}
    }else{
     dx=0;dz=0;
     const turned=achieveHeadingStep(state.heading,p.order.heading,p.headingChange,dt);
     state.heading=turned.heading;
     if(turned.done)this.startNextOrder(p);
    }
   }
   // physicalFlags.bDontApplySpeed: a frozen ped keeps its place whatever else it was doing.
   if(p.frozen){dx=0;dz=0;}
   const fleeing=!p.officer&&p.flee>0&&p.down===0&&p.retaliate<=0;
   if(!p.order&&!p.loiter&&!fleeing&&p.scratch<=0&&p.retaliate<=0&&(p.stuck?.seconds??0)>WANDER_STUCK_SECONDS){this.scratchHead(p);to=this.wanderPoint(p);dx=to.x-state.position.x;dz=to.z-state.position.z;}
   else if(!p.order&&!p.loiter&&!fleeing&&this.wanderArrived(p,to,dt)){this.chooseTarget(p);this.startCrossing(p);p.blocked=0;p.allNodesBlocked=false;to=this.wanderPoint(p);dx=to.x-state.position.x;dz=to.z-state.position.z;}
   // ScanForBlockedNodes: a blocked next node re-routes along the same direction; when the new one is blocked too,
   // m_bAllNodesBlocked stops the scan (what CreateNextSubTask does with it is unreversed).
   else if(!p.order&&!p.loiter&&!fleeing&&!p.allNodesBlocked&&this.wanderNodeBlocked(p,to,cars)){
    this.chooseTarget(p,true);this.startCrossing(p);p.blocked=0;to=this.wanderPoint(p);
    if(this.wanderNodeBlocked(p,to,cars))p.allNodesBlocked=true;
    dx=to.x-state.position.x;dz=to.z-state.position.z;
   }
   if(p.loiter&&p.flee<=0&&p.down===0&&p.retaliate<=0){dx=0;dz=0;}
   if(!p.order&&!p.loiter&&!fleeing&&!p.attract&&!p.crossing&&!p.officer&&!p.follow&&!p.party&&p.health>0&&p.down===0){
    p.attractScan-=dt;if(p.attractScan<=0){p.attractScan=ATTRACTOR_SCAN_SECONDS;this.noticeAttractor(p);}
   }
   if(!p.order&&!p.loiter&&!fleeing&&!p.attract&&!p.crossing&&p.health>0&&p.down===0&&(dx||dz)){const step=this.avoidOtherPeds(p,dt,{x:dx,z:dz},to);if(step){dx=step.x;dz=step.z;}}
   if(p.attract&&!p.order){
    const calm=p.flee<=0&&p.down===0&&p.retaliate<=0&&p.stagger<=0&&!p.evade&&!p.gunReact&&!p.carReact&&!p.fight&&p.health>0;
    if(!calm)this.leaveAttractor(p);
    else if(p.attract.phase==='go'&&p.attract.goal){
     // CTaskComplexGoToAttractor: stand for the shuffle delay, then walk to the slot; arrive within its range.
     p.attract.time+=dt;
     const goal=p.attract.goal,gx=goal.x-state.position.x,gz=goal.z-state.position.z;
     if(p.attract.time<p.attract.startAt){dx=0;dz=0;}
     else if(Math.hypot(gx,gz)<=(this.attractorQueues.get(p.attract.key)?.params.arriveRange??.2)){dx=0;dz=0;this.arriveAttractor(p);}
     else{dx=gx;dz=gz;}
    }
    else{dx=0;dz=0;state.heading=p.attract.heading;if(p.attract.phase!=='wait')this.stepAttractor(p,dt);}
   }
   // CTaskComplexInvestigateDeadPed: TASK_SIMPLE_STAND_STILL 1000 ms, CTaskComplexGoToPointAndStandStill at a run to
   // 2 units from the body (target radius 0.5), CTaskSimpleAchieveHeading at it, the head look-at for 5 to 7 s
   // (CTaskComplexSignalAtPed is a retail stub), the ROADCROSS gesture with CTX_GLOBAL_SHOCKED, then
   // CTaskSimpleGoToPoint back to where the ped started at a walk.
   // CreateStealCarBackSeq then CTaskComplexStealCar: a pause or a fist shake, then run at the car (its enter task
   // gives up after 10 s; the browser stops at the car instead of re-entering it).
   let stealSpeed:number|undefined;
   if(p.stealBack){
    if(p.health<=0||p.down>0||p.flee>0||p.retaliate>0||p.gunReact||p.evade||p.carReact||p.fight||p.stagger>0)p.stealBack=undefined;
    else{
     const sb=p.stealBack;dx=0;dz=0;stealSpeed=0;
     switch(sb.phase){
      case 'pause':sb.time-=dt;if(sb.time<=0){sb.phase='go';sb.time=10;}break;
      case 'face':{const pp=this.sim.player.position;let delta=Math.atan2(pp.x-state.position.x,pp.z-state.position.z)-state.heading;delta=Math.atan2(Math.sin(delta),Math.cos(delta));const turn=p.headingChange*Math.PI/180*50*dt;state.heading+=Math.max(-turn,Math.min(turn,delta));
       if(Math.abs(delta)<=.2){sb.phase='shake';sb.time=p.view.hasReaction('fucku')?p.view.reactionDuration('fucku')??1.3:1.3;if(p.view.hasReaction('fucku'))p.view.playReaction('fucku');}break;}
      case 'shake':sb.time-=dt;if(sb.time<=0){sb.phase='go';sb.time=10;}break;
      case 'go':{const c=sb.car.position(),tx=c.x-state.position.x,tz=c.z-state.position.z;sb.time-=dt;if(Math.hypot(tx,tz)<=2.5||sb.time<=0)p.stealBack=undefined;else{dx=tx;dz=tz;stealSpeed=p.runSpeed;}break;}
     }
    }
   }
   // CTaskComplexGangLeader: the leader stands 5 s, turns to face a random member, and either stands again or walks
   // off for 0 to 15 s (5 %, or under three members), after which the party's default tasks go random and it breaks
   // up; every frame 5 % of the time he looks at a member for 3 to 5 s, and 5 in 501 he plays a partial gang talk
   // clip when none runs. Followers (CTaskComplexGangFollower is a retail stub) hold their spot and do the same.
   let hangoutSpeed:number|undefined;
   if(p.party&&p.health>0&&p.down===0){
    const leader=p.party.leader,alive=p.party.members.filter(m=>m.health>0&&m.down===0);
    if(p.flee>0||p.retaliate>0||p.fight||p.gunReact||p.evade||p.carReact||p.attackWave||leader.health<=0||!this.people.includes(leader)||alive.length<2){for(const m of p.party.members){m.party=undefined;m.hangout=undefined;m.lookTarget=undefined;}}
    else{
     const h=leader.hangout;
     const facePoint=(x:number,z:number)=>{let delta=Math.atan2(x-state.position.x,z-state.position.z)-state.heading;delta=Math.atan2(Math.sin(delta),Math.cos(delta));const turn=p.headingChange*Math.PI/180*50*dt;state.heading+=Math.max(-turn,Math.min(turn,delta));return Math.abs(delta);};
     const faceToward=(t:Pedestrian)=>facePoint(t.actor.player.position.x,t.actor.player.position.z);
     // CGroupEventHandler::ComputeStareResponse: with the player inside eight units of the leader the party turns
     // on him for three to five seconds either side of a second, alternating standing still with turning to face.
     const pl=this.sim.player.position,lead=leader.actor.player.position;
     const stareNear=this.sim.player.health>0&&(!h||h.phase!=='wander')&&stareInRange({x:lead.x,z:lead.z},{x:pl.x,z:pl.z});
     if(stareNear&&!p.stare&&!p.staredAt){
      p.stare={remaining:stareTimeoutSeconds(this.hangoutRandom),phase:'stand',time:stareStandSeconds(this.hangoutRandom)};p.staredAt=this.clock;
      // DoGangAbuseSpeech: the gang's line for the player, through the browser's threat vocal (the abuse banks are
      // not in the depot).
      if(gangAbuseContext({talkerIsGangster:p.gang!==undefined,targetIsPlayer:true}))this.onThreat?.(p,{...p.actor.player.position});
     }
     if(p.stare&&!stareNear)p.stare=undefined;
     if(p.staredAt!==undefined&&!stareNear&&this.clock-p.staredAt>10)p.staredAt=undefined;
     if(p.stare){
      dx=0;dz=0;hangoutSpeed=0;
      const phase=stepStare(p.stare,dt,facePoint(pl.x,pl.z)<=.2,this.hangoutRandom);
      if(phase==='done')p.stare=undefined;
      else{
       const clip=this.frameDue?stareTalkClip(this.hangoutRandom,stareNear,!!p.view.reactionName):undefined;
       if(clip&&p.view.hasReaction(clip))p.view.playReaction(clip);
       if(!p.look){p.lookTarget=undefined;p.look=startLookAt(this.clock*1000,500);}
      }
     }
     else if(p===leader&&h){
      if(h.phase==='stand'){dx=0;dz=0;hangoutSpeed=0;h.time-=dt;if(h.time<=0){const others=alive.filter(m=>m!==p);const m=others[Math.floor(this.hangoutRandom()*others.length)];if(m){h.phase='face';h.facing=m;}else h.time=5;}}
      else if(h.phase==='face'){dx=0;dz=0;hangoutSpeed=0;const f=h.facing;if(!f||f.health<=0||faceToward(f)<=.2){if(this.hangoutRandom()<.05||alive.length<3){h.phase='wander';h.time=this.hangoutRandom()*15;}else{h.phase='stand';h.time=5;}}}
      // The walk ends once its 0-15 s timer is out and the leader stands within √2 of his next or last path node
      // (GetDistSqOfClosestPathNodeToPed <= 2); the RANDOM allocator it then hands over to is a stub, so the party parts.
      else{h.time-=dt;if(h.time<=0){const q=p.actor.player.position,near=[p.target,p.previousNode].some(n=>!!n&&(n.position[0]-q.x)**2+(-n.position[1]-q.z)**2<=2);
       if(near)for(const m of p.party.members){m.party=undefined;m.hangout=undefined;m.lookTarget=undefined;}}}
     }else if(h&&h.phase!=='wander'){dx=0;dz=0;hangoutSpeed=0;faceToward(leader);}
     // CTaskComplexGangLeader::ControlSubTask runs the leader's looks and talk whatever his subtask, walking included,
     // though not while he runs or sprints, and a new talk clip waits while ShouldLoadGangAnims holds the block back
     // (the player driving past faster than 0.02 units a frame). The followers' task is not reversed; they keep still.
     const gangAnims=(this.playerVehicleSpeed?.()??0)<=.02;
     if(p.party&&!p.stare&&(!h||h.phase!=='wander'||p===leader&&this.moveState(p)<PEDMOVE.run)){
      if(this.frameDue&&!p.look&&this.hangoutRandom()<.05){const others=alive.filter(m=>m!==p);const m=others[Math.floor(this.hangoutRandom()*others.length)];if(m){p.lookTarget=m;p.look=startLookAt(this.clock*1000,3000+Math.floor(this.hangoutRandom()*2000));}}
      if(this.frameDue&&gangAnims&&!p.view.reactionName&&this.hangoutRandom()*501<5){const clip='prtial_gngtlk'+'abcdefgh'[Math.floor(this.hangoutRandom()*8)];if(p.view.hasReaction(clip))p.view.playReaction(clip);}
     }
    }
   }
   let investigateSpeed:number|undefined;
   if(p.investigate){
    // CTaskComplexInvestigateDeadPed finishes once its dead ped is gone (!m_deadPed): a culled body is not visited.
    if(p.health<=0||p.down>0||p.flee>0||p.retaliate>0||p.gunReact||p.evade||p.carReact||p.fight||p.stagger>0||!this.people.includes(p.investigate.body)){p.investigate=undefined;p.lookAt=undefined;}
    else{
     const inv=p.investigate,b=inv.body.actor.player.position,bx=b.x-state.position.x,bz=b.z-state.position.z,bd=Math.hypot(bx,bz)||1;
     dx=0;dz=0;investigateSpeed=0;
     const face=()=>{let delta=Math.atan2(bx,bz)-state.heading;delta=Math.atan2(Math.sin(delta),Math.cos(delta));const turn=p.headingChange*Math.PI/180*50*dt;state.heading+=Math.max(-turn,Math.min(turn,delta));return Math.abs(delta);};
     switch(inv.phase){
      case 'stand':inv.time-=dt;if(inv.time<=0)inv.phase='go';break;
      case 'go':{const tx=b.x-bx/bd*2-state.position.x,tz=b.z-bz/bd*2-state.position.z;if(Math.hypot(tx,tz)<=.5)inv.phase='face';else{dx=tx;dz=tz;investigateSpeed=p.runSpeed;}break;}
      case 'face':if(face()<=.2){inv.phase='look';inv.time=inv.lookMs/1000;p.lookAt={x:b.x,y:b.y+.3,z:b.z};p.look=startLookAt(this.clock*1000,inv.lookMs);}break;
      case 'look':face();inv.time-=dt;if(inv.time<=0){inv.phase='shocked';inv.time=this.playRoadCross(p)||1.5;p.lookAt=undefined;}break;
      case 'shocked':inv.time-=dt;if(inv.time<=0)inv.phase='back';break;
      case 'back':{const tx=inv.start.x-state.position.x,tz=inv.start.z-state.position.z;if(Math.hypot(tx,tz)<=.5)p.investigate=undefined;else{dx=tx;dz=tz;investigateSpeed=p.walkSpeed;}break;}
     }
    }
   }
   // CTaskComplexWanderCop wanders sensibly, as a civilian does, so a beat cop off duty (no stars, no criminal) waits at
   // crossings too.
   const copWandering=p.officer&&!this.law?.level&&!p.chase;
   const reactSpeed=p.gunReact&&!p.officer?this.stepGetRunOver(p,dt,cars)??(p.gunReact?this.stepGunReact(p,dt,(x,z)=>{dx=x;dz=z;}):undefined):p.officer?this.stepGetRunOver(p,dt,cars)??(copWandering&&p.crossing&&!p.order?this.stepCrossing(p,dt):undefined):this.stepGetRunOver(p,dt,cars)??(p.crossing&&!p.order?this.stepCrossing(p,dt):undefined);
   if(fleeing){
    const threat=p.fleeFrom??this.sim.player.position,ax=state.position.x-threat.x,az=state.position.z-threat.z,node=this.fleeNode(p,ax,az);
    if(node){dx=node.x-state.position.x;dz=node.z-state.position.z;}else{dx=ax;dz=az;}
   }
   // CJ and a ped bumping on foot (CEventPlayerCollisionWithPed).
   if(!p.officer&&p.health>0&&p.down===0&&p.bumpCooldown<=0&&this.sim.player.health>0&&this.sim.playerCollider.isEnabled()&&(this.sim.player.speed>0.5||state.speed>0.5)){
    const pp=this.sim.player.position,px=pp.x-state.position.x,pz=pp.z-state.position.z;
    if(Math.hypot(px,pz)<1.1){
     p.bumpCooldown=2;
     // The player's side is reversed: he may stagger toward the ped (ComputePedHitSide is a stub, so the side is
     // where the ped is). His BUMP line needs speech banks the depot lacks; AnnoyPlayerPed's temper has no reader here.
     const ph=this.sim.player.heading,playerSpeed=this.sim.player.speed;
     const response=playerCollisionWithPedResponse({
      player:playerSpeed<.1?PEDMOVE.still:playerSpeed<3?PEDMOVE.walk:playerSpeed<7?PEDMOVE.run:PEDMOVE.sprint,victim:this.moveState(p),
      inFront:-px*Math.sin(ph)-pz*Math.cos(ph)>=0,behindVictim:px*Math.sin(state.heading)+pz*Math.cos(state.heading)>0,
      playerDefend:NATIVE_PLAYER_DEFEND_MULT,victimDefend:p.defendMult,follower:p.follow});
     if(response.stagger){const view=this.playerView(),clip=(['hit_front','hit_l','hit_back','hit_r'] as const)[browserLocalDirection(ph,-px,-pz)];if(view&&!view.reactionName&&view.hasReaction(clip))view.playReaction(clip);}
     // The ped's side (EventHandler 0x4BE7D0 and 0x4BDB80) is a stub: a moving player shoves it aside, it turns to
     // face him, and hotheads swing back (authored). No crime.
     if(playerSpeed>0.5){
      const push=2/Math.max(.3,Math.hypot(px,pz));
      p.impulse.x+=-px*push;p.impulse.z+=-pz*push;
      state.heading=Math.atan2(px,pz);
      // Only when ComputePlayerCollisionWithPedResponse finds the ped annoyed (AnnoyPlayerPed), and never a recruit in
      // formation, whom the bump leaves with the BUMP line alone.
      if(p.temper>=60&&!p.follow&&response.annoy){p.retaliate=Math.max(p.retaliate,4);p.flee=0;}
     }
    }
   }
   // Gangs that hate the player: the acquaintance scanner's sighting (in front, within the seeing range) reaches the
   // gang's group, which answers with a kill-threats task for every member TURF_KILL_THREATS_CHANCE of the time, once
   // for each time he comes into view (see nativePopulation). A gang that only dislikes him leaves him be.
   if(!p.officer&&p.health>0&&p.down===0&&this.sim.player.health>0){
    const t=this.sim.player.position,d=Math.hypot(t.x-state.position.x,t.z-state.position.z);
    if(p.gang!==undefined&&!p.follow&&this.regardForPlayer(p)===ACQUAINTANCE_HATE){
     const h=state.heading,inFront=(t.x-state.position.x)*Math.sin(h)+(t.z-state.position.z)*Math.cos(h)>0;
     if(d<=PED_SEEING_RANGE&&inFront&&!p.turfSighted){
      p.turfSighted=true;
      if(this.turfRandom()<TURF_KILL_THREATS_CHANCE)for(const m of p.party?.members??[p])if(m.health>0&&!m.officer){m.turfFoe=true;m.turfSighted=true;}
     }else if(d>PED_SEEING_RANGE*2)p.turfSighted=false;
    }
    // CTaskComplexKillPedOnFoot holds until the player gets clear of it.
    if(p.turfFoe&&d>PED_SEEING_RANGE*4)p.turfFoe=false;
    if(p.attackWave||p.warFoe||p.turfFoe||gangHostile(p.gang,d)){p.retaliate=Math.max(p.retaliate,2);p.flee=0;}
   }
   // Armed turf gangs stand and shoot instead of brawling (escalated pursuit).
   let gunHold:number|undefined,gunEngaged=false;
   let spot:ReturnType<WorldPedestrians['spotTarget']>|undefined;
   // CTaskComplexKillPedOnFoot aims at its threat (TaskAllocatorKillThreatsBasic hands a group member the leader's
   // attacker): a retaliating ped's live foe, otherwise the player. A follower never turns its gun on him.
   const gunFoe=p.retaliate>0&&p.foe&&p.foe.health>0?p.foe:undefined;
   const gunOrder=p.order?.kind==='gunAt'||p.order?.kind==='goToPointShooting'?p.order:undefined;
   const carToShoot=p.order?.kind==='destroyCar'&&!p.order.melee&&p.order.phase==='attack'?this.resolveScriptVehicle?.(p.order.vehicle)?.entity():undefined;
   if(carToShoot&&!carToShoot.wrecked&&p.weapon&&p.health>0&&p.down===0&&!p.officer){
    // CTaskSimpleGunControl on the car: face it and fire at its middle (spotTarget aims a unit above what it is given).
    const c=carToShoot.car.body.translation();spot=this.spotTarget(p,{x:c.x,y:c.y-1,z:c.z},cars);
    state.heading=Math.atan2(spot.offset.x,spot.offset.z);
    p.view.setWeaponPose('police_fire');p.view.setWeaponAim(spot.offset.clone().normalize());gunHold=0;
    gunEngaged=spot.distance<p.weapon.info.weaponRange;
   }else if(gunOrder&&p.weapon&&p.health>0&&p.down===0&&!p.officer){
    // A script's gun task: the point itself (spotTarget aims a unit above what it is given), or the ped's body.
    const point=gunOrder.kind==='gunAt'?gunOrder.point:undefined;
    const at=point?{...point,y:point.y-1}:gunOrder.target?gunOrder.target.actor.player.position:this.sim.player.position;
    spot=this.spotTarget(p,at,cars,gunOrder.target);
    // Standing, the ped turns to what it aims at; on the move it keeps its heading and aims the gun.
    if(gunOrder.kind==='gunAt')state.heading=Math.atan2(spot.offset.x,spot.offset.z);
    p.view.setWeaponPose('police_fire');p.view.setWeaponAim(spot.offset.clone().normalize());gunHold=0;
    const alive=gunOrder.target?gunOrder.target.health>0:gunOrder.kind==='gunAt'&&gunOrder.point?true:this.sim.player.health>0;
    gunEngaged=(gunOrder.kind==='goToPointShooting'||gunOrder.fire)&&alive&&spot.distance<p.weapon.info.weaponRange;
   }else if(!p.officer&&p.weapon&&p.health>0&&p.down===0&&this.sim.player.health>0&&(gunFoe||!p.follow)){
    spot=this.spotTarget(p,gunFoe?gunFoe.actor.player.position:this.sim.player.position,cars,gunFoe);
    p.view.setWeaponAim();p.view.setWeaponPose();
    const hostile=!!gunFoe||p.retaliate>0||!!p.turfFoe||gangHostile(p.gang,Math.hypot(this.sim.player.position.x-state.position.x,this.sim.player.position.z-state.position.z));
    const fight=p.gunFight??={shooting:false,lastAttack:-Infinity},range=p.weapon.info.targetRange,d=spot.distance;
    if(!hostile||!spot.visible)fight.shooting=false;
    // CTaskComplexKillPedOnFootArmed: fire from a quarter of the target range at once, or from half of it once two
    // seconds have passed since the last attack or the player comes toward the ped (his speed against its forward);
    // stop at the full range, or past half once
    // two seconds have gone without an attack. GunControl also stops beyond the weapon's range.
    else if(!fight.shooting){
     const v=this.sim.player,coming=!gunFoe&&(v.position.x-v.previous.x)*Math.sin(state.heading)+(v.position.z-v.previous.z)*Math.cos(state.heading)<0;
     fight.shooting=d<=range/4||d<=range/2&&(this.clock-fight.lastAttack>=2||coming);
    }else if(d>=range||d>=range/2&&this.clock-fight.lastAttack>=2)fight.shooting=false;
    gunEngaged=fight.shooting&&d<p.weapon.info.weaponRange;
    if(gunEngaged){p.view.setWeaponPose('police_fire');p.view.setWeaponAim(spot.offset.clone().normalize());gunHold=0;}
    // Out of shooting reach, TASK_COMPLEX_SEEK_ENTITY closes on the player, unless the ped keeps its place.
    else if(hostile&&spot.visible&&p.retaliate<=0&&!p.loiter){dx=this.sim.player.position.x-state.position.x;dz=this.sim.player.position.z-state.position.z;gunHold=p.runSpeed;}
   }
   // CTaskComplexDestroyCarMelee's fighting control: fists on the car's nearest face, closing on it first.
   if(p.order?.kind==='destroyCar'&&p.order.melee&&p.order.face&&p.health>0&&p.down===0)this.stepCarBrawl(p,p.order.vehicle,p.order.face,dt);
   // Street retaliation: victims trade punches with their enemy (CTaskComplexFight).
   // Crew share the player's enemies; everyone else answers the player.
   if(!p.officer&&p.retaliate>0&&p.health>0&&p.down===0&&!p.evade&&this.sim.player.health>0){
     const foe=p.foe&&p.foe.health>0?p.foe:undefined;
     if(!foe)p.foe=undefined;
     if(p.follow&&!foe){
       // No enemy: fall through to the wedge below.
     }else{
     const target=foe?foe.actor.player.position:this.sim.player.position;
     dx=target.x-state.position.x;dz=target.z-state.position.z;
     // CTaskComplexKillPedOnFootMelee with its target in the water: turn to face it and shake a fist
     // (CTaskSimpleShakeFist, FUCKU), stand still 2 s, and again while it stays in.
     if(!foe&&!gunEngaged&&this.sim.player.swimming){p.fight=undefined;this.stepShoreTaunt(p,dx,dz,dt);}
     else{p.taunt=undefined;if(!gunEngaged)this.stepBrawl(p,foe,dt);else p.fight=undefined;}
     }
   }
   let policeSpeed:number|undefined;
    // Recruited crew hold a loose wedge behind the player on foot and ride
    // passenger seats (front-right plus rear bench) when the mark drives.
   let followSpeed:number|undefined;
   // A script's ped follows only while the script has no task of its own running on it: the group's task sits under
   // the primary one (CPedIntelligence's TASK_PRIMARY_PRIMARY over the group's default).
   if(p.follow&&!p.officer&&p.health>0&&p.down===0&&!(p.mission&&this.hasScriptTask(p))){
    // CPedGroupMembership::Process keeps a dead player leading his group and lets go of any follower further than the
    // separation range from him, on foot or driving, in 3D. The script's own groups do that for its peds.
    {
     const ride=[...cars].find(c=>c.occupied);
     const pp=ride?ride.car.body.translation():this.sim.player.position;
     const gap=Math.hypot(pp.x-state.position.x,pp.y-state.position.y,pp.z-state.position.z);
     if(gap>this.groupSeparationRange&&!p.flags?.neverLeavesGroup&&!p.mission)this.leaveGroup(p);
     else if(this.sim.player.health<=0){}
     else if(p.retaliate<=0&&p.holdPosition){
      dx=p.holdPosition.x-state.position.x;dz=p.holdPosition.z-state.position.z;
      followSpeed=Math.hypot(dx,dz)>1?p.walkSpeed:0;
     }
     else if(p.retaliate<=0){
      const hx=this.sim.player.heading,side=p.id%2?1.3:-1.3;
      dx=pp.x-Math.sin(hx)*2.5-Math.cos(hx)*side-state.position.x;
      dz=pp.z-Math.cos(hx)*2.5+Math.sin(hx)*side-state.position.z;
      followSpeed=Math.hypot(dx,dz)>2.2?p.runSpeed:0;
     }
    }
   }
   if(p.officer){
    p.flash=Math.max(0,p.flash-dt);p.view.setWeaponAim();p.view.setWeaponPose();let engaged=false;
    const law=this.law!,target=this.sim.player.position,onFoot=this.sim.playerCollider.isEnabled()&&this.sim.playerBody.isEnabled();
    const {eye,aim,offset,distance,visible}=this.spotTarget(p,target,cars);
    // CTaskComplexPolicePursuit::ControlSubTask re-runs SetWeapon while its subtask is the arrest.
    if(law.level&&this.pursuers.has(p))p.copWeapon=policePursuitWeapon({current:p.copWeapon,wantedLevel:law.level,playerHoldsGun:this.playerArmed(),arresting:p.arrest>0});
    // m_IsRoadBlockCop: CTaskComplexPolicePursuit keeps him bStayInSamePlace with the pistol, shooting from his post.
    const roadblockCop=!!p.crew?.roadblock&&law.level>0;if(roadblockCop&&this.pursuers.has(p))p.copWeapon='pistol';
    const gunAllowed=p.copWeapon==='pistol'&&!law.arrested;
    // CTaskComplexWanderCop::ScanForStuff every 50 ms while the cop wanders (no pursuit, no crew errand): car alarms
    // and stolen cop cars every scan, criminals in sight at most every 30 s.
    // A cop outside the pursuit (over m_MaxCopsInPursuit) wanders on and keeps scanning.
    if(!p.goTo&&!this.pursuers.has(p)&&p.health>0&&p.down===0){
     p.copScan+=dt;p.criminalsAt=Math.max(0,p.criminalsAt-dt);
     if(p.copScan>=.05){p.copScan=0;this.lookForCarAlarms(p);this.lookForStolenCopCars();if(p.criminalsAt<=0)this.lookForCriminals(p);}
    }
    if(p.chase){const t=p.chase.target;p.chase.seconds-=dt;if(law.level||p.goTo||p.chase.seconds<=0||t.health<=0||!this.people.includes(t))p.chase=undefined;}
     if(p.goTo&&p.down===0){const gx=p.goTo.x-state.position.x,gz=p.goTo.z-state.position.z;if(p.goTo.arrive!==undefined&&Math.hypot(gx,gz)<=p.goTo.arrive)p.goTo=undefined;else{dx=gx;dz=gz;policeSpeed=p.goTo.walk?p.walkSpeed:p.runSpeed;p.arrest=0;p.fight=undefined;}}
      else if(law.level&&this.pursuers.has(p)&&state.health>0&&p.health>0&&p.down===0&&this.sim.player.health>0){
       if(visible&&distance<45)law.see(target);
       if(law.arrested){
        // CTaskComplexArrestPed: while the suspect is being arrested the other cops seek it to
        // 4 units; the arresting cop stays on its ARRESTgun clip.
        p.fight=undefined;
        if(p.arrest>0){policeSpeed=0;state.heading=Math.atan2(offset.x,offset.z);}
        else{dx=target.x-state.position.x;dz=target.z-state.position.z;policeSpeed=Math.hypot(dx,dz)>4?p.runSpeed:0;}
       }else if(onFoot&&visible&&copCanArrest({cop:state.position,suspect:target,suspectFalling:this.sim.knockdown>this.sim.knockdownGetUp,up:'y'})){
        policeSpeed=0;state.heading=Math.atan2(offset.x,offset.z);this.arrestPlayer(p);
       }else if(onFoot&&visible&&this.sim.knockdown>this.sim.knockdownGetUp){
        // The suspect is falling but out of reach: ControlSubTask swaps the attack for
        // CTaskComplexSeekEntity, so the cop runs in to arrest rather than shoot.
        p.fight=undefined;dx=target.x-state.position.x;dz=target.z-state.position.z;policeSpeed=Math.hypot(dx,dz)>2?p.runSpeed:0;
       }else if(p.copWeapon==='nightstick'){
        // CTaskComplexKillPedOnFoot with the nightstick: close to the combo's range, then swing.
        const chase=visible?target:law.lastKnown??target;
        dx=chase.x-state.position.x;dz=chase.z-state.position.z;
        policeSpeed=Math.hypot(dx,dz)>NATIVE_MELEE_COMBOS.BBALLBAT.range?p.runSpeed:0;
        if(onFoot&&this.stepNightstick(p,visible,dt))policeSpeed=0;
       }else{
        p.fight=undefined;
        const chase=law.lastKnown??target;dx=chase.x-state.position.x;dz=chase.z-state.position.z;policeSpeed=gunAllowed&&visible&&distance<(p.weapon?.info.targetRange??12)||!visible&&Math.hypot(dx,dz)<2?0:p.runSpeed;
       }
     if(roadblockCop&&!p.goTo&&policeSpeed!==undefined&&!law.arrested)policeSpeed=0;
     if(gunAllowed&&visible&&p.weapon&&distance<p.weapon.info.weaponRange&&policeSpeed===0){
      engaged=true;p.view.setWeaponPose('police_fire');p.view.setWeaponAim(offset.clone().normalize());
     }
    }else{
     p.arrest=0;p.fight=undefined;
     // CEventPedToChase's CTaskComplexSeekEntity: run at the criminal, walk inside 2 m, stop within 1 m.
     if(p.chase&&p.down===0){const t=p.chase.target.actor.player.position;dx=t.x-state.position.x;dz=t.z-state.position.z;const d=Math.hypot(dx,dz);policeSpeed=d>2?p.runSpeed:d>1?p.walkSpeed:0;}
    }
    if(p.weapon&&p.gunState)this.stepPedGun(p,p.weapon,eye,aim,offset,cars,dt,engaged);
    if(p.gun)p.gun.root.visible=p.copWeapon==='pistol'&&!p.weaponHidden;
    if(p.stick)p.stick.root.visible=p.copWeapon==='nightstick';
    if(p.gun)for(const binding of p.gun.materialBindings)if(binding.source.texture.toLowerCase().startsWith('muzzle'))binding.material.visible=p.flash>0;
   }else if(!p.officer&&p.weapon&&spot){
    p.flash=Math.max(0,p.flash-dt);
    this.stepPedGun(p,p.weapon,spot.eye,spot.aim,spot.offset,cars,dt,gunEngaged);
    if(p.gun)for(const binding of p.gun.materialBindings)if(binding.source.texture.toLowerCase().startsWith('muzzle'))binding.material.visible=p.flash>0;
   }
    const length0=Math.hypot(dx,dz);
    if(p.blocked>.3&&p.down===0&&length0>.01){const slide=sidestepDirection(dx/length0,dz/length0,p.id%2?1:-1);dx=slide.x*length0;dz=slide.z*length0;}
     const retaliating=!p.officer&&p.retaliate>0&&p.health>0&&p.down===0&&(!p.follow||(p.foe?.health??0)>0)&&p.taunt===undefined;
     const retaliateDist=retaliating?Math.hypot((p.foe&&p.foe.health>0?p.foe.actor.player.position:this.sim.player.position).x-state.position.x,(p.foe&&p.foe.health>0?p.foe.actor.player.position:this.sim.player.position).z-state.position.z):Infinity;
     const length=Math.hypot(dx,dz),target=p.down>0||p.stagger>0||p.scratch>0||p.taunt!==undefined||p.drowning||p.landing!==undefined||p.air||p.rage||p.loiter&&p.flee<=0&&p.retaliate<=0?0:(fleeing||retaliating?undefined:orderSpeed)??policeSpeed??gunHold??followSpeed??reactSpeed??investigateSpeed??stealSpeed??hangoutSpeed??(retaliating?(retaliateDist>NATIVE_MELEE_COMBOS.UNARMED.range&&!p.fight?p.runSpeed:0):(p.flee>0||this.clearStreets&&p.gang===undefined&&!p.dealer?p.sprintSpeed:p.walkSpeed));
    // Eased gait: peds burst from their current pace instead of teleporting
    // to full sprint, so hit-frame strikes still connect mid-exchange.
    p.gait+=(target-p.gait)*(1-Math.exp(-8*dt));
    const speed=p.gait;
    // The plain wander's CTaskSimpleGoToPoint at a walk or faster, the only go-to ProcessStaticCounter counts here.
    const wanderWalk=target>=p.walkSpeed*.5&&!p.officer&&!p.follow&&!p.gunReact&&!p.evade&&!p.carReact&&!p.fight&&p.flee<=0&&p.retaliate<=0&&p.down===0&&p.stagger<=0;
   // CPed::UpdateHeading: the ped turns toward where it is going at its pedstats heading change rate (degrees per
   // frame) and its clips carry it along its facing.
   if(length>.01&&p.down===0&&(speed>.05||p.officer&&!!this.law?.level)){
    let delta=Math.atan2(dx,dz)-state.heading;while(delta>Math.PI)delta-=2*Math.PI;while(delta<-Math.PI)delta+=2*Math.PI;
    const turn=p.headingChange*Math.PI/180*50*dt;state.heading+=Math.max(-turn,Math.min(turn,delta));
   }
   state.speed=speed;
   const controls={x:0,y:speed>.05?-1:0,cameraYaw:state.heading,walk:speed<=p.walkSpeed,sprint:p.flee>0&&p.down===0,jump:false};
   // CEntity::bIsVisible and m_nAreaCode: a ped a script hid stays hidden, and one that belongs to an area is
   // drawn only while the camera is in it.
   p.view.root.visible=!p.hidden&&(p.areaCode===undefined||p.areaCode===(this.visibleArea?.()??p.areaCode));
   p.view.step(dt,controls,p.actor);
   const footstep=p.health>0&&p.down===0?p.view.footstep():undefined;if(footstep)this.onFootstep?.(p,{...state.position,y:state.position.y+1},footstep.move,footstep.foot);
   const center=p.down>0?.3:.9,position=p.body.translation();
   const along=length&&p.down===0?{x:Math.sin(state.heading),z:Math.cos(state.heading)}:{x:length?dx/length:0,z:length?dz/length:0};
   // A drowning or drowned ped floats where the buoyancy force balances gravity: the origin 0.727 under the surface
   // alive and 0.056 under it dead (1.8× buoyancy), at most 0.1 units a frame either way, instead of falling.
   const water=(p.drowning||p.drowned)&&this.waterLevel?this.waterLevel(position.x,-position.z):undefined;
   // CTaskSimpleInAir: an airborne ped falls with CPhysical::ApplyGravity and the ped air resistance; on the
   // ground the controller's own probe keeps him on slopes and stairs.
   if(p.air){p.air.vz-=NATIVE_JUMP_GRAVITY*dt;p.air.vz*=Math.pow(Math.max(0,1-Math.abs(p.air.vz)/50*NATIVE_PED_AIR_RESISTANCE),dt*50);p.air.minVz=Math.min(p.air.minVz,p.air.vz);p.air.seconds+=dt;}
   // `position` is the collider centre, 0.9 above the feet standing and 0.3 down; the target is the feet under the origin.
   const vertical=water!==undefined?Math.max(-5*dt,Math.min(5*dt,water-pedFloatDepth(!p.drowned)-PED_ORIGIN_HEIGHT+(p.down>0?.3:.9)-position.y)):p.air?p.air.vz*dt:-5*dt+(state.position.y+center-position.y);
   const held=(p.drowning&&p.health>0)||!!p.air||p.landing!==undefined;
   // A fallen ped's low collider ignores the cars: the controller would otherwise shove it out of a car parked
   // over it, through the road (the get-up waits for the car instead, CTaskSimpleGetUp).
   const {movement,grounded}=characterMovement(p.controller,p.collider,{x:(held?0:along.x*speed*dt)+p.impulse.x*dt,y:vertical,z:(held?0:along.z*speed*dt)+p.impulse.z*dt},p.down>0?notCarCollider:undefined);
   if(water===undefined&&p.health>0&&p.down===0){
    if(!p.air&&!grounded&&movement.y<-4.5*dt){
     // Off the ground with the 5 m/s pull fully spent: the ped is in the air (bIsInTheAir) from this frame's gravity.
     const vz=-NATIVE_JUMP_GRAVITY*dt;p.air={vz,minVz:vz,seconds:0};
    }else if(p.air&&grounded){
     // CTaskComplexInAirAndLand: FALL_fall lands as a collapse (or a knockdown past 0.4 units a frame), a glide as
     // FALL_land; the height costs the same damage as the player's landing.
     const minVz=p.air.minVz,fell=p.air.clip==='fall_fall';p.air=undefined;
     const damage=landingDamage(minVz);
     if(p.view.reactionName&&/^fall_/.test(p.view.reactionName))p.view.clearReaction();
     if(fell&&minVz<-0.4*50){this.hit(p,Math.sin(state.heading),Math.cos(state.heading),0,'ko_skid_back',1000);}
     else{const clip=fell?'fall_collapse':'fall_land';const duration=p.view.reactionDuration(clip)??(fell?1.5:0.6);if(p.view.hasReaction(clip))p.view.playReaction(clip,duration);p.landing=duration;}
     if(damage>0){this.damageCollider(p.collider.handle,damage,{x:Math.sin(state.heading),z:Math.cos(state.heading)},'bullet',{weapon:WEAPON.fall,noSource:true});
      // CTaskComplexDie::SayDeathSample for WEAPON_FALL (with blood on): AE_PED_CRUNCH on the ped.
      if(p.health<=0)this.onCrunch?.(p,{...state.position});}
    }else if(p.air){
     // FALL_glide until the fall passes 0.1 units a frame, then FALL_fall (CTaskSimpleInAir).
     const clip=p.air.vz<-0.1*50?'fall_fall':'fall_glide';
     if(p.air.clip!==clip&&p.view.hasReaction(clip)){p.air.clip=clip;p.view.playReaction(clip,1e6);}
    }
   }
   if(p.landing!==undefined){p.landing-=dt;if(p.landing<=0)p.landing=undefined;}
   if(speed&&Math.hypot(movement.x,movement.z)<speed*dt*.2)p.blocked+=dt;else p.blocked=0;
   // CPedIntelligence::ProcessStaticCounter: m_AnotherStaticCounter counts while a walker stays within a quarter unit.
   if(wanderWalk){const s=p.stuck;if(!s||(position.x-s.x)**2+(position.z-s.z)**2>=1/16)p.stuck={x:position.x,z:position.z,seconds:0};else s.seconds+=dt;}else p.stuck=undefined;
   p.body.setNextKinematicTranslation({x:position.x+movement.x,y:position.y+movement.y,z:position.z+movement.z});
   p.impulse.x*=Math.exp(-5*dt);p.impulse.z*=Math.exp(-5*dt);
  }
 }
 afterStep(){for(const p of this.people){const center=p.body.translation();p.actor.player.position={x:center.x,y:center.y-(p.down>0?.3:.9),z:center.z};}}
 /** CCollision::CheckCameraCollisionPeds (0x415320): a drawn ped whose bound centre is within 1 unit (2D) of the camera
  * and whose hit spheres reach the near clip (GetNearestDistanceOfPedSphereToCameraNearClip <= 0) is made invisible for
  * this frame, and restoreCameraHidden puts it back. The ped hit colmodel's 12 spheres are AUTHORED here as five of
  * radius 0.25 up the ped's axis. Browser space. */
 hideNearCamera(camera:{x:number;y:number;z:number},front:{x:number;y:number;z:number},near:number){
  const offset=camera.x*front.x+camera.y*front.y+camera.z*front.z;
  for(const p of this.people){
   if(!p.view.root.visible)continue;
   const q=p.actor.player.position;
   if((q.x-camera.x)**2+(q.z-camera.z)**2>=1)continue;
   let nearest=Infinity;
   for(const h of HIT_SPHERE_HEIGHTS)nearest=Math.min(nearest,q.x*front.x+(q.y+h)*front.y+q.z*front.z-offset-.25-near);
   if(nearest>0)continue;
   p.view.root.visible=false;this.cameraHidden.push(p);
  }
 }
 restoreCameraHidden(){for(const p of this.cameraHidden)if(this.people.includes(p))p.view.root.visible=true;this.cameraHidden.length=0;}
 private cameraHidden:Pedestrian[]=[];
 /** The player's group members (PassengerCrowd), without building a whole snapshot. */
 /** The player's followers the car entry seats by taking them off the street and making them again inside: street
  * recruits only, and not those told to stay in position. A script's ped keeps its handle, so it is not one of them. */
 followers(){const out:{id:number;position:{x:number;y:number;z:number};health:number;down:number}[]=[];for(const p of this.people)if(p.follow&&!p.mission&&!p.holdPosition)out.push({id:p.id,position:p.actor.player.position,health:p.health,down:p.down});return out;}
 /** The drawn peds, for CPed::PreRenderAfterTest's dummy shadows: their ids and BONE_ROOT in the world (browser space). */
 *shadowCasters(){for(const p of this.people)if(p.view.root.visible)yield {id:p.id,root:p.view.shadowPosition()};}
 render(alpha:number,ambient:readonly number[]|undefined,night:number,thermal=false){for(const p of this.people){p.view.setThermal(thermal);p.view.setAmbient(ambient);p.view.setNight(night);p.view.update(p.actor,alpha);}}
 /** CPopulation::RemoveAllRandomPeds, as an entry exit lands the player. */
 /** CWorld::ClearExcitingStuffFromArea's ped pass: every ped within the radius on the plane that
  * CPed::CanBeDeleted allows and that is not following the player goes. */
 /** CWorld::ClearPedsFromArea (CLEAR_AREA_OF_CHARS): the deletable peds inside the box (renderer corners) go. */
 clearPedsInBox(a:{x:number;y:number;z:number},b:{x:number;y:number;z:number}){
  const lo={x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),z:Math.min(a.z,b.z)},hi={x:Math.max(a.x,b.x),y:Math.max(a.y,b.y),z:Math.max(a.z,b.z)};
  let removed=0;
  this.people=this.people.filter(p=>{
   if(p.mission||p.follow||p.crew)return true;
   const q=p.actor.player.position,y=q.y+PED_ORIGIN_HEIGHT;
   if(q.x<lo.x||q.x>hi.x||y<lo.y||y>hi.y||q.z<lo.z||q.z>hi.z)return true;
   this.remove(p);removed++;return false;
  });
  return removed;
 }
 clearPedsInArea(point:{x:number;z:number},radius:number,crews=false){
  let removed=0;
  this.people=this.people.filter(p=>{
   // A police crew on foot is kept unless its car goes too (`crews`, CWorld::ClearExcitingStuffFromArea's sweep).
   if(p.mission||p.follow||p.crew&&!crews)return true;
   const q=p.actor.player.position;
   if(Math.hypot(q.x-point.x,q.z-point.z)>=radius)return true;
   this.remove(p);removed++;return false;
  });
  return removed;
 }
 /* Only peds CPed::CanBeDeleted allows: the player's crew, police crews, attack waves and the script's peds stay. */
 /** CEntryExit::WarpGangWithPlayer (0x43F1F0), when the entrance accepts the player's group (ENEX_FLAG_ACCEPT_NPC_GROUP):
  * each living follower is teleported to the formation offsets around the player's new point (while there are offsets
  * left and the point is valid), its reactions flushed (FlushImmediately), turned to face him and given his area. A
  * script's order on a mission recruit is left to the script. Returns how many came along. */
 warpGangWithPlayer(at:{x:number;y:number;z:number},area:number|undefined,valid:(point:{x:number;y:number;z:number})=>boolean){
  let slot=0,warped=0;
  for(const p of this.people){
   if(!p.follow||p.health<=0)continue;
   let point:{x:number;y:number;z:number}|undefined;
   while(slot<GROUP_TELEPORT_OFFSETS.length&&!point){const [ox,oy]=GROUP_TELEPORT_OFFSETS[slot++];const tried={x:at.x+ox,y:at.y,z:at.z-oy};if(valid(tried))point=tried;}
   if(!point)break;
   const state=p.actor.player;state.position={...point};state.previous={...point};state.speed=0;state.heading=Math.atan2(at.x-point.x,at.z-point.z);
   p.body.setTranslation({x:point.x,y:point.y+.9,z:point.z},true);p.body.setNextKinematicTranslation({x:point.x,y:point.y+.9,z:point.z});p.collider.setTranslation({x:point.x,y:point.y+.9,z:point.z});
   p.impulse={x:0,z:0};p.retaliate=0;p.foe=undefined;p.fight=undefined;p.flee=0;p.fleePlayer=undefined;p.gunReact=undefined;p.evade=undefined;p.carReact=undefined;p.event=undefined;p.air=undefined;p.holdPosition=undefined;
   p.areaCode=area;warped++;
  }
  return warped;
 }
 removeAllRandomPeds(){const kept=this.people.filter(p=>p.follow||p.crew||p.attackWave||p.mission);for(const p of this.people)if(!kept.includes(p))this.remove(p);this.people=kept;}
 dispose(){this.disposed=true;for(const p of this.people)this.remove(p);this.people=[];}
}
