import {ScmRuntime} from '../engine/ScmRuntime';
import {ScmCameraFade} from '../engine/ScmCameraFade';
import {UnsupportedScmCommand,type ScmWorldCommands} from '../engine/ScmThread';
import {RANDOM_SAMPLE_MAX} from '../engine/nativeRandomRange';
import type {WorldZones} from '../assets/worldZones';

/** What the browser can answer for the script while it runs its opening. */
export interface ScmMissionWorld {
 /** CPlayerPed's handle, and where the script puts the player when it creates them. */
 placePlayer(x:number,y:number,z:number):void;
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
 /** CEntryExitManager: the flag the script sets on the entry-exit nearest a point, and the named switch. */
 setClosestEntryExitFlag(x:number,y:number,radius:number,flag:number,on:boolean):void;
 switchEntryExit(name:string,on:boolean):void;
}
/** CTheScripts' player slot: the script always addresses player zero, whose ped it creates first. */
export const PLAYER_PED_HANDLE=1,PLAYER_GROUP_HANDLE=0;
/* The original MAIN.SCM running inside the browser. CTheScripts::Process is driven a frame at a time; a
 * command the runtime has not ported stops the script exactly where the original would have carried on, and
 * the reason is kept so the gap is visible rather than silent. Everything the script sets before that point,
 * the clock, the stats, the zone population, the restart points and the rest, is real script state rather
 * than a static reading of the file. */
export class ScmMission {
 readonly fade=new ScmCameraFade();
 readonly runtime:ScmRuntime;
 /** Where the script stopped, or nothing while it is still running. */
 stopped?:{command:string;offset:number;detail:string};
 /** Commands the world was asked for, for a host that wants to follow along. */
 readonly relationships:{relationship:number;pedType:number;otherPedType:number}[]=[];
 laRiots=false;
 /** Entry-exit flags and switches the script has asked for. */
 entryExitFlags=0;
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
   createPlayer:(_playerId,x,y,z)=>{this.world.placePlayer(x,y,z);},
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
  this.runtime.game.zones.load(zones.infoLabels);
  this.entry=header.entry;
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
   threads:this.runtime.active.map(slot=>({id:slot.id,name:slot.thread.name,ip:slot.thread.ip})),
   clock:{hours:game.clock.hours,minutes:game.clock.minutes},
   fade:{alpha:this.fade.value,fading:this.fade.fading},
   relationships:this.relationships.length,
   laRiots:this.laRiots,
   entryExitFlags:this.entryExitFlags,
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
