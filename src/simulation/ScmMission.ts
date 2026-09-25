import {ScmRuntime} from '../engine/ScmRuntime';
import {ScmCameraFade} from '../engine/ScmCameraFade';
import {ScmEntityPending,UnsupportedScmCommand,type ScmScriptedTask,type ScmWorldCommands} from '../engine/ScmThread';
import {RANDOM_SAMPLE_MAX} from '../engine/nativeRandomRange';
import {findNavigationZone,pointInWorldZone,type WorldZones} from '../assets/worldZones';
import {ScmVehiclePool} from './ScmVehiclePool';
import {ScmPedPool,type ScmPedProofs} from './ScmPedPool';
import {NativePedGroup} from '../ped/nativePedGroup';
import {findNodeCoorsForScript,findNodeCoorsForScriptBetween,findNodeOrientationForCarPlacement,findNthNodeClosestToCoors} from './nativeScriptCarNodes';
import type {PathArea,PathNode} from '../assets/pathNodes';
import {MAX_DECISION_CHOICES,type DecisionChoice} from '../ped/nativeDecisionMaker';
import {PED_SIGHT_TARGET_RAISE,pedSightAngleAndRange} from '../ped/nativePedSight';
import {isMissionObjectType,type ScmObject} from '../engine/ScmObjects';
import {BLIP_CAR,BLIP_CHAR,BLIP_CONTACT_POINT,BLIP_DISPLAY_BLIPONLY,BLIP_DISPLAY_BOTH,BLIP_DISPLAY_MARKERONLY,BLIP_FLAG_THREAT,BLIP_FLAG_UNK,BLIP_NONE,BLIP_OBJECT,BLIP_PICKUP} from '../engine/ScmRadar';
import {MODE_FIXED} from '../engine/ScmCamera';
import {HUD_COLOURS,HUD_COLOUR_BLUE,HUD_COLOUR_RED,radarTraceColour,radarTraceRgb} from '../ui/nativeHudColours';
/* The axes of something that only turns about the up axis, which is every ped and every object a script
 * places: CVector2D::Heading is atan2(-x, y), so a heading of nothing faces north and its right hand is east. */
/** The twelve numbers an FxMatrix holds: the three axis rows, then the position. */
const fxMatrix=(frame:{right:{x:number;y:number;z:number};forward:{x:number;y:number;z:number};up:{x:number;y:number;z:number}},position:{x:number;y:number;z:number})=>
 [frame.right.x,frame.right.y,frame.right.z,frame.forward.x,frame.forward.y,frame.forward.z,
  frame.up.x,frame.up.y,frame.up.z,position.x,position.y,position.z];
/** The axes of something pointed along a direction, which is what the with-direction forms give. */
const directionFrame=(direction:{x:number;y:number;z:number})=>{
 const length=Math.hypot(direction.x,direction.y,direction.z);
 // CVector2D::Normalise leaves a zero-length vector pointing east, and the frame is built round that.
 const forward=length>0?{x:direction.x/length,y:direction.y/length,z:direction.z/length}:{x:1,y:0,z:0};
 const flat=Math.hypot(forward.x,forward.y);
 const right=flat>0?{x:forward.y/flat,y:-forward.x/flat,z:0}:{x:1,y:0,z:0};
 return {right,forward,up:{
  x:right.y*forward.z-right.z*forward.y,y:right.z*forward.x-right.x*forward.z,z:right.x*forward.y-right.y*forward.x}};
};
const headingFrame=(heading:number)=>({
 right:{x:Math.cos(heading),y:Math.sin(heading),z:0},
 forward:{x:-Math.sin(heading),y:Math.cos(heading),z:0},
 up:{x:0,y:0,z:1},
});
import {ScmDecisionMakers} from '../engine/ScmDecisionMakers';
import {scriptedPedOrder,type ScriptedPedOrder} from './nativeScriptedPedTasks';
import {PlayerScriptTasks} from './playerScriptTasks';
/** MI_NEVADA, whose radar cone floats higher above its box. */
const MODEL_NEVADA=553;

/** What the browser can answer for the script while it runs its opening. */
/** eScriptedTaskStatus and the scripts' FINISHED_TASK. */
const TASK_EVENT_ASSOCIATED=0,TASK_TASK_ASSOCIATED=1,FINISHED_TASK=7;
export interface ScmMissionWorld {
 /** CPhysical::physicalFlags.bSubmergedInWater of a vehicle: cBuoyancy found it in the water. */
 scriptVehicleInWater?(car:unknown):boolean;
 /** CCamera::IsSphereVisible for a native point. */
 isSphereVisible?(point:{x:number;y:number;z:number},radius:number):boolean;
 /** One of CDecisionMakerTypes' default decision makers, as the files load it (by its index). */
 defaultDecisionMaker?(index:number):import('../ped/nativeDecisionMaker').DecisionMaker|undefined;
 /** CAudioEngine::RetuneRadio for SET_RADIO_CHANNEL (an eRadioID). */
 retuneRadio?(station:number):void;
 /** CAEFrontendAudioEntity::AddAudioEvent, for the reports the script's own systems make (the timer count). */
 frontendAudioEvent?(event:number):void;
 /** TheCamera's fade (m_fFadeAlpha, m_bFading), one for the script and the game alike; the host processes it. Without
  * one the mission keeps and processes its own. */
 cameraFade?:ScmCameraFade;
 /** CTimeCycle::StartExtraColour and StopExtraColour, which SET_EXTRA_COLOURS and CLEAR_EXTRA_COLOURS call. */
 startExtraColour?(colour:number,fade:boolean):void;stopExtraColour?(fade:boolean):void;
 /** Draw a fade DO_FADE starts: direction 0 fades out to the fading colour, 1 back in. */
 showFade?(direction:number,milliseconds:number):void;
 /** Where CREATE_PLAYER would put the player. The browser has already placed them by the time the script
  * runs, from its own start, a restart point or a save, so the host records this rather than moving them. */
 playerCreatedAt(x:number,y:number,z:number):void;
 setPlayerHeading(degrees:number):void;
 /** CRunningScript::SetCharCoordinates for the player (script coordinates, already put to the ground if too low):
  * his vehicle is teleported with him in it, or he is. */
 teleportPlayer?(position:{x:number;y:number;z:number}):boolean;
 /** WARP_CHAR_INTO_CAR on the player (CTaskSimpleCarSetPedInAsDriver without the entry tasks), and
  * WARP_CHAR_FROM_CAR_TO_COORD (out of the vehicle and teleported). */
 /** The player's side of the ped commands a script also gives him: CPed::SetAmmo and GrantAmmo, the weapon hidden
  * for a cut, physicalFlags.bDontApplySpeed (FREEZE_CHAR_POSITION), the swimming and falling questions, the clip
  * playing, and m_nAreaCode. */
 setPlayerAmmo?(weaponType:number,ammo:number):void;
 addPlayerAmmo?(weaponType:number,ammo:number):void;
 hidePlayerWeapon?(hidden:boolean):void;
 /** The player's side of commands that name any ped:
  * - CLEAR_LOOK_AT ends the look the player was given;
  * - SET_CHAR_VISIBLE sets CEntity::m_bIsVisible (and gPlayerPedVisible);
  * - the relationship commands edit the player's own CAcquaintance;
  * - DAMAGE_CHAR takes health, armour first unless told not to. */
 clearPlayerLookAt?():void;
 setPlayerVisible?(visible:boolean):void;
 setPlayerRelationship?(relationship:number,pedType:number):void;
 clearPlayerRelationship?(relationship:number,pedType:number):void;
 clearPlayerRelationships?(relationship:number):void;
 damagePlayer?(amount:number,damageArmour:boolean):void;
 setPlayerFrozen?(frozen:boolean):void;
 playerInWater?():boolean;
 playerInAir?():boolean;
 playerIsPlayingAnim?(animation:string):boolean;
 setPlayerArea?(area:number):void;
 setPlayerProofs?(proofs:ScmPedProofs):void;
 /** TASK_USE_MOBILE_PHONE on the player ('player') or a script ped: the phone out or put away. */
 usePedMobilePhone?(ped:unknown,start:boolean):void;
 /** EXPLODE_CHAR_HEAD's CEventDamage: a sniper rifle's 1000 to the head, from nobody. */
 explodeScriptPedHead?(ped:unknown):void;
 /** CWorld::ClearCarsFromArea and ClearPedsFromArea over a box in the script's coordinates. */
 clearVehiclesInBox?(min:{x:number;y:number;z:number},max:{x:number;y:number;z:number}):void;
 clearPedsInBox?(min:{x:number;y:number;z:number},max:{x:number;y:number;z:number}):void;
 /** CTheScripts::CleanUpThisVehicle: the car is a random one again. */
 releaseScriptVehicle?(car:unknown):void;
 warpPlayerIntoCar?(car:unknown):boolean;
 warpPlayerFromCarToCoord?(position:{x:number;y:number;z:number}):boolean;
 /** (Each answers false for what it does not carry out: a player on a bike, boat or plane, or already in a car.) */
 /** CCamera::SetCameraDirectlyBehindForFollowPed_CamOnAString. */
 setCameraBehindPlayer():void;
 /** CStreaming::LoadScene and the collision request that goes before it. */
 loadScene(x:number,y:number,z:number):void;
 /** CGameLogic::SetLaRiotsActive. */
 setLaRiots(active:boolean):void;
 /** CWorld::PutToGroundIfTooLow for the objects the script creates: the ground under a native point, or
  * nothing where the world has none there. */
 groundLevel(x:number,y:number,z:number):number|undefined;
 /** The player's own ped, which is the only ped the browser holds while the opening runs: its position in
  * native axes, the vehicle it is in if any, whether it has stopped, and its health. */
 playerPed():{
  position:{x:number;y:number;z:number};
  /** The vehicle it is in, as eVehicleAppearance and whether that vehicle is a train. */
  vehicle:{appearance:number;train:boolean;model?:number;inAirProper?:()=>boolean}|undefined;
  stopped:boolean;health:number;dead:boolean;
  /** CPlaceable::GetHeading in degrees, as the script reads a ped's. */
  heading?:number;
  /** CEntity::GetAreaCode: the interior it is in, zero being the normal world. */
  areaCode:number;
  /** CPed::m_aWeapons as the types it carries, and the one it is holding. */
  weapons:{carried:readonly number[];active:{type:number;melee:boolean}};
  /** CPed::bFiringWeapon, CEntity::GetIsOnScreen, and whether it is sitting in the car it rides. */
  shooting:boolean;onScreen:boolean;sittingInCar:boolean;
 };
 /** What CPlayerPed::CanPlayerStartMission asks of the game and the player. */
 playerMissionGates():{
  statePlaying:boolean;coopGoingOn:boolean;inControl:boolean;driving:boolean;alive:boolean;
  physicalResponseTask:boolean;eventResponseTask:boolean;nonDrivePrimaryTask:boolean;attackTask:boolean;
  scriptCommandEvent:boolean;
 };
 /** The nearest world object of a model, whose visibility the script switches. */
 setVisibilityOfClosestObjectOfType(x:number,y:number,z:number,radius:number,model:number|string,visible:boolean):void;
 /** CClothes::RebuildPlayer: the browser builds its own player model, so what it does with this is its own.
  * The script calls it after dressing the player. */
 buildPlayerModel():void;
 /** CPlayerInfo::MakePlayerSafe with the state inverted, which is how the script takes control away. The
  * browser is a free-roam session the script only opens, so what a host does with this is its own. */
 setPlayerControl(control:boolean):void;
 /** TheText.LoadMissionText: the block of text a mission draws its messages from. */
 loadMissionText(name:string):void;
 /** The eLevelName of the map zone the player stands in. */
 playerCity():number;
 /** CModelInfo::GetModelInfo by name: the model index, or -1. */
 modelIndex?(name:string):number;
 /** CPed::GiveWeapon, SetCurrentWeapon and m_fArmour on the player. */
 givePlayerWeapon?(weaponType:number,ammo:number):void;
 setPlayerCurrentWeapon?(weaponType:number):void;
 setPlayerArmour?(armour:number):void;
 /** CPed::m_fArmour on the player. */
 playerArmour?():number;
 /** The cutscene data the script asks for. The browser plays none yet, so a host records the request and the
  * mission moves the state on itself, which keeps the script's own loop running rather than stalling it. */
 loadCutscene(name:string):void;
 /** CStreaming's script requests. The browser streams its own world by where the player is rather than by
  * name, so it records what the script asked for. */
 requestModel(model:number|string):void;
 /** The tags the browser's own tag manager holds: how many are sprayed, and what share of an area is. */
 tagsTagged():number;
 tagsPercentageInArea(x1:number,y1:number,x2:number,y2:number):number;
 /** SET_TAG_STATUS_IN_AREA and GET_NEAREST_TAG_POSITION through CTagManager. */
 setTagsInArea?(x1:number,y1:number,x2:number,y2:number,tagged:boolean):void;
 nearestTagPosition?(x:number,y:number,z:number):{x:number;y:number;z:number}|undefined;
 /** The share of the map the player's gang holds, which the browser's gang wars keep. */
 territoryUnderControlPercentage():number;
 /* The peds a script creates. As with the cars, the browser cannot build one inside the command, so the host
  * is asked and the pool holds the handle until the model is loaded. */
 spawnScriptPed(pedType:number,model:number|string,position:{x:number;y:number;z:number}):Promise<unknown>;
 /** CPopulation::AddPedInCar: the ped starts in a seat of a car the script already made, and rides there. */
 spawnScriptPedInCar(pedType:number,model:number|string,car:unknown,seat:number|'driver'):Promise<unknown>;
 /** The same with the occupation CPopulation::ChooseCivilianOccupationForVehicle would have picked for that car. */
 spawnScriptRandomPedInCar(car:unknown,seat:number|'driver'):Promise<unknown>;
 /** CPed::AttachPedToEntity: the ped rides on the car at an offset in the car's own axes. */
 spawnScriptPedOnCar(pedType:number,model:number|string,car:unknown,offset:{x:number;y:number;z:number}):Promise<unknown>;
 placeScriptPed(ped:unknown,position:{x:number;y:number;z:number}):void;
 setScriptPedHeading(ped:unknown,degrees:number):void;
 scriptPedPosition(ped:unknown):{x:number;y:number;z:number};
 scriptPedHeading(ped:unknown):number;
 scriptPedHealth(ped:unknown):number;
 setScriptPedHealth(ped:unknown,health:number):void;
 killScriptPed(ped:unknown):void;
 setScriptPedAccuracy(ped:unknown,accuracy:number):void;
 /** CPed::m_nWeaponShootingRate, which CTaskSimpleGunControl's bursts and pauses read. */
 setScriptPedShootingRate?(ped:unknown,rate:number):void;
 setScriptPedInvulnerable(ped:unknown,enabled:boolean):void;
 setScriptPedProofs(ped:unknown,proofs:ScmPedProofs):void;
 scriptPedAlive(ped:unknown):boolean;
 removeScriptPed(ped:unknown):void;
 releaseScriptPed(ped:unknown,keepTask?:boolean):void;
 scriptPedSpeed(ped:unknown):number;
 scriptPedStanding(ped:unknown):boolean;
 scriptPedSubmerged(ped:unknown):boolean;
 scriptPedOnScreen(ped:unknown):boolean;
 /** Whether the player holds aim with this script ped under the crosshair (m_p3rdPersonMouseTarget). */
 playerMouseTargets(ped:unknown):boolean;
 setScriptPedVisible(ped:unknown,visible:boolean):void;
 /** A task the script gave the ped, already turned into something the browser can carry out. */
 giveScriptPedOrder(ped:unknown,order:ScriptedPedOrder):void;
 /** A sequence of tasks, run in order, and started again from the first when it repeats. */
 giveScriptPedSequence(ped:unknown,orders:readonly ScriptedPedOrder[],repeat:boolean):void;
 /** Whether a script's ped is still carrying out the order or sequence it was given (CTaskManager still holds it). */
 scriptPedHasOrder?(ped:unknown):boolean;
 /** The index of the task a ped's script sequence is on, -1 without one (a single task is none). */
 scriptPedSequenceProgress?(ped:unknown):number;
 /** The same for the player's own sequence. */
 playerSequenceProgress?():number;
 clearScriptPedTasks(ped:unknown):void;
 /** The script's tasks on the player's own ped (PlayerScriptTasks), and whether one still runs. */
 givePlayerOrders?(orders:readonly ScriptedPedOrder[],repeat:boolean,sequence?:boolean):void;
 clearPlayerTasks?():void;
 playerHasScriptTask?():boolean;
 /** CWorld::ClearExcitingStuffFromArea round a point in the script's own coordinates. */
 clearArea(point:{x:number;y:number;z:number},radius:number):void;
 /** Whether nothing solid stands between two points in the script's own coordinates. */
 lineOfSightClear(from:{x:number;y:number;z:number},to:{x:number;y:number;z:number}):boolean;
 /** CStreaming's random vehicle model in memory, with the class it belongs to. */
 randomVehicleInMemory():{model:number;vehicleClass:number}|undefined;
 /** CEntryExitManager's nearest door to a point within a range, by its own pool index. */
 nearestEntryExit(x:number,y:number,radius:number):number|undefined;
 /** Whether the ped is still answering an event of that type. */
 scriptPedRespondingTo(ped:unknown,event:number):boolean;
 giveScriptPedWeapon(ped:unknown,weaponType:number,ammo:number):void;
 /** CPed::ClearWeapon and CPed::ClearWeapons: a script ped's, or (with no ped) the player's. */
 clearPedWeapon?(ped:unknown|undefined,weaponType:number):void;clearPedWeapons?(ped:unknown|undefined):void;
 scriptPedWeapon(ped:unknown):{type:number;ammo:number}|undefined;
 setScriptPedAmmo(ped:unknown,ammo:number):void;
 setScriptPedFrozen(ped:unknown,frozen:boolean):void;
 scriptPedInAir(ped:unknown):boolean;
 scriptPedArea(ped:unknown):number;
 scriptPedActiveWeapon(ped:unknown):{type:number;melee:boolean};
 scriptPedShooting(ped:unknown):boolean;
 warpScriptPedToCoord(ped:unknown,position:{x:number;y:number;z:number}):void;
 scriptPedIsPlayingAnim(ped:unknown,animation:string):boolean;
 setScriptPedArea(ped:unknown,area:number):void;
 setScriptPedSkill(ped:unknown,skill:number):void;
 setScriptPedUsedEntryExit(ped:unknown):void;
 setScriptVehicleAutopilot(car:unknown,field:'cruiseSpeed'|'drivingStyle'|'loadsCollision',value:number):void;
 setScriptPedRelationship(ped:unknown,relationship:number,pedType:number):void;
 clearScriptPedRelationship(ped:unknown,relationship:number,pedType:number):void;
 clearScriptPedRelationships(ped:unknown,relationship:number):void;
 setScriptPedFlag(ped:unknown,flag:'notAllowedToDuck'|'stayInCarOnJack'|'doesntDropWeaponsWhenDead'|'getOutUpsideDownCar'|'bleeding'|'drownsInWater'|'neverLeavesGroup'|'canBeShotInVehicle'|'cantBeDraggedOut'|'loadsCollision'|'kindaStayInSamePlace'|'deathPickupsPersist'|'targetPriority'|'stayOnBike',value:boolean):void;
 /** UPDATE_PICKUP_MONEY_PER_DAY reaching the drawn pickup. */
 setScriptPickupMoneyPerDay?(handle:number,moneyPerDay:number):void;
 setScriptPedCriticalHits(ped:unknown,suffers:boolean):void;
 scriptPedAnimProgress(ped:unknown,animation:string):number|undefined;
 setScriptPedSpeech(ped:unknown,shutUp:boolean):void;
 setScriptPedFacialTalk(ped:unknown,seconds:number|undefined):void;
 hideScriptPedWeapon(ped:unknown,hidden:boolean):void;
 /** CExplosion::AddExplosion at a point in the script's own coordinates. */
 addExplosion(position:{x:number;y:number;z:number},type:number):void;
 setScriptVehicleCanBurstTyres(car:unknown,canBurst:boolean):void;
 /** SET_CAR_HEAVY: physicalFlags.bMakeMassTwiceAsBig. */
 setScriptVehicleHeavy?(car:unknown,heavy:boolean):void;
 setScriptVehicleOnlyDamagedByPlayer(car:unknown,enabled:boolean):void;
 /** vehicleFlags.bVehicleCanBeTargettedByHS (VEHICLE_CAN_BE_TARGETTED_BY_HS_MISSILE). */
 setScriptVehicleHeatSeekTargetable(car:unknown,targetable:boolean):void;
 /** CProjectileInfo::IsProjectileInRange over a native box. */
 projectilesInBox(min:{x:number;y:number;z:number},max:{x:number;y:number;z:number},destroy:boolean):boolean;
 /** CHANGE_CAR_COLOUR: the two paint slots take the palette entries the script names. */
 recolourScriptVehicle(car:unknown,primary:number,secondary:number):void;
 /** CAEPedSpeechAudioEntity's global gate, which the browser has nothing to silence. */
 setAllPedSpeechDisabled(disabled:boolean):void;
 /** Whoever last hurt the ped, as the browser's own objects, for the caller to name. */
 scriptPedLastDamagedBy(ped:unknown):{player?:true;ped?:unknown;car?:unknown}|undefined;
 /** CUpsideDownCarCheck::IsCarUpsideDown for a car. */
 scriptVehicleUpsideDownForCheck?(car:unknown):boolean;
 /** A car's autopilot route: the node it set out from and the one it is on its way to. */
 scriptVehicleRouteNodes?(car:unknown):{starting:PathNode;current:PathNode}|undefined;
 /** CPed::m_nLastWeaponDamage (-1 for none) for a script ped and for the player, and their clearing; the ped's
  * m_pLastEntityDamage cleared. */
 scriptPedLastWeaponDamage?(ped:unknown):number;
 clearScriptPedLastWeaponDamage?(ped:unknown):void;
 clearScriptPedLastDamagedBy?(ped:unknown):void;
 playerLastWeaponDamage?():number;
 clearPlayerLastWeaponDamage?():void;
 /** CVehicle::m_nMaxPassengers, and CAutomobile::BurstTyre with its physical effect. */
 scriptVehicleMaximumPassengers?(car:unknown):number;
 burstScriptVehicleTyre?(car:unknown,wheel:number):void;
 /** CExplosion::TestForExplosionInArea over the active explosions (native box). */
 explosionInArea?(type:number,min:{x:number;y:number;z:number},max:{x:number;y:number;z:number}):boolean;
 /** CEntity::GetDistanceFromCentreOfMassToBaseOfModel for a car (-its bounding box's lowest z); ClearSpaceForMissionEntity
  * round it where it stands; and its script mission joined to the roads again after a teleport. */
 scriptVehicleBaseOffset?(car:unknown):number;
 clearSpaceForScriptVehicle?(car:unknown):void;
 rejoinScriptVehicleRoads?(car:unknown):void;
 /** C3dMarkers::User3dMarkerSet (an eHudColours colour) and User3dMarkerDelete. */
 createScriptUser3dMarker?(x:number,y:number,z:number,colour:number):number;
 removeScriptUser3dMarker?(index:number):void;
 /** Whether a ped swims (CTaskSimpleSwim): the player's own, and a script ped's. */
 playerSwimming?():boolean;
 scriptPedSwimming?(ped:unknown):boolean;
 /** CGangWars::GangWarFightingGoingOn. */
 gangWarFightingGoingOn?():boolean;
 /** CEntity::SetAreaCode for a car. */
 setScriptVehicleArea?(car:unknown,area:number):void;
 /** CGameLogic::SetUpSkip (a native point and heading in degrees), ClearSkip(false) and IsSkipWaitingForScriptToFadeIn. */
 setUpScriptSkip?(position:readonly [number,number,number],heading:number,afterMission:boolean,vehicle:unknown,finishedByScript:boolean):void;
 clearScriptSkip?():void;
 isScriptSkipWaitingForFadeIn?():boolean;
 /** The car path areas CPathFind has loaded, or nothing before any have. */
 carPathAreas?():ReadonlyMap<number,PathArea>|undefined;
 /** CVehicle::m_pLastDamageEntity and m_nLastWeaponDamageType, as the browser's own objects, and their clearing. */
 scriptVehicleLastDamagedBy?(car:unknown):{player?:true;ped?:unknown;car?:unknown}|undefined;
 scriptVehicleLastWeaponDamage?(car:unknown):number;
 clearScriptVehicleLastDamagedBy?(car:unknown):void;
 clearScriptVehicleLastWeaponDamage?(car:unknown):void;
 /** CHud: whether a message the script put up is still on screen, and whether a help message is. */
 messageShowing():boolean;
 /** Where the camera is, what it looks along, and its field of view, in the script's own coordinates. */
 cameraSource():{x:number;y:number;z:number};
 cameraFront():{x:number;y:number;z:number};
 cameraFov():number;
 setCameraInFrontOfPlayer():void;
 helpMessageShowing():boolean;
 /** Whether the help box is up with the text a GXT key names. */
 helpMessageShowingKey?(key:string):boolean;
 /** The civilian model the zone roster would have used, for the random ped the game picks itself. */
 randomCivilianModel():number|string|undefined;
 setScriptPedRange(ped:unknown,range:'informFriends'|'followNodeThreshold'|'sense',value:number):void;
 /* Fx_c's systems. The matrix is the twelve numbers FxMatrix holds — three rows of axes and a position — in
  * the script's own coordinates; nothing comes back when the archive has no system of that name. */
 /* `hanging` says the matrix is the parent FxSystem_c::SetMatrix will replace, rather than the placement the
  * system keeps for itself; a system that follows something needs the first, and one standing at a point the
  * second, because the two are multiplied together. */
 createScriptFx(name:string,matrix:readonly number[],ignoreBoundingChecks:boolean,hanging:boolean):unknown|undefined;
 setScriptFxMatrix(system:unknown,matrix:readonly number[]):void;
 playScriptFx(system:unknown,andKill:boolean):void;
 stopScriptFx(system:unknown):void;
 killScriptFx(system:unknown):void;
 /** Whether a point in the script's own coordinates is on screen, and whether it is under the water. */
 pointOnScreen(position:{x:number;y:number;z:number},radius:number):boolean;
 pointUnderWater(position:{x:number;y:number;z:number}):boolean;
 /** What CCamera::Restore asks of the player. */
 playerCameraState():{inVehicle:boolean;enteringCar:boolean;exitingCar:boolean};
 setScriptPedDecisionMaker(ped:unknown,decisionMaker:number):void;
 setScriptPedNeverTargeted(ped:unknown,enabled:boolean):void;
 clearScriptPedLookAt(ped:unknown):void;
 /** SET_CHAR_MONEY: m_nMoneyCount as an int16, and bMoneyHasBeenGivenByScript. */
 setScriptPedMoney?(ped:unknown,money:number):void;
 /** HAS_CHAR_BEEN_PHOTOGRAPHED: the ped's bHasBeenPhotographed, cleared as it is read. */
 takeScriptPedPhotographed?(ped:unknown):boolean;
 scriptVehicleMatrix(car:unknown):{right:{x:number;y:number;z:number};forward:{x:number;y:number;z:number};up:{x:number;y:number;z:number};position:{x:number;y:number;z:number}};
 setScriptVehicleFrozen(car:unknown,frozen:boolean):void;
 /** SET_UPSIDEDOWN_CAR_NOT_DAMAGED: autoFlags.bDoesNotGetDamagedUpsideDown. */
 setScriptVehicleUpsideDownNotDamaged?(car:unknown,state:boolean):void;
 setScriptVehicleForwardSpeed(car:unknown,forwardSpeed:number):void;
 damageScriptPed(ped:unknown,amount:number):void;
 /* The cars a script creates. The browser builds one only once its model is streamed, so the host is asked to
  * spawn and the pool holds the handle in the meantime; everything the script says before the car arrives is
  * applied when it does. */
 /** The car the player drives, as the scriptVehicle* methods take it, when it is a car the browser can answer for. */
 playerVehicleEntity?():unknown|undefined;
 /** Where the player's vehicle of any kind is and how it lies: native position, axes and CPlaceable::GetHeading in degrees. */
 playerVehiclePose?():{position:{x:number;y:number;z:number};right:{x:number;y:number;z:number};forward:{x:number;y:number;z:number};up:{x:number;y:number;z:number};heading:number}|undefined;
 spawnScriptVehicle(model:number|string,position:{x:number;y:number;z:number},heading:number):Promise<unknown>;
 placeScriptVehicle(car:unknown,position:{x:number;y:number;z:number},heading:number):void;
 scriptVehiclePosition(car:unknown):{x:number;y:number;z:number};
 /** The top of a script car's collision box above its origin (GetColModel()->GetBoundingBox().m_vecMax.z). */
 scriptVehicleBoxTop?(car:unknown):number;
 scriptVehicleHeading(car:unknown):number;
 scriptVehicleAlive(car:unknown):boolean;
 removeScriptVehicle(car:unknown):void;
 scriptVehicleHealth(car:unknown):number;
 setScriptVehicleHealth(car:unknown,health:number):void;
 scriptVehicleSpeed(car:unknown):number;
 scriptVehicleStopped(car:unknown):boolean;
 scriptVehicleOnFire(car:unknown):boolean;
 scriptVehicleOnScreen(car:unknown):boolean;
 explodeScriptVehicle(car:unknown):void;
 fixScriptVehicle(car:unknown):void;
 setScriptVehicleVisible(car:unknown,visible:boolean):void;
 setScriptVehicleProofs(car:unknown,proofs:ScmPedProofs):void;
 setScriptVehicleCanBeDamaged(car:unknown,canBeDamaged:boolean):void;
 setScriptVehicleDoorLock(car:unknown,locked:boolean):void;
 /** vehicleFlags.bSirenOrAlarm and autoFlags.bCanBeVisiblyDamaged. */
 setScriptVehicleSiren?(car:unknown,on:boolean):void;
 setScriptVehicleCanBeVisiblyDamaged?(car:unknown,state:boolean):void;
 /** CTimer::ms_fTimeScale, which the game's cheats and the script share. */
 setTimeScale?(scale:number):void;
 /** CEntity::SetUsesCollision on a script ped and on the player. */
 setScriptPedCollision?(ped:unknown,uses:boolean):void;
 /** handlingFlags.bHydraulicInst on a car: whether it is fitted, and AddVehicleUpgrade or RemoveVehicleUpgrade of
  * MI_HYDRAULICS. */
 scriptVehicleHasHydraulics?(car:unknown):boolean;
 setScriptVehicleHydraulics?(car:unknown,fitted:boolean):void;
 /** CVehicle::m_nHandlingFlags as the car's handling line gives them. */
 scriptVehicleHandlingFlags?(car:unknown):number;
 /** CVehicle::m_fDirtLevel. */
 setScriptVehicleDirtLevel?(car:unknown,level:number):void;
 /** CPlayerPed's jetpack task: whether the player wears one and flies it. */
 playerUsingJetpack?():boolean;
 /** CGameLogic's penalty switches: whether money and weapons go with the next death or arrest. */
 setDeathPenalties?(apply:boolean):void;
 setArrestPenalties?(apply:boolean):void;
 /** CAutomobile::OpenDoor with the eDoors index the script names and an open ratio. */
 openScriptVehicleDoor?(car:unknown,door:number,ratio:number):void;
 /** GetPositionToOpenCarDoor for a seat of a script car, in the script's coordinates, on the ground. */
 scriptVehicleSeatDoor?(car:unknown,seat:'driver'|number):{x:number;y:number;z:number}|undefined;
 /** CVehicle::CanPedStepOutCar(false): the car is still enough to step out of. */
 scriptVehicleStill?(car:unknown):boolean;
 /** CCarAI's coordinate missions on a script car (ScriptCarMissions), in the script's coordinates, and
  * m_nStraightLineDistance. */
 driveScriptVehicleTo?(car:unknown,goal:{x:number;y:number;z:number},o:{cruise:number;style:number;accurate:boolean;straight:boolean}):void;
 setScriptVehicleStraightLineDistance?(car:unknown,distance:number):void;
 /** The car's CCarAI mission cleared (MISSION_NONE): its driver's task was cleared, or the driver got out. */
 stopScriptVehicle?(car:unknown):void;
 /** CAutoPilot's temporary action for its time, and MISSION_CRUISE, on a script car. */
 scriptVehicleTempAction?(car:unknown,action:number,seconds:number):void;
 scriptVehicleWander?(car:unknown,o:{cruise:number;style:number}):void;
 /** CTaskComplexCarDriveMission's autopilot mission (eCarMission) against a target car, or the player with none;
  * false for a mission the browser does not drive. */
 scriptVehicleCarMission?(car:unknown,o:{mission:number;target?:unknown;cruise:number;style:number}):boolean;
 setPlayerCollision?(uses:boolean):void;
 /** CWorld::StopAllLawEnforcersInTheirTracks. */
 stopAllLawEnforcers():void;
 /** CPlayerInfo::MakePlayerSafe with its radius, and the maxima the script raises. */
 makePlayerSafe(safe:boolean,radius:number):void;
 /** CWorld::SetAllCarsCanBeDamaged: vehicleFlags.bCanBeDamaged on every vehicle there is. */
 setAllVehiclesCanBeDamaged?(state:boolean):void;
 /** CHeli::SwitchPoliceHelis, CRoadBlocks::RegisterScriptRoadBlock (native corners, gang or police) and
  * ClearScriptRoadBlocks. */
 switchPoliceHelis?(state:boolean):void;
 /** The player group's limits: SET_SCRIPT_LIMIT_TO_GANG_SIZE and SET_GROUP_SEPARATION_RANGE. */
 setScriptLimitToGangSize?(size:number):void;
 /** CGangWars::SetGangWarsActive. */
 setGangWarsActive?(state:boolean):void;setPlayerGroupSeparationRange?(range:number):void;
 /** CCutsceneMgr::IsCutsceneSkipButtonBeingPressed this frame. */
 cutsceneSkipPressed?():boolean;
 /** A script car's own autopilot settings (SET_CAR_CRUISE_SPEED, SET_CAR_DRIVING_STYLE). */
 scriptVehicleAutopilotFields?(car:unknown):{cruiseSpeed?:number;drivingStyle?:number};
 /** vehicleFlags.bTakeLessDamage and the number of wheels on the ground. */
 setScriptVehicleStrong?(car:unknown,strong:boolean):void;
 scriptVehicleWheelsOnGround?(car:unknown):number;
 /** Room in the player's group for `room` mission peds, beside the `missionMembers` the script's group already holds. */
 makeRoomInPlayerGang?(room:number,missionMembers:number):void;
 /** SET_ANIM_GROUP_FOR_CHAR on a ped the browser built; false for a group it cannot play. */
 setScriptPedAnimGroup?(ped:unknown,group:string):boolean;
 /** CWaterLevel::SyncWater: restart the visual wave cycle now. */
 syncWater?():void;
 registerScriptRoadblock?(a:{x:number;y:number;z:number},b:{x:number;y:number;z:number},gang:boolean):void;
 clearScriptRoadblocks?():void;
 setPlayerMaxHealth(maxHealth:number):void;
 setPlayerMaxArmour(maxArmour:number):void;
 /** CEntryExitManager: the flag the script sets on the entry-exit nearest a point, and the named switch. */
 setClosestEntryExitFlag(x:number,y:number,radius:number,flag:number,on:boolean):void;
 switchEntryExit(name:string,on:boolean):void;
 /** CEntryExitManager::EnableBurglaryHouses and ms_bDisabled (DISABLE_ALL_ENTRY_EXITS). */
 enableBurglaryHouses(on:boolean):void;disableAllEntryExits(disabled:boolean):void;
}
/** CTheScripts' player slot: the script always addresses player zero, whose ped it creates first. */
export const PLAYER_PED_HANDLE=1,PLAYER_GROUP_HANDLE=0;
/** The browser holds one vehicle for the player at a time, so the script's questions about the car it is in are
 * answered by a single handle rather than a pool the browser does not have. */
export const PLAYER_VEHICLE_HANDLE=1;
/** Where the script's own peds and cars are numbered from, above the player's handle and his car's. */
export const SCRIPT_PED_FIRST_HANDLE=1024,SCRIPT_VEHICLE_FIRST_HANDLE=1024;
/** eVehicleAppearance::VEHICLE_APPEARANCE_AUTOMOBILE. */
const VEHICLE_APPEARANCE_AUTOMOBILE=1;
/** ePedType::PED_TYPE_CIVMALE, which is what the random civilian forms create. */
const PED_TYPE_CIVMALE=4;
/* The original MAIN.SCM running inside the browser. CTheScripts::Process is driven a frame at a time; a
 * command the runtime has not ported stops the script exactly where the original would have carried on, and
 * the reason is kept so the gap is visible rather than silent. Everything the script sets before that point,
 * the clock, the stats, the zone population, the restart points and the rest, is real script state rather
 * than a static reading of the file. */
/** CCarCtrl::CreateCarForScript's cruise speed. */
const CREATED_CRUISE_SPEED=13;
/** handlingFlags.bLowRider. */
const HANDLING_LOW_RIDER=0x2000000;
/** The tasks that drive or leave a car, which the on-foot peds cannot run. */
const CAR_TASKS:ReadonlySet<ScmScriptedTask['kind']>=new Set(['carDriveToCoord','carTempAction','carDriveWander','carMission','leaveCar','leaveAnyCar','leaveCarImmediately']);
/** Orders that only set something and are over at once, with nothing for them to act on while the ped sits in a car. */
const IN_SEAT_OVER_AT_ONCE:ReadonlySet<ScriptedPedOrder['kind']>=new Set(['lookAt','lookAtPoint','threatScanner','decisionMaker','kindaStayInSamePlace']);
/** Where a runner's task stands: held by the ped, waited out in the seat, waiting for the ped to be rebuilt (then the
 * task to begin), or getting in at the wheel before the drive. */
type RunnerStep=
 |{kind:'held'}
 |{kind:'wait';remaining:number}
 |{kind:'settle';then?:ScmScriptedTask}
 |{kind:'board';vehicle:number;then:ScmScriptedTask}
 |{kind:'slowing';then:ScmScriptedTask};
/** CGeneral::GetATanOfXY: the angle of (x, y) from the x axis, in [0, 2π). */
export function getATanOfXY(x:number,y:number){if(x===0&&y===0)return 0;const a=Math.atan2(y,x);return a<0?a+2*Math.PI:a;}
/** IS_POINT_OBSCURED_BY_A_MISSION_ENTITY's box, the point less and plus each radius with the ends swapped into order,
 * and CBoundingBox::IsPointWithin's test of an entity's position against it, edges included. */
export function insideMissionCube(x:number,y:number,z:number,rx:number,ry:number,rz:number,p:{x:number;y:number;z:number}){
 return Math.abs(p.x-x)<=Math.abs(rx)&&Math.abs(p.y-y)<=Math.abs(ry)&&Math.abs(p.z-z)<=Math.abs(rz);
}
export class ScmMission {
 /** The script's own fade, which it keeps until the INTRO has run: MAIN fades out with DO_FADE 0 0 before launching
  * it and only the intro's end fades back in, which here never comes (docs/FIDELITY_AUDIT.md "The intro that cannot
  * finish"). Afterwards the script shares TheCamera's fade with the game. */
 private readonly ownFade=new ScmCameraFade();
 private introSeen=false;private introDone=false;
 get fade(){return this.introDone&&this.world.cameraFade?this.world.cameraFade:this.ownFade;}
 readonly runtime:ScmRuntime;
 /** Where the script stopped outright, or nothing while any of it is still running. */
 stopped?:{command:string;offset:number;detail:string};
 /** Threads that gave up on a command this runtime has not ported, in the order they did. */
 readonly gaveUp:{thread:string;command:string;offset:number;detail?:string}[]=[];
 /** Commands the world was asked for, for a host that wants to follow along. */
 readonly relationships:{relationship:number;pedType:number;otherPedType:number}[]=[];
 laRiots=false;
 /** Entry-exit flags and switches the script has asked for. */
 entryExitFlags=0;
 /** World objects whose visibility the script switched. */
 objectVisibilities=0;
 /** How many times the script asked for the player's model to be rebuilt. */
 playerModelsBuilt=0;
 /** Whether the script has left the player in control of themselves. */
 playerControl=true;
 /** The player's CPed::bDontDragMeOutCar (SET_CHAR_CANT_BE_DRAGGED_OUT). */
 playerCantBeDraggedOut=false;
 /** For a ped running a sequence with nested ones, each flattened task's step and nested step. */
 private readonly sequenceSteps=new Map<number,{outer:number;inner:number}[]>();
 /** The mission text block the script last asked for. */
 missionText?:string;
 /** The cutscenes the script asked for, in order. */
 readonly cutscenes:string[]=[];
 /** The models the script asked the streamer for. */
 readonly requestedModels=new Set<string>();
 /** How many times the script asked for an area to be cleared. */
 areasCleared=0;
 /** Where the script created the player, in native axes. */
 playerStart?:{x:number;y:number;z:number};
/** The PC CRT stream the script draws from, seeded like a fresh run. */
 private seed=1;
 private readonly random={next:()=>{this.seed=(Math.imul(this.seed,214013)+2531011)>>>0;return (this.seed>>>16)&RANDOM_SAMPLE_MAX;}};
 private started=false;
 private elapsed=0;
 constructor(script:Uint8Array,private readonly zones:WorldZones,private readonly world:ScmMissionWorld){
  const adapter:ScmWorldCommands={
   fade:(milliseconds,direction,nowMs)=>{const shared=this.fade!==this.ownFade;this.fade.fade(milliseconds,direction,nowMs);if(shared)this.world.showFade?.(direction,milliseconds);},
   isFading:()=>this.fade.fading,
   setExtraColours:(colour,fade)=>{this.world.startExtraColour?.(colour,fade);},
   clearExtraColours:fade=>{this.world.stopExtraColour?.(fade);},
   requestCollision:()=>{},
   loadScene:(x,y,z)=>{this.world.loadScene(x,y,z);},
   createPlayer:(_playerId,x,y,z)=>{this.playerStart={x,y,z};this.world.playerCreatedAt(x,y,z);},
   getPlayerChar:()=>PLAYER_PED_HANDLE,
   getPlayerGroup:()=>PLAYER_GROUP_HANDLE,
   // SET_ANIM_GROUP_FOR_CHAR on a ped the script made; the player's own motion group follows his fat and muscle.
   setPedAnimGroup:(handle,group)=>{
    if(handle===PLAYER_PED_HANDLE)throw new UnsupportedScmCommand(-1,0,'SET_ANIM_GROUP_FOR_CHAR','the player');
    this.peds.setAnimGroup(handle,group.toLowerCase());
   },
   // CAR_GOTO_COORDINATES (VC's handler; SA's is unreversed): the car's own cruise speed, at least 6, and driving style
   // take it to the point, joining the road or going straight as JoinCarWithRoadSystemGotoCoors decides.
   vehicleGotoCoordinates:(handle,x,y,z)=>{
    const car=this.liveVehicle(handle),fields=this.world.scriptVehicleAutopilotFields?.(car)??{};
    this.host('driveScriptVehicleTo','CAR_GOTO_COORDINATES')(car,{x,y,z},{cruise:Math.max(fields.cruiseSpeed??CREATED_CRUISE_SPEED,6),style:fields.drivingStyle??0,accurate:false,straight:false});
   },
   // CAR_SET_IDLE: MISSION_NONE.
   setVehicleIdle:handle=>{this.host('stopScriptVehicle','CAR_SET_IDLE')(this.liveVehicle(handle));},
   // CLOSE_ALL_CAR_DOORS: every door to shut.
   closeAllVehicleDoors:handle=>{const car=this.liveVehicle(handle),open=this.host('openScriptVehicleDoor','CLOSE_ALL_CAR_DOORS');for(let door=0;door<6;door++)open(car,door,0);},
   setVehicleStrong:(handle,strong)=>{this.host('setScriptVehicleStrong','SET_CAR_STRONG')(this.liveVehicle(handle),strong);},
   // IS_VEHICLE_ON_ALL_WHEELS: m_nNumContactWheels is four.
   vehicleIsOnAllWheels:handle=>this.host('scriptVehicleWheelsOnGround','IS_VEHICLE_ON_ALL_WHEELS')(this.liveVehicle(handle))>=4,
   isCutsceneSkipButtonBeingPressed:()=>this.world.cutsceneSkipPressed?.()??false,
   setPedKeepTask:(handle,keep)=>{if(handle!==PLAYER_PED_HANDLE)this.peds.setKeepTask(handle,keep);},
   makeRoomInPlayerGangForMissionPeds:count=>{this.host('makeRoomInPlayerGang','MAKE_ROOM_IN_PLAYER_GANG_FOR_MISSION_PEDS')(count,this.group(PLAYER_GROUP_HANDLE).countFollowers());},
   setCameraBehindPlayer:()=>{this.world.setCameraBehindPlayer();},
   // SetCharHeading (CharacterCommands.cpp): a ped in a vehicle keeps the heading it has, and one on foot
   // takes the angle for both its aiming and its current rotation.
   setCharHeading:(ped,degrees)=>{
    if(ped===PLAYER_PED_HANDLE){
     if(!this.world.playerPed().vehicle)this.world.setPlayerHeading(degrees);
     return;
    }
    if(this.peds.rideOf(ped)===undefined)this.peds.setHeading(ped,degrees);
   },
   setRelationship:(relationship,pedType,otherPedType)=>{this.relationships.push({relationship,pedType,otherPedType});},
   setLaRiots:active=>{this.laRiots=active;this.world.setLaRiots(active);},
   groundLevel:(x,y,z)=>this.world.groundLevel(x,y,z),
   // CEntity::GetDistanceFromCentreOfMassToBaseOfModel needs the model's own bounds, which the browser only
   // has once the streamer has read it; until then the object sits with its origin on the ground.
   modelBaseOffset:()=>0,
   // The peds a script asks after: the player's handle is answered from the running game, and every other one
   // from the pool the script made it with. A question that needs a ped the browser has not built yet gives
   // that thread up rather than being made up.
   pedExists:handle=>handle===PLAYER_PED_HANDLE||this.peds.exists(handle),
   // GetCharCoordinates gives the vehicle's position while the ped rides in one.
   pedPosition:handle=>handle===PLAYER_PED_HANDLE?this.world.playerPed().position:this.ridingIn(handle)??this.peds.positionOf(handle),
   pedVehicle:handle=>handle===PLAYER_PED_HANDLE?this.playerCarHandle():this.peds.rideOf(handle)?.vehicle,
   // CEntity::m_nAreaCode. A ped a script made belongs to the area it was told to, which is the ordinary
   // world until SET_CHAR_AREA_VISIBLE says otherwise.
   pedAreaCode:handle=>handle===PLAYER_PED_HANDLE?this.world.playerPed().areaCode:this.world.scriptPedArea(this.livePed(handle)),
   pedHasWeapon:(handle,type)=>handle===PLAYER_PED_HANDLE?this.world.playerPed().weapons.carried.includes(type):this.world.scriptPedWeapon(this.livePed(handle))?.type===type,
   // The one weapon a browser ped carries is its active one; whether it is melee is the catalog's answer.
   pedActiveWeapon:handle=>handle===PLAYER_PED_HANDLE?this.world.playerPed().weapons.active:this.world.scriptPedActiveWeapon(this.livePed(handle)),
   pedIsShooting:handle=>handle===PLAYER_PED_HANDLE?this.world.playerPed().shooting:this.world.scriptPedShooting(this.livePed(handle)),
   playerIsTargettingPed:(_player,handle)=>handle!==PLAYER_PED_HANDLE&&this.world.playerMouseTargets(this.livePed(handle)),
   pedIsOnScreen:handle=>handle===PLAYER_PED_HANDLE?this.world.playerPed().onScreen:this.world.scriptPedOnScreen(this.livePed(handle)),
   pedIsPlayer:handle=>handle===PLAYER_PED_HANDLE,
   // CPed::GiveWeapon and the ammo commands. A browser ped carries the one weapon a script gave it, so the
   // slot search CWeapon does is a single comparison, and choosing a weapon it already holds changes nothing.
   givePedWeapon:(handle,weaponType,ammo)=>{
    if(handle!==PLAYER_PED_HANDLE){this.world.giveScriptPedWeapon(this.livePed(handle),weaponType,ammo);return;}
    if(!this.world.givePlayerWeapon)throw new UnsupportedScmCommand(-1,0,'GIVE_WEAPON_TO_CHAR','the player');
    this.world.givePlayerWeapon(weaponType,ammo);
   },
   // REMOVE_WEAPON_FROM_CHAR and REMOVE_ALL_CHAR_WEAPONS: CPed::ClearWeapon and CPed::ClearWeapons.
   removeWeaponFromPed:(handle,weaponType)=>{
    if(!this.world.clearPedWeapon)throw new UnsupportedScmCommand(-1,0,'REMOVE_WEAPON_FROM_CHAR','no host');
    this.world.clearPedWeapon(handle===PLAYER_PED_HANDLE?undefined:this.livePed(handle),weaponType);
   },
   removeAllPedWeapons:handle=>{
    if(!this.world.clearPedWeapons)throw new UnsupportedScmCommand(-1,0,'REMOVE_ALL_CHAR_WEAPONS','no host');
    this.world.clearPedWeapons(handle===PLAYER_PED_HANDLE?undefined:this.livePed(handle));
   },
   setPedCurrentWeapon:(handle,weaponType)=>{if(handle===PLAYER_PED_HANDLE)this.world.setPlayerCurrentWeapon?.(weaponType);},
   setPedAmmo:(handle,weaponType,ammo)=>{
    if(handle===PLAYER_PED_HANDLE){this.host('setPlayerAmmo','SET_CHAR_AMMO')(weaponType,ammo);return;}
    const held=this.world.scriptPedWeapon(this.livePed(handle));
    if(held?.type===weaponType)this.world.setScriptPedAmmo(this.livePed(handle),ammo);
   },
   addAmmoToPed:(handle,weaponType,ammo)=>{
    if(handle===PLAYER_PED_HANDLE){this.host('addPlayerAmmo','ADD_AMMO_TO_CHAR')(weaponType,ammo);return;}
    const held=this.world.scriptPedWeapon(this.livePed(handle));
    if(held?.type===weaponType)this.world.setScriptPedAmmo(this.livePed(handle),held.ammo+ammo);
   },
   pedWeaponAmmo:(handle,weaponType)=>{
    const held=this.world.scriptPedWeapon(this.livePed(handle));
    return held?.type===weaponType?held.ammo:0;
   },
   // CPedIntelligence::ClearTasks, and its immediate form, which the browser cannot tell apart: a ped with no
   // order left goes back to wandering either way, having nothing to finish first.
   clearPedTasks:handle=>{this.clearTasks(handle,'CLEAR_CHAR_TASKS');},
   clearPedTasksImmediately:handle=>{this.clearTasks(handle,'CLEAR_CHAR_TASKS_IMMEDIATELY');},
   // CPedScriptedTaskRecord::GetStatus(ped, opcode): the record's status, or −1 without one, which the command
   // reports as 7 (FINISHED_TASK), the value the missions compare against.
   scriptTaskStatus:(handle,opcode)=>{const record=this.taskRecords.get(handle);return record&&(opcode===-1||record.opcode===opcode)?record.status:FINISHED_TASK;},
   freezePedPosition:(handle,frozen)=>{if(handle===PLAYER_PED_HANDLE)this.host('setPlayerFrozen','FREEZE_CHAR_POSITION')(frozen);else this.world.setScriptPedFrozen(this.livePed(handle),frozen);},
   pedIsInAir:handle=>handle===PLAYER_PED_HANDLE?this.host('playerInAir','IS_CHAR_IN_AIR')():this.world.scriptPedInAir(this.livePed(handle)),
   // m_bIsStaticWaitingForCollision: a ped the browser built stands on ground it has already loaded, so it is
   // never waiting for collision to arrive.
   // m_bIsStaticWaitingForCollision: the browser streams collision round the player, so the player never waits.
   pedIsWaitingForCollision:handle=>{if(handle!==PLAYER_PED_HANDLE)this.livePed(handle);return false;},
   damagePed:(handle,amount,damageArmour)=>{if(handle===PLAYER_PED_HANDLE)this.host('damagePlayer','DAMAGE_CHAR')(amount,damageArmour);else this.world.damageScriptPed(this.livePed(handle),amount);},
   // CPedIntelligence::SetPedDecisionMakerType, and the fields the rest of this batch names.
   // SetCharDecisionMaker (reversed): the ped wears the slot CTheScripts::GetActualScriptThingIndex gives, -1 for none.
   setPedDecisionMaker:(handle,decisionMaker)=>{this.world.setScriptPedDecisionMaker(this.livePed(handle),this.runtime.game.decisionMakers.actualIndex(decisionMaker));},
   seedDecisionMaker:(handle,source)=>{
    const rows=this.decisionsFor(handle);rows.clear();
    const from=source<0?undefined:this.world.defaultDecisionMaker?.(source);
    if(from)for(const [event,choices] of from)rows.set(event,choices.map(choice=>({...choice})));
   },
   setPedMaxHealth:(handle,health)=>{this.peds.setMaxHealth(handle,health);},
   playerCameraState:()=>this.world.playerCameraState(),
   // CPed::SetAreaCode: the ped belongs to that area and is drawn only there.
   setPedAreaVisible:(handle,area)=>{if(handle===PLAYER_PED_HANDLE)this.host('setPlayerArea','SET_CHAR_AREA_VISIBLE')(area);else this.world.setScriptPedArea(this.livePed(handle),area);},
   pedIsPlayingAnim:(handle,animation)=>handle===PLAYER_PED_HANDLE?this.host('playerIsPlayingAnim','IS_CHAR_PLAYING_ANIM')(animation):this.world.scriptPedIsPlayingAnim(this.livePed(handle),animation),
   // WARP_CHAR_FROM_CAR_TO_COORD drops the point to the ground first, as the teleport does.
   warpPedFromCarToCoord:(handle,x,y,z)=>{
    const ground=this.world.groundLevel(x,y,z);
    if(handle===PLAYER_PED_HANDLE){if(!this.host('warpPlayerFromCarToCoord','WARP_CHAR_FROM_CAR_TO_COORD')({x,y,z:ground??z}))throw new UnsupportedScmCommand(-1,0,'WARP_CHAR_FROM_CAR_TO_COORD','a player on a bike, boat or plane');return;}
    this.world.warpScriptPedToCoord(this.livePed(handle),{x,y,z:ground??z});
    this.peds.setPosition(handle,{x,y,z:ground??z});
   },
   // CTheScripts' elegant removal: a mission ped on foot is handed back to the game rather than taken out of
   // the world. A browser ped a script made is never in a vehicle, so that is the whole of it.
   removePedElegantly:handle=>{this.peds.markNoLongerNeeded(handle);},
   // CTheZones::FindZoneByLabel for a navigation zone, then PointLiesWithinZone. A label no zone carries can
   // hold nobody, which is the answer the lookup's own failure gives.
   pedIsInNaviZone:(handle,zoneName)=>{
    const zone=findNavigationZone(this.zones,zoneName);if(!zone)return false;
    const at=this.peds.positionOf(handle);
    return pointInWorldZone(zone,[at.x,at.y,at.z]);
   },
   // The CPed bits a script sets by name, and the critical hit it can spare the ped.
   setPedFlag:(handle,flag,value)=>{this.world.setScriptPedFlag(this.livePed(handle),flag,value);},
   setPedSimpleFlag:(handle,flag,value)=>{
    this.world.setScriptPedFlag(this.livePed(handle),flag,value);
    if(flag==='neverLeavesGroup'){if(value)this.neverLeavesGroup.add(handle);else this.neverLeavesGroup.delete(handle);}
   },
   setPedSuffersCriticalHits:(handle,suffers)=>{this.world.setScriptPedCriticalHits(this.livePed(handle),suffers);},
   pedAnimProgress:(handle,animation)=>this.world.scriptPedAnimProgress(this.livePed(handle),animation),
   // A browser ped a script made never rides, so it sits in no car at all.
   // A ped a script put in a car rides there until something takes it out; nothing else in this browser does.
   // CPedGroups: the groups a script makes, and the membership commands that read and change them.
   createGroup:()=>{const handle=this.nextGroup++;this.groups.set(handle,new NativePedGroup());return handle;},
   removeGroup:group=>{this.groups.get(group)?.flush();if(group!==PLAYER_GROUP_HANDLE)this.groups.delete(group);},
   setGroupLeader:(group,handle)=>{this.group(group).setLeader(handle);},
   setGroupMember:(group,handle)=>{this.group(group).addFollower(handle);},
   pedIsInGroup:(handle,group)=>this.groups.get(group)?.isMember(handle)??false,
   pedIsGroupLeader:(handle,group)=>this.groups.get(group)?.isLeader(handle)??false,
   // GET_NUMBER_OF_FOLLOWERS asks after the group this ped leads.
   pedFollowerCount:handle=>{
    for(const group of this.groups.values())if(group.isLeader(handle))return group.countFollowers();
    return 0;
   },
   // CPedGroupMembership::RemoveMember, which leaves a leader where it is.
   removePedFromGroup:handle=>{for(const group of this.groups.values())if(group.isFollower(handle))group.removeMember(handle);},
   createCharInsideCar:(vehicle,pedType,model,seat)=>this.peds.createInCar(pedType,model,vehicle,seat),
   createRandomCharInCar:(vehicle,seat)=>this.peds.createRandomInCar(vehicle,seat),
   // CTaskSimpleCarSetPedInAsDriver after an immediate flush: the ped stops walking and rides.
   warpPedIntoCar:(handle,vehicle)=>{
    if(handle===PLAYER_PED_HANDLE){if(!this.host('warpPlayerIntoCar','WARP_CHAR_INTO_CAR')(this.liveVehicle(vehicle)))throw new UnsupportedScmCommand(-1,0,'WARP_CHAR_INTO_CAR','a player in another vehicle');return;}
    this.livePed(handle);this.peds.warpIntoCar(handle,vehicle,'driver');
   },
   // The passenger seat is the one CREATE_CHAR_AS_PASSENGER takes, from the same operand.
   warpPedIntoCarAsPassenger:(handle,vehicle,seat)=>{this.livePed(handle);this.peds.warpIntoCar(handle,vehicle,seat);},
   // CPed::AttachPedToEntity and DettachPedFromEntity. The angle limit and the weapon belong to a ped that can
   // aim from where it hangs, which this browser's riders do not do yet, so they are not taken.
   attachPedToCar:(handle,vehicle,offset)=>{this.peds.attachToCar(handle,vehicle,offset);},
   detachPedFromCar:handle=>{this.peds.detachFromCar(handle,this.peds.positionOf(handle));},
   setPedKindaStayInSamePlace:(handle,state)=>{this.world.setScriptPedFlag(this.livePed(handle),'kindaStayInSamePlace',state);},
   // CPed::bIsTalking and the facial talk. The depot has no speech banks, so these hold what the script said
   // and nothing speaks; the thread carries on rather than stopping on a question nothing here answers.
   // The player's own speech lines are not played, so shutting him up, or his face talking, has nothing to act on.
   shutPedUpForScriptedSpeech:(handle,enabled)=>{if(handle!==PLAYER_PED_HANDLE)this.world.setScriptPedSpeech(this.livePed(handle),enabled);},
   // SHUT_CHAR_UP, DISABLE_CHAR_SPEECH and ENABLE_CHAR_SPEECH (reversed): CPed::DisablePedSpeech and EnablePedSpeech.
   // The browser keeps one speech switch per ped, which the scripted-speech command sets too. The player has no
   // speech bank here, so his is nothing to switch.
   setPedSpeechDisabled:(handle,disabled)=>{if(handle!==PLAYER_PED_HANDLE)this.world.setScriptPedSpeech(this.livePed(handle),disabled);},
   disablePedSpeech:handle=>{if(handle!==PLAYER_PED_HANDLE)this.world.setScriptPedSpeech(this.livePed(handle),true);},
   enablePedSpeech:handle=>{if(handle!==PLAYER_PED_HANDLE)this.world.setScriptPedSpeech(this.livePed(handle),false);},
   // GET_CAR_CHAR_IS_USING (reversed): the car the ped sits in, else the one it is entering; none is -1. The
   // browser does not hand the script the car the player is walking to.
   // IS_CHAR_TALKING (unreversed; CPed::GetPedTalking): the browser plays no speech lines for a script's peds, the
   // speech banks not being published, so none of them is ever mid-line.
   pedIsTalking:()=>false,
   // IS_CAR_PASSENGER_SEAT_FREE: no script ped sits in that seat of the script's car.
   vehiclePassengerSeatIsFree:(handle,seat)=>!this.peds.seatTaken(handle,seat),
   pedCarInUse:handle=>handle===PLAYER_PED_HANDLE?this.playerCarHandle()??-1:this.peds.rideOf(handle)?.vehicle??-1,
   isSphereVisible:(point,radius)=>{if(!this.world.isSphereVisible)throw new UnsupportedScmCommand(-1,0,'IS_POINT_ON_SCREEN','no camera');return this.world.isSphereVisible(point,radius);},
   startPedFacialTalk:(handle,duration)=>{if(handle!==PLAYER_PED_HANDLE)this.world.setScriptPedFacialTalk(this.livePed(handle),duration/1000);},
   stopPedFacialTalk:handle=>{if(handle!==PLAYER_PED_HANDLE)this.world.setScriptPedFacialTalk(this.livePed(handle),undefined);},
   hidePedWeaponForScriptedCutscene:(handle,state)=>{if(handle===PLAYER_PED_HANDLE)this.host('hidePlayerWeapon','HIDE_CHAR_WEAPON_FOR_SCRIPTED_CUTSCENE')(state);else this.world.hideScriptPedWeapon(this.livePed(handle),state);},
   addExplosion:(x,y,z,type)=>{this.world.addExplosion({x,y,z},type);},
   setVehicleCanBurstTyres:(handle,state)=>{this.world.setScriptVehicleCanBurstTyres(this.liveVehicle(handle),state);},
   setVehicleHeavy:(handle,state)=>{this.world.setScriptVehicleHeavy?.(this.liveVehicle(handle),state);},
   // CLocalisation::Metric() is m_nPrefsLanguage != AMERICAN; the port reads american.gxt, so feet. The conversion's
   // factor is in the unreversed handler; 3.28 is the documented opcode's (authored).
   measurementsAreInMetres:()=>false,
   convertMetresToFeet:metres=>Math.fround(metres*3.28),
   convertMetresToFeetInt:metres=>Math.trunc(metres*3.28),
   setVehicleOnlyDamagedByPlayer:(handle,state)=>{this.world.setScriptVehicleOnlyDamagedByPlayer(this.liveVehicle(handle),state);},
   projectileIsInArea:(min,max)=>this.world.projectilesInBox(min,max,false),
   vehicleCanBeTargettedByHomingMissile:(handle,state)=>{this.world.setScriptVehicleHeatSeekTargetable(this.liveVehicle(handle),state);},
   changeVehicleColour:(handle,colour1,colour2)=>{this.world.recolourScriptVehicle(this.liveVehicle(handle),colour1,colour2);},
   setAllPedSpeechDisabled:disabled=>{this.world.setAllPedSpeechDisabled(disabled);},
   // CHudColours' own table, which CRadar reads the same way for its blips.
   hudColour:colour=>{
    const rgb=HUD_COLOURS[colour];
    if(!rgb)throw new UnsupportedScmCommand(-1,0,'A_HUD_COLOUR_THE_TABLE_DOES_NOT_CARRY',`colour ${colour}`);
    return {red:rgb[0],green:rgb[1],blue:rgb[2],alpha:255};
   },
   isMessageBeingDisplayed:()=>this.world.messageShowing(),
   isHelpMessageBeingDisplayed:()=>this.world.helpMessageShowing(),
   isThisHelpMessageBeingDisplayed:key=>this.host('helpMessageShowingKey','IS_THIS_HELP_MESSAGE_BEING_DISPLAYED')(key),
   // Where the camera is and what it looks along, which is the browser's own camera whether the script has
   // taken it over or not, and the mode and field of view it is running with.
   // CCamera::SetCameraDirectlyInFrontForFollowPed_CamOnAString, the other side of the behind command.
   setCameraInFrontOfPlayer:()=>{this.world.setCameraInFrontOfPlayer();},
   activeCameraSource:()=>this.world.cameraSource(),
   activeCameraFront:()=>this.world.cameraFront(),
   activeCameraFov:()=>this.world.cameraFov(),
   activeCameraMode:()=>this.runtime.game.camera.modeToGoTo,
   // The debug camera is the same camera here: this browser has no separate one to ask.
   debugCameraSource:()=>this.world.cameraSource(),
   debugCameraFront:()=>this.world.cameraFront(),
   // ADD_CHAR_DECISION_MAKER_EVENT_RESPONSE and its group form write one of the six choices a decision file
   // holds for an event; the clearing forms empty that event's row.
   addPedDecisionMakerEventResponse:(decisionMaker,event,taskId,chances,inCar,onFoot)=>{
    this.addDecision(decisionMaker,event,taskId,chances,inCar,onFoot);
   },
   addGroupDecisionMakerEventResponse:(decisionMaker,event,taskId,chances,inCar,onFoot)=>{
    this.addDecision(decisionMaker,event,taskId,chances,inCar,onFoot);
   },
   clearPedDecisionMakerEventResponse:(decisionMaker,event)=>{this.decisionsFor(decisionMaker).delete(event);},
   clearGroupDecisionMakerEventResponse:(decisionMaker,event)=>{this.decisionsFor(decisionMaker).delete(event);},
   // CObject's own fields, which the runtime keeps, and the two questions only the world can answer.
   objectHealth:handle=>this.runtime.game.objects.at(handle).health,
   setObjectHealth:(handle,health)=>{this.runtime.game.objects.setHealth(handle,health);},
   objectHasBeenDamaged:handle=>this.runtime.game.objects.at(handle).damaged,
   // The object handler is unreversed; like the ped's, the flag is taken as it is read (reVC does the same).
   hasObjectBeenPhotographed:handle=>{const o=this.runtime.game.objects.at(handle),was=!!o.photographed;o.photographed=false;return was;},
   objectSpeed:handle=>this.runtime.game.objects.speed(handle),
   objectIsStatic:handle=>this.runtime.game.objects.at(handle).isStatic,
   // CWorld::FindMissionEntitiesIntersectingCube over the box the radii span: a mission car, a mission ped or a mission
   // object whose position is inside it (edges included), found through the sectors the box covers.
   pointIsObscuredByMissionEntity:(x,y,z,rx,ry,rz)=>{
    const within=(p:{x:number;y:number;z:number})=>insideMissionCube(x,y,z,rx,ry,rz,p);
    for(const handle of this.vehicles.handles)if(this.vehicles.exists(handle)&&within(this.vehicles.positionOf(handle)))return true;
    for(const handle of this.peds.handles)if(this.peds.exists(handle)&&within(this.ridingIn(handle)??this.peds.positionOf(handle)))return true;
    return this.runtime.game.objects.all.some(o=>isMissionObjectType(o.objectType)&&within(o.position));
   },
   setObjectVisible:(handle,state)=>{this.runtime.game.objects.at(handle).visible=state;},
   // CEntity::GetIsOnScreen and physicalFlags.bSubmergedInWater, asked of where the object stands.
   objectIsOnScreen:handle=>this.world.pointOnScreen(this.runtime.game.objects.at(handle).position,1),
   objectIsInWater:handle=>this.world.pointUnderWater(this.runtime.game.objects.at(handle).position),
   // CEntity's attachment: the object hangs from a car, a ped or another object at an offset in that entity's
   // own axes, and stays where it had got to when it is let go.
   attachObjectToVehicle:(object,vehicle,offset,rotation)=>{this.runtime.game.objects.attach(object,'vehicle',vehicle,offset,rotation);},
   attachObjectToChar:(object,ped,x,y,z,rx,ry,rz)=>{this.runtime.game.objects.attach(object,'ped',ped,{x,y,z},{x:rx,y:ry,z:rz});},
   attachObjectToObject:(object,other,offset,rotation)=>{this.runtime.game.objects.attach(object,'object',other,offset,rotation);},
   // The push DETACH_OBJECT gives the object needs physics this browser does not run for a script's objects,
   // so the object is let go where it hangs and does not fly.
   detachObject:handle=>{this.runtime.game.objects.detach(handle);},
   objectIsAttached:handle=>this.runtime.game.objects.isAttached(handle),
   // Fx_c's systems, by the handle the script holds them with.
   createFxSystem:(name,x,y,z,ignoreBoundingChecks)=>this.makeFx(name,{x,y,z},ignoreBoundingChecks),
   createFxSystemOnPed:(name,handle,offset,ignoreBoundingChecks)=>this.makeAttachedFx(name,'ped',handle,offset,undefined,ignoreBoundingChecks),
   createFxSystemOnObject:(name,object,offset,ignoreBoundingChecks)=>this.makeAttachedFx(name,'object',object,offset,undefined,ignoreBoundingChecks),
   createFxSystemOnCar:(name,vehicle,x,y,z,ignoreBoundingChecks)=>this.makeAttachedFx(name,'vehicle',vehicle,{x,y,z},undefined,ignoreBoundingChecks),
   createFxSystemOnVehicleWithDirection:(name,vehicle,offset,direction,ignoreBoundingChecks)=>this.makeAttachedFx(name,'vehicle',vehicle,offset,direction,ignoreBoundingChecks),
   createFxSystemOnCharWithDirection:(name,char,x,y,z,dx,dy,dz,ignoreBoundingChecks)=>this.makeAttachedFx(name,'ped',char,{x,y,z},{x:dx,y:dy,z:dz},ignoreBoundingChecks),
   playFxSystem:handle=>{this.world.playScriptFx(this.fxOf(handle),false);},
   playAndKillFxSystem:handle=>{this.world.playScriptFx(this.fxOf(handle),true);},
   stopFxSystem:handle=>{this.world.stopScriptFx(this.fxOf(handle));},
   killFxSystem:handle=>{this.world.killScriptFx(this.fxOf(handle));this.scriptFx.delete(handle);},
   killFxSystemNow:handle=>{this.world.killScriptFx(this.fxOf(handle));this.scriptFx.delete(handle);},
   // CWorld::FindGroundZFor3DCoord looks down from the point itself rather than from a thousand above.
   groundZFor3DCoord:(x,y,z)=>this.world.groundLevel(x,y,z)??z,
   // CREATE_RANDOM_CHAR: the game picks the model, which is the one the zone's own roster would have used.
   createRandomChar:(x,y,z)=>{
    const model=this.world.randomCivilianModel();
    if(model===undefined)throw new UnsupportedScmCommand(-1,0,'A_RANDOM_PED_THE_ZONE_CANNOT_YET_SUPPLY','');
    return this.peds.create(PED_TYPE_CIVMALE,model,{x,y,z});
   },
   // The freeze that also waits for collision: a ped the browser built stands on ground it has already
   // loaded, so there is nothing to wait for and it is the plain freeze.
   freezePedPositionAndWaitForCollision:(handle,freeze)=>{this.world.setScriptPedFrozen(this.livePed(handle),freeze);},
   setPedCanBeShotInVehicle:(handle,canBeShot)=>{this.world.setScriptPedFlag(this.livePed(handle),'canBeShotInVehicle',canBeShot);},
   // The player's bDontDragMeOutCar is kept here: nothing in the browser drags the player out yet.
   setPedCantBeDraggedOut:(handle,cannot)=>{if(handle===PLAYER_PED_HANDLE)this.playerCantBeDraggedOut=cannot;else this.world.setScriptPedFlag(this.livePed(handle),'cantBeDraggedOut',cannot);},
   setPedLoadsCollision:(handle,loads)=>{this.world.setScriptPedFlag(this.livePed(handle),'loadsCollision',loads);},
   // bDeathPickupsPersist: CreateDeadPedWeaponPickups makes PICKUP_ONCE_FOR_MISSION pickups, which never time out.
   setPedDeathWeaponsPersist:(handle,persist)=>{this.world.setScriptPedFlag(this.livePed(handle),'deathPickupsPersist',persist);},
   updatePickupMoneyPerDay:(handle,money)=>{const pickup=this.runtime.game.pickups.at(handle);if(!pickup)return;pickup.moneyPerDay=money;this.world.setScriptPickupMoneyPerDay?.(handle,money);},
   setPedInformRespectedFriends:(handle,radius)=>{this.world.setScriptPedRange(this.livePed(handle),'informFriends',radius);},
   setPedFollowNodeThresholdDistance:(handle,range)=>{this.world.setScriptPedRange(this.livePed(handle),'followNodeThreshold',range);},
   setPedSenseRange:(handle,range)=>{this.world.setScriptPedRange(this.livePed(handle),'sense',range);},
   // CPed::m_pLastEntityDamage named back in the script's own handles: the player's ped, a ped the script made
   // or a car it made. Something the script never made has no handle to give, so it names nothing.
   pedLastDamagedBy:handle=>{
    const last=this.world.scriptPedLastDamagedBy(this.livePed(handle));
    if(!last)return undefined;
    if(last.player)return {ped:PLAYER_PED_HANDLE};
    const ped=last.ped===undefined?undefined:this.peds.handleOf(last.ped);
    const vehicle=last.car===undefined?undefined:this.vehicles.handleOf(last.car);
    return ped===undefined&&vehicle===undefined?undefined:{ped,vehicle};
   },
   // HAS_CAR_BEEN_DAMAGED_BY_CHAR: the car's m_pLastDamageEntity is the ped, or the vehicle the ped is in.
   vehicleWasDamagedByPed:(handle,ped)=>{
    const last=this.host('scriptVehicleLastDamagedBy','HAS_CAR_BEEN_DAMAGED_BY_CHAR')(this.liveVehicle(handle));
    if(!last)return false;
    if(ped===PLAYER_PED_HANDLE?last.player:last.ped!==undefined&&last.ped===this.livePed(ped))return true;
    const ride=ped===PLAYER_PED_HANDLE?this.playerCarHandle():this.peds.rideOf(ped)?.vehicle;
    return ride!==undefined&&last.car!==undefined&&last.car===this.vehicleByHandle(ride);
   },
   vehicleMaximumPassengers:handle=>this.host('scriptVehicleMaximumPassengers','GET_MAXIMUM_NUMBER_OF_PASSENGERS')(this.liveVehicle(handle)),
   // CVehicle::m_nNumPassengers: the script's peds in the car's passenger seats.
   vehiclePassengerCount:handle=>this.peds.passengersOf(handle),
   // The script's 0 to 3 are eCarWheel (front left, rear left, front right, rear right), which BurstTyre passes through.
   burstVehicleTyre:(handle,wheel)=>{this.host('burstScriptVehicleTyre','BURST_CAR_TYRE')(this.liveVehicle(handle),wheel);},
   // reVC's TURN_CAR_TO_FACE_COORD: GetATanOfXY(position - point) + π/2, less a turn once past one, as a heading.
   turnVehicleToFaceCoord:(handle,x,y)=>{
    const at=handle===PLAYER_VEHICLE_HANDLE?this.playerPose(handle).position:this.vehicles.positionOf(handle);
    let heading=getATanOfXY(at.x-x,at.y-y)+Math.PI/2;if(heading>2*Math.PI)heading-=2*Math.PI;
    this.vehicles.setHeading(handle,heading*180/Math.PI);
   },
   // CTrain::RemoveMissionTrains and ReleaseMissionTrains walk the train pool: the port runs no trains, so no mission
   // train can exist to remove or release.
   deleteMissionTrains:()=>{},
   markMissionTrainsAsNoLongerNeeded:()=>{},
   createUser3dMarker:(x,y,z,colour)=>this.host('createScriptUser3dMarker','CREATE_USER_3D_MARKER')(x,y,z,colour),
   removeUser3dMarker:index=>{this.host('removeScriptUser3dMarker','REMOVE_USER_3D_MARKER')(index);},
   pedIsSwimming:handle=>handle===PLAYER_PED_HANDLE?this.host('playerSwimming','IS_CHAR_SWIMMING')()
    :this.host('scriptPedSwimming','IS_CHAR_SWIMMING')(this.livePed(handle)),
   isGangWarFightingGoingOn:()=>this.host('gangWarFightingGoingOn','IS_GANG_WAR_FIGHTING_GOING_ON')(),
   // The trip skip's four set-ups: after a mission, or for a named vehicle, or for one the script finishes off.
   setUpSkip:(x,y,z,heading)=>{this.host('setUpScriptSkip','SET_UP_SKIP')([x,y,z],heading,false,undefined,false);},
   setUpSkipAfterMission:(x,y,z,heading)=>{this.host('setUpScriptSkip','SET_UP_SKIP_AFTER_MISSION')([x,y,z],heading,true,undefined,false);},
   setUpSkipForSpecificVehicle:(x,y,z,heading,car)=>{this.host('setUpScriptSkip','SET_UP_SKIP_FOR_SPECIFIC_VEHICLE')([x,y,z],heading,false,this.liveVehicle(car),false);},
   setUpSkipForVehicleFinishedByScript:(x,y,z,heading,car)=>{this.host('setUpScriptSkip','SET_UP_SKIP_FOR_VEHICLE_FINISHED_BY_SCRIPT')([x,y,z],heading,false,this.liveVehicle(car),true);},
   clearSkip:()=>{this.host('clearScriptSkip','CLEAR_SKIP')();},
   isSkipWaitingForScriptToFadeIn:()=>this.host('isScriptSkipWaitingForFadeIn','IS_SKIP_WAITING_FOR_SCRIPT_TO_FADE_IN')(),
   // The car watches CTheScripts::Process runs. They ask only about a car the browser has built: one still streaming
   // in has no driver in its seat, so the stuck check starts again from where it stands.
   vehicleHasDriver:handle=>{
    if(handle===PLAYER_VEHICLE_HANDLE)return !!this.world.playerPed().vehicle;
    if(!this.vehicles.entity(handle))return false;
    return this.playerCarHandle()===handle||this.peds.driverOf(handle)!==undefined;
   },
   vehicleIsUpsideDownForCheck:handle=>{const car=this.vehicleByHandle(handle);return !!car&&!!this.world.scriptVehicleUpsideDownForCheck?.(car);},
   vehicleRouteNodeForScript:handle=>{
    const car=this.vehicleByHandle(handle),route=car?this.world.scriptVehicleRouteNodes?.(car):undefined;
    return route?findNodeCoorsForScriptBetween(route.current,route.starting):undefined;
   },
   // CStuckCarCheck's search: from nought, switched-off nodes included.
   carPlacementNode:(point,nth)=>this.scriptCarNode(point,nth,false),
   // SetCoordsOfScriptCar with the orientation cleared, then the heading. The player's own car is no script car.
   warpVehicle:(handle,point,heading)=>{if(handle===PLAYER_VEHICLE_HANDLE)return;this.vehicles.setPosition(handle,point);this.vehicles.setHeading(handle,heading);},
   // GET_NTH_CLOSEST_CAR_NODE counts from one (FindNthNodeClosestToCoors from nought) over the car nodes not switched
   // off. With nothing found, FindNodeCoorsForScript gives back the zero vector.
   nthClosestVehicleNode:(x,y,z,nth)=>{const node=this.scriptCarNode({x,y,z},nth-1,true);return node?{x:node.x,y:node.y,z:node.z}:{x:0,y:0,z:0};},
   getNthClosestCarNodeWithHeading:(x,y,z,nth)=>this.scriptCarNode({x,y,z},nth-1,true)??{x:0,y:0,z:0,heading:0},
   vehicleWasDamagedByVehicle:(handle,other)=>{
    const last=this.host('scriptVehicleLastDamagedBy','HAS_CAR_BEEN_DAMAGED_BY_CAR')(this.liveVehicle(handle));
    return last?.car!==undefined&&last.car===this.liveVehicle(other);
   },
   vehicleLastWeaponDamage:handle=>this.host('scriptVehicleLastWeaponDamage','HAS_CAR_BEEN_DAMAGED_BY_WEAPON')(this.liveVehicle(handle)),
   clearVehicleLastDamageEntity:handle=>{this.host('clearScriptVehicleLastDamagedBy','CLEAR_CAR_LAST_DAMAGE_ENTITY')(this.liveVehicle(handle));},
   clearCarLastWeaponDamage:handle=>{this.host('clearScriptVehicleLastWeaponDamage','CLEAR_CAR_LAST_WEAPON_DAMAGE')(this.liveVehicle(handle));},
   pedLastWeaponDamage:handle=>handle===PLAYER_PED_HANDLE?this.host('playerLastWeaponDamage','HAS_CHAR_BEEN_DAMAGED_BY_WEAPON')()
    :this.host('scriptPedLastWeaponDamage','HAS_CHAR_BEEN_DAMAGED_BY_WEAPON')(this.livePed(handle)),
   clearPedLastWeaponDamage:handle=>{
    if(handle===PLAYER_PED_HANDLE)this.host('clearPlayerLastWeaponDamage','CLEAR_CHAR_LAST_WEAPON_DAMAGE')();
    else this.host('clearScriptPedLastWeaponDamage','CLEAR_CHAR_LAST_WEAPON_DAMAGE')(this.livePed(handle));
   },
   // The player's own damager is not kept, so there is nothing of his to clear.
   clearPedLastDamageEntity:handle=>{if(handle!==PLAYER_PED_HANDLE)this.host('clearScriptPedLastDamagedBy','CLEAR_CHAR_LAST_DAMAGE_ENTITY')(this.livePed(handle));},
   pedIsSittingInCar:(handle,vehicle)=>handle===PLAYER_PED_HANDLE?this.world.playerPed().sittingInCar&&this.playerCarHandle()===vehicle:this.peds.rideOf(handle)?.vehicle===vehicle,
   // CPed's own acquaintance table, through CAcquaintance's routines.
   setPedRelationship:(handle,relationship,pedType)=>{if(handle===PLAYER_PED_HANDLE)this.host('setPlayerRelationship','SET_CHAR_RELATIONSHIP')(relationship,pedType);else this.world.setScriptPedRelationship(this.livePed(handle),relationship,pedType);},
   clearPedRelationship:(handle,relationship,pedType)=>{if(handle===PLAYER_PED_HANDLE)this.host('clearPlayerRelationship','CLEAR_CHAR_RELATIONSHIP')(relationship,pedType);else this.world.clearScriptPedRelationship(this.livePed(handle),relationship,pedType);},
   clearAllPedRelationships:(handle,relationshipType)=>{if(handle===PLAYER_PED_HANDLE)this.host('clearPlayerRelationships','CLEAR_ALL_CHAR_RELATIONSHIPS')(relationshipType);else this.world.clearScriptPedRelationships(this.livePed(handle),relationshipType);},
   setPedNeverTargeted:(handle,enabled)=>{this.world.setScriptPedNeverTargeted(this.livePed(handle),enabled);},
   clearPedLookAt:handle=>{if(handle===PLAYER_PED_HANDLE)this.host('clearPlayerLookAt','CLEAR_LOOK_AT')();else this.world.clearScriptPedLookAt(this.livePed(handle));},
   // The player's own cash is CPlayerInfo's, not the ped's m_nMoneyCount.
   setPedMoney:(handle,money)=>{if(handle!==PLAYER_PED_HANDLE)this.world.setScriptPedMoney?.(this.livePed(handle),money);},
   takePedPhotographedFlag:handle=>handle!==PLAYER_PED_HANDLE&&!!this.world.takeScriptPedPhotographed?.(this.livePed(handle)),
   // SET_CHAR_STAY_IN_SAME_PLACE is the flag CTaskComplexBeStill reads, which for a browser ped is the order
   // that holds it where it is; clearing it lets the wander have the ped back.
   setPedStayInSamePlace:(handle,stay)=>{
    this.world.giveScriptPedOrder(this.livePed(handle),stay?{kind:'standStill',seconds:Number.POSITIVE_INFINITY}:{kind:'wander'});
   },
   vehicleMatrix:handle=>handle===PLAYER_VEHICLE_HANDLE?this.playerPose(handle):this.world.scriptVehicleMatrix(this.liveVehicle(handle)),
   freezeVehiclePosition:(handle,frozen)=>{this.world.setScriptVehicleFrozen(this.liveVehicle(handle),frozen);},
   // bIsFrozen and bInfiniteMass as FREEZE_CAR_POSITION sets them; the collision it waits for is the browser's to stream.
   freezeVehiclePositionAndDontLoadCollision:(handle,frozen)=>{this.world.setScriptVehicleFrozen(this.liveVehicle(handle),frozen);},
   explosionInArea:(type,min,max)=>this.host('explosionInArea','IS_EXPLOSION_IN_AREA')(type,min,max),
   setUpsideDownVehicleNotDamaged:(handle,state)=>{this.world.setScriptVehicleUpsideDownNotDamaged?.(this.liveVehicle(handle),state);},
   setVehicleForwardSpeed:(handle,forwardSpeed)=>{this.world.setScriptVehicleForwardSpeed(this.liveVehicle(handle),forwardSpeed);},
   // CWorld::FindGroundZForCoord looks straight down from a thousand above and answers twenty where the world
   // has no ground under the point.
   groundZForCoord:(x,y)=>this.world.groundLevel(x,y,0)??20,
   // A ped a script made never rides in the browser yet, so it is always on foot and never sitting in a car.
   pedIsOnFoot:handle=>handle===PLAYER_PED_HANDLE?!this.world.playerPed().vehicle:this.peds.exists(handle)&&this.peds.rideOf(handle)===undefined,
   pedIsSittingInAnyCar:handle=>handle===PLAYER_PED_HANDLE?this.world.playerPed().sittingInCar:this.peds.rideOf(handle)!==undefined,
   // eVehicleAppearance. The browser builds a car for every vehicle a script makes, so one of those is an
   // automobile; the player's own is whatever he is riding.
   vehicleAppearance:handle=>handle===PLAYER_VEHICLE_HANDLE?this.playerVehicle(handle).appearance:(this.liveVehicle(handle),VEHICLE_APPEARANCE_AUTOMOBILE),
   vehicleIsTrain:handle=>handle===PLAYER_VEHICLE_HANDLE?this.playerVehicle(handle).train:(this.liveVehicle(handle),false),
   playerMissionGates:()=>this.world.playerMissionGates(),
   pedIsStopped:handle=>handle===PLAYER_PED_HANDLE?this.world.playerPed().stopped:this.world.scriptPedStanding(this.livePed(handle)),
   pedIsDeadForScript:handle=>handle===PLAYER_PED_HANDLE?this.world.playerPed().dead:this.peds.isDead(handle),
   pedHealth:handle=>handle===PLAYER_PED_HANDLE?this.world.playerPed().health:this.peds.healthOf(handle),
   setPlayerControl:(_player,control)=>{this.playerControl=control;this.world.setPlayerControl(control);},
   // The browser has no cutscene player, so the data counts as in as soon as it is asked for and the cutscene
   // ends as soon as it starts. That keeps the script's wait loops moving instead of holding a thread forever
   // on a question nothing here will ever answer.
   // The browser's streamer works from where the player is, not from names, so a requested model counts as
   // loaded at once. Holding a thread on a question nothing here answers would stop the script instead.
   // CStreaming::LoadScene with a heading, which the browser answers the same way it answers the plain one.
   loadSceneInDirection:(x,y,z)=>{this.world.loadScene(x,y,z);},
   /* CWorld::ClearExcitingStuffFromArea is ported and deliberately not called here, which is an ordering
    * difference rather than a missing piece. In the original the script runs at game start and its opening
    * clear finds an empty world. This browser builds and populates its world first and starts MAIN.SCM when
    * that world is ready, so the same clear arrives seconds late and would sweep away a street the original
    * had not put there yet. The host's own clearArea does what the routine does, for the day the script starts
    * before the population does, or for a mission that clears an area while it runs. */
   // A mission clearing its area while it runs gets the host's clear. MAIN's own sweeps, and the INTRO mission's
   // (MAIN launches it with the new game and it clears 500 units round Grove Street), are only counted, for the
   // ordering reason above.
   clearExcitingStuffFromArea:(point,radius,_projectiles,fromMission)=>{this.areasCleared++;if(fromMission)this.world.clearArea(point,radius);},
   // CWorld::ClearCarsFromArea and ClearPedsFromArea over the script's box.
   clearAreaOfVehicles:(min,max)=>{this.host('clearVehiclesInBox','CLEAR_AREA_OF_CARS')(min,max);},
   clearAreaOfPeds:(min,max)=>{this.host('clearPedsInBox','CLEAR_AREA_OF_CHARS')(min,max);},
   // SET_CAR_TEMP_ACTION on a script car: CAutoPilot::SetTempAction for the time.
   setVehicleTempAction:(handle,action,time)=>{this.host('scriptVehicleTempAction','SET_CAR_TEMP_ACTION')(this.liveVehicle(handle),action,time/1000);},
   // CPed::OurPedCanSeeThisEntity: in front, inside forty units, and nothing solid between the two of them.
   // The ped is looked at a unit above its own position, which is its head.
   pedCanSeePed:(handle,other)=>{
    if(!this.peds.exists(handle)||!this.peds.exists(other))return false;
    const from=this.peds.positionOf(handle),to=this.peds.positionOf(other);
    const heading=this.peds.headingOf(handle)*Math.PI/180,frame=headingFrame(heading);
    if(!pedSightAngleAndRange({x:from.x,y:from.y},{x:frame.forward.x,y:frame.forward.y},{x:to.x,y:to.y}))return false;
    return this.world.lineOfSightClear(from,{x:to.x,y:to.y,z:to.z+PED_SIGHT_TARGET_RAISE});
   },
   // CRadar's blip carries the entry-exit nearest the point the command names, by the manager's own lookup.
   setBlipEntryExit:(blip,x,y,radius)=>{
    this.runtime.game.radar.setEntryExit(blip>>>0,this.world.nearestEntryExit(x,y,radius)??null);
   },
   // IS_CHAR_RESPONDING_TO_EVENT. The command's own dispatch is not reversed; what it reads is CPedIntelligence's
   // event group, which for a browser ped is the one event it is answering and whether it still is.
   pedIsRespondingToEvent:(handle,event)=>this.world.scriptPedRespondingTo(this.livePed(handle),event),
   // EXTEND_PATROL_ROUTE builds the route CTaskComplexFollowPatrolRoute walks. The task is not one the browser
   // runs, so the points are kept in the order the script gave them and nothing walks them yet.
   extendPatrolRoute:(x,y,z,animationName,animationFile)=>{
    this.patrolRoute.push({position:{x,y,z},animationName,animationFile});
   },
   // CStreaming's own answer, which is a model the browser has built a car from.
   randomVehicleModelInMemory:()=>{
    const chosen=this.world.randomVehicleInMemory();
    if(!chosen)throw new UnsupportedScmCommand(-1,0,'NO_VEHICLE_MODEL_IS_IN_MEMORY','');
    return chosen;
   },
   // CPed's own fields, which the host holds for a ped it built.
   setPedWeaponSkill:(handle,skill)=>{this.world.setScriptPedSkill(this.livePed(handle),skill);},
   setPedHasUsedEntryExit:handle=>{this.world.setScriptPedUsedEntryExit(this.livePed(handle));},
   // CAutoPilot's fields for a car the script made, which nothing drives here yet: they are the car's, kept
   // for the day something reads them, and the adapter says which of the two that is.
   setVehicleCruiseSpeed:(handle,maxSpeed)=>{this.world.setScriptVehicleAutopilot(this.liveVehicle(handle),'cruiseSpeed',maxSpeed);},
   setVehicleDrivingStyle:(handle,style)=>{this.world.setScriptVehicleAutopilot(this.liveVehicle(handle),'drivingStyle',style);},
   setVehicleLoadCollisionFlag:(handle,state)=>{this.world.setScriptVehicleAutopilot(this.liveVehicle(handle),'loadsCollision',state?1:0);},
   requestModel:model=>{this.requestedModels.add(String(model));this.world.requestModel(model);},
   hasModelLoaded:()=>true,
   markModelNotNeeded:()=>{},
   loadAllModelsNow:()=>{},
   loadCutscene:name=>{this.cutscenes.push(name);this.world.loadCutscene(name);this.runtime.game.cutscene.loaded();},
   startCutscene:()=>{this.runtime.game.cutscene.finish();},
   clearCutscene:()=>{},
   findNumberTagsTagged:()=>this.world.tagsTagged(),
   percentageTaggedInArea:(x1,y1,x2,y2)=>this.world.tagsPercentageInArea(x1,y1,x2,y2),
   // The handler is unreversed; MAIN.SCM passes 0 or 1, read here as CTagManager::SetAlphaInArea with 0 or 255.
   setTagStatusInArea:(x1,y1,x2,y2,status)=>{this.world.setTagsInArea?.(x1,y1,x2,y2,status!==0);},
   // GetNearestTag returns nothing without tags; the variables are then left at the point asked about.
   getNearestTagPosition:(x,y,z)=>this.world.nearestTagPosition?.(x,y,z)??{x,y,z},
   getTerritoryUnderControlPercentage:()=>this.world.territoryUnderControlPercentage(),
   // CPopulation::AddPed through the pool, which hands the script a handle at once.
   createChar:(pedType,model,x,y,z)=>this.peds.create(pedType,model,{x,y,z}),
   pedHeading:handle=>{
    if(handle!==PLAYER_PED_HANDLE)return this.peds.headingOf(handle);
    const heading=this.world.playerPed().heading;if(heading===undefined)throw new UnsupportedScmCommand(-1,0,'GET_CHAR_HEADING','player heading');
    return heading;
   },
   // A ped stands upright: its matrix is its heading's turn about the vertical, at its position. The player's comes
   // from the host; one the host does not know is not guessed.
   pedMatrix:handle=>{
    if(handle===PLAYER_PED_HANDLE){const player=this.world.playerPed();if(player.heading===undefined)throw new UnsupportedScmCommand(-1,0,'GET_OFFSET_FROM_CHAR_IN_WORLD_COORDS','player heading');
     return {...headingFrame(player.heading*Math.PI/180),position:player.position};}
    return {...headingFrame(this.peds.headingOf(handle)*Math.PI/180),position:this.ridingIn(handle)??this.peds.positionOf(handle)};
   },
   setPedCoordinates:(handle,x,y,z)=>{if(handle===PLAYER_PED_HANDLE)this.teleportPlayer(x,y,z,'SET_CHAR_COORDINATES');else this.peds.setPosition(handle,{x,y,z});},
   // SET_CHAR_COORDINATES_NO_OFFSET and the gang form differ from the plain one in what they do to a ped in a
   // car and to the ped's group, neither of which the browser's scripted peds have yet.
   setPedCoordinatesNoOffset:(handle,x,y,z)=>{if(handle===PLAYER_PED_HANDLE)this.teleportPlayer(x,y,z,'SET_CHAR_COORDINATES_NO_OFFSET');else this.peds.setPosition(handle,{x,y,z});},
   setPedCoordinatesDontWarpGang:(handle,x,y,z)=>{if(handle===PLAYER_PED_HANDLE)this.teleportPlayer(x,y,z,'SET_CHAR_COORDINATES_DONT_WARP_GANG');else this.peds.setPosition(handle,{x,y,z});},
   setPedHealth:(handle,health)=>{this.peds.setHealth(handle,health);},
   killPed:handle=>{this.peds.kill(handle);},
   setPedAccuracy:(handle,accuracy)=>{this.peds.setAccuracy(handle,accuracy);},
   setPedShootRate:(handle,rate)=>{this.peds.setShootingRate(handle,rate);},
   setRadioChannel:station=>{this.world.retuneRadio?.(station);},
   setPedInvulnerable:(handle,enabled)=>{this.peds.setInvulnerable(handle,enabled);},
   setPedProofs:(handle,proofs)=>{if(handle===PLAYER_PED_HANDLE)this.host('setPlayerProofs','SET_CHAR_PROOFS')(proofs);else this.peds.setProofs(handle,proofs);},
   deletePed:handle=>{this.peds.delete(handle);},
   markPedNoLongerNeeded:handle=>{this.peds.markNoLongerNeeded(handle);},
   pedType:handle=>this.peds.typeOf(handle),
   pedIsMale:handle=>this.peds.isMale(handle),
   pedSpeed:handle=>this.world.scriptPedSpeed(this.livePed(handle)),
   pedIsInWater:handle=>handle===PLAYER_PED_HANDLE?this.host('playerInWater','IS_CHAR_IN_WATER')():this.world.scriptPedSubmerged(this.livePed(handle)),
   setPedVisible:(handle,visible)=>{if(handle===PLAYER_PED_HANDLE)this.host('setPlayerVisible','SET_CHAR_VISIBLE')(visible);else this.world.setScriptPedVisible(this.livePed(handle),visible);},
   // CPedIntelligence's task, through the ped the browser built. A task with no browser behaviour yet turns
   // into nothing, and the thread gives up rather than leaving the ped standing as though it had obeyed.
   givePedScriptedTask:(handle,task,opcode)=>{
    // A new primary task replaces whatever sequence the ped was running from here.
    if(handle!==PLAYER_PED_HANDLE&&task.kind!=='useMobilePhone')this.runners.delete(handle);
    if((task.kind==='leaveCar'||task.kind==='leaveAnyCar'||task.kind==='leaveCarImmediately')&&handle!==PLAYER_PED_HANDLE){this.livePed(handle);this.runSequence(handle,[task],false,opcode,false);return;}
    // CTaskComplexUseMobilePhone is a secondary task: it does not take the ped's primary task or its task record.
    if(task.kind==='useMobilePhone'){this.host('usePedMobilePhone','TASK_USE_MOBILE_PHONE')(handle===PLAYER_PED_HANDLE?'player':this.livePed(handle),task.start);return;}
    if(CAR_TASKS.has(task.kind)&&handle!==PLAYER_PED_HANDLE){
     this.livePed(handle);
     // At the named car's wheel the drive begins now; on foot, CTaskComplexCarDrive gets in first.
     const ride=this.peds.rideOf(handle),atWheel=!!ride&&!ride.offset&&ride.seat==='driver'&&'vehicle' in task&&ride.vehicle===task.vehicle;
     if(atWheel){this.startCarTask(handle,task,opcode);this.recordTask(handle,opcode,false);}
     else this.runSequence(handle,[task],false,opcode,false);
     return;
    }
    const order=scriptedPedOrder(task,this.taskWorld(handle));
    if(!order)throw new UnsupportedScmCommand(opcode,0,'A_TASK_THE_BROWSER_DOES_NOT_RUN',task.kind);
    if(handle===PLAYER_PED_HANDLE){this.givePlayer([order],false,opcode);return;}
    // A ped in a car runs an on-foot task from here: out of the car first, or in its seat.
    const ride=this.peds.rideOf(handle);
    if(ride&&!ride.offset&&order.kind!=='wander'){this.livePed(handle);this.runSequence(handle,[task],false,opcode,false);return;}
    this.world.giveScriptPedOrder(this.livePed(handle),order);
    this.recordTask(handle,opcode,order.kind==='wander');
   },
   // CTaskComplexSequence: every task in the sequence has to be one the browser runs, because a sequence with
   // a hole in it is not the sequence the script asked for.
   givePedSequence:(handle,sequenceTasks,repeat,opcode)=>{
    const {tasks,steps}=this.expandSequence(sequenceTasks);
    if(steps)this.sequenceSteps.set(handle,steps);else this.sequenceSteps.delete(handle);
    const world=this.taskWorld(handle);
    const orders=[];
    const carTasks=handle!==PLAYER_PED_HANDLE&&tasks.some(task=>CAR_TASKS.has(task.kind));
    for(const task of tasks){
     if(carTasks&&CAR_TASKS.has(task.kind))continue;
     const order=scriptedPedOrder(task,world);
     if(!order)throw new UnsupportedScmCommand(opcode,0,'A_TASK_THE_BROWSER_DOES_NOT_RUN',task.kind);
     orders.push(order);
    }
    if(handle===PLAYER_PED_HANDLE){this.givePlayer(orders,repeat,opcode,true);return;}
    this.runners.delete(handle);
    const ride=this.peds.rideOf(handle);
    // With a car task in it, or for a ped in a car, the sequence runs from here a task at a time.
    if(carTasks||ride&&!ride.offset){this.livePed(handle);this.runSequence(handle,tasks,repeat,opcode,true);return;}
    this.world.giveScriptPedSequence(this.livePed(handle),orders,repeat);
    this.recordTask(handle,opcode,false);
   },
   // GET_SEQUENCE_PROGRESS (unreversed): CTaskComplexSequence::m_CurrentTaskIndex of the ped's running sequence, -1 with none.
   pedSequenceProgress:handle=>this.sequenceStep(handle).outer,
   getSequenceProgressRecursive:handle=>{const step=this.sequenceStep(handle);return {p2:step.outer,p3:step.inner};},
   // CCarCtrl::CreateCarForScript through the pool, which hands the script a handle at once.
   createCar:(model,x,y,z)=>this.vehicles.create(model,{x,y,z}),
   vehicleExists:handle=>handle===PLAYER_VEHICLE_HANDLE?!!this.world.playerPed().vehicle:this.vehicles.exists(handle),
   vehicleIsDeadForScript:handle=>handle===PLAYER_VEHICLE_HANDLE?!this.world.playerPed().vehicle:!this.vehicles.exists(handle),
   vehiclePosition:handle=>handle===PLAYER_VEHICLE_HANDLE?this.playerPose(handle).position:this.vehicles.positionOf(handle),
   // reVC's SET_CAR_COORDINATES: the point lifted by CEntity::GetDistanceFromCentreOfMassToBaseOfModel, the car
   // teleported there keeping its heading, the space round it cleared (ClearSpaceForMissionEntity), and a car on a
   // mission joined to the roads again from where it now stands. The player's own car (handle 1) moves the same way.
   setVehicleCoordinates:(handle,x,y,z)=>{
    const car=this.vehicleByHandle(handle),at={x,y,z:z+(car!==undefined?this.world.scriptVehicleBaseOffset?.(car)??0:0)};
    if(handle===PLAYER_VEHICLE_HANDLE)this.world.placeScriptVehicle(this.liveVehicle(handle),at,this.playerPose(handle).heading);
    else this.vehicles.setPosition(handle,at);
    if(car!==undefined){this.world.clearSpaceForScriptVehicle?.(car);this.world.rejoinScriptVehicleRoads?.(car);}
   },
   vehicleHeading:handle=>handle===PLAYER_VEHICLE_HANDLE?this.playerPose(handle).heading:this.vehicles.headingOf(handle),
   setVehicleHeading:(handle,degrees)=>{
    if(handle===PLAYER_VEHICLE_HANDLE)this.world.placeScriptVehicle(this.liveVehicle(handle),this.playerPose(handle).position,degrees);
    else this.vehicles.setHeading(handle,degrees);
   },
   deleteVehicle:handle=>{this.vehicles.delete(handle);},
   markVehicleNoLongerNeeded:handle=>{const car=this.vehicles.entity(handle);if(car)this.world.releaseScriptVehicle?.(car);this.vehicles.markNoLongerNeeded(handle);},
   // The player's own car (not one the script made) answers from the host.
   vehicleModel:handle=>handle===PLAYER_VEHICLE_HANDLE?this.playerVehicle(handle).model:this.vehicles.modelOf(handle),
   // CPlayerInfo's two-wheel, wheelie and stoppie counters are kept by the unreversed CPlayerInfo::Process and the
   // vehicles' ProcessControl, which the port does not measure: no stunt is ever under way or on record, so the
   // stunt-bonus script (HJ) reads zeros and the wheelie questions (reversed, over those counters) answer no.
   // IS_CAR_IN_AIR_PROPER (VehicleCommands.cpp, reversed): nothing it collides with is a building or a vehicle. The
   // host answers for the player's own vehicle; a car the script made is not measured.
   vehicleIsInAirProper:handle=>{const v=this.playerVehicle(handle);if(!v.inAirProper)throw new UnsupportedScmCommand(-1,0,'IS_CAR_IN_AIR_PROPER',`vehicle ${handle}`);return v.inAirProper();},
   // IS_CAR_UPRIGHT's handler is not reversed: the car is upright unless it lies on its roof (its up axis below the
   // horizontal), as the command is documented.
   isCarUpright:handle=>(handle===PLAYER_VEHICLE_HANDLE?this.playerPose(handle):this.world.scriptVehicleMatrix(this.liveVehicle(handle))).up.z>=0,
   // EXPLODE_CHAR_HEAD (CharacterCommands.cpp): CEventDamage with WEAPON_SNIPERRIFLE on PED_PIECE_HEAD, 1000 through
   // CPedDamageResponseCalculator, from no one.
   explodePedHead:handle=>{if(handle===PLAYER_PED_HANDLE)throw new UnsupportedScmCommand(-1,0,'EXPLODE_CHAR_HEAD','the player');this.host('explodeScriptPedHead','EXPLODE_CHAR_HEAD')(this.livePed(handle));},
   // CPlayerPed::ForceGroupToAlwaysFollow (PlayerCommands.cpp): the player's group keeps following whatever he does.
   forcePlayerGroupToAlwaysFollow:(_player,enable)=>{this.playerGroupAlwaysFollows=enable;},
   // CPed::bIsTargetPriority and bStayInCarOnJack's bike twin (m_nPedFlags): the ped's flags, kept on it.
   setPedIsTargetPriority:(handle,state)=>{if(handle!==PLAYER_PED_HANDLE)this.world.setScriptPedFlag(this.livePed(handle),'targetPriority',state);},
   setPedCanBeKnockedOffBike:(handle,stayOnBike)=>{if(handle!==PLAYER_PED_HANDLE)this.world.setScriptPedFlag(this.livePed(handle),'stayOnBike',stayOnBike);},
   // The car's own fields the script sets that the browser's cars keep but do not act on: the heli's rotor speed,
   // CVehicle's status, and CAutomobile::m_fCarTraction.
   setHeliBladesFullSpeed:handle=>{(this.liveVehicle(handle) as {rotorFullSpeed?:boolean}).rotorFullSpeed=true;},
   setVehicleStatus:(handle,status)=>{(this.liveVehicle(handle) as {scriptStatus?:number}).scriptStatus=status;},
   setVehicleTraction:(handle,traction)=>{(this.liveVehicle(handle) as {carTraction?:number}).carTraction=traction;},
   // POINT_CAMERA_AT_CAR and POINT_CAMERA_AT_CHAR: CCamera::TakeControl on the entity for the script (2).
   pointCameraAtVehicle:(handle,mode,switchType)=>{if(handle!==PLAYER_VEHICLE_HANDLE)this.liveVehicle(handle);this.runtime.game.camera.takeControl({kind:'vehicle',handle},mode,switchType,2);},
   pointCameraAtPed:(handle,_isPlayer,mode,switchType)=>{if(handle!==PLAYER_PED_HANDLE)this.livePed(handle);this.runtime.game.camera.takeControl({kind:'ped',handle},mode,switchType,2);},
   // SET_CAR_STRAIGHT_LINE_DISTANCE: CAutoPilot::m_nStraightLineDistance, which FindSwitchDistanceClose reads.
   setVehicleStraightLineDistance:(handle,distance)=>{this.host('setScriptVehicleStraightLineDistance','SET_CAR_STRAIGHT_LINE_DISTANCE')(this.liveVehicle(handle),distance);},
   // IS_CAR_UPSIDEDOWN's handler is unreversed; CVehicle::IsUpsideDown (0x6D1D90) is the car's up axis at or below -0.9.
   vehicleIsUpsideDown:handle=>(handle===PLAYER_VEHICLE_HANDLE?this.playerPose(handle):this.world.scriptVehicleMatrix(this.liveVehicle(handle))).up.z<=-.9,
   // GET_DRIVER_OF_CAR: m_pDriver's handle, or -1 with nobody driving. The player drives the car it is in.
   vehicleDriver:handle=>handle===PLAYER_VEHICLE_HANDLE?(this.world.playerPed().vehicle?PLAYER_PED_HANDLE:-1):this.playerCarHandle()===handle?PLAYER_PED_HANDLE:this.peds.driverOf(handle)??-1,
   // ADD_ARMOUR_TO_CHAR: m_fArmour plus the amount, up to CPlayerInfo::m_nMaxArmour for the player and 100 for anyone
   // else (the handler is unreversed; the armour pickup caps the player the same way). Script peds keep the figure,
   // which the browser's ped damage does not yet spend.
   addArmourToPed:(handle,amount)=>{
    if(handle===PLAYER_PED_HANDLE){
     if(!this.world.playerArmour||!this.world.setPlayerArmour)throw new UnsupportedScmCommand(-1,0,'ADD_ARMOUR_TO_CHAR','no host');
     this.world.setPlayerArmour(Math.min(Math.max(this.world.playerArmour()+amount,0),this.runtime.game.playerInfo.maxArmour));
    }else this.peds.setArmour(handle,Math.min(Math.max(this.peds.armourOf(handle)+amount,0),100));
   },
   // RANDOM_PASSENGER_SAY: a passenger's speech line (CAEPedSpeechAudioEntity); the speech banks are not published.
   randomPassengerSay:()=>{},
   getWheelieStats:()=>({twoWheelsTime:0,twoWheelsDistance:0,wheelieTime:0,wheelieDistance:0,stoppieTime:0,stoppieDistance:0}),
   isPlayerPerformingWheelie:()=>false,isPlayerPerformingStoppie:()=>false,
   vehicleModelIs:(handle,model)=>(handle===PLAYER_VEHICLE_HANDLE?this.playerVehicle(handle).model:this.vehicles.modelOf(handle))===model,
   vehicleHealth:handle=>this.world.scriptVehicleHealth(this.liveVehicle(handle)),
   setVehicleHealth:(handle,health)=>{this.world.setScriptVehicleHealth(this.liveVehicle(handle),health);},
   vehicleSpeed:handle=>this.world.scriptVehicleSpeed(this.liveVehicle(handle)),
   // IS_CAR_IN_WATER (unreversed): the car's in-water flag, as Vice City's handler reads bIsInWater.
   vehicleIsInWater:handle=>{if(!this.world.scriptVehicleInWater)throw new UnsupportedScmCommand(-1,0,'IS_CAR_IN_WATER','no host');return this.world.scriptVehicleInWater(this.liveVehicle(handle));},
   vehicleIsStopped:handle=>this.world.scriptVehicleStopped(this.liveVehicle(handle)),
   vehicleIsOnFire:handle=>this.world.scriptVehicleOnFire(this.liveVehicle(handle)),
   vehicleIsOnScreen:handle=>this.world.scriptVehicleOnScreen(this.liveVehicle(handle)),
   explodeVehicle:handle=>{this.world.explodeScriptVehicle(this.liveVehicle(handle));},
   fixCar:handle=>{this.world.fixScriptVehicle(this.liveVehicle(handle));},
   setVehicleVisible:(handle,state)=>{this.world.setScriptVehicleVisible(this.liveVehicle(handle),state);},
   setVehicleAreaVisible:(handle,area)=>{this.host('setScriptVehicleArea','SET_VEHICLE_AREA_VISIBLE')(this.liveVehicle(handle),area);},
   setVehicleProofs:(handle,proofs)=>{this.world.setScriptVehicleProofs(this.liveVehicle(handle),proofs);},
   setVehicleCanBeDamaged:(handle,canBeDamaged)=>{this.world.setScriptVehicleCanBeDamaged(this.liveVehicle(handle),canBeDamaged);},
   // CVehicle::m_nDoorLock: the script's lock states above unlocked all refuse entry, which is all the browser
   // keeps of the field.
   setVehicleDoorLock:(handle,lock)=>{this.world.setScriptVehicleDoorLock(this.liveVehicle(handle),lock!==0);},
   // SWITCH_CAR_SIREN and SET_CAR_CAN_BE_VISIBLY_DAMAGED set the flags on the car; SET_TIME_SCALE sets
   // CTimer::ms_fTimeScale, the one the speed cheats and the stunt slow motion also write.
   switchVehicleSiren:(handle,on)=>{this.host('setScriptVehicleSiren','SWITCH_CAR_SIREN')(this.liveVehicle(handle),on);},
   setVehicleCanBeVisiblyDamaged:(handle,state)=>{this.host('setScriptVehicleCanBeVisiblyDamaged','SET_CAR_CAN_BE_VISIBLY_DAMAGED')(this.liveVehicle(handle),state);},
   setTimeScale:scale=>{this.host('setTimeScale','SET_TIME_SCALE')(scale);},
   // OPEN_CAR_DOOR swings the door fully open and OPEN_CAR_DOOR_A_BIT to a ratio, through CAutomobile::OpenDoor with
   // no ped and the sound on. The index is eDoors: bonnet, boot, then the front and rear doors left and right.
   // DOES_CAR_HAVE_HYDRAULICS reads handlingFlags.bHydraulicInst; SET_CAR_HYDRAULICS fits or removes the upgrade.
   vehicleHasHydraulics:handle=>this.host('scriptVehicleHasHydraulics','DOES_CAR_HAVE_HYDRAULICS')(this.liveVehicle(handle)),
   setVehicleHydraulics:(handle,state)=>{this.host('setScriptVehicleHydraulics','SET_CAR_HYDRAULICS')(this.liveVehicle(handle),state);},
   // IS_CAR_LOW_RIDER: handlingFlags.bLowRider (0x2000000).
   isCarLowRider:handle=>(this.host('scriptVehicleHandlingFlags','IS_CAR_LOW_RIDER')(this.liveVehicle(handle))&HANDLING_LOW_RIDER)!==0,
   // SET_VEHICLE_DIRT_LEVEL: m_fDirtLevel, which the dirt texture blend reads (0 to 15).
   setVehicleDirtLevel:(handle,level)=>{this.host('setScriptVehicleDirtLevel','SET_VEHICLE_DIRT_LEVEL')(this.liveVehicle(handle),Math.max(0,Math.min(15,level)));},
   // IS_CHAR_IN_TAXI: the model of the car the ped is in (the player's own included), nothing on foot.
   pedVehicleModelId:handle=>{
    const vehicle=handle===PLAYER_PED_HANDLE?this.playerCarHandle():this.peds.rideOf(handle)?.vehicle;
    if(vehicle===undefined)return undefined;
    const model=vehicle===PLAYER_VEHICLE_HANDLE?this.playerVehicle(vehicle).model:this.vehicles.modelOf(vehicle);
    return typeof model==='number'?model:undefined;
   },
   playerIsUsingJetpack:()=>this.host('playerUsingJetpack','IS_PLAYER_USING_JETPACK')(),
   // CGameLogic::bPenaltyForDeathApplies and bPenaltyForArrestApplies.
   switchDeathPenalties:state=>{this.host('setDeathPenalties','SWITCH_DEATH_PENALTIES')(state);},
   switchArrestPenalties:state=>{this.host('setArrestPenalties','SWITCH_ARREST_PENALTIES')(state);},
   openVehicleDoor:(handle,door)=>{if(door>=0&&door<6)this.host('openScriptVehicleDoor','OPEN_CAR_DOOR')(this.liveVehicle(handle),door,1);},
   openVehicleDoorABit:(handle,door,ratio)=>{if(door>=0&&door<6)this.host('openScriptVehicleDoor','OPEN_CAR_DOOR_A_BIT')(this.liveVehicle(handle),door,ratio);},
   // SET_CHAR_COLLISION (0x619, CharacterCommands SetCharCollision): CEntity::SetUsesCollision.
   setPedCollision:(handle,uses)=>{
    if(handle===PLAYER_PED_HANDLE)this.host('setPlayerCollision','SET_CHAR_COLLISION')(uses);
    else this.host('setScriptPedCollision','SET_CHAR_COLLISION')(this.livePed(handle),uses);
   },
   vehicleExistsByHandle:handle=>handle===PLAYER_VEHICLE_HANDLE?!!this.world.playerPed().vehicle:this.vehicles.exists(handle),
   playerCity:()=>this.world.playerCity(),
   loadMissionText:name=>{this.missionText=name;this.world.loadMissionText(name);},
   buildPlayerModel:()=>{this.playerModelsBuilt++;this.world.buildPlayerModel();},
   stopAllLawEnforcers:()=>{this.world.stopAllLawEnforcers();},
   makePlayerSafe:(_player,safe,radius)=>{this.world.makePlayerSafe(safe,radius);},
   setAllVehiclesCanBeDamaged:state=>{this.world.setAllVehiclesCanBeDamaged?.(state);},
   switchPoliceHelis:state=>{this.world.switchPoliceHelis?.(state);},
   setScriptLimitToGangSize:size=>{this.world.setScriptLimitToGangSize?.(size);},
   setGangWarsActive:state=>{this.world.setGangWarsActive?.(state);},
   syncWater:()=>{this.world.syncWater?.();},
   // Only the player's group follows the browser's own rules; the script's other groups keep the range in their record.
   setGroupSeparationRange:(group,range)=>{this.group(group).separationRange=range;if(group===PLAYER_GROUP_HANDLE)this.world.setPlayerGroupSeparationRange?.(range);},
   // CREATE_SCRIPT_ROADBLOCK's handler is unreversed; the port reads its type as RegisterScriptRoadBlock's gang flag.
   createScriptRoadblock:(ax,ay,az,bx,by,bz,type)=>{this.world.registerScriptRoadblock?.({x:ax,y:ay,z:az},{x:bx,y:by,z:bz},type!==0);},
   clearAllScriptRoadblocks:()=>{this.world.clearScriptRoadblocks?.();},
   setPlayerMaxHealth:(_player,maxHealth)=>{this.world.setPlayerMaxHealth(maxHealth);},
   setPlayerMaxArmour:(_player,maxArmour)=>{this.world.setPlayerMaxArmour(maxArmour);},
   setVisibilityOfClosestObjectOfType:(x,y,z,radius,m,visible)=>{this.objectVisibilities++;this.world.setVisibilityOfClosestObjectOfType(x,y,z,radius,m,visible);},
   setClosestEntryExitFlag:(x,y,radius,flag,on)=>{this.entryExitFlags++;this.world.setClosestEntryExitFlag(x,y,radius,flag,on);},
   switchEntryExit:(name,on)=>{this.entryExitFlags++;this.world.switchEntryExit(name,on);},
   enableBurglaryHouses:on=>{this.world.enableBurglaryHouses(on);},
   disableAllEntryExits:disabled=>{this.world.disableAllEntryExits(disabled);},
   isPlayerRestarting:()=>false,
   isPlayerPlaying:()=>true,
   isPlayerDead:()=>false,
   clearSmallMessages:()=>{},
   isDrawingMap:()=>false,
  };
  // Script handles start clear of the player's own, which is 1 for him and for the car he drives.
  this.peds=new ScmPedPool<unknown>({
   spawn:(pedType,model,position)=>this.world.spawnScriptPed(pedType,model,position),
   spawnInCar:(pedType,model,vehicle,seat)=>this.world.spawnScriptPedInCar(pedType,model,this.vehicles.entity(vehicle),seat),
   spawnRandomInCar:(vehicle,seat)=>this.world.spawnScriptRandomPedInCar(this.vehicles.entity(vehicle),seat),
   spawnOnCar:(pedType,model,vehicle,offset)=>this.world.spawnScriptPedOnCar(pedType,model,this.vehicles.entity(vehicle),offset),
   place:(ped,position)=>{this.world.placeScriptPed(ped,position);},
   setHeading:(ped,degrees)=>{this.world.setScriptPedHeading(ped,degrees);},
   positionOf:ped=>this.world.scriptPedPosition(ped),
   headingOf:ped=>this.world.scriptPedHeading(ped),
   healthOf:ped=>this.world.scriptPedHealth(ped),
   setHealth:(ped,health)=>{this.world.setScriptPedHealth(ped,health);},
   kill:ped=>{this.world.killScriptPed(ped);},
   setAccuracy:(ped,accuracy)=>{this.world.setScriptPedAccuracy(ped,accuracy);},
   setShootingRate:(ped,rate)=>{this.world.setScriptPedShootingRate?.(ped,rate);},
   setInvulnerable:(ped,enabled)=>{this.world.setScriptPedInvulnerable(ped,enabled);},
   setAnimGroup:(ped,group)=>this.world.setScriptPedAnimGroup?.(ped,group)??false,
   setProofs:(ped,proofs)=>{this.world.setScriptPedProofs(ped,proofs);},
   aliveOf:ped=>this.world.scriptPedAlive(ped),
   remove:ped=>{this.world.removeScriptPed(ped);},
   release:(ped,keepTask)=>{this.world.releaseScriptPed(ped,keepTask);},
  },SCRIPT_PED_FIRST_HANDLE);
  this.vehicles=new ScmVehiclePool<unknown>({
   spawn:(model,position,heading)=>this.world.spawnScriptVehicle(model,position,heading),
   place:(car,position,heading)=>{this.world.placeScriptVehicle(car,position,heading);},
   positionOf:car=>this.world.scriptVehiclePosition(car),
   headingOf:car=>this.world.scriptVehicleHeading(car),
   aliveOf:car=>this.world.scriptVehicleAlive(car),
   remove:car=>{this.world.removeScriptVehicle(car);},
  },SCRIPT_VEHICLE_FIRST_HANDLE);
  const {runtime,header}=ScmRuntime.load(script,adapter,this.random);
  this.runtime=runtime;
  // CShopping's reach outside the script: the model table, the level's price and the player's weapons and armour.
  runtime.game.shopping.host={
   modelIndex:name=>this.world.modelIndex?.(name)??-1,
   level:()=>this.world.playerCity(),
   giveWeapon:(type,ammo)=>{this.world.givePlayerWeapon?.(type,ammo);},
   setCurrentWeapon:type=>{this.world.setPlayerCurrentWeapon?.(type);},
   setArmour:armour=>{this.world.setPlayerArmour?.(armour);},
  };
  // A thread that meets an unported command gives up; the others, MAIN among them, keep running.
  this.runtime.onUnsupported=(error,thread)=>{
   // An adapter that cannot answer (offset -1) names what it lacked; the command is the one the thread was running.
   const at=thread.currentInstruction;
   this.gaveUp.push(error.offset<0?{thread:thread.name,command:at.name,offset:at.offset,detail:error.command}:{thread:thread.name,command:error.command,offset:error.offset});
  };
  this.runtime.onThreadError=(error,thread)=>{const at=thread.currentInstruction;this.gaveUp.push({thread:thread.name,command:at.name,offset:at.offset,detail:String(error)});};
  this.runtime.game.zones.load(zones.infoLabels);
  this.entry=header.entry;
 }
 /** The browser answers for the player's ped alone; a handle it does not hold retires that thread, which the
  * snapshot reports with no instruction offset, since it is the world rather than the command that is short. */
 /** The browser's ped behind a script handle, for the questions only a built ped can answer. A handle whose ped
  * is still being loaded, or never arrived, gives the thread up rather than being answered with a guess. */
 /** The browser's car behind a script handle, for the questions only a built car can answer. */
 /** The pose of the vehicle the player rides, of whatever kind. */
 private playerPose(handle:number){
  const pose=this.world.playerVehiclePose?.();
  if(!pose)throw new UnsupportedScmCommand(-1,0,'A_VEHICLE_THE_BROWSER_DOES_NOT_HOLD',`vehicle ${handle}`);
  return pose;
 }
 /** Whether a script car is still enough to step out of; one the browser does not hold, or a host that cannot tell, is. */
 private vehicleStill(vehicle:number){const car=this.vehicles.entity(vehicle);return car===undefined||(this.world.scriptVehicleStill?.(car)??true);}
 /** CTaskComplexLeaveCar (and LeaveAnyCar, and the Immediately form) for a script ped riding a script car: it is set
  * down at its seat's door, on foot. The get-out clips are not played. A ped on foot, or in another car than the one
  * named, has nothing to do and the task is over at once. */
 /** The ped out of its car at its seat's door, rebuilt on foot; false when it rides no car (or not the one named). */
 private leaveCarNow(handle:number,vehicle:number|undefined,opcode:number){
  const ride=this.peds.rideOf(handle);
  if(!ride||ride.offset||vehicle!==undefined&&vehicle!==ride.vehicle)return false;
  const car=this.liveVehicle(ride.vehicle);
  const at=this.host('scriptVehicleSeatDoor','TASK_LEAVE_CAR')(car,ride.seat);
  if(!at)throw new UnsupportedScmCommand(opcode,0,'A_SEAT_WITHOUT_A_DOOR',String(ride.seat));
  this.stopDriving(handle);
  this.peds.detachFromCar(handle,at);
  return true;
 }
 /** A driving task on the car the ped is at the wheel of: CCarAI's mission, a temporary action, or the wander. */
 private startCarTask(handle:number,task:ScmScriptedTask,opcode:number){
  switch(task.kind){
   // CTaskComplexDriveToPoint: CCarAI::GetCarToGoToCoors (mode 0), …Accurate (1) or …StraightLine (2) with the task's
   // cruise speed and driving style; the racing mode (3) drives as the plain one. It is over once the mission clears.
   case 'carDriveToCoord':{
    const car=this.driverCar(handle,task.vehicle,opcode);
    this.host('driveScriptVehicleTo','TASK_CAR_DRIVE_TO_COORD')(car,{x:task.x,y:task.y,z:task.z},
     {cruise:task.speed,style:task.drivingStyle,accurate:task.driveStyle===1,straight:task.driveStyle===2});
    return;
   }
   case 'carTempAction':this.host('scriptVehicleTempAction','TASK_CAR_TEMP_ACTION')(this.driverCar(handle,task.vehicle,opcode),task.actionId,task.time/1000);return;
   case 'carDriveWander':this.host('scriptVehicleWander','TASK_CAR_DRIVE_WANDER')(this.driverCar(handle,task.vehicle,opcode),{cruise:task.speed,style:task.drivingMode});return;
   case 'carMission':{
    const car=this.driverCar(handle,task.vehicle,opcode);
    // -1 names no car: the player's missions (ram, block) go after him.
    const target=task.targetVehicle===-1?undefined:this.liveVehicle(task.targetVehicle);
    if(!this.host('scriptVehicleCarMission','TASK_CAR_MISSION')(car,{mission:task.missionId,target,cruise:task.cruiseSpeed,style:task.drivingStyle}))
     throw new UnsupportedScmCommand(opcode,0,'A_CAR_MISSION_THE_BROWSER_DOES_NOT_DRIVE',`mission ${task.missionId}`);
    return;
   }
   default:throw new UnsupportedScmCommand(opcode,0,'A_TASK_THE_BROWSER_DOES_NOT_RUN',task.kind);
  }
 }
 /** CTaskComplexSequence run from here, a task at a time, for the sequences the on-foot peds cannot carry alone: one
  * with a car task in it, or one given to a ped in a car (and a single task given to a ped in a car, which is a
  * sequence of one that reads no progress). `progress` is m_CurrentTaskIndex. */
 private readonly runners=new Map<number,{tasks:readonly ScmScriptedTask[];at:number;repeat:boolean;opcode:number;sequence:boolean;progress:number;step?:RunnerStep}>();
 private runSequence(handle:number,tasks:readonly ScmScriptedTask[],repeat:boolean,opcode:number,sequence:boolean){
  this.runners.set(handle,{tasks:tasks.slice(0,8),at:0,repeat,opcode,sequence,progress:0});
  this.recordTask(handle,opcode,false);
  this.advanceRunner(handle);
 }
 /** The sequence's next task, past the ones that are over as soon as they start; eight of those at most. */
 private advanceRunner(handle:number){
  for(let n=0;n<=8;n++){
   const r=this.runners.get(handle);if(!r)return;
   if(r.at>=r.tasks.length){if(!r.repeat){this.runners.delete(handle);return;}r.at=0;}
   r.progress=r.at;
   const task=r.tasks[r.at++];
   const step=this.dispatch(handle,task,r.opcode);
   if(step){r.step=step;return;}
  }
  this.runners.delete(handle);
 }
 /** One task of a runner's sequence begun on the ped as it is now, or nothing when it is over at once:
  * - A car task runs on the car the ped drives. On foot, the ped gets in at the wheel first, as
  *   CTaskComplexCarDrive::CreateFirstSubTask does.
  * - A leave-car task sets the ped down at its door.
  * - An on-foot task leaves the car first. A pause or a stand-still is waited out in the seat, and the head-look and
  *   flag tasks, which have nothing to act on in a seat, are over at once. */
 private dispatch(handle:number,task:ScmScriptedTask,opcode:number):RunnerStep|undefined{
  const entity=this.peds.entity(handle);
  if(entity===undefined)return {kind:'settle',then:task};
  const ride=this.peds.rideOf(handle),riding=!!ride&&!ride.offset;
  switch(task.kind){
   case 'leaveCar':case 'leaveCarImmediately':case 'leaveAnyCar':{
    const vehicle=task.kind==='leaveAnyCar'?undefined:task.vehicle;
    if(!riding||vehicle!==undefined&&vehicle!==ride.vehicle)return undefined;
    // CTaskSimpleCarWaitToSlowDown first (not for the Immediately form): a script driver stops its car's mission,
    // and the ped waits in its seat until the car is still enough to step out of.
    if(task.kind!=='leaveCarImmediately'&&!this.vehicleStill(ride.vehicle)){this.stopDriving(handle);return {kind:'slowing',then:task};}
    return this.leaveCarNow(handle,vehicle,opcode)?{kind:'settle'}:undefined;
   }
   case 'carDriveToCoord':case 'carTempAction':case 'carDriveWander':case 'carMission':{
    if(riding&&ride.seat==='driver'&&ride.vehicle===task.vehicle){this.startCarTask(handle,task,opcode);return {kind:'held'};}
    if(riding||!this.vehicles.entity(task.vehicle))return undefined;
    this.world.giveScriptPedOrder(entity,{kind:'enterCar',vehicle:task.vehicle,seat:'driver',seconds:Number.POSITIVE_INFINITY});
    return {kind:'board',vehicle:task.vehicle,then:task};
   }
  }
  const order=scriptedPedOrder(task,this.taskWorld(handle));
  if(!order)return undefined;
  if(riding){
   if(order.kind==='standStill')return {kind:'wait',remaining:order.seconds};
   if(IN_SEAT_OVER_AT_ONCE.has(order.kind))return undefined;
   return this.leaveCarNow(handle,undefined,opcode)?{kind:'settle',then:task}:undefined;
  }
  this.world.giveScriptPedOrder(entity,order);
  return {kind:'held'};
 }
 /** Each runner's task, a frame on: over when the ped no longer holds it, its wait is out, or the ped it waits for is
  * built. A task the browser cannot begin ends the runner, and the thread is told nothing (it has moved on). */
 private processRunners(dt:number){
  for(const [handle,r] of this.runners){
   if(!this.peds.exists(handle)){this.runners.delete(handle);continue;}
   try{
    const step=r.step,entity=this.peds.entity(handle);
    if(!step){this.advanceRunner(handle);continue;}
    switch(step.kind){
     case 'wait':step.remaining-=dt;if(step.remaining<=0)this.advanceRunner(handle);break;
     case 'slowing':{
      const ride=this.peds.rideOf(handle);
      if(!ride||ride.offset||!this.vehicles.exists(ride.vehicle))this.advanceRunner(handle);
      else if(this.vehicleStill(ride.vehicle)){const next=this.dispatch(handle,step.then,r.opcode);if(next)r.step=next;else this.advanceRunner(handle);}
      break;
     }
     case 'settle':
      if(entity===undefined)break;
      if(step.then){const next=this.dispatch(handle,step.then,r.opcode);if(next)r.step=next;else this.advanceRunner(handle);}
      else this.advanceRunner(handle);
      break;
     case 'board':{
      const ride=this.peds.rideOf(handle);
      if(ride&&!ride.offset&&ride.vehicle===step.vehicle&&ride.seat==='driver'){
       if(entity!==undefined){const next=this.dispatch(handle,step.then,r.opcode);if(next)r.step=next;else this.advanceRunner(handle);}
      }else if(entity!==undefined&&!ride&&!this.world.scriptPedHasOrder?.(entity))this.advanceRunner(handle);
      break;
     }
     case 'held':if(entity!==undefined&&this.world.scriptPedHasOrder&&!this.world.scriptPedHasOrder(entity))this.advanceRunner(handle);break;
    }
   }catch(error){
    if(!(error instanceof UnsupportedScmCommand))throw error;
    this.runners.delete(handle);
    this.gaveUp.push({thread:'(sequence)',command:error.command,offset:error.offset,detail:error.message});
   }
  }
 }
 /** A script driver's car stops its CCarAI mission when the driver's task goes. */
 private stopDriving(handle:number){
  const ride=this.peds.rideOf(handle);if(!ride||ride.offset||ride.seat!=='driver')return;
  const car=this.vehicles.entity(ride.vehicle);if(car)this.world.stopScriptVehicle?.(car);
 }
 /** The script car a driving task names, which the ped must already be at the wheel of. */
 private driverCar(handle:number,vehicle:number,opcode:number){
  this.livePed(handle);
  const ride=this.peds.rideOf(handle);
  if(!ride||ride.offset||ride.seat!=='driver'||ride.vehicle!==vehicle)throw new UnsupportedScmCommand(opcode,0,'A_DRIVER_NOT_AT_THE_WHEEL',`ped ${handle}`);
  return this.liveVehicle(vehicle);
 }
 /** The player's ped runs only the tasks PlayerScriptTasks knows; any other gives the thread up. */
 private givePlayer(orders:readonly ScriptedPedOrder[],repeat:boolean,opcode:number,sequence=false){
  const other=orders.find(order=>!PlayerScriptTasks.runs(order));
  if(other)throw new UnsupportedScmCommand(opcode,0,'A_PLAYER_TASK_THE_BROWSER_DOES_NOT_RUN',other.kind);
  this.host('givePlayerOrders','A_PLAYER_TASK')(orders,repeat,sequence);
  this.recordTask(PLAYER_PED_HANDLE,opcode,false);
 }
 private clearTasks(handle:number,command:string){
  if(handle===PLAYER_PED_HANDLE)this.host('clearPlayerTasks',command)();
  else{this.runners.delete(handle);this.stopDriving(handle);this.world.clearScriptPedTasks(this.livePed(handle));}
  this.taskRecords.delete(handle);
 }
 /** CRunningScript::SetCharCoordinates on the player: CWorld::PutToGroundIfTooLow first (a z at or below
  * MAP_Z_LOW_LIMIT is the ground there). The group teleport that warpGang asks for is not modelled. */
 private teleportPlayer(x:number,y:number,z:number,command:string){
  const ground=z<=-100?this.world.groundLevel(x,y,z):undefined;
  if(!this.host('teleportPlayer',command)({x,y,z:ground??z}))throw new UnsupportedScmCommand(-1,0,command,'a player on a bike, boat or plane');
 }
 /** The handle for the vehicle the player is in: the script's own handle when it is a car the script made (so
  * IS_CHAR_IN_CAR against that car holds), PLAYER_VEHICLE_HANDLE for any other, nothing on foot. */
 private playerCarHandle(){
  if(!this.world.playerPed().vehicle)return undefined;
  const entity=this.world.playerVehicleEntity?.();
  return (entity!==undefined?this.vehicles.handleOf(entity):undefined)??PLAYER_VEHICLE_HANDLE;
 }
 /** CPlayerData::m_bGroupAlwaysFollow (SET_PLAYER_GROUP_TO_FOLLOW_ALWAYS). */
 playerGroupAlwaysFollows=false;
 /** What a car handle names: the player's own car for PLAYER_VEHICLE_HANDLE, a script car the browser built, or nothing. */
 vehicleByHandle(handle:number):unknown{return handle===PLAYER_VEHICLE_HANDLE?this.world.playerVehicleEntity?.():this.vehicles.entity(handle);}
 /** What a ped handle names: the player, the browser's ped behind a live script handle, or nothing. */
 pedByHandle(handle:number):unknown{return handle===PLAYER_PED_HANDLE?'player':this.peds.exists(handle)?this.peds.entity(handle):undefined;}
 /** Where the peds a task names stand: the ped itself, a script ped, or the player (whose handle is no pool ped). */
 private taskWorld(handle:number){
  return {
   self:()=>handle===PLAYER_PED_HANDLE?{...this.world.playerPed().position}:this.peds.positionOf(handle),
   ped:(other:number)=>other===PLAYER_PED_HANDLE?{...this.world.playerPed().position}:this.peds.exists(other)?this.peds.positionOf(other):undefined,
   decisionMaker:(dm:number)=>this.runtime.game.decisionMakers.actualIndex(dm),
   // A car the script made and the browser has built; the player's own car is not one a script ped can board yet.
   vehicle:(vehicle:number)=>vehicle!==PLAYER_VEHICLE_HANDLE&&this.vehicles.exists(vehicle)&&!!this.vehicles.entity(vehicle),
  };
 }
 /** An optional host method, or the command gives up on a host that has none. */
 private host<K extends keyof ScmMissionWorld>(name:K,command:string):NonNullable<ScmMissionWorld[K]>{
  const method=this.world[name];
  if(typeof method!=='function')throw new UnsupportedScmCommand(-1,0,command,'no host');
  return (method as (...args:never[])=>unknown).bind(this.world) as NonNullable<ScmMissionWorld[K]>;
 }
 private liveVehicle(handle:number){
  // The player's own car is not one the script made: the host hands it over while the player drives it.
  const car=handle===PLAYER_VEHICLE_HANDLE?this.world.playerVehicleEntity?.():this.vehicles.entity(handle);
  if(!car&&handle!==PLAYER_VEHICLE_HANDLE&&this.vehicles.exists(handle)&&!this.vehicles.settledFor(handle))throw new ScmEntityPending(`vehicle ${handle}`);
  if(!car)throw new UnsupportedScmCommand(-1,0,'A_VEHICLE_THE_BROWSER_DOES_NOT_HOLD',`vehicle ${handle}`);
  return car;
 }
 /** FindNthNodeClosestToCoors over the loaded car nodes, then FindNodeCoorsForScript and
  * FindNodeOrientationForCarPlacement for the node found. */
 private scriptCarNode(point:{x:number;y:number;z:number},nth:number,ignoreDisabled:boolean){
  const areas=this.world.carPathAreas?.();if(!areas)return undefined;
  const node=findNthNodeClosestToCoors(areas,point,nth,{kind:'vehicle',maxDistance:999999.9,ignoreDisabled});
  return node&&{...findNodeCoorsForScript(areas,node),heading:findNodeOrientationForCarPlacement(areas,node)};
 }
 /** Where a ped that rides in a car is, which is where the car is. */
 private ridingIn(handle:number){
  const ride=this.peds.rideOf(handle);
  return ride&&this.vehicles.exists(ride.vehicle)?this.vehicles.positionOf(ride.vehicle):undefined;
 }
 /** The group a command names, made on demand so a script that sets a group it never created still works the
  * way CPedGroups' own array does, where every slot is a group already. */
 private group(handle:number){
  let group=this.groups.get(handle);
  if(!group){group=new NativePedGroup();this.groups.set(handle,group);}
  return group;
 }
 /** The rows a script has written for one decision maker, by the slot its handle names. */
 private decisionsFor(decisionMaker:number){
  const slot=ScmDecisionMakers.indexOf(decisionMaker);
  let rows=this.scriptDecisions.get(slot);
  if(!rows){rows=new Map();this.scriptDecisions.set(slot,rows);}
  return rows;
 }
 private addDecision(decisionMaker:number,event:number,taskId:number,
  chances:{respect:number;hate:number;like:number;dislike:number},inCar:boolean,onFoot:boolean){
  const rows=this.decisionsFor(decisionMaker);
  let choices=rows.get(event);
  if(!choices){choices=[];rows.set(event,choices);}
  // A row holds six; the seventh has nowhere to go, as the file's own row would have none.
  if(choices.length>=MAX_DECISION_CHOICES)return;
  choices.push({task:taskId,chances:[chances.respect,chances.hate,chances.like,chances.dislike],
   inVehicle:inCar,onFoot});
 }
 /* An attached object goes where the thing it hangs from goes. CEntity keeps the offset in the host's own
  * axes, so the world point is the host's position plus its right, forward and up scaled by the offset; a car
  * gives all three through its matrix, and a ped, which only turns about the up axis, gives them from its
  * heading. A host that has gone leaves the object where it last was rather than dragging it to nowhere. */
 private followAttachments(){
  for(const object of this.runtime.game.objects.all){
   const attached=object.attachedTo;if(!attached)continue;
   const frame=this.attachmentFrame(attached);if(!frame)continue;
   const {offset}=attached;
   object.position={
    x:frame.position.x+frame.right.x*offset.x+frame.forward.x*offset.y+frame.up.x*offset.z,
    y:frame.position.y+frame.right.y*offset.x+frame.forward.y*offset.y+frame.up.y*offset.z,
    z:frame.position.z+frame.right.z*offset.x+frame.forward.z*offset.y+frame.up.z*offset.z,
   };
   object.heading=frame.heading+attached.rotation.z;
   object.rotation={x:attached.rotation.x,y:attached.rotation.y,z:0};
  }
  // FxSystem_c::SetMatrix for the systems that hang from something, which is what keeps them with it.
  for(const record of this.scriptFx.values()){
   if(!record.attached)continue;
   const matrix=this.fxMatrixFor(record.attached);
   if(matrix)this.world.setScriptFxMatrix(record.system,matrix);
  }
 }
 /** Where the thing an object hangs from is, and which way its own axes point. */
 private attachmentFrame(attached:{kind:'vehicle'|'ped'|'object';handle:number}){
  if(attached.kind==='vehicle'){
   if(!this.vehicles.exists(attached.handle))return undefined;
   const car=this.vehicles.entity(attached.handle);if(!car)return undefined;
   const matrix=this.world.scriptVehicleMatrix(car);
   return {...matrix,heading:this.vehicles.headingOf(attached.handle)*Math.PI/180};
  }
  if(attached.kind==='object'){
   const host=this.runtime.game.objects.exists(attached.handle)?this.runtime.game.objects.at(attached.handle):undefined;
   if(!host)return undefined;
   return {...headingFrame(host.heading),position:host.position,heading:host.heading};
  }
  if(!this.peds.exists(attached.handle))return undefined;
  const position=this.peds.positionOf(attached.handle),heading=this.peds.headingOf(attached.handle)*Math.PI/180;
  return {...headingFrame(heading),position,heading};
 }
 /** The host's system behind an FX handle; a handle naming none gives the thread up rather than doing nothing. */
 private fxOf(handle:number){
  const record=this.scriptFx.get(handle);
  if(!record)throw new UnsupportedScmCommand(-1,0,'AN_FX_SYSTEM_THE_BROWSER_DOES_NOT_HOLD',`fx ${handle}`);
  return record.system;
 }
 /** A system at a point in the script's own coordinates, facing the way the world does. */
 private makeFx(name:string,position:{x:number;y:number;z:number},ignoreBoundingChecks:boolean){
  const handle=this.nextFx++;
  const system=this.world.createScriptFx(name,fxMatrix(headingFrame(0),position),ignoreBoundingChecks,false);
  if(system!==undefined)this.scriptFx.set(handle,{system});
  return handle;
 }
 /** A system that hangs from a car, a ped or an object, given that entity's matrix again each step. */
 private makeAttachedFx(name:string,kind:'vehicle'|'ped'|'object',host:number,offset:{x:number;y:number;z:number},
  direction:{x:number;y:number;z:number}|undefined,ignoreBoundingChecks:boolean){
  const handle=this.nextFx++;
  const attached={kind,handle:host,offset:{...offset},direction:direction&&{...direction}};
  const matrix=this.fxMatrixFor(attached)??fxMatrix(headingFrame(0),offset);
  const system=this.world.createScriptFx(name,matrix,ignoreBoundingChecks,true);
  if(system!==undefined)this.scriptFx.set(handle,{system,attached});
  return handle;
 }
 /** Where an attached system sits and which way it points, in the script's own coordinates. */
 private fxMatrixFor(attached:{kind:'vehicle'|'ped'|'object';handle:number;offset:{x:number;y:number;z:number};direction?:{x:number;y:number;z:number}}){
  const frame=this.attachmentFrame(attached);if(!frame)return undefined;
  const {offset}=attached;
  const position={
   x:frame.position.x+frame.right.x*offset.x+frame.forward.x*offset.y+frame.up.x*offset.z,
   y:frame.position.y+frame.right.y*offset.x+frame.forward.y*offset.y+frame.up.y*offset.z,
   z:frame.position.z+frame.right.z*offset.x+frame.forward.z*offset.y+frame.up.z*offset.z,
  };
  // A system given a direction points along it; one without keeps the entity's own facing.
  return fxMatrix(attached.direction?directionFrame(attached.direction):frame,position);
 }
 /** The flattened step of the sequence a ped runs, as the runner, the player or the ped itself counts it. */
 private flatSequenceProgress(handle:number){
  if(handle===PLAYER_PED_HANDLE)return this.world.playerSequenceProgress?.()??-1;
  const r=this.runners.get(handle);if(r)return r.sequence?r.progress:-1;
  const ped=this.peds.entity(handle);
  return ped===undefined?-1:this.world.scriptPedSequenceProgress?.(ped)??-1;
 }
 /** CTaskComplexSequence::m_CurrentTaskIndex, and the step of the CTaskComplexUseSequence it is on (-1 when that
  * step is a plain task). */
 private sequenceStep(handle:number){
  const flat=this.flatSequenceProgress(handle);
  if(flat<0)return {outer:-1,inner:-1};
  return this.sequenceSteps.get(handle)?.[flat]??{outer:flat,inner:-1};
 }
 /** Nested sequences (CTaskComplexUseSequence) are run inline: each is replaced by the tasks its sequence holds
  * when the outer one is given, and each flattened task remembers which step, and which step of the nested
  * sequence, it is. A nested sequence runs once through; one that repeats would never hand back to the outer one,
  * which is not followed. `steps` is undefined when nothing is nested. */
 private expandSequence(tasks:readonly ScmScriptedTask[]){
  if(!tasks.some(task=>task.kind==='useSequence'))return {tasks,steps:undefined};
  const flat:ScmScriptedTask[]=[],steps:{outer:number;inner:number}[]=[];
  const nested=(index:number,outer:number,inner:number|undefined,depth:number)=>{
   // A sequence that names itself, directly or not, is cut off rather than followed for ever.
   if(depth>4)return;
   this.runtime.game.sequences.at(index).tasks.forEach((task,step)=>{
    if(task.kind==='useSequence')nested(task.sequence,outer,inner??step,depth+1);
    else{flat.push(task);steps.push({outer,inner:inner??step});}
   });
  };
  tasks.forEach((task,outer)=>{
   if(task.kind==='useSequence')nested(task.sequence,outer,undefined,1);
   else{flat.push(task);steps.push({outer,inner:-1});}
  });
  return {tasks:flat,steps};
 }
 private livePed(handle:number){
  const ped=this.peds.entity(handle);
  // A ped still being built is waited for; one whose making failed, or a handle naming none, is not there to ask.
  if(!ped&&this.peds.exists(handle)&&!this.peds.settledFor(handle))throw new ScmEntityPending(`ped ${handle}`);
  if(!ped)throw new UnsupportedScmCommand(-1,0,'A_PED_THE_BROWSER_DOES_NOT_HOLD',`ped ${handle}`);
  return ped;
 }
 /** The vehicle the player is riding, which the commands that name his own car ask about. */
 private playerVehicle(handle:number){
  const vehicle=handle===PLAYER_VEHICLE_HANDLE?this.world.playerPed().vehicle:undefined;
  if(!vehicle)throw new UnsupportedScmCommand(-1,0,'A_VEHICLE_THE_BROWSER_DOES_NOT_HOLD',`vehicle ${handle}`);
  return vehicle;
 }
 /* The decision makers a script builds itself, by the slot its handle names. CDecisionMakerTypes' own tables
  * come from files this port does not publish; these are the rows the script writes at run time, which a host
  * can use for a ped wearing that maker whether or not the files are there.
  *
  * The four chances are written in the order the command gives them. The command's own parameter names and the
  * decision file's column names disagree — the schema calls them respect, hate, like and dislike, and the file
  * reader (after gtamods) calls the four columns friend, threat, player and neutral — and settling which
  * naming is right is not this port's to do. Either way they are the same four slots in the same order, so the
  * chances go into them in order and nothing here depends on what they are called. */
 readonly scriptDecisions=new Map<number,Map<number,DecisionChoice[]>>();
 /** The patrol route a script has built, a point and an animation at a time. */
 readonly patrolRoute:{position:{x:number;y:number;z:number};animationName:string;animationFile:string}[]=[];
 /* The particle systems a script makes. CREATE_FX_SYSTEM hands back a handle the script plays, stops and
  * kills; the ones made on a car, a ped or an object hang from it and are given its matrix again each step,
  * which is what FxSystem_c::SetMatrix is for. The systems themselves are the host's. */
 private readonly scriptFx=new Map<number,{system:unknown;attached?:{kind:'vehicle'|'ped'|'object';handle:number;offset:{x:number;y:number;z:number};direction?:{x:number;y:number;z:number}}}>();
 private nextFx=1;
  /* The blips the script has put on the radar, as the browser's own map draws them. CRadar keeps the table;
  * a coord blip carries its own point and an entity blip follows the thing it names, so the handle is looked
  * up in the pools the script made it from. A blip whose display does not include the radar, or whose entity
  * has gone, is not drawn — which is what CRadar::DisplayThisBlip and a stale handle come to. */
 radarBlips(){
  const blips:{x:number;z:number;sprite?:number;colour?:string;size?:number;dz?:number;shortRange?:boolean;fade?:boolean}[]=[];
  const player=this.world.playerPed().position;
  const hud=(i:number)=>{const [r,g,b]=HUD_COLOURS[i];return `rgb(${r},${g},${b})`;};
  for(const trace of this.runtime.game.radar.traces){
   if(trace.type===BLIP_NONE||!(trace.display&BLIP_DISPLAY_BLIPONLY))continue;
   const at=this.blipPosition(trace);if(!at)continue;
   const entity=trace.type===BLIP_CAR||trace.type===BLIP_CHAR||trace.type===BLIP_OBJECT;
   // tRadarTrace::GetStaticColour for the coord blips DrawCoordBlip draws: HUD blue for a THREAT appearance, red for
   // UNK, otherwise the trace colour taken as unfriendly. Entity blips (DrawEntityBlip, unreversed) keep the flag.
   const colour=entity?radarTraceColour(trace.colour,trace.bright,trace.friendly)
    :trace.appearance===BLIP_FLAG_THREAT?hud(HUD_COLOUR_BLUE):trace.appearance===BLIP_FLAG_UNK?hud(HUD_COLOUR_RED):radarTraceColour(trace.colour,trace.bright,false);
   blips.push({x:at.x,z:-at.y,sprite:trace.sprite||undefined,colour,size:trace.blipSize,dz:at.z-player.z,shortRange:trace.shortRange,fade:trace.fade});
  }
  return blips;
 }
 /** CTheScripts::IsPlayerOnAMission: the global DECLARE_MISSION_FLAG names is 1. The INTRO mission is the exception:
  * here it never gets past its car-recording wait (docs/FIDELITY_AUDIT.md "The intro that cannot finish"), so free roam
  * does not stay on a mission because of it, as with its zone names and weather. */
 playerOnAMission(){return this.runtime.playerOnAMission()&&!this.runtime.active.some(slot=>slot.thread.name.toUpperCase()==='INTRO');}
 /* CRadar::Draw3dMarkers (0x585BF0), which CHud::Draw runs while the HUD draws 3D markers and the screen is not
  * widescreen: every tracked blip shown as a marker places one. An entity's cone floats above it in the blip's colour
  * (a car's 2 above its box top raised a fifth, two thirds for the Nevada; a ped's 2.7 above it; an object's or
  * pickup's 1.8 above its top, or 1.6 indoors). A contact point off a mission is the red cylinder at its point. The
  * handle is the trace index with its counter in the high word. */
 radarMarkers(indoors:boolean){
  const out:{id:number;kind:'cone'|'cylinder';position:[number,number,number];size:number;colour:[number,number,number]}[]=[];
  const onMission=this.playerOnAMission();
  this.runtime.game.radar.traces.forEach((trace,i)=>{
   if(!trace.tracking)return;
   if(trace.display!==BLIP_DISPLAY_BOTH&&trace.display!==BLIP_DISPLAY_MARKERONLY)return;
   const id=(i|trace.counter<<16)>>>0,colour=radarTraceRgb(trace.colour,trace.bright,trace.friendly);
   const cone=(at:{x:number;y:number;z:number},lift:number,size:number)=>{out.push({id,kind:'cone',position:[at.x,at.y,at.z+lift],size,colour});};
   if(trace.type===BLIP_CAR){
    if(!this.vehicles.exists(trace.entityHandle))return;
    const car=this.vehicles.entity(trace.entityHandle),top=car===undefined?0:this.world.scriptVehicleBoxTop?.(car)??0;
    cone(this.vehicles.positionOf(trace.entityHandle),top*(this.vehicles.modelOf(trace.entityHandle)===MODEL_NEVADA?5/3:6/5)+2,2);
   }else if(trace.type===BLIP_CHAR){
    const at=this.blipPosition(trace);if(at)cone(at,2.7,1.2);
   }else if(trace.type===BLIP_OBJECT||trace.type===BLIP_PICKUP){
    // The browser does not know an object's box top before it has streamed; its origin stands in.
    const at=this.blipPosition(trace);if(at)cone(at,(trace.type===BLIP_PICKUP?2:0)+(indoors?1.6:1.8),.8);
   }else if(trace.type===BLIP_CONTACT_POINT&&!onMission){
    out.push({id,kind:'cylinder',position:[trace.position.x,trace.position.y,trace.position.z],size:2,colour:[255,0,0]});
   }
  });
  return out;
 }
 /** Where a blip sits: its own point, or the thing it is tied to. */
 private blipPosition(trace:{type:number;entityHandle:number;position:{x:number;y:number;z:number}}){
  if(trace.type===BLIP_CAR)return this.vehicles.exists(trace.entityHandle)?this.vehicles.positionOf(trace.entityHandle):undefined;
  if(trace.type===BLIP_CHAR){
   if(trace.entityHandle===PLAYER_PED_HANDLE)return this.world.playerPed().position;
   return this.peds.exists(trace.entityHandle)?this.peds.positionOf(trace.entityHandle):undefined;
  }
  if(trace.type===BLIP_OBJECT)return this.runtime.game.objects.exists(trace.entityHandle)?this.runtime.game.objects.at(trace.entityHandle).position:undefined;
  // A pickup blip follows the pickup the handle names; the trace keeps no point of its own for it.
  if(trace.type===BLIP_PICKUP)return this.runtime.game.pickups.at(trace.entityHandle)?.position;
  return trace.position;
 }
 /* Where the script has put the camera, in the renderer's axes, or nothing while the camera is the player's.
  * CCamera's fixed mode is a source and a point it looks at; the restores hand it back, and the host then
  * returns to whatever camera it was running. */
 scriptCamera(){
  const camera=this.runtime.game.camera;
  if(camera.lookingAtPlayer)return undefined;
  const entity=camera.lookingAtVector?undefined:camera.targetEntity,at=entity&&this.cameraEntityPosition(entity);
  if(camera.modeToGoTo===MODE_FIXED){
   // The fixed camera looks at its vector, or at the entity TakeControl gave it, where that entity is now.
   const source=camera.fixedModeSource,target=at??camera.fixedModeVector;
   return {position:{x:source.x,y:source.z,z:-source.y},target:{x:target.x,y:target.z,z:-target.y}};
  }
  // MODE_CAM_ON_A_STRING and the follow camera on an entity the script names (two missions): a chase point behind
  // and above it stands in for CCam's own follow modes.
  if(entity&&at){
   const heading=(entity.kind==='ped'?this.pedHeadingOf(entity.handle):this.vehicleHeadingOf(entity.handle))*Math.PI/180;
   const back=entity.kind==='ped'?4:7,up=entity.kind==='ped'?1.5:2.5;
   const source={x:at.x+Math.sin(heading)*back,y:at.y-Math.cos(heading)*back,z:at.z+up};
   return {position:{x:source.x,y:source.z,z:-source.y},target:{x:at.x,y:at.z,z:-at.y}};
  }
  return undefined;
 }
 /** Where the entity the camera is on stands now, in the script's coordinates. */
 private cameraEntityPosition(entity:{kind:'ped'|'vehicle';handle:number}){
  try{
   if(entity.kind==='ped')return entity.handle===PLAYER_PED_HANDLE?this.world.playerPed().position:this.peds.exists(entity.handle)?this.peds.positionOf(entity.handle):undefined;
   return entity.handle===PLAYER_VEHICLE_HANDLE?this.world.playerVehiclePose?.()?.position:this.vehicles.exists(entity.handle)?this.vehicles.positionOf(entity.handle):undefined;
  }catch{return undefined;}
 }
 private pedHeadingOf(handle:number){return handle===PLAYER_PED_HANDLE?this.world.playerPed().heading??0:this.peds.headingOf(handle);}
 private vehicleHeadingOf(handle:number){return handle===PLAYER_VEHICLE_HANDLE?this.world.playerVehiclePose?.()?.heading??0:this.vehicles.headingOf(handle);}
 /* The pickups the script has made. CPickups keeps them in the same array as the world's own, and the browser
  * has a pickup world of its own to put them in; what it needs beyond the record is the dff and txd the model
  * stands for, which the host looks up. A pickup the browser reports collected is collected for the script
  * too, which is what HAS_PICKUP_BEEN_COLLECTED asks after. */
 /** How many pickups the script is holding that have not been collected. */
 scriptPickupCount(){return this.runtime.game.pickups.uncollectedCount;}
 scriptPickups(){
  const out:{handle:number;model:number|string;type:number;ammo:number;position:[number,number,number];price?:number;moneyPerDay?:number;text?:string}[]=[];
  for(const pickup of this.runtime.game.pickups.all){
   if(pickup.collected)continue;
   out.push({handle:pickup.handle,model:pickup.model,type:pickup.type,ammo:pickup.ammo,
    position:[pickup.position.x,pickup.position.y,pickup.position.z],price:pickup.price,moneyPerDay:pickup.moneyPerDay,text:pickup.text});
  }
  return out;
 }
 /** CPickup::GiveUsAPickUpObject's other half: the script's record is collected when the world's is. */
 collectScriptPickup(handle:number){this.runtime.game.pickups.collect(handle);}
 /* The car generators the script has made. CTheCarGenerators holds them in the same array as the world's
  * own, so the browser's fleet takes them beside the ones the IPLs placed; the record already carries the
  * angle packed the way CCarGenerator keeps it, and the two flags the world's own record packs into a word. */
 /** How many generators the script has, for a host that only wants to know whether the list has changed. The
  * list itself is built from the runtime's records and is not worth building every frame to count it. */
 scriptCarGeneratorCount(){let count=0;for(const g of this.runtime.game.carGenerators.generators)if(g.used)count++;return count;}
 scriptCarGenerators(){
  const out=[];
  for(const [index,generator] of this.runtime.game.carGenerators.generators.entries()){
   if(!generator.used)continue;
   out.push({id:`script:${index}`,source:'script',sourceIndex:index,
    // The record keeps the angle packed to a byte (CCarGenerator::Setup); the fleet reads IPL radians.
    position:generator.position,angle:generator.angle*Math.PI*2/256,modelId:generator.modelId,
    // DoInternalProcessing's decrement compares the unsigned count with a signed -1 and so never runs.
    generateCount:()=>generator.generateCount,
    // CSpecialPlateHandler::Find: the plate text CUSTOM_PLATE_FOR_NEXT_CAR gave this generator.
    plateText:()=>this.runtime.game.carGenerators.plateFor(index),
    primaryColor:generator.primaryColour,secondaryColor:generator.secondaryColour,
    flags:(generator.highPriority?1:0)|(generator.ignorePopulationLimit?2:0),
    alarmChance:generator.alarmChance,doorLockChance:generator.doorLockChance,
    minDelay:generator.minDelay,maxDelay:generator.maxDelay});
  }
  return out;
 }
 /** CSetPieces' table, which the script's own ADD_SET_PIECE fills. The runtime keeps the area as CRect does,
  * with its four edges named; the browser's own record is the same four numbers in the order the read-ahead
  * wrote them, so the conversion is a reordering and nothing more. */
 /** How many set pieces the script has, for the same reason. */
 scriptSetPieceCount(){return this.runtime.game.setPieces.pieces.length;}
 scriptSetPieces():{type:number;area:[number,number,number,number];spawn1:[number,number];target1:[number,number];spawn2:[number,number];target2:[number,number]}[]{
  return this.runtime.game.setPieces.pieces.map(piece=>({type:piece.type,
   area:[piece.area.left,piece.area.bottom,piece.area.right,piece.area.top],
   spawn1:[piece.spawn1.x,piece.spawn1.y],target1:[piece.target1.x,piece.target1.y],
   spawn2:[piece.spawn2.x,piece.spawn2.y],target2:[piece.target2.x,piece.target2.y]}));
 }
 /** CStuntJumpManager's list, which the script's own ADD_STUNT_JUMP builds. */
 scriptStuntJumps(){return this.runtime.game.stuntJumps;}
 /** CTheZones' info record for a zone as the running script has it, or nothing before the labels are loaded. */
 scriptZoneInfo(zoneInfoIndex:number){
  const zones=this.runtime.game.zones;
  if(!zones.loaded||zoneInfoIndex<0||zoneInfoIndex>=zones.count)return undefined;
  const info=zones.at(zoneInfoIndex);
  return {popType:info.popType,gangStrength:info.gangStrength,dealerStrength:info.dealerStrength,
   noCops:info.noCops,popRaces:info.popRaces};
 }
 /** CRestart as the script has it, for the one the game respawns from to follow, and a cheap count of the
  * changes the script has made to it so a host can copy only when one has happened. */
 scriptRestart(){return this.runtime.game.restart;}
 scriptRestartRevision(){return this.runtime.game.restart.revision;}
 /** SUPPRESS_CAR_MODEL: the models the streamer is told not to bring in for traffic. */
 suppressedCarModels(){return this.runtime.game.suppressedCarModels;}
 /** How many of the script's fires are burning. */
 scriptFireCount(){let count=0;for(const fire of this.runtime.game.fires.fires)if(fire.active&&fire.createdByScript)count++;return count;}
 /* The fires the script has started, for a host to burn where CFireManager's own table says. A fresh array
  * each time, because two callers comparing two results is worth more than the one allocation it saves: the
  * records inside it are built anyway, and a shared array quietly makes those two results the same one. */
 scriptFires(){
  const out:{key:number;position:{x:number;y:number;z:number};strength:number;generations:number}[]=[];
  this.runtime.game.fires.fires.forEach((fire,index)=>{
   if(!fire.active||!fire.createdByScript)return;
   // Renderer axes: the script's z is up here and its y runs the other way.
   out.push({key:index,position:{x:fire.position.x,y:fire.position.z,z:-fire.position.y},
    strength:fire.strength,generations:fire.generationsAllowed});
  });
  return out;
 }
 /** The objects the script has made, for a host to draw where the runtime says they are. */
 scriptObjects(){return this.runtime.game.objects.all;}
 /** The cars the script has made, which outlive any one command. */
 readonly vehicles:ScmVehiclePool<unknown>;
 /** The peds the script has made. */
 readonly peds:ScmPedPool<unknown>;
 /** CPedGroups: the groups the script has made, by the handle it holds them with. The player's own group is
  * handle zero and is always there, as CPlayerPed's is. */
 readonly groups=new Map<number,NativePedGroup>([[PLAYER_GROUP_HANDLE,new NativePedGroup()]]);
 /** bNeverLeavesGroup, which SET_CHAR_NEVER_LEAVES_GROUP sets, by handle. */
 private readonly neverLeavesGroup=new Set<number>();
 /** CPedGroups::Process's membership half: each script group processes, and a group left empty is removed. The
  * player's group is never removed. */
 private processGroups(){
  const peds={
   alive:(h:number)=>h===PLAYER_PED_HANDLE?this.world.playerPed().health>0:this.peds.exists(h)&&!this.peds.isDead(h),
   isPlayer:(h:number)=>h===PLAYER_PED_HANDLE,
   neverLeavesGroup:(h:number)=>this.neverLeavesGroup.has(h),
   position:(h:number)=>h===PLAYER_PED_HANDLE?this.world.playerPed().position:this.peds.exists(h)?this.peds.positionOf(h):undefined,
  };
  for(const [handle,group] of this.groups){
   group.process(peds);
   if(!group.countMembers()&&handle!==PLAYER_GROUP_HANDLE)this.groups.delete(handle);
  }
 }
 private nextGroup=1;
 private readonly entry:number;
 /** CTheScripts::Process for one frame. The first call starts MAIN, as CGame::Initialise does. */
 step(nowMs:number,timeStepMs:number){
  if(this.stopped)return;
  if(!this.started){this.started=true;this.runtime.start(this.entry);}
  this.elapsed+=timeStepMs;
  try{this.runtime.process(Math.trunc(nowMs)>>>0,timeStepMs);this.followAttachments();this.processGroups();
   // CUserDisplay::Process, after CTheScripts::Process in CGame::Process: the mission clock moves its variable.
   this.processRunners(timeStepMs/1000);
   this.processTaskRecords();
   const game=this.runtime.game;game.onscreenTimer.process(this.globals,timeStepMs,game.widescreenOn,()=>this.world.frontendAudioEvent?.(33));}
  catch(error){
   if(error instanceof UnsupportedScmCommand)this.stopped={command:error.command,offset:error.offset,detail:error.message};
   else this.stopped={command:'error',offset:-1,detail:String(error)};
  }
  if(this.fade===this.ownFade)this.ownFade.process(timeStepMs/1000);
  const intro=this.runtime.active.some(slot=>slot.thread.name.toUpperCase()==='INTRO');
  if(intro)this.introSeen=true;else if(this.introSeen)this.introDone=true;
 }
 /** What the script has done so far, for the dev API and the browser tests. */
 /** CPedScriptedTaskRecord's records, one per ped here (the port holds one scripted order at a time). A wander
  * task never finishes, so it keeps its record until it is replaced or cleared. */
 private readonly taskRecords=new Map<number,{opcode:number;status:number;wander:boolean}>();
 /** CPedScriptedTaskRecordData::Set through a CEventScriptCommand: EVENT_ASSOCIATED until the next Process. */
 private recordTask(handle:number,opcode:number,wander:boolean){this.taskRecords.set(handle,{opcode,status:TASK_EVENT_ASSOCIATED,wander});}
 /** CPedScriptedTaskRecord::Process (0x6085E0): a record whose ped is gone, or whose task the ped no longer holds, is
  * flushed; one still held is TASK_ASSOCIATED. */
 private processTaskRecords(){
  for(const [handle,record] of this.taskRecords){
   if(handle===PLAYER_PED_HANDLE){
    if(this.world.playerHasScriptTask?.())record.status=TASK_TASK_ASSOCIATED;else this.taskRecords.delete(handle);
    continue;
   }
   if(!this.peds.exists(handle)){this.taskRecords.delete(handle);continue;}
   if(record.wander||this.runners.has(handle)){record.status=TASK_TASK_ASSOCIATED;continue;}
   // A ped still being made (its handle given, its body pending) keeps the order it will be given.
   const ped=this.peds.entity(handle);
   if(this.world.scriptPedHasOrder&&ped!==undefined&&!this.world.scriptPedHasOrder(ped)){this.taskRecords.delete(handle);continue;}
   record.status=TASK_TASK_ASSOCIATED;
  }
 }
 /** The script's globals, which the onscreen clock and counters read and write. */
 private get globals(){const space=this.runtime.scriptSpace;return this.globalsView??=new DataView(space.buffer,space.byteOffset,space.byteLength);}
 private globalsView?:DataView;
 /** COnscreenTimer::ProcessForDisplay for the HUD: the clock and the counters, as text with their GXT keys. */
 onscreenDisplay(){
  const timer=this.runtime.game.onscreenTimer;timer.processForDisplay(this.globals);
  if(!timer.display)return undefined;
  return {clock:timer.clock.enabled?{text:timer.clock.displayed,key:timer.clock.textKey}:undefined,
   counters:timer.counters.map((c,slot)=>c.enabled?{slot,text:c.displayed,key:c.textKey,type:c.type,colour:c.colourId,flash:c.flashWhenFirstDisplayed,value:c.varId+4<=this.globals.byteLength?this.globals.getInt32(c.varId,true):0}:undefined).filter(c=>c!==undefined)};
 }
 snapshot(){
  const {game}=this.runtime;
  return {
   started:this.started,
   stopped:this.stopped?{...this.stopped}:null,
   gaveUp:this.gaveUp.map(entry=>({...entry})),
   threads:this.runtime.active.map(slot=>({id:slot.id,name:slot.thread.name,ip:slot.thread.ip})),
   clock:{hours:game.clock.hours,minutes:game.clock.minutes},
   fade:{alpha:this.fade.value,fading:this.fade.fading},
   relationships:this.relationships.length,
   laRiots:this.laRiots,
   entryExitFlags:this.entryExitFlags,
   garages:game.garages.garages.length,
   objectVisibilities:this.objectVisibilities,
   playerModelsBuilt:this.playerModelsBuilt,
   playerControl:this.playerControl,
   scriptVehicles:this.vehicles.count,
   scriptPeds:this.peds.count,
   patrolRoute:this.patrolRoute.length,
   groups:[...this.groups.values()].filter(group=>group.countMembers()>0).length,
   missionText:this.missionText??null,
   cutscenes:this.cutscenes.length,
   requestedModels:this.requestedModels.size,
   areasCleared:this.areasCleared,
   playerStart:this.playerStart?{...this.playerStart}:null,
   restartPoints:{hospitals:game.restart.hospitals.length,police:game.restart.police.length},
   stuntJumps:game.stuntJumps.length,
   carGenerators:game.carGenerators.count,
   objects:game.objects.count,
   zones:game.zones.count,
   zonesTouched:game.zones.all.filter(zone=>zone.popType!==5||zone.dealerStrength>0||zone.gangStrength.some(Boolean)).length,
   maximumWantedLevel:game.maximumWantedLevel,
   totalMissions:game.totalNumberOfMissions,
   progressTotal:game.progressTotal,
  };
 }
}
