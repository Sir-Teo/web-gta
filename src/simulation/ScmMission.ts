import {ScmRuntime} from '../engine/ScmRuntime';
import {ScmCameraFade} from '../engine/ScmCameraFade';
import {UnsupportedScmCommand,type ScmWorldCommands} from '../engine/ScmThread';
import {RANDOM_SAMPLE_MAX} from '../engine/nativeRandomRange';
import type {WorldZones} from '../assets/worldZones';
import {ScmVehiclePool} from './ScmVehiclePool';
import {ScmPedPool,type ScmPedProofs} from './ScmPedPool';
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
  vehicle:{appearance:number;train:boolean}|undefined;
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
 /** The share of the map the player's gang holds, which the browser's gang wars keep. */
 territoryUnderControlPercentage():number;
 /* The peds a script creates. As with the cars, the browser cannot build one inside the command, so the host
  * is asked and the pool holds the handle until the model is loaded. */
 spawnScriptPed(pedType:number,model:number|string,position:{x:number;y:number;z:number}):Promise<unknown>;
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
 setScriptPedVisible(ped:unknown,visible:boolean):void;
 /** A task the script gave the ped, already turned into something the browser can carry out. */
 giveScriptPedOrder(ped:unknown,order:ScriptedPedOrder):void;
 clearScriptPedTasks(ped:unknown):void;
 giveScriptPedWeapon(ped:unknown,weaponType:number,ammo:number):void;
 scriptPedWeapon(ped:unknown):{type:number;ammo:number}|undefined;
 setScriptPedAmmo(ped:unknown,ammo:number):void;
 setScriptPedFrozen(ped:unknown,frozen:boolean):void;
 scriptPedInAir(ped:unknown):boolean;
 setScriptPedDecisionMaker(ped:unknown,decisionMaker:number):void;
 setScriptPedNeverTargeted(ped:unknown,enabled:boolean):void;
 clearScriptPedLookAt(ped:unknown):void;
 scriptVehicleMatrix(car:unknown):{right:{x:number;y:number;z:number};forward:{x:number;y:number;z:number};up:{x:number;y:number;z:number};position:{x:number;y:number;z:number}};
 setScriptVehicleFrozen(car:unknown,frozen:boolean):void;
 setScriptVehicleForwardSpeed(car:unknown,forwardSpeed:number):void;
 damageScriptPed(ped:unknown,amount:number):void;
 /* The cars a script creates. The browser builds one only once its model is streamed, so the host is asked to
  * spawn and the pool holds the handle in the meantime; everything the script says before the car arrives is
  * applied when it does. */
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
 setPlayerMaxHealth(maxHealth:number):void;
 setPlayerMaxArmour(maxArmour:number):void;
 /** CEntryExitManager: the flag the script sets on the entry-exit nearest a point, and the named switch. */
 setClosestEntryExitFlag(x:number,y:number,radius:number,flag:number,on:boolean):void;
 switchEntryExit(name:string,on:boolean):void;
}
/** CTheScripts' player slot: the script always addresses player zero, whose ped it creates first. */
export const PLAYER_PED_HANDLE=1,PLAYER_GROUP_HANDLE=0;
/** The browser holds one vehicle for the player at a time, so the script's questions about the car it is in are
 * answered by a single handle rather than a pool the browser does not have. */
export const PLAYER_VEHICLE_HANDLE=1;
/** Where the script's own peds and cars are numbered from, above the player's handle and his car's. */
export const SCRIPT_PED_FIRST_HANDLE=1024,SCRIPT_VEHICLE_FIRST_HANDLE=1024;
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
 readonly gaveUp:{thread:string;command:string;offset:number}[]=[];
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
 constructor(script:Uint8Array,zones:WorldZones,private readonly world:ScmMissionWorld){
  const adapter:ScmWorldCommands={
   fade:(milliseconds,direction,nowMs)=>{this.fade.fade(milliseconds,direction,nowMs);},
   isFading:()=>this.fade.fading,
   requestCollision:()=>{},
   loadScene:(x,y,z)=>{this.world.loadScene(x,y,z);},
   createPlayer:(_playerId,x,y,z)=>{this.playerStart={x,y,z};this.world.playerCreatedAt(x,y,z);},
   getPlayerChar:()=>PLAYER_PED_HANDLE,
   getPlayerGroup:()=>PLAYER_GROUP_HANDLE,
   setCameraBehindPlayer:()=>{this.world.setCameraBehindPlayer();},
   setCharHeading:(ped,degrees)=>{if(ped===PLAYER_PED_HANDLE)this.world.setPlayerHeading(degrees);},
   setRelationship:(relationship,pedType,otherPedType)=>{this.relationships.push({relationship,pedType,otherPedType});},
   setLaRiots:active=>{this.laRiots=active;this.world.setLaRiots(active);},
   groundLevel:(x,y,z)=>this.world.groundLevel(x,y,z),
   // CEntity::GetDistanceFromCentreOfMassToBaseOfModel needs the model's own bounds, which the browser only
   // has once the streamer has read it; until then the object sits with its origin on the ground.
   modelBaseOffset:()=>0,
   // The peds a script asks after. The browser holds one, the player's, so the player's handle is answered
   // from the running game and any other handle gives that thread up rather than being made up.
   pedExists:handle=>handle===PLAYER_PED_HANDLE||this.peds.exists(handle),
   pedPosition:handle=>handle===PLAYER_PED_HANDLE?this.world.playerPed().position:this.peds.positionOf(handle),
   pedVehicle:handle=>this.playerPed(handle).vehicle&&PLAYER_VEHICLE_HANDLE,
   pedAreaCode:handle=>this.playerPed(handle).areaCode,
   pedHasWeapon:(handle,type)=>handle===PLAYER_PED_HANDLE?this.world.playerPed().weapons.carried.includes(type):this.world.scriptPedWeapon(this.livePed(handle))?.type===type,
   pedActiveWeapon:handle=>this.playerPed(handle).weapons.active,
   pedIsShooting:handle=>this.playerPed(handle).shooting,
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
   setPedNeverTargeted:(handle,enabled)=>{this.world.setScriptPedNeverTargeted(this.livePed(handle),enabled);},
   clearPedLookAt:handle=>{this.world.clearScriptPedLookAt(this.livePed(handle));},
   // SET_CHAR_STAY_IN_SAME_PLACE is the flag CTaskComplexBeStill reads, which for a browser ped is the order
   // that holds it where it is; clearing it lets the wander have the ped back.
   setPedStayInSamePlace:(handle,stay)=>{
    this.world.giveScriptPedOrder(this.livePed(handle),stay?{kind:'standStill',seconds:Number.POSITIVE_INFINITY}:{kind:'wander'});
   },
   vehicleMatrix:handle=>this.world.scriptVehicleMatrix(this.liveVehicle(handle)),
   freezeVehiclePosition:(handle,frozen)=>{this.world.setScriptVehicleFrozen(this.liveVehicle(handle),frozen);},
   setVehicleForwardSpeed:(handle,forwardSpeed)=>{this.world.setScriptVehicleForwardSpeed(this.liveVehicle(handle),forwardSpeed);},
   // CWorld::FindGroundZForCoord looks straight down from a thousand above and answers twenty where the world
   // has no ground under the point.
   groundZForCoord:(x,y)=>this.world.groundLevel(x,y,0)??20,
   // A ped a script made never rides in the browser yet, so it is always on foot and never sitting in a car.
   pedIsOnFoot:handle=>handle===PLAYER_PED_HANDLE?!this.world.playerPed().vehicle:this.livePed(handle)&&true,
   pedIsSittingInAnyCar:handle=>handle===PLAYER_PED_HANDLE?this.world.playerPed().sittingInCar:!this.livePed(handle)&&false,
   vehicleAppearance:handle=>this.playerVehicle(handle).appearance,
   vehicleIsTrain:handle=>this.playerVehicle(handle).train,
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
   // CWorld::ClearExcitingStuffFromArea, which the browser has no equivalent of: it clears nothing and says so.
   clearExcitingStuffFromArea:()=>{this.areasCleared++;},
   requestModel:model=>{this.requestedModels.add(String(model));this.world.requestModel(model);},
   hasModelLoaded:()=>true,
   markModelNotNeeded:()=>{},
   loadAllModelsNow:()=>{},
   loadCutscene:name=>{this.cutscenes.push(name);this.world.loadCutscene(name);this.runtime.game.cutscene.loaded();},
   startCutscene:()=>{this.runtime.game.cutscene.finish();},
   clearCutscene:()=>{},
   findNumberTagsTagged:()=>this.world.tagsTagged(),
   percentageTaggedInArea:(x1,y1,x2,y2)=>this.world.tagsPercentageInArea(x1,y1,x2,y2),
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
   // CCarCtrl::CreateCarForScript through the pool, which hands the script a handle at once.
   createCar:(model,x,y,z)=>this.vehicles.create(model,{x,y,z}),
   vehicleExists:handle=>this.vehicles.exists(handle),
   vehicleIsDeadForScript:handle=>!this.vehicles.exists(handle),
   vehiclePosition:handle=>this.vehicles.positionOf(handle),
   setVehicleCoordinates:(handle,x,y,z)=>{this.vehicles.setPosition(handle,{x,y,z});},
   vehicleHeading:handle=>this.vehicles.headingOf(handle),
   setVehicleHeading:(handle,degrees)=>{this.vehicles.setHeading(handle,degrees);},
   deleteVehicle:handle=>{this.vehicles.delete(handle);},
   markVehicleNoLongerNeeded:handle=>{this.vehicles.markNoLongerNeeded(handle);},
   vehicleModel:handle=>this.vehicles.modelOf(handle),
   vehicleModelIs:(handle,model)=>this.vehicles.modelOf(handle)===model,
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
   vehicleExistsByHandle:handle=>this.vehicles.exists(handle),
   playerCity:()=>this.world.playerCity(),
   loadMissionText:name=>{this.missionText=name;this.world.loadMissionText(name);},
   buildPlayerModel:()=>{this.playerModelsBuilt++;this.world.buildPlayerModel();},
   stopAllLawEnforcers:()=>{this.world.stopAllLawEnforcers();},
   makePlayerSafe:(_player,safe,radius)=>{this.world.makePlayerSafe(safe,radius);},
   setPlayerMaxHealth:(_player,maxHealth)=>{this.world.setPlayerMaxHealth(maxHealth);},
   setPlayerMaxArmour:(_player,maxArmour)=>{this.world.setPlayerMaxArmour(maxArmour);},
   setVisibilityOfClosestObjectOfType:(x,y,z,radius,m,visible)=>{this.objectVisibilities++;this.world.setVisibilityOfClosestObjectOfType(x,y,z,radius,m,visible);},
   setClosestEntryExitFlag:(x,y,radius,flag,on)=>{this.entryExitFlags++;this.world.setClosestEntryExitFlag(x,y,radius,flag,on);},
   switchEntryExit:(name,on)=>{this.entryExitFlags++;this.world.switchEntryExit(name,on);},
   isPlayerRestarting:()=>false,
   isPlayerPlaying:()=>true,
   isPlayerDead:()=>false,
   clearSmallMessages:()=>{},
   isDrawingMap:()=>false,
  };
  // Script handles start clear of the player's own, which is 1 for him and for the car he drives.
  this.peds=new ScmPedPool<unknown>({
   spawn:(pedType,model,position)=>this.world.spawnScriptPed(pedType,model,position),
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
  this.runtime.game.zones.load(zones.infoLabels);
  this.entry=header.entry;
 }
 /** The browser answers for the player's ped alone; a handle it does not hold retires that thread, which the
  * snapshot reports with no instruction offset, since it is the world rather than the command that is short. */
 /** The browser's ped behind a script handle, for the questions only a built ped can answer. A handle whose ped
  * is still being loaded, or never arrived, gives the thread up rather than being answered with a guess. */
 /** The browser's car behind a script handle, for the questions only a built car can answer. */
 private liveVehicle(handle:number){
  const car=this.vehicles.entity(handle);
  if(!car)throw new UnsupportedScmCommand(-1,0,'A_VEHICLE_THE_BROWSER_DOES_NOT_HOLD',`vehicle ${handle}`);
  return car;
 }
 private livePed(handle:number){
  const ped=this.peds.entity(handle);
  if(!ped)throw new UnsupportedScmCommand(-1,0,'A_PED_THE_BROWSER_DOES_NOT_HOLD',`ped ${handle}`);
  return ped;
 }
 private playerPed(handle:number){
  if(handle!==PLAYER_PED_HANDLE)throw new UnsupportedScmCommand(-1,0,'A_PED_THE_BROWSER_DOES_NOT_HOLD',`ped ${handle}`);
  return this.world.playerPed();
 }
 /** The one vehicle the browser holds for the player, which is the only one it can answer about. */
 private playerVehicle(handle:number){
  const vehicle=handle===PLAYER_VEHICLE_HANDLE?this.world.playerPed().vehicle:undefined;
  if(!vehicle)throw new UnsupportedScmCommand(-1,0,'A_VEHICLE_THE_BROWSER_DOES_NOT_HOLD',`vehicle ${handle}`);
  return vehicle;
 }
 /** The cars the script has made, which outlive any one command. */
 readonly vehicles:ScmVehiclePool<unknown>;
 /** The peds the script has made. */
 readonly peds:ScmPedPool<unknown>;
 private readonly entry:number;
 /** CTheScripts::Process for one frame. The first call starts MAIN, as CGame::Initialise does. */
 step(nowMs:number,timeStepMs:number){
  if(this.stopped)return;
  if(!this.started){this.started=true;this.runtime.start(this.entry);}
  this.elapsed+=timeStepMs;
  try{this.runtime.process(Math.trunc(nowMs)>>>0,timeStepMs);}
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
   objectVisibilities:this.objectVisibilities,
   playerModelsBuilt:this.playerModelsBuilt,
   playerControl:this.playerControl,
   scriptVehicles:this.vehicles.count,
   scriptPeds:this.peds.count,
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
