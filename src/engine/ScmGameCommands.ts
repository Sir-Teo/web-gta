import type {ScmInstruction,ScmParameter} from '../assets/scm';
import {requireAsset} from '../assets/binary';
import {scmOpcode} from './scmOpcodes';
import {USE_TEXT_DISABLE_NEXT_FRAME,USE_TEXT_ENABLED_BY_SCRIPT} from './ScmMessages';
import {BLIP_CAR,BLIP_CHAR,BLIP_CONTACT_POINT,BLIP_COORD,BLIP_DISPLAY_BLIPONLY,BLIP_DISPLAY_BOTH,BLIP_OBJECT,BLIP_PICKUP} from './ScmRadar';
import {STAT_MISSION_ATTEMPTS,STAT_PROGRESS_MADE} from './ScmGameState';
import {CONTROLLER_JOYPAD} from './ScmPads';
import {switchArea} from './ScmNodeSwitches';
import {ScmCamera} from './ScmCamera';
import {UnsupportedScmCommand,type ScmThread,type ScmWorldCommands} from './ScmThread';

export type ScmCommandHandler=(thread:ScmThread,p:ScmParameter[],i:ScmInstruction,nowMs:number)=>void;

/* Command families beyond the numeric/control core. Source references are
 * the pinned gta-reversed checkout 0076f9017b4aeef7433957ac2bd8b6988e9df166.
 * "Handler unreversed" means the pinned checkout still dispatches that
 * command to the retail executable; the port then follows the underlying
 * engine routine or the static field the command is documented to set. */

function game(thread:ScmThread,i:ScmInstruction){
 const state=thread.host?.game;if(!state)throw new UnsupportedScmCommand(i.offset,i.opcode&0x7fff,i.name,'no game state');return state;
}
function world<K extends keyof ScmWorldCommands>(thread:ScmThread,i:ScmInstruction,method:K):NonNullable<ScmWorldCommands[K]>{
 const adapter=thread.host?.world?.[method];
 if(!adapter)throw new UnsupportedScmCommand(i.offset,i.opcode&0x7fff,i.name,`world adapter lacks ${method}`);
 return adapter as NonNullable<ScmWorldCommands[K]>;
}
const negated=(i:ScmInstruction)=>!!(i.opcode&0x8000);
const vec=(t:ScmThread,p:ScmParameter[],at:number)=>({x:t.readFloat(p[at]),y:t.readFloat(p[at+1]),z:t.readFloat(p[at+2])});
/** Blip command dispatch is unreversed. The display flag defaults follow the
 * conventional handler behaviour: plain adds show blip and marker, sprite
 * adds show the blip only. CRadar itself ignores the colour argument. */
function entityBlip(type:number):ScmCommandHandler{return (t,p,i)=>{t.writeInt(p[1],game(t,i).radar.setEntityBlip(type,t.readInt(p[0]),BLIP_DISPLAY_BOTH)|0);};}
function spriteBlip(type:number,shortRange:boolean):ScmCommandHandler{
 return (t,p,i)=>{
  const {radar}=game(t,i),position=vec(t,p,0),blip=shortRange?radar.setShortRangeCoordBlip(type,position,BLIP_DISPLAY_BLIPONLY):radar.setCoordBlip(type,position,BLIP_DISPLAY_BLIPONLY);
  radar.setSprite(blip,t.readInt(p[3]));t.writeInt(p[4],blip|0);
 };
}
const bool=(thread:ScmThread,p:ScmParameter)=>thread.readInt(p)!==0;
const rgba=(t:ScmThread,p:ScmParameter[],at:number):[number,number,number,number]=>[t.readInt(p[at])&255,t.readInt(p[at+1])&255,t.readInt(p[at+2])&255,t.readInt(p[at+3])&255];
/** Six insertable numbers from `count` operands starting at `at`; -1 pads. */
const insertable=(t:ScmThread,p:ScmParameter[],at:number,count:number)=>Array.from({length:6},(_,k)=>k<count?t.readInt(p[at+k]):-1);
/** ReadArg script::Model: negative ids index the header's used-object names. */
function model(t:ScmThread,i:ScmInstruction,p:ScmParameter){
 const id=t.readInt(p);if(id>=0)return id;
 const names=t.host?.objectNames;
 if(!names)throw new UnsupportedScmCommand(i.offset,i.opcode&0x7fff,i.name,'no used-object table');
 requireAsset(-id<names.length,'Script model id outside the used-object table.');return names[-id];
}
/** Print/PrintNow: subtitle-only text is dropped while subtitles are off. */
function subtitleAllowed(t:ScmThread,i:ScmInstruction,key:string){
 const state=game(t,i);if(state.showSubtitles)return true;
 const text=t.host?.world?.resolveText?.(key);return !text||!text.startsWith('~z~');
}
/** PrintHelp / PrintHelpForever gate on minigame help suppression. */
const helpAllowed=(t:ScmThread,i:ScmInstruction)=>{const g=game(t,i);return g.displayNonMiniGameHelpMessages||t.isTextBlockOverride||!g.miniGameInProgress;};
function printWithNumbers(count:number,mode:'queue'|'now'|'big'):ScmCommandHandler{
 return (t,p,i,now)=>{
  const g=game(t,i),key=t.text(p[0]),values=insertable(t,p,1,count),time=t.readInt(p[1+count]),last=t.readInt(p[2+count]);
  if(mode==='big'){g.messages.addBigMessage2(key,time,(last&0xffff)-1,true,now,undefined,values);return;}
  if(mode==='now')g.messages.addMessageJumpQWithNumber(key,time,last,values,g.addNextMessageToPreviousBriefs,now);
  else g.messages.addMessageWithNumberQ(key,time,last,values,g.addNextMessageToPreviousBriefs,now);
  g.addNextMessageToPreviousBriefs=true;
 };
}
function displayTextWithNumbers(count:number):ScmCommandHandler{
 return (t,p,i)=>{const values=insertable(t,p,3,count);game(t,i).introText.display(t.readFloat(p[0]),t.readFloat(p[1]),t.text(p[2]),values[0],values[1]);};
}

const handlers:Record<string,ScmCommandHandler>={
 // --- CTheScripts / mission lifecycle -----------------------------------
 // Handlers unreversed; each sets one documented static.
 SET_TOTAL_NUMBER_OF_MISSIONS:(t,p,i)=>{game(t,i).totalNumberOfMissions=t.readInt(p[0]);},
 SET_PROGRESS_TOTAL:(t,p,i)=>{game(t,i).progressTotal=t.readInt(p[0]);},
 SET_MISSION_RESPECT_TOTAL:(t,p,i)=>{game(t,i).missionRespectTotal=t.readInt(p[0]);},
 /** OnAMissionFlag stores the ScriptSpace offset that IsPlayerOnAMission reads. */
 DECLARE_MISSION_FLAG:(t,p,i)=>{game(t,i).onAMissionFlag=t.globalOffset(p[0]);},
 /** m_IsDeathArrestCheckEnabled on the executing thread. */
 SET_DEATHARREST_STATE:(t,p)=>{t.deathArrestEnabled=bool(t,p[0]);},
 /** GameCommands.cpp FailCurrentMission: the counter starts at 2. */
 FAIL_CURRENT_MISSION:(t,_p,i)=>{game(t,i).failCurrentMission=2;},
 // --- CWanted -----------------------------------------------------------
 SET_MAX_WANTED_LEVEL:(t,p,i)=>{game(t,i).setMaximumWantedLevel(t.readInt(p[0]));},
 // --- CClock (ClockCommands.cpp) ----------------------------------------
 SET_TIME_OF_DAY:(t,p,i,now)=>{game(t,i).clock.setGameClock(t.readInt(p[0]),t.readInt(p[1]),0,now);},
 GET_TIME_OF_DAY:(t,p,i)=>{const {clock}=game(t,i);t.writeInt(p[0],clock.hours);t.writeInt(p[1],clock.minutes);},
 GET_MINUTES_TO_TIME_OF_DAY:(t,p,i)=>{t.writeInt(p[2],game(t,i).clock.minutesUntil(t.readInt(p[0])&255,t.readInt(p[1])&255));},
 STORE_CLOCK:(t,_p,i)=>{game(t,i).clock.store();},
 RESTORE_CLOCK:(t,_p,i)=>{game(t,i).clock.restore();},
 // --- CStats (StatCommands.cpp). DisplayScriptStatUpdateMessage is HUD-only.
 // SetStat<int32> converts through float before SetStatValue truncates again.
 SET_INT_STAT:(t,p,i)=>{game(t,i).stats.set(t.readInt(p[0]),Math.fround(t.readInt(p[1])));},
 SET_FLOAT_STAT:(t,p,i)=>{game(t,i).stats.set(t.readInt(p[0]),t.readFloat(p[1]));},
 REGISTER_INT_STAT:(t,p,i)=>{game(t,i).stats.setNewRecord(t.readInt(p[0]),Math.fround(t.readInt(p[1])));},
 REGISTER_FLOAT_STAT:(t,p,i)=>{game(t,i).stats.setNewRecord(t.readInt(p[0]),t.readFloat(p[1]));},
 GET_INT_STAT:(t,p,i)=>{
  const value=Math.trunc(game(t,i).stats.get(t.readInt(p[0])));
  requireAsset(value>=-2147483648&&value<=2147483647,'GET_INT_STAT float-to-int conversion out of range.');
  t.writeInt(p[1],value);
 },
 GET_FLOAT_STAT:(t,p,i)=>{t.writeFloat(p[1],game(t,i).stats.get(t.readInt(p[0])));},
 // --- CTimer / CCamera / CWeather / CHud / frontend -----------------------
 /** Handler unreversed; CTimer::GetTimeInMS is the scheduler clock. */
 GET_GAME_TIMER:(t,p,_i,now)=>{t.writeInt(p[0],now|0);},
 /** Handler unreversed; CCamera::SetFadeColour (0x50BF00) is reversed. */
 SET_FADING_COLOUR:(t,p,i)=>{game(t,i).setFadeColour(t.readInt(p[0]),t.readInt(p[1]),t.readInt(p[2]));},
 /** Handlers unreversed; CWeather routines 0x72A4E0/0x72A4F0/0x72A510 are reversed. */
 FORCE_WEATHER:(t,p,i)=>{game(t,i).forceWeather(t.readInt(p[0]));},
 FORCE_WEATHER_NOW:(t,p,i)=>{game(t,i).forceWeatherNow(t.readInt(p[0]));},
 RELEASE_WEATHER:(t,_p,i)=>{game(t,i).releaseWeather();},
 DISPLAY_ZONE_NAMES:(t,p,i)=>{game(t,i).displayAreaName=bool(t,p[0]);},
 GET_CURRENT_LANGUAGE:(t,p,i)=>{t.writeInt(p[0],game(t,i).language);},
 // --- player / world state through the adapter ----------------------------
 IS_PLAYER_PLAYING:(t,p,i)=>{t.updateCompareFlag(world(t,i,'isPlayerPlaying')(t.readInt(p[0])),negated(i));},
 IS_PLAYER_DEAD:(t,p,i)=>{t.updateCompareFlag(world(t,i,'isPlayerDead')(t.readInt(p[0])),negated(i));},
 /** Handler unreversed. */
 REQUEST_COLLISION:(t,p,i)=>{world(t,i,'requestCollision')(t.readFloat(p[0]),t.readFloat(p[1]));},
 LOAD_SCENE:(t,p,i)=>{world(t,i,'loadScene')(t.readFloat(p[0]),t.readFloat(p[1]),t.readFloat(p[2]));},
 CREATE_PLAYER:(t,p,i)=>{
  const playerId=t.readInt(p[0]);
  world(t,i,'createPlayer')(playerId,t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]));
  t.writeInt(p[4],playerId);
 },
 GET_PLAYER_CHAR:(t,p,i)=>{t.writeInt(p[1],world(t,i,'getPlayerChar')(t.readInt(p[0])));},
 GET_PLAYER_GROUP:(t,p,i)=>{t.writeInt(p[1],world(t,i,'getPlayerGroup')(t.readInt(p[0])));},
 SET_CAMERA_BEHIND_PLAYER:(t,_p,i)=>{world(t,i,'setCameraBehindPlayer')();},
 SET_CHAR_HEADING:(t,p,i)=>{world(t,i,'setCharHeading')(t.readInt(p[0]),t.readFloat(p[1]));},
 /** Handler unreversed. */
 SET_RELATIONSHIP:(t,p,i)=>{world(t,i,'setRelationship')(t.readInt(p[0]),t.readInt(p[1]),t.readInt(p[2]));},
 /** Handler unreversed. */
 SET_LA_RIOTS:(t,p,i)=>{world(t,i,'setLaRiots')(bool(t,p[0]));},
 SET_PLAYER_CONTROL:(t,p,i)=>{world(t,i,'setPlayerControl')(t.readInt(p[0]),bool(t,p[1]));},
 /** Handler unreversed; CCamera::GetFading is reversed. */
 GET_FADING_STATUS:(t,_p,i)=>{t.updateCompareFlag(world(t,i,'isFading')(),negated(i));},
 // --- CMessages / CHud text (TextCommands.cpp) -----------------------------
 PRINT:(t,p,i,now)=>{
  const g=game(t,i),key=t.text(p[0]);
  if(subtitleAllowed(t,i,key))g.messages.addMessageQ(key,t.readInt(p[1]),t.readInt(p[2]),g.addNextMessageToPreviousBriefs,now);
  g.addNextMessageToPreviousBriefs=true;
 },
 PRINT_NOW:(t,p,i,now)=>{
  const g=game(t,i),key=t.text(p[0]);
  if(subtitleAllowed(t,i,key))g.messages.addMessageJump(key,t.readInt(p[1]),t.readInt(p[2]),g.addNextMessageToPreviousBriefs,now);
  g.addNextMessageToPreviousBriefs=true;
 },
 PRINT_BIG:(t,p,i,now)=>{game(t,i).messages.addBigMessage2(t.text(p[0]),t.readInt(p[1]),(t.readInt(p[2])&0xffff)-1,true,now);},
 PRINT_BIG_Q:(t,p,i,now)=>{game(t,i).messages.addBigMessage2(t.text(p[0]),t.readInt(p[1]),(t.readInt(p[2])&0xffff)-1,false,now);},
 PRINT_WITH_NUMBER:printWithNumbers(1,'queue'),PRINT_WITH_2_NUMBERS:printWithNumbers(2,'queue'),PRINT_WITH_3_NUMBERS:printWithNumbers(3,'queue'),
 PRINT_WITH_4_NUMBERS:printWithNumbers(4,'queue'),PRINT_WITH_5_NUMBERS:printWithNumbers(5,'queue'),PRINT_WITH_6_NUMBERS:printWithNumbers(6,'queue'),
 PRINT_WITH_NUMBER_NOW:printWithNumbers(1,'now'),PRINT_WITH_2_NUMBERS_NOW:printWithNumbers(2,'now'),PRINT_WITH_3_NUMBERS_NOW:printWithNumbers(3,'now'),
 PRINT_WITH_4_NUMBERS_NOW:printWithNumbers(4,'now'),PRINT_WITH_5_NUMBERS_NOW:printWithNumbers(5,'now'),PRINT_WITH_6_NUMBERS_NOW:printWithNumbers(6,'now'),
 PRINT_WITH_NUMBER_BIG:printWithNumbers(1,'big'),PRINT_WITH_2_NUMBERS_BIG:printWithNumbers(2,'big'),PRINT_WITH_3_NUMBERS_BIG:printWithNumbers(3,'big'),
 PRINT_WITH_4_NUMBERS_BIG:printWithNumbers(4,'big'),PRINT_WITH_5_NUMBERS_BIG:printWithNumbers(5,'big'),PRINT_WITH_6_NUMBERS_BIG:printWithNumbers(6,'big'),
 CLEAR_PRINTS:(t,_p,i)=>{game(t,i).messages.clearMessages(false);},
 CLEAR_SMALL_PRINTS:(t,_p,i)=>{game(t,i).messages.clearSmallMessagesOnly();},
 CLEAR_THIS_PRINT:(t,p,i,now)=>{game(t,i).messages.clearThisPrint(t.text(p[0]),now);},
 CLEAR_THIS_BIG_PRINT:(t,p,i,now)=>{game(t,i).messages.clearThisBigPrint(t.text(p[0]),now);},
 CLEAR_THIS_PRINT_BIG_NOW:(t,p,i,now)=>{game(t,i).messages.clearThisPrintBigNow((t.readInt(p[0])&0xffff)-1,now);},
 PRINT_HELP:(t,p,i)=>{
  const g=game(t,i),key=t.text(p[0]);
  if(helpAllowed(t,i)){g.help.set(key,false,false,false,g.messages);if(g.addNextMessageToPreviousBriefs)g.messages.addToPreviousBriefArray(key);}
  g.addNextMessageToPreviousBriefs=true;
 },
 PRINT_HELP_FOREVER:(t,p,i)=>{
  const g=game(t,i),key=t.text(p[0]);
  if(helpAllowed(t,i)){g.help.set(key,false,true,false,g.messages);if(g.addNextMessageToPreviousBriefs)g.messages.addToPreviousBriefArray(key);}
  g.addNextMessageToPreviousBriefs=true;
 },
 PRINT_HELP_FOREVER_WITH_NUMBER:(t,p,i)=>{const g=game(t,i);if(helpAllowed(t,i))g.help.setWithNumber(t.text(p[0]),t.readInt(p[1]),false,true);},
 CLEAR_HELP:(t,_p,i)=>{const g=game(t,i);g.help.set(undefined,true,false,false,g.messages);},
 FLASH_HUD_OBJECT:(t,p,i)=>{game(t,i).hudItemToFlash=t.readInt(p[0]);},
 ADD_NEXT_MESSAGE_TO_PREVIOUS_BRIEFS:(t,p,i)=>{game(t,i).addNextMessageToPreviousBriefs=bool(t,p[0]);},
 DISPLAY_NON_MINIGAME_HELP_MESSAGES:(t,p,i)=>{game(t,i).displayNonMiniGameHelpMessages=bool(t,p[0]);},
 LOAD_MISSION_TEXT:(t,p,i)=>{world(t,i,'loadMissionText')(t.text(p[0]));},
 USE_TEXT_COMMANDS:(t,p,i)=>{game(t,i).introText.useTextCommands=bool(t,p[0])?USE_TEXT_ENABLED_BY_SCRIPT:USE_TEXT_DISABLE_NEXT_FRAME;},
 DISPLAY_TEXT:(t,p,i)=>{game(t,i).introText.display(t.readFloat(p[0]),t.readFloat(p[1]),t.text(p[2]),-1,-1);},
 DISPLAY_TEXT_WITH_NUMBER:displayTextWithNumbers(1),DISPLAY_TEXT_WITH_2_NUMBERS:displayTextWithNumbers(2),
 DISPLAY_TEXT_WITH_FLOAT:(t,p,i)=>{
  const value=t.readFloat(p[3]),precision=t.readFloat(p[4]),whole=Math.trunc(value),fraction=value-whole;
  game(t,i).introText.display(t.readFloat(p[0]),t.readFloat(p[1]),t.text(p[2]),whole,Math.trunc(Math.fround(Math.pow(10,precision))*fraction));
 },
 SET_TEXT_SCALE:(t,p,i)=>{game(t,i).introText.pending.scale={x:t.readFloat(p[0]),y:t.readFloat(p[1])};},
 SET_TEXT_COLOUR:(t,p,i)=>{game(t,i).introText.pending.colour=rgba(t,p,0);},
 SET_TEXT_JUSTIFY:(t,p,i)=>{game(t,i).introText.pending.justify=bool(t,p[0]);},
 SET_TEXT_CENTRE:(t,p,i)=>{game(t,i).introText.pending.centred=bool(t,p[0]);},
 SET_TEXT_WRAPX:(t,p,i)=>{game(t,i).introText.pending.wrapX=t.readFloat(p[0]);},
 SET_TEXT_CENTRE_SIZE:(t,p,i)=>{game(t,i).introText.pending.centreSize=t.readFloat(p[0]);},
 SET_TEXT_BACKGROUND:(t,p,i)=>{game(t,i).introText.pending.background=bool(t,p[0]);},
 SET_TEXT_PROPORTIONAL:(t,p,i)=>{game(t,i).introText.pending.proportional=bool(t,p[0]);},
 SET_TEXT_FONT:(t,p,i)=>{game(t,i).introText.pending.fontStyle=t.readInt(p[0]);},
 SET_TEXT_DRAW_BEFORE_FADE:(t,p,i)=>{game(t,i).introText.pending.drawBeforeFade=bool(t,p[0]);},
 SET_TEXT_RIGHT_JUSTIFY:(t,p,i)=>{game(t,i).introText.pending.rightJustify=bool(t,p[0]);},
 SET_TEXT_DROPSHADOW:(t,p,i)=>{const line=game(t,i).introText.pending;line.dropShadowColour=rgba(t,p,1);line.dropShadow=t.readInt(p[0]);},
 SET_TEXT_EDGE:(t,p,i)=>{const line=game(t,i).introText.pending;line.dropShadowColour=rgba(t,p,1);line.textEdge=t.readInt(p[0]);},
 // --- CRadar blips (Radar.cpp routines reversed; command dispatch unreversed) --
 ADD_BLIP_FOR_COORD:(t,p,i)=>{t.writeInt(p[3],game(t,i).radar.setCoordBlip(BLIP_COORD,vec(t,p,0),BLIP_DISPLAY_BOTH)|0);},
 ADD_SPRITE_BLIP_FOR_COORD:spriteBlip(BLIP_COORD,false),ADD_SHORT_RANGE_SPRITE_BLIP_FOR_COORD:spriteBlip(BLIP_COORD,true),
 ADD_SPRITE_BLIP_FOR_CONTACT_POINT:spriteBlip(BLIP_CONTACT_POINT,false),ADD_SHORT_RANGE_SPRITE_BLIP_FOR_CONTACT_POINT:spriteBlip(BLIP_CONTACT_POINT,true),
 ADD_BLIP_FOR_CHAR:entityBlip(BLIP_CHAR),ADD_BLIP_FOR_CAR:entityBlip(BLIP_CAR),ADD_BLIP_FOR_OBJECT:entityBlip(BLIP_OBJECT),ADD_BLIP_FOR_PICKUP:entityBlip(BLIP_PICKUP),
 REMOVE_BLIP:(t,p,i)=>{game(t,i).radar.clearBlip(t.readInt(p[0])>>>0);},
 CHANGE_BLIP_COLOUR:(t,p,i)=>{game(t,i).radar.changeColour(t.readInt(p[0])>>>0,t.readInt(p[1]));},
 CHANGE_BLIP_SCALE:(t,p,i)=>{game(t,i).radar.changeScale(t.readInt(p[0])>>>0,t.readInt(p[1]));},
 CHANGE_BLIP_DISPLAY:(t,p,i)=>{game(t,i).radar.changeDisplay(t.readInt(p[0])>>>0,t.readInt(p[1]));},
 SET_BLIP_AS_FRIENDLY:(t,p,i)=>{game(t,i).radar.setFriendly(t.readInt(p[0])>>>0,bool(t,p[1]));},
 SET_BLIP_ALWAYS_DISPLAY_ON_ZOOMED_RADAR:(t,p,i)=>{game(t,i).radar.setAlwaysDisplayInZoom(t.readInt(p[0])>>>0,bool(t,p[1]));},
 SET_COORD_BLIP_APPEARANCE:(t,p,i)=>{game(t,i).radar.setCoordBlipAppearance(t.readInt(p[0])>>>0,t.readInt(p[1]));},
 DOES_BLIP_EXIST:(t,p,i)=>{t.updateCompareFlag(game(t,i).radar.index(t.readInt(p[0])>>>0)!==-1,negated(i));},
 SHOW_BLIPS_ON_ALL_LEVELS:(t,p,i)=>{game(t,i).radarShowBlipOnAllLevels=bool(t,p[0]);},
 HIDE_ALL_FRONTEND_BLIPS:(t,p,i)=>{game(t,i).hideAllFrontEndMapBlips=bool(t,p[0]);},
 // --- CRestart (Restart.cpp reversed; the command dispatch for all but SET_RESPAWN_POINT_FOR_DURATION_OF_MISSION
 // is unreversed, so each one calls the engine routine it is documented to reach).
 ADD_HOSPITAL_RESTART:(t,p,i)=>{const v=vec(t,p,0);game(t,i).restart.addHospitalRestartPoint([v.x,v.y,v.z],t.readFloat(p[3]),t.readInt(p[4]));},
 ADD_POLICE_RESTART:(t,p,i)=>{const v=vec(t,p,0);game(t,i).restart.addPoliceRestartPoint([v.x,v.y,v.z],t.readFloat(p[3]),t.readInt(p[4]));},
 OVERRIDE_NEXT_RESTART:(t,p,i)=>{const v=vec(t,p,0);game(t,i).restart.overrideNextRestart([v.x,v.y,v.z],t.readFloat(p[3]));},
 CANCEL_OVERRIDE_RESTART:(t,_p,i)=>{game(t,i).restart.cancelOverrideRestart();},
 SET_EXTRA_HOSPITAL_RESTART_POINT:(t,p,i)=>{const v=vec(t,p,0);game(t,i).restart.setExtraHospitalRestartPoint([v.x,v.y,v.z],t.readFloat(p[3]),t.readFloat(p[4]));},
 SET_EXTRA_POLICE_STATION_RESTART_POINT:(t,p,i)=>{const v=vec(t,p,0);game(t,i).restart.setExtraPoliceStationRestartPoint([v.x,v.y,v.z],t.readFloat(p[3]),t.readFloat(p[4]));},
 SET_RESPAWN_POINT_FOR_DURATION_OF_MISSION:(t,p,i)=>{const v=vec(t,p,0);game(t,i).restart.setRespawnPointForDurationOfMission([v.x,v.y,v.z]);},
 // --- CStreamedScripts' commands (StreamedScripts.cpp is reversed; these dispatches are not, so each names
 // the routine it reaches). The script addresses a file by its own index, which the registry translates.
 HAS_STREAMED_SCRIPT_LOADED:(t,p,i)=>{
  const scripts=game(t,i).streamedScripts,index=scripts.properIndexFromScriptIndex(t.readInt(p[0]));
  t.updateCompareFlag(index>=0&&!!scripts.at(index).memory,negated(i));
 },
 START_NEW_STREAMED_SCRIPT:(t,p,i)=>{
  const host=t.host;if(!host?.startStreamedScript)throw new UnsupportedScmCommand(i.offset,i.opcode&0x7fff,i.name,'no streamed script host');
  const scripts=game(t,i).streamedScripts,index=scripts.properIndexFromScriptIndex(t.readInt(p[0]));
  requireAsset(index>=0,'START_NEW_STREAMED_SCRIPT names a file the registry has not read.');
  host.startStreamedScript(index,p.slice(1).map(parameter=>t.readInt(parameter)));
 },
 MARK_STREAMED_SCRIPT_AS_NO_LONGER_NEEDED:(t,p,i)=>{
  const scripts=game(t,i).streamedScripts,index=scripts.properIndexFromScriptIndex(t.readInt(p[0]));
  if(index>=0)scripts.at(index).users=Math.max(0,scripts.at(index).users-1);
 },
 REMOVE_STREAMED_SCRIPT:(t,p,i)=>{
  const scripts=game(t,i).streamedScripts,index=scripts.properIndexFromScriptIndex(t.readInt(p[0]));
  if(index>=0)scripts.removeFromMemory(index);
 },
 GET_NUMBER_OF_INSTANCES_OF_STREAMED_SCRIPT:(t,p,i)=>{
  const scripts=game(t,i).streamedScripts,index=scripts.properIndexFromScriptIndex(t.readInt(p[0]));
  t.writeInt(p[1],index>=0?scripts.at(index).users:0);
 },
 // --- The rest of the reversed camera commands, and the scene load a script asks for in a direction.
 SHAKE_CAM:(t,p,i,now)=>{game(t,i).camera.camShakeNoPos(t.readInt(p[0])/1000,now);},
 CAMERA_SET_SHAKE_SIMULATION_SIMPLE:(t,p,i,now)=>{game(t,i).camera.addShakeSimple(t.readFloat(p[1]),t.readInt(p[0]),t.readFloat(p[2]),now);},
 CAMERA_IS_VECTOR_MOVE_RUNNING:(t,_p,i,now)=>{t.updateCompareFlag(game(t,i).camera.vectorMoveRunning(now),negated(i));},
 CAMERA_IS_VECTOR_TRACK_RUNNING:(t,_p,i,now)=>{t.updateCompareFlag(game(t,i).camera.vectorTrackRunning(now),negated(i));},
 IS_POINT_ON_SCREEN:(t,p,i)=>{
  const point=vec(t,p,0);
  if(point.z<=ScmCamera.MAP_Z_LOW_LIMIT)point.z=world(t,i,'groundZForCoord')(point.x,point.y);
  t.updateCompareFlag(world(t,i,'isSphereVisible')(point,t.readFloat(p[3])),negated(i));
 },
 LOAD_SCENE_IN_DIRECTION:(t,p,i)=>{const v=vec(t,p,0);world(t,i,'loadSceneInDirection')(v.x,v.y,v.z,t.readFloat(p[3]));},
 // --- CPathFind's node switches (PathCommands.cpp and PathFind.cpp are reversed). Flipping the nodes is the
 // host's, against the list these keep.
 SWITCH_ROADS_ON:(t,p,i)=>{game(t,i).nodeSwitches.switchRoadsOffInArea(switchArea(vec(t,p,0),vec(t,p,3)),false,true,false);},
 SWITCH_ROADS_OFF:(t,p,i)=>{game(t,i).nodeSwitches.switchRoadsOffInArea(switchArea(vec(t,p,0),vec(t,p,3)),true,true,false);},
 SWITCH_ROADS_BACK_TO_ORIGINAL:(t,p,i)=>{game(t,i).nodeSwitches.switchRoadsOffInArea(switchArea(vec(t,p,0),vec(t,p,3)),false,true,true);},
 SWITCH_PED_ROADS_ON:(t,p,i)=>{game(t,i).nodeSwitches.switchPedRoadsOffInArea(switchArea(vec(t,p,0),vec(t,p,3)),false,false);},
 SWITCH_PED_ROADS_OFF:(t,p,i)=>{game(t,i).nodeSwitches.switchPedRoadsOffInArea(switchArea(vec(t,p,0),vec(t,p,3)),true,false);},
 SWITCH_PED_ROADS_BACK_TO_ORIGINAL:(t,p,i)=>{game(t,i).nodeSwitches.switchPedRoadsOffInArea(switchArea(vec(t,p,0),vec(t,p,3)),false,true);},
 // --- CPad (PadCommands.cpp is reversed). The pad state itself is the host's to fill each frame.
 IS_BUTTON_PRESSED:(t,p,i)=>{t.updateCompareFlag(game(t,i).pads.isPressed(t.readInt(p[0]),t.readInt(p[1])),negated(i));},
 GET_PAD_STATE:(t,p,i)=>{t.writeInt(p[2],game(t,i).pads.state(t.readInt(p[0]),t.readInt(p[1])));},
 IS_PC_USING_JOYPAD:(t,_p,i)=>{t.updateCompareFlag(game(t,i).pads.controlMethod===CONTROLLER_JOYPAD,negated(i));},
 IS_MOUSE_USING_VERTICAL_INVERSION:(t,_p,i)=>{t.updateCompareFlag(game(t,i).pads.invertMouseY,negated(i));},
 HAS_GAME_JUST_RETURNED_FROM_FRONTEND:(t,_p,i)=>{t.updateCompareFlag(game(t,i).pads.justOutOfFrontEnd,negated(i));},
 GET_PC_MOUSE_MOVEMENT:(t,p,i)=>{const {mouseMoved}=game(t,i).pads;t.writeFloat(p[0],mouseMoved.x);t.writeFloat(p[1],mouseMoved.y);},
 // --- CSetPieces (SetPieces.cpp is reversed) and the camera's scriptable components.
 ADD_SET_PIECE:(t,p,i)=>{
  const pair=(at:number)=>({x:t.readFloat(p[at]),y:t.readFloat(p[at+1])});
  game(t,i).setPieces.addOne(t.readInt(p[0]),pair(1),pair(3),pair(5),pair(7),pair(9),pair(11));
 },
 CAMERA_RESET_NEW_SCRIPTABLES:(t,_p,i)=>{game(t,i).camera.initialiseScriptableComponents();},
 CAMERA_PERSIST_TRACK:(t,p,i)=>{game(t,i).camera.cameraPersistTrack=bool(t,p[0]);},
 CAMERA_PERSIST_POS:(t,p,i)=>{game(t,i).camera.cameraPersistPosition=bool(t,p[0]);},
 SET_CINEMA_CAMERA:(t,p,i)=>{game(t,i).camera.cinemaCamera=bool(t,p[0]);},
 CAMERA_SET_LERP_FOV:(t,p,i,now)=>{game(t,i).camera.lerpFOV(t.readFloat(p[0]),t.readFloat(p[1]),t.readInt(p[2]),bool(t,p[3]),now);},
 // --- Player score and the stat commands that show a message with their change (MathCommands.cpp,
 // PlayerCommands.cpp and StatCommands.cpp are reversed; the HUD message itself is the host's).
 ADD_SCORE:(t,p,i)=>{game(t,i).money+=t.readInt(p[1]);},
 IS_SCORE_GREATER:(t,p,i)=>{t.updateCompareFlag(game(t,i).money>t.readInt(p[1]),negated(i));},
 STORE_SCORE:(t,p,i)=>{t.writeInt(p[1],game(t,i).money);},
 INCREMENT_INT_STAT:(t,p,i)=>{game(t,i).stats.increment(t.readInt(p[0]),t.readInt(p[1]));},
 INCREMENT_FLOAT_STAT:(t,p,i)=>{game(t,i).stats.increment(t.readInt(p[0]),t.readFloat(p[1]));},
 DECREMENT_INT_STAT:(t,p,i)=>{game(t,i).stats.decrement(t.readInt(p[0]),t.readInt(p[1]));},
 DECREMENT_FLOAT_STAT:(t,p,i)=>{game(t,i).stats.decrement(t.readInt(p[0]),t.readFloat(p[1]));},
 DRAW_ODDJOB_TITLE_BEFORE_FADE:(t,p,i)=>{game(t,i).drawOddJobTitleBeforeFade=bool(t,p[0]);},
 // Degrees in, as the handlers convert before calling the C library.
 SIN:(t,p,i)=>{t.writeFloat(p[1],Math.fround(Math.sin(t.readFloat(p[0])*Math.PI/180)));},
 COS:(t,p,i)=>{t.writeFloat(p[1],Math.fround(Math.cos(t.readFloat(p[0])*Math.PI/180)));},
 GET_DISTANCE_BETWEEN_COORDS_2D:(t,p,i)=>{t.writeFloat(p[4],Math.hypot(t.readFloat(p[2])-t.readFloat(p[0]),t.readFloat(p[3])-t.readFloat(p[1])));},
 GET_DISTANCE_BETWEEN_COORDS_3D:(t,p,i)=>{
  const a=vec(t,p,0),b=vec(t,p,3);
  t.writeFloat(p[6],Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z));
 },
 // --- CWanted (PlayerCommands.cpp and Wanted.cpp are reversed). SetWantedLevel trims the level to the maximum
 // the script set before it picks the chaos for it.
 ALTER_WANTED_LEVEL:(t,p,i)=>{const g=game(t,i);g.wanted.setWantedLevel(Math.min(t.readInt(p[1]),g.maximumWantedLevel));},
 ALTER_WANTED_LEVEL_NO_DROP:(t,p,i)=>{const g=game(t,i);g.wanted.setWantedLevelNoDrop(Math.min(t.readInt(p[1]),g.maximumWantedLevel));},
 IS_WANTED_LEVEL_GREATER:(t,p,i)=>{t.updateCompareFlag(game(t,i).wanted.level>t.readInt(p[1]),negated(i));},
 CLEAR_WANTED_LEVEL:(t,_p,i)=>{game(t,i).wanted.setWantedLevel(0);},
 // --- CFireManager (FireManager.cpp and Fire.cpp are reversed; only START_SCRIPT_FIRE and
 // REMOVE_ALL_SCRIPT_FIRES have a reversed dispatch, and the rest name the routine they reach).
 START_SCRIPT_FIRE:(t,p,i)=>{t.writeInt(p[5],game(t,i).fires.startScriptFire(vec(t,p,0),t.readInt(p[4]),t.readInt(p[3])));},
 IS_SCRIPT_FIRE_EXTINGUISHED:(t,p,i)=>{t.updateCompareFlag(game(t,i).fires.isExtinguished(t.readInt(p[0])),negated(i));},
 DOES_SCRIPT_FIRE_EXIST:(t,p,i)=>{t.updateCompareFlag(game(t,i).fires.exists(t.readInt(p[0])),negated(i));},
 REMOVE_SCRIPT_FIRE:(t,p,i)=>{game(t,i).fires.removeScriptFire(t.readInt(p[0]));},
 REMOVE_ALL_SCRIPT_FIRES:(t,_p,i)=>{game(t,i).fires.removeAllScriptFires();},
 CLEAR_ALL_SCRIPT_FIRE_FLAGS:(t,_p,i)=>{game(t,i).fires.clearAllScriptFireFlags();},
 SET_MAX_FIRE_GENERATIONS:(t,p,i)=>{game(t,i).fires.maxGenerations=t.readInt(p[0]);},
 GET_SCRIPT_FIRE_COORDS:(t,p,i)=>{
  const position=game(t,i).fires.coords(t.readInt(p[0]));
  t.writeFloat(p[1],position.x);t.writeFloat(p[2],position.y);t.writeFloat(p[3],position.z);
 },
 EXTINGUISH_FIRE_AT_POINT:(t,p,i)=>{game(t,i).fires.extinguishPoint(vec(t,p,0),t.readFloat(p[3]));},
 GET_NUMBER_OF_FIRES_IN_RANGE:(t,p,i)=>{const v=vec(t,p,0);t.writeInt(p[4],game(t,i).fires.numFiresInRange({x:v.x,y:v.y},t.readFloat(p[3])));},
 GET_NUMBER_OF_FIRES_IN_AREA:(t,p,i)=>{t.writeInt(p[6],game(t,i).fires.numFiresInArea(vec(t,p,0),vec(t,p,3)));},
 // --- Small engine statics (GameCommands.cpp and ScriptCommands.cpp are reversed; each command sets or reads
 // exactly one of them).
 PLAYER_MADE_PROGRESS:(t,p,i)=>{game(t,i).stats.increment(STAT_PROGRESS_MADE,t.readInt(p[0]));},
 REGISTER_MISSION_GIVEN:(t,_p,i)=>{game(t,i).stats.increment(STAT_MISSION_ATTEMPTS,1);},
 INCREMENT_INT_STAT_NO_MESSAGE:(t,p,i)=>{game(t,i).stats.increment(t.readInt(p[0]),t.readInt(p[1]));},
 INCREMENT_FLOAT_STAT_NO_MESSAGE:(t,p,i)=>{game(t,i).stats.increment(t.readInt(p[0]),t.readFloat(p[1]));},
 SET_PED_DENSITY_MULTIPLIER:(t,p,i)=>{game(t,i).pedDensityMultiplier=t.readFloat(p[0]);},
 SET_DISABLE_MILITARY_ZONES:(t,p,i)=>{game(t,i).militaryZonesDisabled=bool(t,p[0]);},
 DISPLAY_RADAR:(t,p,i)=>{game(t,i).displayRadar=bool(t,p[0]);},
 SET_AREA_NAME:(t,p,i)=>{game(t,i).areaName=t.text(p[0]);},
 // CGarages::AllRespraysCloseOrOpen goes with this flag; the garages themselves are not ported.
 SET_NO_RESPRAYS:(t,p,i)=>{game(t,i).noResprays=bool(t,p[0]);},
 SET_ALL_TAXIS_HAVE_NITRO:(t,p,i)=>{game(t,i).allTaxisHaveNitro=bool(t,p[0]);},
 ACTIVATE_PIMP_CHEAT:(t,p,i)=>{game(t,i).prostitutesPayYou=bool(t,p[0]);},
 TAKE_PHOTO:(t,p,i)=>{const g=game(t,i);g.takePhoto=true;g.savePhotoFromScript=bool(t,p[0]);},
 IS_WIDESCREEN_ON_IN_OPTIONS:(t,_p,i)=>{t.updateCompareFlag(game(t,i).widescreen,negated(i));},
 // The reference answers this one with a flat no.
 IS_JAPANESE_VERSION:(t,_p,i)=>{t.updateCompareFlag(false,negated(i));},
 GET_GROUND_Z_FOR_3D_COORD:(t,p,i)=>{t.writeFloat(p[3],world(t,i,'groundZFor3DCoord')(t.readFloat(p[0]),t.readFloat(p[1]),t.readFloat(p[2])));},
 // --- The script's sprites and boxes (DrawCommands.cpp is reversed). Coordinates arrive in the 640x448 design
 // space and are stretched to the screen; the texture dictionary itself is the host's to load.
 LOAD_SPRITE:(t,p,i)=>{game(t,i).introRectangles.loadSprite(t.readInt(p[0]),t.text(p[1]));},
 DRAW_SPRITE:(t,p,i)=>{game(t,i).introRectangles.drawSprite(t.readInt(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),t.readFloat(p[4]),rgba(t,p,5));},
 DRAW_RECT:(t,p,i)=>{game(t,i).introRectangles.drawRect(t.readFloat(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),rgba(t,p,4));},
 DRAW_SPRITE_WITH_ROTATION:(t,p,i)=>{game(t,i).introRectangles.drawSpriteWithRotation(t.readInt(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),t.readFloat(p[4]),t.readFloat(p[5]),rgba(t,p,6));},
 DRAW_WINDOW:(t,p,i)=>{game(t,i).introRectangles.drawWindow(t.readFloat(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),t.text(p[4]),t.readInt(p[5]));},
 SET_SPRITES_DRAW_BEFORE_FADE:(t,p,i)=>{game(t,i).introRectangles.setDrawBeforeFade(bool(t,p[0]));},
 LOAD_TEXTURE_DICTIONARY:(t,p,i)=>{world(t,i,'loadScriptTextureDictionary')(t.text(p[0]));},
 REMOVE_TEXTURE_DICTIONARY:(t,_p,i)=>{world(t,i,'removeScriptTextureDictionary')();},
 // --- TheCamera (CameraCommands.cpp is reversed, over routines that only set fields).
 SET_FIXED_CAMERA_POSITION:(t,p,i)=>{game(t,i).camera.setCamPositionForFixedMode(vec(t,p,0),vec(t,p,3));},
 POINT_CAMERA_AT_POINT:(t,p,i)=>{
  const target=vec(t,p,0);
  // A target at or below minus a hundred means the ground under it.
  if(target.z<=-100)target.z=world(t,i,'groundZForCoord')(target.x,target.y);
  game(t,i).camera.takeControlNoEntity(target,t.readInt(p[3]),1);
 },
 RESTORE_CAMERA:(t,_p,i)=>{game(t,i).camera.restore(world(t,i,'playerCameraState')());},
 RESTORE_CAMERA_JUMPCUT:(t,_p,i)=>{game(t,i).camera.restoreWithJumpCut(world(t,i,'playerCameraState')());},
 // --- CTheZones' info zones (ZoneCommands.cpp is reversed). A label no zone carries reaches no record, so the
 // setters do nothing, which is how the handlers' own lookup behaves.
 SET_ZONE_POPULATION_TYPE:(t,p,i)=>{game(t,i).zones.setPopulationType(t.text(p[0]),t.readInt(p[1]));},
 SET_ZONE_DEALER_STRENGTH:(t,p,i)=>{game(t,i).zones.setDealerStrength(t.text(p[0]),t.readInt(p[1]));},
 GET_ZONE_DEALER_STRENGTH:(t,p,i)=>{t.writeInt(p[1],game(t,i).zones.dealerStrength(t.text(p[0])));},
 SET_ZONE_GANG_STRENGTH:(t,p,i)=>{game(t,i).zones.setGangStrength(t.text(p[0]),t.readInt(p[1]),t.readInt(p[2]));},
 GET_ZONE_GANG_STRENGTH:(t,p,i)=>{t.writeInt(p[2],game(t,i).zones.gangStrength(t.text(p[0]),t.readInt(p[1])));},
 SET_ZONE_POPULATION_RACE:(t,p,i)=>{game(t,i).zones.setPopulationRace(t.text(p[0]),t.readInt(p[1]));},
 SET_ZONE_NO_COPS:(t,p,i)=>{game(t,i).zones.setNoCops(t.text(p[0]),bool(t,p[1]));},
 INIT_ZONE_POPULATION_SETTINGS:(t,_p,i)=>{game(t,i).zones.initZonesPopulationSettings();},
 GET_CURRENT_POPULATION_ZONE_TYPE:(t,p,i)=>{t.writeInt(p[0],world(t,i,'currentPopulationZoneType')());},
 // CGangWars' two zone statics: the training zone is the info index of the labelled zone, and a specific zone
 // joins the list a war can start in (the colour refill those two calls do is rendering).
 SET_ZONE_FOR_GANG_WARS_TRAINING:(t,p,i)=>{const g=game(t,i);g.gangWarTrainingZone=g.zones.findZoneByLabel(t.text(p[0]));},
 SET_SPECIFIC_ZONE_TO_TRIGGER_GANG_WAR:(t,p,i)=>{const g=game(t,i);g.specificGangWarZones.push(g.zones.findZoneByLabel(t.text(p[0])));},
 CLEAR_SPECIFIC_ZONES_TO_TRIGGER_GANG_WAR:(t,_p,i)=>{game(t,i).specificGangWarZones.length=0;},
 // --- The script's CObjects (ObjectCommands.cpp's Object namespace is reversed; CREATE_OBJECT_NO_OFFSET is not,
 // and differs from CREATE_OBJECT only by the ground drop and the base-of-model lift its name gives up).
 CREATE_OBJECT:(t,p,i)=>{
  const g=game(t,i),asset=model(t,i,p[0]),position=vec(t,p,1);
  // CWorld::PutToGroundIfTooLow, then the lift by the distance from the centre of mass to the base of the model.
  const ground=world(t,i,'groundLevel')(position.x,position.y,position.z);
  if(ground!==undefined&&position.z<ground)position.z=ground;
  position.z+=world(t,i,'modelBaseOffset')(asset);
  t.writeInt(p[4],g.objects.create(asset,position,{external:t.isExternal||t.externalType!==-1,missionCleanup:t.usesMissionCleanup}).handle);
 },
 CREATE_OBJECT_NO_OFFSET:(t,p,i)=>{
  const g=game(t,i);
  t.writeInt(p[4],g.objects.create(model(t,i,p[0]),vec(t,p,1),{external:t.isExternal||t.externalType!==-1,missionCleanup:t.usesMissionCleanup}).handle);
 },
 DELETE_OBJECT:(t,p,i)=>{game(t,i).objects.remove(t.readInt(p[0]));},
 DOES_OBJECT_EXIST:(t,p,i)=>{t.updateCompareFlag(game(t,i).objects.exists(t.readInt(p[0])),negated(i));},
 MARK_OBJECT_AS_NO_LONGER_NEEDED:(t,p,i)=>{game(t,i).objects.releaseFromCleanup(t.readInt(p[0]));},
 DONT_REMOVE_OBJECT:(t,p,i)=>{game(t,i).objects.releaseFromCleanup(t.readInt(p[0]));},
 GET_OBJECT_COORDINATES:(t,p,i)=>{
  const position=game(t,i).objects.at(t.readInt(p[0])).position;
  t.writeFloat(p[1],position.x);t.writeFloat(p[2],position.y);t.writeFloat(p[3],position.z);
 },
 SET_OBJECT_COORDINATES:(t,p,i)=>{game(t,i).objects.setPosition(t.readInt(p[0]),vec(t,p,1));},
 GET_OBJECT_HEADING:(t,p,i)=>{t.writeFloat(p[1],game(t,i).objects.getHeading(t.readInt(p[0])));},
 SET_OBJECT_HEADING:(t,p,i)=>{game(t,i).objects.setHeading(t.readInt(p[0]),t.readFloat(p[1]));},
 GET_OBJECT_VELOCITY:(t,p,i)=>{
  const velocity=game(t,i).objects.getVelocity(t.readInt(p[0]));
  t.writeFloat(p[1],velocity.x);t.writeFloat(p[2],velocity.y);t.writeFloat(p[3],velocity.z);
 },
 SET_OBJECT_VELOCITY:(t,p,i)=>{game(t,i).objects.setVelocity(t.readInt(p[0]),vec(t,p,1));},
 SET_OBJECT_SCALE:(t,p,i)=>{game(t,i).objects.setScale(t.readInt(p[0]),t.readFloat(p[1]));},
 SET_OBJECT_COLLISION:(t,p,i)=>{game(t,i).objects.setUsesCollision(t.readInt(p[0]),bool(t,p[1]));},
 // The next four command handlers are unreversed; each sets the field its name and its reversed siblings name.
 SET_OBJECT_COLLISION_DAMAGE_EFFECT:(t,p,i)=>{game(t,i).objects.setColDamageEffect(t.readInt(p[0]),t.readInt(p[1]));},
 FREEZE_OBJECT_POSITION:(t,p,i)=>{game(t,i).objects.freezePosition(t.readInt(p[0]),bool(t,p[1]));},
 SET_OBJECT_DYNAMIC:(t,p,i)=>{game(t,i).objects.setDynamic(t.readInt(p[0]),bool(t,p[1]));},
 SET_OBJECT_PROOFS:(t,p,i)=>{game(t,i).objects.setProofs(t.readInt(p[0]),{bullet:bool(t,p[1]),fire:bool(t,p[2]),explosion:bool(t,p[3]),collision:bool(t,p[4]),melee:bool(t,p[5])});},
 DOES_OBJECT_HAVE_THIS_MODEL:(t,p,i)=>{t.updateCompareFlag(game(t,i).objects.hasModel(t.readInt(p[0]),model(t,i,p[1])),negated(i));},
 // --- CTheCarGenerators (TheCarGenerators.cpp reversed; both command dispatches are not).
 CREATE_CAR_GENERATOR:(t,p,i,now)=>{
  const v=vec(t,p,0);
  const index=game(t,i).carGenerators.create({position:[v.x,v.y,v.z],angle:t.readFloat(p[3]),modelId:t.readInt(p[4]),
   primaryColour:t.readInt(p[5]),secondaryColour:t.readInt(p[6]),forceSpawn:bool(t,p[7]),
   alarmChance:t.readInt(p[8]),doorLockChance:t.readInt(p[9]),minDelay:t.readInt(p[10]),maxDelay:t.readInt(p[11])},now);
  t.writeInt(p[12],index);
 },
 SWITCH_CAR_GENERATOR:(t,p,i,now)=>{game(t,i).carGenerators.switch(t.readInt(p[0]),t.readInt(p[1]),now);},
 // --- CStuntJumpManager::AddOne (0x49CB40) reversed; the ADD_STUNT_JUMP dispatch is not.
 ADD_STUNT_JUMP:(t,p,i)=>{
  const at=(k:number)=>[t.readFloat(p[k]),t.readFloat(p[k+1]),t.readFloat(p[k+2])];
  game(t,i).addStuntJump(i.offset,{centre:at(0),radius:at(3)},{centre:at(6),radius:at(9)},at(12),t.readInt(p[15]));
 },
 // --- CStreaming (ObjectCommands.cpp). CScriptResourceManager bookkeeping is unreversed.
 REQUEST_MODEL:(t,p,i)=>{world(t,i,'requestModel')(model(t,i,p[0]));},
 HAS_MODEL_LOADED:(t,p,i)=>{t.updateCompareFlag(world(t,i,'hasModelLoaded')(model(t,i,p[0])),negated(i));},
 MARK_MODEL_AS_NO_LONGER_NEEDED:(t,p,i)=>{world(t,i,'markModelNotNeeded')(model(t,i,p[0]));},
 LOAD_ALL_MODELS_NOW:(t,_p,i)=>{world(t,i,'loadAllModelsNow')();},
};

export const SCM_GAME_COMMANDS:ReadonlyMap<number,ScmCommandHandler>=new Map(Object.entries(handlers).map(([name,handler])=>[scmOpcode(name),handler]));
export const SCM_GAME_COMMAND_NAMES:readonly string[]=Object.keys(handlers);
