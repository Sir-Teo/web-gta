import type {ScmInstruction,ScmParameter} from '../assets/scm';
import {CHEAT_ALL_TAXIS_NITRO,CHEAT_PROSTITUTES_PAY_YOU} from './ScmCheats';
import {CRANE_LAS_VEGAS,CRANE_MAGNO,CRANE_NONE,CRANE_QUARRY,CRANE_WRECKING_BALL} from './ScmPlayerInfo';
import {nativeUppercaseKey} from './nativeKeyGen';
import {NativeAngledRect} from './nativeAngledRect';
import {requireAsset} from '../assets/binary';
import {scmOpcode} from './scmOpcodes';
import {USE_TEXT_DISABLE_NEXT_FRAME,USE_TEXT_ENABLED_BY_SCRIPT} from './ScmMessages';
import {BLIP_CAR,BLIP_CHAR,BLIP_CONTACT_POINT,BLIP_COORD,BLIP_DISPLAY_BLIPONLY,BLIP_DISPLAY_BOTH,BLIP_OBJECT,BLIP_PICKUP} from './ScmRadar';
import {STAT_MISSION_ATTEMPTS,STAT_PROGRESS_MADE} from './ScmGameState';
import {BUTTON,CONTROLLER_JOYPAD} from './ScmPads';
import {switchArea} from './ScmNodeSwitches';
import {ScmCamera} from './ScmCamera';
import {fixAngleDegrees} from './ScmObjects';
import {UnsupportedScmCommand,type ScmScriptedTask,type ScmThread,type ScmWorldCommands} from './ScmThread';

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
/** One bit of a script variable: the bit the variable-bit commands name, masked as a shift count is. */
const varBit=(bit:number)=>1<<(bit&31);
const varBitSet=(t:ScmThread,p:ScmParameter,bit:number)=>(t.readInt(p)&varBit(bit))!==0;
const setVarBit=(t:ScmThread,p:ScmParameter,bit:number,on:boolean)=>{
 const value=t.readInt(p);t.writeInt(p,on?value|varBit(bit):value&~varBit(bit));
};
/** CEntity::TransformFromObjectSpace (0x5334F0): an offset in an entity's own space taken into the world. */
function transformFromObjectSpace(matrix:{right:{x:number;y:number;z:number};forward:{x:number;y:number;z:number};up:{x:number;y:number;z:number};position:{x:number;y:number;z:number}},offset:{x:number;y:number;z:number}){
 return {
  x:matrix.right.x*offset.x+matrix.forward.x*offset.y+matrix.up.x*offset.z+matrix.position.x,
  y:matrix.right.y*offset.x+matrix.forward.y*offset.y+matrix.up.y*offset.z+matrix.position.y,
  z:matrix.right.z*offset.x+matrix.forward.z*offset.y+matrix.up.z*offset.z+matrix.position.z,
 };
}
/** StoreCarCharIsIn: the car a ped rides, which a ped on foot does not have. */
const storeCarCharIsIn:ScmCommandHandler=(t,p,i)=>{
 const vehicle=world(t,i,'pedVehicle')(t.readInt(p[0]));
 requireAsset(vehicle!==undefined,'STORE_CAR_CHAR_IS_IN with a ped that is not in a vehicle throws in the source.');
 t.writeInt(p[1],vehicle!);
};
/** IsCharInArea2D and IsCharInArea3D: two corners, and the ped read at its vehicle while it rides in one. */
function charInArea(threeDimensional:boolean):ScmCommandHandler{
 return (t,p,i)=>{
  const handle=t.readInt(p[0]),axes=threeDimensional?3:2;
  const a={x:t.readFloat(p[1]),y:t.readFloat(p[2]),z:threeDimensional?t.readFloat(p[3]):0};
  const b={x:t.readFloat(p[1+axes]),y:t.readFloat(p[2+axes]),z:threeDimensional?t.readFloat(p[3+axes]):0};
  if(bool(t,p[1+axes*2]))t.host?.world?.highlightArea?.({x:(a.x+b.x)/2,y:(a.y+b.y)/2,z:(a.z+b.z)/2},{x:Math.abs(b.x-a.x)/2,y:Math.abs(b.y-a.y)/2,z:Math.abs(b.z-a.z)/2});
  const position=world(t,i,'pedPosition')(handle);
  const within=(value:number,low:number,high:number)=>value>=Math.min(low,high)&&value<=Math.max(low,high);
  const inside=within(position.x,a.x,b.x)&&within(position.y,a.y,b.y)&&(!threeDimensional||within(position.z,a.z,b.z));
  t.updateCompareFlag(inside,negated(i));
 };
}
/** DoLocateCharChecks: the gates a locate command insists on before it measures anything. */
function locateCharChecks(t:ScmThread,i:ScmInstruction,handle:number,gates:{car:boolean;foot:boolean;stopped?:boolean}){
 const vehicle=world(t,i,'pedVehicle')(handle);
 if(gates.car&&vehicle===undefined)return false;
 if(gates.foot&&vehicle!==undefined)return false;
 if(gates.stopped&&!world(t,i,'pedIsStopped')(handle))return false;
 return true;
}
/** LocateChar2D and LocateChar3D: the box around the point, which the ped's own position must be inside. */
function insideBox(position:{x:number;y:number;z:number},point:{x:number;y:number;z:number},radius:{x:number;y:number;z:number},threeDimensional:boolean){
 if(Math.abs(position.x-point.x)>radius.x||Math.abs(position.y-point.y)>radius.y)return false;
 return !threeDimensional||Math.abs(position.z-point.z)<=radius.z;
}
/** The locate commands that name a vehicle rather than a ped, in the shape the reversed char helper has. */
function locateVehicle(threeDimensional:boolean):ScmCommandHandler{
 return (t,p,i)=>{
  const handle=t.readInt(p[0]),axes=threeDimensional?3:2;
  const point={x:t.readFloat(p[1]),y:t.readFloat(p[2]),z:threeDimensional?t.readFloat(p[3]):0};
  const radius={x:t.readFloat(p[1+axes]),y:t.readFloat(p[2+axes]),z:threeDimensional?t.readFloat(p[3+axes]):0};
  if(bool(t,p[1+axes*2]))t.host?.world?.highlightArea?.(point,radius);
  t.updateCompareFlag(insideBox(world(t,i,'vehiclePosition')(handle),point,radius,threeDimensional),negated(i));
 };
}
/** The locate commands that name a point: the ped, the point, the radius, then the highlight flag. */
function locateCharPoint(threeDimensional:boolean,gates:{car:boolean;foot:boolean;stopped?:boolean}):ScmCommandHandler{
 return (t,p,i)=>{
  const handle=t.readInt(p[0]);
  const axes=threeDimensional?3:2;
  const point={x:t.readFloat(p[1]),y:t.readFloat(p[2]),z:threeDimensional?t.readFloat(p[3]):0};
  const radius={x:t.readFloat(p[1+axes]),y:t.readFloat(p[2+axes]),z:threeDimensional?t.readFloat(p[3+axes]):0};
  if(bool(t,p[1+axes*2]))t.host?.world?.highlightArea?.(point,radius);
  const inside=locateCharChecks(t,i,handle,gates)&&insideBox(world(t,i,'pedPosition')(handle),point,radius,threeDimensional);
  t.updateCompareFlag(inside,negated(i));
 };
}
/** The locate commands that name another ped, whose own position is the point. */
function locateCharChar(threeDimensional:boolean,gates:{car:boolean;foot:boolean;stopped?:boolean}):ScmCommandHandler{
 return (t,p,i)=>{
  const handle=t.readInt(p[0]),other=t.readInt(p[1]);
  const axes=threeDimensional?3:2;
  const radius={x:t.readFloat(p[2]),y:t.readFloat(p[3]),z:threeDimensional?t.readFloat(p[4]):0};
  const point=world(t,i,'pedPosition')(other);
  if(bool(t,p[2+axes]))t.host?.world?.highlightArea?.(point,radius);
  const inside=locateCharChecks(t,i,handle,gates)&&insideBox(world(t,i,'pedPosition')(handle),point,radius,threeDimensional);
  t.updateCompareFlag(inside,negated(i));
 };
}
/** The locate commands that name a script object, whose own position is the point. The runtime holds those
 * objects itself, so nothing outside it is asked. LocateCharEntity2D and its 3D twin pass the entity's position
 * straight to LocateChar2D and LocateChar3D. */
function locateCharObject(threeDimensional:boolean,gates:{car:boolean;foot:boolean}):ScmCommandHandler{
 return (t,p,i)=>{
  const handle=t.readInt(p[0]),axes=threeDimensional?3:2;
  const radius={x:t.readFloat(p[2]),y:t.readFloat(p[3]),z:threeDimensional?t.readFloat(p[4]):0};
  const point=game(t,i).objects.at(t.readInt(p[1])).position;
  if(bool(t,p[2+axes]))t.host?.world?.highlightArea?.(point,radius);
  const inside=locateCharChecks(t,i,handle,gates)&&insideBox(world(t,i,'pedPosition')(handle),point,radius,threeDimensional);
  t.updateCompareFlag(inside,negated(i));
 };
}
/* The angled-area commands. IsPedInAngledArea2D and its 3D twin measure the ped's own position against the
 * tilted rectangle the script gives, after the same in-car, on-foot and stopped checks the locate commands make.
 * The 3D form adds a height band between the two corners' own heights, taken in either order, and the source
 * folds a failed check into the same "outside" answer rather than skipping the test. */
function charInAngledArea(threeDimensional:boolean,gates:{car:boolean;foot:boolean;stopped?:boolean}):ScmCommandHandler{
 return (t,p,i)=>{
  const handle=t.readInt(p[0]);
  const a={x:t.readFloat(p[1]),y:t.readFloat(p[2])},b=threeDimensional
   ?{x:t.readFloat(p[4]),y:t.readFloat(p[5])}
   :{x:t.readFloat(p[3]),y:t.readFloat(p[4])};
  const aZ=threeDimensional?t.readFloat(p[3]):0,bZ=threeDimensional?t.readFloat(p[6]):0;
  const widthAndDirection=t.readFloat(threeDimensional?p[7]:p[5]);
  const position=world(t,i,'pedPosition')(handle);
  const area=new NativeAngledRect(a,b,widthAndDirection);
  // The source highlights the area whether the ped is in it or not, and whether the checks passed or not.
  if(bool(t,p[threeDimensional?8:6]))t.host?.world?.highlightAngledArea?.(area);
  const insideHeight=!threeDimensional||position.z>=Math.min(aZ,bZ)&&position.z<=Math.max(aZ,bZ);
  const inside=insideHeight&&locateCharChecks(t,i,handle,gates)&&area.contains(position);
  t.updateCompareFlag(inside,negated(i));
 };
}
/** The locate commands that name a vehicle, whose own position is the point. LocateCharEntity2D and its 3D twin
 * again, over a car rather than an object. */
function locateCharVehicle(threeDimensional:boolean,gates:{car:boolean;foot:boolean}):ScmCommandHandler{
 return (t,p,i)=>{
  const handle=t.readInt(p[0]),axes=threeDimensional?3:2;
  const radius={x:t.readFloat(p[2]),y:t.readFloat(p[3]),z:threeDimensional?t.readFloat(p[4]):0};
  const point=world(t,i,'vehiclePosition')(t.readInt(p[1]));
  if(bool(t,p[2+axes]))t.host?.world?.highlightArea?.(point,radius);
  const inside=locateCharChecks(t,i,handle,gates)&&insideBox(world(t,i,'pedPosition')(handle),point,radius,threeDimensional);
  t.updateCompareFlag(inside,negated(i));
 };
}
/** eVehicleAppearance, which IsPedInVehicleOfAppearance compares against. */
/** eWeaponType's two wildcards and the unidentified type the damage question treats as none. */
const WEAPON_UNIDENTIFIED=55,WEAPON_ANYMELEE=56,WEAPON_ANYWEAPON=57;
/** CDarkel::CheckDamagedWeaponType: the melee weapons (WEAPON_UNARMED to WEAPON_CANE) for WEAPON_ANYMELEE; for
 * WEAPON_ANYWEAPON those, every weapon a ped carries up to WEAPON_INFRARED, WEAPON_EXPLOSION and WEAPON_UZI_DRIVEBY, but
 * not the parachute, a ram, a run over, drowning or a fall. No damage (-1) is never a match. */
export function checkDamagedWeaponType(damage:number,expected:number){
 if(damage<0)return false;
 if(expected===WEAPON_ANYMELEE)return damage<=15;
 if(expected!==WEAPON_ANYWEAPON)return false;
 return damage<=45||damage===51||damage===52;
}
/** eModelID entries the taxi and police questions name outright. */
const MODEL_TAXI=420,MODEL_CABBIE=438,MODEL_PREDATOR=430;
const VEHICLE_APPEARANCE_BIKE=2,VEHICLE_APPEARANCE_HELI=3,VEHICLE_APPEARANCE_BOAT=4,VEHICLE_APPEARANCE_PLANE=5;
/** IsPedInVehicleOfAppearance: the ped is in a vehicle and that vehicle looks like the one asked for. */
function pedInVehicleOfAppearance(appearance:number):ScmCommandHandler{
 return (t,p,i)=>{
  const vehicle=world(t,i,'pedVehicle')(t.readInt(p[0]));
  const matches=vehicle!==undefined&&world(t,i,'vehicleAppearance')(vehicle)===appearance;
  t.updateCompareFlag(matches,negated(i));
 };
}
/** CRunningScript::GivePedScriptedTask: a handle of -1 records the task into the open sequence instead of
 * giving it to a ped, and a ped keeps the command that asked for the task beside it. */
/** The two animation tasks, which share every operand and differ only in whether anything may interrupt them. */
function playAnimTask(t:ScmThread,p:ScmParameter[],interruptable:boolean):ScmScriptedTask{
 return {kind:'playAnim',animationName:t.text(p[1]),animationFile:t.text(p[2]),blendSpeed:t.readFloat(p[3]),
  loop:!!t.readInt(p[4]),lockX:!!t.readInt(p[5]),lockY:!!t.readInt(p[6]),keepLastFrame:!!t.readInt(p[7]),
  time:t.readInt(p[8]),interruptable};
}
function scriptedTask(thread:ScmThread,i:ScmInstruction,pedHandle:number,task:ScmScriptedTask){
 if(pedHandle===-1){game(thread,i).sequences.addTaskToActiveSequence(task);return;}
 world(thread,i,'givePedScriptedTask')(pedHandle,task,i.opcode&0x7fff);
}
const vec=(t:ScmThread,p:ScmParameter[],at:number)=>({x:t.readFloat(p[at]),y:t.readFloat(p[at+1]),z:t.readFloat(p[at+2])});
/** Blip command dispatch is unreversed. The display flag defaults follow the
 * conventional handler behaviour: plain adds show blip and marker, sprite
 * adds show the blip only. CRadar itself ignores the colour argument. */
/* The ADD_BLIP_FOR_* handlers are unreversed; like their Vice City forebears the port scales a new trace blip to 3
 * (CRadar::ChangeBlipScale), where the blip table itself starts it at 1. */
function entityBlip(type:number):ScmCommandHandler{return (t,p,i)=>{const {radar}=game(t,i),blip=radar.setEntityBlip(type,t.readInt(p[0]),BLIP_DISPLAY_BOTH);radar.changeScale(blip,3);t.writeInt(p[1],blip|0);};}
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
/** The move state SET_NEXT_DESIRED_MOVE_STATE left for an enter-car task, which takes it; the next is a run again. */
function takeNextDesiredMoveState(t:ScmThread,i:ScmInstruction){const g=game(t,i),state=g.nextDesiredMoveState;g.nextDesiredMoveState=6;return state;}
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
 // --- CStats (StatCommands.cpp). Each command but the _NO_MESSAGE ones also calls DisplayScriptStatUpdateMessage,
 // which the host draws (stats.onUpdateMessage).
 // SetStat<int32> converts through float before SetStatValue truncates again.
 SET_INT_STAT:(t,p,i)=>{const stat=t.readInt(p[0]),v=Math.fround(t.readInt(p[1]));game(t,i).stats.set(stat,v);game(t,i).stats.onUpdateMessage?.(true,stat,v);},
 SET_FLOAT_STAT:(t,p,i)=>{const stat=t.readInt(p[0]),v=t.readFloat(p[1]);game(t,i).stats.set(stat,v);game(t,i).stats.onUpdateMessage?.(true,stat,v);},
 REGISTER_INT_STAT:(t,p,i)=>{const stat=t.readInt(p[0]),v=Math.fround(t.readInt(p[1]));game(t,i).stats.setNewRecord(stat,v);game(t,i).stats.onUpdateMessage?.(true,stat,v);},
 REGISTER_FLOAT_STAT:(t,p,i)=>{const stat=t.readInt(p[0]),v=t.readFloat(p[1]);game(t,i).stats.setNewRecord(stat,v);game(t,i).stats.onUpdateMessage?.(true,stat,v);},
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
 /* SET_PLAYER_CONTROL is MakePlayerSafe with the state inverted, and that routine sets the pad's own safe
  * flag, clears the damage flag and makes everybody back off before it reaches the ped, which is the host's.
  * IS_PLAYER_CONTROL_ON, whose own handler the reference does not register, is that same pad flag read back. */
 SET_PLAYER_CONTROL:(t,p,i)=>{
  const player=t.readInt(p[0]),control=bool(t,p[1]),state=game(t,i);
  state.pads.setPlayerSafe(player,!control);
  state.playerInfo.canBeDamaged=control;
  state.playerInfo.everybodyBackOff=!control;
  world(t,i,'setPlayerControl')(player,control);
  // SetPlayerControl is CPlayerInfo::MakePlayerSafe(!state, 10): the host's half makes the player and every car
  // undamageable while control is off, and damageable again when it comes back.
  world(t,i,'makePlayerSafe')(player,!control,10);
 },
 IS_PLAYER_CONTROL_ON:(t,p,i)=>{t.updateCompareFlag(!game(t,i).pads.playerSafe[t.readInt(p[0])],negated(i));},
 // BUILD_PLAYER_MODEL is CClothes::RebuildPlayer over the description the clothes commands filled, and then
 // CReplay::Init; both are the host's, which owns the model and the replay buffer.
 BUILD_PLAYER_MODEL:(t,p,i)=>{world(t,i,'buildPlayerModel')(t.readInt(p[0]));},
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
 ADD_BLIP_FOR_COORD:(t,p,i)=>{const {radar}=game(t,i),blip=radar.setCoordBlip(BLIP_COORD,vec(t,p,0),BLIP_DISPLAY_BOTH);radar.changeScale(blip,3);t.writeInt(p[3],blip|0);},
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
 // --- The peds a script holds (CharacterCommands.cpp is reversed; the creation dispatch is not, and reaches
 // CPopulation::AddPed). A host owns the peds and answers for them by handle.
 CREATE_CHAR:(t,p,i)=>{
  const position=vec(t,p,2);
  t.writeInt(p[5],world(t,i,'createChar')(t.readInt(p[0]),model(t,i,p[1]),position.x,position.y,position.z));
 },
 DELETE_CHAR:(t,p,i)=>{world(t,i,'deletePed')(t.readInt(p[0]));},
 DOES_CHAR_EXIST:(t,p,i)=>{t.updateCompareFlag(world(t,i,'pedExists')(t.readInt(p[0])),negated(i));},
 // A handle that names no ped is dead, as the command tests the pointer before the state.
 IS_CHAR_DEAD:(t,p,i)=>{
  const handle=t.readInt(p[0]),exists=world(t,i,'pedExists')(handle);
  t.updateCompareFlag(!exists||world(t,i,'pedIsDeadForScript')(handle),negated(i));
 },
 GET_CHAR_COORDINATES:(t,p,i)=>{
  const position=world(t,i,'pedPosition')(t.readInt(p[0]));
  t.writeFloat(p[1],position.x);t.writeFloat(p[2],position.y);t.writeFloat(p[3],position.z);
 },
 SET_CHAR_COORDINATES:(t,p,i)=>{const v=vec(t,p,1);world(t,i,'setPedCoordinates')(t.readInt(p[0]),v.x,v.y,v.z);},
 SET_CHAR_HEALTH:(t,p,i)=>{
  const handle=t.readInt(p[0]),health=t.readFloat(p[1]);
  if(health===0)world(t,i,'killPed')(handle);else world(t,i,'setPedHealth')(handle,health);
 },
 SET_CHAR_ACCURACY:(t,p,i)=>{world(t,i,'setPedAccuracy')(t.readInt(p[0]),t.readInt(p[1])&255);},
 SET_CHAR_ONLY_DAMAGED_BY_PLAYER:(t,p,i)=>{world(t,i,'setPedInvulnerable')(t.readInt(p[0]),bool(t,p[1]));},
 SET_CHAR_PROOFS:(t,p,i)=>{world(t,i,'setPedProofs')(t.readInt(p[0]),{bullet:bool(t,p[1]),fire:bool(t,p[2]),explosion:bool(t,p[3]),collision:bool(t,p[4]),melee:bool(t,p[5])});},
 MARK_CHAR_AS_NO_LONGER_NEEDED:(t,p,i)=>{world(t,i,'markPedNoLongerNeeded')(t.readInt(p[0]));},
 // --- Locating a car. The command's own helper is not reversed, but the char one is and these are its shape:
 // a box around the point with a radius per axis, the flat form ignoring height, and the highlight drawn
 // whatever the answer. The stopped forms ask CTheScripts::IsVehicleStopped, which is reversed.
 LOCATE_CAR_2D:locateVehicle(false),
 LOCATE_CAR_3D:locateVehicle(true),
 // --- Peds created straight into a car (CPopulation::AddPedInCar 0x613A00 is reversed; the dispatches are
 // not). The driver forms ask for the driver's seat, and the passenger form names the seat it wants.
 CREATE_CHAR_INSIDE_CAR:(t,p,i)=>{
  t.writeInt(p[3],world(t,i,'createCharInsideCar')(t.readInt(p[0]),t.readInt(p[1]),model(t,i,p[2]),'driver'));
 },
 CREATE_RANDOM_CHAR_AS_DRIVER:(t,p,i)=>{t.writeInt(p[1],world(t,i,'createRandomCharInCar')(t.readInt(p[0]),'driver'));},
 CREATE_RANDOM_CHAR_AS_PASSENGER:(t,p,i)=>{t.writeInt(p[2],world(t,i,'createRandomCharInCar')(t.readInt(p[0]),t.readInt(p[1])));},
 /* Four more whose dispatches the reference leaves unregistered but whose operands it documents outright, each
  * reaching a routine this runtime already goes through. The passenger form is the seated creation again, with
  * the seat the script names instead of the driver's; the random form is the same creation with a model and a
  * ped type the game picks. */
 CREATE_CHAR_AS_PASSENGER:(t,p,i)=>{
  t.writeInt(p[4],world(t,i,'createCharInsideCar')(t.readInt(p[0]),t.readInt(p[1]),model(t,i,p[2]),t.readInt(p[3])));
 },
 CREATE_RANDOM_CHAR:(t,p,i)=>{
  const point=vec(t,p,0);
  t.writeInt(p[3],world(t,i,'createRandomChar')(point.x,point.y,point.z));
 },
 CLEAR_LOOK_AT:(t,p,i)=>{world(t,i,'clearPedLookAt')(t.readInt(p[0]));},
 IS_GROUP_MEMBER:(t,p,i)=>{
  t.updateCompareFlag(world(t,i,'pedIsInGroup')(t.readInt(p[0]),t.readInt(p[1])),negated(i));
 },
 // --- CVehicleModelInfo's custom plates (SetCustomCarPlateText 0x4C8980 is reversed; the two command
 // dispatches are not). The plate field holds eight characters, which is where retail's truncation comes from.
 CUSTOM_PLATE_FOR_NEXT_CAR:(t,p,i)=>{
  const g=game(t,i),key=model(t,i,p[0]),entry=g.customPlates.get(key)??{};
  entry.text=t.text(p[1]).slice(0,8);g.customPlates.set(key,entry);
 },
 CUSTOM_PLATE_DESIGN_FOR_NEXT_CAR:(t,p,i)=>{
  const g=game(t,i),key=model(t,i,p[0]),entry=g.customPlates.get(key)??{};
  entry.design=t.readInt(p[1]);g.customPlates.set(key,entry);
 },
 /* The eighteen variable-bit commands (0x8B4-0x8C5). Each takes the variable itself and then the bit, which is
  * an immediate for the CONST forms, a global variable for the VAR forms and a local one for the LVAR forms; the
  * GLOBAL and LOCAL halves differ only in which storage their first operand names, which the operand's own type
  * already says, so one pair of readers serves all of them. The script's variables are the runtime's own, so
  * nothing outside it is reached. A shift count is taken modulo thirty-two, as the instruction it compiles to is.
  */
 IS_GLOBAL_VAR_BIT_SET_CONST:(t,p,i)=>{t.updateCompareFlag(varBitSet(t,p[0],t.readInt(p[1])),negated(i));},
 IS_GLOBAL_VAR_BIT_SET_VAR:(t,p,i)=>{t.updateCompareFlag(varBitSet(t,p[0],t.readInt(p[1])),negated(i));},
 IS_GLOBAL_VAR_BIT_SET_LVAR:(t,p,i)=>{t.updateCompareFlag(varBitSet(t,p[0],t.readInt(p[1])),negated(i));},
 IS_LOCAL_VAR_BIT_SET_CONST:(t,p,i)=>{t.updateCompareFlag(varBitSet(t,p[0],t.readInt(p[1])),negated(i));},
 IS_LOCAL_VAR_BIT_SET_VAR:(t,p,i)=>{t.updateCompareFlag(varBitSet(t,p[0],t.readInt(p[1])),negated(i));},
 IS_LOCAL_VAR_BIT_SET_LVAR:(t,p,i)=>{t.updateCompareFlag(varBitSet(t,p[0],t.readInt(p[1])),negated(i));},
 SET_GLOBAL_VAR_BIT_CONST:(t,p)=>{setVarBit(t,p[0],t.readInt(p[1]),true);},
 SET_GLOBAL_VAR_BIT_VAR:(t,p)=>{setVarBit(t,p[0],t.readInt(p[1]),true);},
 SET_GLOBAL_VAR_BIT_LVAR:(t,p)=>{setVarBit(t,p[0],t.readInt(p[1]),true);},
 SET_LOCAL_VAR_BIT_CONST:(t,p)=>{setVarBit(t,p[0],t.readInt(p[1]),true);},
 SET_LOCAL_VAR_BIT_VAR:(t,p)=>{setVarBit(t,p[0],t.readInt(p[1]),true);},
 SET_LOCAL_VAR_BIT_LVAR:(t,p)=>{setVarBit(t,p[0],t.readInt(p[1]),true);},
 CLEAR_GLOBAL_VAR_BIT_CONST:(t,p)=>{setVarBit(t,p[0],t.readInt(p[1]),false);},
 CLEAR_GLOBAL_VAR_BIT_VAR:(t,p)=>{setVarBit(t,p[0],t.readInt(p[1]),false);},
 CLEAR_GLOBAL_VAR_BIT_LVAR:(t,p)=>{setVarBit(t,p[0],t.readInt(p[1]),false);},
 CLEAR_LOCAL_VAR_BIT_CONST:(t,p)=>{setVarBit(t,p[0],t.readInt(p[1]),false);},
 CLEAR_LOCAL_VAR_BIT_VAR:(t,p)=>{setVarBit(t,p[0],t.readInt(p[1]),false);},
 CLEAR_LOCAL_VAR_BIT_LVAR:(t,p)=>{setVarBit(t,p[0],t.readInt(p[1]),false);},
 // SET_VISIBILITY_OF_CLOSEST_OBJECT_OF_TYPE: the world holds the object, so the host finds and flips it.
 SET_VISIBILITY_OF_CLOSEST_OBJECT_OF_TYPE:(t,p,i)=>{
  const v=vec(t,p,0);
  world(t,i,'setVisibilityOfClosestObjectOfType')(v.x,v.y,v.z,t.readFloat(p[3]),model(t,i,p[4]),bool(t,p[5]));
 },
 // CIplStore::RequestIplAndIgnore (0x405850) and its removals: besides the streaming request, each one sets
 // whether that placement group takes part in dynamic streaming any more. A host does the streaming.
 REQUEST_IPL:(t,p,i)=>{game(t,i).iplGroups.set(t.text(p[0]).toLowerCase(),{requested:true,discreet:false});},
 REMOVE_IPL:(t,p,i)=>{game(t,i).iplGroups.set(t.text(p[0]).toLowerCase(),{requested:false,discreet:false});},
 REMOVE_IPL_DISCREETLY:(t,p,i)=>{game(t,i).iplGroups.set(t.text(p[0]).toLowerCase(),{requested:false,discreet:true});},
 // ATTACH_ANIMS_TO_MODEL: CBaseModelInfo::SetAnimFile, the block a model takes its animations from.
 ATTACH_ANIMS_TO_MODEL:(t,p,i)=>{game(t,i).modelAnimFiles.set(model(t,i,p[0]),t.text(p[1]));},
 // --- CScriptsForBrains. The record's fields and these operands line up one to one: the streamed script
 // index, the model, a percentage chance, the activation radius and the grouping id.
 ALLOCATE_STREAMED_SCRIPT_TO_OBJECT:(t,p,i)=>{
  game(t,i).scriptBrains.addObjectBrain(t.readInt(p[0]),model(t,i,p[1]),t.readInt(p[2]),t.readFloat(p[3]),t.readInt(p[4]));
 },
 ALLOCATE_STREAMED_SCRIPT_TO_RANDOM_PED:(t,p,i)=>{
  game(t,i).scriptBrains.addRandomPedBrain(t.readInt(p[0]),model(t,i,p[1]),t.readInt(p[2]));
 },
 REGISTER_SCRIPT_BRAIN_FOR_CODE_USE:(t,p,i)=>{game(t,i).scriptBrains.registerForCodeUse(t.readInt(p[0]),t.text(p[1]),false);},
 REGISTER_ATTRACTOR_SCRIPT_BRAIN_FOR_CODE_USE:(t,p,i)=>{game(t,i).scriptBrains.registerForCodeUse(t.readInt(p[0]),t.text(p[1]),true);},
 SWITCH_OBJECT_BRAINS:(t,p,i)=>{game(t,i).scriptBrains.switchObjectBrains(t.readInt(p[0]),bool(t,p[1]));},
 // --- CGarages. A name no garage in this world carries looks up as -1, and the command then does nothing.
 ACTIVATE_GARAGE:(t,p,i)=>{game(t,i).garages.activate(t.text(p[0]));},
 DEACTIVATE_GARAGE:(t,p,i)=>{game(t,i).garages.deactivate(t.text(p[0]));},
 OPEN_GARAGE:(t,p,i)=>{game(t,i).garages.open(t.text(p[0]));},
 CLOSE_GARAGE:(t,p,i)=>{game(t,i).garages.close(t.text(p[0]));},
 IS_GARAGE_OPEN:(t,p,i)=>{t.updateCompareFlag(game(t,i).garages.isOpen(t.text(p[0])),negated(i));},
 IS_GARAGE_CLOSED:(t,p,i)=>{t.updateCompareFlag(game(t,i).garages.isClosed(t.text(p[0])),negated(i));},
 CHANGE_GARAGE_TYPE:(t,p,i)=>{game(t,i).garages.changeType(t.text(p[0]),t.readInt(p[1]));},
 SET_GARAGE_RESPRAY_FREE:(t,p,i)=>{game(t,i).garages.setResprayFree(t.text(p[0]),bool(t,p[1]));},
 // --- CEntryExitManager. The operand layouts are the ones src/assets/scmEntryExits.ts already reads the file
 // with; applying a flag to the nearest entry-exit is the host's, since it holds them.
 SET_CLOSEST_ENTRY_EXIT_FLAG:(t,p,i)=>{
  world(t,i,'setClosestEntryExitFlag')(t.readFloat(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readInt(p[3]),bool(t,p[4]));
 },
 SWITCH_ENTRY_EXIT:(t,p,i)=>{world(t,i,'switchEntryExit')(t.text(p[0]),bool(t,p[1]));},
 // --- The script's pickups. CPickups::GenerateNewOne is a raw call in the reference, so the slot allocation
 // behind it is unknown; the operand layouts and the implied models and types are the ones the file reader in
 // src/assets/scmPickups.ts already uses, and these commands place the same records while the script runs.
 CREATE_PICKUP:(t,p,i)=>{t.writeInt(p[5],game(t,i).pickups.createPickup(model(t,i,p[0]),t.readInt(p[1]),vec(t,p,2)));},
 CREATE_PICKUP_WITH_AMMO:(t,p,i)=>{t.writeInt(p[6],game(t,i).pickups.createPickup(model(t,i,p[0]),t.readInt(p[1]),vec(t,p,3),t.readInt(p[2])));},
 CREATE_MONEY_PICKUP:(t,p,i)=>{t.writeInt(p[5],game(t,i).pickups.createMoneyPickup(vec(t,p,0),t.readInt(p[3])));},
 CREATE_PROTECTION_PICKUP:(t,p,i)=>{t.writeInt(p[5],game(t,i).pickups.createProtectionPickup(vec(t,p,0),t.readInt(p[3]),t.readInt(p[4])));},
 CREATE_LOCKED_PROPERTY_PICKUP:(t,p,i)=>{t.writeInt(p[4],game(t,i).pickups.createLockedPropertyPickup(vec(t,p,0),t.text(p[3])));},
 CREATE_FORSALE_PROPERTY_PICKUP:(t,p,i)=>{t.writeInt(p[5],game(t,i).pickups.createForSalePropertyPickup(vec(t,p,0),t.readInt(p[3]),t.text(p[4])));},
 CREATE_SNAPSHOT_PICKUP:(t,p,i)=>{t.writeInt(p[3],game(t,i).pickups.createSnapshotPickup(vec(t,p,0)));},
 CREATE_HORSESHOE_PICKUP:(t,p,i)=>{t.writeInt(p[3],game(t,i).pickups.createHorseshoePickup(vec(t,p,0)));},
 CREATE_OYSTER_PICKUP:(t,p,i)=>{t.writeInt(p[3],game(t,i).pickups.createOysterPickup(vec(t,p,0)));},
 HAS_PICKUP_BEEN_COLLECTED:(t,p,i)=>{t.updateCompareFlag(game(t,i).pickups.hasBeenCollected(t.readInt(p[0])),negated(i));},
 DOES_PICKUP_EXIST:(t,p,i)=>{t.updateCompareFlag(game(t,i).pickups.exists(t.readInt(p[0])),negated(i));},
 REMOVE_PICKUP:(t,p,i)=>{game(t,i).pickups.remove(t.readInt(p[0]));},
 GET_PICKUP_COORDINATES:(t,p,i)=>{
  const pickup=game(t,i).pickups.at(t.readInt(p[0]));
  requireAsset(pickup,'GET_PICKUP_COORDINATES names a pickup that is not there.');
  t.writeFloat(p[1],pickup!.position.x);t.writeFloat(p[2],pickup!.position.y);t.writeFloat(p[3],pickup!.position.z);
 },
 // --- CAnimManager's blocks (AnimManager.cpp's reference counting is reversed; these dispatches are not).
 REQUEST_ANIMATION:(t,p,i)=>{game(t,i).animBlocks.request(t.text(p[0]));},
 HAS_ANIMATION_LOADED:(t,p,i)=>{t.updateCompareFlag(game(t,i).animBlocks.hasLoaded(t.text(p[0])),negated(i));},
 REMOVE_ANIMATION:(t,p,i)=>{game(t,i).animBlocks.remove(t.text(p[0]));},
 // --- CVehicleRecording (VehicleRecording.cpp is reversed; these dispatches are not, and each names the
 // routine it reaches). Reading the file and driving the car are the host's.
 REQUEST_CAR_RECORDING:(t,p,i)=>{game(t,i).vehicleRecordings.requestRecordingFile(t.readInt(p[0]));},
 HAS_CAR_RECORDING_BEEN_LOADED:(t,p,i)=>{t.updateCompareFlag(game(t,i).vehicleRecordings.hasRecordingFileBeenLoaded(t.readInt(p[0])),negated(i));},
 REMOVE_CAR_RECORDING:(t,p,i)=>{game(t,i).vehicleRecordings.removeRecordingFile(t.readInt(p[0]));},
 START_PLAYBACK_RECORDED_CAR:(t,p,i)=>{game(t,i).vehicleRecordings.startPlayback(t.readInt(p[0]),t.readInt(p[1]),false,false);},
 START_PLAYBACK_RECORDED_CAR_USING_AI:(t,p,i)=>{game(t,i).vehicleRecordings.startPlayback(t.readInt(p[0]),t.readInt(p[1]),true,false);},
 START_PLAYBACK_RECORDED_CAR_LOOPED:(t,p,i)=>{game(t,i).vehicleRecordings.startPlayback(t.readInt(p[0]),t.readInt(p[1]),false,true);},
 STOP_PLAYBACK_RECORDED_CAR:(t,p,i)=>{game(t,i).vehicleRecordings.stopPlayback(t.readInt(p[0]));},
 PAUSE_PLAYBACK_RECORDED_CAR:(t,p,i)=>{game(t,i).vehicleRecordings.setPaused(t.readInt(p[0]),true);},
 UNPAUSE_PLAYBACK_RECORDED_CAR:(t,p,i)=>{game(t,i).vehicleRecordings.setPaused(t.readInt(p[0]),false);},
 SET_PLAYBACK_SPEED:(t,p,i)=>{game(t,i).vehicleRecordings.setSpeed(t.readInt(p[0]),t.readFloat(p[1]));},
 IS_PLAYBACK_GOING_ON_FOR_CAR:(t,p,i)=>{t.updateCompareFlag(game(t,i).vehicleRecordings.isPlaybackGoingOn(t.readInt(p[0])),negated(i));},
 // --- Commands over reversed engine routines: the area clear, the object-space transform and the task status.
 // A mission's own clear acts; MAIN's and the INTRO mission's belong to the new game's opening (see ScmMission).
 CLEAR_AREA:(t,p,i)=>{world(t,i,'clearExcitingStuffFromArea')(vec(t,p,0),t.readFloat(p[3]),bool(t,p[4]),t.usesMissionCleanup&&t.name.toLowerCase()!=='intro');},
 // CEntity::TransformFromObjectSpace: the offset through the car's own rows, right, forward and up.
 GET_OFFSET_FROM_CAR_IN_WORLD_COORDS:(t,p,i)=>{
  const world3=transformFromObjectSpace(world(t,i,'vehicleMatrix')(t.readInt(p[0])),vec(t,p,1));
  t.writeFloat(p[4],world3.x);t.writeFloat(p[5],world3.y);t.writeFloat(p[6],world3.z);
 },
 // The object twin of the car offset, over the object's own rows.
 GET_OFFSET_FROM_OBJECT_IN_WORLD_COORDS:(t,p,i)=>{
  const world3=transformFromObjectSpace(game(t,i).objects.matrix(t.readInt(p[0])),vec(t,p,1));
  t.writeFloat(p[4],world3.x);t.writeFloat(p[5],world3.y);t.writeFloat(p[6],world3.z);
 },
 PLACE_OBJECT_RELATIVE_TO_CAR:(t,p,i)=>{
  const world3=transformFromObjectSpace(world(t,i,'vehicleMatrix')(t.readInt(p[1])),vec(t,p,2));
  game(t,i).objects.setPosition(t.readInt(p[0]),world3);
 },
 // The record answers for the command the script names, and none at all when it holds nothing for that ped.
 GET_SCRIPT_TASK_STATUS:(t,p,i)=>{t.writeInt(p[2],world(t,i,'scriptTaskStatus')(t.readInt(p[0]),t.readInt(p[1])));},
 // --- One-field commands whose dispatch is not reversed, each named for the field it reaches.
 GIVE_WEAPON_TO_CHAR:(t,p,i)=>{world(t,i,'givePedWeapon')(t.readInt(p[0]),t.readInt(p[1]),t.readInt(p[2]));},
 SET_CHAR_MAX_HEALTH:(t,p,i)=>{world(t,i,'setPedMaxHealth')(t.readInt(p[0]),t.readFloat(p[1]));},
 SET_CHAR_SHOOT_RATE:(t,p,i)=>{world(t,i,'setPedShootRate')(t.readInt(p[0]),t.readInt(p[1]));},
 SET_CHAR_RELATIONSHIP:(t,p,i)=>{world(t,i,'setPedRelationship')(t.readInt(p[0]),t.readInt(p[1]),t.readInt(p[2]));},
 CLEAR_CHAR_RELATIONSHIP:(t,p,i)=>{world(t,i,'clearPedRelationship')(t.readInt(p[0]),t.readInt(p[1]),t.readInt(p[2]));},
 // Unlike the immediate form, this one lets the ped finish what it is doing.
 CLEAR_CHAR_TASKS:(t,p,i)=>{world(t,i,'clearPedTasks')(t.readInt(p[0]));},
 GET_CAR_HEALTH:(t,p,i)=>{t.writeInt(p[1],Math.trunc(world(t,i,'vehicleHealth')(t.readInt(p[0]))));},
 SET_CAR_HEALTH:(t,p,i)=>{world(t,i,'setVehicleHealth')(t.readInt(p[0]),t.readFloat(p[1]));},
 FREEZE_CAR_POSITION:(t,p,i)=>{world(t,i,'freezeVehiclePosition')(t.readInt(p[0]),bool(t,p[1]));},
 LOCK_CAR_DOORS:(t,p,i)=>{world(t,i,'setVehicleDoorLock')(t.readInt(p[0]),t.readInt(p[1]));},
 SET_CAR_DENSITY_MULTIPLIER:(t,p,i)=>{game(t,i).carDensityMultiplier=t.readFloat(p[0]);},
 SWITCH_WIDESCREEN:(t,p,i)=>{game(t,i).widescreenOn=bool(t,p[0]);},
 SET_AREA_VISIBLE:(t,p,i)=>{game(t,i).currentArea=t.readInt(p[0]);},
 /* --- CAEScriptAudioEntity's four mission-audio slots. Every command's slot operand is one-based and the
  * engine's is not, so each subtracts one; the sample the script names is an audio event. Playing the sound is
  * the host's, which is told each time the script loads, plays or clears a slot. */
 LOAD_MISSION_AUDIO:(t,p,i)=>{
  const slot=t.readInt(p[0]),sample=t.readInt(p[1]);
  game(t,i).missionAudio.preload(slot,sample);
  t.host?.world?.loadMissionAudio?.(slot,sample);
 },
 HAS_MISSION_AUDIO_LOADED:(t,p,i)=>{t.updateCompareFlag(game(t,i).missionAudio.hasLoaded(t.readInt(p[0])),negated(i));},
 PLAY_MISSION_AUDIO:(t,p,i)=>{
  const slot=t.readInt(p[0]);
  if(game(t,i).missionAudio.play(slot))t.host?.world?.playMissionAudio?.(slot);
 },
 HAS_MISSION_AUDIO_FINISHED:(t,p,i)=>{t.updateCompareFlag(game(t,i).missionAudio.hasFinished(t.readInt(p[0])),negated(i));},
 IS_MISSION_AUDIO_PLAYING:(t,_p,i)=>{t.updateCompareFlag(game(t,i).missionAudio.anyPlaying,negated(i));},
 IS_MISSION_AUDIO_LOADING:(t,_p,i)=>{t.updateCompareFlag(game(t,i).missionAudio.anyLoading,negated(i));},
 CLEAR_MISSION_AUDIO:(t,p,i)=>{
  const slot=t.readInt(p[0]);game(t,i).missionAudio.clear(slot);t.host?.world?.clearMissionAudio?.(slot);
 },
 SET_MISSION_AUDIO_POSITION:(t,p,i)=>{game(t,i).missionAudio.setPosition(t.readInt(p[0]),vec(t,p,1));},
 ATTACH_MISSION_AUDIO_TO_CHAR:(t,p,i)=>{game(t,i).missionAudio.attach(t.readInt(p[0]),'ped',t.readInt(p[1]));},
 ATTACH_MISSION_AUDIO_TO_CAR:(t,p,i)=>{game(t,i).missionAudio.attach(t.readInt(p[0]),'vehicle',t.readInt(p[1]));},
 ATTACH_MISSION_AUDIO_TO_OBJECT:(t,p,i)=>{game(t,i).missionAudio.attach(t.readInt(p[0]),'object',t.readInt(p[1]));},
 // The report commands name no slot: they ask for one event where the script says.
 REPORT_MISSION_AUDIO_EVENT_AT_POSITION:(t,p,i)=>{game(t,i).missionAudio.report(t.readInt(p[3]),vec(t,p,0));},
 REPORT_MISSION_AUDIO_EVENT_AT_CHAR:(t,p,i)=>{game(t,i).missionAudio.report(t.readInt(p[1]),{kind:'ped',handle:t.readInt(p[0])});},
 REPORT_MISSION_AUDIO_EVENT_AT_CAR:(t,p,i)=>{game(t,i).missionAudio.report(t.readInt(p[1]),{kind:'vehicle',handle:t.readInt(p[0])});},
 REPORT_MISSION_AUDIO_EVENT_AT_OBJECT:(t,p,i)=>{game(t,i).missionAudio.report(t.readInt(p[1]),{kind:'object',handle:t.readInt(p[0])});},
 // GET_CITY_PLAYER_IS_IN is the map zone's own level at the player's position, as eLevelName: the countryside,
 // then the three cities. The map zones are the host's, which reads the level straight off them.
 GET_CITY_PLAYER_IS_IN:(t,p,i)=>{t.writeInt(p[1],world(t,i,'playerCity')(t.readInt(p[0])));},
 // GET_CURRENT_DAY_OF_WEEK is CClock::CurrentDay, which the clock already keeps: one to seven, starting at
 // four as CClock::Initialise leaves it.
 GET_CURRENT_DAY_OF_WEEK:(t,p,i)=>{t.writeInt(p[0],game(t,i).clock.currentDay);},
 // GET_AREA_VISIBLE reads back the same CGame::currArea the setter writes.
 GET_AREA_VISIBLE:(t,p,i)=>{t.writeInt(p[0],game(t,i).currentArea);},
 // SHOW_UPDATE_STATS is CStats::bShowUpdateStats, which gates the stat-change messages the HUD draws.
 SHOW_UPDATE_STATS:(t,p,i)=>{game(t,i).showUpdateStats=bool(t,p[0]);},
 // --- More reversed vehicle commands (VehicleCommands.cpp).
 GET_CAR_SPEED:(t,p,i)=>{t.writeFloat(p[1],world(t,i,'vehicleSpeed')(t.readInt(p[0])));},
 SET_CAR_DRIVING_STYLE:(t,p,i)=>{world(t,i,'setVehicleDrivingStyle')(t.readInt(p[0]),t.readInt(p[1]));},
 // The two colour questions and the boot are left out: the pinned opcode table carries no operand list for
 // them, so the decoder could not read their arguments even though their handlers are reversed.
 GET_EXTRA_CAR_COLOURS:(t,p,i)=>{
  const colours=world(t,i,'vehicleColours')(t.readInt(p[0]));
  t.writeInt(p[1],colours.tertiary);t.writeInt(p[2],colours.quaternary);
 },
 SKIP_TO_NEXT_ALLOWED_STATION:(t,p,i)=>{world(t,i,'skipTrainToNextStation')(t.readInt(p[0]));},
 DISABLE_HELI_AUDIO:(t,p,i)=>{world(t,i,'setHeliAudio')(t.readInt(p[0]),bool(t,p[1]));},
 CLEAR_HELI_ORIENTATION:(t,p,i)=>{world(t,i,'clearHeliOrientation')(t.readInt(p[0]));},
 REMOVE_RC_BUGGY:(t,_p,i)=>{world(t,i,'removeRCBuggy')();},
 IS_CAR_IN_AIR_PROPER:(t,p,i)=>{t.updateCompareFlag(world(t,i,'vehicleIsInAirProper')(t.readInt(p[0])),negated(i));},
 SET_HAS_BEEN_OWNED_FOR_CAR_GENERATOR:(t,p,i)=>{game(t,i).carGenerators.setHasBeenOwned(t.readInt(p[0]),bool(t,p[1]));},
 // The rail resistance is a multiple of its own default, and anything at or below nothing means the default.
 SET_RAILTRACK_RESISTANCE_MULT:(t,p,i)=>{const value=t.readFloat(p[0]);game(t,i).railTrackResistanceMultiplier=value>0?value:1;},
 // --- More reversed ped commands: the flags, the health, the attachment and the two area tests.
 GET_CHAR_HEALTH:(t,p,i)=>{t.writeInt(p[1],Math.trunc(world(t,i,'pedHealth')(t.readInt(p[0]))));},
 SET_CHAR_STAY_IN_SAME_PLACE:(t,p,i)=>{world(t,i,'setPedStayInSamePlace')(t.readInt(p[0]),bool(t,p[1]));},
 // The field is bNoCriticalHits, so the command's own sense is the opposite of what it stores.
 SET_CHAR_SUFFERS_CRITICAL_HITS:(t,p,i)=>{world(t,i,'setPedSuffersCriticalHits')(t.readInt(p[0]),bool(t,p[1]));},
 SET_CHAR_CAN_BE_SHOT_IN_VEHICLE:(t,p,i)=>{world(t,i,'setPedCanBeShotInVehicle')(t.readInt(p[0]),bool(t,p[1]));},
 SET_CHAR_CANT_BE_DRAGGED_OUT:(t,p,i)=>{world(t,i,'setPedCantBeDraggedOut')(t.readInt(p[0]),bool(t,p[1]));},
 FREEZE_CHAR_POSITION:(t,p,i)=>{world(t,i,'freezePedPosition')(t.readInt(p[0]),bool(t,p[1]));},
 SET_LOAD_COLLISION_FOR_CHAR_FLAG:(t,p,i)=>{world(t,i,'setPedLoadsCollision')(t.readInt(p[0]),bool(t,p[1]));},
 IS_CHAR_SITTING_IN_CAR:(t,p,i)=>{t.updateCompareFlag(world(t,i,'pedIsSittingInCar')(t.readInt(p[0]),t.readInt(p[1])),negated(i));},
 ATTACH_CHAR_TO_CAR:(t,p,i)=>{
  world(t,i,'attachPedToCar')(t.readInt(p[0]),t.readInt(p[1]),vec(t,p,2),t.readInt(p[5]),t.readFloat(p[6])*Math.PI/180,t.readInt(p[7]));
 },
 DETACH_CHAR_FROM_CAR:(t,p,i)=>{world(t,i,'detachPedFromCar')(t.readInt(p[0]));},
 // STORE_CAR_CHAR_IS_IN: the script keeps the car the ped rides in. A ped on foot is an error in the source,
 // which throws rather than writing anything, so the runtime stops there too.
 STORE_CAR_CHAR_IS_IN:storeCarCharIsIn,STORE_CAR_CHAR_IS_IN_NO_SAVE:storeCarCharIsIn,
 // The area tests take two corners rather than a point and a radius, and read the ped's vehicle while it rides.
 IS_CHAR_IN_AREA_2D:charInArea(false),IS_CHAR_IN_AREA_3D:charInArea(true),
 // --- The rest of the reversed ped commands, each setting or asking one thing of the ped.
 SET_CHAR_DECISION_MAKER:(t,p,i)=>{world(t,i,'setPedDecisionMaker')(t.readInt(p[0]),t.readInt(p[1]));},
 /* The decision makers a script loads. The command names a type, the type names a file, and the handle that
  * comes back is a script thing the script hands on without ever reading. A thread that uses mission cleanup
  * loads one that goes with its mission. */
 LOAD_CHAR_DECISION_MAKER:(t,p,i)=>{
  t.writeInt(p[1],game(t,i).decisionMakers.load(t.readInt(p[0]),t.usesMissionCleanup,false));
 },
 LOAD_GROUP_DECISION_MAKER:(t,p,i)=>{
  t.writeInt(p[1],game(t,i).decisionMakers.load(t.readInt(p[0]),t.usesMissionCleanup,true));
 },
 REMOVE_DECISION_MAKER:(t,p,i)=>{game(t,i).decisionMakers.remove(t.readInt(p[0]));},
 SET_CHAR_AREA_VISIBLE:(t,p,i)=>{world(t,i,'setPedAreaVisible')(t.readInt(p[0]),t.readInt(p[1]));},
 SET_CHAR_NEVER_TARGETTED:(t,p,i)=>{world(t,i,'setPedNeverTargeted')(t.readInt(p[0]),bool(t,p[1]));},
 SET_CURRENT_CHAR_WEAPON:(t,p,i)=>{world(t,i,'setPedCurrentWeapon')(t.readInt(p[0]),t.readInt(p[1]));},
 // The damage counts when that ped dealt it, or when the vehicle it rides in did.
 HAS_CHAR_BEEN_DAMAGED_BY_CHAR:(t,p,i)=>{
  const damage=world(t,i,'pedLastDamagedBy')(t.readInt(p[0])),other=t.readInt(p[1]);
  const otherVehicle=world(t,i,'pedVehicle')(other);
  const byOther=!!damage&&(damage.ped===other||(otherVehicle!==undefined&&damage.vehicle===otherVehicle));
  t.updateCompareFlag(byOther,negated(i));
 },
 WARP_CHAR_INTO_CAR:(t,p,i)=>{world(t,i,'warpPedIntoCar')(t.readInt(p[0]),t.readInt(p[1]));},
 WARP_CHAR_FROM_CAR_TO_COORD:(t,p,i)=>{const v=vec(t,p,1);world(t,i,'warpPedFromCarToCoord')(t.readInt(p[0]),v.x,v.y,v.z);},
 IS_CHAR_PLAYING_ANIM:(t,p,i)=>{t.updateCompareFlag(world(t,i,'pedIsPlayingAnim')(t.readInt(p[0]),t.text(p[1])),negated(i));},
 // This one takes the ped as a pointer and returns early when there is none, so a handle the host does not
 // know is a no-op rather than a failure.
 SHUT_CHAR_UP_FOR_SCRIPTED_SPEECH:(t,p,i)=>{world(t,i,'shutPedUpForScriptedSpeech')(t.readInt(p[0]),bool(t,p[1]));},
 // --- Locating a ped (CharacterCommands.cpp's locate helpers are reversed). The area is a box around the
 // point, a radius per axis, and the ped is read at its vehicle's position while it rides in one. The gates
 // are which of in a car, on foot and stopped the command insists on, and the last operand asks the debug
 // draw to highlight the area, which a host may do.
 LOCATE_CHAR_ANY_MEANS_2D:locateCharPoint(false,{car:false,foot:false}),
 LOCATE_CHAR_ON_FOOT_2D:locateCharPoint(false,{car:false,foot:true}),
 LOCATE_CHAR_IN_CAR_2D:locateCharPoint(false,{car:true,foot:false}),
 LOCATE_CHAR_ANY_MEANS_3D:locateCharPoint(true,{car:false,foot:false}),
 LOCATE_CHAR_ON_FOOT_3D:locateCharPoint(true,{car:false,foot:true}),
 LOCATE_CHAR_IN_CAR_3D:locateCharPoint(true,{car:true,foot:false}),
 IS_CHAR_IN_ANGLED_AREA_2D:charInAngledArea(false,{car:false,foot:false}),
 IS_CHAR_IN_ANGLED_AREA_ON_FOOT_2D:charInAngledArea(false,{car:false,foot:true}),
 IS_CHAR_IN_ANGLED_AREA_IN_CAR_2D:charInAngledArea(false,{car:true,foot:false}),
 IS_CHAR_IN_ANGLED_AREA_3D:charInAngledArea(true,{car:false,foot:false}),
 IS_CHAR_IN_ANGLED_AREA_ON_FOOT_3D:charInAngledArea(true,{car:false,foot:true}),
 IS_CHAR_IN_ANGLED_AREA_IN_CAR_3D:charInAngledArea(true,{car:true,foot:false}),
 // The stopped forms of the locate commands, which the runtime's own gate already knew how to ask for.
 LOCATE_STOPPED_CHAR_ANY_MEANS_2D:locateCharPoint(false,{car:false,foot:false,stopped:true}),
 LOCATE_STOPPED_CHAR_ON_FOOT_2D:locateCharPoint(false,{car:false,foot:true,stopped:true}),
 LOCATE_STOPPED_CHAR_IN_CAR_2D:locateCharPoint(false,{car:true,foot:false,stopped:true}),
 LOCATE_STOPPED_CHAR_ANY_MEANS_3D:locateCharPoint(true,{car:false,foot:false,stopped:true}),
 LOCATE_STOPPED_CHAR_ON_FOOT_3D:locateCharPoint(true,{car:false,foot:true,stopped:true}),
 LOCATE_STOPPED_CHAR_IN_CAR_3D:locateCharPoint(true,{car:true,foot:false,stopped:true}),
 // CTheScripts::bPlayerIsOffTheMap, which the stadium command sets.
 SET_PLAYER_IS_IN_STADIUM:(t,p,i)=>{game(t,i).playerIsOffTheMap=bool(t,p[0]);},
 LOCATE_CHAR_ANY_MEANS_CAR_2D:locateCharVehicle(false,{car:false,foot:false}),
 LOCATE_CHAR_ON_FOOT_CAR_2D:locateCharVehicle(false,{car:false,foot:true}),
 LOCATE_CHAR_IN_CAR_CAR_2D:locateCharVehicle(false,{car:true,foot:false}),
 LOCATE_CHAR_ANY_MEANS_CAR_3D:locateCharVehicle(true,{car:false,foot:false}),
 LOCATE_CHAR_ON_FOOT_CAR_3D:locateCharVehicle(true,{car:false,foot:true}),
 LOCATE_CHAR_IN_CAR_CAR_3D:locateCharVehicle(true,{car:true,foot:false}),
 LOCATE_CHAR_ANY_MEANS_OBJECT_2D:locateCharObject(false,{car:false,foot:false}),
 LOCATE_CHAR_ON_FOOT_OBJECT_2D:locateCharObject(false,{car:false,foot:true}),
 LOCATE_CHAR_IN_CAR_OBJECT_2D:locateCharObject(false,{car:true,foot:false}),
 LOCATE_CHAR_ANY_MEANS_OBJECT_3D:locateCharObject(true,{car:false,foot:false}),
 LOCATE_CHAR_ON_FOOT_OBJECT_3D:locateCharObject(true,{car:false,foot:true}),
 LOCATE_CHAR_IN_CAR_OBJECT_3D:locateCharObject(true,{car:true,foot:false}),
 // IsPedInVehicleOfAppearance, one command per appearance. A train has no appearance of its own, so the train
 // question asks the vehicle's own type instead, which is the only test the engine offers for one; that
 // command's handler is left unregistered in the reference.
 IS_CHAR_ON_ANY_BIKE:pedInVehicleOfAppearance(VEHICLE_APPEARANCE_BIKE),
 IS_CHAR_IN_ANY_BOAT:pedInVehicleOfAppearance(VEHICLE_APPEARANCE_BOAT),
 IS_CHAR_IN_ANY_HELI:pedInVehicleOfAppearance(VEHICLE_APPEARANCE_HELI),
 IS_CHAR_IN_ANY_PLANE:pedInVehicleOfAppearance(VEHICLE_APPEARANCE_PLANE),
 IS_CHAR_IN_ANY_TRAIN:(t,p,i)=>{
  const vehicle=world(t,i,'pedVehicle')(t.readInt(p[0]));
  t.updateCompareFlag(vehicle!==undefined&&world(t,i,'vehicleIsTrain')(vehicle),negated(i));
 },
 /* --- CPlayerInfo's own fields, and the statics the player commands reach beside them. Each command below is
  * reversed in PlayerCommands.cpp; the player index the script passes is always zero, and the pad it names is
  * that player's. A flag the script gives as "enable" is stored as the pad's own "disable", as the source does. */
 SET_PLAYER_NEVER_GETS_TIRED:(t,p,i)=>{game(t,i).playerInfo.doesNotGetTired=bool(t,p[1]);},
 SET_PLAYER_FAST_RELOAD:(t,p,i)=>{game(t,i).playerInfo.fastReload=bool(t,p[1]);},
 MAKE_PLAYER_FIRE_PROOF:(t,p,i)=>{game(t,i).playerInfo.fireProof=bool(t,p[1]);},
 SET_PLAYER_CAN_DO_DRIVE_BY:(t,p,i)=>{game(t,i).playerInfo.canDoDriveBy=bool(t,p[1]);},
 DISABLE_PLAYER_SPRINT:(t,p,i)=>{game(t,i).playerInfo.sprintDisabled=bool(t,p[1]);},
 SET_PLAYER_GROUP_RECRUITMENT:(t,p,i)=>{game(t,i).playerInfo.groupStuffDisabled=!bool(t,p[1]);},
 SET_PLAYER_DRUNKENNESS:(t,p,i)=>{game(t,i).playerInfo.setDrunkenness(t.readInt(p[1]));},
 GET_PLAYER_MAX_ARMOUR:(t,p,i)=>{t.writeInt(p[1],game(t,i).playerInfo.maxArmour);},
 // Both increases fill the ped to its new maximum, which is the host's ped rather than the runtime's field.
 INCREASE_PLAYER_MAX_HEALTH:(t,p,i)=>{
  const health=game(t,i).playerInfo.increaseMaxHealth(t.readInt(p[1]));
  world(t,i,'setPlayerMaxHealth')(t.readInt(p[0]),health);
 },
 INCREASE_PLAYER_MAX_ARMOUR:(t,p,i)=>{
  const armour=game(t,i).playerInfo.increaseMaxArmour(t.readInt(p[1]));
  world(t,i,'setPlayerMaxArmour')(t.readInt(p[0]),armour);
 },
 // Both back-off flags stop every law enforcer where it stands when they go on.
 SET_POLICE_IGNORE_PLAYER:(t,p,i)=>{
  const on=bool(t,p[1]);game(t,i).playerInfo.policeBackOff=on;
  if(on)world(t,i,'stopAllLawEnforcers')();
 },
 SET_EVERYONE_IGNORE_PLAYER:(t,p,i)=>{
  const on=bool(t,p[1]);game(t,i).playerInfo.everybodyBackOff=on;
  if(on)world(t,i,'stopAllLawEnforcers')();
 },
 // CGameLogic's two-player statics, which this port keeps although it has one player.
 LIMIT_TWO_PLAYER_DISTANCE:(t,p,i)=>{
  const info=game(t,i).playerInfo;info.limitPlayerDistance=true;info.maxPlayerDistance=t.readFloat(p[0]);
 },
 RELEASE_TWO_PLAYER_DISTANCE:(t,_p,i)=>{game(t,i).playerInfo.limitPlayerDistance=false;},
 SET_PLAYER_PLAYER_TARGETTING:(t,p,i)=>{game(t,i).playerInfo.playersCannotTargetEachOther=!bool(t,p[0]);},
 SET_PLAYERS_CAN_BE_IN_SEPARATE_CARS:(t,p,i)=>{game(t,i).playerInfo.playersCanBeInSeparateCars=bool(t,p[0]);},
 // CRopes::PlayerControlsCrane, and the water fog three of the four switch with it.
 PLAYER_ENTERED_DOCK_CRANE:(t,_p,i)=>{
  const info=game(t,i).playerInfo;info.controlsCrane=CRANE_MAGNO;info.waterFogScript=false;
 },
 PLAYER_ENTERED_BUILDINGSITE_CRANE:(t,_p,i)=>{
  const info=game(t,i).playerInfo;info.controlsCrane=CRANE_WRECKING_BALL;info.waterFogScript=false;
 },
 PLAYER_ENTERED_LAS_VEGAS_CRANE:(t,_p,i)=>{
  const info=game(t,i).playerInfo;info.controlsCrane=CRANE_LAS_VEGAS;info.waterFogScript=false;
 },
 // The quarry crane leaves the water fog alone, which the other three do not.
 PLAYER_ENTERED_QUARRY_CRANE:(t,_p,i)=>{game(t,i).playerInfo.controlsCrane=CRANE_QUARRY;},
 PLAYER_LEFT_CRANE:(t,_p,i)=>{
  const info=game(t,i).playerInfo;info.controlsCrane=CRANE_NONE;info.waterFogScript=true;
 },
 // IS_PLAYER_WEARING reads the clothes description the runtime already keeps.
 IS_PLAYER_WEARING:(t,p,i)=>{
  const clothes=game(t,i).clothes,part=t.readInt(p[1]);
  t.updateCompareFlag(clothes.textureKeys[part]===nativeUppercaseKey(t.text(p[2])),negated(i));
 },
 // The pad flags. The script enables a button; the pad remembers it as disabled.
 SET_PLAYER_DUCK_BUTTON:(t,p,i)=>{game(t,i).pads.setDisabled(t.readInt(p[0]),'duck',!bool(t,p[1]));},
 SET_PLAYER_ENTER_CAR_BUTTON:(t,p,i)=>{game(t,i).pads.setDisabled(t.readInt(p[0]),'enterCar',!bool(t,p[1]));},
 SET_PLAYER_FIRE_BUTTON:(t,p,i)=>{game(t,i).pads.setDisabled(t.readInt(p[0]),'fireWeapon',!bool(t,p[1]));},
 SET_PLAYER_JUMP_BUTTON:(t,p,i)=>{game(t,i).pads.setDisabled(t.readInt(p[0]),'jump',!bool(t,p[1]));},
 APPLY_BRAKES_TO_PLAYERS_CAR:(t,p,i)=>{game(t,i).pads.setApplyBrakes(t.readInt(p[0]),bool(t,p[1]));},
 // MakePlayerSafeForCutscene sets the pad's own flag, makes the player safe over a very wide radius, and tells
 // the cutscene manager it is processing one.
 MAKE_PLAYER_SAFE_FOR_CUTSCENE:(t,p,i)=>{
  const player=t.readInt(p[0]),state=game(t,i);
  state.pads.setSafeForCutscene(player,true);
  state.pads.setPlayerSafe(player,true);
  state.playerInfo.canBeDamaged=false;state.playerInfo.everybodyBackOff=true;
  world(t,i,'makePlayerSafe')(player,true,10000);
  state.playerInfo.cutsceneProcessing=true;
 },
 /* --- More of the ped, each following the body of its own reversed command. WEAPON_ANYMELEE and
  * WEAPON_ANYWEAPON are the two wildcards at the end of eWeaponType, which only the weapon questions accept. */
 HAS_CHAR_GOT_WEAPON:(t,p,i)=>{
  t.updateCompareFlag(world(t,i,'pedHasWeapon')(t.readInt(p[0]),t.readInt(p[1])),negated(i));
 },
 IS_CURRENT_CHAR_WEAPON:(t,p,i)=>{
  const wanted=t.readInt(p[1]),active=world(t,i,'pedActiveWeapon')(t.readInt(p[0]));
  t.updateCompareFlag(wanted===WEAPON_ANYMELEE&&active.melee||active.type===wanted,negated(i));
 },
 HAS_CHAR_BEEN_DAMAGED_BY_WEAPON:(t,p,i)=>{
  const wanted=t.readInt(p[1]),last=world(t,i,'pedLastWeaponDamage')(t.readInt(p[0]));
  t.updateCompareFlag(wanted===WEAPON_ANYMELEE||wanted===WEAPON_ANYWEAPON?checkDamagedWeaponType(last,wanted):last>=0&&last===wanted,negated(i));
 },
 SET_CHAR_COLLISION:(t,p,i)=>{world(t,i,'setPedCollision')(t.readInt(p[0]),bool(t,p[1]));},
 IS_CHAR_SHOOTING:(t,p,i)=>{t.updateCompareFlag(world(t,i,'pedIsShooting')(t.readInt(p[0])),negated(i));},
 IS_CHAR_ON_SCREEN:(t,p,i)=>{t.updateCompareFlag(world(t,i,'pedIsOnScreen')(t.readInt(p[0])),negated(i));},
 IS_CHAR_ON_FOOT:(t,p,i)=>{t.updateCompareFlag(world(t,i,'pedIsOnFoot')(t.readInt(p[0])),negated(i));},
 IS_CHAR_SITTING_IN_ANY_CAR:(t,p,i)=>{t.updateCompareFlag(world(t,i,'pedIsSittingInAnyCar')(t.readInt(p[0])),negated(i));},
 // Three of these four flags are stored the other way round from what the script asks for.
 SET_CHAR_ALLOWED_TO_DUCK:(t,p,i)=>{world(t,i,'setPedFlag')(t.readInt(p[0]),'notAllowedToDuck',!bool(t,p[1]));},
 SET_CHAR_DROPS_WEAPONS_WHEN_DEAD:(t,p,i)=>{world(t,i,'setPedFlag')(t.readInt(p[0]),'doesntDropWeaponsWhenDead',!bool(t,p[1]));},
 SET_CHAR_STAY_IN_CAR_WHEN_JACKED:(t,p,i)=>{world(t,i,'setPedFlag')(t.readInt(p[0]),'stayInCarOnJack',bool(t,p[1]));},
 SET_CHAR_GET_OUT_UPSIDE_DOWN_CAR:(t,p,i)=>{world(t,i,'setPedFlag')(t.readInt(p[0]),'getOutUpsideDownCar',bool(t,p[1]));},
 FREEZE_CHAR_POSITION_AND_DONT_LOAD_COLLISION:(t,p,i)=>{
  world(t,i,'freezePedPositionAndWaitForCollision')(t.readInt(p[0]),bool(t,p[1]));
 },
 REMOVE_CHAR_FROM_GROUP:(t,p,i)=>{world(t,i,'removePedFromGroup')(t.readInt(p[0]));},
 REMOVE_CHAR_ELEGANTLY:(t,p,i)=>{world(t,i,'removePedElegantly')(t.readInt(p[0]));},
 EXPLODE_CHAR_HEAD:(t,p,i)=>{world(t,i,'explodePedHead')(t.readInt(p[0]));},
 // The speech commands read the other way round from their names: shutting a ped up disables its speech.
 SHUT_CHAR_UP:(t,p,i)=>{world(t,i,'setPedSpeechDisabled')(t.readInt(p[0]),bool(t,p[1]));},
 SHUT_ALL_CHARS_UP:(t,p,i)=>{world(t,i,'setAllPedSpeechDisabled')(bool(t,p[0]));},
 SET_CHAR_ANIM_SPEED:(t,p,i)=>{world(t,i,'setPedAnimSpeed')(t.readInt(p[0]),t.text(p[1]),t.readFloat(p[2]));},
 // An animation the ped is not playing leaves the variable at nothing, which the source returns.
 GET_CHAR_ANIM_CURRENT_TIME:(t,p,i)=>{
  t.writeFloat(p[2],world(t,i,'pedAnimProgress')(t.readInt(p[0]),t.text(p[1]))??0);
 },
 IS_CHAR_IN_ZONE:(t,p,i)=>{
  t.updateCompareFlag(world(t,i,'pedIsInNaviZone')(t.readInt(p[0]),t.text(p[1])),negated(i));
 },
 /* The camera's two linear runs. Each takes the point it starts from, the point it ends at, how long it runs
  * and whether it eases; the runtime keeps the fields and a host moves the camera along them. */
 CAMERA_SET_VECTOR_TRACK:(t,p,i,nowMs)=>{
  game(t,i).camera.vectorTrackLinear(vec(t,p,0),vec(t,p,3),t.readInt(p[6]),bool(t,p[7]),nowMs);
 },
 CAMERA_SET_VECTOR_MOVE:(t,p,i,nowMs)=>{
  game(t,i).camera.vectorMoveLinear(vec(t,p,0),vec(t,p,3),t.readFloat(p[6]),bool(t,p[7]),nowMs);
 },
 // CCamera::TakeControl over a vehicle the script names, which does nothing for a handle naming no car.
 POINT_CAMERA_AT_CAR:(t,p,i)=>{
  world(t,i,'pointCameraAtVehicle')(t.readInt(p[0]),t.readInt(p[1]),t.readInt(p[2]));
 },
 // CEntity::TransformFromObjectSpace over the ped's own rows, the twin of the car and object forms.
 GET_OFFSET_FROM_CHAR_IN_WORLD_COORDS:(t,p,i)=>{
  const world3=transformFromObjectSpace(world(t,i,'pedMatrix')(t.readInt(p[0])),vec(t,p,1));
  t.writeFloat(p[4],world3.x);t.writeFloat(p[5],world3.y);t.writeFloat(p[6],world3.z);
 },
 // CPed::OurPedCanSeeThisEntity, asked of another ped and counting the one behind it.
 HAS_CHAR_SPOTTED_CHAR:(t,p,i)=>{
  t.updateCompareFlag(world(t,i,'pedCanSeePed')(t.readInt(p[0]),t.readInt(p[1])),negated(i));
 },
 /* --- More of the ped, each following its own reversed body. */
 IS_CHAR_IN_WATER:(t,p,i)=>{t.updateCompareFlag(world(t,i,'pedIsInWater')(t.readInt(p[0])),negated(i));},
 // A ped in a car reads the car's heading, which GetPedOrItsVehicle does for it.
 GET_CHAR_HEADING:(t,p,i)=>{t.writeFloat(p[1],world(t,i,'pedHeading')(t.readInt(p[0])));},
 SET_CHAR_VISIBLE:(t,p,i)=>{world(t,i,'setPedVisible')(t.readInt(p[0]),bool(t,p[1]));},
 SET_CHAR_BLEEDING:(t,p,i)=>{world(t,i,'setPedSimpleFlag')(t.readInt(p[0]),'bleeding',bool(t,p[1]));},
 SET_CHAR_DROWNS_IN_WATER:(t,p,i)=>{world(t,i,'setPedSimpleFlag')(t.readInt(p[0]),'drownsInWater',bool(t,p[1]));},
 SET_CHAR_NEVER_LEAVES_GROUP:(t,p,i)=>{world(t,i,'setPedSimpleFlag')(t.readInt(p[0]),'neverLeavesGroup',bool(t,p[1]));},
 // The speech pair here is the ped's own, not the blanket one: disabling can also stop what it is saying.
 DISABLE_CHAR_SPEECH:(t,p,i)=>{world(t,i,'disablePedSpeech')(t.readInt(p[0]),bool(t,p[1]));},
 ENABLE_CHAR_SPEECH:(t,p,i)=>{world(t,i,'enablePedSpeech')(t.readInt(p[0]));},
 REMOVE_ALL_CHAR_WEAPONS:(t,p,i)=>{world(t,i,'removeAllPedWeapons')(t.readInt(p[0]));},
 SET_CHAR_AMMO:(t,p,i)=>{world(t,i,'setPedAmmo')(t.readInt(p[0]),t.readInt(p[1]),t.readInt(p[2]));},
 // A ped carrying no weapon of that type has no ammo of it either.
 GET_AMMO_IN_CHAR_WEAPON:(t,p,i)=>{
  t.writeInt(p[2],world(t,i,'pedWeaponAmmo')(t.readInt(p[0]),t.readInt(p[1]))??0);
 },
 SET_CHAR_MONEY:(t,p,i)=>{world(t,i,'setPedMoney')(t.readInt(p[0]),t.readInt(p[1]));},
 // The photograph question lowers the flag as it answers, so a second ask says no.
 HAS_CHAR_BEEN_PHOTOGRAPHED:(t,p,i)=>{t.updateCompareFlag(world(t,i,'takePedPhotographedFlag')(t.readInt(p[0])),negated(i));},
 // The car a ped rides, or the one it is climbing into; a ped doing neither leaves the variable at nothing.
 GET_CAR_CHAR_IS_USING:(t,p,i)=>{t.writeInt(p[1],world(t,i,'pedCarInUse')(t.readInt(p[0]))??0);},
 GET_CHAR_IN_CAR_PASSENGER_SEAT:(t,p,i)=>{
  t.writeInt(p[2],world(t,i,'pedInPassengerSeat')(t.readInt(p[0]),t.readInt(p[1]))??0);
 },
 WARP_CHAR_INTO_CAR_AS_PASSENGER:(t,p,i)=>{
  world(t,i,'warpPedIntoCarAsPassenger')(t.readInt(p[0]),t.readInt(p[1]),t.readInt(p[2]));
 },
 REMOVE_STUCK_CAR_CHECK:(t,p,i)=>{game(t,i).stuckCars.remove(t.readInt(p[0]));},
 // CFireManager::StartScriptFire at the ped, at eight tenths strength and one generation, as the command asks.
 START_CHAR_FIRE:(t,p,i)=>{
  const position=world(t,i,'pedPosition')(t.readInt(p[0]));
  t.writeInt(p[1],game(t,i).fires.startScriptFire(position,0.8,1));
 },
 /* --- The last of the reversed character, player, camera and object commands with a body of their own. */
 IS_CHAR_HEALTH_GREATER:(t,p,i)=>{
  // The source compares with "greater or equal" although the command is named for "greater".
  t.updateCompareFlag(world(t,i,'pedHealth')(t.readInt(p[0]))>=t.readFloat(p[1]),negated(i));
 },
 SET_CHAR_SIGNAL_AFTER_KILL:(t,p,i)=>{world(t,i,'pedSignalAfterKill')(t.readInt(p[0]),bool(t,p[1]));},
 GET_CURRENT_CHAR_WEAPON:(t,p,i)=>{t.writeInt(p[1],world(t,i,'pedActiveWeapon')(t.readInt(p[0])).type);},
 GET_DEAD_CHAR_COORDINATES:(t,p,i)=>{
  const position=world(t,i,'deadPedCoordinates')(t.readInt(p[0]));
  t.writeFloat(p[1],position.x);t.writeFloat(p[2],position.y);t.writeFloat(p[3],position.z);
 },
 SET_CHAR_ANIM_CURRENT_TIME:(t,p,i)=>{
  world(t,i,'setPedAnimProgress')(t.readInt(p[0]),t.text(p[1]),t.readFloat(p[2]));
 },
 // The ped is attached to an object rather than a car; the angle limit is degrees to the script and radians to
 // the engine, as it is for the car form.
 ATTACH_CHAR_TO_OBJECT:(t,p,i)=>{
  world(t,i,'attachPedToObject')(t.readInt(p[0]),t.readInt(p[1]),vec(t,p,2),t.readInt(p[5]),
   t.readFloat(p[6])*Math.PI/180,t.readInt(p[7]));
 },
 // A ped firing inside the box the script draws.
 IS_CHAR_SHOOTING_IN_AREA:(t,p,i)=>{
  const handle=t.readInt(p[0]);
  const x1=t.readFloat(p[1]),y1=t.readFloat(p[2]),x2=t.readFloat(p[3]),y2=t.readFloat(p[4]);
  const point=world(t,i,'pedPosition')(handle);
  const inside=point.x>=Math.min(x1,x2)&&point.x<=Math.max(x1,x2)&&point.y>=Math.min(y1,y2)&&point.y<=Math.max(y1,y2);
  t.updateCompareFlag(world(t,i,'pedIsShooting')(handle)&&inside,negated(i));
 },
 // CCamera::TakeControl over a ped takes the entity only when it is the player's own; any other ped hands it
 // none, which is what the source's own test comes to.
 POINT_CAMERA_AT_CHAR:(t,p,i)=>{
  const handle=t.readInt(p[0]);
  world(t,i,'pointCameraAtPed')(handle,world(t,i,'pedIsPlayer')(handle),t.readInt(p[1]),t.readInt(p[2]));
 },
 SET_PLAYER_GROUP_TO_FOLLOW_ALWAYS:(t,p,i)=>{
  world(t,i,'forcePlayerGroupToAlwaysFollow')(t.readInt(p[0]),bool(t,p[1]));
 },
 // PlayerCommands.cpp: ANYTHING and OBJECT read only CPlayerPed::m_pTargetedObject, the lock-on target, which the
 // mouse controls clear every frame (CTaskSimplePlayerOnFoot); CHAR also takes the 3rd-person mouse target while the
 // aim button is held.
 IS_PLAYER_TARGETTING_ANYTHING:(t,p,i)=>{t.readInt(p[0]);t.updateCompareFlag(false,negated(i));},
 IS_PLAYER_TARGETTING_CHAR:(t,p,i)=>{
  t.updateCompareFlag(world(t,i,'playerIsTargettingPed')(t.readInt(p[0]),t.readInt(p[1])),negated(i));
 },
 IS_PLAYER_TARGETTING_OBJECT:(t,p,i)=>{t.readInt(p[0]);t.readInt(p[1]);t.updateCompareFlag(false,negated(i));},
 IS_PLAYER_IN_INFO_ZONE:(t,p,i)=>{
  t.updateCompareFlag(world(t,i,'playerIsInInfoZone')(t.readInt(p[0]),t.text(p[1])),negated(i));
 },
 // The box is given by two opposite corners in either order, which the source sorts before it tests.
 IS_EXPLOSION_IN_AREA:(t,p,i)=>{
  const a=vec(t,p,1),b=vec(t,p,4);
  const min={x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),z:Math.min(a.z,b.z)};
  const max={x:Math.max(a.x,b.x),y:Math.max(a.y,b.y),z:Math.max(a.z,b.z)};
  t.updateCompareFlag(world(t,i,'explosionInArea')(t.readInt(p[0]),min,max),negated(i));
 },
 // The plain stuck-car check leaves the warp off and its four switches at nothing.
 // CStuckCarCheck::AddCarToCheck starts from where the car is now.
 ADD_STUCK_CAR_CHECK:(t,p,i,now)=>{
  const handle=t.readInt(p[0]);
  game(t,i).stuckCars.add(handle,world(t,i,'vehiclePosition')(handle),now,t.readFloat(p[1]),t.readInt(p[2]));
 },
 ADD_STUCK_CAR_CHECK_WITH_WARP:(t,p,i,now)=>{
  const handle=t.readInt(p[0]);
  game(t,i).stuckCars.add(handle,world(t,i,'vehiclePosition')(handle),now,t.readFloat(p[1]),t.readInt(p[2]),
   {stuck:bool(t,p[3]),flipped:bool(t,p[4]),inWater:bool(t,p[5]),nodesToCheck:t.readInt(p[6])});
 },
 IS_OBJECT_PLAYING_ANIM:(t,p,i)=>{
  t.updateCompareFlag(world(t,i,'objectIsPlayingAnim')(t.readInt(p[0]),t.text(p[1])),negated(i));
 },
 SET_OBJECT_ANIM_SPEED:(t,p,i)=>{world(t,i,'setObjectAnimSpeed')(t.readInt(p[0]),t.text(p[1]),t.readFloat(p[2]));},
 // The object form scales its progress by the animation's own speed rather than by its length, which the ped
 // form does; that is what the two sources say, different as they look.
 SET_OBJECT_ANIM_CURRENT_TIME:(t,p,i)=>{
  world(t,i,'setObjectAnimProgress')(t.readInt(p[0]),t.text(p[1]),t.readFloat(p[2]));
 },
 /* --- The touching questions all ask of the car a ped rides rather than the ped, when it rides one, which is
  * what GetPedOrItsVehicle does for them. */
 IS_CHAR_TOUCHING_CHAR:(t,p,i)=>{
  t.updateCompareFlag(world(t,i,'pedIsTouching')(t.readInt(p[0]),{kind:'ped',handle:t.readInt(p[1])}),negated(i));
 },
 IS_CHAR_TOUCHING_VEHICLE:(t,p,i)=>{
  t.updateCompareFlag(world(t,i,'pedIsTouching')(t.readInt(p[0]),{kind:'vehicle',handle:t.readInt(p[1])}),negated(i));
 },
 IS_CHAR_TOUCHING_OBJECT:(t,p,i)=>{
  t.updateCompareFlag(world(t,i,'pedIsTouching')(t.readInt(p[0]),{kind:'object',handle:t.readInt(p[1])}),negated(i));
 },
 // A police vehicle is any law-enforcement one except the Predator, which the source names on its own.
 IS_CHAR_IN_ANY_POLICE_VEHICLE:(t,p,i)=>{
  const handle=t.readInt(p[0]);
  const model=world(t,i,'pedVehicleModelId')(handle);
  const police=model!==undefined&&model!==MODEL_PREDATOR&&world(t,i,'pedVehicleIsLawEnforcement')(handle);
  t.updateCompareFlag(police,negated(i));
 },
 // A taxi is one of the two taxi models by name, not a class of vehicle.
 IS_CHAR_IN_TAXI:(t,p,i)=>{
  const model=world(t,i,'pedVehicleModelId')(t.readInt(p[0]));
  t.updateCompareFlag(model===MODEL_CABBIE||model===MODEL_TAXI,negated(i));
 },
 IS_CHAR_DUCKING:(t,p,i)=>{t.updateCompareFlag(world(t,i,'pedIsDucking')(t.readInt(p[0])),negated(i));},
 IS_CHAR_STOPPED:(t,p,i)=>{t.updateCompareFlag(world(t,i,'pedIsStopped')(t.readInt(p[0])),negated(i));},
 // Speeds and velocities cross the boundary in units a frame at fifty frames, which is how the engine keeps
 // them, so the script's own figure is fifty times the engine's.
 GET_CHAR_SPEED:(t,p,i)=>{
  const speed=world(t,i,'pedSpeed')(t.readInt(p[0]));
  t.writeFloat(p[1],speed*50);
 },
 SET_CHAR_VELOCITY:(t,p,i)=>{
  const velocity=vec(t,p,1);
  world(t,i,'setPedVelocity')(t.readInt(p[0]),{x:velocity.x/50,y:velocity.y/50,z:velocity.z/50});
 },
 CLEAR_CHAR_LAST_WEAPON_DAMAGE:(t,p,i)=>{world(t,i,'clearPedLastWeaponDamage')(t.readInt(p[0]));},
 CLEAR_CHAR_LAST_DAMAGE_ENTITY:(t,p,i)=>{world(t,i,'clearPedLastDamageEntity')(t.readInt(p[0]));},
 // The script counts weapon slots from one and the ped from nothing, so the command subtracts one; it gives
 // back the type, the ammo and the model a pickup of that weapon would use.
 GET_CHAR_WEAPON_IN_SLOT:(t,p,i)=>{
  const slot=world(t,i,'pedWeaponInSlot')(t.readInt(p[0]),t.readInt(p[1])-1);
  t.writeInt(p[2],slot.type);t.writeInt(p[3],slot.ammo);t.writeInt(p[4],slot.model);
 },
 HAS_CHAR_SPOTTED_CHAR_IN_FRONT:(t,p,i)=>{
  t.updateCompareFlag(world(t,i,'pedCanSeePed')(t.readInt(p[0]),t.readInt(p[1])),negated(i));
 },
 // Where a dead ped's weapon pickup goes, which is not the ped's own position.
 GET_DEAD_CHAR_PICKUP_COORDS:(t,p,i)=>{
  const position=world(t,i,'deadPedPickupCoordinates')(t.readInt(p[0]));
  t.writeFloat(p[1],position.x);t.writeFloat(p[2],position.y);t.writeFloat(p[3],position.z);
 },
 IS_CAR_STUCK:(t,p,i)=>{t.updateCompareFlag(game(t,i).stuckCars.isStuck(t.readInt(p[0])),negated(i));},
 // The active camera's own source, and the point it looks at, which is that source plus its forward.
 GET_ACTIVE_CAMERA_COORDINATES:(t,p,i)=>{
  const source=world(t,i,'activeCameraSource')();
  t.writeFloat(p[0],source.x);t.writeFloat(p[1],source.y);t.writeFloat(p[2],source.z);
 },
 GET_ACTIVE_CAMERA_POINT_AT:(t,p,i)=>{
  const source=world(t,i,'activeCameraSource')(),front=world(t,i,'activeCameraFront')();
  t.writeFloat(p[0],source.x+front.x);t.writeFloat(p[1],source.y+front.y);t.writeFloat(p[2],source.z+front.z);
 },
 SET_PLAYER_IN_CAR_CAMERA_MODE:(t,p,i)=>{game(t,i).camera.setCarZoom(t.readInt(p[0]));},
 SET_FIRST_PERSON_IN_CAR_CAMERA_MODE:(t,p,i)=>{game(t,i).camera.setFirstPersonInCar(bool(t,p[0]));},
 /* --- CConversations. The scripted-speech forms of the node commands negate their three speech ids, which is
  * how the engine tells scripted speech from ordinary, and an end node carries no answers at all. */
 START_SETTING_UP_CONVERSATION:(t,p,i)=>{game(t,i).conversations.startSettingUp(t.readInt(p[0]));},
 SET_UP_CONVERSATION_NODE_WITH_SPEECH:(t,p,i)=>{
  game(t,i).conversations.setUpNode(t.text(p[0]),t.text(p[1]),t.text(p[2]),
   t.readInt(p[3]),t.readInt(p[4]),t.readInt(p[5]));
 },
 SET_UP_CONVERSATION_NODE_WITH_SCRIPTED_SPEECH:(t,p,i)=>{
  game(t,i).conversations.setUpNode(t.text(p[0]),t.text(p[1]),t.text(p[2]),
   -t.readInt(p[3]),-t.readInt(p[4]),-t.readInt(p[5]));
 },
 SET_UP_CONVERSATION_END_NODE_WITH_SPEECH:(t,p,i)=>{
  game(t,i).conversations.setUpNode(t.text(p[0]),undefined,undefined,t.readInt(p[1]),0,0);
 },
 SET_UP_CONVERSATION_END_NODE_WITH_SCRIPTED_SPEECH:(t,p,i)=>{
  game(t,i).conversations.setUpNode(t.text(p[0]),undefined,undefined,-t.readInt(p[1]),0,0);
 },
 FINISH_SETTING_UP_CONVERSATION:(t,_p,i)=>{game(t,i).conversations.finishSettingUp(false);},
 FINISH_SETTING_UP_CONVERSATION_NO_SUBTITLES:(t,_p,i)=>{game(t,i).conversations.finishSettingUp(true);},
 IS_CONVERSATION_AT_NODE:(t,p,i)=>{
  t.updateCompareFlag(game(t,i).conversations.isAtNode(t.readInt(p[0]),t.text(p[1])),negated(i));
 },
 ENABLE_CONVERSATION:(t,p,i)=>{game(t,i).conversations.enable(t.readInt(p[0]),bool(t,p[1]));},
 CLEAR_CONVERSATION_FOR_CHAR:(t,p,i)=>{game(t,i).conversations.clearForPed(t.readInt(p[0]));},
 // CLEAR_ALL_CONVERSATIONS and GET_CONVERSATION_STATUS are two of the commands PC 1.0 parses and does
 // nothing with, so they stay in the native-nop list rather than being given a handler here. A first attempt
 // gave the first one a body; the nop list is older than that attempt and is right.
 // Whether the player stands where the conversation needs them is the host's, which knows where both are.
 IS_PLAYER_IN_POSITION_FOR_CONVERSATION:(t,p,i)=>{
  t.updateCompareFlag(world(t,i,'isPlayerInPositionForConversation')(t.readInt(p[0])),negated(i));
 },
 /* --- The last of the reversed commands with a body of their own. */
 IS_CHAR_MALE:(t,p,i)=>{t.updateCompareFlag(world(t,i,'pedIsMale')(t.readInt(p[0])),negated(i));},
 IS_CHAR_MODEL:(t,p,i)=>{t.updateCompareFlag(world(t,i,'pedModelId')(t.readInt(p[0]))===t.readInt(p[1]),negated(i));},
 GET_CHAR_MODEL:(t,p,i)=>{t.writeInt(p[1],world(t,i,'pedModelId')(t.readInt(p[0])));},
 // A velocity is read in the engine's own units a frame, unlike the speed the script reads in units a second.
 GET_CHAR_VELOCITY:(t,p,i)=>{
  const velocity=world(t,i,'pedVelocity')(t.readInt(p[0]));
  t.writeFloat(p[1],velocity.x);t.writeFloat(p[2],velocity.y);t.writeFloat(p[3],velocity.z);
 },
 IS_CHAR_GETTING_IN_TO_A_CAR:(t,p,i)=>{t.updateCompareFlag(world(t,i,'pedIsGettingIntoCar')(t.readInt(p[0])),negated(i));},
 IS_CHAR_WAITING_FOR_WORLD_COLLISION:(t,p,i)=>{t.updateCompareFlag(world(t,i,'pedIsWaitingForCollision')(t.readInt(p[0])),negated(i));},
 HAS_CHAR_BEEN_DAMAGED_BY_CAR:(t,p,i)=>{
  t.updateCompareFlag(world(t,i,'pedWasDamagedByVehicle')(t.readInt(p[0]),t.readInt(p[1])),negated(i));
 },
 // The command names a second ped and the source ignores it: it asks whether this ped can see any dead ped near
 // it, which is what its scanner holds.
 CAN_CHAR_SEE_DEAD_CHAR:(t,p,i)=>{t.updateCompareFlag(world(t,i,'pedCanSeeDeadPed')(t.readInt(p[0])),negated(i));},
 SET_CHAR_IS_CHRIS_CRIMINAL:(t,p,i)=>{world(t,i,'setPedChrisCriminal')(t.readInt(p[0]),bool(t,p[1]));},
 IGNORE_HEIGHT_DIFFERENCE_FOLLOWING_NODES:(t,p,i)=>{
  world(t,i,'setPedIgnoreHeightDifferenceFollowingNodes')(t.readInt(p[0]),bool(t,p[1]));
 },
 SET_CAR_ALWAYS_CREATE_SKIDS:(t,p,i)=>{world(t,i,'setVehicleAlwaysCreateSkids')(t.readInt(p[0]),bool(t,p[1]));},
 SET_CHAR_ANIM_PLAYING_FLAG:(t,p,i)=>{
  world(t,i,'setPedAnimPlayingFlag')(t.readInt(p[0]),t.text(p[1]),bool(t,p[2]));
 },
 GET_OBJECT_ANIM_CURRENT_TIME:(t,p,i)=>{
  t.writeFloat(p[2],world(t,i,'objectAnimProgress')(t.readInt(p[0]),t.text(p[1]))??0);
 },
 // The on-foot touching question is the only one that does not fall back to the car a ped rides.
 IS_CHAR_TOUCHING_OBJECT_ON_FOOT:(t,p,i)=>{
  const handle=t.readInt(p[0]);
  const onFoot=world(t,i,'pedVehicle')(handle)===undefined;
  t.updateCompareFlag(onFoot&&world(t,i,'pedIsTouching')(handle,{kind:'object',handle:t.readInt(p[1])}),negated(i));
 },
 REMOVE_CHAR_FROM_CAR_MAINTAIN_POSITION:(t,p,i)=>{
  world(t,i,'removePedFromCarMaintainPosition')(t.readInt(p[0]),t.readInt(p[1]));
 },
 GET_RID_OF_PLAYER_PROSTITUTE:(t,_p,i)=>{world(t,i,'getRidOfPlayerProstitute')();},
 DRAW_SUBTITLES_BEFORE_FADE:(t,p,i)=>{game(t,i).drawSubtitlesBeforeFade=bool(t,p[0]);},
 /* --- The camera. The zoom the script sets reaches the follow-ped camera or the car one by which mode is
  * active, and neither in any other mode. The tweak's reset is not all zeroes: the two scales go back to one. */
 SET_CAMERA_ZOOM:(t,p,i)=>{game(t,i).camera.setCameraZoom(t.readInt(p[0]),world(t,i,'activeCameraMode')());},
 CAMERA_PERSIST_FOV:(t,p,i)=>{game(t,i).camera.blockZoom=bool(t,p[0]);},
 GET_CAMERA_FOV:(t,p,i)=>{t.writeFloat(p[0],world(t,i,'activeCameraFov')());},
 ALLOW_FIXED_CAMERA_COLLISION:(t,p,i)=>{game(t,i).camera.allowFixedCameraCollision=bool(t,p[0]);},
 SET_VEHICLE_CAMERA_TWEAK:(t,p,i)=>{
  game(t,i).camera.setVehicleCameraTweak(model(t,i,p[0]) as number,t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]));
 },
 RESET_VEHICLE_CAMERA_TWEAK:(t,_p,i)=>{game(t,i).camera.resetVehicleCameraTweak();},
 SET_CAMERA_IN_FRONT_OF_PLAYER:(t,_p,i)=>{world(t,i,'setCameraInFrontOfPlayer')();},
 SET_CAMERA_IN_FRONT_OF_CHAR:(t,p,i)=>{world(t,i,'setCameraInFrontOfPed')(t.readInt(p[0]));},
 // The two angles the script gives are the vertical first and the horizontal second, which is the order the
 // source assigns them in and the opposite of how a reader might guess from the command's name.
 SET_CAMERA_POSITION_UNFIXED:(t,p,i)=>{world(t,i,'setActiveCameraAngles')(t.readFloat(p[0]),t.readFloat(p[1]));},
 DO_CAMERA_BUMP:(t,p,i)=>{world(t,i,'doCameraBump')(t.readFloat(p[0]),t.readFloat(p[1]));},
 GET_PLAYER_IN_CAR_CAMERA_MODE:(t,p,i)=>{t.writeInt(p[0],game(t,i).camera.carZoom);},
 // The debug camera is the third of the camera array, which a host keeps if it keeps one at all.
 GET_DEBUG_CAMERA_COORDINATES:(t,p,i)=>{
  const source=world(t,i,'debugCameraSource')();
  t.writeFloat(p[0],source.x);t.writeFloat(p[1],source.y);t.writeFloat(p[2],source.z);
 },
 GET_DEBUG_CAMERA_POINT_AT:(t,p,i)=>{
  const source=world(t,i,'debugCameraSource')(),front=world(t,i,'debugCameraFront')();
  t.writeFloat(p[0],source.x+front.x);t.writeFloat(p[1],source.y+front.y);t.writeFloat(p[2],source.z+front.z);
 },
 /* --- The ped commands the reference leaves unregistered but documents operand by operand, each named type by
  * type in its own block. What the documentation says is all this source says, so each goes straight to a host
  * with the operands in the order the block lists them. */
 SET_INFORM_RESPECTED_FRIENDS:(t,p,i)=>{
  world(t,i,'setPedInformRespectedFriends')(t.readInt(p[0]),t.readFloat(p[1]),t.readInt(p[2]));
 },
 SET_FOLLOW_NODE_THRESHOLD_DISTANCE:(t,p,i)=>{world(t,i,'setPedFollowNodeThresholdDistance')(t.readInt(p[0]),t.readFloat(p[1]));},
 SET_SENSE_RANGE:(t,p,i)=>{world(t,i,'setPedSenseRange')(t.readInt(p[0]),t.readFloat(p[1]));},
 // The group is named (a string operand in main.scm), as CAnimManager::GetAnimationGroupIdByName finds it.
 SET_ANIM_GROUP_FOR_CHAR:(t,p,i)=>{world(t,i,'setPedAnimGroup')(t.readInt(p[0]),t.text(p[1]));},
 // The move state command names no ped: it sets the state the next task will take.
 // The handler is unreversed. Every mission sets it just before a TASK_ENTER_CAR_AS_*, which takes it.
 SET_NEXT_DESIRED_MOVE_STATE:(t,p,i)=>{game(t,i).nextDesiredMoveState=t.readInt(p[0]);},
 GET_SEQUENCE_PROGRESS:(t,p,i)=>{t.writeInt(p[1],world(t,i,'pedSequenceProgress')(t.readInt(p[0])));},
 // GET_SEQUENCE_PROGRESS_RECURSIVE stays out: its documentation names one operand and a return, while the
 // command carries three, so the third one's meaning is not in this source.
 PERFORM_SEQUENCE_TASK_FROM_PROGRESS:(t,p,i)=>{
  world(t,i,'performSequenceTaskFromProgress')(t.readInt(p[0]),t.readInt(p[1]),t.readInt(p[2]),t.readInt(p[3]));
 },
 ADD_ARMOUR_TO_CHAR:(t,p,i)=>{world(t,i,'addArmourToPed')(t.readInt(p[0]),t.readInt(p[1]));},
 ADD_AMMO_TO_CHAR:(t,p,i)=>{world(t,i,'addAmmoToPed')(t.readInt(p[0]),t.readInt(p[1]),t.readInt(p[2]));},
 REMOVE_WEAPON_FROM_CHAR:(t,p,i)=>{world(t,i,'removeWeaponFromPed')(t.readInt(p[0]),t.readInt(p[1]));},
 GIVE_MELEE_ATTACK_TO_CHAR:(t,p,i)=>{world(t,i,'givePedMeleeAttack')(t.readInt(p[0]),t.readInt(p[1]),t.readInt(p[2]));},
 DAMAGE_CHAR:(t,p,i)=>{world(t,i,'damagePed')(t.readInt(p[0]),t.readInt(p[1]),bool(t,p[2]));},
 DROP_OBJECT:(t,p,i)=>{world(t,i,'setPedDropsObject')(t.readInt(p[0]),bool(t,p[1]));},
 LISTEN_TO_PLAYER_GROUP_COMMANDS:(t,p,i)=>{world(t,i,'setPedListensToPlayerGroupCommands')(t.readInt(p[0]),bool(t,p[1]));},
 DONT_REMOVE_CHAR:(t,p,i)=>{world(t,i,'setPedDontRemove')(t.readInt(p[0]));},
 SET_DEATH_WEAPONS_PERSIST:(t,p,i)=>{world(t,i,'setPedDeathWeaponsPersist')(t.readInt(p[0]),bool(t,p[1]));},
 IS_GROUP_LEADER:(t,p,i)=>{
  t.updateCompareFlag(world(t,i,'pedIsGroupLeader')(t.readInt(p[0]),t.readInt(p[1])),negated(i));
 },
 GET_NUMBER_OF_FOLLOWERS:(t,p,i)=>{t.writeInt(p[1],world(t,i,'pedFollowerCount')(t.readInt(p[0])));},
 GET_PED_TYPE:(t,p,i)=>{t.writeInt(p[1],world(t,i,'pedType')(t.readInt(p[0])));},
 SET_SWIM_SPEED:(t,p,i)=>{world(t,i,'setPedSwimSpeed')(t.readInt(p[0]),t.readFloat(p[1]));},
 // The say command gives back the line it started, and carries three switches of its own.
 SET_CHAR_SAY_CONTEXT_IMPORTANT:(t,p,i)=>{
  t.writeInt(p[5],world(t,i,'pedSayContextImportant')(t.readInt(p[0]),t.readInt(p[1]),
   bool(t,p[2]),bool(t,p[3]),bool(t,p[4])));
 },
 ATTACH_FX_SYSTEM_TO_CHAR_BONE:(t,p,i)=>{
  world(t,i,'attachFxSystemToPedBone')(t.readInt(p[0]),t.readInt(p[1]),t.readInt(p[2]));
 },
 SET_HEADING_LIMIT_FOR_ATTACHED_CHAR:(t,p,i)=>{
  world(t,i,'setHeadingLimitForAttachedPed')(t.readInt(p[0]),t.readFloat(p[1]),t.readFloat(p[2]));
 },
 // The bike attachment carries two ranges rather than the one the car and object forms take.
 ATTACH_CHAR_TO_BIKE:(t,p,i)=>{
  world(t,i,'attachPedToBike')(t.readInt(p[0]),t.readInt(p[1]),vec(t,p,2),
   t.readFloat(p[5]),t.readFloat(p[6]),t.readFloat(p[7]),t.readInt(p[8]));
 },
 // The searchlight command names the light first and the ped second, which its own block says.
 IS_CHAR_IN_SEARCHLIGHT:(t,p,i)=>{
  t.updateCompareFlag(world(t,i,'pedIsInSearchlight')(t.readInt(p[0]),t.readInt(p[1])),negated(i));
 },
 IS_CHAR_AT_SCRIPTED_ATTRACTOR:(t,p,i)=>{
  t.updateCompareFlag(world(t,i,'pedIsAtScriptedAttractor')(t.readInt(p[0]),t.readInt(p[1])),negated(i));
 },
 GET_CLOSEST_CHAR_NODE:(t,p,i)=>{
  // The documentation says this gives back a value without saying it is a point; the command's six operands
  // are three in and three out, which is the only division that fits.
  const point=vec(t,p,0),node=world(t,i,'closestPedNode')(point.x,point.y,point.z);
  t.writeFloat(p[3],node.x);t.writeFloat(p[4],node.y);t.writeFloat(p[5],node.z);
 },
 GET_RANDOM_CHAR_IN_ZONE:(t,p,i)=>{
  t.writeInt(p[4],world(t,i,'randomPedInZone')(t.text(p[0]),bool(t,p[1]),bool(t,p[2]),bool(t,p[3])));
 },
 CREATE_SWAT_ROPE:(t,p,i)=>{
  const point=vec(t,p,2);
  t.writeInt(p[5],world(t,i,'createSwatRope')(t.readInt(p[0]),model(t,i,p[1]),point.x,point.y,point.z));
 },
 /* --- The cutscene the script loads, runs and clears. Its loop is load, wait for loaded, start, wait for
  * finished, clear; a host moves it between those. */
 LOAD_CUTSCENE:(t,p,i)=>{
  const name=t.text(p[0]);game(t,i).cutscene.load(name);t.host?.world?.loadCutscene?.(name);
 },
 HAS_CUTSCENE_LOADED:(t,_p,i)=>{t.updateCompareFlag(game(t,i).cutscene.hasLoaded,negated(i));},
 START_CUTSCENE:(t,_p,i)=>{const state=game(t,i);state.cutscene.start();if(state.cutscene.running)t.host?.world?.startCutscene?.();},
 HAS_CUTSCENE_FINISHED:(t,_p,i)=>{t.updateCompareFlag(game(t,i).cutscene.hasFinished,negated(i));},
 CLEAR_CUTSCENE:(t,_p,i)=>{game(t,i).cutscene.clear();t.host?.world?.clearCutscene?.();},
 // The skip pair: CRunningScript::m_SceneSkipIP, the label the thread jumps to when the skip button is pressed
 // (CRunningScript::Process), and back to none.
 SKIP_CUTSCENE_START_INTERNAL:(t,p)=>{t.sceneSkipIp=t.readInt(p[0]);},
 SKIP_CUTSCENE_END:t=>{t.sceneSkipIp=undefined;},
 // SKIP_CUTSCENE_START is already in the native-nop list, which PC 1.0 parses and does nothing with, so only
 // its internal twin carries a body here. The overlap guard in the game-state test caught a handler added for
 // it, which is the second time that list has been right against a new one.
 WAS_CUTSCENE_SKIPPED:(t,_p,i)=>{t.updateCompareFlag(game(t,i).cutscene.wasSkipped,negated(i));},
 // The schema also lists two questions about whether a cutscene is running, but our own opcode table carries
 // neither name, so they are not commands this script can contain and there is nothing to handle.
 // Whether the player is holding the button that skips one, which only a host knows.
 IS_SKIP_CUTSCENE_BUTTON_PRESSED:(t,_p,i)=>{
  t.updateCompareFlag(world(t,i,'isCutsceneSkipButtonBeingPressed')(),negated(i));
 },
 SET_CUTSCENE_OFFSET:(t,p,i)=>{const point=vec(t,p,0);game(t,i).cutscene.setOffset(point.x,point.y,point.z);},
 GET_CUTSCENE_OFFSET:(t,p,i)=>{
  const {offset}=game(t,i).cutscene;
  t.writeFloat(p[0],offset.x);t.writeFloat(p[1],offset.y);t.writeFloat(p[2],offset.z);
 },
 GET_CUTSCENE_TIME:(t,p,i)=>{t.writeInt(p[0],game(t,i).cutscene.time);},
 // The special-character slots, which the script counts from one.
 LOAD_SPECIAL_CHARACTER:(t,p,i)=>{game(t,i).specialCharacters.load(t.readInt(p[0]),t.text(p[1]));},
 UNLOAD_SPECIAL_CHARACTER:(t,p,i)=>{game(t,i).specialCharacters.unload(t.readInt(p[0]));},
 // The mission's own two reports, and the counters and timers it clears by number.
 MISSION_HAS_FINISHED:(t,_p,i)=>{game(t,i).missionFinished=true;},
 // The mission-passed report keeps the key it names; the stat behind it is CStats::IncrementStat, which the
 // progress commands already reach, so this only records the key rather than guessing which stat it moves.
 // CStats::LastMissionPassedName, then the pass itself (reVC's REGISTER_MISSION_PASSED: MissionsPassed, which SA keeps as
 // STAT_MISSIONS_PASSED, and CTheScripts::LastMissionPassedTime; the shortcut taxi's drop-off is Vice City's alone).
 REGISTER_MISSION_PASSED:(t,p,i,now)=>{const g=game(t,i);g.missionPassedKey=t.text(p[0]);g.registerMissionPassed(now);},
 // The onscreen commands name a global variable itself: COnscreenTimer keeps its offset and reads it every frame.
 CLEAR_ONSCREEN_COUNTER:(t,p,i)=>{game(t,i).onscreenTimer.clearCounter(t.globalOffset(p[0]));},
 CLEAR_ONSCREEN_TIMER:(t,p,i)=>{game(t,i).onscreenTimer.clearClock(t.globalOffset(p[0]));},
 /* --- The rest of the tasks the schema names, and the world commands beside them. */
 TASK_FOLLOW_POINT_ROUTE:(t,p,i)=>{
  scriptedTask(t,i,t.readInt(p[0]),{kind:'followPointRoute',speed:t.readInt(p[1]),mode:t.readInt(p[2]),route:game(t,i).route.map(point=>({...point}))});
 },
 TASK_GO_TO_COORD_ANY_MEANS:(t,p,i)=>{
  const point=vec(t,p,1);
  scriptedTask(t,i,t.readInt(p[0]),{kind:'goToCoordAnyMeans',...point,speed:t.readInt(p[4]),vehicle:t.readInt(p[5])});
 },
 TASK_ENTER_CAR_AS_DRIVER:(t,p,i)=>{
  scriptedTask(t,i,t.readInt(p[0]),{kind:'enterCarAsDriver',vehicle:t.readInt(p[1]),time:t.readInt(p[2]),moveState:takeNextDesiredMoveState(t,i)});
 },
 TASK_ENTER_CAR_AS_PASSENGER:(t,p,i)=>{
  scriptedTask(t,i,t.readInt(p[0]),{kind:'enterCarAsPassenger',vehicle:t.readInt(p[1]),time:t.readInt(p[2]),seat:t.readInt(p[3]),moveState:takeNextDesiredMoveState(t,i)});
 },
 TASK_LEAVE_CAR:(t,p,i)=>{scriptedTask(t,i,t.readInt(p[0]),{kind:'leaveCar',vehicle:t.readInt(p[1])});},
 TASK_STAND_STILL:(t,p,i)=>{scriptedTask(t,i,t.readInt(p[0]),{kind:'standStill',time:t.readInt(p[1])});},
 TASK_SHOOT_AT_COORD:(t,p,i)=>{
  const point=vec(t,p,1);
  scriptedTask(t,i,t.readInt(p[0]),{kind:'shootAtCoord',...point,time:t.readInt(p[4])});
 },
 TASK_SET_CHAR_DECISION_MAKER:(t,p,i)=>{
  scriptedTask(t,i,t.readInt(p[0]),{kind:'setDecisionMaker',decisionMaker:t.readInt(p[1])});
 },
 // The vehicle setters, each one field of the car the script names.
 SET_CAR_FORWARD_SPEED:(t,p,i)=>{world(t,i,'setVehicleForwardSpeed')(t.readInt(p[0]),t.readFloat(p[1]));},
 SET_CAR_CRUISE_SPEED:(t,p,i)=>{world(t,i,'setVehicleCruiseSpeed')(t.readInt(p[0]),t.readFloat(p[1]));},
 CHANGE_CAR_COLOUR:(t,p,i)=>{world(t,i,'changeVehicleColour')(t.readInt(p[0]),t.readInt(p[1]),t.readInt(p[2]));},
 SET_LOAD_COLLISION_FOR_CAR_FLAG:(t,p,i)=>{world(t,i,'setVehicleLoadCollisionFlag')(t.readInt(p[0]),bool(t,p[1]));},
 SET_CAR_ONLY_DAMAGED_BY_PLAYER:(t,p,i)=>{world(t,i,'setVehicleOnlyDamagedByPlayer')(t.readInt(p[0]),bool(t,p[1]));},
 SET_CAN_BURST_CAR_TYRES:(t,p,i)=>{world(t,i,'setVehicleCanBurstTyres')(t.readInt(p[0]),bool(t,p[1]));},
 // An object carried by a car, with an offset and three rotations of its own.
 ATTACH_OBJECT_TO_CAR:(t,p,i)=>{
  world(t,i,'attachObjectToVehicle')(t.readInt(p[0]),t.readInt(p[1]),vec(t,p,2),vec(t,p,5));
 },
 KILL_FX_SYSTEM:(t,p,i)=>{world(t,i,'killFxSystem')(t.readInt(p[0]));},
 ADD_EXPLOSION:(t,p,i)=>{const point=vec(t,p,0);world(t,i,'addExplosion')(point.x,point.y,point.z,t.readInt(p[3]));},
 // The ped's face and the weapon a scripted cutscene hides.
 START_CHAR_FACIAL_TALK:(t,p,i)=>{world(t,i,'startPedFacialTalk')(t.readInt(p[0]),t.readInt(p[1]));},
 STOP_CHAR_FACIAL_TALK:(t,p,i)=>{world(t,i,'stopPedFacialTalk')(t.readInt(p[0]));},
 HIDE_CHAR_WEAPON_FOR_SCRIPTED_CUTSCENE:(t,p,i)=>{
  world(t,i,'hidePedWeaponForScriptedCutscene')(t.readInt(p[0]),bool(t,p[1]));
 },
 SET_GROUP_MEMBER:(t,p,i)=>{world(t,i,'setGroupMember')(t.readInt(p[0]),t.readInt(p[1]));},
 SET_CHAR_HAS_USED_ENTRY_EXIT:(t,p,i)=>{
  world(t,i,'setPedHasUsedEntryExit')(t.readInt(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]));
 },
 CLEAR_CHAR_DECISION_MAKER_EVENT_RESPONSE:(t,p,i)=>{
  world(t,i,'clearPedDecisionMakerEventResponse')(t.readInt(p[0]),t.readInt(p[1]));
 },
 // The patrol route, which carries an animation at each of its points unlike the plain one.
 EXTEND_PATROL_ROUTE:(t,p,i)=>{
  const point=vec(t,p,0);
  world(t,i,'extendPatrolRoute')(point.x,point.y,point.z,t.text(p[3]),t.text(p[4]));
 },
 // The retail handler is unreversed; the tune is a stream track the port does not package, so a host without it only
 // records the request and the mission script carries on to its pass.
 PLAY_MISSION_PASSED_TUNE:(t,p,i)=>{const tune=t.readInt(p[0]);game(t,i).missionPassedTune=tune;t.host?.world?.playMissionPassedTune?.(tune);},
 IS_MESSAGE_BEING_DISPLAYED:(t,_p,i)=>{t.updateCompareFlag(world(t,i,'isMessageBeingDisplayed')(),negated(i));},
 IS_HELP_MESSAGE_BEING_DISPLAYED:(t,_p,i)=>{t.updateCompareFlag(world(t,i,'isHelpMessageBeingDisplayed')(),negated(i));},
 HAS_SPECIAL_CHARACTER_LOADED:(t,p,i)=>{
  t.updateCompareFlag(game(t,i).specialCharacters.at(t.readInt(p[0]))!==undefined,negated(i));
 },
 // CWanted::m_fMultiplier, the scale on how fast the wanted level rises.
 SET_WANTED_MULTIPLIER:(t,p,i)=>{game(t,i).wantedMultiplier=t.readFloat(p[0]);},
 // Whether this thread has already had its death-or-arrest reset, which the runtime records as it happens.
 HAS_DEATHARREST_BEEN_EXECUTED:(t,_p,i)=>{t.updateCompareFlag(t.doneDeathArrest,negated(i));},
 /* --- The checkpoints a script places, and the rest of the world commands the schema names. */
 CREATE_CHECKPOINT:(t,p,i)=>{
  t.writeInt(p[8],game(t,i).checkpoints.create(t.readInt(p[0]),vec(t,p,1),vec(t,p,4),t.readFloat(p[7])));
 },
 DELETE_CHECKPOINT:(t,p,i)=>{game(t,i).checkpoints.remove(t.readInt(p[0]));},
 SET_BLIP_ENTRY_EXIT:(t,p,i)=>{
  world(t,i,'setBlipEntryExit')(t.readInt(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]));
 },
 // The models the script keeps out of traffic, and the two gang switches.
 SUPPRESS_CAR_MODEL:(t,p,i)=>{game(t,i).suppressedCarModels.add(model(t,i,p[0]));},
 MAKE_PLAYER_GANG_DISAPPEAR:(t,_p,i)=>{game(t,i).playerGangVisible=false;},
 MAKE_PLAYER_GANG_REAPPEAR:(t,_p,i)=>{game(t,i).playerGangVisible=true;},
 AWARD_PLAYER_MISSION_RESPECT:(t,p,i)=>{game(t,i).missionRespect+=t.readInt(p[0]);},
 // The vehicle questions and the two commands that reach one.
 DOES_VEHICLE_EXIST:(t,p,i)=>{t.updateCompareFlag(world(t,i,'vehicleExistsByHandle')(t.readInt(p[0])),negated(i));},
 IS_CAR_STOPPED:(t,p,i)=>{t.updateCompareFlag(world(t,i,'vehicleIsStopped')(t.readInt(p[0])),negated(i));},
 IS_CAR_ON_SCREEN:(t,p,i)=>{t.updateCompareFlag(world(t,i,'vehicleIsOnScreen')(t.readInt(p[0])),negated(i));},
 EXPLODE_CAR:(t,p,i)=>{world(t,i,'explodeVehicle')(t.readInt(p[0]));},
 // A car with nobody at the wheel leaves the variable at nothing.
 GET_DRIVER_OF_CAR:(t,p,i)=>{t.writeInt(p[1],world(t,i,'vehicleDriver')(t.readInt(p[0]))??-1);},
 // The random model gives back both the model and the class it belongs to.
 GET_RANDOM_CAR_MODEL_IN_MEMORY:(t,p,i)=>{
  const chosen=world(t,i,'randomVehicleModelInMemory')(bool(t,p[0]));
  t.writeInt(p[1],chosen.model);t.writeInt(p[2],chosen.vehicleClass);
 },
 // The ped commands.
 SET_CHAR_KINDA_STAY_IN_SAME_PLACE:(t,p,i)=>{world(t,i,'setPedKindaStayInSamePlace')(t.readInt(p[0]),bool(t,p[1]));},
 SET_CHAR_KEEP_TASK:(t,p,i)=>{world(t,i,'setPedKeepTask')(t.readInt(p[0]),bool(t,p[1]));},
 SET_CHAR_WEAPON_SKILL:(t,p,i)=>{world(t,i,'setPedWeaponSkill')(t.readInt(p[0]),t.readInt(p[1]));},
 SET_CHAR_COORDINATES_DONT_WARP_GANG:(t,p,i)=>{
  const point=vec(t,p,1);
  world(t,i,'setPedCoordinatesDontWarpGang')(t.readInt(p[0]),point.x,point.y,point.z);
 },
 IS_CHAR_RESPONDING_TO_EVENT:(t,p,i)=>{
  t.updateCompareFlag(world(t,i,'pedIsRespondingToEvent')(t.readInt(p[0]),t.readInt(p[1])),negated(i));
 },
 // The decision-maker response carries four chances, one for each way the ped may feel about the other.
 ADD_CHAR_DECISION_MAKER_EVENT_RESPONSE:(t,p,i)=>{
  world(t,i,'addPedDecisionMakerEventResponse')(t.readInt(p[0]),t.readInt(p[1]),t.readInt(p[2]),
   {respect:t.readFloat(p[3]),hate:t.readFloat(p[4]),like:t.readFloat(p[5]),dislike:t.readFloat(p[6])},
   bool(t,p[7]),bool(t,p[8]));
 },
 // The object commands: a slide to a point at its own speed, and the health it carries.
 /* SLIDE_OBJECT's handler is unreversed; Vice City's is followed. Each axis moves toward the target by its speed
  * times the timestep, stopping at the target, and the flag is set once all three have arrived. With the collision
  * check, a move the host finds blocked is not made. */
 SLIDE_OBJECT:(t,p,i)=>{
  const objects=game(t,i).objects,handle=t.readInt(p[0]),target=vec(t,p,1),speed=vec(t,p,4),check=bool(t,p[7]);
  if(t.timeStep===undefined)throw new UnsupportedScmCommand(i.offset,i.opcode&0x7fff,i.name,'no timestep');
  const from=objects.at(handle).position,step=Math.fround(t.timeStep);
  const axis=(at:number,to:number,rate:number)=>{const f=Math.fround;if(to<at){const n=f(at-f(rate*step));return n<to?to:n;}const n=f(at+f(rate*step));return n>to?to:n;};
  const next={x:axis(from.x,target.x,speed.x),y:axis(from.y,target.y,speed.y),z:axis(from.z,target.z,speed.z)};
  const blocked=check&&!!t.host?.world?.objectBlockedAt?.(handle,next);
  if(!blocked)objects.setPosition(handle,next);
  t.updateCompareFlag(next.x===target.x&&next.y===target.y&&next.z===target.z,negated(i));
 },
 SET_OBJECT_HEALTH:(t,p,i)=>{world(t,i,'setObjectHealth')(t.readInt(p[0]),t.readInt(p[1]));},
 PLAY_FX_SYSTEM:(t,p,i)=>{world(t,i,'playFxSystem')(t.readInt(p[0]));},
 // Its AE_SCRIPT_* events (AMMUNATION_BUY_WEAPON 1052, PART_MISSION_COMPLETE 1058, ...) with a point: the same
 // ReportMissionAudioEvent as REPORT_MISSION_AUDIO_EVENT_AT_POSITION (the command's own dispatch is unreversed).
 ADD_ONE_OFF_SOUND:(t,p,i)=>{game(t,i).missionAudio.report(t.readInt(p[3]),vec(t,p,0));},
 GET_HUD_COLOUR:(t,p,i)=>{
  const colour=world(t,i,'hudColour')(t.readInt(p[0]));
  t.writeInt(p[1],colour.red);t.writeInt(p[2],colour.green);t.writeInt(p[3],colour.blue);t.writeInt(p[4],colour.alpha);
 },
 DISPLAY_ONSCREEN_TIMER_WITH_STRING:(t,p,i)=>{game(t,i).onscreenTimer.addClock(t.globalOffset(p[0]),t.text(p[2]),t.readInt(p[1]));},
 // The last of the tasks the schema names.
 TASK_CHAT_WITH_CHAR:(t,p,i)=>{
  scriptedTask(t,i,t.readInt(p[0]),{kind:'chatWithPed',other:t.readInt(p[1]),leadSpeaker:bool(t,p[2]),unknown:t.readInt(p[3])});
 },
 TASK_CAR_MISSION:(t,p,i)=>{
  scriptedTask(t,i,t.readInt(p[0]),{kind:'carMission',vehicle:t.readInt(p[1]),targetVehicle:t.readInt(p[2]),
   missionId:t.readInt(p[3]),cruiseSpeed:t.readFloat(p[4]),drivingStyle:t.readInt(p[5])});
 },
 TASK_CAR_TEMP_ACTION:(t,p,i)=>{
  scriptedTask(t,i,t.readInt(p[0]),{kind:'carTempAction',vehicle:t.readInt(p[1]),actionId:t.readInt(p[2]),time:t.readInt(p[3])});
 },
 TASK_SMART_FLEE_CHAR:(t,p,i)=>{
  scriptedTask(t,i,t.readInt(p[0]),{kind:'smartFleePed',threat:t.readInt(p[1]),radius:t.readFloat(p[2]),time:t.readInt(p[3])});
 },
 TASK_TURN_CHAR_TO_FACE_COORD:(t,p,i)=>{
  scriptedTask(t,i,t.readInt(p[0]),{kind:'turnToFaceCoord',...vec(t,p,1)});
 },
 TASK_DIE:(t,p,i)=>{scriptedTask(t,i,t.readInt(p[0]),{kind:'die'});},
 /* --- The rest of the tasks, and the vehicle, object and world commands beside them. */
 TASK_KINDA_STAY_IN_SAME_PLACE:(t,p,i)=>{scriptedTask(t,i,t.readInt(p[0]),{kind:'kindaStayInSamePlace',state:bool(t,p[1])});},
 TASK_USE_MOBILE_PHONE:(t,p,i)=>{scriptedTask(t,i,t.readInt(p[0]),{kind:'useMobilePhone',start:bool(t,p[1])});},
 TASK_FOLLOW_PATROL_ROUTE:(t,p,i)=>{
  scriptedTask(t,i,t.readInt(p[0]),{kind:'followPatrolRoute',speed:t.readInt(p[1]),mode:t.readInt(p[2])});
 },
 TASK_GOTO_CHAR:(t,p,i)=>{
  scriptedTask(t,i,t.readInt(p[0]),{kind:'gotoPed',target:t.readInt(p[1]),time:t.readInt(p[2]),radius:t.readFloat(p[3])});
 },
 TASK_CAR_DRIVE_WANDER:(t,p,i)=>{
  scriptedTask(t,i,t.readInt(p[0]),{kind:'carDriveWander',vehicle:t.readInt(p[1]),speed:t.readFloat(p[2]),drivingMode:t.readInt(p[3])});
 },
 TASK_GO_TO_COORD_WHILE_SHOOTING:(t,p,i)=>{
  const point=vec(t,p,1);
  scriptedTask(t,i,t.readInt(p[0]),{kind:'goToCoordWhileShooting',...point,speed:t.readInt(p[4]),
   turnRadius:t.readFloat(p[5]),stopRadius:t.readFloat(p[6]),target:t.readInt(p[7])});
 },
 // The pick-up task carries an offset, a bone, an orientation and an animation of its own.
 TASK_PICK_UP_OBJECT:(t,p,i)=>{
  scriptedTask(t,i,t.readInt(p[0]),{kind:'pickUpObject',object:t.readInt(p[1]),offset:vec(t,p,2),
   bone:t.readInt(p[5]),orientation:t.readInt(p[6]),animationName:t.text(p[7]),animationFile:t.text(p[8]),
   time:t.readInt(p[9])});
 },
 // The vehicle commands.
 SWITCH_CAR_SIREN:(t,p,i)=>{world(t,i,'switchVehicleSiren')(t.readInt(p[0]),bool(t,p[1]));},
 CAR_GOTO_COORDINATES:(t,p,i)=>{
  const point=vec(t,p,1);world(t,i,'vehicleGotoCoordinates')(t.readInt(p[0]),point.x,point.y,point.z);
 },
 SET_CAR_HEAVY:(t,p,i)=>{world(t,i,'setVehicleHeavy')(t.readInt(p[0]),bool(t,p[1]));},
 SET_PETROL_TANK_WEAKPOINT:(t,p,i)=>{world(t,i,'setVehiclePetrolTankWeakpoint')(t.readInt(p[0]),bool(t,p[1]));},
 SET_CAR_STATUS:(t,p,i)=>{world(t,i,'setVehicleStatus')(t.readInt(p[0]),t.readInt(p[1]));},
 SET_CAR_ROTATION_VELOCITY:(t,p,i)=>{
  const velocity=vec(t,p,1);world(t,i,'setVehicleRotationVelocity')(t.readInt(p[0]),velocity.x,velocity.y,velocity.z);
 },
 FREEZE_CAR_POSITION_AND_DONT_LOAD_COLLISION:(t,p,i)=>{
  world(t,i,'freezeVehiclePositionAndDontLoadCollision')(t.readInt(p[0]),bool(t,p[1]));
 },
 OPEN_CAR_DOOR:(t,p,i)=>{world(t,i,'openVehicleDoor')(t.readInt(p[0]),t.readInt(p[1]));},
 CAR_SET_IDLE:(t,p,i)=>{world(t,i,'setVehicleIdle')(t.readInt(p[0]));},
 SET_TRAIN_CRUISE_SPEED:(t,p,i)=>{world(t,i,'setTrainCruiseSpeed')(t.readInt(p[0]),t.readFloat(p[1]));},
 // The object commands.
 SET_OBJECT_VISIBLE:(t,p,i)=>{world(t,i,'setObjectVisible')(t.readInt(p[0]),bool(t,p[1]));},
 SET_OBJECT_ONLY_DAMAGED_BY_PLAYER:(t,p,i)=>{world(t,i,'setObjectOnlyDamagedByPlayer')(t.readInt(p[0]),bool(t,p[1]));},
 MAKE_OBJECT_TARGETTABLE:(t,p,i)=>{world(t,i,'makeObjectTargettable')(t.readInt(p[0]),bool(t,p[1]));},
 BREAK_OBJECT:(t,p,i)=>{world(t,i,'breakObject')(t.readInt(p[0]),t.readInt(p[1]));},
 HAS_OBJECT_BEEN_DAMAGED:(t,p,i)=>{t.updateCompareFlag(world(t,i,'objectHasBeenDamaged')(t.readInt(p[0])),negated(i));},
 // The question names both what counts as smashed and what counts as damaged, and either may answer it.
 IS_CLOSEST_OBJECT_OF_TYPE_SMASHED_OR_DAMAGED:(t,p,i)=>{
  const point=vec(t,p,0);
  t.updateCompareFlag(world(t,i,'closestObjectOfTypeIsSmashedOrDamaged')(point.x,point.y,point.z,
   t.readFloat(p[3]),model(t,i,p[4]),bool(t,p[5]),bool(t,p[6])),negated(i));
 },
 // The box around a point that an object must be inside, which the locate helpers already measure.
 LOCATE_OBJECT_3D:(t,p,i)=>{
  const position=game(t,i).objects.at(t.readInt(p[0])).position;
  const point=vec(t,p,1),radius={x:t.readFloat(p[4]),y:t.readFloat(p[5]),z:t.readFloat(p[6])};
  if(bool(t,p[7]))t.host?.world?.highlightArea?.(point,radius);
  t.updateCompareFlag(insideBox(position,point,radius,true),negated(i));
 },
 CREATE_FX_SYSTEM:(t,p,i)=>{
  const point=vec(t,p,1);
  t.writeInt(p[5],world(t,i,'createFxSystem')(t.text(p[0]),point.x,point.y,point.z,bool(t,p[4])));
 },
 // The ped and gang commands.
 SET_CHAR_IS_TARGET_PRIORITY:(t,p,i)=>{world(t,i,'setPedIsTargetPriority')(t.readInt(p[0]),bool(t,p[1]));},
 SET_SCRIPT_LIMIT_TO_GANG_SIZE:(t,p,i)=>{world(t,i,'setScriptLimitToGangSize')(t.readInt(p[0]));},
 MAKE_ROOM_IN_PLAYER_GANG_FOR_MISSION_PEDS:(t,p,i)=>{world(t,i,'makeRoomInPlayerGangForMissionPeds')(t.readInt(p[0]));},
 // The world settings.
 FLUSH_PATROL_ROUTE:(t,_p,i)=>{world(t,i,'flushPatrolRoute')();},
 MARK_ROAD_NODE_AS_DONT_WANDER:(t,p,i)=>{
  const point=vec(t,p,0);world(t,i,'markRoadNodeAsDontWander')(point.x,point.y,point.z);
 },
 SET_RADIO_CHANNEL:(t,p,i)=>{world(t,i,'setRadioChannel')(t.readInt(p[0]));},
 // CTheScripts::RadarZoomValue, which CRadar::DrawMap takes off the on-foot range.
 SET_RADAR_ZOOM:(t,p,i)=>{game(t,i).radarZoom=t.readInt(p[0]);},
 SET_NEAR_CLIP:(t,p,i)=>{game(t,i).camera.setNearClipScript(t.readFloat(p[0]));},
 SET_TIME_SCALE:(t,p,i)=>{world(t,i,'setTimeScale')(t.readFloat(p[0]));},
 DISPLAY_ONSCREEN_COUNTER_WITH_STRING:(t,p,i)=>{game(t,i).onscreenTimer.addCounter(t.globalOffset(p[0]),t.readInt(p[1]),t.text(p[2]),0);},
 /* --- More tasks, the helicopters, and the world switches. */
 TASK_TOGGLE_PED_THREAT_SCANNER:(t,p,i)=>{
  scriptedTask(t,i,t.readInt(p[0]),{kind:'togglePedThreatScanner',onFoot:bool(t,p[1]),inCar:bool(t,p[2]),duringScriptTask:bool(t,p[3])});
 },
 TASK_DESTROY_CAR:(t,p,i)=>{scriptedTask(t,i,t.readInt(p[0]),{kind:'destroyCar',vehicle:t.readInt(p[1])});},
 TASK_SHUFFLE_TO_NEXT_CAR_SEAT:(t,p,i)=>{scriptedTask(t,i,t.readInt(p[0]),{kind:'shuffleToNextCarSeat',vehicle:t.readInt(p[1])});},
 TASK_SCRATCH_HEAD:(t,p,i)=>{scriptedTask(t,i,t.readInt(p[0]),{kind:'scratchHead'});},
 TASK_WANDER_STANDARD:(t,p,i)=>{scriptedTask(t,i,t.readInt(p[0]),{kind:'wanderStandard'});},
 TASK_CLIMB:(t,p,i)=>{scriptedTask(t,i,t.readInt(p[0]),{kind:'climb',flag:bool(t,p[1])});},
 TASK_DUCK:(t,p,i)=>{scriptedTask(t,i,t.readInt(p[0]),{kind:'duck',time:t.readInt(p[1])});},
 TASK_SET_IGNORE_WEAPON_RANGE_FLAG:(t,p,i)=>{
  scriptedTask(t,i,t.readInt(p[0]),{kind:'setIgnoreWeaponRangeFlag',state:bool(t,p[1])});
 },
 TASK_LOOK_AT_COORD:(t,p,i)=>{
  const point=vec(t,p,1);
  scriptedTask(t,i,t.readInt(p[0]),{kind:'lookAtCoord',...point,time:t.readInt(p[4])});
 },
 TASK_KILL_CHAR_ON_FOOT_TIMED:(t,p,i)=>{
  scriptedTask(t,i,t.readInt(p[0]),{kind:'killPedOnFootTimed',target:t.readInt(p[1]),time:t.readInt(p[2])});
 },
 // The helicopters, which take a band of altitude rather than one height.
 HELI_GOTO_COORDS:(t,p,i)=>{
  const point=vec(t,p,1);
  world(t,i,'heliGotoCoords')(t.readInt(p[0]),point.x,point.y,point.z,t.readFloat(p[4]),t.readFloat(p[5]));
 },
 SET_HELI_BLADES_FULL_SPEED:(t,p,i)=>{world(t,i,'setHeliBladesFullSpeed')(t.readInt(p[0]));},
 // The vehicles.
 SET_CAR_STRAIGHT_LINE_DISTANCE:(t,p,i)=>{world(t,i,'setVehicleStraightLineDistance')(t.readInt(p[0]),t.readInt(p[1]));},
 SET_VEHICLE_AREA_VISIBLE:(t,p,i)=>{world(t,i,'setVehicleAreaVisible')(t.readInt(p[0]),t.readInt(p[1]));},
 DAMAGE_CAR_DOOR:(t,p,i)=>{world(t,i,'damageVehicleDoor')(t.readInt(p[0]),t.readInt(p[1]));},
 HAS_CAR_BEEN_DAMAGED_BY_CHAR:(t,p,i)=>{
  t.updateCompareFlag(world(t,i,'vehicleWasDamagedByPed')(t.readInt(p[0]),t.readInt(p[1])),negated(i));
 },
 SET_CAR_TEMP_ACTION:(t,p,i)=>{world(t,i,'setVehicleTempAction')(t.readInt(p[0]),t.readInt(p[1]),t.readInt(p[2]));},
 // The car health question compares with greater or equal, as the ped one does.
 IS_CAR_HEALTH_GREATER:(t,p,i)=>{
  t.updateCompareFlag(world(t,i,'vehicleHealth')(t.readInt(p[0]))>=t.readInt(p[1]),negated(i));
 },
 IS_CAR_IN_WATER:(t,p,i)=>{t.updateCompareFlag(world(t,i,'vehicleIsInWater')(t.readInt(p[0])),negated(i));},
 SET_CAR_VISIBLE:(t,p,i)=>{world(t,i,'setVehicleVisible')(t.readInt(p[0]),bool(t,p[1]));},
 SET_TRAIN_SPEED:(t,p,i)=>{world(t,i,'setTrainSpeed')(t.readInt(p[0]),t.readFloat(p[1]));},
 // The box a car must be inside, measured the same way the ped's is.
 IS_CAR_IN_AREA_2D:(t,p,i)=>{
  const position=world(t,i,'vehiclePosition')(t.readInt(p[0]));
  const x1=t.readFloat(p[1]),y1=t.readFloat(p[2]),x2=t.readFloat(p[3]),y2=t.readFloat(p[4]);
  const inside=position.x>=Math.min(x1,x2)&&position.x<=Math.max(x1,x2)
   &&position.y>=Math.min(y1,y2)&&position.y<=Math.max(y1,y2);
  t.updateCompareFlag(inside,negated(i));
 },
 // The peds and objects.
 SET_CHAR_CAN_BE_KNOCKED_OFF_BIKE:(t,p,i)=>{world(t,i,'setPedCanBeKnockedOffBike')(t.readInt(p[0]),bool(t,p[1]));},
 IS_CHAR_HOLDING_OBJECT:(t,p,i)=>{
  t.updateCompareFlag(world(t,i,'pedIsHoldingObject')(t.readInt(p[0]),t.readInt(p[1])),negated(i));
 },
 CLEAR_ALL_CHAR_RELATIONSHIPS:(t,p,i)=>{world(t,i,'clearAllPedRelationships')(t.readInt(p[0]),t.readInt(p[1]));},
 IS_OBJECT_ATTACHED:(t,p,i)=>{t.updateCompareFlag(world(t,i,'objectIsAttached')(t.readInt(p[0])),negated(i));},
 CREATE_FX_SYSTEM_ON_CHAR:(t,p,i)=>{
  t.writeInt(p[6],world(t,i,'createFxSystemOnPed')(t.text(p[0]),t.readInt(p[1]),vec(t,p,2),bool(t,p[5])));
 },
 CLEAR_GROUP_DECISION_MAKER_EVENT_RESPONSE:(t,p,i)=>{
  world(t,i,'clearGroupDecisionMakerEventResponse')(t.readInt(p[0]),t.readInt(p[1]));
 },
 // A copy of a default decision maker in a slot of its own; the host fills it with the source's decisions.
 COPY_CHAR_DECISION_MAKER:(t,p,i)=>{const {handle,from}=game(t,i).decisionMakers.copy(t.readInt(p[0]),t.usesMissionCleanup);t.writeInt(p[1],handle);t.host?.world?.seedDecisionMaker?.(handle,from);},
 // The world switches and the pad's two sticks.
 // Handler unreversed: the command sets CCarCtrl::bAllowEmergencyServicesToBeCreated, which only the
 // (unreversed) emergency-services generator reads.
 SWITCH_EMERGENCY_SERVICES:(t,p,i)=>{game(t,i).allowEmergencyServices=bool(t,p[0]);},
 SWITCH_RANDOM_TRAINS:(t,p,i)=>{game(t,i).disableRandomTrains=!bool(t,p[0]);},
 SET_ALL_CARS_CAN_BE_DAMAGED:(t,p,i)=>{world(t,i,'setAllVehiclesCanBeDamaged')(bool(t,p[0]));},
 // CTheScripts::bDisplayHud, which CHud::Draw reads for the player info and the wanted level.
 DISPLAY_HUD:(t,p,i)=>{game(t,i).displayHud=bool(t,p[0]);},
 FREEZE_ONSCREEN_TIMER:(t,p,i)=>{game(t,i).onscreenTimer.paused=bool(t,p[0]);},
 // The Nth counter is one-based: the plain counter is the first (slot 0), and the missions that show both start
 // the Nth ones at 2.
 DISPLAY_NTH_ONSCREEN_COUNTER_WITH_STRING:(t,p,i)=>{game(t,i).onscreenTimer.addCounter(t.globalOffset(p[0]),t.readInt(p[1]),t.text(p[3]),t.readInt(p[2])-1);},
 ADD_EXPLOSION_VARIABLE_SHAKE:(t,p,i)=>{
  const point=vec(t,p,0);
  world(t,i,'addExplosionVariableShake')(point.x,point.y,point.z,t.readInt(p[3]),t.readFloat(p[4]));
 },
 // CPad::GetPad(pad)->NewState's four stick axes, -128 to 128, from the pad state the host writes.
 GET_POSITION_OF_ANALOGUE_STICKS:(t,p,i)=>{
  const pads=game(t,i).pads,pad=t.readInt(p[0]);
  t.writeInt(p[1],pads.state(pad,BUTTON.leftStickX));t.writeInt(p[2],pads.state(pad,BUTTON.leftStickY));
  t.writeInt(p[3],pads.state(pad,BUTTON.rightStickX));t.writeInt(p[4],pads.state(pad,BUTTON.rightStickY));
 },
 // CTheScripts::bMiniGameInProgress, which the runtime already keeps.
 IS_MINIGAME_IN_PROGRESS:(t,_p,i)=>{t.updateCompareFlag(game(t,i).miniGameInProgress,negated(i));},
 // The late comparison between a local and a global, whose twin at opcode sixty the thread already runs.
 IS_INT_LVAR_EQUAL_TO_INT_VAR:(t,p,i)=>{t.updateCompareFlag(t.readInt(p[0])===t.readInt(p[1]),negated(i));},
 /* --- Pure arithmetic the runtime does itself, with no world behind it at all. */
 SQRT:(t,p,i)=>{t.writeFloat(p[1],Math.sqrt(t.readFloat(p[0])));},
 // The heading a vector points along, in degrees, measured from north the way the game's headings are.
 GET_HEADING_FROM_VECTOR_2D:(t,p,i)=>{
  const x=t.readFloat(p[0]),y=t.readFloat(p[1]);
  const degrees=Math.atan2(-x,y)*180/Math.PI;
  t.writeFloat(p[2],degrees<0?degrees+360:degrees);
 },
 // Two rectangles given by a centre and a size each, which overlap when they overlap on both axes.
 DO_2D_RECTANGLES_COLLIDE:(t,p,i)=>{
  const ax=t.readFloat(p[0]),ay=t.readFloat(p[1]),aw=t.readFloat(p[2])/2,ah=t.readFloat(p[3])/2;
  const bx=t.readFloat(p[4]),by=t.readFloat(p[5]),bw=t.readFloat(p[6])/2,bh=t.readFloat(p[7])/2;
  t.updateCompareFlag(Math.abs(ax-bx)<=aw+bw&&Math.abs(ay-by)<=ah+bh,negated(i));
 },
 /* --- More tasks. */
 TASK_LOOK_ABOUT:(t,p,i)=>{scriptedTask(t,i,t.readInt(p[0]),{kind:'lookAbout',time:t.readInt(p[1])});},
 TASK_AIM_GUN_AT_COORD:(t,p,i)=>{
  const point=vec(t,p,1);
  scriptedTask(t,i,t.readInt(p[0]),{kind:'aimGunAtCoord',...point,time:t.readInt(p[4])});
 },
 TASK_AIM_GUN_AT_CHAR:(t,p,i)=>{
  scriptedTask(t,i,t.readInt(p[0]),{kind:'aimGunAtPed',target:t.readInt(p[1]),time:t.readInt(p[2])});
 },
 TASK_SHOOT_AT_CHAR:(t,p,i)=>{
  scriptedTask(t,i,t.readInt(p[0]),{kind:'shootAtPed',target:t.readInt(p[1]),time:t.readInt(p[2])});
 },
 TASK_LEAVE_CAR_IMMEDIATELY:(t,p,i)=>{
  scriptedTask(t,i,t.readInt(p[0]),{kind:'leaveCarImmediately',vehicle:t.readInt(p[1])});
 },
 TASK_DIE_NAMED_ANIM:(t,p,i)=>{
  scriptedTask(t,i,t.readInt(p[0]),{kind:'dieNamedAnim',animationName:t.text(p[1]),animationFile:t.text(p[2]),
   blendSpeed:t.readFloat(p[3]),time:t.readInt(p[4])});
 },
 /* --- The vehicles, boats and trains. */
 ANCHOR_BOAT:(t,p,i)=>{world(t,i,'anchorBoat')(t.readInt(p[0]),bool(t,p[1]));},
 IS_CAR_ON_FIRE:(t,p,i)=>{t.updateCompareFlag(world(t,i,'vehicleIsOnFire')(t.readInt(p[0])),negated(i));},
 // The force carries a direction and the offset it is applied at, six floats in all.
 APPLY_FORCE_TO_CAR:(t,p,i)=>{world(t,i,'applyForceToVehicle')(t.readInt(p[0]),vec(t,p,1),vec(t,p,4));},
 DAMAGE_CAR_PANEL:(t,p,i)=>{world(t,i,'damageVehiclePanel')(t.readInt(p[0]),t.readInt(p[1]));},
 DOES_CAR_HAVE_HYDRAULICS:(t,p,i)=>{t.updateCompareFlag(world(t,i,'vehicleHasHydraulics')(t.readInt(p[0])),negated(i));},
 IS_VEHICLE_ON_ALL_WHEELS:(t,p,i)=>{t.updateCompareFlag(world(t,i,'vehicleIsOnAllWheels')(t.readInt(p[0])),negated(i));},
 IS_CAR_UPSIDEDOWN:(t,p,i)=>{t.updateCompareFlag(world(t,i,'vehicleIsUpsideDown')(t.readInt(p[0])),negated(i));},
 TURN_CAR_TO_FACE_COORD:(t,p,i)=>{
  world(t,i,'turnVehicleToFaceCoord')(t.readInt(p[0]),t.readFloat(p[1]),t.readFloat(p[2]));
 },
 BURST_CAR_TYRE:(t,p,i)=>{world(t,i,'burstVehicleTyre')(t.readInt(p[0]),t.readInt(p[1]));},
 CLOSE_ALL_CAR_DOORS:(t,p,i)=>{world(t,i,'closeAllVehicleDoors')(t.readInt(p[0]));},
 SET_CAR_CAN_BE_VISIBLY_DAMAGED:(t,p,i)=>{world(t,i,'setVehicleCanBeVisiblyDamaged')(t.readInt(p[0]),bool(t,p[1]));},
 SET_UPSIDEDOWN_CAR_NOT_DAMAGED:(t,p,i)=>{world(t,i,'setUpsideDownVehicleNotDamaged')(t.readInt(p[0]),bool(t,p[1]));},
 SKIP_IN_PLAYBACK_RECORDED_CAR:(t,p,i)=>{world(t,i,'skipInPlaybackRecordedCar')(t.readInt(p[0]),t.readFloat(p[1]));},
 CREATE_MISSION_TRAIN:(t,p,i)=>{
  const point=vec(t,p,1);
  t.writeInt(p[5],world(t,i,'createMissionTrain')(t.readInt(p[0]),point.x,point.y,point.z,bool(t,p[4])));
 },
 /* --- The groups. */
 CREATE_GROUP:(t,p,i)=>{t.writeInt(p[1],world(t,i,'createGroup')(t.readInt(p[0])));},
 REMOVE_GROUP:(t,p,i)=>{world(t,i,'removeGroup')(t.readInt(p[0]));},
 SET_GROUP_FOLLOW_STATUS:(t,p,i)=>{world(t,i,'setGroupFollowStatus')(t.readInt(p[0]),bool(t,p[1]));},
 SET_GROUP_DECISION_MAKER:(t,p,i)=>{world(t,i,'setGroupDecisionMaker')(t.readInt(p[0]),t.readInt(p[1]));},
 /* --- The particles and the object animation. */
 STOP_FX_SYSTEM:(t,p,i)=>{world(t,i,'stopFxSystem')(t.readInt(p[0]));},
 PLAY_AND_KILL_FX_SYSTEM:(t,p,i)=>{world(t,i,'playAndKillFxSystem')(t.readInt(p[0]));},
 CREATE_FX_SYSTEM_ON_OBJECT:(t,p,i)=>{
  t.writeInt(p[6],world(t,i,'createFxSystemOnObject')(t.text(p[0]),t.readInt(p[1]),vec(t,p,2),bool(t,p[5])));
 },
 PLAY_OBJECT_ANIM:(t,p,i)=>{
  world(t,i,'playObjectAnim')(t.readInt(p[0]),t.text(p[1]),t.text(p[2]),t.readFloat(p[3]),bool(t,p[4]),bool(t,p[5]));
 },
 /* --- The world settings and the two remaining questions. */
 DISABLE_ALL_ENTRY_EXITS:(t,p,i)=>{world(t,i,'disableAllEntryExits')(bool(t,p[0]));},
 SET_DARKNESS_EFFECT:(t,p,i)=>{world(t,i,'setDarknessEffect')(bool(t,p[0]),t.readInt(p[1]));},
 ENABLE_CRANE_CONTROLS:(t,p,i)=>{
  world(t,i,'enableCraneControls')(bool(t,p[0]),bool(t,p[1]),bool(t,p[2]));
 },
 // The catch-up share is what the stop share leaves of a hundred.
 SET_INTERPOLATION_PARAMETERS:(t,p,i)=>{
  const stop=t.readFloat(p[0]);game(t,i).camera.setParametersForScriptInterpolation(stop,100-stop,t.readInt(p[1]));
 },
 SET_MUSIC_DOES_FADE:(t,p,i)=>{game(t,i).camera.ignoreFadingStuffForMusic=!bool(t,p[0]);},
 ENABLE_AMBIENT_CRIME:(t,p,i)=>{game(t,i).enableAmbientCrime=bool(t,p[0]);},
 IS_POINT_OBSCURED_BY_A_MISSION_ENTITY:(t,p,i)=>{
  const point=vec(t,p,0),radius=vec(t,p,3);
  t.updateCompareFlag(world(t,i,'pointIsObscuredByMissionEntity')(point.x,point.y,point.z,radius.x,radius.y,radius.z),negated(i));
 },
 SET_CHAR_SAY_CONTEXT:(t,p,i)=>{t.writeInt(p[2],world(t,i,'pedSayContext')(t.readInt(p[0]),t.readInt(p[1])));},
 SET_HEADING_FOR_ATTACHED_PLAYER:(t,p,i)=>{
  world(t,i,'setHeadingForAttachedPlayer')(t.readInt(p[0]),t.readFloat(p[1]),t.readFloat(p[2]));
 },
 /* --- More tasks. The slide-and-play task carries a whole animation beside its point and heading. */
 TASK_CHAR_SLIDE_TO_COORD_AND_PLAY_ANIM:(t,p,i)=>{
  const point=vec(t,p,1);
  scriptedTask(t,i,t.readInt(p[0]),{kind:'slideToCoordAndPlayAnim',...point,heading:t.readFloat(p[4]),
   slideSpeed:t.readFloat(p[5]),animationName:t.text(p[6]),animationFile:t.text(p[7]),
   blendSpeed:t.readFloat(p[8]),loop:bool(t,p[9]),lockX:bool(t,p[10]),lockY:bool(t,p[11]),
   keepLastFrame:bool(t,p[12]),time:t.readInt(p[13])});
 },
 TASK_FLEE_CHAR:(t,p,i)=>{
  scriptedTask(t,i,t.readInt(p[0]),{kind:'fleePed',threat:t.readInt(p[1]),radius:t.readFloat(p[2]),time:t.readInt(p[3])});
 },
 TASK_FLEE_POINT:(t,p,i)=>{
  const point=vec(t,p,1);
  scriptedTask(t,i,t.readInt(p[0]),{kind:'fleePoint',...point,radius:t.readFloat(p[4]),time:t.readInt(p[5])});
 },
 TASK_HANDS_UP:(t,p,i)=>{scriptedTask(t,i,t.readInt(p[0]),{kind:'handsUp',time:t.readInt(p[1])});},
 TASK_JUMP:(t,p,i)=>{scriptedTask(t,i,t.readInt(p[0]),{kind:'jump',state:bool(t,p[1])});},
 TASK_SIT_DOWN:(t,p,i)=>{scriptedTask(t,i,t.readInt(p[0]),{kind:'sitDown',time:t.readInt(p[1])});},
 /* --- The searchlights, which take a point, the point they sweep to and two radii. */
 CREATE_SEARCHLIGHT:(t,p,i)=>{
  t.writeInt(p[8],world(t,i,'createSearchlight')(vec(t,p,0),vec(t,p,3),t.readFloat(p[6]),t.readFloat(p[7])));
 },
 DELETE_SEARCHLIGHT:(t,p,i)=>{world(t,i,'deleteSearchlight')(t.readInt(p[0]));},
 DOES_SEARCHLIGHT_EXIST:(t,p,i)=>{t.updateCompareFlag(world(t,i,'searchlightExists')(t.readInt(p[0])),negated(i));},
 // The searchlight is hung on three objects at once: its tower, its housing and its bulb.
 ATTACH_SEARCHLIGHT_TO_SEARCHLIGHT_OBJECT:(t,p,i)=>{
  world(t,i,'attachSearchlightToObject')(t.readInt(p[0]),t.readInt(p[1]),t.readInt(p[2]),t.readInt(p[3]),vec(t,p,4));
 },
 /* --- The menus, whose column command names a title and twelve rows. */
 CREATE_MENU:(t,p,i)=>{
  t.writeInt(p[8],world(t,i,'createMenu')(t.text(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),
   t.readInt(p[4]),bool(t,p[5]),bool(t,p[6]),t.readInt(p[7])));
 },
 DELETE_MENU:(t,p,i)=>{world(t,i,'deleteMenu')(t.readInt(p[0]));},
 SET_MENU_COLUMN:(t,p,i)=>{
  const rows:string[]=[];
  for(let row=3;row<15;row++)rows.push(t.text(p[row]));
  world(t,i,'setMenuColumn')(t.readInt(p[0]),t.readInt(p[1]),t.text(p[2]),rows);
 },
 SET_MENU_ITEM_WITH_NUMBER:(t,p,i)=>{
  world(t,i,'setMenuItemWithNumber')(t.readInt(p[0]),t.readInt(p[1]),t.readInt(p[2]),t.text(p[3]),t.readInt(p[4]));
 },
 /* --- The objects. */
 GET_OBJECT_HEALTH:(t,p,i)=>{t.writeInt(p[1],world(t,i,'objectHealth')(t.readInt(p[0])));},
 HAS_OBJECT_BEEN_DAMAGED_BY_WEAPON:(t,p,i)=>{
  t.updateCompareFlag(world(t,i,'objectWasDamagedByWeapon')(t.readInt(p[0]),t.readInt(p[1])),negated(i));
 },
 SORT_OUT_OBJECT_COLLISION_WITH_CAR:(t,p,i)=>{
  world(t,i,'sortOutObjectCollisionWithVehicle')(t.readInt(p[0]),t.readInt(p[1]));
 },
 DETACH_OBJECT:(t,p,i)=>{
  world(t,i,'detachObject')(t.readInt(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),bool(t,p[4]));
 },
 // The rope grab gives back three handles at once, whichever of them is holding on.
 GRAB_ENTITY_ON_ROPE_FOR_OBJECT:(t,p,i)=>{
  const held=world(t,i,'grabEntityOnRopeForObject')(t.readInt(p[0]));
  t.writeInt(p[1],held.vehicle);t.writeInt(p[2],held.ped);t.writeInt(p[3],held.object);
 },
 /* --- The vehicles. */
 IS_CAR_PASSENGER_SEAT_FREE:(t,p,i)=>{
  t.updateCompareFlag(world(t,i,'vehiclePassengerSeatIsFree')(t.readInt(p[0]),t.readInt(p[1])),negated(i));
 },
 SET_CAR_MISSION:(t,p,i)=>{world(t,i,'setVehicleMission')(t.readInt(p[0]),t.readInt(p[1]));},
 CONTROL_CAR_HYDRAULICS:(t,p,i)=>{
  world(t,i,'controlVehicleHydraulics')(t.readInt(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),
   t.readFloat(p[3]),t.readFloat(p[4]));
 },
 SET_CAR_HYDRAULICS:(t,p,i)=>{world(t,i,'setVehicleHydraulics')(t.readInt(p[0]),bool(t,p[1]));},
 IS_CAR_TYRE_BURST:(t,p,i)=>{
  t.updateCompareFlag(world(t,i,'vehicleTyreIsBurst')(t.readInt(p[0]),t.readInt(p[1])),negated(i));
 },
 SET_CAR_CAN_GO_AGAINST_TRAFFIC:(t,p,i)=>{world(t,i,'setVehicleCanGoAgainstTraffic')(t.readInt(p[0]),bool(t,p[1]));},
 SET_CAR_STRONG:(t,p,i)=>{world(t,i,'setVehicleStrong')(t.readInt(p[0]),bool(t,p[1]));},
 MARK_CAR_AS_CONVOY_CAR:(t,p,i)=>{world(t,i,'markVehicleAsConvoyCar')(t.readInt(p[0]),bool(t,p[1]));},
 CAR_WANDER_RANDOMLY:(t,p,i)=>{world(t,i,'vehicleWanderRandomly')(t.readInt(p[0]));},
 SET_CAR_TRACTION:(t,p,i)=>{world(t,i,'setVehicleTraction')(t.readInt(p[0]),t.readFloat(p[1]));},
 GET_MAXIMUM_NUMBER_OF_PASSENGERS:(t,p,i)=>{t.writeInt(p[1],world(t,i,'vehicleMaximumPassengers')(t.readInt(p[0])));},
 CLEAR_CAR_LAST_DAMAGE_ENTITY:(t,p,i)=>{world(t,i,'clearVehicleLastDamageEntity')(t.readInt(p[0]));},
 IS_CAR_MODEL:(t,p,i)=>{t.updateCompareFlag(world(t,i,'vehicleModelIs')(t.readInt(p[0]),model(t,i,p[1])),negated(i));},
 PLANE_GOTO_COORDS:(t,p,i)=>{
  const point=vec(t,p,1);
  world(t,i,'planeGotoCoords')(t.readInt(p[0]),point.x,point.y,point.z,t.readFloat(p[4]),t.readFloat(p[5]));
 },
 // The stopped locate for a car, which the vehicle locate already measures once the car has stopped.
 LOCATE_STOPPED_CAR_3D:(t,p,i)=>{
  const handle=t.readInt(p[0]);
  const point=vec(t,p,1),radius={x:t.readFloat(p[4]),y:t.readFloat(p[5]),z:t.readFloat(p[6])};
  if(bool(t,p[7]))t.host?.world?.highlightArea?.(point,radius);
  const stopped=world(t,i,'vehicleIsStopped')(handle);
  t.updateCompareFlag(stopped&&insideBox(world(t,i,'vehiclePosition')(handle),point,radius,true),negated(i));
 },
 /* --- The groups and the world. */
 SET_GROUP_LEADER:(t,p,i)=>{world(t,i,'setGroupLeader')(t.readInt(p[0]),t.readInt(p[1]));},
 SET_GROUP_DEFAULT_TASK_ALLOCATOR:(t,p,i)=>{
  world(t,i,'setGroupDefaultTaskAllocator')(t.readInt(p[0]),t.readInt(p[1]));
 },
 ADD_GROUP_DECISION_MAKER_EVENT_RESPONSE:(t,p,i)=>{
  world(t,i,'addGroupDecisionMakerEventResponse')(t.readInt(p[0]),t.readInt(p[1]),t.readInt(p[2]),
   {respect:t.readFloat(p[3]),hate:t.readFloat(p[4]),like:t.readFloat(p[5]),dislike:t.readFloat(p[6])},
   bool(t,p[7]),bool(t,p[8]));
 },
 SET_HEATHAZE_EFFECT:(t,p,i)=>{world(t,i,'setHeatHazeEffect')(bool(t,p[0]));},
 ADD_SPARKS:(t,p,i)=>{world(t,i,'addSparks')(vec(t,p,0),vec(t,p,3),t.readInt(p[6]));},
 SWITCH_AUDIO_ZONE:(t,p,i)=>{game(t,i).audioZones.switch(t.text(p[0]),bool(t,p[1]));},
 CAN_TRIGGER_GANG_WAR_WHEN_ON_A_MISSION:(t,p,i)=>{world(t,i,'setCanTriggerGangWarWhenOnMission')(bool(t,p[0]));},
 DISPLAY_CAR_NAMES:(t,p,i)=>{world(t,i,'displayVehicleNames')(bool(t,p[0]));},
 SET_TAG_STATUS_IN_AREA:(t,p,i)=>{
  world(t,i,'setTagStatusInArea')(t.readFloat(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),t.readInt(p[4]));
 },
 GET_PERCENTAGE_TAGGED_IN_AREA:(t,p,i)=>{
  t.writeInt(p[4],world(t,i,'percentageTaggedInArea')(t.readFloat(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3])));
 },
 CLEAR_AREA_OF_CARS:(t,p,i)=>{world(t,i,'clearAreaOfVehicles')(vec(t,p,0),vec(t,p,3));},
 SET_PLAYER_CYCLE_WEAPON_BUTTON:(t,p,i)=>{world(t,i,'setPlayerCycleWeaponButton')(t.readInt(p[0]),bool(t,p[1]));},
 // The debug line the script draws between two points.
 LINE:(t,p,i)=>{world(t,i,'drawLine')(vec(t,p,0),vec(t,p,3));},
 CLEAR_SKIP:(t,_p,i)=>{world(t,i,'clearSkip')();},
 // The same pass with no name to keep.
 REGISTER_ODDJOB_MISSION_PASSED:(t,_p,i,now)=>{game(t,i).registerMissionPassed(now);},
 /* --- Two more pieces of arithmetic the runtime does itself. */
 // The angle between two vectors, in degrees, which the script reads as a bearing between nothing and a turn.
 GET_ANGLE_BETWEEN_2D_VECTORS:(t,p,i)=>{
  const ax=t.readFloat(p[0]),ay=t.readFloat(p[1]),bx=t.readFloat(p[2]),by=t.readFloat(p[3]);
  const lengths=Math.hypot(ax,ay)*Math.hypot(bx,by);
  const cosine=lengths>0?Math.min(1,Math.max(-1,(ax*bx+ay*by)/lengths)):1;
  t.writeFloat(p[4],Math.acos(cosine)*180/Math.PI);
 },
 // An angle brought back into a single turn, which is what every heading in this game is fixed to.
 LIMIT_ANGLE:(t,p,i)=>{
  const angle=t.readFloat(p[0])%360;
  t.writeFloat(p[1],angle<0?angle+360:angle);
 },
 /* --- The last of the tasks. */
 TASK_DRIVE_POINT_ROUTE_ADVANCED:(t,p,i)=>{
  scriptedTask(t,i,t.readInt(p[0]),{kind:'drivePointRouteAdvanced',vehicle:t.readInt(p[1]),
   speed:t.readFloat(p[2]),driveMode:t.readInt(p[3]),model:model(t,i,p[4]),drivingStyle:t.readInt(p[5])});
 },
 TASK_EVERYONE_LEAVE_CAR:(t,p,i)=>{
  // This one names a car rather than a ped: everyone in it leaves, so it is given to no ped in particular.
  world(t,i,'givePedScriptedTask')(-1,{kind:'everyoneLeaveCar',vehicle:t.readInt(p[0])},i.opcode&0x7fff);
 },
 TASK_SMART_FLEE_POINT:(t,p,i)=>{
  const point=vec(t,p,1);
  scriptedTask(t,i,t.readInt(p[0]),{kind:'smartFleePoint',...point,radius:t.readFloat(p[4]),time:t.readInt(p[5])});
 },
 /* --- The vehicles, planes and trains of the tail. */
 IS_VEHICLE_TOUCHING_OBJECT:(t,p,i)=>{
  t.updateCompareFlag(world(t,i,'vehicleIsTouchingObject')(t.readInt(p[0]),t.readInt(p[1])),negated(i));
 },
 GET_TRAIN_CARRIAGE:(t,p,i)=>{t.writeInt(p[2],world(t,i,'trainCarriage')(t.readInt(p[0]),t.readInt(p[1])));},
 GET_CAR_MODEL:(t,p,i)=>{t.writeInt(p[1],(world(t,i,'vehicleModel')(t.readInt(p[0]))??0) as number);},
 SET_CAR_COLLISION:(t,p,i)=>{world(t,i,'setVehicleCollision')(t.readInt(p[0]),bool(t,p[1]));},
 SET_CAR_ENGINE_ON:(t,p,i)=>{world(t,i,'setVehicleEngineOn')(t.readInt(p[0]),bool(t,p[1]));},
 POP_CAR_DOOR:(t,p,i)=>{world(t,i,'popVehicleDoor')(t.readInt(p[0]),t.readInt(p[1]),bool(t,p[2]));},
 DETACH_CAR:(t,p,i)=>{
  const point=vec(t,p,1);
  world(t,i,'detachVehicle')(t.readInt(p[0]),point.x,point.y,point.z,bool(t,p[4]));
 },
 CONTROL_CAR_DOOR:(t,p,i)=>{
  world(t,i,'controlVehicleDoor')(t.readInt(p[0]),t.readInt(p[1]),t.readInt(p[2]),t.readFloat(p[3]));
 },
 SET_CAR_WATERTIGHT:(t,p,i)=>{world(t,i,'setVehicleWatertight')(t.readInt(p[0]),bool(t,p[1]));},
 GET_NUMBER_OF_PASSENGERS:(t,p,i)=>{t.writeInt(p[1],world(t,i,'vehiclePassengerCount')(t.readInt(p[0])));},
 ATTACH_CAR_TO_CAR:(t,p,i)=>{
  world(t,i,'attachVehicleToVehicle')(t.readInt(p[0]),t.readInt(p[1]),vec(t,p,2),vec(t,p,5));
 },
 VEHICLE_CAN_BE_TARGETTED_BY_HS_MISSILE:(t,p,i)=>{
  world(t,i,'vehicleCanBeTargettedByHomingMissile')(t.readInt(p[0]),bool(t,p[1]));
 },
 DONT_SUPPRESS_CAR_MODEL:(t,p,i)=>{
  const chosen=model(t,i,p[0]);
  game(t,i).suppressedCarModels.delete(chosen);
  t.host?.world?.dontSuppressVehicleModel?.(chosen);
 },
 EXPLODE_CAR_IN_CUTSCENE:(t,p,i)=>{world(t,i,'explodeVehicleInCutscene')(t.readInt(p[0]));},
 OPEN_CAR_DOOR_A_BIT:(t,p,i)=>{
  world(t,i,'openVehicleDoorABit')(t.readInt(p[0]),t.readInt(p[1]),t.readFloat(p[2]));
 },
 SET_PLANE_THROTTLE:(t,p,i)=>{world(t,i,'setPlaneThrottle')(t.readInt(p[0]),t.readFloat(p[1]));},
 PLANE_STARTS_IN_AIR:(t,p,i)=>{world(t,i,'planeStartsInAir')(t.readInt(p[0]));},
 SET_PLANE_UNDERCARRIAGE_UP:(t,p,i)=>{world(t,i,'setPlaneUndercarriageUp')(t.readInt(p[0]),bool(t,p[1]));},
 // The box a car must be inside, in all three axes this time.
 IS_CAR_IN_AREA_3D:(t,p,i)=>{
  const position=world(t,i,'vehiclePosition')(t.readInt(p[0]));
  const a=vec(t,p,1),b=vec(t,p,4);
  const inside=position.x>=Math.min(a.x,b.x)&&position.x<=Math.max(a.x,b.x)
   &&position.y>=Math.min(a.y,b.y)&&position.y<=Math.max(a.y,b.y)
   &&position.z>=Math.min(a.z,b.z)&&position.z<=Math.max(a.z,b.z);
  t.updateCompareFlag(inside,negated(i));
 },
 /* --- The objects of the tail. */
 SET_OBJECT_RECORDS_COLLISIONS:(t,p,i)=>{world(t,i,'setObjectRecordsCollisions')(t.readInt(p[0]),bool(t,p[1]));},
 GET_OBJECT_SPEED:(t,p,i)=>{t.writeFloat(p[1],world(t,i,'objectSpeed')(t.readInt(p[0])));},
 ADD_TO_OBJECT_VELOCITY:(t,p,i)=>{
  const velocity=vec(t,p,1);
  world(t,i,'addToObjectVelocity')(t.readInt(p[0]),velocity.x,velocity.y,velocity.z);
 },
 ATTACH_OBJECT_TO_OBJECT:(t,p,i)=>{
  world(t,i,'attachObjectToObject')(t.readInt(p[0]),t.readInt(p[1]),vec(t,p,2),vec(t,p,5));
 },
 SET_ROPE_HEIGHT_FOR_OBJECT:(t,p,i)=>{world(t,i,'setRopeHeightForObject')(t.readInt(p[0]),t.readFloat(p[1]));},
 SET_USES_COLLISION_OF_CLOSEST_OBJECT_OF_TYPE:(t,p,i)=>{
  const point=vec(t,p,0);
  world(t,i,'setUsesCollisionOfClosestObjectOfType')(point.x,point.y,point.z,t.readFloat(p[3]),model(t,i,p[4]),bool(t,p[5]));
 },
 /* --- The peds, players and groups of the tail. */
 SET_CHAR_COORDINATES_NO_OFFSET:(t,p,i)=>{
  const point=vec(t,p,1);
  world(t,i,'setPedCoordinatesNoOffset')(t.readInt(p[0]),point.x,point.y,point.z);
 },
 IS_CHAR_TALKING:(t,p,i)=>{t.updateCompareFlag(world(t,i,'pedIsTalking')(t.readInt(p[0])),negated(i));},
 IS_CHAR_SWIMMING:(t,p,i)=>{t.updateCompareFlag(world(t,i,'pedIsSwimming')(t.readInt(p[0])),negated(i));},
 IS_PLAYER_USING_JETPACK:(t,p,i)=>{t.updateCompareFlag(world(t,i,'playerIsUsingJetpack')(t.readInt(p[0])),negated(i));},
 SET_GROUP_SEPARATION_RANGE:(t,p,i)=>{world(t,i,'setGroupSeparationRange')(t.readInt(p[0]),t.readFloat(p[1]));},
 CLEAR_AREA_OF_CHARS:(t,p,i)=>{world(t,i,'clearAreaOfPeds')(vec(t,p,0),vec(t,p,3));},
 SET_CREATE_RANDOM_GANG_MEMBERS:(t,p,i)=>{game(t,i).population.dontCreateRandomGangMembers=!bool(t,p[0]);},
 SET_GANG_WARS_ACTIVE:(t,p,i)=>{world(t,i,'setGangWarsActive')(bool(t,p[0]));},
 /* --- The searchlight, the line of sight, and the rest of the world. */
 POINT_SEARCHLIGHT_AT_CHAR:(t,p,i)=>{
  world(t,i,'pointSearchlightAtPed')(t.readInt(p[0]),t.readInt(p[1]),t.readFloat(p[2]));
 },
 // The five flags name what the line may be stopped by: buildings, vehicles, peds, objects and particles.
 IS_LINE_OF_SIGHT_CLEAR:(t,p,i)=>{
  t.updateCompareFlag(world(t,i,'lineOfSightIsClear')(vec(t,p,0),vec(t,p,3),
   {buildings:bool(t,p[6]),vehicles:bool(t,p[7]),peds:bool(t,p[8]),objects:bool(t,p[9]),particles:bool(t,p[10])}),negated(i));
 },
 GET_BEAT_TRACK_STATUS:(t,p,i)=>{t.writeInt(p[0],world(t,i,'beatTrackStatus')());},
 STOP_BEAT_TRACK:(t,_p,i)=>{world(t,i,'stopBeatTrack')();},
 // The PC build answers nought (reVC's GTA_PC branch without DETECT_PAD_INPUT_SWITCH): keyboard and mouse.
 GET_CONTROLLER_MODE:(t,p)=>{t.writeInt(p[0],0);},
 SWITCH_AMBIENT_PLANES:(t,p,i)=>{world(t,i,'switchAmbientPlanes')(bool(t,p[0]));},
 SYNC_WATER:(t,_p,i)=>{world(t,i,'syncWater')();},
 DRAW_SPHERE:(t,p,i)=>{
  const point=vec(t,p,0);world(t,i,'drawSphere')(point.x,point.y,point.z,t.readFloat(p[3]));
 },
 REMOVE_USER_3D_MARKER:(t,p,i)=>{world(t,i,'removeUser3dMarker')(t.readInt(p[0]));},
 REGISTER_FASTEST_TIME:(t,p,i)=>{world(t,i,'registerFastestTime')(t.readInt(p[0]),t.readInt(p[1]));},
 SET_UP_SKIP:(t,p,i)=>{
  const point=vec(t,p,0);world(t,i,'setUpSkip')(point.x,point.y,point.z,t.readFloat(p[3]));
 },
 SET_MENU_ITEM_WITH_2_NUMBERS:(t,p,i)=>{
  world(t,i,'setMenuItemWithTwoNumbers')(t.readInt(p[0]),t.readInt(p[1]),t.readInt(p[2]),t.text(p[3]),
   t.readInt(p[4]),t.readInt(p[5]));
 },
 /* --- The last batch. STREAM_SCRIPT asks the streamer for a file the script names by its own index, which the
  * registry translates the same way the loaded question does. */
 STREAM_SCRIPT:(t,p,i)=>{
  const scripts=game(t,i).streamedScripts,index=scripts.properIndexFromScriptIndex(t.readInt(p[0]));
  if(index>=0)t.host?.world?.requestStreamedScript?.(index);
 },
 // One more piece of arithmetic: where two lines cross, which the script reads as a point.
 GET_2D_LINES_INTERSECT_POINT:(t,p,i)=>{
  const ax=t.readFloat(p[0]),ay=t.readFloat(p[1]),bx=t.readFloat(p[2]),by=t.readFloat(p[3]);
  const cx=t.readFloat(p[4]),cy=t.readFloat(p[5]),dx=t.readFloat(p[6]),dy=t.readFloat(p[7]);
  const denominator=(ax-bx)*(cy-dy)-(ay-by)*(cx-dx);
  // Parallel lines never cross, and the source leaves the point where it was rather than dividing by nothing.
  if(denominator!==0){
   const first=ax*by-ay*bx,second=cx*dy-cy*dx;
   t.writeFloat(p[8],(first*(cx-dx)-(ax-bx)*second)/denominator);
   t.writeFloat(p[9],(first*(cy-dy)-(ay-by)*second)/denominator);
  }
 },
 /* --- The last of the tasks. */
 TASK_LOOK_AT_VEHICLE:(t,p,i)=>{
  scriptedTask(t,i,t.readInt(p[0]),{kind:'lookAtVehicle',vehicle:t.readInt(p[1]),time:t.readInt(p[2])});
 },
 TASK_LOOK_AT_OBJECT:(t,p,i)=>{
  scriptedTask(t,i,t.readInt(p[0]),{kind:'lookAtObject',object:t.readInt(p[1]),time:t.readInt(p[2])});
 },
 TASK_WEAPON_ROLL:(t,p,i)=>{scriptedTask(t,i,t.readInt(p[0]),{kind:'weaponRoll',state:bool(t,p[1])});},
 TASK_FALL_AND_GET_UP:(t,p,i)=>{
  scriptedTask(t,i,t.readInt(p[0]),{kind:'fallAndGetUp',state:bool(t,p[1]),time:t.readInt(p[2])});
 },
 TASK_DIVE_AND_GET_UP:(t,p,i)=>{
  scriptedTask(t,i,t.readInt(p[0]),{kind:'diveAndGetUp',x:t.readFloat(p[1]),y:t.readFloat(p[2]),time:t.readInt(p[3])});
 },
 TASK_GOTO_CHAR_OFFSET:(t,p,i)=>{
  scriptedTask(t,i,t.readInt(p[0]),{kind:'gotoPedOffset',target:t.readInt(p[1]),time:t.readInt(p[2]),
   offsetX:t.readFloat(p[3]),offsetY:t.readFloat(p[4])});
 },
 TASK_FOLLOW_FOOTSTEPS:(t,p,i)=>{scriptedTask(t,i,t.readInt(p[0]),{kind:'followFootsteps',target:t.readInt(p[1])});},
 TASK_FLEE_CHAR_ANY_MEANS:(t,p,i)=>{
  scriptedTask(t,i,t.readInt(p[0]),{kind:'fleePedAnyMeans',threat:t.readInt(p[1]),radius:t.readFloat(p[2]),
   time:t.readInt(p[3]),flag:bool(t,p[4]),unknown1:t.readInt(p[5]),unknown2:t.readInt(p[6]),unknown3:t.readFloat(p[7])});
 },
 TASK_SWIM_TO_COORD:(t,p,i)=>{scriptedTask(t,i,t.readInt(p[0]),{kind:'swimToCoord',...vec(t,p,1)});},
 /* --- The last of the vehicles and the aircraft. */
 DOES_GROUP_EXIST:(t,p,i)=>{t.updateCompareFlag(world(t,i,'groupExists')(t.readInt(p[0])),negated(i));},
 IS_TRAILER_ATTACHED_TO_CAB:(t,p,i)=>{
  t.updateCompareFlag(world(t,i,'trailerIsAttachedToCab')(t.readInt(p[0]),t.readInt(p[1])),negated(i));
 },
 SET_OBJECT_COORDINATES_AND_VELOCITY:(t,p,i)=>{
  const point=vec(t,p,1);
  world(t,i,'setObjectCoordinatesAndVelocity')(t.readInt(p[0]),point.x,point.y,point.z);
 },
 FORCE_CAR_LIGHTS:(t,p,i)=>{world(t,i,'forceVehicleLights')(t.readInt(p[0]),t.readInt(p[1]));},
 SET_CAR_CAN_BE_DAMAGED:(t,p,i)=>{world(t,i,'setVehicleCanBeDamaged')(t.readInt(p[0]),bool(t,p[1]));},
 SKIP_TO_END_AND_STOP_PLAYBACK_RECORDED_CAR:(t,p,i)=>{
  world(t,i,'skipToEndAndStopPlaybackRecordedCar')(t.readInt(p[0]));
 },
 CAR_GOTO_COORDINATES_ACCURATE:(t,p,i)=>{
  const point=vec(t,p,1);
  world(t,i,'vehicleGotoCoordinatesAccurate')(t.readInt(p[0]),point.x,point.y,point.z);
 },
 HAS_CAR_BEEN_DAMAGED_BY_CAR:(t,p,i)=>{
  t.updateCompareFlag(world(t,i,'vehicleWasDamagedByVehicle')(t.readInt(p[0]),t.readInt(p[1])),negated(i));
 },
 POP_CAR_BOOT:(t,p,i)=>{world(t,i,'popVehicleBoot')(t.readInt(p[0]));},
 SET_CAR_MODEL_COMPONENTS:(t,p,i)=>{
  world(t,i,'setVehicleModelComponents')(model(t,i,p[0]),t.readInt(p[1]),t.readInt(p[2]));
 },
 GET_CAR_FORWARD_X:(t,p,i)=>{t.writeFloat(p[1],world(t,i,'vehicleForwardX')(t.readInt(p[0])));},
 GET_CAR_FORWARD_Y:(t,p,i)=>{t.writeFloat(p[1],world(t,i,'vehicleForwardY')(t.readInt(p[0])));},
 DELETE_ALL_TRAINS:(t,_p,i)=>{world(t,i,'deleteAllTrains')();},
 MAKE_HELI_COME_CRASHING_DOWN:(t,p,i)=>{world(t,i,'makeHeliComeCrashingDown')(t.readInt(p[0]));},
 // A car stopped inside a box, which is the stopped question and the box test together.
 IS_CAR_STOPPED_IN_AREA_3D:(t,p,i)=>{
  const handle=t.readInt(p[0]);
  const a=vec(t,p,1),b=vec(t,p,4),position=world(t,i,'vehiclePosition')(handle);
  const inside=position.x>=Math.min(a.x,b.x)&&position.x<=Math.max(a.x,b.x)
   &&position.y>=Math.min(a.y,b.y)&&position.y<=Math.max(a.y,b.y)
   &&position.z>=Math.min(a.z,b.z)&&position.z<=Math.max(a.z,b.z);
  t.updateCompareFlag(inside&&world(t,i,'vehicleIsStopped')(handle),negated(i));
 },
 /* --- The searchlights on a vehicle, and the camera hung on one. */
 CREATE_SEARCHLIGHT_ON_VEHICLE:(t,p,i)=>{
  t.writeInt(p[9],world(t,i,'createSearchlightOnVehicle')(t.readInt(p[0]),vec(t,p,1),vec(t,p,4),
   t.readFloat(p[7]),t.readFloat(p[8])));
 },
 MOVE_SEARCHLIGHT_BETWEEN_COORDS:(t,p,i)=>{
  world(t,i,'moveSearchlightBetweenCoords')(t.readInt(p[0]),vec(t,p,1),vec(t,p,4),t.readFloat(p[7]));
 },
 ATTACH_CAMERA_TO_VEHICLE:(t,p,i)=>{
  world(t,i,'attachCameraToVehicle')(t.readInt(p[0]),vec(t,p,1),vec(t,p,4),t.readFloat(p[7]),t.readInt(p[8]));
 },
 ATTACH_CAMERA_TO_VEHICLE_LOOK_AT_VEHICLE:(t,p,i)=>{
  world(t,i,'attachCameraToVehicleLookAtVehicle')(t.readInt(p[0]),vec(t,p,1),t.readInt(p[4]),
   t.readFloat(p[5]),t.readInt(p[6]));
 },
 /* --- The peds, objects and world of the last batch. */
 SET_CHAR_USES_UPPERBODY_DAMAGE_ANIMS_ONLY:(t,p,i)=>{
  world(t,i,'setPedUsesUpperbodyDamageAnimsOnly')(t.readInt(p[0]),bool(t,p[1]));
 },
 SET_PLAYER_GROUP_TO_FOLLOW_NEVER:(t,p,i)=>{world(t,i,'setPlayerGroupToFollowNever')(t.readInt(p[0]),bool(t,p[1]));},
 HAS_OBJECT_COLLIDED_WITH_ANYTHING:(t,p,i)=>{
  t.updateCompareFlag(world(t,i,'objectHasCollidedWithAnything')(t.readInt(p[0])),negated(i));
 },
 IS_OBJECT_ON_SCREEN:(t,p,i)=>{t.updateCompareFlag(world(t,i,'objectIsOnScreen')(t.readInt(p[0])),negated(i));},
 IS_ANY_PICKUP_AT_COORDS:(t,p,i)=>{
  const point=vec(t,p,0);
  t.updateCompareFlag(world(t,i,'anyPickupAtCoords')(point.x,point.y,point.z),negated(i));
 },
 IS_THIS_MODEL_A_BOAT:(t,p,i)=>{t.updateCompareFlag(world(t,i,'modelIsBoat')(model(t,i,p[0])),negated(i));},
 IS_THIS_MODEL_A_HELI:(t,p,i)=>{t.updateCompareFlag(world(t,i,'modelIsHeli')(model(t,i,p[0])),negated(i));},
 IS_THIS_MODEL_A_PLANE:(t,p,i)=>{t.updateCompareFlag(world(t,i,'modelIsPlane')(model(t,i,p[0])),negated(i));},
 ENABLE_ENTRY_EXIT_PLAYER_GROUP_WARPING:(t,p,i)=>{
  world(t,i,'enableEntryExitPlayerGroupWarping')(t.readFloat(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),bool(t,p[3]));
 },
 SWITCH_STREAMING:(t,p,i)=>{world(t,i,'switchStreaming')(bool(t,p[0]));},
 SET_AREA51_SAM_SITE:(t,p,i)=>{world(t,i,'setArea51SamSite')(bool(t,p[0]));},
 SWITCH_POLICE_HELIS:(t,p,i)=>{world(t,i,'switchPoliceHelis')(bool(t,p[0]));},
 DISPLAY_ONSCREEN_TIMER:(t,p,i)=>{game(t,i).onscreenTimer.addClock(t.globalOffset(p[0]),undefined,t.readInt(p[1]));},
 CLEAR_EXTRA_COLOURS:(t,p,i)=>{world(t,i,'clearExtraColours')(bool(t,p[0]));},
 // The wanted ceiling the script set, read back from the runtime's own field.
 GET_MAX_WANTED_LEVEL:(t,p,i)=>{t.writeInt(p[0],game(t,i).maximumWantedLevel);},
 /* --- The remaining tail. */
 REMOVE_SPHERE:(t,p,i)=>{world(t,i,'removeSphere')(t.readInt(p[0]));},
 START_CAR_FIRE:(t,p,i)=>{t.writeInt(p[1],world(t,i,'startVehicleFire')(t.readInt(p[0])));},
 FIND_MAX_NUMBER_OF_GROUP_MEMBERS:(t,p,i)=>{t.writeInt(p[0],world(t,i,'maxGroupMembers')());},
 ARE_MEASUREMENTS_IN_METRES:(t,_p,i)=>{t.updateCompareFlag(world(t,i,'measurementsAreInMetres')(),negated(i));},
 IS_GERMAN_GAME:(t,_p,i)=>{t.updateCompareFlag(world(t,i,'gameIsGerman')(),negated(i));},
 FORCE_BIG_MESSAGE_AND_COUNTER:(t,p,i)=>{world(t,i,'forceBigMessageAndCounter')(bool(t,p[0]));},
 RELEASE_ENTITY_FROM_ROPE_FOR_OBJECT:(t,p,i)=>{world(t,i,'releaseEntityFromRopeForObject')(t.readInt(p[0]));},
 RESET_VEHICLE_HYDRAULICS:(t,p,i)=>{world(t,i,'resetVehicleHydraulics')(t.readInt(p[0]));},
 // The three node lookups, which give back a point and, for one of them, the heading to face along it.
 GET_CLOSEST_CAR_NODE:(t,p,i)=>{
  const point=vec(t,p,0),node=world(t,i,'closestVehicleNode')(point.x,point.y,point.z);
  t.writeFloat(p[3],node.x);t.writeFloat(p[4],node.y);t.writeFloat(p[5],node.z);
 },
 GET_NTH_CLOSEST_CAR_NODE:(t,p,i)=>{
  const point=vec(t,p,0);
  if(point.z<=ScmCamera.MAP_Z_LOW_LIMIT)point.z=world(t,i,'groundZForCoord')(point.x,point.y);
  const node=world(t,i,'nthClosestVehicleNode')(point.x,point.y,point.z,t.readInt(p[3]));
  t.writeFloat(p[4],node.x);t.writeFloat(p[5],node.y);t.writeFloat(p[6],node.z);
 },
 GET_CLOSEST_CAR_NODE_WITH_HEADING:(t,p,i)=>{
  const point=vec(t,p,0),node=world(t,i,'closestVehicleNodeWithHeading')(point.x,point.y,point.z);
  t.writeFloat(p[3],node.x);t.writeFloat(p[4],node.y);t.writeFloat(p[5],node.z);t.writeFloat(p[6],node.heading);
 },
 IS_CAR_WAITING_FOR_WORLD_COLLISION:(t,p,i)=>{
  t.updateCompareFlag(world(t,i,'vehicleIsWaitingForWorldCollision')(t.readInt(p[0])),negated(i));
 },
 FIX_CAR_DOOR:(t,p,i)=>{world(t,i,'fixVehicleDoor')(t.readInt(p[0]),t.readInt(p[1]));},
 POP_CAR_PANEL:(t,p,i)=>{world(t,i,'popVehiclePanel')(t.readInt(p[0]),t.readInt(p[1]),bool(t,p[2]));},
 IS_CHAR_IN_AIR:(t,p,i)=>{t.updateCompareFlag(world(t,i,'pedIsInAir')(t.readInt(p[0])),negated(i));},
 SET_VEHICLE_AIR_RESISTANCE_MULTIPLIER:(t,p,i)=>{
  world(t,i,'setVehicleAirResistanceMultiplier')(t.readInt(p[0]),t.readFloat(p[1]));
 },
 IS_GANG_WAR_GOING_ON:(t,_p,i)=>{t.updateCompareFlag(world(t,i,'gangWarIsGoingOn')(),negated(i));},
 SET_VEHICLE_IS_CONSIDERED_BY_PLAYER:(t,p,i)=>{
  world(t,i,'setVehicleIsConsideredByPlayer')(t.readInt(p[0]),bool(t,p[1]));
 },
 GET_CAR_ROLL:(t,p,i)=>{t.writeFloat(p[1],world(t,i,'vehicleRoll')(t.readInt(p[0])));},
 // CVehicle's respray permission and CGarages::RespraysAreFree: only a Pay 'n' Spray reads them, and none is ported.
 SET_CAN_RESPRAY_CAR:(t,p,i)=>{game(t,i).resprayForbidden[bool(t,p[1])?'delete':'add'](t.readInt(p[0]));},
 IS_CAR_VISIBLY_DAMAGED:(t,p,i)=>{t.updateCompareFlag(world(t,i,'vehicleIsVisiblyDamaged')(t.readInt(p[0])),negated(i));},
 IMPROVE_CAR_BY_CHEATING:(t,p,i)=>{world(t,i,'improveVehicleByCheating')(t.readInt(p[0]),bool(t,p[1]));},
 SET_BOAT_CRUISE_SPEED:(t,p,i)=>{world(t,i,'setBoatCruiseSpeed')(t.readInt(p[0]),t.readFloat(p[1]));},
 SET_MESSAGE_FORMATTING:(t,p,i)=>{
  world(t,i,'setMessageFormatting')(bool(t,p[0]),t.readInt(p[1]),t.readInt(p[2]));
 },
 HELI_FOLLOW_ENTITY:(t,p,i)=>{
  world(t,i,'heliFollowEntity')(t.readInt(p[0]),t.readInt(p[1]),t.readInt(p[2]),t.readFloat(p[3]));
 },
 SET_SEARCHLIGHT_CLIP_IF_COLLIDING:(t,p,i)=>{
  world(t,i,'setSearchlightClipIfColliding')(t.readInt(p[0]),bool(t,p[1]));
 },
 // The occupied question names five kinds of thing that may be standing in the box, as the line of sight does.
 IS_AREA_OCCUPIED:(t,p,i)=>{
  t.updateCompareFlag(world(t,i,'areaIsOccupied')(vec(t,p,0),vec(t,p,3),
   {solid:bool(t,p[6]),vehicles:bool(t,p[7]),peds:bool(t,p[8]),objects:bool(t,p[9]),particles:bool(t,p[10])}),negated(i));
 },
 CREATE_FX_SYSTEM_ON_CAR_WITH_DIRECTION:(t,p,i)=>{
  t.writeInt(p[9],world(t,i,'createFxSystemOnVehicleWithDirection')(t.text(p[0]),t.readInt(p[1]),
   vec(t,p,2),vec(t,p,5),bool(t,p[8])));
 },
 CONTROL_MOVABLE_VEHICLE_PART:(t,p,i)=>{world(t,i,'controlMovableVehiclePart')(t.readInt(p[0]),t.readFloat(p[1]));},
 SET_ALWAYS_DRAW_3D_MARKERS:(t,p,i)=>{world(t,i,'setAlwaysDraw3dMarkers')(bool(t,p[0]));},
 IS_OBJECT_STATIC:(t,p,i)=>{t.updateCompareFlag(world(t,i,'objectIsStatic')(t.readInt(p[0])),negated(i));},
 SET_CAR_STAY_IN_SLOW_LANE:(t,p,i)=>{world(t,i,'setVehicleStayInSlowLane')(t.readInt(p[0]),bool(t,p[1]));},
 SET_MENU_COLUMN_WIDTH:(t,p,i)=>{world(t,i,'setMenuColumnWidth')(t.readInt(p[0]),t.readInt(p[1]),t.readInt(p[2]));},
 CREATE_USER_3D_MARKER:(t,p,i)=>{
  const point=vec(t,p,0);
  t.writeInt(p[4],world(t,i,'createUser3dMarker')(point.x,point.y,point.z,t.readInt(p[3])));
 },
 SET_EXTRA_COLOURS:(t,p,i)=>{world(t,i,'setExtraColours')(t.readInt(p[0]),bool(t,p[1]));},
 GET_BEAT_PROXIMITY:(t,p,i)=>{
  const beat=world(t,i,'beatProximity')(t.readInt(p[0]));
  t.writeInt(p[1],beat.first);t.writeInt(p[2],beat.second);t.writeInt(p[3],beat.third);
 },
 // A model's own bounds, given as two opposite corners.
 GET_MODEL_DIMENSIONS:(t,p,i)=>{
  const bounds=world(t,i,'modelDimensions')(model(t,i,p[0]));
  t.writeFloat(p[1],bounds.min.x);t.writeFloat(p[2],bounds.min.y);t.writeFloat(p[3],bounds.min.z);
  t.writeFloat(p[4],bounds.max.x);t.writeFloat(p[5],bounds.max.y);t.writeFloat(p[6],bounds.max.z);
 },
 PRELOAD_BEAT_TRACK:(t,p,i)=>{world(t,i,'preloadBeatTrack')(t.readInt(p[0]));},
 DELETE_MISSION_TRAINS:(t,_p,i)=>{world(t,i,'deleteMissionTrains')();},
 SET_HELP_MESSAGE_BOX_SIZE:(t,p,i)=>{world(t,i,'setHelpMessageBoxSize')(t.readInt(p[0]));},
 IS_CHAR_HEAD_MISSING:(t,p,i)=>{t.updateCompareFlag(world(t,i,'pedHeadIsMissing')(t.readInt(p[0])),negated(i));},
 SWITCH_COPS_ON_BIKES:(t,p,i)=>{world(t,i,'switchCopsOnBikes')(bool(t,p[0]));},
 // The group size gives back both how many follow and who leads.
 GET_GROUP_SIZE:(t,p,i)=>{
  const size=world(t,i,'groupSize')(t.readInt(p[0]));
  t.writeInt(p[1],size.members);t.writeInt(p[2],size.leader);
 },
 IS_PROJECTILE_IN_AREA:(t,p,i)=>{
  t.updateCompareFlag(world(t,i,'projectileIsInArea')(vec(t,p,0),vec(t,p,3)),negated(i));
 },
 CREATE_EMERGENCY_SERVICES_CAR:(t,p,i)=>{
  const point=vec(t,p,1);
  world(t,i,'createEmergencyServicesVehicle')(model(t,i,p[0]),point.x,point.y,point.z);
 },
 IS_OBJECT_IN_WATER:(t,p,i)=>{t.updateCompareFlag(world(t,i,'objectIsInWater')(t.readInt(p[0])),negated(i));},
 GET_WATER_HEIGHT_AT_COORDS:(t,p,i)=>{
  t.writeFloat(p[3],world(t,i,'waterHeightAtCoords')(t.readFloat(p[0]),t.readFloat(p[1]),bool(t,p[2])));
 },
 MARK_MISSION_TRAIN_AS_NO_LONGER_NEEDED:(t,p,i)=>{world(t,i,'markMissionTrainAsNoLongerNeeded')(t.readInt(p[0]));},
 SET_CAR_FOLLOW_CAR:(t,p,i)=>{
  world(t,i,'setVehicleFollowVehicle')(t.readInt(p[0]),t.readInt(p[1]),t.readFloat(p[2]));
 },
 DOES_CAR_HAVE_STUCK_CAR_CHECK:(t,p,i)=>{t.updateCompareFlag(game(t,i).stuckCars.has(t.readInt(p[0])),negated(i));},
 // The plain colours are the first two of the four the vehicle carries.
 GET_CAR_COLOURS:(t,p,i)=>{
  const colours=world(t,i,'vehicleColours')(t.readInt(p[0]));
  t.writeInt(p[1],colours.primary);t.writeInt(p[2],colours.secondary);
 },
 SET_TAXI_LIGHTS:(t,p,i)=>{world(t,i,'setTaxiLights')(t.readInt(p[0]),bool(t,p[1]));},
 ADD_BLIP_FOR_SEARCHLIGHT:(t,p,i)=>{t.writeInt(p[1],world(t,i,'addBlipForSearchlight')(t.readInt(p[0])));},
 /* --- The last three tasks. */
 TASK_LEAVE_CAR_AND_FLEE:(t,p,i)=>{
  const point=vec(t,p,2);
  scriptedTask(t,i,t.readInt(p[0]),{kind:'leaveCarAndFlee',vehicle:t.readInt(p[1]),...point});
 },
 TASK_GOTO_CAR:(t,p,i)=>{
  scriptedTask(t,i,t.readInt(p[0]),{kind:'gotoCar',vehicle:t.readInt(p[1]),time:t.readInt(p[2]),radius:t.readFloat(p[3])});
 },
 TASK_DEAD:(t,p,i)=>{scriptedTask(t,i,t.readInt(p[0]),{kind:'dead'});},
 /* The three commands that hand back a name rather than a number. They needed a way to write a text label
  * into a script variable, which the string reader's own storage already knew how to address; the label is
  * eight characters and is padded with nothing after the name, as every other label in the file is. */
 GET_NAME_OF_ZONE:(t,p,i)=>{
  const point=vec(t,p,0);
  t.writeTextLabel(p[3],world(t,i,'getNameOfZone')(point.x,point.y,point.z));
 },
 GET_NAME_OF_ENTRY_EXIT_CHAR_USED:(t,p,i)=>{
  t.writeTextLabel(p[1],world(t,i,'getNameOfEntryExitCharUsed')(t.readInt(p[0])));
 },
 // CShopping behind the shop scripts (LOAD_PRICES 0x075D to HAS_PLAYER_BOUGHT_ITEM 0x0942): each handler is an
 // unreversed wrapper of the reversed routine it names.
 GET_LOADED_SHOP:(t,p,i)=>{t.writeTextLabel(p[0],game(t,i).shopping.shopLoaded);},
 LOAD_PRICES:(t,p,i)=>{game(t,i).shopping.loadPrices(t.text(p[0]));},
 LOAD_SHOP:(t,p,i)=>{game(t,i).shopping.loadShop(t.text(p[0]));},
 GET_NUMBER_OF_ITEMS_IN_SHOP:(t,p,i)=>{t.writeInt(p[0],game(t,i).shopping.numItemsInShop);},
 GET_ITEM_IN_SHOP:(t,p,i)=>{t.writeInt(p[1],game(t,i).shopping.itemInShop(t.readInt(p[0]))|0);},
 GET_PRICE_OF_ITEM:(t,p,i)=>{t.writeInt(p[1],game(t,i).shopping.price(t.readInt(p[0])));},
 GET_SHOPPING_EXTRA_INFO:(t,p,i)=>{t.writeInt(p[2],game(t,i).shopping.extraInfo(t.readInt(p[0]),t.readInt(p[1]))|0);},
 GET_NAME_OF_ITEM:(t,p,i)=>{t.writeTextLabel(p[1],game(t,i).shopping.nameTag(t.readInt(p[0])));},
 BUY_ITEM:(t,p,i)=>{const state=game(t,i);state.shopping.buy(state,t.readInt(p[0]));},
 ADD_PRICE_MODIFIER:(t,p,i)=>{game(t,i).shopping.addPriceModifier(t.readInt(p[0]),t.readInt(p[1]));},
 REMOVE_PRICE_MODIFIER:(t,p,i)=>{game(t,i).shopping.removePriceModifier(t.readInt(p[0]));},
 HAS_PLAYER_BOUGHT_ITEM:(t,p,i)=>{t.updateCompareFlag(game(t,i).shopping.hasPlayerBought(t.readInt(p[0])),negated(i));},
 /* --- The last of the script's commands, generated from the pinned schema by the rule its own types give:
  * a float operand reads a float, a bool reads a bool, a string reads a string, a model reads a model and
  * everything else reads an integer; a command the schema marks as a condition sets the compare flag, and one
  * with outputs writes them into the operands after its inputs. */
 SET_CAR_STAY_IN_FAST_LANE:(t,p,i)=>{world(t,i,'setCarStayInFastLane')(t.readInt(p[0]),bool(t,p[1]));},
 IS_VEHICLE_ATTACHED:(t,p,i)=>{t.updateCompareFlag(world(t,i,'isVehicleAttached')(t.readInt(p[0])),negated(i));},
 ACTIVATE_MENU_ITEM:(t,p,i)=>{world(t,i,'activateMenuItem')(t.readInt(p[0]),t.readInt(p[1]),bool(t,p[2]));},
 ATTACH_TRAILER_TO_CAB:(t,p,i)=>{world(t,i,'attachTrailerToCab')(t.readInt(p[0]),t.readInt(p[1]));},
 TASK_TIRED:(t,p,i)=>{world(t,i,'taskTired')(t.readInt(p[0]),t.readInt(p[1]));},
 WINCH_CAN_PICK_VEHICLE_UP:(t,p,i)=>{world(t,i,'winchCanPickVehicleUp')(t.readInt(p[0]),bool(t,p[1]));},
 SET_NIGHT_VISION:(t,p,i)=>{world(t,i,'setNightVision')(bool(t,p[0]));},
 SET_AIRCRAFT_CARRIER_SAM_SITE:(t,p,i)=>{world(t,i,'setAircraftCarrierSamSite')(bool(t,p[0]));},
 CREATE_SCRIPT_ROADBLOCK:(t,p,i)=>{world(t,i,'createScriptRoadblock')(t.readFloat(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),t.readFloat(p[4]),t.readFloat(p[5]),t.readInt(p[6]));},
 PRINT_STRING_IN_STRING_NOW:(t,p,i)=>{world(t,i,'printStringInStringNow')(t.text(p[0]),t.text(p[1]),t.readInt(p[2]),t.readInt(p[3]));},
 IS_GANG_WAR_FIGHTING_GOING_ON:(t,p,i)=>{t.updateCompareFlag(world(t,i,'isGangWarFightingGoingOn')(),negated(i));},
 CONVERT_METRES_TO_FEET:(t,p,i)=>{t.writeFloat(p[1],world(t,i,'convertMetresToFeet')(t.readFloat(p[0])));},
 GET_LEVEL_DESIGN_COORDS_FOR_OBJECT:(t,p,i)=>{const result=world(t,i,'getLevelDesignCoordsForObject')(t.readInt(p[0]),t.readInt(p[1]));t.writeFloat(p[2],result.x);t.writeFloat(p[3],result.y);t.writeFloat(p[4],result.z);},
 IS_CHAR_ATTACHED_TO_ANY_CAR:(t,p,i)=>{t.updateCompareFlag(world(t,i,'isCharAttachedToAnyCar')(t.readInt(p[0])),negated(i));},
 SET_ACTIVE_MENU_ITEM:(t,p,i)=>{world(t,i,'setActiveMenuItem')(t.readInt(p[0]),t.readInt(p[1]));},
 GET_CAR_MODEL_VALUE:(t,p,i)=>{t.writeInt(p[1],world(t,i,'getCarModelValue')(model(t,i,p[0])));},
 COPY_SHARED_CHAR_DECISION_MAKER:(t,p,i)=>{const {handle,from}=game(t,i).decisionMakers.copy(t.readInt(p[0]),t.usesMissionCleanup);t.writeInt(p[1],handle);t.host?.world?.seedDecisionMaker?.(handle,from);},
 PLAY_BEAT_TRACK:(t,p,i)=>{world(t,i,'playBeatTrack')();},
 SET_OBJECT_ROTATION_VELOCITY:(t,p,i)=>{world(t,i,'setObjectRotationVelocity')(t.readInt(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]));},
 LOCATE_STOPPED_CAR_2D:(t,p,i)=>{t.updateCompareFlag(world(t,i,'locateStoppedCar2d')(t.readInt(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),t.readFloat(p[4]),bool(t,p[5])),negated(i));},
 TASK_SHAKE_FIST:(t,p,i)=>{world(t,i,'taskShakeFist')(t.readInt(p[0]));},
 DRAW_CROSSHAIR:(t,p,i)=>{world(t,i,'drawCrosshair')(bool(t,p[0]));},
 GET_CAR_SPEED_VECTOR:(t,p,i)=>{const result=world(t,i,'getCarSpeedVector')(t.readInt(p[0]));t.writeFloat(p[1],result.x);t.writeFloat(p[2],result.y);t.writeFloat(p[3],result.z);},
 ADD_BLOOD:(t,p,i)=>{world(t,i,'addBlood')(t.readFloat(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),t.readFloat(p[4]),t.readFloat(p[5]),t.readInt(p[6]),t.readInt(p[7]));},
 DRAW_CORONA:(t,p,i)=>{world(t,i,'drawCorona')(t.readFloat(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),t.readInt(p[4]),t.readInt(p[5]),t.readInt(p[6]),t.readInt(p[7]),t.readInt(p[8]));},
 MARK_MISSION_TRAINS_AS_NO_LONGER_NEEDED:(t,p,i)=>{world(t,i,'markMissionTrainsAsNoLongerNeeded')();},
 REQUEST_VEHICLE_MOD:(t,p,i)=>{world(t,i,'requestVehicleMod')(model(t,i,p[0]));},
 ADD_VEHICLE_MOD:(t,p,i)=>{t.writeInt(p[2],world(t,i,'addVehicleMod')(t.readInt(p[0]),model(t,i,p[1])));},
 SET_CHAR_FORCE_DIE_IN_CAR:(t,p,i)=>{world(t,i,'setCharForceDieInCar')(t.readInt(p[0]),bool(t,p[1]));},
 UNMARK_ALL_ROAD_NODES_AS_DONT_WANDER:(t,p,i)=>{world(t,i,'unmarkAllRoadNodesAsDontWander')();},
 FIRE_SINGLE_BULLET:(t,p,i)=>{world(t,i,'fireSingleBullet')(t.readFloat(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),t.readFloat(p[4]),t.readFloat(p[5]),t.readInt(p[6]));},
 GIVE_VEHICLE_PAINTJOB:(t,p,i)=>{world(t,i,'giveVehiclePaintjob')(t.readInt(p[0]),t.readInt(p[1]));},
 SET_DRUNK_INPUT_DELAY:(t,p,i)=>{world(t,i,'setDrunkInputDelay')(t.readInt(p[0]),t.readInt(p[1]));},
 TASK_CHAR_SLIDE_TO_COORD:(t,p,i)=>{world(t,i,'taskCharSlideToCoord')(t.readInt(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),t.readFloat(p[4]),t.readFloat(p[5]));},
 GET_CHAR_HIGHEST_PRIORITY_EVENT:(t,p,i)=>{t.writeInt(p[1],world(t,i,'getCharHighestPriorityEvent')(t.readInt(p[0])));},
 LOCATE_OBJECT_2D:(t,p,i)=>{t.updateCompareFlag(world(t,i,'locateObject2d')(t.readInt(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),t.readFloat(p[4]),bool(t,p[5])),negated(i));},
 ATTACH_CAR_TO_OBJECT:(t,p,i)=>{world(t,i,'attachCarToObject')(t.readInt(p[0]),t.readInt(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),t.readFloat(p[4]),t.readFloat(p[5]),t.readFloat(p[6]),t.readFloat(p[7]));},
 FIX_CAR_TYRE:(t,p,i)=>{world(t,i,'fixCarTyre')(t.readInt(p[0]),t.readInt(p[1]));},
 HAS_CAR_BEEN_DAMAGED_BY_WEAPON:(t,p,i)=>{
  const last=world(t,i,'vehicleLastWeaponDamage')(t.readInt(p[0])),wanted=t.readInt(p[1]);
  t.updateCompareFlag(wanted===WEAPON_ANYMELEE||wanted===WEAPON_ANYWEAPON?checkDamagedWeaponType(last,wanted):last>=0&&last===wanted,negated(i));
 },
 GET_CITY_FROM_COORDS:(t,p,i)=>{t.writeInt(p[3],world(t,i,'getCityFromCoords')(t.readFloat(p[0]),t.readFloat(p[1]),t.readFloat(p[2])));},
 SET_HELI_STABILISER:(t,p,i)=>{world(t,i,'setHeliStabiliser')(t.readInt(p[0]),bool(t,p[1]));},
 GET_CHAR_HEIGHT_ABOVE_GROUND:(t,p,i)=>{t.writeFloat(p[1],world(t,i,'getCharHeightAboveGround')(t.readInt(p[0])));},
 FORCE_INTERIOR_LIGHTING_FOR_PLAYER:(t,p,i)=>{world(t,i,'forceInteriorLightingForPlayer')(t.readInt(p[0]),bool(t,p[1]));},
 PLAYER_TAKE_OFF_GOGGLES:(t,p,i)=>{world(t,i,'playerTakeOffGoggles')(t.readInt(p[0]),bool(t,p[1]));},
 IS_CAR_STOPPED_IN_AREA_2D:(t,p,i)=>{t.updateCompareFlag(world(t,i,'isCarStoppedInArea2d')(t.readInt(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),t.readFloat(p[4]),bool(t,p[5])),negated(i));},
 GET_CAR_UPRIGHT_VALUE:(t,p,i)=>{t.writeFloat(p[1],world(t,i,'getCarUprightValue')(t.readInt(p[0])));},
 SET_MENU_COLUMN_ORIENTATION:(t,p,i)=>{world(t,i,'setMenuColumnOrientation')(t.readInt(p[0]),t.readInt(p[1]),t.readInt(p[2]));},
 CLEAR_ATTRACTOR:(t,p,i)=>{world(t,i,'clearAttractor')(t.readInt(p[0]));},
 GET_CAR_MOVING_COMPONENT_OFFSET:(t,p,i)=>{t.writeFloat(p[1],world(t,i,'getCarMovingComponentOffset')(t.readInt(p[0])));},
 GET_TERRITORY_UNDER_CONTROL_PERCENTAGE:(t,p,i)=>{t.writeInt(p[0],world(t,i,'getTerritoryUnderControlPercentage')());},
 IS_THIS_HELP_MESSAGE_BEING_DISPLAYED:(t,p,i)=>{t.updateCompareFlag(world(t,i,'isThisHelpMessageBeingDisplayed')(t.text(p[0])),negated(i));},
 IS_CAR_UPRIGHT:(t,p,i)=>{t.updateCompareFlag(world(t,i,'isCarUpright')(t.readInt(p[0])),negated(i));},
 GET_STRING_WIDTH:(t,p,i)=>{t.writeInt(p[1],world(t,i,'getStringWidth')(t.text(p[0])));},
 SET_SCRIPT_COOP_GAME:(t,p,i)=>{world(t,i,'setScriptCoopGame')(bool(t,p[0]));},
 CLEAR_OBJECT_LAST_WEAPON_DAMAGE:(t,p,i)=>{world(t,i,'clearObjectLastWeaponDamage')(t.readInt(p[0]));},
 SET_OBJECT_TURN_MASS:(t,p,i)=>{world(t,i,'setObjectTurnMass')(t.readInt(p[0]),t.readFloat(p[1]));},
 SET_ENABLE_RC_DETONATE_ON_CONTACT:(t,p,i)=>{world(t,i,'setEnableRcDetonateOnContact')(bool(t,p[0]));},
 SET_ENABLE_RC_DETONATE:(t,p,i)=>{world(t,i,'setEnableRcDetonate')(bool(t,p[0]));},
 TASK_WARP_CHAR_INTO_CAR_AS_DRIVER:(t,p,i)=>{world(t,i,'taskWarpCharIntoCarAsDriver')(t.readInt(p[0]),t.readInt(p[1]));},
 SET_CREATE_RANDOM_COPS:(t,p,i)=>{game(t,i).population.dontCreateRandomCops=!bool(t,p[0]);},
 SET_FREE_RESPRAYS:(t,p,i)=>{game(t,i).freeResprays=bool(t,p[0]);},
 SET_ONLY_CREATE_GANG_MEMBERS:(t,p,i)=>{world(t,i,'setOnlyCreateGangMembers')(bool(t,p[0]));},
 SET_OBJECT_AS_STEALABLE:(t,p,i)=>{world(t,i,'setObjectAsStealable')(t.readInt(p[0]),bool(t,p[1]));},
 SET_PLAYER_DISPLAY_VITAL_STATS_BUTTON:(t,p,i)=>{world(t,i,'setPlayerDisplayVitalStatsButton')(t.readInt(p[0]),bool(t,p[1]));},
 GET_SEQUENCE_PROGRESS_RECURSIVE:(t,p,i)=>{const result=world(t,i,'getSequenceProgressRecursive')(t.readInt(p[0]));t.writeInt(p[1],result.p2);t.writeInt(p[2],result.p3);},
 SET_TRAIN_FORCED_TO_SLOW_DOWN:(t,p,i)=>{world(t,i,'setTrainForcedToSlowDown')(t.readInt(p[0]),bool(t,p[1]));},
 DELETE_MISSION_TRAIN:(t,p,i)=>{world(t,i,'deleteMissionTrain')(t.readInt(p[0]));},
 HAS_OBJECT_OF_TYPE_BEEN_SMASHED:(t,p,i)=>{t.updateCompareFlag(world(t,i,'hasObjectOfTypeBeenSmashed')(t.readFloat(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),model(t,i,p[4])),negated(i));},
 MARK_VEHICLE_MOD_AS_NO_LONGER_NEEDED:(t,p,i)=>{world(t,i,'markVehicleModAsNoLongerNeeded')(model(t,i,p[0]));},
 SET_WEATHER_TO_APPROPRIATE_TYPE_NOW:(t,p,i)=>{world(t,i,'setWeatherToAppropriateTypeNow')();},
 SET_HELI_REACHED_TARGET_DISTANCE:(t,p,i)=>{world(t,i,'setHeliReachedTargetDistance')(t.readInt(p[0]),t.readInt(p[1]));},
 SET_CAR_AS_MISSION_CAR:(t,p,i)=>{world(t,i,'setCarAsMissionCar')(t.readInt(p[0]));},
 SET_CAR_LIGHTS_ON:(t,p,i)=>{world(t,i,'setCarLightsOn')(t.readInt(p[0]),bool(t,p[1]));},
 SWAP_NEAREST_BUILDING_MODEL:(t,p,i)=>{world(t,i,'swapNearestBuildingModel')(t.readFloat(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),model(t,i,p[4]),model(t,i,p[5]));},
 TASK_SAY:(t,p,i)=>{world(t,i,'taskSay')(t.readInt(p[0]),t.readInt(p[1]));},
 EXPLODE_CAR_IN_CUTSCENE_SHAKE_AND_BITS:(t,p,i)=>{world(t,i,'explodeCarInCutsceneShakeAndBits')(t.readInt(p[0]),bool(t,p[1]),bool(t,p[2]),bool(t,p[3]));},
 BOAT_STOP:(t,p,i)=>{world(t,i,'boatStop')(t.readInt(p[0]));},
 SET_TIMER_BEEP_COUNTDOWN_TIME:(t,p,i)=>{game(t,i).onscreenTimer.setClockBeepCountdownSecs(t.globalOffset(p[0]),t.readInt(p[1]));},
 IS_OBJECT_INTERSECTING_WORLD:(t,p,i)=>{t.updateCompareFlag(world(t,i,'isObjectIntersectingWorld')(t.readInt(p[0])),negated(i));},
 TASK_COMPLEX_PICKUP_OBJECT:(t,p,i)=>{world(t,i,'taskComplexPickupObject')(t.readInt(p[0]),t.readInt(p[1]));},
 IS_LAST_BUILDING_MODEL_SHOT_BY_PLAYER:(t,p,i)=>{t.updateCompareFlag(world(t,i,'isLastBuildingModelShotByPlayer')(t.readInt(p[0]),model(t,i,p[1])),negated(i));},
 FORCE_DEATH_RESTART:(t,p,i)=>{world(t,i,'forceDeathRestart')();},
 GET_CAR_PITCH:(t,p,i)=>{t.writeFloat(p[1],world(t,i,'getCarPitch')(t.readInt(p[0])));},
 GET_PLANE_UNDERCARRIAGE_POSITION:(t,p,i)=>{t.writeFloat(p[1],world(t,i,'getPlaneUndercarriagePosition')(t.readInt(p[0])));},
 SET_UP_SKIP_AFTER_MISSION:(t,p,i)=>{world(t,i,'setUpSkipAfterMission')(t.readFloat(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]));},
 IS_CHAR_IN_AREA_ON_FOOT_3D:(t,p,i)=>{t.updateCompareFlag(world(t,i,'isCharInAreaOnFoot3d')(t.readInt(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),t.readFloat(p[4]),t.readFloat(p[5]),t.readFloat(p[6]),bool(t,p[7])),negated(i));},
 ADD_SPHERE:(t,p,i)=>{t.writeInt(p[4],world(t,i,'addSphere')(t.readFloat(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3])));},
 PLANE_FOLLOW_ENTITY:(t,p,i)=>{world(t,i,'planeFollowEntity')(t.readInt(p[0]),t.readInt(p[1]),t.readInt(p[2]),t.readFloat(p[3]));},
 SET_GUNSHOT_SENSE_RANGE_FOR_RIOT2:(t,p,i)=>{world(t,i,'setGunshotSenseRangeForRiot2')(t.readFloat(p[0]));},
 CLEAR_ALL_SCRIPT_ROADBLOCKS:(t,p,i)=>{world(t,i,'clearAllScriptRoadblocks')();},
 CREATE_FX_SYSTEM_ON_CAR:(t,p,i)=>{t.writeInt(p[6],world(t,i,'createFxSystemOnCar')(t.text(p[0]),t.readInt(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),t.readFloat(p[4]),bool(t,p[5])));},
 TASK_PLAY_ANIM_SECONDARY:(t,p,i)=>{world(t,i,'taskPlayAnimSecondary')(t.readInt(p[0]),t.text(p[1]),t.text(p[2]),t.readFloat(p[3]),bool(t,p[4]),bool(t,p[5]),bool(t,p[6]),bool(t,p[7]),t.readInt(p[8]));},
 GET_CLOSEST_STRAIGHT_ROAD:(t,p,i)=>{const result=world(t,i,'getClosestStraightRoad')(t.readFloat(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),t.readFloat(p[4]));t.writeFloat(p[5],result.node1X);t.writeFloat(p[6],result.node1Y);t.writeFloat(p[7],result.node1Z);t.writeFloat(p[8],result.node2X);t.writeFloat(p[9],result.node2Y);t.writeFloat(p[10],result.node2Z);t.writeFloat(p[11],result.angle);},
 SET_CAR_RANDOM_ROUTE_SEED:(t,p,i)=>{world(t,i,'setCarRandomRouteSeed')(t.readInt(p[0]),t.readInt(p[1]));},
 SET_CAR_AVOID_LEVEL_TRANSITIONS:(t,p,i)=>{world(t,i,'setCarAvoidLevelTransitions')(t.readInt(p[0]),bool(t,p[1]));},
 ENABLE_BURGLARY_HOUSES:(t,p,i)=>{world(t,i,'enableBurglaryHouses')(bool(t,p[0]));},
 IS_CAR_LOW_RIDER:(t,p,i)=>{t.updateCompareFlag(world(t,i,'isCarLowRider')(t.readInt(p[0])),negated(i));},
 GET_VEHICLE_CLASS:(t,p,i)=>{t.writeInt(p[1],world(t,i,'getVehicleClass')(t.readInt(p[0])));},
 HAS_TRAIN_DERAILED:(t,p,i)=>{t.updateCompareFlag(world(t,i,'hasTrainDerailed')(t.readInt(p[0])),negated(i));},
 SET_GANG_WEAPONS:(t,p,i)=>{world(t,i,'setGangWeapons')(t.readInt(p[0]),t.readInt(p[1]),t.readInt(p[2]),t.readInt(p[3]));},
 GET_RANDOM_CAR_IN_SPHERE_NO_SAVE:(t,p,i)=>{t.writeInt(p[5],world(t,i,'getRandomCarInSphereNoSave')(t.readFloat(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),model(t,i,p[4])));},
 GET_MENU_ITEM_SELECTED:(t,p,i)=>{t.writeInt(p[1],world(t,i,'getMenuItemSelected')(t.readInt(p[0])));},
 SET_VEHICLE_DIRT_LEVEL:(t,p,i)=>{world(t,i,'setVehicleDirtLevel')(t.readInt(p[0]),t.readFloat(p[1]));},
 SWITCH_ARREST_PENALTIES:(t,p,i)=>{world(t,i,'switchArrestPenalties')(bool(t,p[0]));},
 SWITCH_DEATH_PENALTIES:(t,p,i)=>{world(t,i,'switchDeathPenalties')(bool(t,p[0]));},
 STORE_WANTED_LEVEL:(t,p,i)=>{t.writeInt(p[1],world(t,i,'storeWantedLevel')(t.readInt(p[0])));},
 // The runtime's own table: the game's makers are always there, a script's while its slot still holds it.
 DOES_DECISION_MAKER_EXIST:(t,p,i)=>{t.updateCompareFlag(game(t,i).decisionMakers.actualIndex(t.readInt(p[0]))>=0,negated(i));},
 CONVERT_METRES_TO_FEET_INT:(t,p,i)=>{t.writeInt(p[1],world(t,i,'convertMetresToFeetInt')(t.readInt(p[0])));},
 SET_POOL_TABLE_COORDS:(t,p,i)=>{world(t,i,'setPoolTableCoords')(t.readFloat(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),t.readFloat(p[4]),t.readFloat(p[5]));},
 SET_OBJECT_DRAW_LAST:(t,p,i)=>{world(t,i,'setObjectDrawLast')(t.readInt(p[0]),bool(t,p[1]));},
 GET_OBJECT_ROTATION_VELOCITY:(t,p,i)=>{const result=world(t,i,'getObjectRotationVelocity')(t.readInt(p[0]));t.writeFloat(p[1],result.x);t.writeFloat(p[2],result.y);t.writeFloat(p[3],result.z);},
 ADD_VELOCITY_RELATIVE_TO_OBJECT_VELOCITY:(t,p,i)=>{world(t,i,'addVelocityRelativeToObjectVelocity')(t.readInt(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]));},
 HAS_LANGUAGE_CHANGED:(t,p,i)=>{t.updateCompareFlag(world(t,i,'hasLanguageChanged')(),negated(i));},
 GIVE_REMOTE_CONTROLLED_MODEL_TO_PLAYER:(t,p,i)=>{world(t,i,'giveRemoteControlledModelToPlayer')(t.readInt(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),t.readFloat(p[4]),model(t,i,p[5]));},
 GET_REMOTE_CONTROLLED_CAR:(t,p,i)=>{t.writeInt(p[1],world(t,i,'getRemoteControlledCar')(t.readInt(p[0])));},
 ACTIVATE_INTERIOR_PEDS:(t,p,i)=>{world(t,i,'activateInteriorPeds')(bool(t,p[0]));},
 GET_SOUND_LEVEL_AT_COORDS:(t,p,i)=>{t.writeFloat(p[4],world(t,i,'getSoundLevelAtCoords')(t.readInt(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3])));},
 GET_TRAIN_CABOOSE:(t,p,i)=>{t.writeInt(p[1],world(t,i,'getTrainCaboose')(t.readInt(p[0])));},
 VEHICLE_DOES_PROVIDE_COVER:(t,p,i)=>{world(t,i,'vehicleDoesProvideCover')(t.readInt(p[0]),bool(t,p[1]));},
 SET_UP_SKIP_FOR_SPECIFIC_VEHICLE:(t,p,i)=>{world(t,i,'setUpSkipForSpecificVehicle')(t.readFloat(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),t.readInt(p[4]));},
 ENSURE_PLAYER_HAS_DRIVE_BY_WEAPON:(t,p,i)=>{world(t,i,'ensurePlayerHasDriveByWeapon')(t.readInt(p[0]),t.readInt(p[1]));},
 SET_MISSION_TRAIN_COORDINATES:(t,p,i)=>{world(t,i,'setMissionTrainCoordinates')(t.readInt(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]));},
 HAS_VEHICLE_MOD_LOADED:(t,p,i)=>{t.updateCompareFlag(world(t,i,'hasVehicleModLoaded')(model(t,i,p[0])),negated(i));},
 TASK_CHAR_ARREST_CHAR:(t,p,i)=>{world(t,i,'taskCharArrestChar')(t.readInt(p[0]),t.readInt(p[1]));},
 DRAW_LIGHT_WITH_RANGE:(t,p,i)=>{world(t,i,'drawLightWithRange')(t.readFloat(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readInt(p[3]),t.readInt(p[4]),t.readInt(p[5]),t.readFloat(p[6]));},
 ADD_BIG_GUN_FLASH:(t,p,i)=>{world(t,i,'addBigGunFlash')(t.readFloat(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),t.readFloat(p[4]),t.readFloat(p[5]));},
 ADD_BLIP_FOR_CAR_OLD:(t,p,i)=>{t.writeInt(p[3],world(t,i,'addBlipForCarOld')(t.readInt(p[0]),t.readInt(p[1]),t.readInt(p[2])));},
 GET_NTH_CLOSEST_CAR_NODE_WITH_HEADING:(t,p,i)=>{
  const point=vec(t,p,0);
  if(point.z<=ScmCamera.MAP_Z_LOW_LIMIT)point.z=world(t,i,'groundZForCoord')(point.x,point.y);
  const result=world(t,i,'getNthClosestCarNodeWithHeading')(point.x,point.y,point.z,t.readInt(p[3]));t.writeFloat(p[4],result.x);t.writeFloat(p[5],result.y);t.writeFloat(p[6],result.z);t.writeFloat(p[7],result.heading);},
 IS_THIS_MODEL_A_CAR:(t,p,i)=>{t.updateCompareFlag(world(t,i,'isThisModelACar')(model(t,i,p[0])),negated(i));},
 // The garage is named by its text label, as the other garage commands name it.
 SET_TARGET_CAR_FOR_MISSION_GARAGE:(t,p,i)=>{const car=t.readInt(p[1]);game(t,i).garages.setTargetCar(t.text(p[0]),car>0?car:undefined);},
 TASK_GO_TO_COORD_WHILE_AIMING:(t,p,i)=>{world(t,i,'taskGoToCoordWhileAiming')(t.readInt(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),t.readInt(p[4]),t.readFloat(p[5]),t.readFloat(p[6]),t.readInt(p[7]),t.readFloat(p[8]),t.readFloat(p[9]),t.readFloat(p[10]));},
 ADD_UPSIDEDOWN_CAR_CHECK:(t,p,i)=>{game(t,i).upsideDownCars.add(t.readInt(p[0]));},
 REMOVE_UPSIDEDOWN_CAR_CHECK:(t,p,i)=>{game(t,i).upsideDownCars.remove(t.readInt(p[0]));},
 IS_CAR_STUCK_ON_ROOF:(t,p,i)=>{t.updateCompareFlag(game(t,i).upsideDownCars.hasBeenUpsideDownForAWhile(t.readInt(p[0])),negated(i));},
 CREATE_BIRDS:(t,p,i)=>{world(t,i,'createBirds')(t.readFloat(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),t.readFloat(p[4]),t.readFloat(p[5]),t.readInt(p[6]),t.readInt(p[7]));},
 DONT_SUPPRESS_ANY_CAR_MODELS:(t,p,i)=>{world(t,i,'dontSuppressAnyCarModels')();},
 SET_FREEBIES_IN_VEHICLE:(t,p,i)=>{world(t,i,'setFreebiesInVehicle')(t.readInt(p[0]),bool(t,p[1]));},
 TAKE_REMOTE_CONTROL_OF_CAR:(t,p,i)=>{world(t,i,'takeRemoteControlOfCar')(t.readInt(p[0]),t.readInt(p[1]));},
 CLEAR_CAR_LAST_WEAPON_DAMAGE:(t,p,i)=>{world(t,i,'clearCarLastWeaponDamage')(t.readInt(p[0]));},
 RELEASE_PATH_NODES:(t,p,i)=>{world(t,i,'releasePathNodes')();},
 GET_RANDOM_CAR_OF_TYPE_IN_AREA_NO_SAVE:(t,p,i)=>{t.writeInt(p[5],world(t,i,'getRandomCarOfTypeInAreaNoSave')(t.readFloat(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),model(t,i,p[4])));},
 GET_RADIO_CHANNEL:(t,p,i)=>{t.writeInt(p[0],world(t,i,'getRadioChannel')());},
 ACTIVATE_HELI_SPEED_CHEAT:(t,p,i)=>{world(t,i,'activateHeliSpeedCheat')(t.readInt(p[0]),t.readInt(p[1]));},
 HELI_KEEP_ENTITY_IN_VIEW:(t,p,i)=>{world(t,i,'heliKeepEntityInView')(t.readInt(p[0]),t.readInt(p[1]),t.readInt(p[2]),t.readFloat(p[3]),t.readFloat(p[4]));},
 SET_CAR_COORDINATES_NO_OFFSET:(t,p,i)=>{world(t,i,'setCarCoordinatesNoOffset')(t.readInt(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]));},
 ATTACH_CAMERA_TO_CHAR:(t,p,i)=>{world(t,i,'attachCameraToChar')(t.readInt(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),t.readFloat(p[4]),t.readFloat(p[5]),t.readFloat(p[6]),t.readFloat(p[7]),t.readInt(p[8]));},
 ADD_EXPLOSION_NO_SOUND:(t,p,i)=>{world(t,i,'addExplosionNoSound')(t.readFloat(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readInt(p[3]));},
 SWITCH_ON_GROUND_SEARCHLIGHT:(t,p,i)=>{world(t,i,'switchOnGroundSearchlight')(t.readInt(p[0]),bool(t,p[1]));},
 TASK_JETPACK:(t,p,i)=>{world(t,i,'taskJetpack')(t.readInt(p[0]));},
 TASK_DRIVE_POINT_ROUTE:(t,p,i)=>{world(t,i,'taskDrivePointRoute')(t.readInt(p[0]),t.readInt(p[1]),t.readFloat(p[2]));},
 IS_CAR_DOOR_DAMAGED:(t,p,i)=>{t.updateCompareFlag(world(t,i,'isCarDoorDamaged')(t.readInt(p[0]),t.readInt(p[1])),negated(i));},
 SET_VEHICLE_TO_FADE_IN:(t,p,i)=>{world(t,i,'setVehicleToFadeIn')(t.readInt(p[0]),t.readInt(p[1]));},
 ADD_ATTRACTOR:(t,p,i)=>{t.writeInt(p[6],world(t,i,'addAttractor')(t.readFloat(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),t.readFloat(p[4]),t.readInt(p[5])));},
 ADD_PEDTYPE_AS_ATTRACTOR_USER:(t,p,i)=>{world(t,i,'addPedtypeAsAttractorUser')(t.readInt(p[0]),t.readInt(p[1]));},
 TASK_USE_ATTRACTOR:(t,p,i)=>{world(t,i,'taskUseAttractor')(t.readInt(p[0]),t.readInt(p[1]));},
 SET_CHECKPOINT_COORDS:(t,p,i)=>{game(t,i).checkpoints.setCoords(t.readInt(p[0]),vec(t,p,1));},
 PLANE_FLY_IN_DIRECTION:(t,p,i)=>{world(t,i,'planeFlyInDirection')(t.readInt(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]));},
 HAS_OBJECT_BEEN_PHOTOGRAPHED:(t,p,i)=>{t.updateCompareFlag(world(t,i,'hasObjectBeenPhotographed')(t.readInt(p[0])),negated(i));},
 SELECT_WEAPONS_FOR_VEHICLE:(t,p,i)=>{world(t,i,'selectWeaponsForVehicle')(t.readInt(p[0]),t.readInt(p[1]));},
 HELI_ATTACK_PLAYER:(t,p,i)=>{world(t,i,'heliAttackPlayer')(t.readInt(p[0]),t.readInt(p[1]),t.readFloat(p[2]));},
 GRAB_ENTITY_ON_WINCH:(t,p,i)=>{const result=world(t,i,'grabEntityOnWinch')(t.readInt(p[0]));t.writeInt(p[1],result.char);t.writeInt(p[2],result.vehicle);t.writeInt(p[3],result.object);},
 KILL_FX_SYSTEM_NOW:(t,p,i)=>{world(t,i,'killFxSystemNow')(t.readInt(p[0]));},
 SET_PLAYER_MOOD:(t,p,i)=>{world(t,i,'setPlayerMood')(t.readInt(p[0]),t.readInt(p[1]),t.readInt(p[2]));},
 SET_INFRARED_VISION:(t,p,i)=>{world(t,i,'setInfraredVision')(bool(t,p[0]));},
 STOP_CREDITS:(t,p,i)=>{world(t,i,'stopCredits')();},
 WINCH_CAN_PICK_OBJECT_UP:(t,p,i)=>{world(t,i,'winchCanPickObjectUp')(t.readInt(p[0]),bool(t,p[1]));},
 SET_OBJECT_RENDER_SCORCHED:(t,p,i)=>{world(t,i,'setObjectRenderScorched')(t.readInt(p[0]),bool(t,p[1]));},
 IS_PLAYER_PERFORMING_WHEELIE:(t,p,i)=>{t.updateCompareFlag(world(t,i,'isPlayerPerformingWheelie')(t.readInt(p[0])),negated(i));},
 IS_PLAYER_PERFORMING_STOPPIE:(t,p,i)=>{t.updateCompareFlag(world(t,i,'isPlayerPerformingStoppie')(t.readInt(p[0])),negated(i));},
 IS_RELATIONSHIP_SET:(t,p,i)=>{t.updateCompareFlag(world(t,i,'isRelationshipSet')(t.readInt(p[0]),t.readInt(p[1]),t.readInt(p[2])),negated(i));},
 CLEAR_RELATIONSHIP:(t,p,i)=>{world(t,i,'clearRelationship')(t.readInt(p[0]),t.readInt(p[1]),t.readInt(p[2]));},
 GET_CLOSEST_STEALABLE_OBJECT:(t,p,i)=>{t.writeInt(p[4],world(t,i,'getClosestStealableObject')(t.readFloat(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3])));},
 FORCE_ALL_VEHICLE_LIGHTS_OFF:(t,p,i)=>{world(t,i,'forceAllVehicleLightsOff')(bool(t,p[0]));},
 SET_FREE_HEALTH_CARE:(t,p,i)=>{world(t,i,'setFreeHealthCare')(t.readInt(p[0]),bool(t,p[1]));},
 FIND_NUMBER_TAGS_TAGGED:(t,p,i)=>{t.writeInt(p[0],world(t,i,'findNumberTagsTagged')());},
 UPDATE_PICKUP_MONEY_PER_DAY:(t,p,i)=>{world(t,i,'updatePickupMoneyPerDay')(t.readInt(p[0]),t.readInt(p[1]));},
 ACTIVATE_SAVE_MENU:(t,p,i)=>{world(t,i,'activateSaveMenu')();},
 HAS_SAVE_GAME_FINISHED:(t,p,i)=>{t.updateCompareFlag(world(t,i,'hasSaveGameFinished')(),negated(i));},
 // A named model is the script's own used-object id (negative), which is what the script compares it with.
 GET_OBJECT_MODEL:(t,p,i)=>{
  const model=game(t,i).objects.at(t.readInt(p[0])).model;
  if(typeof model==='number'){t.writeInt(p[1],model);return;}
  const index=t.host?.objectNames?.indexOf(model)??-1;
  if(index<=0)throw new UnsupportedScmCommand(i.offset,i.opcode&0x7fff,i.name,`object model ${model} outside the used-object table`);
  t.writeInt(p[1],-index);
 },
 GET_CURRENT_CAR_MOD:(t,p,i)=>{t.writeInt(p[2],world(t,i,'getCurrentCarMod')(t.readInt(p[0]),t.readInt(p[1])));},
 GET_LATEST_CONSOLE_COMMAND:(t,p,i)=>{t.writeInt(p[0],world(t,i,'getLatestConsoleCommand')());},
 GET_WHEELIE_STATS:(t,p,i)=>{const result=world(t,i,'getWheelieStats')(t.readInt(p[0]));t.writeInt(p[1],result.twoWheelsTime);t.writeFloat(p[2],result.twoWheelsDistance);t.writeInt(p[3],result.wheelieTime);t.writeFloat(p[4],result.wheelieDistance);t.writeInt(p[5],result.stoppieTime);t.writeFloat(p[6],result.stoppieDistance);},
 RANDOM_PASSENGER_SAY:(t,p,i)=>{world(t,i,'randomPassengerSay')(t.readInt(p[0]),t.readInt(p[1]));},
 ARE_SUBTITLES_SWITCHED_ON:(t,p,i)=>{t.updateCompareFlag(world(t,i,'areSubtitlesSwitchedOn')(),negated(i));},
 GET_STRING_WIDTH_WITH_NUMBER:(t,p,i)=>{t.writeInt(p[2],world(t,i,'getStringWidthWithNumber')(t.text(p[0]),t.readInt(p[1])));},
 RESET_NUM_OF_MODELS_KILLED_BY_PLAYER:(t,p,i)=>{world(t,i,'resetNumOfModelsKilledByPlayer')(t.readInt(p[0]));},
 SET_FORCE_RANDOM_CAR_MODEL:(t,p,i)=>{world(t,i,'setForceRandomCarModel')(model(t,i,p[0]));},
 IS_PLAYER_IN_REMOTE_MODE:(t,p,i)=>{t.updateCompareFlag(world(t,i,'isPlayerInRemoteMode')(t.readInt(p[0])),negated(i));},
 GET_NUM_OF_MODELS_KILLED_BY_PLAYER:(t,p,i)=>{t.writeInt(p[2],world(t,i,'getNumOfModelsKilledByPlayer')(t.readInt(p[0]),model(t,i,p[1])));},
 CLEAR_LOADED_SHOP:(t,_p,i)=>{game(t,i).shopping.removeLoadedShop();},
 GET_NEAREST_TAG_POSITION:(t,p,i)=>{const result=world(t,i,'getNearestTagPosition')(t.readFloat(p[0]),t.readFloat(p[1]),t.readFloat(p[2]));t.writeFloat(p[3],result.x);t.writeFloat(p[4],result.y);t.writeFloat(p[5],result.z);},
 FIX_CAR_PANEL:(t,p,i)=>{world(t,i,'fixCarPanel')(t.readInt(p[0]),t.readInt(p[1]));},
 SET_GANG_WARS_TRAINING_MISSION:(t,p,i)=>{world(t,i,'setGangWarsTrainingMission')(bool(t,p[0]));},
 SET_CHAR_USES_COLLISION_CLOSEST_OBJECT_OF_TYPE:(t,p,i)=>{world(t,i,'setCharUsesCollisionClosestObjectOfType')(t.readFloat(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),model(t,i,p[4]),bool(t,p[5]),t.readInt(p[6]));},
 SET_ONSCREEN_COUNTER_FLASH_WHEN_FIRST_DISPLAYED:(t,p,i)=>{game(t,i).onscreenTimer.setCounterFlashWhenFirstDisplayed(t.globalOffset(p[0]),bool(t,p[1]));},
 SET_OBJECT_MASS:(t,p,i)=>{world(t,i,'setObjectMass')(t.readInt(p[0]),t.readFloat(p[1]));},
 IS_OBJECT_IN_AREA_3D:(t,p,i)=>{t.updateCompareFlag(world(t,i,'isObjectInArea3d')(t.readInt(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),t.readFloat(p[4]),t.readFloat(p[5]),t.readFloat(p[6]),bool(t,p[7])),negated(i));},
 GET_OBJECT_QUATERNION:(t,p,i)=>{const result=world(t,i,'getObjectQuaternion')(t.readInt(p[0]));t.writeFloat(p[1],result.x);t.writeFloat(p[2],result.y);t.writeFloat(p[3],result.z);t.writeFloat(p[4],result.w);},
 SET_OBJECT_QUATERNION:(t,p,i)=>{world(t,i,'setObjectQuaternion')(t.readInt(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),t.readFloat(p[4]));},
 IS_SKIP_WAITING_FOR_SCRIPT_TO_FADE_IN:(t,p,i)=>{t.updateCompareFlag(world(t,i,'isSkipWaitingForScriptToFadeIn')(),negated(i));},
 SET_UP_SKIP_FOR_VEHICLE_FINISHED_BY_SCRIPT:(t,p,i)=>{world(t,i,'setUpSkipForVehicleFinishedByScript')(t.readFloat(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),t.readInt(p[4]));},
 SET_GROUP_SEQUENCE:(t,p,i)=>{world(t,i,'setGroupSequence')(t.readInt(p[0]),t.readInt(p[1]));},
 TASK_WARP_CHAR_INTO_CAR_AS_PASSENGER:(t,p,i)=>{world(t,i,'taskWarpCharIntoCarAsPassenger')(t.readInt(p[0]),t.readInt(p[1]),t.readInt(p[2]));},
 REGISTER_BEST_POSITION:(t,p,i)=>{world(t,i,'registerBestPosition')(t.readInt(p[0]),t.readInt(p[1]));},
 TASK_PLAY_ANIM_WITH_FLAGS:(t,p,i)=>{world(t,i,'taskPlayAnimWithFlags')(t.readInt(p[0]),t.text(p[1]),t.text(p[2]),t.readFloat(p[3]),bool(t,p[4]),bool(t,p[5]),bool(t,p[6]),bool(t,p[7]),t.readInt(p[8]),bool(t,p[9]),bool(t,p[10]));},
 IS_ATTACHED_PLAYER_HEADING_ACHIEVED:(t,p,i)=>{t.updateCompareFlag(world(t,i,'isAttachedPlayerHeadingAchieved')(t.readInt(p[0])),negated(i));},
 IS_CAR_TOUCHING_CAR:(t,p,i)=>{t.updateCompareFlag(world(t,i,'isCarTouchingCar')(t.readInt(p[0]),t.readInt(p[1])),negated(i));},
 ADD_TO_CAR_ROTATION_VELOCITY:(t,p,i)=>{world(t,i,'addToCarRotationVelocity')(t.readInt(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]));},
 ADD_BLIP_FOR_DEAD_CHAR:(t,p,i)=>{t.writeInt(p[1],world(t,i,'addBlipForDeadChar')(t.readInt(p[0])));},
 HELI_LAND_AT_COORDS:(t,p,i)=>{world(t,i,'heliLandAtCoords')(t.readInt(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),t.readFloat(p[4]),t.readFloat(p[5]));},
 IS_PLAYER_PRESSING_HORN:(t,p,i)=>{t.updateCompareFlag(world(t,i,'isPlayerPressingHorn')(t.readInt(p[0])),negated(i));},
 SET_VEHICLE_QUATERNION:(t,p,i)=>{world(t,i,'setVehicleQuaternion')(t.readInt(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),t.readFloat(p[4]));},
 GET_CAR_MASS:(t,p,i)=>{t.writeFloat(p[1],world(t,i,'getCarMass')(t.readInt(p[0])));},
 GET_CAR_BLOCKING_CAR:(t,p,i)=>{t.writeInt(p[1],world(t,i,'getCarBlockingCar')(t.readInt(p[0])));},
 GET_PARKING_NODE_IN_AREA:(t,p,i)=>{const result=world(t,i,'getParkingNodeInArea')(t.readFloat(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),t.readFloat(p[4]),t.readFloat(p[5]));t.writeFloat(p[6],result.x);t.writeFloat(p[7],result.y);t.writeFloat(p[8],result.z);},
 IS_CHAR_IN_AREA_IN_CAR_3D:(t,p,i)=>{t.updateCompareFlag(world(t,i,'isCharInAreaInCar3d')(t.readInt(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),t.readFloat(p[4]),t.readFloat(p[5]),t.readFloat(p[6]),bool(t,p[7])),negated(i));},
 TASK_COWER:(t,p,i)=>{world(t,i,'taskCower')(t.readInt(p[0]));},
 // Only a Pay 'n' Spray resprays a car, and none is ported, so none has been.
 HAS_CAR_BEEN_RESPRAYED:(t,p,i)=>{t.updateCompareFlag(false,negated(i));},
 GET_CHAR_SWIM_STATE:(t,p,i)=>{t.writeInt(p[1],world(t,i,'getCharSwimState')(t.readInt(p[0])));},
 BOAT_GOTO_COORDS:(t,p,i)=>{world(t,i,'boatGotoCoords')(t.readInt(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]));},
 IS_CHAR_IN_ANY_SEARCHLIGHT:(t,p,i)=>{t.updateCompareFlag(world(t,i,'isCharInAnySearchlight')(t.readInt(p[0])),negated(i));},
 ADD_SMOKE_PARTICLE:(t,p,i)=>{world(t,i,'addSmokeParticle')(t.readFloat(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),t.readFloat(p[4]),t.readFloat(p[5]),t.readFloat(p[6]),t.readFloat(p[7]),t.readFloat(p[8]),t.readFloat(p[9]),t.readFloat(p[10]),t.readFloat(p[11]));},
 IS_PLAYER_CLIMBING:(t,p,i)=>{t.updateCompareFlag(world(t,i,'isPlayerClimbing')(t.readInt(p[0])),negated(i));},
 IS_CHAR_STUCK_UNDER_CAR:(t,p,i)=>{t.updateCompareFlag(world(t,i,'isCharStuckUnderCar')(t.readInt(p[0])),negated(i));},
 SET_VEHICLE_CAN_BE_TARGETTED:(t,p,i)=>{world(t,i,'setVehicleCanBeTargetted')(t.readInt(p[0]),bool(t,p[1]));},
 HAS_CHAR_BEEN_ARRESTED:(t,p,i)=>{t.updateCompareFlag(world(t,i,'hasCharBeenArrested')(t.readInt(p[0])),negated(i));},
 TASK_GREET_PARTNER:(t,p,i)=>{world(t,i,'taskGreetPartner')(t.readInt(p[0]),t.readInt(p[1]),t.readFloat(p[2]),t.readInt(p[3]));},
 SET_HELI_ORIENTATION:(t,p,i)=>{world(t,i,'setHeliOrientation')(t.readInt(p[0]),t.readFloat(p[1]));},
 IS_OBJECT_IN_ANGLED_AREA_2D:(t,p,i)=>{t.updateCompareFlag(world(t,i,'isObjectInAngledArea2d')(t.readInt(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),t.readFloat(p[4]),t.readFloat(p[5]),bool(t,p[6])),negated(i));},
 TASK_GO_TO_OBJECT:(t,p,i)=>{world(t,i,'taskGoToObject')(t.readInt(p[0]),t.readInt(p[1]),t.readInt(p[2]),t.readFloat(p[3]));},
 SET_CAR_ESCORT_CAR_RIGHT:(t,p,i)=>{world(t,i,'setCarEscortCarRight')(t.readInt(p[0]),t.readInt(p[1]));},
 SET_CAR_ESCORT_CAR_LEFT:(t,p,i)=>{world(t,i,'setCarEscortCarLeft')(t.readInt(p[0]),t.readInt(p[1]));},
 GIVE_NON_PLAYER_CAR_NITRO:(t,p,i)=>{world(t,i,'giveNonPlayerCarNitro')(t.readInt(p[0]));},
 GET_ROPE_HEIGHT_FOR_OBJECT:(t,p,i)=>{t.writeFloat(p[1],world(t,i,'getRopeHeightForObject')(t.readInt(p[0])));},
 GET_RANDOM_CAR_OF_TYPE_IN_ANGLED_AREA_NO_SAVE:(t,p,i)=>{t.writeInt(p[6],world(t,i,'getRandomCarOfTypeInAngledAreaNoSave')(t.readFloat(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),t.readFloat(p[4]),model(t,i,p[5])));},
 REMOVE_OIL_PUDDLES_IN_AREA:(t,p,i)=>{world(t,i,'removeOilPuddlesInArea')(t.readFloat(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]));},
 LOAD_PATH_NODES_IN_AREA:(t,p,i)=>{world(t,i,'loadPathNodesInArea')(t.readFloat(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]));},
 IS_CAR_DOOR_FULLY_OPEN:(t,p,i)=>{t.updateCompareFlag(world(t,i,'isCarDoorFullyOpen')(t.readInt(p[0]),t.readInt(p[1])),negated(i));},
 DETACH_TRAILER_FROM_CAB:(t,p,i)=>{world(t,i,'detachTrailerFromCab')(t.readInt(p[0]),t.readInt(p[1]));},
 PLANE_ATTACK_PLAYER:(t,p,i)=>{world(t,i,'planeAttackPlayer')(t.readInt(p[0]),t.readInt(p[1]),t.readFloat(p[2]));},
 CLEAR_LAST_BUILDING_MODEL_SHOT_BY_PLAYER:(t,p,i)=>{world(t,i,'clearLastBuildingModelShotByPlayer')(t.readInt(p[0]));},
 USE_DETONATOR:(t,p,i)=>{world(t,i,'useDetonator')();},
 ADD_TO_OBJECT_ROTATION_VELOCITY:(t,p,i)=>{world(t,i,'addToObjectRotationVelocity')(t.readInt(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]));},
 DRAW_WEAPONSHOP_CORONA:(t,p,i)=>{world(t,i,'drawWeaponshopCorona')(t.readFloat(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),t.readInt(p[4]),t.readInt(p[5]),t.readInt(p[6]),t.readInt(p[7]),t.readInt(p[8]));},
 ATTACH_CAMERA_TO_CHAR_LOOK_AT_CHAR:(t,p,i)=>{world(t,i,'attachCameraToCharLookAtChar')(t.readInt(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),t.readInt(p[4]),t.readFloat(p[5]),t.readInt(p[6]));},
 FIRE_HUNTER_GUN:(t,p,i)=>{world(t,i,'fireHunterGun')(t.readInt(p[0]));},
 TASK_DIVE_FROM_ATTACHMENT_AND_GET_UP:(t,p,i)=>{world(t,i,'taskDiveFromAttachmentAndGetUp')(t.readInt(p[0]),t.readInt(p[1]));},
 CREATE_FX_SYSTEM_ON_CHAR_WITH_DIRECTION:(t,p,i)=>{t.writeInt(p[9],world(t,i,'createFxSystemOnCharWithDirection')(t.text(p[0]),t.readInt(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),t.readFloat(p[4]),t.readFloat(p[5]),t.readFloat(p[6]),t.readFloat(p[7]),bool(t,p[8])));},
 FIX_CAR:(t,p,i)=>{world(t,i,'fixCar')(t.readInt(p[0]));},
 SET_EXTRA_CAR_COLOURS:(t,p,i)=>{world(t,i,'setExtraCarColours')(t.readInt(p[0]),t.readInt(p[1]),t.readInt(p[2]));},
 RESET_STUFF_UPON_RESURRECTION:(t,p,i)=>{world(t,i,'resetStuffUponResurrection')();},
 SET_CAR_ROLL:(t,p,i)=>{world(t,i,'setCarRoll')(t.readInt(p[0]),t.readFloat(p[1]));},
 LOCK_DOOR:(t,p,i)=>{world(t,i,'lockDoor')(t.readInt(p[0]),bool(t,p[1]));},
 GET_OBJECT_MASS:(t,p,i)=>{t.writeFloat(p[1],world(t,i,'getObjectMass')(t.readInt(p[0])));},
 TASK_USE_ATM:(t,p,i)=>{world(t,i,'taskUseAtm')(t.readInt(p[0]));},
 ATTACH_WINCH_TO_HELI:(t,p,i)=>{world(t,i,'attachWinchToHeli')(t.readInt(p[0]),bool(t,p[1]));},
 RELEASE_ENTITY_FROM_WINCH:(t,p,i)=>{world(t,i,'releaseEntityFromWinch')(t.readInt(p[0]));},
 IS_NIGHT_VISION_ACTIVE:(t,p,i)=>{t.updateCompareFlag(world(t,i,'isNightVisionActive')(),negated(i));},
 POLICE_HELI_CHASE_ENTITY:(t,p,i)=>{world(t,i,'policeHeliChaseEntity')(t.readInt(p[0]),t.readInt(p[1]),t.readInt(p[2]),t.readFloat(p[3]));},
 PLANE_ATTACK_PLAYER_USING_DOG_FIGHT:(t,p,i)=>{world(t,i,'planeAttackPlayerUsingDogFight')(t.readInt(p[0]),t.readInt(p[1]),t.readFloat(p[2]));},
 ATTACH_OBJECT_TO_CHAR:(t,p,i)=>{world(t,i,'attachObjectToChar')(t.readInt(p[0]),t.readInt(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),t.readFloat(p[4]),t.readFloat(p[5]),t.readFloat(p[6]),t.readFloat(p[7]));},
 SET_CHAR_BULLETPROOF_VEST:(t,p,i)=>{world(t,i,'setCharBulletproofVest')(t.readInt(p[0]),bool(t,p[1]));},
 GET_DOOR_ANGLE_RATIO:(t,p,i)=>{t.writeFloat(p[2],world(t,i,'getDoorAngleRatio')(t.readInt(p[0]),t.readInt(p[1])));},
 START_CREDITS:(t,p,i)=>{world(t,i,'startCredits')();},
 ARE_CREDITS_FINISHED:(t,p,i)=>{t.updateCompareFlag(world(t,i,'areCreditsFinished')(),negated(i));},
 COPY_GROUP_DECISION_MAKER:(t,p,i)=>{t.writeInt(p[1],world(t,i,'copyGroupDecisionMaker')(t.readInt(p[0])));},
 IS_MODEL_IN_CDIMAGE:(t,p,i)=>{t.updateCompareFlag(world(t,i,'isModelInCdimage')(model(t,i,p[0])),negated(i));},
 GET_RANDOM_CAR_OF_TYPE_IN_AREA:(t,p,i)=>{t.writeInt(p[5],world(t,i,'getRandomCarOfTypeInArea')(t.readFloat(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),model(t,i,p[4])));},
 IS_PROCEDURAL_INTERIOR_ACTIVE:(t,p,i)=>{t.updateCompareFlag(world(t,i,'isProceduralInteriorActive')(t.readInt(p[0])),negated(i));},
 GET_POSITION_OF_ENTRY_EXIT_CHAR_USED:(t,p,i)=>{const result=world(t,i,'getPositionOfEntryExitCharUsed')(t.readInt(p[0]));t.writeFloat(p[1],result.x);t.writeFloat(p[2],result.y);t.writeFloat(p[3],result.z);t.writeFloat(p[4],result.heading);},
 FIND_TRAIN_DIRECTION:(t,p,i)=>{t.updateCompareFlag(world(t,i,'findTrainDirection')(t.readInt(p[0])),negated(i));},
 ADD_BLIP_FOR_COORD_OLD:(t,p,i)=>{t.writeInt(p[5],world(t,i,'addBlipForCoordOld')(t.readFloat(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readInt(p[3]),t.readInt(p[4])));},
 TASK_FOLLOW_PATH_NODES_TO_COORD_WITH_RADIUS:(t,p,i)=>{world(t,i,'taskFollowPathNodesToCoordWithRadius')(t.readInt(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),t.readInt(p[4]),t.readInt(p[5]),t.readFloat(p[6]));},
 SET_CHECKPOINT_HEADING:(t,p,i)=>{game(t,i).checkpoints.setHeading(t.readInt(p[0]),t.readFloat(p[1]));},
 DRAW_SHADOW:(t,p,i)=>{world(t,i,'drawShadow')(t.readInt(p[0]),t.readFloat(p[1]),t.readFloat(p[2]),t.readFloat(p[3]),t.readFloat(p[4]),t.readFloat(p[5]),t.readInt(p[6]),t.readInt(p[7]),t.readInt(p[8]),t.readInt(p[9]));},
 // IsCharInFlyingVehicle is the heli question or the plane one.
 IS_CHAR_IN_FLYING_VEHICLE:(t,p,i)=>{
  const vehicle=world(t,i,'pedVehicle')(t.readInt(p[0]));
  const appearance=vehicle===undefined?undefined:world(t,i,'vehicleAppearance')(vehicle);
  t.updateCompareFlag(appearance===VEHICLE_APPEARANCE_HELI||appearance===VEHICLE_APPEARANCE_PLANE,negated(i));
 },
 // GIVE_PLAYER_CLOTHES is CPedClothesDesc::SetTextureAndModel by name. Its outside-shop twin takes the same
 // four operands and dresses the same description; the reference leaves that one's handler unregistered, so
 // what is kept beyond the dressing is that the script asked for it away from a shop.
 GIVE_PLAYER_CLOTHES:(t,p,i)=>{game(t,i).clothes.setTextureAndModel(t.text(p[1]),t.text(p[2]),t.readInt(p[3]));},
 GIVE_PLAYER_CLOTHES_OUTSIDE_SHOP:(t,p,i)=>{
  const state=game(t,i);state.clothes.setTextureAndModel(t.text(p[1]),t.text(p[2]),t.readInt(p[3]));
  state.clothesGivenOutsideShop++;
 },
 STORE_CLOTHES_STATE:(t,_p,i)=>{game(t,i).clothes.storeState();},
 RESTORE_CLOTHES_STATE:(t,_p,i)=>{game(t,i).clothes.restoreState();},
 // GetCharAreaVisible returns a comparison rather than the area code its documentation promises: the variable
 // takes one when the ped is anywhere but the normal world.
 GET_CHAR_AREA_VISIBLE:(t,p,i)=>{t.writeInt(p[1],world(t,i,'pedAreaCode')(t.readInt(p[0]))!==0?1:0);},
 // CPlayerPed::CanPlayerStartMission (0x6091B0): every gate has to pass.
 CAN_PLAYER_START_MISSION:(t,p,i)=>{
  const gates=world(t,i,'playerMissionGates')(t.readInt(p[0]));
  const can=gates.statePlaying&&!gates.coopGoingOn&&(gates.inControl||gates.driving)
   &&!gates.physicalResponseTask&&!gates.eventResponseTask&&!gates.nonDrivePrimaryTask&&!gates.attackTask
   &&gates.alive&&!gates.scriptCommandEvent;
  t.updateCompareFlag(can,negated(i));
 },
 LOCATE_CHAR_ANY_MEANS_CHAR_2D:locateCharChar(false,{car:false,foot:false}),
 LOCATE_CHAR_ON_FOOT_CHAR_2D:locateCharChar(false,{car:false,foot:true}),
 LOCATE_CHAR_IN_CAR_CHAR_2D:locateCharChar(false,{car:true,foot:false}),
 LOCATE_CHAR_ANY_MEANS_CHAR_3D:locateCharChar(true,{car:false,foot:false}),
 LOCATE_CHAR_ON_FOOT_CHAR_3D:locateCharChar(true,{car:false,foot:true}),
 LOCATE_CHAR_IN_CAR_CHAR_3D:locateCharChar(true,{car:true,foot:false}),
 // --- CTaskSequences (TaskSequences.cpp is reversed; the four command dispatches are not, and each names the
 // static it reaches). A sequence records the tasks that follow it until the script closes it.
 OPEN_SEQUENCE_TASK:(t,p,i)=>{game(t,i).sequences.open(t.readInt(p[0]));},
 CLOSE_SEQUENCE_TASK:(t,p,i)=>{game(t,i).sequences.close(t.readInt(p[0]));},
 CLEAR_SEQUENCE_TASK:(t,p,i)=>{game(t,i).sequences.clear(t.readInt(p[0]));},
 // The handler checks the index it is given and then sets the repeat mode of the active sequence instead.
 SET_SEQUENCE_TO_REPEAT:(t,p,i)=>{game(t,i).sequences.setRepeatMode(t.readInt(p[0]),bool(t,p[1]));},
 PERFORM_SEQUENCE_TASK:(t,p,i)=>{
  const sequence=game(t,i).sequences.at(t.readInt(p[1]));
  world(t,i,'givePedSequence')(t.readInt(p[0]),sequence.tasks,sequence.repeatMode!==0,i.opcode&0x7fff);
 },
 // --- The tasks a script hands a ped (CharacterCommands.cpp is reversed for these four).
 // A ped handle of -1 does not name a ped at all: the task joins the sequence being recorded.
 TASK_KILL_CHAR_ON_FOOT:(t,p,i)=>{
  scriptedTask(t,i,t.readInt(p[0]),{kind:'killPedOnFoot',target:t.readInt(p[1]),time:-1,flags:0,actionDelay:0,actionChance:0,mustBeOnFoot:true});
 },
 TASK_KILL_CHAR_ON_FOOT_WHILE_DUCKING:(t,p,i)=>{
  scriptedTask(t,i,t.readInt(p[0]),{kind:'killPedOnFoot',target:t.readInt(p[1]),time:-1,
   flags:t.readInt(p[2]),actionDelay:t.readInt(p[3]),actionChance:t.readInt(p[4]),mustBeOnFoot:true});
 },
 TASK_TURN_CHAR_TO_FACE_CHAR:(t,p,i)=>{scriptedTask(t,i,t.readInt(p[0]),{kind:'turnToFaceEntity',target:t.readInt(p[1])});},
 /* The rest of the tasks the script hands its peds. Their operands come from the pinned Sanny Builder schema
  * this project already generates its opcode table from, which names and types each one; the reference reverses
  * none of them and does not name them at all. A handle of -1 still records the task into the open sequence
  * rather than giving it to a ped, which is the runtime's own rule and applies to every task alike. */
 TASK_GO_STRAIGHT_TO_COORD:(t,p,i)=>{
  const point=vec(t,p,1);
  scriptedTask(t,i,t.readInt(p[0]),{kind:'goStraightToCoord',...point,speed:t.readInt(p[4]),time:t.readInt(p[5])});
 },
 TASK_FOLLOW_PATH_NODES_TO_COORD:(t,p,i)=>{
  const point=vec(t,p,1);
  scriptedTask(t,i,t.readInt(p[0]),{kind:'followPathNodesToCoord',...point,speed:t.readInt(p[4]),time:t.readInt(p[5])});
 },
 // The two animation tasks differ only in whether anything may interrupt them.
 TASK_PLAY_ANIM:(t,p,i)=>{scriptedTask(t,i,t.readInt(p[0]),playAnimTask(t,p,true));},
 TASK_PLAY_ANIM_NON_INTERRUPTABLE:(t,p,i)=>{scriptedTask(t,i,t.readInt(p[0]),playAnimTask(t,p,false));},
 TASK_STAY_IN_SAME_PLACE:(t,p,i)=>{scriptedTask(t,i,t.readInt(p[0]),{kind:'stayInSamePlace',state:bool(t,p[1])});},
 TASK_TOGGLE_DUCK:(t,p,i)=>{scriptedTask(t,i,t.readInt(p[0]),{kind:'toggleDuck',state:bool(t,p[1])});},
 TASK_ACHIEVE_HEADING:(t,p,i)=>{scriptedTask(t,i,t.readInt(p[0]),{kind:'achieveHeading',heading:t.readFloat(p[1])});},
 TASK_PAUSE:(t,p,i)=>{scriptedTask(t,i,t.readInt(p[0]),{kind:'pause',time:t.readInt(p[1])});},
 TASK_LEAVE_ANY_CAR:(t,p,i)=>{scriptedTask(t,i,t.readInt(p[0]),{kind:'leaveAnyCar'});},
 TASK_LOOK_AT_CHAR:(t,p,i)=>{
  scriptedTask(t,i,t.readInt(p[0]),{kind:'lookAtPed',target:t.readInt(p[1]),time:t.readInt(p[2])});
 },
 // The driving task names two styles, one before the model it may swap to and one after.
 TASK_CAR_DRIVE_TO_COORD:(t,p,i)=>{
  const point=vec(t,p,2);
  scriptedTask(t,i,t.readInt(p[0]),{kind:'carDriveToCoord',vehicle:t.readInt(p[1]),...point,
   speed:t.readFloat(p[5]),driveStyle:t.readInt(p[6]),model:model(t,i,p[7]),drivingStyle:t.readInt(p[8])});
 },
 TASK_DRIVE_BY:(t,p,i)=>{
  const point=vec(t,p,3);
  scriptedTask(t,i,t.readInt(p[0]),{kind:'driveBy',targetPed:t.readInt(p[1]),targetVehicle:t.readInt(p[2]),
   ...point,radius:t.readFloat(p[6]),type:t.readInt(p[7]),rightHandCarSeat:bool(t,p[8]),fireRate:t.readInt(p[9])});
 },
 // The route a task follows, which the script builds a point at a time and then flushes.
 // CPointRoute holds eight points (0x64 bytes), and a point past the eighth is not added (Route::AddUnlessFull).
 EXTEND_ROUTE:(t,p,i)=>{const route=game(t,i).route;if(route.length<8)route.push({...vec(t,p,0)});},
 FLUSH_ROUTE:(t,_p,i)=>{game(t,i).route.length=0;},
 CLEAR_CHAR_TASKS_IMMEDIATELY:(t,p,i)=>{world(t,i,'clearPedTasksImmediately')(t.readInt(p[0]));},
 // --- The vehicles a script holds (VehicleCommands.cpp is reversed; the creation dispatch reaches
 // CCarCtrl::CreateCarForScript, which is). A host owns them and answers by handle.
 CREATE_CAR:(t,p,i)=>{
  const position=vec(t,p,1);
  t.writeInt(p[4],world(t,i,'createCar')(model(t,i,p[0]),position.x,position.y,position.z));
 },
 DELETE_CAR:(t,p,i)=>{world(t,i,'deleteVehicle')(t.readInt(p[0]));},
 IS_CAR_DEAD:(t,p,i)=>{
  const handle=t.readInt(p[0]),exists=world(t,i,'vehicleExists')(handle);
  t.updateCompareFlag(!exists||world(t,i,'vehicleIsDeadForScript')(handle),negated(i));
 },
 MARK_CAR_AS_NO_LONGER_NEEDED:(t,p,i)=>{world(t,i,'markVehicleNoLongerNeeded')(t.readInt(p[0]));},
 GET_CAR_COORDINATES:(t,p,i)=>{
  const position=world(t,i,'vehiclePosition')(t.readInt(p[0]));
  t.writeFloat(p[1],position.x);t.writeFloat(p[2],position.y);t.writeFloat(p[3],position.z);
 },
 // A point at or below MAP_Z_LOW_LIMIT is the ground's under it (FindGroundZForCoord).
 SET_CAR_COORDINATES:(t,p,i)=>{
  const v=vec(t,p,1);if(v.z<=ScmCamera.MAP_Z_LOW_LIMIT)v.z=world(t,i,'groundZForCoord')(v.x,v.y);
  world(t,i,'setVehicleCoordinates')(t.readInt(p[0]),v.x,v.y,v.z);
 },
 GET_CAR_HEADING:(t,p,i)=>{t.writeFloat(p[1],fixAngleDegrees(world(t,i,'vehicleHeading')(t.readInt(p[0]))));},
 SET_CAR_HEADING:(t,p,i)=>{world(t,i,'setVehicleHeading')(t.readInt(p[0]),fixAngleDegrees(t.readFloat(p[1])));},
 SET_CAR_PROOFS:(t,p,i)=>{world(t,i,'setVehicleProofs')(t.readInt(p[0]),{bullet:bool(t,p[1]),fire:bool(t,p[2]),explosion:bool(t,p[3]),collision:bool(t,p[4]),melee:bool(t,p[5])});},
 IS_CHAR_IN_ANY_CAR:(t,p,i)=>{t.updateCompareFlag(world(t,i,'pedVehicle')(t.readInt(p[0]))!==undefined,negated(i));},
 IS_CHAR_IN_CAR:(t,p,i)=>{
  const inside=world(t,i,'pedVehicle')(t.readInt(p[0]));
  t.updateCompareFlag(inside!==undefined&&inside===t.readInt(p[1]),negated(i));
 },
 IS_CHAR_IN_MODEL:(t,p,i)=>{
  const inside=world(t,i,'pedVehicle')(t.readInt(p[0]));
  t.updateCompareFlag(inside!==undefined&&world(t,i,'vehicleModel')(inside)===model(t,i,p[1]),negated(i));
 },
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
 INCREMENT_INT_STAT:(t,p,i)=>{const stat=t.readInt(p[0]),v=t.readInt(p[1]);game(t,i).stats.increment(stat,v);game(t,i).stats.onUpdateMessage?.(true,stat,v);},
 INCREMENT_FLOAT_STAT:(t,p,i)=>{const stat=t.readInt(p[0]),v=t.readFloat(p[1]);game(t,i).stats.increment(stat,v);game(t,i).stats.onUpdateMessage?.(true,stat,v);},
 DECREMENT_INT_STAT:(t,p,i)=>{const stat=t.readInt(p[0]),v=t.readInt(p[1]);game(t,i).stats.decrement(stat,v);game(t,i).stats.onUpdateMessage?.(false,stat,v);},
 DECREMENT_FLOAT_STAT:(t,p,i)=>{const stat=t.readInt(p[0]),v=t.readFloat(p[1]);game(t,i).stats.decrement(stat,v);game(t,i).stats.onUpdateMessage?.(false,stat,v);},
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
 // CWanted::SetWantedLevel clamps to MaximumWantedLevel itself; the no-drop test compares the level asked for.
 ALTER_WANTED_LEVEL:(t,p,i)=>{game(t,i).wanted.setWantedLevel(t.readInt(p[1]));},
 ALTER_WANTED_LEVEL_NO_DROP:(t,p,i)=>{game(t,i).wanted.setWantedLevelNoDrop(t.readInt(p[1]));},
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
 // The progress made against the total the script set, as a percentage; a total of nothing is no progress
 // rather than a division by it.
 GET_PROGRESS_PERCENTAGE:(t,p,i)=>{
  const state=game(t,i);
  t.writeFloat(p[0],state.progressTotal>0?state.stats.get(STAT_PROGRESS_MADE)/state.progressTotal*100:0);
 },
 REGISTER_MISSION_GIVEN:(t,_p,i)=>{game(t,i).stats.increment(STAT_MISSION_ATTEMPTS,1);},
 INCREMENT_INT_STAT_NO_MESSAGE:(t,p,i)=>{game(t,i).stats.increment(t.readInt(p[0]),t.readInt(p[1]));},
 INCREMENT_FLOAT_STAT_NO_MESSAGE:(t,p,i)=>{game(t,i).stats.increment(t.readInt(p[0]),t.readFloat(p[1]));},
 SET_PED_DENSITY_MULTIPLIER:(t,p,i)=>{game(t,i).pedDensityMultiplier=t.readFloat(p[0]);},
 SET_DISABLE_MILITARY_ZONES:(t,p,i)=>{game(t,i).militaryZonesDisabled=bool(t,p[0]);},
 DISPLAY_RADAR:(t,p,i)=>{game(t,i).displayRadar=bool(t,p[0]);},
 SET_AREA_NAME:(t,p,i)=>{game(t,i).areaName=t.text(p[0]);},
 // CGarages::AllRespraysCloseOrOpen goes with this flag; the garages themselves are not ported.
 // SetNoResprays: the flag, then AllRespraysCloseOrOpen with that same flag.
 SET_NO_RESPRAYS:(t,p,i)=>{const on=bool(t,p[0]);game(t,i).noResprays=on;game(t,i).garages.allRespraysCloseOrOpen(on);},
 // The two cheats the script switches are entries of CCheat's own table, which neither has a function of its
 // own, so applying one comes to setting it and disabling it to clearing it.
 SET_ALL_TAXIS_HAVE_NITRO:(t,p,i)=>{game(t,i).cheats.set(CHEAT_ALL_TAXIS_NITRO,bool(t,p[0]));},
 ACTIVATE_PIMP_CHEAT:(t,p,i)=>{game(t,i).cheats.set(CHEAT_PROSTITUTES_PAY_YOU,bool(t,p[0]));},
 ARE_ANY_CAR_CHEATS_ACTIVATED:(t,_p,i)=>{t.updateCompareFlag(game(t,i).cheats.anyCarCheatsActivated,negated(i));},
 // SHAKE_PAD: CPad::GetPad(padId)->StartShake(time, intensity, 0).
 SHAKE_PAD:(t,p,i,nowMs)=>{game(t,i).pads.startShake(t.readInt(p[0]),t.readInt(p[1]),t.readInt(p[2]),0,nowMs);},
 // IS_XBOX_VERSION is false in every build this port runs, and DO_DEBUG_STUFF counts itself and does no more.
 IS_XBOX_VERSION:(t,_p,i)=>{t.updateCompareFlag(false,negated(i));},
 DO_DEBUG_STUFF:(t,_p,i)=>{game(t,i).debugStuff++;},
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
 // The script's texture slot: which dictionary it holds is the script's own state; drawing its sprites is the host's.
 LOAD_TEXTURE_DICTIONARY:(t,p,i)=>{game(t,i).introRectangles.dictionary=t.text(p[0]).toLowerCase();},
 REMOVE_TEXTURE_DICTIONARY:(t,_p,i)=>{game(t,i).introRectangles.dictionary=undefined;},
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
 MARK_OBJECT_AS_NO_LONGER_NEEDED:(t,p,i)=>{game(t,i).objects.markNoLongerNeeded(t.readInt(p[0]));},
 DONT_REMOVE_OBJECT:(t,p,i)=>{game(t,i).objects.releaseFromCleanup(t.readInt(p[0]));},
 GET_OBJECT_COORDINATES:(t,p,i)=>{
  const position=game(t,i).objects.at(t.readInt(p[0])).position;
  t.writeFloat(p[1],position.x);t.writeFloat(p[2],position.y);t.writeFloat(p[3],position.z);
 },
 SET_OBJECT_COORDINATES:(t,p,i)=>{game(t,i).objects.setPosition(t.readInt(p[0]),vec(t,p,1));},
 GET_OBJECT_HEADING:(t,p,i)=>{t.writeFloat(p[1],game(t,i).objects.getHeading(t.readInt(p[0])));},
 SET_OBJECT_HEADING:(t,p,i)=>{game(t,i).objects.setHeading(t.readInt(p[0]),t.readFloat(p[1]));},
 // ROTATE_OBJECT: the reference registers this nowhere, so only what the script itself does is known. Its one
 // use turns an object from ninety degrees to ninety with the collision check off, which finishes at once, so
 // the runtime sets the heading to the angle asked for and reports the rotation done. A call whose two angles
 // differ would need the real handler to say how it steps between them and when it reports finished.
 ROTATE_OBJECT:(t,p,i)=>{
  const from=t.readFloat(p[1]),to=t.readFloat(p[2]);
  requireAsset(from===to,'ROTATE_OBJECT between two different angles needs the handler the reference does not carry.');
  game(t,i).objects.setHeading(t.readInt(p[0]),to);
  t.updateCompareFlag(true,negated(i));
 },
 // SET_OBJECT_ROTATION: CPlaceable::SetOrientation's three angles, the last of which is the heading.
 SET_OBJECT_ROTATION:(t,p,i)=>{const v=vec(t,p,1);game(t,i).objects.setRotation(t.readInt(p[0]),v.x,v.y,v.z);},
 GET_OBJECT_VELOCITY:(t,p,i)=>{
  const velocity=game(t,i).objects.getVelocity(t.readInt(p[0]));
  t.writeFloat(p[1],velocity.x);t.writeFloat(p[2],velocity.y);t.writeFloat(p[3],velocity.z);
 },
 SET_OBJECT_VELOCITY:(t,p,i)=>{game(t,i).objects.setVelocity(t.readInt(p[0]),vec(t,p,1));},
 SET_OBJECT_SCALE:(t,p,i)=>{game(t,i).objects.setScale(t.readInt(p[0]),t.readFloat(p[1]));},
 SET_OBJECT_COLLISION:(t,p,i)=>{game(t,i).objects.setUsesCollision(t.readInt(p[0]),bool(t,p[1]));},
 // CONNECT_LODS: CEntity::SetLod, pointing the detailed object at the one that stands in for it far away.
 CONNECT_LODS:(t,p,i)=>{game(t,i).objects.connectLods(t.readInt(p[0]),t.readInt(p[1]));},
 // SET_OBJECT_AREA_VISIBLE: CEntity::SetAreaCode, which the reversed char command sets for a ped.
 SET_OBJECT_AREA_VISIBLE:(t,p,i)=>{game(t,i).objects.setAreaVisible(t.readInt(p[0]),t.readInt(p[1]));},
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
 // CREATE_CAR_GENERATOR_WITH_PLATE: the same generator, with a plate registered for it in the handler that
 // holds fifteen of them.
 CREATE_CAR_GENERATOR_WITH_PLATE:(t,p,i,now)=>{
  const g=game(t,i),v=vec(t,p,0);
  const index=g.carGenerators.create({position:[v.x,v.y,v.z],angle:t.readFloat(p[3]),modelId:t.readInt(p[4]),
   primaryColour:t.readInt(p[5]),secondaryColour:t.readInt(p[6]),forceSpawn:bool(t,p[7]),
   alarmChance:t.readInt(p[8]),doorLockChance:t.readInt(p[9]),minDelay:t.readInt(p[10]),maxDelay:t.readInt(p[11])},now);
  if(index>=0)g.carGenerators.addPlate(index,t.text(p[12]));
  t.writeInt(p[13],index);
 },
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
