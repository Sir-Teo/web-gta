/* The radio's track stream on Web Audio: AEAudioHardware's CAEStreamThread as the iOS port has it (PlayTrack,
 * 0x10015d780, and its Service, 0x10015d45c) over a CAEStreamingChannel. A request names a track to play, from a time
 * modulo its length, and the one to follow it; the thread readies the track (PrepareStream, which leaves the channel
 * ready, -2) and keeps the next to move on to without a gap when the track ends, as the channel's buffer fill does. If
 * the playing track is the one asked for, only the next is taken (SetNextStream and SetReady). Neither to be had, the
 * play time reads -8 until the next request.
 * The port's tracks are the stream packs' MP3s (StreamTracks.ts), fetched and decoded whole as the thread reaches them,
 * where the iOS port decodes them as they play; the radio waits for a track to be ready either way. */
import {isTrackBanned,type RadioTrackHardware} from './native/NativeRadioTrackManager';

/** StreamingChannelState. */
const STATE={paused:-7,stopped:-6,stopping:-5,finished:-4,ready:-2,started:-1} as const;
/** How long DirectSoundBufferFadeToSilence (AESmoothFadeThread) takes the stopping track down. */
const FADE_S=.05;
export interface RadioStreamLoader {load(id:number):Promise<AudioBuffer|undefined>}
interface Decoder {id:number;buffer:AudioBuffer}
interface Voice {source:AudioBufferSourceNode;gain:GainNode;startsAt:number;offsetS:number;decoder:Decoder}
interface Request {track:number;next:number;startMs:number}

export class RadioStream implements RadioTrackHardware {
 private state:number=STATE.stopped;
 private decoder?:Decoder;private next?:Decoder;
 /** Where the decoder starts (SetCursor), and the voices playing it and the next one. */
 private cursorS=0;private voice?:Voice;private nextVoice?:Voice;
 private frequency=1;private heldS?:number;
 private readonly out:GainNode;
 /** The thread's request (the last asked for wins, as PlayTrack's fields do), and the one it is on. */
 private pending?:Request;private busy=false;private stopRequest=false;private preparing=false;private preparingIds=-1;
 private stoppingAt=0;
 /** Tracks started, for the snapshot. */
 started=0;
 constructor(private readonly ctx:BaseAudioContext,destination:AudioNode,private readonly loader:RadioStreamLoader){
  this.out=ctx.createGain();this.out.gain.value=0;this.out.connect(destination);
 }
 playTrack(trackId:number,nextTrackId:number,startMs:number){
  if(isTrackBanned(trackId))return;
  if(this.trackPlayTime()===STATE.ready)this.channelStop();
  this.pending={track:trackId,next:nextTrackId,startMs};
 }
 startTrackPlayback(){
  const d=this.decoder;if(!d)return;
  this.state=STATE.started;this.started++;
  this.voice=this.startVoice(d,this.ctx.currentTime,this.cursorS);
  this.scheduleNext();
 }
 stopTrack(){this.stopRequest=true;}
 trackPlayTime(){
  if(this.preparing)return -8;
  if(this.state!==STATE.started)return this.state;
  const v=this.voice;if(!v)return 0;
  const at=this.heldS??Math.max(0,this.ctx.currentTime-v.startsAt)+v.offsetS;
  return Math.floor(at*1000);
 }
 trackLengthMs(){const d=this.decoder;return d?Math.floor(d.buffer.duration*1000):-1;}
 activeTrackId(){return this.preparing?this.preparingIds:this.decoder?.id??-1;}
 playingTrackId(){
  if(this.preparing)return this.preparingIds;
  const s=this.state;return this.decoder&&(s===STATE.started||s===STATE.finished||s===STATE.stopping)?this.decoder.id:-1;
 }
 setChannelVolume(dB:number){this.out.gain.setTargetAtTime(dB<=-100?0:10**(dB/20),this.ctx.currentTime,.01);}
 /** A factor of 0 holds the track where it is (CheckForPause in a pause); 1 plays it on from there. */
 setFrequencyScalingFactor(factor:number){
  const hold=factor<=0;if(hold===(this.frequency<=0))return;
  this.frequency=factor;
  const v=this.voice;
  if(hold){if(v){this.heldS=Math.max(0,this.ctx.currentTime-v.startsAt)+v.offsetS;this.silence(v);this.silence(this.nextVoice);this.voice=this.nextVoice=undefined;}}
  else if(this.heldS!==undefined&&this.decoder&&this.state===STATE.started){this.voice=this.startVoice(this.decoder,this.ctx.currentTime,this.heldS);this.heldS=undefined;this.scheduleNext();}
  else this.heldS=undefined;
 }
 /** The thread's and the channel's Service, once an audio frame before the radio's. */
 service(){
  const now=this.ctx.currentTime;
  // The track ends: on to the next without a gap, or finished, and then stopped.
  if(this.state===STATE.finished)this.state=STATE.stopped;
  const v=this.voice;
  if(this.state===STATE.started&&v&&this.heldS===undefined&&now>=v.startsAt+v.decoder.buffer.duration-v.offsetS){
   if(this.nextVoice){this.decoder=this.nextVoice.decoder;this.voice=this.nextVoice;this.nextVoice=undefined;this.next=undefined;this.release(v);}
   else{this.state=STATE.finished;this.release(v);this.voice=undefined;}
  }
  if(this.state===STATE.stopping&&now>=this.stoppingAt)this.state=STATE.stopped;
  if(this.stopRequest){this.stopRequest=false;this.channelStop();}
  if(this.pending&&!this.busy){const r=this.pending;this.pending=undefined;this.busy=true;void this.prepare(r).finally(()=>{this.busy=false;});}
 }
 private async prepare(r:Request){
  let next:Decoder|undefined;
  if(r.next!==-1)next=await this.decode(r.next);else this.setNext(undefined);
  if(r.next===-1||this.playingTrackId()!==r.track){
   const current=await this.decode(r.track);
   if(current){this.prepareStream(current,(r.startMs/1000)%current.buffer.duration);this.setNext(next);}
   else if(next){this.setNext(undefined);this.prepareStream(next,0);}
   else{this.setNext(undefined);this.preparing=true;this.preparingIds=r.next!==-1?r.next:r.track;return;}
   this.preparing=false;
  }else{
   if(next)this.setNext(next);
   // SetReady.
   if(this.state===STATE.stopping)this.state=STATE.stopped;else if(this.state===STATE.stopped&&this.decoder)this.state=STATE.ready;
  }
 }
 private async decode(id:number):Promise<Decoder|undefined>{
  if(id<0)return undefined;
  const buffer=await this.loader.load(id).catch(()=>undefined);
  return buffer&&buffer.duration>0?{id,buffer}:undefined;
 }
 /** PrepareStream: what played stops, and the track is ready at its cursor. */
 private prepareStream(decoder:Decoder,cursorS:number){
  this.silence(this.voice);this.silence(this.nextVoice);this.voice=this.nextVoice=undefined;this.heldS=undefined;
  // The iOS port's PrepareStream stops the channel (-6) first, so it always comes out ready.
  this.decoder=decoder;this.cursorS=cursorS;this.state=STATE.ready;
 }
 /** SetNextStream: the track to move on to; a playing track gets it lined up at its end. */
 private setNext(next:Decoder|undefined){
  if(this.nextVoice){this.release(this.nextVoice);this.nextVoice=undefined;}
  this.next=next;this.scheduleNext();
 }
 private scheduleNext(){
  const v=this.voice,next=this.next;
  if(!v||!next||this.nextVoice||this.state!==STATE.started||this.heldS!==undefined)return;
  const end=v.startsAt+v.decoder.buffer.duration-v.offsetS;
  if(end>this.ctx.currentTime)this.nextVoice=this.startVoice(next,end,0);
 }
 private startVoice(decoder:Decoder,at:number,offsetS:number):Voice{
  const source=this.ctx.createBufferSource(),gain=this.ctx.createGain();
  source.buffer=decoder.buffer;source.connect(gain);gain.connect(this.out);source.start(at,Math.min(offsetS,decoder.buffer.duration));
  return {source,gain,startsAt:at,offsetS,decoder};
 }
 /** Stop: the playing track fades to silence and the channel is stopping until it has. */
 private channelStop(){
  this.silence(this.voice);this.silence(this.nextVoice);this.voice=this.nextVoice=undefined;this.heldS=undefined;
  this.state=STATE.stopping;this.stoppingAt=this.ctx.currentTime+FADE_S;
 }
 private silence(v:Voice|undefined){
  if(!v)return;const t=this.ctx.currentTime;
  v.gain.gain.setTargetAtTime(0,t,FADE_S/4);
  try{v.source.stop(t+FADE_S);}catch{/* Not started or already stopped. */}
  setTimeout(()=>this.release(v),FADE_S*1000+50);
 }
 private release(v:Voice){try{v.source.stop();}catch{/* Already stopped. */}v.source.disconnect();v.gain.disconnect();}
 snapshot(){return {state:this.trackPlayTime(),active:this.activeTrackId(),next:this.next?.id??-1,started:this.started};}
}
