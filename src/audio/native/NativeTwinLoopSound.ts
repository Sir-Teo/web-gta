import {SOUND,type NativeAudioEntity,type NativeSound,type NativeVec} from './NativeSound';
import type {NativeSoundManager} from './NativeSoundManager';
import {randomInt,type AudioRandom} from './nativeAudioUtility';
/** CAETwinLoopSoundEntity (0x4F28A0-0x4F2E90): two looping sounds in one slot, only one audible, swapped every 200-1000 ms style interval. */
export class NativeTwinLoopSound implements NativeAudioEntity {
 private slot=-1;private soundIds:[number,number]=[-1,-1];private percentages:[number,number]=[-1,-1];
 private swapMin=0;private swapMax=0;private swapAt=0;private first=true;
 readonly sounds:[NativeSound|undefined,NativeSound|undefined]=[undefined,undefined];
 active=false;
 constructor(private manager:NativeSoundManager,private random:AudioRandom){}
 initialise(slot:number,soundA:number,soundB:number,swapMin:number,swapMax:number,percentageA=-1,percentageB=-1){
  this.slot=slot;this.soundIds=[soundA,soundB];this.swapMin=swapMin;this.swapMax=swapMax;this.percentages=[percentageA,percentageB];
  this.first=true;this.active=true;this.sounds[0]=this.sounds[1]=undefined;
 }
 updateTwinLoopSound(pos:NativeVec,volume:number,speed:number){
  for(const [i,s] of this.sounds.entries()){if(!s)continue;s.setPosition(pos);if(i===(this.first?0:1))s.volume=volume;s.speed=speed;}
 }
 updateParameters(sound:NativeSound,playPosition:number){
  if(playPosition===-1)for(let i=0;i<2;i++)if(this.sounds[i]===sound)this.sounds[i]=undefined;
  if(this.doSoundsSwitchThisFrame()&&sound===this.sounds[0])this.swapSounds();
 }
 private swapSounds(){
  const current=this.sounds[this.first?0:1],next=this.sounds[this.first?1:0];if(!current||!next)return;
  next.volume=current.volume;current.volume=-100;this.first=!this.first;this.reCalculateSwapTime();
 }
 stopSoundAndForget(){for(let i=0;i<2;i++){const s=this.sounds[i];this.sounds[i]=undefined;s?.stopSoundAndForget();}this.active=false;}
 doSoundsSwitchThisFrame(){return this.manager.clock.timeMs>this.swapAt;}
 playTwinLoopSound(pos:NativeVec,volume:number,speed:number,rollOff:number,doppler=1,flags=0){
  this.stopSoundAndForget();
  for(let i=0;i<2;i++)this.sounds[i]=this.manager.playSound({slot:this.slot,sound:this.soundIds[i],entity:this,position:pos,volume:i===0?volume:-100,rollOff,speed,doppler,
   flags:flags|SOUND.startPercentage|SOUND.requestUpdates,playTime:this.percentages[i]!==-1?this.percentages[i]:randomInt(this.random,0,99)});
  this.active=true;this.first=true;this.reCalculateSwapTime();
 }
 private reCalculateSwapTime(){this.swapAt=this.manager.clock.timeMs+randomInt(this.random,this.swapMin,this.swapMax);}
}
