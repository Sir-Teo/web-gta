import {SOUND,type NativeAudioEntity,type NativeSound,type NativeVec} from './NativeSound';
import type {NativeSoundManager} from './NativeSoundManager';
import type {NativeBankLoader} from './NativeBankLoader';
/* CAEDoorAudioEntity (Audio/Entities/AEDoorAudioEntity.cpp, reversed in gta-reversed 0076f901): a garage door's
 * opening and closing and an entry/exit door moving, from DOORS (51) in its bank slot (31). A door opening (or closing)
 * plays its loop (sound 0) and, if the last call was more than 300 ms before, the clunk of its start (sound 2); being
 * told again keeps it going. Opened (closed) cuts it for the stop's clunk. Ten seconds without being told, the loop
 * plays the stop itself (UpdateParameters, the PC branch). */
export const AE_DOOR={garageOpening:159,garageOpened:160,garageClosing:161,garageClosed:162,entryExitMoving:163} as const;
const BANK_DOORS=51,SLOT_DOORS=31;
export class NativeDoorAudio implements NativeAudioEntity {
 /** m_nTime and m_nMovingDoorTime. */
 private time=0;private movingDoorTime=0;
 constructor(private manager:NativeSoundManager,private bank:NativeBankLoader,private defaultVolume:(event:number)=>number){}
 private get now(){return this.manager.clock.timeMs;}
 /** StaticInitialise (0x5B9A80). */
 static staticInitialise(bank:NativeBankLoader){bank.loadSoundBank(BANK_DOORS,SLOT_DOORS);}
 /** Reset (0x4DC6B0). */
 reset(){this.time=0;this.movingDoorTime=0;this.manager.cancelSoundsOwnedByAudioEntity(this,true);}
 /** AddAudioEvent(event, physical) (0x4DC9F0): an entry/exit door moving, at most every 4 s. */
 addMovingDoorEvent(position:NativeVec){
  if(this.manager.areSoundsOfThisEventPlayingForThisEntity(AE_DOOR.entryExitMoving,this)||this.now<=this.movingDoorTime+4000)return;
  this.playDoorSound(1,AE_DOOR.entryExitMoving,position);this.movingDoorTime=this.now;
 }
 /** AddAudioEvent(event, position, volume, speed) (0x4DC860). */
 addAudioEvent(event:number,position:NativeVec,volume=0,speed=1){
  const playing=(e:number)=>!!this.manager.areSoundsOfThisEventPlayingForThisEntity(e,this);
  switch(event){
   case AE_DOOR.garageOpening:case AE_DOOR.garageClosing:
    if(playing(event)){this.time=this.now;break;}
    if(event===AE_DOOR.garageOpening)this.manager.cancelSoundsOwnedByAudioEntity(this,true);
    if(this.now>this.time+300)this.playDoorSound(2,event,position,volume,event===AE_DOOR.garageOpening?.79:1);
    this.playDoorSound(0,event,position,volume,speed);
    this.time=this.now;break;
   case AE_DOOR.garageOpened:case AE_DOOR.garageClosed:{
    const moving=event===AE_DOOR.garageOpened?AE_DOOR.garageOpening:AE_DOOR.garageClosing;
    if(!playing(event)&&playing(moving)){this.manager.cancelSoundsOwnedByAudioEntity(this,true);this.playDoorSound(2,event,position,volume,event===AE_DOOR.garageOpened?1:.79);}
    this.time=this.now;break;
   }
  }
 }
 /** PlayDoorSound (0x4DC6D0): asks for DOORS if it is not in; ahead of the listener for a point of zeros or the -1000
  * sentinel. */
 private playDoorSound(sound:number,event:number,position:NativeVec,volume=0,speed=1){
  if(!this.bank.isSoundBankLoaded(BANK_DOORS,SLOT_DOORS)){NativeDoorAudio.staticInitialise(this.bank);return;}
  const ahead=position.x===0&&position.y===0&&position.z===0||position.x===-1000&&position.y===-1000&&position.z===-1000;
  this.manager.playSound({slot:SLOT_DOORS,sound,entity:this,position:ahead?{x:0,y:1,z:0}:position,volume:this.defaultVolume(event)+volume,rollOff:2,speed,doppler:1,event,
   flags:SOUND.requestUpdates|(ahead?SOUND.frontEnd:0)});
 }
 /** UpdateParameters (0x4DCA60), the PC branch. */
 updateParameters(sound:NativeSound,playPosition:number){
  if(playPosition<=0)return;
  let stopped:number;
  if(sound.event===AE_DOOR.garageOpening)stopped=AE_DOOR.garageOpened;
  else if(sound.event===AE_DOOR.garageClosing)stopped=AE_DOOR.garageClosed;
  else return;
  if(this.now>this.time+10000){
   const moving=sound.event;
   if(!this.manager.areSoundsOfThisEventPlayingForThisEntity(stopped,this)&&this.manager.areSoundsOfThisEventPlayingForThisEntity(moving,this)){
    const at={...sound.currPos};this.manager.cancelSoundsOwnedByAudioEntity(this,true);this.playDoorSound(2,stopped,at,0,stopped===AE_DOOR.garageOpened?1:.79);
   }
   this.time=this.now;sound.stopSoundAndForget();return;
  }
  if(this.manager.areSoundsOfThisEventPlayingForThisEntity(stopped,this))sound.stopSoundAndForget();
 }
}
