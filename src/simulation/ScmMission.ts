import {ScmRuntime} from '../engine/ScmRuntime';
import {ScmCameraFade} from '../engine/ScmCameraFade';
import {UnsupportedScmCommand,type ScmWorldCommands} from '../engine/ScmThread';
import {RANDOM_SAMPLE_MAX} from '../engine/nativeRandomRange';
import {findNavigationZone,pointInWorldZone,type WorldZones} from '../assets/worldZones';
import {ScmVehiclePool} from './ScmVehiclePool';
import {ScmPedPool,type ScmPedProofs} from './ScmPedPool';
import {NativePedGroup} from '../ped/nativePedGroup';
import {MAX_DECISION_CHOICES,type DecisionChoice} from '../ped/nativeDecisionMaker';
import {PED_SIGHT_TARGET_RAISE,pedSightAngleAndRange} from '../ped/nativePedSight';
import type {ScmObject} from '../engine/ScmObjects';
import {BLIP_CAR,BLIP_CHAR,BLIP_DISPLAY_BLIPONLY,BLIP_FLAG_THREAT,BLIP_FLAG_UNK,BLIP_NONE,BLIP_OBJECT,BLIP_PICKUP} from '../engine/ScmRadar';
import {MODE_FIXED} from '../engine/ScmCamera';
import {HUD_COLOURS,HUD_COLOUR_BLUE,HUD_COLOUR_RED,radarTraceColour} from '../ui/nativeHudColours';
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

/** What the browser can answer for the script while it runs its opening. */
export interface ScmMissionWorld {
 /** Where CREATE_PLAYER would put the player. The browser has already placed them by the time the script
  * runs, from its own start, a restart point or a save, so the host records this rather than moving them. */
 playerCreatedAt(x:number,y:number,z:number):void;
 setPlayerHeading(degrees:number):void;
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
 setScriptPedInvulnerable(ped:unknown,enabled:boolean):void;
 setScriptPedProofs(ped:unknown,proofs:ScmPedProofs):void;
 scriptPedAlive(ped:unknown):boolean;
 removeScriptPed(ped:unknown):void;
 releaseScriptPed(ped:unknown):void;
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
 clearScriptPedTasks(ped:unknown):void;
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
 setScriptPedFlag(ped:unknown,flag:'notAllowedToDuck'|'stayInCarOnJack'|'doesntDropWeaponsWhenDead'|'getOutUpsideDownCar'|'bleeding'|'drownsInWater'|'neverLeavesGroup'|'canBeShotInVehicle'|'cantBeDraggedOut'|'loadsCollision'|'kindaStayInSamePlace'|'deathPickupsPersist',value:boolean):void;
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
 /** CHud: whether a message the script put up is still on screen, and whether a help message is. */
 messageShowing():boolean;
 /** Where the camera is, what it looks along, and its field of view, in the script's own coordinates. */
 cameraSource():{x:number;y:number;z:number};
 cameraFront():{x:number;y:number;z:number};
 cameraFov():number;
 setCameraInFrontOfPlayer():void;
 helpMessageShowing():boolean;
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
 spawnScriptVehicle(model:number|string,position:{x:number;y:number;z:number},heading:number):Promise<unknown>;
 placeScriptVehicle(car:unknown,position:{x:number;y:number;z:number},heading:number):void;
 scriptVehiclePosition(car:unknown):{x:number;y:number;z:number};
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
export class ScmMission {
 readonly fade=new ScmCameraFade();
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
   fade:(milliseconds,direction,nowMs)=>{this.fade.fade(milliseconds,direction,nowMs);},
   isFading:()=>this.fade.fading,
   requestCollision:()=>{},
   loadScene:(x,y,z)=>{this.world.loadScene(x,y,z);},
   createPlayer:(_playerId,x,y,z)=>{this.playerStart={x,y,z};this.world.playerCreatedAt(x,y,z);},
   getPlayerChar:()=>PLAYER_PED_HANDLE,
   getPlayerGroup:()=>PLAYER_GROUP_HANDLE,
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
   pedVehicle:handle=>handle===PLAYER_PED_HANDLE?this.world.playerPed().vehicle&&PLAYER_VEHICLE_HANDLE:this.peds.rideOf(handle)?.vehicle,
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
   givePedWeapon:(handle,weaponType,ammo)=>{this.world.giveScriptPedWeapon(this.livePed(handle),weaponType,ammo);},
   setPedCurrentWeapon:()=>{},
   setPedAmmo:(handle,weaponType,ammo)=>{
    const held=this.world.scriptPedWeapon(this.livePed(handle));
    if(held?.type===weaponType)this.world.setScriptPedAmmo(this.livePed(handle),ammo);
   },
   addAmmoToPed:(handle,weaponType,ammo)=>{
    const held=this.world.scriptPedWeapon(this.livePed(handle));
    if(held?.type===weaponType)this.world.setScriptPedAmmo(this.livePed(handle),held.ammo+ammo);
   },
   pedWeaponAmmo:(handle,weaponType)=>{
    const held=this.world.scriptPedWeapon(this.livePed(handle));
    return held?.type===weaponType?held.ammo:0;
   },
   // CPedIntelligence::ClearTasks, and its immediate form, which the browser cannot tell apart: a ped with no
   // order left goes back to wandering either way, having nothing to finish first.
   clearPedTasks:handle=>{this.world.clearScriptPedTasks(this.livePed(handle));},
   clearPedTasksImmediately:handle=>{this.world.clearScriptPedTasks(this.livePed(handle));},
   freezePedPosition:(handle,frozen)=>{this.world.setScriptPedFrozen(this.livePed(handle),frozen);},
   pedIsInAir:handle=>this.world.scriptPedInAir(this.livePed(handle)),
   // m_bIsStaticWaitingForCollision: a ped the browser built stands on ground it has already loaded, so it is
   // never waiting for collision to arrive.
   pedIsWaitingForCollision:handle=>{this.livePed(handle);return false;},
   damagePed:(handle,amount)=>{this.world.damageScriptPed(this.livePed(handle),amount);},
   // CPedIntelligence::SetPedDecisionMakerType, and the fields the rest of this batch names.
   setPedDecisionMaker:(handle,decisionMaker)=>{this.world.setScriptPedDecisionMaker(this.livePed(handle),decisionMaker);},
   setPedMaxHealth:(handle,health)=>{this.peds.setMaxHealth(handle,health);},
   playerCameraState:()=>this.world.playerCameraState(),
   // CPed::SetAreaCode: the ped belongs to that area and is drawn only there.
   setPedAreaVisible:(handle,area)=>{this.world.setScriptPedArea(this.livePed(handle),area);},
   pedIsPlayingAnim:(handle,animation)=>this.world.scriptPedIsPlayingAnim(this.livePed(handle),animation),
   // WARP_CHAR_FROM_CAR_TO_COORD drops the point to the ground first, as the teleport does.
   warpPedFromCarToCoord:(handle,x,y,z)=>{
    const ground=this.world.groundLevel(x,y,z);
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
   setPedSimpleFlag:(handle,flag,value)=>{this.world.setScriptPedFlag(this.livePed(handle),flag,value);},
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
   warpPedIntoCar:(handle,vehicle)=>{this.livePed(handle);this.peds.warpIntoCar(handle,vehicle,'driver');},
   // CPed::AttachPedToEntity and DettachPedFromEntity. The angle limit and the weapon belong to a ped that can
   // aim from where it hangs, which this browser's riders do not do yet, so they are not taken.
   attachPedToCar:(handle,vehicle,offset)=>{this.peds.attachToCar(handle,vehicle,offset);},
   detachPedFromCar:handle=>{this.peds.detachFromCar(handle,this.peds.positionOf(handle));},
   setPedKindaStayInSamePlace:(handle,state)=>{this.world.setScriptPedFlag(this.livePed(handle),'kindaStayInSamePlace',state);},
   // CPed::bIsTalking and the facial talk. The depot has no speech banks, so these hold what the script said
   // and nothing speaks; the thread carries on rather than stopping on a question nothing here answers.
   shutPedUpForScriptedSpeech:(handle,enabled)=>{this.world.setScriptPedSpeech(this.livePed(handle),enabled);},
   startPedFacialTalk:(handle,duration)=>{this.world.setScriptPedFacialTalk(this.livePed(handle),duration/1000);},
   stopPedFacialTalk:handle=>{this.world.setScriptPedFacialTalk(this.livePed(handle),undefined);},
   hidePedWeaponForScriptedCutscene:(handle,state)=>{this.world.hideScriptPedWeapon(this.livePed(handle),state);},
   addExplosion:(x,y,z,type)=>{this.world.addExplosion({x,y,z},type);},
   setVehicleCanBurstTyres:(handle,state)=>{this.world.setScriptVehicleCanBurstTyres(this.liveVehicle(handle),state);},
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
   setPedCantBeDraggedOut:(handle,cannot)=>{this.world.setScriptPedFlag(this.livePed(handle),'cantBeDraggedOut',cannot);},
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
   pedIsSittingInCar:(handle,vehicle)=>this.peds.rideOf(handle)?.vehicle===vehicle,
   // CPed's own acquaintance table, through CAcquaintance's routines.
   setPedRelationship:(handle,relationship,pedType)=>{this.world.setScriptPedRelationship(this.livePed(handle),relationship,pedType);},
   clearPedRelationship:(handle,relationship,pedType)=>{this.world.clearScriptPedRelationship(this.livePed(handle),relationship,pedType);},
   clearAllPedRelationships:(handle,relationshipType)=>{this.world.clearScriptPedRelationships(this.livePed(handle),relationshipType);},
   setPedNeverTargeted:(handle,enabled)=>{this.world.setScriptPedNeverTargeted(this.livePed(handle),enabled);},
   clearPedLookAt:handle=>{this.world.clearScriptPedLookAt(this.livePed(handle));},
   // The player's own cash is CPlayerInfo's, not the ped's m_nMoneyCount.
   setPedMoney:(handle,money)=>{if(handle!==PLAYER_PED_HANDLE)this.world.setScriptPedMoney?.(this.livePed(handle),money);},
   takePedPhotographedFlag:handle=>handle!==PLAYER_PED_HANDLE&&!!this.world.takeScriptPedPhotographed?.(this.livePed(handle)),
   // SET_CHAR_STAY_IN_SAME_PLACE is the flag CTaskComplexBeStill reads, which for a browser ped is the order
   // that holds it where it is; clearing it lets the wander have the ped back.
   setPedStayInSamePlace:(handle,stay)=>{
    this.world.giveScriptPedOrder(this.livePed(handle),stay?{kind:'standStill',seconds:Number.POSITIVE_INFINITY}:{kind:'wander'});
   },
   vehicleMatrix:handle=>this.world.scriptVehicleMatrix(this.liveVehicle(handle)),
   freezeVehiclePosition:(handle,frozen)=>{this.world.setScriptVehicleFrozen(this.liveVehicle(handle),frozen);},
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
   clearExcitingStuffFromArea:()=>{this.areasCleared++;},
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
   pedHeading:handle=>this.peds.headingOf(handle),
   setPedCoordinates:(handle,x,y,z)=>{this.peds.setPosition(handle,{x,y,z});},
   // SET_CHAR_COORDINATES_NO_OFFSET and the gang form differ from the plain one in what they do to a ped in a
   // car and to the ped's group, neither of which the browser's scripted peds have yet.
   setPedCoordinatesNoOffset:(handle,x,y,z)=>{this.peds.setPosition(handle,{x,y,z});},
   setPedCoordinatesDontWarpGang:(handle,x,y,z)=>{this.peds.setPosition(handle,{x,y,z});},
   setPedHealth:(handle,health)=>{this.peds.setHealth(handle,health);},
   killPed:handle=>{this.peds.kill(handle);},
   setPedAccuracy:(handle,accuracy)=>{this.peds.setAccuracy(handle,accuracy);},
   setPedInvulnerable:(handle,enabled)=>{this.peds.setInvulnerable(handle,enabled);},
   setPedProofs:(handle,proofs)=>{this.peds.setProofs(handle,proofs);},
   deletePed:handle=>{this.peds.delete(handle);},
   markPedNoLongerNeeded:handle=>{this.peds.markNoLongerNeeded(handle);},
   pedType:handle=>this.peds.typeOf(handle),
   pedIsMale:handle=>this.peds.isMale(handle),
   pedSpeed:handle=>this.world.scriptPedSpeed(this.livePed(handle)),
   pedIsInWater:handle=>this.world.scriptPedSubmerged(this.livePed(handle)),
   setPedVisible:(handle,visible)=>{this.world.setScriptPedVisible(this.livePed(handle),visible);},
   // CPedIntelligence's task, through the ped the browser built. A task with no browser behaviour yet turns
   // into nothing, and the thread gives up rather than leaving the ped standing as though it had obeyed.
   givePedScriptedTask:(handle,task,opcode)=>{
    const order=scriptedPedOrder(task,{
     self:()=>this.peds.positionOf(handle),
     ped:other=>this.peds.exists(other)?this.peds.positionOf(other):undefined,
    });
    if(!order)throw new UnsupportedScmCommand(opcode,0,'A_TASK_THE_BROWSER_DOES_NOT_RUN',task.kind);
    this.world.giveScriptPedOrder(this.livePed(handle),order);
   },
   // CTaskComplexSequence: every task in the sequence has to be one the browser runs, because a sequence with
   // a hole in it is not the sequence the script asked for.
   givePedSequence:(handle,tasks,repeat,opcode)=>{
    const world={
     self:()=>this.peds.positionOf(handle),
     ped:(other:number)=>this.peds.exists(other)?this.peds.positionOf(other):undefined,
    };
    const orders=[];
    for(const task of tasks){
     const order=scriptedPedOrder(task,world);
     if(!order)throw new UnsupportedScmCommand(opcode,0,'A_TASK_THE_BROWSER_DOES_NOT_RUN',task.kind);
     orders.push(order);
    }
    this.world.giveScriptPedSequence(this.livePed(handle),orders,repeat);
   },
   // CCarCtrl::CreateCarForScript through the pool, which hands the script a handle at once.
   createCar:(model,x,y,z)=>this.vehicles.create(model,{x,y,z}),
   vehicleExists:handle=>handle===PLAYER_VEHICLE_HANDLE?!!this.world.playerPed().vehicle:this.vehicles.exists(handle),
   vehicleIsDeadForScript:handle=>handle===PLAYER_VEHICLE_HANDLE?!this.world.playerPed().vehicle:!this.vehicles.exists(handle),
   vehiclePosition:handle=>handle===PLAYER_VEHICLE_HANDLE?this.world.scriptVehiclePosition(this.liveVehicle(handle)):this.vehicles.positionOf(handle),
   setVehicleCoordinates:(handle,x,y,z)=>{this.vehicles.setPosition(handle,{x,y,z});},
   vehicleHeading:handle=>handle===PLAYER_VEHICLE_HANDLE?this.world.scriptVehicleHeading(this.liveVehicle(handle)):this.vehicles.headingOf(handle),
   setVehicleHeading:(handle,degrees)=>{this.vehicles.setHeading(handle,degrees);},
   deleteVehicle:handle=>{this.vehicles.delete(handle);},
   markVehicleNoLongerNeeded:handle=>{this.vehicles.markNoLongerNeeded(handle);},
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
   isCarUpright:handle=>this.world.scriptVehicleMatrix(this.liveVehicle(handle)).up.z>=0,
   // RANDOM_PASSENGER_SAY: a passenger's speech line (CAEPedSpeechAudioEntity); the speech banks are not published.
   randomPassengerSay:()=>{},
   getWheelieStats:()=>({twoWheelsTime:0,twoWheelsDistance:0,wheelieTime:0,wheelieDistance:0,stoppieTime:0,stoppieDistance:0}),
   isPlayerPerformingWheelie:()=>false,isPlayerPerformingStoppie:()=>false,
   vehicleModelIs:(handle,model)=>(handle===PLAYER_VEHICLE_HANDLE?this.playerVehicle(handle).model:this.vehicles.modelOf(handle))===model,
   vehicleHealth:handle=>this.world.scriptVehicleHealth(this.liveVehicle(handle)),
   setVehicleHealth:(handle,health)=>{this.world.setScriptVehicleHealth(this.liveVehicle(handle),health);},
   vehicleSpeed:handle=>this.world.scriptVehicleSpeed(this.liveVehicle(handle)),
   vehicleIsStopped:handle=>this.world.scriptVehicleStopped(this.liveVehicle(handle)),
   vehicleIsOnFire:handle=>this.world.scriptVehicleOnFire(this.liveVehicle(handle)),
   vehicleIsOnScreen:handle=>this.world.scriptVehicleOnScreen(this.liveVehicle(handle)),
   explodeVehicle:handle=>{this.world.explodeScriptVehicle(this.liveVehicle(handle));},
   fixCar:handle=>{this.world.fixScriptVehicle(this.liveVehicle(handle));},
   setVehicleVisible:(handle,state)=>{this.world.setScriptVehicleVisible(this.liveVehicle(handle),state);},
   setVehicleProofs:(handle,proofs)=>{this.world.setScriptVehicleProofs(this.liveVehicle(handle),proofs);},
   setVehicleCanBeDamaged:(handle,canBeDamaged)=>{this.world.setScriptVehicleCanBeDamaged(this.liveVehicle(handle),canBeDamaged);},
   // CVehicle::m_nDoorLock: the script's lock states above unlocked all refuse entry, which is all the browser
   // keeps of the field.
   setVehicleDoorLock:(handle,lock)=>{this.world.setScriptVehicleDoorLock(this.liveVehicle(handle),lock!==0);},
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
   // Only the player's group follows the browser's own rules; the script's other groups keep the range in their record.
   setGroupSeparationRange:(group,range)=>{if(group===PLAYER_GROUP_HANDLE)this.world.setPlayerGroupSeparationRange?.(range);},
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
   setInvulnerable:(ped,enabled)=>{this.world.setScriptPedInvulnerable(ped,enabled);},
   setProofs:(ped,proofs)=>{this.world.setScriptPedProofs(ped,proofs);},
   aliveOf:ped=>this.world.scriptPedAlive(ped),
   remove:ped=>{this.world.removeScriptPed(ped);},
   release:ped=>{this.world.releaseScriptPed(ped);},
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
  // A thread that meets an unported command gives up; the others, MAIN among them, keep running.
  this.runtime.onUnsupported=(error,thread)=>{this.gaveUp.push({thread:thread.name,command:error.command,offset:error.offset});};
  this.runtime.onThreadError=(error,thread)=>{const at=thread.currentInstruction;this.gaveUp.push({thread:thread.name,command:at.name,offset:at.offset,detail:String(error)});};
  this.runtime.game.zones.load(zones.infoLabels);
  this.entry=header.entry;
 }
 /** The browser answers for the player's ped alone; a handle it does not hold retires that thread, which the
  * snapshot reports with no instruction offset, since it is the world rather than the command that is short. */
 /** The browser's ped behind a script handle, for the questions only a built ped can answer. A handle whose ped
  * is still being loaded, or never arrived, gives the thread up rather than being answered with a guess. */
 /** The browser's car behind a script handle, for the questions only a built car can answer. */
 private liveVehicle(handle:number){
  // The player's own car is not one the script made: the host hands it over while the player drives it.
  const car=handle===PLAYER_VEHICLE_HANDLE?this.world.playerVehicleEntity?.():this.vehicles.entity(handle);
  if(!car)throw new UnsupportedScmCommand(-1,0,'A_VEHICLE_THE_BROWSER_DOES_NOT_HOLD',`vehicle ${handle}`);
  return car;
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
 private livePed(handle:number){
  const ped=this.peds.entity(handle);
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
  if(camera.lookingAtPlayer||camera.modeToGoTo!==MODE_FIXED)return undefined;
  const source=camera.fixedModeSource,target=camera.fixedModeVector;
  return {position:{x:source.x,y:source.z,z:-source.y},target:{x:target.x,y:target.z,z:-target.y}};
 }
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
    generateCount:()=>generator.generateCount,spent:()=>{if(generator.generateCount!==0xffff&&generator.generateCount>0)generator.generateCount--;},
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
 private nextGroup=1;
 private readonly entry:number;
 /** CTheScripts::Process for one frame. The first call starts MAIN, as CGame::Initialise does. */
 step(nowMs:number,timeStepMs:number){
  if(this.stopped)return;
  if(!this.started){this.started=true;this.runtime.start(this.entry);}
  this.elapsed+=timeStepMs;
  try{this.runtime.process(Math.trunc(nowMs)>>>0,timeStepMs);this.followAttachments();}
  catch(error){
   if(error instanceof UnsupportedScmCommand)this.stopped={command:error.command,offset:error.offset,detail:error.message};
   else this.stopped={command:'error',offset:-1,detail:String(error)};
  }
  this.fade.process(timeStepMs/1000);
 }
 /** What the script has done so far, for the dev API and the browser tests. */
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
