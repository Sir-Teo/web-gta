import {requireAsset} from '../assets/binary';
import {ScmHelpMessage,ScmIntroRectangles,ScmIntroText,ScmMessages,STYLE_MIDDLE_SMALLER_HIGHER} from './ScmMessages';
import {ScmRadar} from './ScmRadar';
import {NativeRestart} from '../simulation/nativeRestart';
import type {ScmStuntJump} from '../assets/scmStuntJumps';
import {ScmCarGenerators} from './ScmCarGenerators';
import {ScmObjects} from './ScmObjects';
import {ScmZones} from './ScmZones';
import {ScmCamera} from './ScmCamera';
import {ScmFires} from './ScmFires';
import {NativeWanted} from '../simulation/nativeWanted';

/* Script-visible game state ported from the pinned gta-reversed checkout
 * (0076f9017b4aeef7433957ac2bd8b6988e9df166). Each class mirrors one native
 * static, without rendering, HUD messages or save serialization. */

const STAT_FIRST_UNUSED=82,STAT_FIRST_INT=120,STAT_FLOAT_COUNT=82,STAT_INT_COUNT=223;
const STAT_MAX_HEALTH=24,STAT_STAMINA=22;
/** eStats ids the script's own commands name. */
export const STAT_PROGRESS_MADE=0,STAT_MISSION_ATTEMPTS=146,STAT_CALORIES=245,STAT_RIOT_MISSION_ACCOMPLISHED=335;
/** CStuntJumpManager::STUNT_JUMP_COUNT. */
const STUNT_JUMP_COUNT=256;
/** CStats::IsStatCapped (0x559630). */
const CAPPED_STATS=new Set([65,66,67,21,22,23,24,25,69,70,71,72,73,74,75,76,77,78,79,80,164,165,160,223,225,229,233,241,242,243,244,230]);

/** CStats value storage: StatTypesFloat[82] and StatTypesInt[223]. Stats at or
 * above FIRST_UNUSED_STAT but below FIRST_INT_STAT have no storage in PC 1.0. */
export class ScmStats {
 readonly floats=new Float32Array(STAT_FLOAT_COUNT);
 readonly ints=new Int32Array(STAT_INT_COUNT);
 constructor(){
  // CStats::Init (0x55C0C0): only max health and stamina start non-zero.
  this.floats[STAT_MAX_HEALTH]=569;this.floats[STAT_STAMINA]=100;
 }
 static isFloat(stat:number){return stat<STAT_FIRST_UNUSED;}
 private check(stat:number){
  requireAsset(Number.isInteger(stat)&&stat>=0&&(stat<STAT_FIRST_UNUSED||stat>=STAT_FIRST_INT&&stat<STAT_FIRST_INT+STAT_INT_COUNT),`Stat ${stat} has no PC 1.0 storage.`);
 }
 /** CStats::GetStatValue (0x558E40): integers are returned through float. */
 get(stat:number){this.check(stat);return ScmStats.isFloat(stat)?this.floats[stat]:Math.fround(this.ints[stat-STAT_FIRST_INT]);}
 /** CStats::SetStatValue (0x55A070). CheckForStatsMessage is HUD-only. */
 set(stat:number,value:number){
  this.check(stat);requireAsset(Number.isFinite(value),'Stat values must be finite.');
  if(ScmStats.isFloat(stat))this.floats[stat]=value;
  else{const truncated=Math.trunc(value);requireAsset(truncated>=-2147483648&&truncated<=2147483647,'Stat value overflows int32.');this.ints[stat-STAT_FIRST_INT]=truncated;}
 }
 /** CStats::IncrementStat (0x55C1B0): nothing happens for a value at or below zero, a capped stat stops at a
  * thousand, and the two stats that feed the player's health and hunger are left to the host, since they read
  * the player rather than the table. */
 increment(stat:number,value:number){
  requireAsset(Number.isFinite(value),'Stat increments must be finite.');
  if(value<=0)return;
  requireAsset(stat!==STAT_CALORIES&&stat!==STAT_RIOT_MISSION_ACCOMPLISHED,'Calorie and health stat increments read the player, not the stat table.');
  this.check(stat);
  if(ScmStats.isFloat(stat)){
   let next=this.floats[stat]+value;
   if(ScmStats.isCapped(stat))next=Math.min(next,1000);
   this.floats[stat]=next;return;
  }
  let next=this.ints[stat-STAT_FIRST_INT]+Math.trunc(value);
  if(ScmStats.isCapped(stat))next=Math.min(next,1000);
  this.ints[stat-STAT_FIRST_INT]=next;
 }
 /** CStats::DecrementStat (0x55C2E0): nothing happens for a value at or below zero, and a stat never goes
  * below nothing. */
 decrement(stat:number,value:number){
  requireAsset(Number.isFinite(value),'Stat decrements must be finite.');
  if(value<=0)return;
  this.set(stat,Math.max(this.get(stat)-value,0));
 }
 /** CStats::SetNewRecordStat (0x55C410): only raises the stored value. */
 setNewRecord(stat:number,value:number){if(this.get(stat)<value)this.set(stat,value);}
 static isCapped(stat:number){return CAPPED_STATS.has(stat);}
}

/** CClock statics. The clock only advances through update(); scripts read the
 * hour/minute pair. Cheats, frozen time and days-passed stat are not modeled. */
export class ScmClock {
 hours=12;minutes=0;seconds=0;days=1;month=1;currentDay=4;lastTick=0;msPerMinute=1000;
 stored?:{hours:number;minutes:number;seconds:number;days:number;month:number};
 private static readonly daysInMonth=[31,28,31,30,31,30,31,31,30,31,30,31];
 /** CClock::Initialise (0x52CD90). */
 initialise(msPerMinute:number,nowMs:number){
  requireAsset(Number.isInteger(msPerMinute)&&msPerMinute>0,'Invalid clock rate.');
  this.msPerMinute=msPerMinute;this.month=1;this.days=1;this.lastTick=nowMs>>>0;this.hours=12;this.minutes=0;this.seconds=0;this.stored=undefined;this.currentDay=4;
 }
 /** CClock::SetGameClock (0x52D150). Day zero leaves the weekday alone. */
 setGameClock(hours:number,minutes:number,day:number,nowMs:number){
  this.lastTick=nowMs>>>0;this.hours=hours&255;this.minutes=minutes&255;
  if(day&255){this.currentDay=day&255;this.days=(this.days+1)&255;}
  this.seconds=0;this.normalise();
 }
 /** CClock::NormaliseGameClock (0x52CDE0). Uses 31-day carry, not the month table. */
 normalise(){
  if(this.seconds>=60){this.minutes=(this.minutes+Math.trunc(this.seconds/60))&255;this.seconds%=60;}
  if(this.minutes>=60){this.hours=(this.hours+Math.trunc(this.minutes/60))&255;this.minutes%=60;}
  if(this.hours>=24){this.days=(this.days+Math.trunc(this.hours/24))&255;this.hours%=24;}
  if(this.days>31){this.days=1;this.month=(this.month+1)&255;}
  if(this.month>12)this.month=1;
 }
 /** CClock::Update (0x52CF10) without cheats or the days-passed stat. */
 update(nowMs:number){
  nowMs=nowMs>>>0;
  if(this.msPerMinute<((nowMs-this.lastTick)>>>0)){
   this.minutes++;this.lastTick=(this.lastTick+this.msPerMinute)>>>0;
   if(this.minutes>=60){
    this.minutes=0;this.hours++;
    if(this.hours>=24){
     this.hours=0;this.days++;this.currentDay=this.currentDay===7?1:this.currentDay+1;
     if(this.days>=ScmClock.daysInMonth[this.month-1]){this.days=1;if(++this.month>12)this.month=1;}
    }
   }
  }
  this.seconds=Math.trunc(((nowMs-this.lastTick)>>>0)*60/this.msPerMinute)&0xffff;
 }
 /** CClock::GetGameClockMinutesUntil (0x52CEB0). */
 minutesUntil(hours:number,minutes:number){
  const now=this.hours*60+this.minutes;let then=hours*60+minutes;if(then<now)then+=24*60;return (then-now)&0xffff;
 }
 store(){this.stored={hours:this.hours,minutes:this.minutes,seconds:this.seconds,days:this.days,month:this.month};}
 restore(){requireAsset(this.stored,'RESTORE_CLOCK without a stored clock.');Object.assign(this,this.stored);}
}

/** CWanted::SetMaximumWantedLevel (0x561E70) chaos table. */
const MAXIMUM_CHAOS=[0,115,365,875,1800,3500,6900];

export class ScmGameState {
 readonly stats=new ScmStats();
 readonly clock=new ScmClock();
 // CWanted static initialisers (Wanted.cpp 0x561E70 region): level 6, chaos 9200.
 maximumWantedLevel=6;maximumChaosLevel=9200;
 /** CWeather forced/old/new types; -1 is WEATHER_UNDEFINED. */
 forcedWeather=-1;oldWeather=-1;newWeather=-1;
 /** CCamera::SetFadeColour (0x50BF00): 2,2,2 selects the splash-screen target. */
 fadeColour={red:0,green:0,blue:0};fadeTargetIsSplashScreen=false;
 /** CTheScripts statics. OnAMissionFlag is a ScriptSpace byte offset. */
 onAMissionFlag=0;failCurrentMission=0;alreadyRunningAMissionScript=false;
 /** Set by unreversed 042C/030D/0997 handlers; kept as plain totals. */
 totalNumberOfMissions=0;progressTotal=0;missionRespectTotal=0;
 /** CHud::bScriptDontDisplayAreaName inverse. */
 displayAreaName=true;
 /** CHud::bScriptDontDisplayRadar inverse, and CHud::SetZoneName's key from SET_AREA_NAME. */
 displayRadar=true;areaName?:string;
 /** CPopulation::PedDensityMultiplier. */
 pedDensityMultiplier=1;
 /** CCullZones::bMilitaryZonesDisabled and CGarages::NoResprays. */
 militaryZonesDisabled=false;noResprays=false;
 /** CCheat flags the script turns on: all taxis have nitro, and prostitutes pay the player. */
 allTaxisHaveNitro=false;prostitutesPayYou=false;
 /** CPlayerInfo::m_nMoney, which the score commands add to and read back. */
 money=0;
 /** CTheScripts::bDrawOddJobTitleBeforeFade. */
 drawOddJobTitleBeforeFade=false;
 /** CWeapon::ms_bTakePhoto with CPostEffects::m_bSavePhotoFromScript. */
 takePhoto=false;savePhotoFromScript=false;
 /** FrontEndMenuManager.m_bWidescreenOn, which the script can read. */
 widescreen=false;
 /** FrontEndMenuManager.m_nPrefsLanguage: 0 is AMERICAN; subtitles default on. */
 language=0;showSubtitles=true;
 /** CMessages queues, CHud help message and CTheScripts intro text lines. */
 readonly messages=new ScmMessages();
 readonly help=new ScmHelpMessage();
 readonly introText=new ScmIntroText();
 /** CTheScripts::IntroRectangles and ScriptSprites: the script's own sprites and boxes for this frame. */
 readonly introRectangles=new ScmIntroRectangles();
 /** CTheScripts::Init text flags. */
 addNextMessageToPreviousBriefs=true;displayNonMiniGameHelpMessages=true;miniGameInProgress=false;drawSubtitlesBeforeFade=true;
 /** CHud::m_ItemToFlash raw eHudItem value. */
 hudItemToFlash=0;
 /** CRestart's restart tables and override state, filled by the script's ADD_HOSPITAL_RESTART and
  * ADD_POLICE_RESTART calls in INITIAL. */
 readonly restart=new NativeRestart();
 /** CStuntJumpManager's pool: 256 slots filled by ADD_STUNT_JUMP, each a start box, a landing box, the fixed
  * camera position and the reward. */
 readonly stuntJumps:ScmStuntJump[]=[];
 /** CStuntJumpManager::AddOne (0x49CB40). The command passes each box as a centre and a positive radius; the
  * stored box is centre - radius to centre + radius. The save key is the command's own script offset. */
 addStuntJump(offset:number,start:{centre:readonly number[];radius:readonly number[]},end:{centre:readonly number[];radius:readonly number[]},camera:readonly number[],reward:number){
  requireAsset(this.stuntJumps.length<STUNT_JUMP_COUNT,'CStuntJumpManager holds 256 jumps.');
  requireAsset(start.radius.every(v=>v>0)&&end.radius.every(v=>v>0),'Stunt jump radii must be positive.');
  requireAsset(Number.isInteger(reward)&&reward>=0,'Invalid stunt jump reward.');
  const box=(centre:readonly number[],radius:readonly number[])=>({min:centre.map((v,k)=>v-radius[k]) as [number,number,number],max:centre.map((v,k)=>v+radius[k]) as [number,number,number]});
  this.stuntJumps.push({id:`jump:${offset}`,offset,start:box(start.centre,start.radius),end:box(end.centre,end.radius),camera:[camera[0],camera[1],camera[2]],reward});
 }
 /** CTheCarGenerators' array, filled by CREATE_CAR_GENERATOR and switched on by SWITCH_CAR_GENERATOR. */
 readonly carGenerators=new ScmCarGenerators();
 /** The CObjects a script created, standing in for their slots in the object pool. */
 readonly objects=new ScmObjects();
 /** CWanted for the player the script alters: the browser's own port, driven from here. */
 readonly wanted=new NativeWanted();
 /** CFireManager's sixty slots, the ones a script starts among them. */
 readonly fires=new ScmFires();
 /** TheCamera's script-facing state, which a host applies to the camera it draws with. */
 readonly camera=new ScmCamera();
 /** CTheZones' info zones, once a host has loaded the world's labels. */
 readonly zones=new ScmZones();
 /** CGangWars::ZoneInfoForTraining and aSpecificZones, which the zone commands set by label. */
 gangWarTrainingZone=-1;
 readonly specificGangWarZones:number[]=[];
 /** CRadar blip table plus the CTheScripts radar flags. */
 readonly radar=new ScmRadar();
 radarShowBlipOnAllLevels=false;hideAllFrontEndMapBlips=false;
 /** CTheScripts switch statement statics (SwitchJumpTable of 75 cases). */
 readonly switchCases:{value:number;label:number}[]=[];
 switchEntriesToRead=0;switchValue=0;switchDefaultExists=false;switchDefaultAddress=0;
 /** External conditions SetHelpMessage consults besides the queued title. */
 helpMessageBlocked?:()=>boolean;
 constructor(){
  // SetHelpMessage bails while a mission title (STYLE_MIDDLE_SMALLER_HIGHER)
  // is queued, a garage message shows, a replay plays or a cutscene runs.
  this.help.blocked=()=>!!this.messages.big[STYLE_MIDDLE_SMALLER_HIGHER][0]||!!this.helpMessageBlocked?.();
 }
 /** CTheScripts::ReinitialiseSwitchStatementData (0x470370). */
 reinitialiseSwitch(){this.switchEntriesToRead=0;this.switchValue=0;this.switchDefaultExists=false;this.switchDefaultAddress=0;this.switchCases.length=0;}
 /** CTheScripts::AddToSwitchJumpTable (0x470390). */
 addSwitchCase(value:number,label:number){requireAsset(this.switchCases.length<75,'SwitchJumpTable holds 75 cases.');this.switchCases.push({value,label});}
 /** CTheScripts::UseSwitchJumpTable (0x4703C0): binary search over the sorted
  * cases, then the two bracketing entries, else the default address. The
  * table state is reinitialised on every exit. */
 useSwitchJumpTable(){
  const cases=this.switchCases,value=this.switchValue;
  requireAsset(cases.length>0,'A switch without cases indexes the table with an unsigned wrap in the source.');
  const take=(label:number)=>{this.reinitialiseSwitch();return label;};
  let low=0,high=cases.length-1;
  while(high-low>1){
   const middle=Math.trunc((low+high)/2);
   if(cases[middle].value===value)return take(cases[middle].label);
   if(value<=cases[middle].value)high=middle;else low=middle;
  }
  if(cases[high].value===value)return take(cases[high].label);
  if(cases[low].value===value)return take(cases[low].label);
  return take(this.switchDefaultAddress);
 }
 setMaximumWantedLevel(level:number){
  requireAsset(Number.isInteger(level)&&level>=0&&level<=6,'SET_MAX_WANTED_LEVEL outside 0..6 is unreachable in the source.');
  this.maximumWantedLevel=level;this.maximumChaosLevel=MAXIMUM_CHAOS[level];this.wanted.maximumChaos=this.maximumChaosLevel;
 }
 /** CWeather::ForceWeatherNow (0x72A4F0). */
 forceWeatherNow(type:number){this.forcedWeather=type;this.oldWeather=type;this.newWeather=type;}
 /** CWeather::ForceWeather (0x72A4E0 region): only the forced type changes. */
 forceWeather(type:number){this.forcedWeather=type;}
 /** CWeather::ReleaseWeather (0x72A510). */
 releaseWeather(){this.forcedWeather=-1;}
 setFadeColour(red:number,green:number,blue:number){
  this.fadeTargetIsSplashScreen=red===2&&green===2&&blue===2;
  this.fadeColour={red:red&255,green:green&255,blue:blue&255};
 }
}
