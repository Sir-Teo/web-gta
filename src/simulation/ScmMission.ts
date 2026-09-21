import {ScmRuntime} from '../engine/ScmRuntime';
import {ScmCameraFade} from '../engine/ScmCameraFade';
import {UnsupportedScmCommand,type ScmWorldCommands} from '../engine/ScmThread';
import {RANDOM_SAMPLE_MAX} from '../engine/nativeRandomRange';
import type {WorldZones} from '../assets/worldZones';

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
   pedExists:handle=>handle===PLAYER_PED_HANDLE,
   pedPosition:handle=>this.playerPed(handle).position,
   pedVehicle:handle=>this.playerPed(handle).vehicle&&PLAYER_VEHICLE_HANDLE,
   pedAreaCode:handle=>this.playerPed(handle).areaCode,
   vehicleAppearance:handle=>this.playerVehicle(handle).appearance,
   vehicleIsTrain:handle=>this.playerVehicle(handle).train,
   playerMissionGates:()=>this.world.playerMissionGates(),
   pedIsStopped:handle=>this.playerPed(handle).stopped,
   pedIsDeadForScript:handle=>this.playerPed(handle).dead,
   pedHealth:handle=>this.playerPed(handle).health,
   setPlayerControl:(_player,control)=>{this.playerControl=control;this.world.setPlayerControl(control);},
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
  const {runtime,header}=ScmRuntime.load(script,adapter,this.random);
  this.runtime=runtime;
  // A thread that meets an unported command gives up; the others, MAIN among them, keep running.
  this.runtime.onUnsupported=(error,thread)=>{this.gaveUp.push({thread:thread.name,command:error.command,offset:error.offset});};
  this.runtime.game.zones.load(zones.infoLabels);
  this.entry=header.entry;
 }
 /** The browser answers for the player's ped alone; a handle it does not hold retires that thread, which the
  * snapshot reports with no instruction offset, since it is the world rather than the command that is short. */
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
