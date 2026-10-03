import {NativeSound,NativeAudioEnvironment,SOUND,type NativeAudioEntity,type NativePhysicalEntity,type NativeSoundClock,type NativeSoundParams,type NativeVec} from './NativeSound';
import {audioLog10,bytesToMs,type AudioRandom} from './nativeAudioUtility';
/** One decoded bank sound as stored in a CAEBankSlot. `loopStart` is in samples, -1 when the sound does not loop. */
export interface NativeBankSound {samples:Float32Array;sampleRate:number;headroom:number;loopStart:number}
export interface NativeBankSlots {
 isSoundBankLoaded(bank:number,slot:number):boolean;
 /** The sound currently stored in a slot, whatever bank it came from. */
 sound(slot:number,sound:number):NativeBankSound|undefined;
}
/** Receives the physical channel commands (DirectSound buffers on PC). Positions are camera-relative (right, forward, up). */
export interface NativeChannelRenderer {
 play(channel:number,sound:NativeBankSound,offsetSeconds:number,fadeIn:boolean):void;
 stop(channel:number):void;
 update(channel:number,volumeDb:number,rate:number,position:NativeVec):void;
}
/** CAEAudioHardware::m_awChannelFlags bits (gta-reversed#1225 names). */
export const CHANNEL_FLAG={secondaryGroup:0x01,unduckable:0x02,clampVolumeToNegative:0x04,music:0x10,notStream:0x20,fadeNearEnd:0x40,slowFadeout:0x80} as const;
const soundLengthMs=(s:NativeBankSound)=>bytesToMs(s.samples.length*2,s.sampleRate);
const loopStartMs=(s:NativeBankSound)=>s.loopStart<0?-1:bytesToMs(2*s.loopStart,s.sampleRate);
interface Channel {sound?:NativeBankSound;seconds:number;paused:boolean;looped:boolean;volume:number;output:number;frequency:number;flags:number;gain:number;position:NativeVec;playing:boolean}
/** CAEAudioHardware static channels owned by the sound manager, plus CAEStaticChannel playback state.
 * Play positions advance with the frequency scaling factor applied at each service. */
export class NativeAudioHardware {
 readonly channels:Channel[];
 private prevMaxGlobal=0;private prevMaxSecondary=0;private prevGlobalSlow=false;private prevSecondarySlow=false;
 /** m_fEffectMasterScalingFactor * m_fEffectsFaderScalingFactor; the browser applies its master/effects sliders on the output bus. */
 effectsScale=1;
 constructor(count:number,private bank:NativeBankSlots,public renderer?:NativeChannelRenderer){
  this.channels=Array.from({length:count},()=>({seconds:0,paused:false,looped:false,volume:-100,output:-100,frequency:1,flags:CHANNEL_FLAG.notStream,gain:0,position:{x:0,y:1,z:0},playing:false}));
 }
 /** CAEAudioHardware::PlaySound (PR #1225 reconstruction) and CAEStaticChannel::Play. */
 playSound(ch:number,soundId:number,slot:number,playPosition:number,flags:number,speed:number){
  const sound=this.bank.sound(slot,soundId),c=this.channels[ch];
  if(!sound){c.playing=false;c.sound=undefined;return;}
  const length=soundLengthMs(sound);let pos=Math.max(playPosition,0);
  if(flags&SOUND.startPercentage&&playPosition>0)pos=Math.floor(pos/100*length);pos=Math.min(pos,length);
  c.sound=sound;c.looped=sound.loopStart>=0;c.playing=true;c.paused=speed===0;
  // A looping buffer with an intro starts from its beginning; other sounds seek and fade in from silence.
  const seek=!(c.looped&&sound.loopStart>0)&&pos>0;c.seconds=seek?pos/1000:0;
  c.flags=CHANNEL_FLAG.notStream|(flags&SOUND.unduckable?CHANNEL_FLAG.unduckable:0);
  this.renderer?.play(ch,sound,c.seconds,seek);
 }
 stopSound(ch:number){const c=this.channels[ch];if(c.playing)this.renderer?.stop(ch);c.playing=false;c.sound=undefined;}
 setChannelVolume(ch:number,volume:number){this.channels[ch].volume=volume;}
 setChannelPosition(ch:number,position:NativeVec){this.channels[ch].position=position;}
 setChannelFrequencyScalingFactor(ch:number,factor:number){this.channels[ch].frequency=factor;}
 /** CAEStaticChannel::GetPlayTime: -1 once the buffer stopped. */
 playTime(ch:number){const c=this.channels[ch];return c.playing&&c.sound?Math.floor(c.seconds*1000):-1;}
 lengthMs(ch:number){const s=this.channels[ch].sound;return s?soundLengthMs(s):0;}
 /** Advance buffers by elapsed audio time at their current frequency. */
 advance(elapsedMs:number){
  for(let i=0;i<this.channels.length;i++){const c=this.channels[i];
   if(!c.playing||!c.sound||c.paused)continue;
   const duration=c.sound.samples.length/c.sound.sampleRate;c.seconds+=elapsedMs/1000*c.frequency;
   if(c.seconds<duration)continue;
   if(c.looped){const start=c.sound.loopStart/c.sound.sampleRate,span=duration-start;c.seconds=span>0?start+(c.seconds-start)%span:start;}
   else{c.playing=false;c.sound=undefined;this.renderer?.stop(i);}
  }
 }
 /** RescaleChannelVolumes (0x4D8990). */
 rescaleChannelVolumes(){
  let maxGlobal=0,maxSecondary=0,scaleSum=0,fullSum=0,globalSlow=false,secondarySlow=false;
  for(const c of this.channels){
   if(!c.playing){c.volume=-100;continue;}
   if(maxGlobal<c.volume){maxGlobal=c.volume;globalSlow=(c.flags&CHANNEL_FLAG.slowFadeout)!==0;}
   if(c.flags&CHANNEL_FLAG.secondaryGroup&&maxSecondary<c.volume){maxSecondary=c.volume;secondarySlow=(c.flags&CHANNEL_FLAG.slowFadeout)!==0;}
  }
  if(maxGlobal<this.prevMaxGlobal){const v=this.prevMaxGlobal-(this.prevGlobalSlow?.5:1.2);if(v>maxGlobal){maxGlobal=v;if(this.prevGlobalSlow)globalSlow=true;}}
  if(maxSecondary<this.prevMaxSecondary){const v=this.prevMaxSecondary-(this.prevSecondarySlow?.5:1.2);if(v>maxSecondary){maxSecondary=v;if(this.prevSecondarySlow)secondarySlow=true;}}
  for(let i=0;i<this.channels.length;i++){const c=this.channels[i];
   c.volume=c.flags&CHANNEL_FLAG.clampVolumeToNegative?Math.min(c.volume,0):c.flags&CHANNEL_FLAG.secondaryGroup?c.volume-maxSecondary:c.volume-maxGlobal;
   c.gain=Math.fround(10**(Math.fround(c.volume*.05)));
   if(c.flags&CHANNEL_FLAG.unduckable)fullSum+=c.gain;
   else if(c.flags&CHANNEL_FLAG.fadeNearEnd&&this.playTime(i)>=0){const length=this.lengthMs(i),remaining=(length-this.playTime(i))*c.gain/length;scaleSum+=remaining<0?0:Math.min(remaining,c.gain);}
   else scaleSum+=c.gain;
  }
  this.prevMaxGlobal=maxGlobal;this.prevMaxSecondary=maxSecondary;this.prevSecondarySlow=secondarySlow;this.prevGlobalSlow=globalSlow;
  const masterScale=scaleSum===0?0:Math.min(Math.fround((6.4-fullSum*.8)*16383/scaleSum),16383);
  for(let i=0;i<this.channels.length;i++){const c=this.channels[i];
   const gain=c.gain*(c.flags&CHANNEL_FLAG.unduckable?16383:masterScale)*this.effectsScale;
   c.output=gain===0?-100:20*audioLog10(gain/16383);
   // DirectSound buffer volume spans -100..0 dB.
   if(c.playing)this.renderer?.update(i,Math.min(0,Math.max(-100,c.output)),c.paused?0:c.frequency,c.position);
  }
 }
 /** CAEAudioHardware::Service (0x4D9870). */
 service(){this.rescaleChannelVolumes();}
}
const MAX_NUM_SOUNDS=300;
/** CAESoundManager (0x4EF4D0-0x4F0000). Software-mixed DirectSound gives 48 channels; one is the background stream. */
export class NativeSoundManager {
 readonly sounds:NativeSound[];
 readonly clock:NativeSoundClock={timeMs:0,frame:1};
 readonly hardware:NativeAudioHardware;
 private physical:number[];private prioritised:number[];private positions:number[];
 private lengths=new Int16Array(MAX_NUM_SOUNDS).fill(-1);private loopStarts=new Int16Array(MAX_NUM_SOUNDS).fill(-1);
 private lastTime=0;
 paused=false;
 constructor(readonly env:NativeAudioEnvironment,readonly bank:NativeBankSlots,private random:AudioRandom=Math.random,readonly channelCount=47,renderer?:NativeChannelRenderer){
  this.sounds=Array.from({length:MAX_NUM_SOUNDS},()=>new NativeSound(env,this.clock));
  this.hardware=new NativeAudioHardware(channelCount,bank,renderer);
  this.physical=new Array(channelCount).fill(-1);this.prioritised=new Array(channelCount).fill(-1);this.positions=new Array(channelCount).fill(-1);
 }
 /** PlaySound + RequestNewSound (0x4EFB10): copies into the first free virtual slot. */
 playSound(p:NativeSoundParams):NativeSound|undefined{
  const index=this.sounds.findIndex(s=>!s.inUse);if(index<0)return;
  const s=this.sounds[index];s.initialise({...p,flags:(p.flags??0)|(p.physical?SOUND.lifespanTiedToEntity:0)});
  // NewVPSLEntry (0x4EF7A0)
  s.physicallyPlaying=false;s.requestedStop=false;s.hardwareAware=false;s.inUse=true;
  s.headroom=(this.bank.sound(s.slot,s.sound)?.headroom??0)/100;s.calculateFrequency(this.random);
  return s;
 }
 areSoundsPlayingInBankSlot(slot:number){let status=0;for(const s of this.sounds){if(!s.inUse||s.slot!==slot)continue;if(s.physicallyPlaying)return 2;status=1;}return status;}
 areSoundsOfThisEventPlayingForThisEntity(event:number,entity:NativeAudioEntity){let status=0;for(const s of this.sounds){if(!s.inUse||s.event!==event||s.entity!==entity)continue;if(s.physicallyPlaying)return 2;status=1;}return status;}
 areSoundsOfThisEventPlayingForThisEntityAndPhysical(event:number,entity:NativeAudioEntity,physical:NativePhysicalEntity){let status=0;for(const s of this.sounds){if(!s.inUse||s.event!==event||s.entity!==entity||s.physical!==physical)continue;if(s.physicallyPlaying)return 2;status=1;}return status;}
 cancelSoundsInBankSlot(slot:number,fullStop:boolean){for(const s of this.sounds)if(s.inUse&&s.slot===slot){if(fullStop)s.stopSoundAndForget();else s.stopSound();}}
 cancelSoundsOwnedByAudioEntity(entity:NativeAudioEntity,fullStop:boolean){for(const s of this.sounds)if(s.inUse&&s.entity===entity){if(fullStop)s.stopSoundAndForget();else s.stopSound();}}
 cancelSoundsOfThisEventPlayingForThisEntity(event:number,entity:NativeAudioEntity){for(const s of this.sounds)if(s.inUse&&s.event===event&&s.entity===entity)s.stopSoundAndForget();}
 reset(){for(const s of this.sounds)if(s.inUse)s.stopSound();}
 private soundPaused(s:NativeSound){return this.paused&&!s.has(SOUND.unpausable);}
 /** Service (0x4F0000), once per game frame. `timeMs` is CTimer::GetTimeInMS. Its loops index the 300 sounds rather
  * than iterating entries(), which made an iterator result and an [index, sound] pair for each, every frame. */
 service(timeMs:number){
  const n=this.channelCount,sounds=this.sounds,hw=this.hardware;
  this.prioritised.fill(-1);
  const elapsed=this.paused?0:Math.max(0,timeMs-this.lastTime);this.lastTime=timeMs;
  this.clock.timeMs=timeMs;
  hw.advance(elapsed);
  for(let i=0;i<n;i++)this.positions[i]=hw.playTime(i);
  for(let i=0;i<sounds.length;i++){const s=sounds[i];
   if(!s.inUse||!s.hardwareAware||!s.has(SOUND.startPercentage))continue;
   s.setFlags(SOUND.startPercentage,false);if(s.physicallyPlaying)continue;
   s.playTime=Math.trunc(Math.fround(s.playTime*this.lengths[i])/100)<<16>>16;
  }
  for(let i=0;i<n;i++){const ref=this.physical[i];if(ref===-1)continue;const s=sounds[ref];s.playTime=this.positions[i];if(s.requestedStop)hw.stopSound(i);}
  for(let i=0;i<sounds.length;i++){const s=sounds[i];if(!s.inUse||!s.hardwareAware||s.frameDelay)continue;s.updatePlayTime(this.lengths[i],this.loopStarts[i],this.soundPaused(s)?0:elapsed);}
  for(let i=0;i<n;i++)if(this.positions[i]===-1)this.physical[i]=-1;
  for(const s of sounds)if(s.inUse&&s.hardwareAware&&s.playTime===-1)s.soundHasFinished();
  for(const s of sounds){if(!s.inUse)continue;s.updateParameters(s.playTime);s.calculateVolume();}
  let prioritisedCount=0;
  for(let i=0;i<n;i++){const ref=this.physical[i];if(ref!==-1&&sounds[ref].has(SOUND.uncancellable))this.prioritised[prioritisedCount++]=ref;}
  for(let i=0;i<sounds.length;i++){const s=sounds[i];
   if(!s.inUse||s.physicallyPlaying&&s.has(SOUND.uncancellable)||s.frameDelay!==0)continue;
   let ch=n-1;
   for(;ch>prioritisedCount;ch--)if(this.prioritised[ch]!==-1)break;
   // Walk toward louder sounds; stop behind the first louder one unless this sound must play physically and it need not.
   for(;ch>=prioritisedCount;ch--){
    const ref=this.prioritised[ch];if(ref===-1)continue;const other=sounds[ref];
    if(s.listenerVolume>=other.listenerVolume)continue;
    if(s.has(SOUND.playPhysically)&&!other.has(SOUND.playPhysically))continue;
    break;
   }
   if(ch!==n-1){for(let k=n-1;k>ch+1;k--)this.prioritised[k]=this.prioritised[k-1];this.prioritised[ch+1]=i;}
  }
  for(let i=0;i<n;i++){
   const ref=this.physical[i];if(ref===-1)continue;
   const at=this.prioritised.indexOf(ref);
   if(at<0){sounds[ref].physicallyPlaying=false;this.physical[i]=-1;hw.stopSound(i);}else this.prioritised[at]=-1;
  }
  for(let i=0,ch=0;i<n;i++){
   const ref=this.prioritised[i];if(ref===-1)continue;
   while(ch<n&&this.physical[ch]!==-1)ch++;
   if(ch>=n)break;
   this.physical[ch]=ref;const s=sounds[ref];s.physicallyPlaying=true;
   hw.playSound(ch,s.sound,s.slot,s.playTime,s.flags,s.speed);
   hw.setChannelVolume(ch,s.listenerVolume);hw.setChannelPosition(ch,s.relativePosition());hw.setChannelFrequencyScalingFactor(ch,s.relativePlaybackFrequencyWithDoppler());
  }
  for(let i=0;i<n;i++){
   const ref=this.physical[i];if(ref===-1)continue;const s=sounds[ref];if(!s.inUse)continue;
   if(!this.soundPaused(s)){hw.setChannelVolume(i,s.listenerVolume);hw.setChannelFrequencyScalingFactor(i,s.relativePlaybackFrequencyWithDoppler());}
   else{hw.setChannelVolume(i,-100);hw.setChannelFrequencyScalingFactor(i,0);}
   hw.setChannelPosition(i,s.relativePosition());
  }
  hw.service();
  // CAEMP3BankLoader::UpdateVirtualChannels: sound lengths and loop starts for the next frame.
  for(let i=0;i<sounds.length;i++){const s=sounds[i];
   const sound=s.inUse?this.bank.sound(s.slot,s.sound):undefined;
   this.lengths[i]=sound?Math.min(32767,bytesToMs(sound.samples.length*2,sound.sampleRate)):-1;this.loopStarts[i]=sound?loopStartMs(sound):-1;
  }
  for(const s of sounds){if(!s.inUse)continue;s.hardwareAware=true;if(s.frameDelay>0&&!this.soundPaused(s))s.frameDelay--;}
  this.clock.frame++;
 }
 snapshot(){return {virtual:this.sounds.filter(s=>s.inUse).length,physical:this.physical.filter(r=>r!==-1).length,channels:this.hardware.channels.filter(c=>c.playing).length};}
}
