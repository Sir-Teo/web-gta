import {SOUND,type NativeAudioEntity,type NativePhysicalEntity,type NativeSound,type NativeVec} from './NativeSound';
import type {NativeSoundManager} from './NativeSoundManager';
import type {NativeBankLoader} from './NativeBankLoader';
import {randomInt,type AudioRandom} from './nativeAudioUtility';
/* CAEScriptAudioEntity::ProcessMissionAudioEvent (0x4ECCF0), which REPORT_MISSION_AUDIO_EVENT_AT_* hands a script's
 * sound to. gta-reversed leaves it a call into the exe; its commented decompilation has the right handlers but case
 * labels it says need fixing (they are script-slot names, 7000 and up, not the 1000 to 1190 the scripts report). The
 * iOS executable's (arm64 0x100157360: a jump table at 0x10015888c over events 104 to 1190) gives each event's
 * handler, and the table below is read from it.
 *
 * Ported so far: the events that hand on to the frontend entity, and those that play a resident GENRL sound
 * (PlayResidentSoundEvent, 0x1001566a8). Not yet: PlayMissionBankSound's 85 events (a sound of the SCRIPT bank a script
 * has loaded into its mission audio slot 2 or 3), the beat and cutscene track starts and stops, the crane's, the
 * camera's and a few others; those are recorded and play nothing. */

/** A PlayResidentSoundEvent: bank slot, bank, sound (or an inclusive random range of sounds), the start percentage,
 * the volume offset and the speed. Its last argument, the roll-off, is 1 for every one here. */
type Resident=readonly [slot:number,bank:number,sound:number|readonly [number,number],percent:number,volume:number,speed:number];
type MissionAudioCase={frontend:number;speed?:number}|{resident:readonly Resident[];once?:boolean};
const COLLISIONS=[2,39] as const,WEAPONS=[5,143] as const;
const r=(bank:readonly [number,number],sound:Resident[2],percent=0,volume=0,speed=1):Resident=>[bank[0],bank[1],sound,percent,volume,speed];
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
};
/** Where a report is heard: a point, or the entity it is at (whose position the sound follows). */
export type MissionAudioAt={position:NativeVec}|{physical:NativePhysicalEntity};
export class NativeScriptAudio implements NativeAudioEntity {
 /** Reports handled and reports this cannot play yet, by event, for diagnostics. */
 readonly handled=new Map<number,number>();readonly unported=new Map<number,number>();
 constructor(private manager:NativeSoundManager,private bank:NativeBankLoader,private defaultVolume:(event:number)=>number,private random:AudioRandom,
  private frontend:(event:number,volumeBoost:number,speed:number)=>void){}
 updateParameters(_sound:NativeSound,_playPosition:number){}
 snapshot(){return {handled:Object.fromEntries(this.handled),unported:Object.fromEntries(this.unported)};}
 /** ProcessMissionAudioEvent. */
 processMissionAudioEvent(event:number,at:MissionAudioAt){
  const c=MISSION_AUDIO_EVENTS[event];
  if(!c){this.unported.set(event,(this.unported.get(event)??0)+1);return;}
  this.handled.set(event,(this.handled.get(event)??0)+1);
  if('frontend' in c){this.frontend(c.frontend,0,c.speed??1);return;}
  if(c.once&&this.manager.areSoundsOfThisEventPlayingForThisEntity(event,this))return;
  for(const [slot,bank,sound,percent,volume,speed] of c.resident)
   this.playResidentSoundEvent(slot,bank,typeof sound==='number'?sound:randomInt(this.random,sound[0],sound[1]),event,at,volume,speed,percent);
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
