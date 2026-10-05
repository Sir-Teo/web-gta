import {SOUND,type NativeAudioEntity,type NativePhysicalEntity,type NativeSound,type NativeVec} from './NativeSound';
import type {NativeSoundManager} from './NativeSoundManager';
import type {NativeBankLoader} from './NativeBankLoader';
import {randomInt,type AudioRandom} from './nativeAudioUtility';
import {NativeDoorAudio} from './NativeDoorAudio';
/* CAEScriptAudioEntity::ProcessMissionAudioEvent (0x4ECCF0), which REPORT_MISSION_AUDIO_EVENT_AT_* hands a script's
 * sound to. gta-reversed leaves it a call into the exe; its commented decompilation has the right handlers but case
 * labels it says need fixing (they are script-slot names, 7000 and up, not the 1000 to 1190 the scripts report). The
 * iOS executable's (arm64 0x100157360: a jump table at 0x10015888c over events 104 to 1190) gives each event's
 * handler, and the table below is read from it.
 *
 * Ported: the events that hand on to the frontend entity, those that play a resident GENRL sound
 * (PlayResidentSoundEvent, 0x1001566a8), and PlayMissionBankSound's (0x100156bcc): a sound of the SCRIPT bank a script
 * has loaded whole into its mission audio slot 3 or 4 (link 2 or 3, bank slot 28 or 29), and the mission's own
 * ambience track's starts and stops, the cranes' and the garage doors'. Not yet: a few others; those are recorded and
 * play nothing. */

/** A PlayResidentSoundEvent: bank slot, bank, sound (or an inclusive random range of sounds), the start percentage,
 * the volume offset and the speed. Its last argument, the roll-off, is 1 for every one here. */
type Resident=readonly [slot:number,bank:number,sound:number|readonly [number,number],percent:number,volume:number,speed:number];
/** A PlayMissionBankSound: the sound (or an inclusive random range), the link (the mission audio slot index, 2 or 3),
 * whether it is skipped while one of the event's own plays, the volume offset, the roll-off and the speed. */
type MissionBank=readonly [sound:number|readonly [number,number],link:number,once:boolean,volume:number,rollOff:number,speed:number];
/** What a handler does first: stop the sounds of another event (with `stopAtEntity`, only those at the report's entity
 * when it names one: CancelSoundsOfThisEventPlayingForThisEntityAndPhysical), or only play while none of its own
 * plays. */
type MissionAudioCase={frontend:number;speed?:number}|{resident:readonly Resident[];once?:boolean}|{bank:readonly MissionBank[];stop?:number;stopAtEntity?:boolean;once?:boolean}|{stop:number;stopAtEntity?:boolean}|{custom:'keypad'|'stereo'}|{ambience:number}|{ambienceStop:true}|{crane:'enter'|'move'|'stop'|'exit'}|{door:number;speed:number};
const COLLISIONS=[2,39] as const,WEAPONS=[5,143] as const;
const r=(bank:readonly [number,number],sound:Resident[2],percent=0,volume=0,speed=1):Resident=>[bank[0],bank[1],sound,percent,volume,speed];
const b=(sound:MissionBank[0],link:number,once:boolean,volume:number,rollOff:number,speed:number):{bank:readonly MissionBank[]}=>({bank:[[sound,link,once,volume,rollOff,speed]]});
/** The mission-bank handlers that do one thing (80 of them), read out of the iOS jump table. */
const MISSION_BANK_EVENTS:Readonly<Record<number,MissionAudioCase>>={
 1005:b(1,2,false,0,2,1),1007:b(0,2,false,0,2,1),1011:b(3,3,false,0,2,1),1014:b(10,3,false,0,2,1),1016:b(8,3,false,0,2,1),1018:b(7,3,false,0,2,1),
 1025:b(1,3,false,0,2,1),1026:b(0,3,false,0,2,1),1029:b(2,2,false,0,2,1),1030:b(1,2,false,0,2,1),1032:b(1,3,false,0,2,1),1033:b(0,3,false,0,2,1),
 1041:b(8,3,false,0,2,1),1042:b(0,3,true,0,2,1),1043:b(2,3,true,0,2,1),1044:b(1,3,true,0,2,1),1045:b(5,3,false,0,2,1),1046:b(4,3,false,0,2,1),
 1047:b(3,3,true,0,2,1),1048:b(7,3,true,0,2,1),1049:b(6,3,true,0,2,1),1050:b(9,3,true,0,2,1),1051:b(10,3,true,0,2,1),1059:b(5,3,false,0,2,1),
 1060:b(2,3,false,0,2,1),1061:b(3,3,false,0,2,1),1064:b(6,3,false,0,2,1),1065:b(0,3,false,0,2,1),1066:b(1,3,false,0,2,1),1067:b(4,3,true,0,2,1),
 1070:b(6,3,false,0,2,1),1071:b(4,3,false,0,2,1),1072:b(2,3,false,0,2,1),1073:b(5,3,false,0,2,1),1074:b(1,3,false,0,2,1),1075:b(1,3,false,0,2,.79),
 1078:b(3,3,true,0,2,1),1079:b(2,2,true,0,3,1),1080:b(1,2,true,0,3,1),1086:b(0,3,false,0,2,1),1087:b(3,3,false,0,2,1),1089:b(0,3,false,0,2,1),
 1090:b(1,3,false,0,2,1),1102:b(0,2,false,0,2,1),1103:b(1,2,false,0,2,1),1104:b(1,2,false,0,2,1),1105:b(2,2,false,0,2,1),1110:b(0,2,false,0,2,1),
 1111:b(1,2,false,0,2,1),1113:b(0,3,true,-18,2,1),1115:b(2,3,false,0,2,1),1116:b(3,3,false,0,2,1),1117:b(7,3,false,0,2,1),1118:b(1,3,true,-18,2,1),
 1120:b(0,3,false,0,2,1),1121:b(1,3,false,0,2,1),1122:b(2,3,true,0,2,1),1123:b(4,3,false,0,2,1),1124:b(5,3,true,0,2,1),1125:b(0,2,false,0,2,1),
 1151:b(1,2,false,0,2,1),1152:b(0,2,false,0,2,1),1155:b(0,2,false,0,2,1),1156:b(1,2,false,0,2,1),1158:b(3,3,false,0,2,1),1161:b(1,2,false,0,2,1),
 1167:b(0,3,true,0,2,1),1168:b(0,3,false,0,2,1),1169:b(1,3,false,0,2,1),1170:b(6,3,false,0,2,1),1171:b(1,3,false,0,2,1),1172:b(2,3,false,0,2,1),
 1173:b(5,3,false,0,2,.67),1174:b(5,3,false,0,2,.79),1175:b(5,3,false,0,2,1),1176:b(8,3,true,0,2,.38),1177:b(0,3,true,0,2,1),1178:b(3,3,true,0,2,1),
 1179:b(4,3,false,0,2,1),1180:b(7,3,false,0,2,1),
 // A random sound of a range.
 1010:b([0,2],3,false,0,2,1),1017:b([3,5],3,false,0,2,1),1031:b([2,6],3,false,0,2,1),
 // Only while none of its own plays.
 1012:{...b(4,3,false,0,2,1),once:true},
 // A start and its loop; the partner stops them and plays the end.
 1081:{bank:[[3,2,true,0,3,1],[0,2,false,0,3,1]]},1082:{bank:[[4,2,true,0,3,1]],stop:1081},
 1108:{bank:[[1,2,false,0,2,1],[0,2,false,0,2,1]]},1109:{bank:[[2,2,false,0,2,1]],stop:1108},
 1126:{bank:[[1,2,false,0,2,1],[0,2,false,0,2,1]]},1127:{bank:[[2,2,false,0,2,1]],stop:1126},
 1128:{bank:[[2,2,false,0,2,1],[0,2,false,0,2,1]]},1129:{bank:[[3,2,false,0,2,1]],stop:1128,stopAtEntity:true},
 1088:{bank:[[2,3,false,0,2,1]],stop:1089,stopAtEntity:true},
 // Stops alone.
 1006:{stop:1005},1008:{stop:1007},1034:{stop:1033,stopAtEntity:true},1162:{stop:1161,stopAtEntity:true},
 // Whichever of two banks is in slot 28 decides the sound: the keypad's (or Black Project's), else Uncle Sam's.
 1028:{custom:'keypad'},1107:{custom:'keypad'},
 // A left and a right sound ahead of the listener.
 1164:{custom:'stereo'},
};
/** The handlers, by event, as the iOS executable's ProcessMissionAudioEvent has them. Frontend events: 1 select, 2
 * back, 4 error, 7 money, 14 no cash, 16 respray, 40 purchase, 43 part mission complete, 44 3-2-1, 45 go, 46 car mod. */
export const MISSION_AUDIO_EVENTS:Readonly<Record<number,MissionAudioCase>>={
 1002:{resident:[r(COLLISIONS,64,35,0,.79)]},
 1009:{resident:[r(COLLISIONS,[20,28])]},
 1027:{resident:[r(COLLISIONS,19,70)]},
 1039:{resident:[r(WEAPONS,65)]},
 1052:{frontend:40},1053:{frontend:14},1054:{frontend:40},1055:{frontend:14},
 1056:{frontend:44},1057:{frontend:45},1058:{frontend:43},
 1083:{frontend:1},1084:{frontend:2},1085:{frontend:4},
 1095:{resident:[r(COLLISIONS,65,16)]},
 // With the entity's flag at +0x92 set (its setter is not known) these are sound 69 at 63% and 33% (the second at
 // 0.94 speed); with it clear, as here, sound 70 at 62% and 25%.
 1100:{resident:[r(COLLISIONS,70,62)]},
 1101:{resident:[r(COLLISIONS,70,25)]},
 1130:{resident:[r(WEAPONS,58),r(WEAPONS,40)]},
 1131:{resident:[r(COLLISIONS,33),r(COLLISIONS,50,22,0,.79)]},
 1133:{frontend:46},1134:{frontend:16},
 1135:{resident:[r(WEAPONS,34,0,5),r(WEAPONS,40)]},
 1136:{resident:[r(WEAPONS,82,0,-3)]},
 1137:{frontend:43,speed:1.12},1138:{frontend:43},1139:{frontend:43,speed:1.26},
 1140:{resident:[r(COLLISIONS,[20,28])]},
 1141:{resident:[r(COLLISIONS,[20,28]),r(COLLISIONS,65)]},
 1145:{resident:[r(COLLISIONS,19,65)]},
 // Only while none of this event's is playing for the entity: HORN sound 7.
 1147:{resident:[[17,74,7,0,0,1]],once:true},
 1148:{resident:[r(COLLISIONS,[20,28])]},
 1149:{frontend:43},1150:{frontend:7},
 1163:{resident:[[41,0,0,0,0,1]]},
 1190:{resident:[r(WEAPONS,[78,80])]},
 ...MISSION_BANK_EVENTS,
 // A garage door the script works (its own CAEDoorAudioEntity, the iOS entity's +0x170): opening, at 0.79 for 1165,
 // and opened, at the entity's position or the point.
 1035:{door:159,speed:1},1153:{door:159,speed:1},1165:{door:159,speed:.79},1036:{door:160,speed:1},1154:{door:160,speed:1},1166:{door:160,speed:1},
 // The cranes (crane1 to crane3.scm): CRANE_P into the player engine slot, its motor, its stop and leaving it.
 1019:{crane:'enter'},1020:{crane:'move'},1021:{crane:'stop'},1022:{crane:'exit'},
 // The mission's own ambience track (the AMBIENCE pack's) and its stop: CAEAmbienceTrackManager's
 // PlaySpecialMissionAmbienceTrack and StopSpecialMissionAmbienceTrack (iOS 0x100141480, 0x100141488).
 1062:{ambience:153},1063:{ambienceStop:true},1068:{ambience:150},1069:{ambienceStop:true},1076:{ambience:141},1077:{ambienceStop:true},
 1097:{ambience:145},1098:{ambienceStop:true},1142:{ambience:160},1143:{ambienceStop:true},1181:{ambience:172},1182:{ambienceStop:true},
 1183:{ambience:149},1184:{ambienceStop:true},1185:{ambience:142},1186:{ambienceStop:true},1187:{ambience:161},1188:{ambienceStop:true},
};
/** CAEScriptAudioEntity's mission bank slots begin at 26 (SND_BANK_SLOT_MISSION_*): a script slot's bank sits at 26
 * plus its index. */
export const MISSION_BANK_SLOT_FIRST=26;
/** Where a report is heard: a point, or the entity it is at (whose position the sound follows). */
export type MissionAudioAt={position:NativeVec}|{physical:NativePhysicalEntity};
export class NativeScriptAudio implements NativeAudioEntity {
 /** Reports handled and reports this cannot play yet, by event, for diagnostics. */
 readonly handled=new Map<number,number>();readonly unported=new Map<number,number>();
 /** CAudioEngine's ambience track manager, the host's. */
 ambience?:{playSpecialMissionAmbienceTrack(track:number):void;stopSpecialMissionAmbienceTrack():void};
 /** The script's own CAEDoorAudioEntity. */
 readonly door:NativeDoorAudio;
 /** The crane being worked (the entity's +0x91 and +0x168 in the iOS executable). */
 private crane?:{physical?:NativePhysicalEntity};
 /** Each mission audio slot's record bank (m_nBankId): the SCRIPT bank a whole-bank LOAD_MISSION_AUDIO put in it, or -1. */
 readonly missionBanks=[-1,-1,-1,-1];
 constructor(private manager:NativeSoundManager,private bank:NativeBankLoader,private defaultVolume:(event:number)=>number,private random:AudioRandom,
  private frontend:(event:number,volumeBoost:number,speed:number)=>void){this.door=new NativeDoorAudio(manager,bank,defaultVolume);}
 updateParameters(_sound:NativeSound,_playPosition:number){}
 snapshot(){return {handled:Object.fromEntries(this.handled),unported:Object.fromEntries(this.unported)};}
 /** ProcessMissionAudioEvent. */
 processMissionAudioEvent(event:number,at:MissionAudioAt){
  const c=MISSION_AUDIO_EVENTS[event];
  if(!c){this.unported.set(event,(this.unported.get(event)??0)+1);return;}
  this.handled.set(event,(this.handled.get(event)??0)+1);
  if('frontend' in c){this.frontend(c.frontend,0,c.speed??1);return;}
  if('crane' in c){this.craneEvent(c.crane,event,at);return;}
  if('door' in c){const position='physical' in at?at.physical.position():at.position;if(position)this.door.addAudioEvent(c.door,{...position},0,c.speed);return;}
  if('ambience' in c){this.ambience?.playSpecialMissionAmbienceTrack(c.ambience);return;}
  if('ambienceStop' in c){this.ambience?.stopSpecialMissionAmbienceTrack();return;}
  const pick=(sound:number|readonly [number,number])=>typeof sound==='number'?sound:randomInt(this.random,sound[0],sound[1]);
  if('custom' in c){
   if(c.custom==='stereo'){for(const [sound,x] of [[0,-1],[1,1]] as const)this.playMissionBankSound(event,{position:{x,y:0,z:0}},sound,3,false,0,2,1);return;}
   // 1028 and 1107: the keypad's sound 0 (or Black Project's 3) when that bank is in slot 28, else Uncle Sam's 3 (4).
   const [own,ownSound,otherSound]=event===1028?[242,0,3]:[167,3,4];
   if(this.bank.isSoundBankLoaded(own,MISSION_BANK_SLOT_FIRST+2))this.playMissionBankSound(event,at,ownSound,2,false,0,2,1);
   else if(this.bank.isSoundBankLoaded(345,MISSION_BANK_SLOT_FIRST+2))this.playMissionBankSound(event,at,otherSound,2,false,0,2,1);
   return;
  }
  if('stop' in c&&c.stop!==undefined){
   if(c.stopAtEntity&&'physical' in at)this.manager.cancelSoundsOfThisEventPlayingForThisEntityAndPhysical(c.stop,this,at.physical);
   else this.manager.cancelSoundsOfThisEventPlayingForThisEntity(c.stop,this);
  }
  if('once' in c&&c.once&&this.manager.areSoundsOfThisEventPlayingForThisEntity(event,this))return;
  if('resident' in c)for(const [slot,bank,sound,percent,volume,speed] of c.resident)this.playResidentSoundEvent(slot,bank,pick(sound),event,at,volume,speed,percent);
  if('bank' in c)for(const [sound,link,once,volume,rollOff,speed] of c.bank)this.playMissionBankSound(event,at,pick(sound),link,once,volume,rollOff,speed);
 }
 /** The crane's four events (iOS 0x100157648 on): entering loads CRANE_P (44) into the player engine slot (40),
  * cutting off what plays there, and marks the crane worked; its motor (sound 1) starts unless it already runs for
  * that crane; stopping cuts the motor and plays sound 2; leaving cuts the slot and plays sound 3. Each at a roll-off
  * of 2.5, and only while a crane is worked. */
 private craneEvent(kind:'enter'|'move'|'stop'|'exit',event:number,at:MissionAudioAt){
  const CRANE_P=44,SLOT_PLAYER_ENGINE=40,physical='physical' in at?at.physical:undefined;
  if(kind==='enter'){
   if(!this.bank.isSoundBankLoaded(CRANE_P,SLOT_PLAYER_ENGINE)){
    if(this.manager.areSoundsPlayingInBankSlot(SLOT_PLAYER_ENGINE))this.manager.cancelSoundsInBankSlot(SLOT_PLAYER_ENGINE,false);
    this.bank.loadSoundBank(CRANE_P,SLOT_PLAYER_ENGINE);
   }
   this.crane={physical};return;
  }
  if(!this.crane)return;
  const motor=1020;
  if(kind==='move'){
   if(this.manager.areSoundsOfThisEventPlayingForThisEntityAndPhysical(motor,this,physical))return;
   this.playResidentSoundEvent(SLOT_PLAYER_ENGINE,CRANE_P,1,event,at,0,1,0,2.5);return;
  }
  if(kind==='stop'){
   if(physical)this.manager.cancelSoundsOfThisEventPlayingForThisEntityAndPhysical(motor,this,physical);
   else this.manager.cancelSoundsOfThisEventPlayingForThisEntity(motor,this);
   this.playResidentSoundEvent(SLOT_PLAYER_ENGINE,CRANE_P,2,event,at,0,1,0,2.5);return;
  }
  this.manager.cancelSoundsInBankSlot(SLOT_PLAYER_ENGINE,true);
  this.playResidentSoundEvent(SLOT_PLAYER_ENGINE,CRANE_P,3,event,at,0,1,0,2.5);
  this.crane=undefined;
 }
 /** A whole SCRIPT bank for mission audio slot `index` (PreloadMissionAudio with a sample of 1800 to 1829): loaded into
  * bank slot 26 plus the index, the slot's record taking it. Resolves once it is in (true) or cannot be had. */
 loadMissionBank(index:number,bank:number):Promise<boolean>{
  this.missionBanks[index]=bank;
  return this.bank.loadSoundBankAsync(bank,MISSION_BANK_SLOT_FIRST+index);
 }
 /** CLEAR_MISSION_AUDIO: the slot's record lets its bank go. */
 clearMissionBank(index:number){this.missionBanks[index]=-1;}
 /** PlayMissionBankSound (0x100156bcc in the iOS executable): only through link 2 or 3; skipped, if asked, while one of
  * the event's own plays; else once the slot's bank is in its bank slot, the sound at the event's default volume plus
  * the offset, at the entity (lasting no longer than it), at the point, or ahead of the listener (a point of zeros or
  * the -1000 sentinel), left or right of it ((-1,0,0) and (1,0,0)). */
 private playMissionBankSound(event:number,at:MissionAudioAt,sound:number,link:number,once:boolean,volume:number,rollOff:number,speed:number){
  if(link!==2&&link!==3)return;
  if(once&&this.manager.areSoundsOfThisEventPlayingForThisEntity(event,this))return;
  const bank=this.missionBanks[link],slot=MISSION_BANK_SLOT_FIRST+link;
  if(bank<0||!this.bank.isSoundBankLoaded(bank,slot))return;
  const physical='physical' in at?at.physical:undefined,point='position' in at?at.position:undefined;
  const ahead=!physical&&!!point&&(point.x===0&&point.y===0&&point.z===0||point.x===-1000&&point.y===-1000&&point.z===-1000);
  const side=!physical&&!!point&&(point.x===1||point.x===-1)&&point.y===0&&point.z===0;
  const position=physical?physical.position()??{x:0,y:0,z:0}:ahead?{x:0,y:1,z:0}:point!;
  this.manager.playSound({slot,sound,entity:this,position,volume:this.defaultVolume(event)+volume,rollOff,speed,doppler:1,event,physical,
   flags:SOUND.requestUpdates|SOUND.uncancellable|(ahead||side?SOUND.frontEnd:0)|(physical?SOUND.lifespanTiedToEntity:0)});
 }
 /** PlayResidentSoundEvent (0x1001566a8 in the iOS executable): once the bank is in its slot, the sound at the event's
  * default volume plus the offset, started its percentage in; at the entity (and lasting no longer than it), else at
  * the point, else (a point of zeros or the -1000 sentinel) ahead of the listener as a front-end sound. */
 private playResidentSoundEvent(slot:number,bank:number,sound:number,event:number,at:MissionAudioAt,volume:number,speed:number,percent:number,rollOff=1){
  if(!this.bank.isSoundBankLoaded(bank,slot))return;
  const physical='physical' in at?at.physical:undefined,point='position' in at?at.position:undefined;
  const frontEnd=!physical&&!!point&&(point.x===0&&point.y===0&&point.z===0||point.x===-1000&&point.y===-1000&&point.z===-1000);
  const position=physical?physical.position()??{x:0,y:0,z:0}:frontEnd?{x:0,y:1,z:0}:point!;
  this.manager.playSound({slot,sound,entity:this,position,volume:this.defaultVolume(event)+volume,rollOff,speed,doppler:1,event,playTime:percent,physical,
   flags:SOUND.startPercentage|SOUND.requestUpdates|SOUND.uncancellable|(frontEnd?SOUND.frontEnd:0)|(physical?SOUND.lifespanTiedToEntity:0)});
 }
}
