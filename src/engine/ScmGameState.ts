import {ScmOnscreenTimer} from './ScmOnscreenTimer';
import {NativePlayerWheelStats} from '../simulation/nativeWheelStats';
import {ScmStuckCarCheck,ScmUpsideDownCarCheck} from './ScmCarChecks';
import {NativeAudioZones} from '../audio/nativeAudioZones';
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
import {ScmSearchlights} from './ScmSearchlights';
import {ScmScriptSpheres} from './ScmScriptSpheres';
import {ScmSetPieces} from './ScmSetPieces';
import {ScmPads} from './ScmPads';
import {ScmMenus} from './ScmMenus';
import {ScmCredits} from './ScmCredits';
import {ScmNodeSwitches} from './ScmNodeSwitches';
import {ScmStreamedScripts} from './ScmStreamedScripts';
import {ScmSequences} from './ScmSequences';
import {ScmVehicleRecordings} from './ScmVehicleRecordings';
import {ScmCutsceneTrack} from './ScmCutsceneTrack';
import type {CarRecordingPlaybackHost} from './carRecordingPlayback';
import {ScmAnimBlocks} from './ScmAnimBlocks';
import {ScmPickups} from './ScmPickups';
import {ScmGarageMessage,ScmGarages} from './ScmGarages';
import {ScmShopping} from './ScmShopping';
import {ScmScriptBrains} from './ScmScriptBrains';
import {ScmCheats} from './ScmCheats';
import {ScmClothes} from './ScmClothes';
import {ScmCardDecks} from './ScmCardDecks';
import {ScmPlayerInfo} from './ScmPlayerInfo';
import {ScmMissionAudio} from './ScmMissionAudio';
import {ScmDecisionMakers} from './ScmDecisionMakers';
import {ScmConversations} from './ScmConversations';
import {ScmCutscene,ScmSpecialCharacters} from './ScmCutscene';
import {ScmCheckpoints} from './ScmCheckpoints';
import {NativeWanted} from '../simulation/nativeWanted';

/* Script-visible game state ported from the pinned gta-reversed checkout
 * (0076f9017b4aeef7433957ac2bd8b6988e9df166). Each class mirrors one native
 * static, without rendering, HUD messages or save serialization. */

const STAT_FIRST_UNUSED=82,STAT_FIRST_INT=120,STAT_FLOAT_COUNT=82,STAT_INT_COUNT=223;
const STAT_MAX_HEALTH=24,STAT_STAMINA=22;
/** eStats ids the script's own commands name. */
export const STAT_PROGRESS_MADE=0,STAT_MISSION_ATTEMPTS=146,STAT_MISSIONS_PASSED=147,STAT_CALORIES=245,STAT_RIOT_MISSION_ACCOMPLISHED=335;
/** CStuntJumpManager::STUNT_JUMP_COUNT. */
const STUNT_JUMP_COUNT=256;
/** CStats::IsStatCapped (0x559630). */
const CAPPED_STATS=new Set([65,66,67,21,22,23,24,25,69,70,71,72,73,74,75,76,77,78,79,80,164,165,160,223,225,229,233,241,242,243,244,230]);

/** CStats value storage: StatTypesFloat[82] and StatTypesInt[223]. Stats at or
 * above FIRST_UNUSED_STAT but below FIRST_INT_STAT have no storage in PC 1.0. */
/** The player CStats::IncrementStat reads and heals for the food stats. */
export interface ScmStatsPlayer {health():number;maxHealth():number;addHealth(value:number):void;
 /** m_nNumHoursDidntEat = 0. */
 ateEnough():void}
const STAT_FAT=21,STAT_ENERGY=165,STAT_LUNG_CAPACITY=225;
/** STAT_COST_OF_PROPERTY_DAMAGED: the dollars of property the player wrecked. */
export const STAT_COST_OF_PROPERTY_DAMAGED=125;
export class ScmStats {
 player?:ScmStatsPlayer;
 /** CStats::DisplayScriptStatUpdateMessage, drawn by the host. */
 onUpdateMessage?:(increase:boolean,stat:number,value:number)=>void;
 readonly floats=new Float32Array(STAT_FLOAT_COUNT);
 readonly ints=new Int32Array(STAT_INT_COUNT);
 constructor(){
  // CStats::Init (0x55C0C0): only max health and stamina start non-zero.
  this.floats[STAT_MAX_HEALTH]=569;this.floats[STAT_STAMINA]=100;
 }
 /** Stats the host keeps elsewhere (the driving and weapon skills it persists), read and written through here so the
  * script and the game see one value; an int stat keeps its truncation. */
 private readonly bound=new Map<number,{get():number;set(value:number):void}>();
 bind(stat:number,store:{get():number;set(value:number):void}){this.check(stat);this.bound.set(stat,store);}
 private float(stat:number){const b=this.bound.get(stat);return b?Math.fround(b.get()):this.floats[stat];}
 private setFloat(stat:number,value:number){const b=this.bound.get(stat);if(b)b.set(Math.fround(value));else this.floats[stat]=value;}
 private int(stat:number){const b=this.bound.get(stat);return b?Math.trunc(b.get()):this.ints[stat-STAT_FIRST_INT];}
 private setInt(stat:number,value:number){const b=this.bound.get(stat);if(b)b.set(value);else this.ints[stat-STAT_FIRST_INT]=value;}
 static isFloat(stat:number){return stat<STAT_FIRST_UNUSED;}
 private check(stat:number){
  requireAsset(Number.isInteger(stat)&&stat>=0&&(stat<STAT_FIRST_UNUSED||stat>=STAT_FIRST_INT&&stat<STAT_FIRST_INT+STAT_INT_COUNT),`Stat ${stat} has no PC 1.0 storage.`);
 }
 /** CStats::GetStatValue (0x558E40): integers are returned through float. */
 get(stat:number){this.check(stat);return ScmStats.isFloat(stat)?this.float(stat):Math.fround(this.int(stat));}
 /** CStats::SetStatValue (0x55A070). CheckForStatsMessage is HUD-only. */
 set(stat:number,value:number){
  this.check(stat);requireAsset(Number.isFinite(value),'Stat values must be finite.');
  if(ScmStats.isFloat(stat))this.setFloat(stat,value);
  else{const truncated=Math.trunc(value);requireAsset(truncated>=-2147483648&&truncated<=2147483647,'Stat value overflows int32.');this.setInt(stat,truncated);}
 }
 /** CStats::IncrementStat (0x55C1B0): nothing happens for a value at or below zero, a capped stat stops at a
  * thousand. Food (STAT_CALORIES) heals through the health stat and turns what the player could not take into
  * half as much fat; the health stat adds to the player's health and, when it fills him, ends his hunger. */
 increment(stat:number,value:number){
  requireAsset(Number.isFinite(value),'Stat increments must be finite.');
  if(value<=0)return;
  if(stat===STAT_CALORIES||stat===STAT_RIOT_MISSION_ACCOMPLISHED){
   const player=this.player;requireAsset(!!player,'Calorie and health stat increments need the player.');
   const gap=player!.maxHealth()-player!.health();
   if(stat===STAT_CALORIES){this.increment(STAT_RIOT_MISSION_ACCOMPLISHED,value);if(value>gap)this.increment(STAT_FAT,(value-gap)/2);return;}
   if(value>=gap)player!.ateEnough();
   player!.addHealth(value);return;
  }
  this.check(stat);
  if(ScmStats.isFloat(stat)){
   let next=this.float(stat)+value;
   if(ScmStats.isCapped(stat))next=Math.min(next,1000);
   this.setFloat(stat,next);this.reactOnIncrement(stat);return;
  }
  let next=this.int(stat)+Math.trunc(value);
  if(ScmStats.isCapped(stat))next=Math.min(next,1000);
  this.setInt(stat,next);this.reactOnIncrement(stat);
 }
 /** CStats::ProcessReactionStatsOnIncrement: stamina or lung capacity gained on a negative energy burns 23 fat;
  * energy raised past a thousand puts the rest on as fat. */
 private reactOnIncrement(stat:number){
  if(stat!==STAT_STAMINA&&stat!==STAT_ENERGY&&stat!==STAT_LUNG_CAPACITY)return;
  const energy=this.get(STAT_ENERGY);
  if(stat===STAT_STAMINA||stat===STAT_LUNG_CAPACITY){if(energy<0)this.set(STAT_FAT,Math.max(this.get(STAT_FAT)-23,0));return;}
  if(energy>1000)this.increment(STAT_FAT,energy-1000);
 }
 /** CStats::DecrementStat (0x55C2E0): nothing happens for a value at or below zero, and a stat never goes
  * below nothing. */
 decrement(stat:number,value:number){
  requireAsset(Number.isFinite(value),'Stat decrements must be finite.');
  if(value<=0)return;
  this.set(stat,Math.max(this.get(stat)-value,0));
  // CStats::ProcessReactionStatsOnDecrement: energy lowered while negative burns 23 fat.
  if(stat===STAT_ENERGY&&this.get(STAT_ENERGY)<0)this.decrement(STAT_FAT,23);
 }
 /** CStats::SetNewRecordStat (0x55C410): only raises the stored value. */
 setNewRecord(stat:number,value:number){if(this.get(stat)<value)this.set(stat,value);}
 /** CStats::RegisterFastestTime and RegisterBestPosition (iOS 0x100261010 and 0x1002610ec): a stat still at 0 takes
  * the value, otherwise it keeps the lower of the two. gta-reversed routes both through SetNewRecordStat, which keeps
  * the higher; the executable does not. CheckForStatsMessage is HUD-only. */
 registerLowest(stat:number,value:number){const current=this.get(stat);this.set(stat,current===0?value:Math.min(current,value));}
 static isCapped(stat:number){return CAPPED_STATS.has(stat);}
}

/** CClock statics. The clock only advances through update(); scripts read the
 * hour/minute pair. Cheats, frozen time and days-passed stat are not modeled. */
export class ScmClock {
 hours=12;minutes=0;seconds=0;days=1;month=1;currentDay=4;lastTick=0;msPerMinute=1000;
 stored?:{hours:number;minutes:number;seconds:number;days:number;month:number};
 /** CClock::daysInMonth (0x8CCF24): February has 29 days every year. */
 private static readonly daysInMonth=[31,29,31,30,31,30,31,31,30,31,30,31];
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
 /** CClock::OffsetClockByADay (0x52D0B0): the day of the month and the weekday one on (or back), across the month and
  * year by the month table. */
 offsetByADay(forward:boolean){
  if(!forward){
   if(--this.days===0){if(--this.month===0)this.month=12;this.days=ScmClock.daysInMonth[this.month-1];}
   if(--this.currentDay===0)this.currentDay=7;
   return;
  }
  if(ScmClock.daysInMonth[this.month-1]<++this.days){if(++this.month>12)this.month=1;this.days=1;}
  if(++this.currentDay>7)this.currentDay=1;
 }
 /** CClock::GetGameClockMinutesUntil (0x52CEB0). */
 minutesUntil(hours:number,minutes:number){
  const now=this.hours*60+this.minutes;let then=hours*60+minutes;if(then<now)then+=24*60;return (then-now)&0xffff;
 }
 store(){this.stored={hours:this.hours,minutes:this.minutes,seconds:this.seconds,days:this.days,month:this.month};}
 /** One clock for the scripts and the world, as CClock is: the world's minutes of the day and weekday are the
  * clock's, a weekday change carrying the day and month as CClock::Update does at midnight. */
 follow(totalMinutes:number,weekDay:number){
  let passed=0;
  if(weekDay!==this.currentDay){this.currentDay=weekDay;this.days++;passed=1;if(this.days>=ScmClock.daysInMonth[this.month-1]){this.days=1;if(++this.month>12)this.month=1;}}
  const whole=Math.floor(totalMinutes);this.hours=Math.floor(whole/60)%24;this.minutes=whole%60;this.seconds=Math.floor((totalMinutes-whole)*60);
  // CClock::Update's midnight: STAT_DAYS_PASSED_IN_GAME up one, which the caller books (SetGameClock's own day is not it).
  return passed;
 }
 /** CClock::RestoreClock (0x52D070): copies the stored statics, which are zero until STORE_CLOCK. */
 restore(){Object.assign(this,this.stored??{hours:0,minutes:0,seconds:0,days:0,month:0});}
}

/** CWanted::SetMaximumWantedLevel (0x561E70) chaos table. */
const MAXIMUM_CHAOS=[0,115,365,875,1800,3500,6900];

export class ScmGameState {
 readonly stats=new ScmStats();
 /** CPlayerInfo's two-wheel, wheelie and stoppie counters, which the host runs each frame (CPlayerInfo::Process). */
 readonly wheelStats=new NativePlayerWheelStats((stat,value)=>this.stats.setNewRecord(stat,value));
 readonly clock=new ScmClock();
 // CWanted static initialisers (Wanted.cpp 0x561E70 region): level 6, chaos 9200.
 maximumWantedLevel=6;maximumChaosLevel=9200;
 /** CTheScripts::UnknownDebugStuff, which the debug command counts and nothing reads. */
 debugStuff=0;
 /** How many times the script dressed the player away from a shop. */
 clothesGivenOutsideShop=0;
 /** CWeather forced/old/new types, as CWeather::Init leaves them (EXTRASUNNY_LA, nothing forced). The script's own
  * copy: the rendered weather is not handed over while INTRO cannot finish (docs/FIDELITY_AUDIT.md). */
 forcedWeather=-1;oldWeather=0;newWeather=0;
 /** CCamera::SetFadeColour (0x50BF00): 2,2,2 selects the splash-screen target. */
 fadeColour={red:0,green:0,blue:0};fadeTargetIsSplashScreen=false;
 /** CTheScripts statics. OnAMissionFlag is a ScriptSpace byte offset. */
 onAMissionFlag=0;failCurrentMission=0;alreadyRunningAMissionScript=false;
 /** Set by unreversed 042C/030D/0997 handlers; kept as plain totals. */
 totalNumberOfMissions=0;progressTotal=0;missionRespectTotal=0;
 /** CHud::bScriptDontDisplayAreaName inverse. */
 displayAreaName=true;
 /** CHud::bScriptDontDisplayVehicleName, inverted (DISPLAY_CAR_NAMES). */
 displayVehicleName=true;
 /** CHud::bScriptDontDisplayRadar inverse, and CHud::SetZoneName's key from SET_AREA_NAME. */
 displayRadar=true;
 /** CTheScripts::RadarZoomValue: 0, or what SET_RADAR_ZOOM takes off the on-foot radar range. */
 radarZoom=0;areaName?:string;
 /** CPopulation::PedDensityMultiplier. */
 pedDensityMultiplier=1;
 /** CCullZones::bMilitaryZonesDisabled. */
 militaryZonesDisabled=false;
 /** CGarages::NoResprays and RespraysAreFree, which the garages read. */
 get noResprays(){return this.garages.noResprays;}
 set noResprays(on:boolean){this.garages.noResprays=on;}
 get freeResprays(){return this.garages.freeResprays;}
 set freeResprays(on:boolean){this.garages.freeResprays=on;}
 /** The cars the script has barred from a respray (SET_CAN_RESPRAY_CAR). */
 readonly resprayForbidden=new Set<number>();
 /** CCheat flags the script turns on: all taxis have nitro, and prostitutes pay the player. */
 /** CCheat::m_aCheatsActive, which the two cheat commands switch entries of. */
 readonly cheats=new ScmCheats();
 /** CClothes::PlayerClothes, the description the clothes commands dress. */
 readonly clothes=new ScmClothes();
 /** CPlayerInfo's script-facing fields, with the statics the player commands reach beside them. */
 readonly playerInfo=new ScmPlayerInfo(()=>this.wanted);
 /** CAEScriptAudioEntity's four mission-audio slots. */
 readonly missionAudio=new ScmMissionAudio();
 /** The decision makers a script loads, beyond the ones the game builds in. */
 readonly decisionMakers=new ScmDecisionMakers();
 /** CConversations' fourteen conversations and the nodes a script builds into them. */
 readonly conversations=new ScmConversations();
 /** The cutscene a script loads and runs, and the special-character slots it fills. */
 readonly cutscene=new ScmCutscene();
 /** The checkpoints a script places. */
 readonly checkpoints=new ScmCheckpoints();
 /** The vehicle models the script suppresses, and the respect a mission awarded. */
 readonly suppressedCarModels=new Set<number|string>();
 /** FORCE_ALL_VEHICLE_LIGHTS_OFF's byte (iOS 0x1008f80b0): while set, CVehicle::DoVehicleLights returns at once, so no
  * vehicle draws its lights and none changes vehicleFlags.bLightsOn. CTheScripts::Init and the restart clear it. */
 forceAllVehicleLightsOff=false;
 /** C3dMarkers::IgnoreRenderLimit, which SET_ALWAYS_DRAW_3D_MARKERS sets (C3dMarkers::ForceRender, 0x722870): the
  * markers draw past 150 units from the camera across the ground. */
 alwaysDraw3dMarkers=false;
 /** CPlayerPedData::m_bForceInteriorLighting (FORCE_INTERIOR_LIGHTING_FOR_PLAYER): CPhysical::GetLightingTotal lights
  * the player as indoors, as it does in any area but the outside. */
 playerForceInteriorLighting=false;
 missionRespect=0;
 /** Whether the player's gang is showing, which the two appear commands switch. */
 playerGangVisible=true;
 readonly specialCharacters=new ScmSpecialCharacters();
 /** Whether the mission the script is running has reported itself finished, and the key it passed on. */
 missionFinished=false;missionPassedKey?:string;
 /** CTheScripts::LastMissionPassedTime: when a mission or an odd job was last passed, -1 until one has been. CJ's
  * mood (CAEPedSpeechAudioEntity::GetCurrentCJMood) reads it. */
 lastMissionPassedTime=-1;
 /** What passing a mission or an odd job does besides naming it: the count of missions passed goes up and the time is
  * kept. */
 registerMissionPassed(nowMs:number){this.stats.increment(STAT_MISSIONS_PASSED,1);this.lastMissionPassedTime=nowMs>>>0;}
 /** The last PLAY_MISSION_PASSED_TUNE the script asked for, by the tune's number. */
 missionPassedTune?:number;
 /** SET_NEXT_DESIRED_MOVE_STATE: the eMoveState the next enter-car task walks or runs to the door at, back to
  * CTaskComplexEnterCar's PEDMOVE_RUN once a task has taken it. */
 nextDesiredMoveState=6;
 /** CTheScripts::bDisplayHud (DISPLAY_HUD). */
 displayHud=true;
 /** CUserDisplay::OnscnTimer: the mission clock and counters, on script globals. */
 readonly onscreenTimer=new ScmOnscreenTimer();
 /** The route a task follows, which EXTEND_ROUTE builds a point at a time and FLUSH_ROUTE empties. */
 readonly route:{x:number;y:number;z:number}[]=[];
 /** CTaskComplexFollowPatrolRoute's static CPatrolRoute (iOS 0x1008e4e68): EXTEND_PATROL_ROUTE adds a point and the clip
  * played there (none for "NONE"), at most eight; FLUSH_PATROL_ROUTE empties it. */
 readonly patrolRoute:{x:number;y:number;z:number;animationName:string;animationFile:string}[]=[];
 /** CCarCtrl::CarDensityMultiplier, beside the ped one. */
 carDensityMultiplier=1;
 /** CCarCtrl::bAllowEmergencyServicesToBeCreated, true from CCarCtrl::Init. */
 allowEmergencyServices=true;
 /** CTheScripts' card stack (SHUFFLE_CARD_DECKS, FETCH_NEXT_CARD). */
 readonly cards=new ScmCardDecks();
 /** TheCamera::m_bWideScreenOn and CGame::currArea, which the script switches. */
 widescreenOn=false;currentArea=0;
 /** CTheScripts::bAllowPauseInWidescreen (ALLOW_PAUSE_IN_WIDESCREEN): the pause menu opens through a widescreen scene
  * (planes.scm's flight). */
 allowPauseInWidescreen=false;
 /** CStats::bShowUpdateStats: whether the HUD draws the messages a stat change makes. */
 showUpdateStats=true;
 /** CTheScripts::bPlayerIsOffTheMap, which the stadium command sets. */
 playerIsOffTheMap=false;
 /** CVehicle::ms_fRailTrackResistance as a multiple of its default, which the script sets. */
 railTrackResistanceMultiplier=1;
 /** CPlayerInfo::m_nMoney, which the score commands add to and read back: the player's own purse once a host
  * binds it (bindMoney), so a reward reaches the HUD and a price is paid from what the player holds. */
 get money(){return this.moneyStore.get();}
 set money(value:number){this.moneyStore.set(value|0);}
 private moneyStore:{get():number;set(value:number):void}=(()=>{let value=0;return {get:()=>value,set:(v:number)=>{value=v;}};})();
 bindMoney(store:{get():number;set(value:number):void}){const before=this.money;this.moneyStore=store;if(before)store.set(store.get()+before);}
 /** CShopping: shopping.dat's prices and shops. */
 readonly shopping=new ScmShopping();
 /** CTheScripts::bDrawOddJobTitleBeforeFade. */
 drawOddJobTitleBeforeFade=true;
 /** CStreaming::m_bDisableCopBikes: StreamCopModels streams no bike cop while it is set. The browser's police do
  * not ride bikes yet, so nothing reads it. */
 disableCopBikes=false;
 /** CPlane's ambient plane generation (SWITCH_AMBIENT_PLANES); the browser generates none. */
 ambientPlanes=true;
 /** CStreaming::ms_disableStreaming (SWITCH_STREAMING off). */
 disableStreaming=false;
 /** SET_AREA51_SAM_SITE's switch (iOS 0x1001f8424 keeps it as bArea51SamSiteDisabled, clear at the start). */
 area51SamSite=true;
 /** SET_AIRCRAFT_CARRIER_SAM_SITE's switch (iOS 0x100205e2c keeps bAircraftCarrierSamSiteDisabled, set at the start). */
 aircraftCarrierSamSite=false;
 /** CGangWars::bCanTriggerGangWarWhenOnAMission. */
 canTriggerGangWarWhenOnAMission=false;
 /** CTheScripts::bUseMessageFormatting, and the margin and width SET_MESSAGE_FORMATTING gives with it. */
 messageFormatting={on:false,margin:0,width:0};
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
 /** CHud::bScriptForceDisplayWithCounters (FORCE_BIG_MESSAGE_AND_COUNTER): a big message shows while the on-screen
  * counters are up. The browser's HUD draws both anyway; the flag is kept for the script. */
 forceBigMessageAndCounter=false;
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
  // AddOne takes whatever it is given; with the pool full, CPool::New finds no slot and nothing is added.
  if(this.stuntJumps.length>=STUNT_JUMP_COUNT)return;
  requireAsset([...start.centre,...start.radius,...end.centre,...end.radius,...camera,reward].every(Number.isFinite),'Stunt jump values must be numbers.');
  const box=(centre:readonly number[],radius:readonly number[])=>({min:centre.map((v,k)=>v-radius[k]) as [number,number,number],max:centre.map((v,k)=>v+radius[k]) as [number,number,number]});
  this.stuntJumps.push({id:`jump:${offset}`,offset,start:box(start.centre,start.radius),end:box(end.centre,end.radius),camera:[camera[0],camera[1],camera[2]],reward});
 }
 /** CTheCarGenerators' array, filled by CREATE_CAR_GENERATOR and switched on by SWITCH_CAR_GENERATOR. */
 readonly carGenerators=new ScmCarGenerators();
 /** The CObjects a script created, standing in for their slots in the object pool. */
 readonly objects=new ScmObjects();
 /** CVehicleModelInfo's custom plate text and plate type, per vehicle model, which the next car of that model
  * takes. The text field holds eight characters and a terminator, so retail truncates what it is given. */
 readonly customPlates=new Map<number|string,{text?:string;design?:number}>();
 /** CIplStore: the placement groups a script asked for by name, and the ones it dropped. Each entry is the
  * dynamic-streaming flag the request and the removal set, which is what the routines do besides streaming. */
 readonly iplGroups=new Map<string,{requested:boolean;discreet:boolean}>();
 /** CBaseModelInfo::SetAnimFile: the animation block a model draws its animations from, by model. */
 readonly modelAnimFiles=new Map<number|string,string>();
 /** CScriptsForBrains: the streamed scripts waiting on an object, a ped or a name. */
 readonly scriptBrains=new ScmScriptBrains();
 /** CGarages as the script addresses them, once a host has loaded the world's own. */
 readonly garages=new ScmGarages();
 /** CGarages' message line, which blocks the help box while it shows. */
 readonly garageMessage=new ScmGarageMessage();
 /** CPopulation's random-creation switches: m_bDontCreateRandomGangMembers (SET_CREATE_RANDOM_GANG_MEMBERS) and
  * m_bDontCreateRandomCops (SET_CREATE_RANDOM_COPS), which CPopCycle::FindNewPedType reads, and
  * m_bOnlyCreateRandomGangMembers (SET_ONLY_CREATE_GANG_MEMBERS). */
 readonly population={dontCreateRandomGangMembers:false,dontCreateRandomCops:false,onlyCreateRandomGangMembers:false};
 /** CGangWars::bTrainingMission (SET_GANG_WARS_TRAINING_MISSION): a war starts only in the training zone, and no
  * defensive attack counts down. */
 gangWarsTrainingMission=false;
 /** CTrain::bDisableRandomTrains, which SWITCH_RANDOM_TRAINS sets. */
 disableRandomTrains=false;
 /** CDarkel::RegisteredKills for player 0: the models of the peds and vehicles the player has killed or blown up, and
  * how many of each (an int16 a slot). */
 private readonly registeredKills=new Map<number,number>();
 registerKill(modelId:number){this.registeredKills.set(modelId,((this.registeredKills.get(modelId)??0)+1)<<16>>16);}
 /** CDarkel::QueryModelsKilledByPlayer. */
 modelsKilledByPlayer(modelId:number){return this.registeredKills.get(modelId)??0;}
 /** CDarkel::FindTotalPedsKilledByPlayer (0x43D6E0): every model's count summed. */
 totalPedsKilledByPlayer(){let sum=0;for(const n of this.registeredKills.values())sum+=n;return sum;}
 /** CDarkel::ResetModelsKilledByPlayer. */
 resetModelsKilledByPlayer(){this.registeredKills.clear();}
 /** CLoadMonitor::m_bEnableAmbientCrime, which ENABLE_AMBIENT_CRIME sets. */
 enableAmbientCrime=true;
 /** CTheScripts::UpsideDownCars and StuckCars. */
 readonly upsideDownCars=new ScmUpsideDownCarCheck();
 readonly stuckCars=new ScmStuckCarCheck();
 /** CAudioZones, which SWITCH_AUDIO_ZONE turns on and off by name. */
 readonly audioZones=new NativeAudioZones();
 /** The pickups a script placed, which the file reader also reads statically. */
 readonly pickups=new ScmPickups();
 /** CAnimManager's animation blocks, which a script requests by name. */
 readonly animBlocks=new ScmAnimBlocks();
 /** CVehicleRecording's files and its sixteen playback slots. */
 readonly vehicleRecordings=new ScmVehicleRecordings();
 /** CAECutsceneTrackManager, which the beat tracks play through. */
 readonly cutsceneTrack=new ScmCutsceneTrack();
 /** The cars a playback moves and the frames it reads, which the host gives. Without them the commands keep only
  * the slots. */
 carRecordingVehicles?:Omit<CarRecordingPlaybackHost,'recordings'>;
 get carRecordingHost():CarRecordingPlaybackHost|undefined{
  const v=this.carRecordingVehicles;
  return v&&{recordings:this.vehicleRecordings,frames:n=>v.frames(n),vehicle:h=>v.vehicle(h)};
 }
 /** CTaskSequences' sixty-four sequences, which a script records tasks into. */
 readonly sequences=new ScmSequences();
 /** CStreamedScripts' registry of the external script files beside MAIN.SCM. */
 readonly streamedScripts=new ScmStreamedScripts();
 /** CPathFind's node switches: the areas the script turned its car or pedestrian paths off in. */
 readonly nodeSwitches=new ScmNodeSwitches();
 /** CPad as the script reads it, which a host fills from its own controls. */
 readonly pads=new ScmPads();
 /** CInteriorManager_c's peds switch (ACTIVATE_INTERIOR_PEDS), on unless a script turns it off. */
 interiorPedsActive=true;
 /** CMenuSystem's two script menus. */
 readonly menus=new ScmMenus();
 /** CCredits: the end credits START_CREDITS rolls. */
 readonly credits=new ScmCredits();
 /** CSetPieces' table of armed ambushes. */
 readonly setPieces=new ScmSetPieces();
 /** CWanted for the player the script alters. A host hands over the player's own with useWanted; until then the
  * runtime keeps one of its own. */
 wanted=new NativeWanted();
 /** Adopt the player's CWanted, carrying over what the script has set on it so far. */
 useWanted(wanted:NativeWanted){
  wanted.setMaximumWantedLevel(this.wanted.maximumWantedLevel);wanted.maximumChaos=this.wanted.maximumChaos;wanted.multiplier=this.wanted.multiplier;
  wanted.policeBackOff=this.wanted.policeBackOff;wanted.everybodyBackOff=this.wanted.everybodyBackOff;this.wanted=wanted;
 }
 /** CWanted::m_fMultiplier: the scale on how fast the wanted level rises. */
 get wantedMultiplier(){return this.wanted.multiplier;}
 set wantedMultiplier(value:number){this.wanted.multiplier=value;}
 /** CFireManager's sixty slots, the ones a script starts among them. */
 readonly fires=new ScmFires();
 /** CTheScripts::ScriptSearchLightArray (CREATE_SEARCHLIGHT and the rest). */
 readonly searchlights=new ScmSearchlights();
 /** CTheScripts::ScriptSphereArray (ADD_SPHERE, REMOVE_SPHERE). */
 readonly scriptSpheres=new ScmScriptSpheres();
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
  this.help.blocked=()=>!!this.messages.big[STYLE_MIDDLE_SMALLER_HIGHER][0]||this.garageMessage.showing||!!this.helpMessageBlocked?.();
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
  this.maximumWantedLevel=level;this.maximumChaosLevel=MAXIMUM_CHAOS[level];this.wanted.setMaximumWantedLevel(level);
 }
 /** The one CWeather: the world's weather, which the script's forcing and releasing reach as the cheats' do. */
 weatherHost?:{forceWeather(type:number):void;forceWeatherNow(type:number):void;releaseWeather():void};
 /** CWeather::ForceWeatherNow (0x72A4F0). */
 forceWeatherNow(type:number){this.forcedWeather=type;this.oldWeather=type;this.newWeather=type;this.weatherHost?.forceWeatherNow(type);}
 /** CWeather::ForceWeather (0x72A4E0 region): only the forced type changes. */
 forceWeather(type:number){this.forcedWeather=type;this.weatherHost?.forceWeather(type);}
 /** CWeather::ReleaseWeather (0x72A510). */
 releaseWeather(){this.forcedWeather=-1;this.weatherHost?.releaseWeather();}
 setFadeColour(red:number,green:number,blue:number){
  this.fadeTargetIsSplashScreen=red===2&&green===2&&blue===2;
  this.fadeColour={red:red&255,green:green&255,blue:blue&255};
 }
}
