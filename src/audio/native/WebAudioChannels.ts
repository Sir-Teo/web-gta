import type {NativeBankSound,NativeChannelRenderer} from './NativeSoundManager';
import type {NativeVec} from './NativeSound';
interface Voice {source:AudioBufferSourceNode;gain:GainNode;panner:PannerNode;fadeIn:boolean}
/** DirectSound static channels on Web Audio. The DirectSound listener has roll-off and doppler factors of 0,
 * so buffers only pan by direction; distance, doppler and mixing come from the sound manager. */
export class WebAudioChannels implements NativeChannelRenderer {
 private voices:(Voice|undefined)[];
 private buffers=new WeakMap<NativeBankSound,AudioBuffer>();
 constructor(private ctx:AudioContext,private output:AudioNode,count:number){this.voices=new Array(count).fill(undefined);}
 private buffer(sound:NativeBankSound){
  let buffer=this.buffers.get(sound);
  if(!buffer){buffer=this.ctx.createBuffer(1,Math.max(1,sound.samples.length),sound.sampleRate);buffer.copyToChannel(sound.samples as Float32Array<ArrayBuffer>,0);this.buffers.set(sound,buffer);}
  return buffer;
 }
 play(channel:number,sound:NativeBankSound,offset:number,fadeIn:boolean){
  this.stop(channel);
  const ctx=this.ctx,source=ctx.createBufferSource(),gain=ctx.createGain(),panner=ctx.createPanner();
  source.buffer=this.buffer(sound);
  if(sound.loopStart>=0){source.loop=true;source.loopStart=sound.loopStart/sound.sampleRate;source.loopEnd=sound.samples.length/sound.sampleRate;}
  gain.gain.value=0;panner.panningModel='equalpower';panner.distanceModel='inverse';panner.rolloffFactor=0;panner.refDistance=1;
  source.connect(gain);gain.connect(panner);panner.connect(this.output);
  const voice={source,gain,panner,fadeIn};this.voices[channel]=voice;
  source.onended=()=>{source.disconnect();gain.disconnect();panner.disconnect();if(this.voices[channel]===voice)this.voices[channel]=undefined;};
  source.start(ctx.currentTime,Math.min(offset,source.buffer.duration));
 }
 /** CAEStaticChannel::Stop: a 30 ms smooth fade before the buffer stops. */
 stop(channel:number){
  const voice=this.voices[channel];if(!voice)return;this.voices[channel]=undefined;
  const t=this.ctx.currentTime;voice.gain.gain.cancelScheduledValues(t);voice.gain.gain.setValueAtTime(voice.gain.gain.value,t);voice.gain.gain.linearRampToValueAtTime(0,t+.03);
  try{voice.source.stop(t+.03);}catch{voice.source.disconnect();}
 }
 update(channel:number,volumeDb:number,rate:number,position:NativeVec){
  const voice=this.voices[channel];if(!voice)return;
  const t=this.ctx.currentTime,gain=volumeDb<=-100?0:10**(volumeDb/20);
  // Starting mid-buffer fades in from silence over 28 ms (SynchPlayback); other volume changes apply per frame.
  if(voice.fadeIn){voice.fadeIn=false;voice.gain.gain.setValueAtTime(0,t);voice.gain.gain.linearRampToValueAtTime(gain,t+.028);}
  else voice.gain.gain.setTargetAtTime(gain,t,.01);
  voice.source.playbackRate.setValueAtTime(rate,t);
  // Camera space (right, forward, up) to the Web Audio listener's default frame (x right, y up, -z forward).
  voice.panner.positionX.setValueAtTime(position.x,t);voice.panner.positionY.setValueAtTime(position.z,t);voice.panner.positionZ.setValueAtTime(-position.y,t);
 }
 dispose(){for(let i=0;i<this.voices.length;i++)this.stop(i);}
}
