import {requireAsset} from '../assets/binary';
import {randomIntInRange} from '../engine/nativeRandomRange';
import type {NativeRestart,RestartResult} from './nativeRestart';

/* CGameLogic port, pinned gta-reversed 0076f9017b4aeef7433957ac2bd8b6988e9df166,
 * GameLogic.cpp (`Update` 0x4418F0 region, `PassTime`,
 * `RestorePlayerStuffDuringResurrection`) with CPlayerInfo::KillPlayer and
 * ArrestPlayer, and the trip skip (SetUpSkip, ClearSkip, SkipCanBeActivated, UpdateSkip,
 * IsSkipWaitingForScriptToFadeIn). Single-player only: the co-op branches, cutscene gate and mission-failed/passed
 * states are script and two-player features and are not reproduced. Streaming, camera and clothing side effects of the
 * resurrection belong to their own systems and are left to the adapter. */

export const GAMELOGIC_STATE_PLAYING=0,GAMELOGIC_STATE_WASTED=1,GAMELOGIC_STATE_BUSTED=2;
/** CGameLogic::Update wasted branch: a flat hospital fee. */
export const HOSPITAL_FEE=100;
/** Busted fee by wanted level. Retail returns 100 at level zero. */
export const POLICE_FEES=[100,100,200,400,600,900,1500] as const;
/** The wasted branch waits three seconds, the busted branch four. */
export const WASTED_DELAY_MS=3000,BUSTED_DELAY_MS=4000,FADE_EVENT_WINDOW_MS=3000;
/** TheCamera.Fade durations either side of the respawn. */
export const FADE_TO_BLACK_SECONDS=2,FADE_FROM_BLACK_SECONDS=3;
/** Both the wasted and busted sequences advance the clock twelve hours. */
export const RESURRECTION_PASS_MINUTES=12*60;
/** CCarCtrl::CountDownToCarsAtStart and CPopulation::m_CountDownToPedsAtStart. */
export const RESURRECTION_TRAFFIC_COUNTDOWN=10;
/** eStats ids incremented by KillPlayer and ArrestPlayer. */
export const STAT_TIMES_BUSTED=133,STAT_DAYS_PASSED_IN_GAME=134,STAT_NUMBER_OF_HOSPITAL_VISITS=135;

/** eSkipState. */
export const SKIP_NONE=0,SKIP_AVAILABLE=1,SKIP_IN_PROGRESS=2,SKIP_FADING_OUT=3,SKIP_AFTER_MISSION=4,SKIP_WAITING_SCRIPT=5;
/** UpdateSkip's times: the skip lapses 35 s after it was set up; the fade takes 3 s before the move, the fade back 1.5. */
export const SKIP_LAPSE_MS=35000,SKIP_FADE_MS=3000,SKIP_FADE_BACK_MS=1500;
/** The player is within this many units (2D) of the skip's point: there is nothing to skip. */
export const SKIP_NEAR_DISTANCE=25;

/** What the trip skip reads and does in the world. */
export interface SkipWorld {
 /** CGame::CanSeeOutSideFromCurrArea. */
 canSeeOutside():boolean;
 isFading():boolean;
 /** The player's vehicle, when it is a car, bike, monster truck, quad or BMX (one a skip can take). */
 playerRoadVehicle():unknown|undefined;
 /** The player swims (CTaskSimpleSwim). */
 playerSwimming():boolean;
 /** The player is getting out of a vehicle (TASK_COMPLEX_LEAVE_CAR). */
 playerLeavingCar():boolean;
 /** CPad::IsDPadRightPressed: pressed this frame and not the last. */
 skipButtonJustPressed():boolean;
 /** CPad::bCamera: the player's camera control is held while the skip runs. */
 setPadCamera(held:boolean):void;
 /** TheCamera.SetFadeColour(0,0,0) and Fade: direction 0 covers the screen, 1 reveals it. */
 fade(direction:0|1,seconds:number):void;
 /** CMessages::AddBigMessage(TheText.Get("SKIP"), 4500, STYLE_BOTTOM_RIGHT). */
 showSkipMessage():void;
 /** CHud::SetMessage(nullptr). */
 clearHudMessage():void;
 /** ClearSpaceForMissionEntity and the move: the player's vehicle teleported, turned to the heading, put on the road
  * and set rolling forward at a fifth of a unit a frame, the camera behind it; or the player on foot set on the
  * ground one unit up. */
 teleportForSkip(position:readonly [number,number,number],headingDegrees:number):void;
 playerPosition():[number,number,number];
 passTime(minutes:number):void;
}

export interface GameLogicClock {hours:number;minutes:number;weekDay:number}
export interface GameLogicPassedTime extends GameLogicClock {daysPassed:number}

/** CGameLogic::PassTime. The weekday wraps to 1 whenever it passes 7,
 * regardless of how many days elapsed, which is the original behaviour. */
export function passTime(clock:GameLogicClock,minutes:number):GameLogicPassedTime{
 requireAsset(Number.isInteger(minutes)&&minutes>=0,'PassTime takes whole minutes.');
 requireAsset(Number.isInteger(clock.hours)&&Number.isInteger(clock.minutes)&&Number.isInteger(clock.weekDay),'Invalid game clock.');
 let {hours,weekDay}=clock,daysPassed=0;
 let total=minutes+clock.minutes;
 if(total>=60){hours+=Math.trunc(total/60);total%=60;}
 if(hours>=24){
  daysPassed=Math.trunc(hours/24);hours%=24;weekDay+=daysPassed;
  if(weekDay>7)weekDay=1;
 }
 return {hours,minutes:total,weekDay,daysPassed};
}

export interface GameLogicWorld {
 /** CPlayerPed death and arrest states feeding the state transitions. */
 isPlayerDead():boolean;
 isPlayerArrested():boolean;
 /** Native coordinates of the player, or of the outside world when indoors. */
 playerPosition():[number,number,number];
 wantedLevel():number;
 /** TheCamera.m_bFading. */
 isFading():boolean;
 /** SetFadeColour(0,0,0) then Fade. Direction 0 covers the screen
  * (eFadeFlag::FADE_IN), direction 1 reveals it. */
 fade(direction:0|1,seconds:number):void;
 /** CPad::bCamera, which a trip skip holds; ClearSkip lets it go. */
 setPadCamera?(held:boolean):void;
 /** CWeaponEffects::ClearCrossHairs. */
 clearCrossHairs():void;
 /** CMessages::ClearMessages(false) and CHud::SetHelpMessage(nullptr,...). */
 clearMessages():void;
 /** PunishPlayer: money floors at zero and every weapon is cleared. */
 punish(fee:number):void;
 /** CStats::IncrementStat on kill and arrest. */
 incrementStat?(stat:number,value:number):void;
 /** CGangWars::EndGangWar(false), which KillPlayer and ArrestPlayer both call. */
 endGangWar?():void;
 /** CMessages::AddBigMessage("DEAD", 4000, STYLE_WHITE_MIDDLE). */
 showWastedMessage?():void;
 /** CMessages::AddBigMessage("BUSTED", 5000, STYLE_WHITE_MIDDLE). The reversed CGameLogic::Update adds it
  * only when the arrested ped is FindPlayerPed(1), the co-op second player; retail shows it to a lone
  * player too, presumably from the unreversed CPlayerInfo::Process (0x56F8D0), so it is sent on every arrest. */
 showBustedMessage?():void;
 /** CHud::ResetWastedText, from RestorePlayerStuffDuringResurrection. */
 resetWastedText?():void;
 /** CGameLogic::PassTime applied to the shared clock. */
 passTime(minutes:number):void;
 /** RestorePlayerStuffDuringResurrection: full health, no armour, wanted
  * level reset, sprint energy restored, out of any vehicle, placed one unit
  * above the restart point facing its heading. */
 resurrect(result:RestartResult):void;
 /** CGeneral::GetRandomNumberInRange for the busted audio pick. */
 nextRandom?():number;
 /** CTheScripts::IsPlayerOnAMission: no bust line is picked on a mission. */
 playerOnAMission?():boolean;
}

export class NativeGameLogic {
 state:number=GAMELOGIC_STATE_PLAYING;
 timeOfLastEvent=0;
 /** CGameLogic statics; scripts clear them for one death or arrest. */
 penaltyForDeathApplies=true;penaltyForArrestApplies=true;
 freeHealthCare=false;getOutOfJailFree=false;
 /** CPlayerInfo::m_nBustedAudioStatus and m_nLastBustMessageNumber. */
 bustedAudioStatus=0;lastBustMessageNumber=0;
 /** CGameLogic's trip skip: SkipState, SkipPosition, SkipHeading, SkipVehicle, SkipTimer and SkipToBeFinishedByScript. */
 skipState=SKIP_NONE;skipPosition:[number,number,number]=[0,0,0];skipHeading=0;skipVehicle:unknown;skipTimer=0;skipToBeFinishedByScript=false;
 /** The CRestart table: the host swaps in the script's own once the script has filled it. */
 constructor(public restart:NativeRestart){}
 private fadeInIfNewEvent(previousMs:number,world:GameLogicWorld){
  // The previous frame's clock is compared, so the fade starts on exactly
  // the frame the delay is first exceeded.
  if(previousMs-this.timeOfLastEvent<=FADE_EVENT_WINDOW_MS)world.fade(0,FADE_TO_BLACK_SECONDS);
 }
 /** ResetForResurrectionAndFadeOut. `fadeOutNow` carries
  * CRestart::bFadeInAfterNextDeath / bFadeInAfterNextArrest. */
 private resurrect(world:GameLogicWorld,result:RestartResult,fadeOutNow:boolean){
  // RestorePlayerStuffDuringResurrection starts with ClearSkip(false).
  this.clearSkip(false,{fade:(direction,seconds)=>world.fade(direction,seconds),setPadCamera:held=>world.setPadCamera?.(held)});
  this.state=GAMELOGIC_STATE_PLAYING;
  world.clearMessages();
  world.passTime(RESURRECTION_PASS_MINUTES);
  world.resurrect(result);world.resetWastedText?.();
  if(fadeOutNow)world.fade(1,FADE_FROM_BLACK_SECONDS);
 }
 /** CPlayerInfo::KillPlayer / ArrestPlayer plus the state transition. */
 private beginEvent(state:number,nowMs:number,world:GameLogicWorld){
  this.state=state;this.timeOfLastEvent=nowMs;
  if(state===GAMELOGIC_STATE_WASTED){
   world.incrementStat?.(STAT_NUMBER_OF_HOSPITAL_VISITS,1);world.showWastedMessage?.();world.endGangWar?.();
  }else{
   this.bustedAudioStatus=0;world.incrementStat?.(STAT_TIMES_BUSTED,1);world.showBustedMessage?.();world.endGangWar?.();
  }
 }
 /** ClearSkip: an after-mission skip survives the clear its mission's end asks for; one in progress fades back. */
 clearSkip(afterMission:boolean,world?:Pick<SkipWorld,'fade'|'setPadCamera'>){
  if(afterMission&&this.skipState===SKIP_AFTER_MISSION)return;
  if(this.skipState===SKIP_IN_PROGRESS)world?.fade(1,.5);
  this.skipState=SKIP_NONE;world?.setPadCamera(false);
 }
 /** SetUpSkip. (gta-reversed's reading stores neither the heading nor the vehicle, which UpdateSkip and
  * SkipCanBeActivated then read; both are kept, as the arguments are there for.) */
 setUpSkip(position:readonly [number,number,number],headingDegrees:number,afterMission:boolean,vehicle:unknown,finishedByScript:boolean,nowMs:number,world?:Pick<SkipWorld,'fade'|'setPadCamera'>){
  this.clearSkip(false,world);
  this.skipPosition=[position[0],position[1],position[2]];this.skipHeading=headingDegrees;
  this.skipState=afterMission?SKIP_AFTER_MISSION:SKIP_AVAILABLE;
  this.skipTimer=nowMs;this.skipVehicle=vehicle;this.skipToBeFinishedByScript=finishedByScript;
 }
 /** CanPlayerTripSkip. */
 canPlayerTripSkip(){return this.skipState===SKIP_AVAILABLE||this.skipState===SKIP_AFTER_MISSION;}
 /** SkipCanBeActivated: outside, not fading, a skip on offer, and the player in a road vehicle (the named one, if any);
  * an after-mission skip also takes a swimming player. */
 skipCanBeActivated(world:SkipWorld){
  if(!world.canSeeOutside()||world.isFading()||!this.canPlayerTripSkip())return false;
  const vehicle=world.playerRoadVehicle();
  if(vehicle!==undefined&&(this.skipVehicle===undefined||this.skipVehicle===vehicle))return true;
  return this.skipState===SKIP_AFTER_MISSION&&world.playerSwimming();
 }
 /** IsSkipWaitingForScriptToFadeIn: true once, taking the skip back to none. */
 isSkipWaitingForScriptToFadeIn(){if(this.skipState!==SKIP_WAITING_SCRIPT)return false;this.skipState=SKIP_NONE;return true;}
 /** UpdateSkip. */
 updateSkip(nowMs:number,world:SkipWorld){
  const at=world.playerPosition();
  if(this.skipState===SKIP_AVAILABLE&&Math.hypot(at[0]-this.skipPosition[0],at[1]-this.skipPosition[1])<SKIP_NEAR_DISTANCE
   ||this.canPlayerTripSkip()&&nowMs>this.skipTimer+SKIP_LAPSE_MS){this.skipState=SKIP_NONE;return;}
  switch(this.skipState){
   case SKIP_AVAILABLE:case SKIP_AFTER_MISSION:
    if(!this.skipCanBeActivated(world)||world.playerLeavingCar())return;
    if(world.skipButtonJustPressed()){
     this.skipState=SKIP_IN_PROGRESS;world.setPadCamera(true);
     world.fade(0,2.5);this.skipTimer=nowMs+SKIP_FADE_MS;world.showSkipMessage();
    }
    return;
   case SKIP_IN_PROGRESS:{
    if(nowMs<this.skipTimer)return;
    const distance=Math.hypot(at[0]-this.skipPosition[0],at[1]-this.skipPosition[1]);
    world.teleportForSkip(this.skipPosition,this.skipHeading);
    this.skipTimer=nowMs+SKIP_FADE_BACK_MS;world.clearHudMessage();
    world.passTime(Math.trunc(distance/20+23));
    if(this.skipToBeFinishedByScript){this.skipState=SKIP_WAITING_SCRIPT;world.setPadCamera(false);}
    else{world.fade(1,1.5);this.skipState=SKIP_FADING_OUT;}
    return;
   }
   case SKIP_FADING_OUT:
    if(nowMs>this.skipTimer){this.skipState=SKIP_NONE;world.setPadCamera(false);}
    return;
  }
 }
 /** One frame of CGameLogic::Update. `nowMs` is CTimer::GetTimeInMS and
  * `previousMs` CTimer::GetPreviousTimeInMS, both in game milliseconds.
  * `cityUnlocked` is STAT_CITY_UNLOCKED and `levelAt` CTheZones::GetLevelFromPosition. */
 update(nowMs:number,previousMs:number,world:GameLogicWorld,cityUnlocked:number,levelAt:(p:readonly [number,number,number])=>number){
  requireAsset(Number.isFinite(nowMs)&&Number.isFinite(previousMs)&&previousMs<=nowMs,'Invalid game-logic clock.');
  if(this.state===GAMELOGIC_STATE_PLAYING){
   if(world.isPlayerDead())this.beginEvent(GAMELOGIC_STATE_WASTED,nowMs,world);
   else if(world.isPlayerArrested())this.beginEvent(GAMELOGIC_STATE_BUSTED,nowMs,world);
  }
  const delta=nowMs-this.timeOfLastEvent;
  if(this.state===GAMELOGIC_STATE_WASTED){
   world.clearCrossHairs();
   if(delta<=WASTED_DELAY_MS)return this.state;
   this.fadeInIfNewEvent(previousMs,world);
   if(world.isFading())return this.state;
   if(this.penaltyForDeathApplies){
    if(!this.freeHealthCare)world.punish(HOSPITAL_FEE);else this.freeHealthCare=false;
   }
   const fallback={position:world.playerPosition(),heading:0};
   this.resurrect(world,this.restart.findClosestHospitalRestartPoint(world.playerPosition(),cityUnlocked,levelAt,fallback),this.restart.fadeInAfterNextDeath);
  }else if(this.state===GAMELOGIC_STATE_BUSTED){
   world.clearCrossHairs();
   if(delta>FADE_EVENT_WINDOW_MS)this.fadeInIfNewEvent(previousMs,world);
   if(!world.playerOnAMission?.()&&!this.bustedAudioStatus&&world.nextRandom){
    // Three times in four the generic bust line plays; otherwise one of the
    // twenty-eight numbered lines is advanced.
    if(randomIntInRange(world.nextRandom(),0,4)!==0)this.bustedAudioStatus=2;
    else{this.bustedAudioStatus=1;this.lastBustMessageNumber=this.lastBustMessageNumber%28+1;}
   }
   if(delta<BUSTED_DELAY_MS||world.isFading())return this.state;
   if(this.penaltyForArrestApplies){
    if(!this.getOutOfJailFree){
     const level=world.wantedLevel();
     requireAsset(Number.isInteger(level)&&level>=0&&level<POLICE_FEES.length,'Wanted level outside 0..6.');
     world.punish(POLICE_FEES[level]);
    }else this.getOutOfJailFree=false;
   }
   const fallback={position:world.playerPosition(),heading:0};
   this.resurrect(world,this.restart.findClosestPoliceRestartPoint(world.playerPosition(),cityUnlocked,levelAt,fallback),this.restart.fadeInAfterNextArrest);
  }
  return this.state;
 }
}
