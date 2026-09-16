import {SOUND,type NativeAudioEntity,type NativeSound,type NativeVec} from './NativeSound';
import type {NativeSoundManager} from './NativeSoundManager';
import {BANK,SLOT,type NativeBankLoader} from './NativeBankLoader';
/** Default volumes index (eAudioEvents, verified against plugin-sdk). */
const AE_FIRE=130;
/** AE_FRONTEND_SELECT/BACK reused as loop state markers, as in the source. */
const EVENT={select:1,back:2} as const;
/** CAEFireAudioEntity (gta-reversed 0076f901; event IDs verified against plugin-sdk):
 * per-fire crackle (explosions bank) plus low loop (vehicle-gen bank) with the
 * SELECT→BACK volume envelope. gfFireFrequencyVariations lives at a static
 * address upstream, so both layers play at unity speed (authored). The hydrant
 * and water branches are omitted. */
export class NativeFireAudio implements NativeAudioEntity {
 constructor(private manager:NativeSoundManager,private bank:NativeBankLoader,private defaultVolume:(event:number)=>number){}
 /** AddAudioEvent(AE_FIRE_*): start the pair unless this fire already sounds. */
 service(position:NativeVec){
  if(!this.bank.isSoundBankLoaded(BANK.explosions,SLOT.explosions)||!this.bank.isSoundBankLoaded(BANK.vehicleGen,SLOT.vehicleGen)){
   this.bank.loadSoundBank(BANK.explosions,SLOT.explosions);this.bank.loadSoundBank(BANK.vehicleGen,SLOT.vehicleGen);return;
  }
  if(this.manager.areSoundsOfThisEventPlayingForThisEntity(EVENT.select,this)||this.manager.areSoundsOfThisEventPlayingForThisEntity(EVENT.back,this))return;
  const volume=this.defaultVolume(AE_FIRE);
  this.manager.playSound({slot:SLOT.explosions,sound:0,entity:this,position,volume,rollOff:2,speed:1,flags:SOUND.requestUpdates});
  this.manager.playSound({slot:SLOT.vehicleGen,sound:26,entity:this,position,volume:volume-17,rollOff:2,speed:.6,doppler:1,flags:SOUND.requestUpdates,event:EVENT.select,clientVariable:volume+3});
 }
 /** Terminate (CAudioEngine pruning): cancel this fire's sounds. */
 terminate(){this.manager.cancelSoundsOwnedByAudioEntity(this,true);}
 /** UpdateParameters (0x4DCF60): the low loop ramps to its ceiling, then fades. */
 updateParameters(sound:NativeSound,playPosition:number){
  if(playPosition<=0)return;
  if(sound.event===EVENT.select){
   if(sound.volume>=sound.clientVariable)sound.event=EVENT.back;
   else sound.volume=Math.min(sound.volume+2,sound.clientVariable);
  }else if(sound.event===EVENT.back){
   if(sound.volume<=-30)sound.stopSoundAndForget();
   else sound.volume-=.75;
  }
 }
}
