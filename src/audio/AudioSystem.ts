import {NativeBankLoader} from './native/NativeBankLoader';
import {NativeAudioEngine,type NativeAudioFrame,type NativeCombatSource} from './native/NativeAudioEngine';
import {MISSION_BANK_SLOT_FIRST} from './native/NativeScriptAudio';
import type {SurfaceAudioFlags} from '../assets/surfaceAudio';
import {WebAudioChannels} from './native/WebAudioChannels';
import {SCRIPT_BANK_FIRST,SCRIPT_SLOT_FIRST,SOUNDS_PER_BANK,ScriptSpeech,scriptSpeechMp3} from './ScriptSpeech';
import type {NativeBankSound} from './native/NativeSoundManager';
import {PAIN_BANKS} from './native/painSpeech';
import {StreamTracks} from './StreamTracks';
import type {BeatTrackStream,TrackBeat} from '../engine/ScmCutsceneTrack';
import type {AmbienceChannel} from './NativeAmbienceTracks';
import {RadioStream} from './RadioStream';
import {readNativeCombatAudio,combatSample,type CombatSound} from '../assets/nativeCombatAudio';
import {nativeSoundFrequency} from './nativeFrequency';
import {nativeHeadroomGain} from './nativeHeadroom';
import {readNativeFootsteps,nativeFootstepChoice,type NativeFootstepFiles} from '../assets/nativeFootsteps';
import {sfxPcmSamples,type SfxSound} from '../assets/sfx';
import type {FootstepCategory} from '../assets/surfaceAudio';
import { clamp, type Vec3 } from '../core/math';
import type { Simulation } from '../simulation/Simulation';
import { SoundEvents, type SoundEvent } from './events';
import { parseAudioSettings, readAudioSettings, saveAudioSettings, type AudioSettings } from './settings';
import { resumeAfterInterruption, useAmbientAudioSession } from './audioSession';

export class AudioSystem {
  settings = readAudioSettings();
  private context: AudioContext | null = null;
  private master!: GainNode;
  private effects!: GainNode;
  private analyser!: AnalyserNode;
  private meter = new Float32Array(1024);
  private voices = new Map<AudioBufferSourceNode, () => void>();
  private events = new SoundEvents();
  private stateQueue = Promise.resolve();
  /** A context a call or another app's audio suspended, started again at the next touch or key (audioSession.ts). */
  private recovery?: ReturnType<typeof resumeAfterInterruption>;
  private playing = false;
  private disposed = false;
  private loaded = false;
  private failed = 0;
  private unavailable = false;
  private ear: Vec3 = { x: 0, y: 0, z: 0 };
  private shotsPlayed = 0;
  private nativeFeet?:SfxSound[][];
  private combatBanks=new Map<number,SfxSound[]>();
  private combatShots=0;
  /** Native CAudioEngine port (sound manager, vehicle and weather entities). Its channels bypass the authored limiter. */
  private native?:NativeAudioEngine;
  private nativeOut?:GainNode;
  private nativeChannels?:WebAudioChannels;
  private nativeFrames=0;
  private nativePlayer?:()=>Vec3;
  async loadNativeAudio(base:string){try{const bank=await NativeBankLoader.open(base);if(this.disposed)return false;bank.otherBanks=id=>(PAIN_BANKS as readonly number[]).includes(id)?this.decodeMp3Bank(new URL('pain/',base).href,'pain.json',id):Promise.reject(new Error(`Sound bank ${id} is not packaged.`));bank.otherSound=(id,sound)=>this.scriptSound(id,sound);this.native=new NativeAudioEngine(bank);try{const manifest=await (await fetch(new URL('eventvol.json',base))).json();const response=await fetch(new URL('eventvol.dat',base));if(response.ok){const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length===manifest.bytes&&manifest.sha256===[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join(''))this.native.eventVolumes=new Int8Array(bytes.buffer);}}catch{/* Mix stays at 0 dB without the table. */}if(this.nativePlayer)this.setPlayer(this.nativePlayer);this.attachNative();return true;}catch{this.failed++;return false;}}
  /** Mission dialogue (ScriptSpeech.ts) and the line each of CAEScriptAudioEntity's four slots is playing. */
  private speech?:ScriptSpeech;
  private speechVoices=new Map<number,{source:AudioBufferSourceNode;gain:GainNode}>();
  private speechPlayed=0;
  /** Where the SCRIPT banks are; nothing downloads until a mission loads a line. */
  useScriptSpeech(base:string){
    this.speech=new ScriptSpeech(base,mp3=>{
      if(!this.context)this.prepare();
      const ctx=this.context;if(!ctx)return Promise.reject(new Error('No audio context.'));
      return ctx.decodeAudioData(mp3);
    });
  }
  /** LOAD_MISSION_AUDIO's sample, resolving once it can play (false: it cannot be had, and the mission runs on). With
   * native audio, CAEScriptAudioEntity::PreloadMissionAudio asks it into the slot's bank slot too (one decode serves
   * both). */
  async loadSpeech(sample:number,scriptSlot?:number){
    const script=this.native?.scriptAudio,index=scriptSlot===undefined?-1:scriptSlot-1;
    if(script&&index>=0){
      script.preloadMissionAudio(index,sample);
      const link=script.missionLinks[index];
      if(link?.event===sample&&link.soundId>=0&&await this.native!.bank.loadSoundAsync(link.bank,link.soundId,MISSION_BANK_SLOT_FIRST+index))return true;
    }
    return this.speech?.load(sample)??false;
  }
  /** The loaded line's length, which the script's HAS_MISSION_AUDIO_FINISHED waits out. */
  speechLengthMs(sample:number){const line=this.speech?.line(sample);return line&&line.duration*1000;}
  /** PLAY_MISSION_AUDIO: CAEScriptAudioEntity::PlayLoadedMissionAudio (the iOS executable's) plays the line in its bank
   * slot, at its point or what it follows, at the sample's volume. Without native audio (or the line not in its slot)
   * the line plays at the listener under the effects level, as before. */
  playSpeech(scriptSlot:number,sample:number){
    this.stopSpeechVoice(scriptSlot);
    const script=this.native?.scriptAudio,link=script?.missionLinks[scriptSlot-1];
    if(script&&link?.event===sample&&script.playLoadedMissionAudio(scriptSlot-1)){this.speechPlayed++;return true;}
    const ctx=this.context,line=this.speech?.line(sample);
    if(!ctx||!line||this.disposed)return false;
    const source=ctx.createBufferSource(),gain=ctx.createGain();
    source.buffer=line;source.connect(gain);gain.connect(this.effects);
    const voice={source,gain};this.speechVoices.set(scriptSlot,voice);
    source.onended=()=>{if(this.speechVoices.get(scriptSlot)===voice)this.stopSpeechVoice(scriptSlot);};
    source.start();this.speechPlayed++;return true;
  }
  /** A mission audio line plays (the radio ducks under it). */
  get speechPlaying(){return this.speechVoices.size>0||!!this.native?.scriptAudio.missionAudioPlaying;}
  /** SET_MISSION_AUDIO_POSITION and the attach commands: the slot's link takes the point or the entity. */
  missionAudioAt(scriptSlot:number,at:import('./native/NativeScriptAudio').MissionAudioAt){
    const script=this.native?.scriptAudio;if(!script)return;
    if('physical' in at)script.attachMissionAudioToPhysical(scriptSlot-1,at.physical);else script.setMissionAudioPosition(scriptSlot-1,at.position);
  }
  /** CLEAR_MISSION_AUDIO, and the mission's clean-up: the slot's line stops (ClearMissionAudio: everything in its bank
   * slot). */
  stopSpeech(scriptSlot:number){
    this.native?.scriptAudio.clearMissionAudio(scriptSlot-1);
    this.stopSpeechVoice(scriptSlot);
  }
  /** The slot's line playing at the listener, without native audio. */
  private stopSpeechVoice(scriptSlot:number){
    const voice=this.speechVoices.get(scriptSlot);if(!voice)return;
    this.speechVoices.delete(scriptSlot);voice.source.onended=null;
    try{voice.source.stop();}catch{/* Already ended. */}
    voice.source.disconnect();voice.gain.disconnect();
  }
  /** The stream tracks (StreamTracks.ts) and CAECutsceneTrackManager's one channel, which plays one at a time. */
  private streams?:StreamTracks;
  /** CAECutsceneTrackManager's one channel: the track loaded for it, and the one playing with where it is. */
  private trackLoaded?:{buffer:AudioBuffer;beats:readonly TrackBeat[]};
  private track?:{source:AudioBufferSourceNode;gain:GainNode;playedS:number;since:number;rate:number};
  private tracksPlayed=0;
  /** The latest load: one superseded while it downloaded is not kept. */
  private trackRequest=0;
  useStreamTracks(base:string){
    this.streams=new StreamTracks(base,mp3=>{
      if(!this.context)this.prepare();
      const ctx=this.context;if(!ctx)return Promise.reject(new Error('No audio context.'));
      return ctx.decodeAudioData(mp3);
    });
  }
  /** The stream the script's beat tracks (and the mission-passed tune, which is one) play on. A track plays under
   * the effects level; its play time is the audio's own, so the beats the rhythm games read keep to what is heard. */
  readonly beatTracks:BeatTrackStream={
    load:async id=>{
      this.stopTrack();this.trackLoaded=undefined;const request=++this.trackRequest;
      const loaded=await this.streams?.load(id);
      if(!loaded||request!==this.trackRequest||this.disposed)return undefined;
      this.trackLoaded=loaded;return {beats:loaded.beats,lengthMs:loaded.buffer.duration*1000};
    },
    play:()=>{
      const ctx=this.context,loaded=this.trackLoaded;if(!ctx||!loaded||this.disposed)return;
      this.stopTrack();
      const source=ctx.createBufferSource(),gain=ctx.createGain();
      source.buffer=loaded.buffer;source.connect(gain);gain.connect(this.effects);
      const track={source,gain,playedS:0,since:ctx.currentTime,rate:1};this.track=track;
      source.onended=()=>{if(this.track===track)this.stopTrack();};
      source.start();this.tracksPlayed++;
    },
    // CheckForPause: the channel's frequency goes to zero, which holds the track where it is.
    pause:paused=>{
      const ctx=this.context,track=this.track;if(!ctx||!track)return;
      track.playedS+=(ctx.currentTime-track.since)*track.rate;track.since=ctx.currentTime;
      track.rate=paused?0:1;track.source.playbackRate.value=track.rate;
    },
    stop:()=>{this.stopTrack();},
    playedMs:()=>{
      const ctx=this.context,track=this.track;if(!ctx||!track)return undefined;
      return (track.playedS+(ctx.currentTime-track.since)*track.rate)*1000;
    },
  };
  /** CAEAmbienceTrackManager's channel: one looped track at a time, at a volume in dB and a frequency factor (the
   * playback rate, which the channel keeps from one track to the next). How far in it is counts the track's time. */
  private ambience?:{source:AudioBufferSourceNode;gain:GainNode;since:number;playedS:number};
  private ambienceRequest=0;private ambiencePlayed=0;private ambienceRate=1;
  readonly ambienceTracks:AmbienceChannel={
    play:async(id,startMs)=>{
      this.stopAmbience();const request=++this.ambienceRequest;
      const loaded=await this.streams?.load(id),ctx=this.context;
      if(!loaded||!ctx||request!==this.ambienceRequest||this.disposed)return false;
      const duration=loaded.buffer.duration,offsetS=duration>0?(startMs/1000)%duration:0;
      const source=ctx.createBufferSource(),gain=ctx.createGain();
      source.buffer=loaded.buffer;source.loop=true;source.playbackRate.value=this.ambienceRate;gain.gain.value=0;
      source.connect(gain);gain.connect(this.effects);source.start(0,offsetS);
      this.ambience={source,gain,since:ctx.currentTime,playedS:offsetS};this.ambiencePlayed++;return true;
    },
    setVolume:dB=>{const a=this.ambience;if(a)a.gain.gain.value=dB<=-100?0:10**(dB/20);},
    setFrequency:factor=>{
      const ctx=this.context,a=this.ambience;
      if(ctx&&a&&factor!==this.ambienceRate){a.playedS+=(ctx.currentTime-a.since)*this.ambienceRate;a.since=ctx.currentTime;a.source.playbackRate.value=factor;}
      this.ambienceRate=factor;
    },
    stop:()=>{this.ambienceRequest++;this.stopAmbience();},
    playedMs:()=>{const ctx=this.context,a=this.ambience;return ctx&&a?(a.playedS+(ctx.currentTime-a.since)*this.ambienceRate)*1000:undefined;},
  };
  private stopAmbience(){
    const a=this.ambience;if(!a)return;this.ambience=undefined;
    try{a.source.stop();}catch{/* Already ended. */}
    a.source.disconnect();a.gain.disconnect();
  }
  /** CAECutsceneTrackManager::StopCutsceneTrack. */
  stopTrack(){
    const track=this.track;if(!track)return;
    this.track=undefined;track.source.onended=null;
    try{track.source.stop();}catch{/* Already ended. */}
    track.source.disconnect();track.gain.disconnect();
  }
  /** A bank packaged as MP3s (scripts/content/package-script-speech.mjs: the PAIN_A pack), decoded to the PCM the
   * native sound manager plays. */
  private mp3Manifests=new Map<string,Promise<{banks:{id:number;path:string;bytes:number;sha256:string}[]}>>();
  /** One sound of a SCRIPT pack bank (the police scanner's words, which CAEAudioHardware::LoadSound loads one at a
   * time), decoded through the mission dialogue's loader. */
  private async scriptSound(bank:number,sound:number):Promise<NativeBankSound|undefined>{
    if(!this.speech||bank<SCRIPT_BANK_FIRST||sound<0||sound>=SOUNDS_PER_BANK)return undefined;
    const sample=SCRIPT_SLOT_FIRST+(bank-SCRIPT_BANK_FIRST)*SOUNDS_PER_BANK+sound;
    if(!await this.speech.load(sample))return undefined;
    const line=this.speech.line(sample);
    return line&&{samples:line.getChannelData(0),sampleRate:line.sampleRate,headroom:0,loopStart:-1};
  }
  private async decodeMp3Bank(base:string,manifestName:string,id:number):Promise<NativeBankSound[]>{
    let manifest=this.mp3Manifests.get(base);
    if(!manifest){manifest=fetch(new URL(manifestName,base)).then(r=>r.ok?r.json():Promise.reject(new Error(`${manifestName} unavailable.`)));this.mp3Manifests.set(base,manifest);manifest.catch(()=>this.mp3Manifests.delete(base));}
    const entry=(await manifest).banks.find(b=>b.id===id);
    if(!entry||entry.path!==`bank-${id}.bin`)throw new Error(`Sound bank ${id} is not packaged.`);
    const r=await fetch(new URL(entry.path,base));if(!r.ok)throw new Error(`Sound bank ${id} unavailable.`);
    const bytes=new Uint8Array(await r.arrayBuffer());
    if(bytes.length!==entry.bytes||[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('')!==entry.sha256)throw new Error(`Sound bank ${id} checksum mismatch.`);
    if(!this.context)this.prepare();
    const ctx=this.context;if(!ctx)throw new Error('No audio context.');
    const count=new DataView(bytes.buffer).getUint16(0,true);
    return Promise.all(Array.from({length:count},async(_,i)=>{
      const mp3=scriptSpeechMp3(bytes,i);if(!mp3)throw new Error(`Sound bank ${id} lacks sound ${i}.`);
      const buffer=await ctx.decodeAudioData(mp3.slice().buffer);
      return {samples:buffer.getChannelData(0),sampleRate:buffer.sampleRate,headroom:0,loopStart:-1};
    }));
  }
  /** The player's browser position for native weapon and footstep entities. */
  setPlayer(position:()=>Vec3){this.nativePlayer=position;this.native?.setPlayer(()=>{const p=position();return {x:p.x,y:-p.z,z:p.y};});}
  get nativeEngine(){return this.native;}
  private attachNative(){
    const ctx=this.context;if(!ctx||!this.native||this.nativeChannels)return;
    this.nativeOut=ctx.createGain();this.nativeOut.gain.value=0;this.nativeOut.connect(this.analyser);
    this.nativeChannels=new WebAudioChannels(ctx,this.nativeOut,this.native.manager.channelCount);this.native.renderer=this.nativeChannels;this.applySettings();
    // The radio's track stream, under the effects level as the other stream tracks are (the port has no radio volume).
    this.native.attachRadioStream(new RadioStream(ctx,this.effects,{load:id=>this.streams?.loadOnce(id).then(t=>t?.buffer)??Promise.resolve(undefined)}));
  }
  /** One rendered frame of the native engine; it services at the 30 FPS frame limit internally. */
  nativeFrame(elapsedSeconds:number,build:()=>NativeAudioFrame){if(!this.native||!this.playing)return;this.nativeFrames+=this.native.frame(elapsedSeconds*1000,build);}
  async loadNativeCombat(base:string){try{const banks=await readNativeCombatAudio(base);if(!this.disposed)this.combatBanks=banks;return !this.disposed;}catch{this.failed++;return false;}}
  /** Weapon, projectile, melee and explosion reports: the native entities when the engine is loaded, else the sample fallback. */
  /** Silent settings start no voices, matching the sample path's own checks. */
  private get audible(){return this.playing&&!this.settings.muted&&this.settings.master>0&&this.settings.effects>0;}
  /** A CAEFrontendAudioEntity event such as AE_FRONTEND_PART_MISSION_COMPLETE. */
  frontend(event:number,volumeBoost=0){if(this.native&&this.audible)this.native.frontend.addAudioEvent(event,volumeBoost);}
  /** CAudioEngine::ReportMissionAudioEvent: a script's REPORT_MISSION_AUDIO_EVENT_AT_*. */
  /** Handled whatever the volume: a track's start or stop missed while muted would be missed for good. */
  missionAudioEvent(event:number,at:import('./native/NativeScriptAudio').MissionAudioAt){this.native?.scriptAudio.processMissionAudioEvent(event,at);}
  /** A garage's door moving (CGarage::SlideDoorOpen and SlideDoorClosed's m_GarageAudio.AddAudioEvent). */
  garageDoorEvent(garage:string,event:number,position:{x:number;y:number;z:number}){this.native?.garageDoor(garage).addAudioEvent(event,position,0,1);}
  /** A whole SCRIPT bank for a mission audio slot (false when there is no native audio to hold it), and its release. */
  loadMissionBank(index:number,bank:number){return this.native?.scriptAudio.loadMissionBank(index,bank)??Promise.resolve(false);}
  clearMissionBank(index:number){this.native?.scriptAudio.clearMissionBank(index);}
  pedFootstep(ped:object,position:Vec3,move:'walk'|'run'|'sprint',foot:'left'|'right'){if(this.native&&this.audible)this.native.pedFootstep(ped,{x:position.x,y:-position.z,z:position.y},move,foot);}
  /** `shooter` names an NPC and follows its position (renderer frame), so the ped keeps its own weapon audio entity. */
  combat(event:CombatSound,weapon:number,position:Vec3,source:NativeCombatSource='player',shooter?:{id:string;position:()=>Vec3|undefined}){
    if(this.native){if(this.audible)this.native.combat(event,weapon,{x:position.x,y:-position.z,z:position.y},source,shooter?.id,shooter&&{position:()=>{const p=shooter.position();return p&&{x:p.x,y:-p.z,z:p.y};}});return;}
    const choice=combatSample(event,weapon);if(!choice)return;const sound=this.combatBanks.get(choice.bank)?.[choice.sample];if(!sound)return;this.shot({sound:'combat',position,rate:choice.rate,gain:event==='explosion'?.85:.7} as SoundEvent,{sound,key:`combat/${choice.bank}/${choice.sample}`,duration:choice.duration});}
  private nativeBuffers=new Map<string,AudioBuffer>();
  private nativeLoad=0;
  private nativeShotsPlayed=0;
  async loadNativeFootsteps(files:NativeFootstepFiles){
    const generation=++this.nativeLoad;
    try{const banks=await readNativeFootsteps(files);if(this.disposed||generation!==this.nativeLoad)return false;
      this.stopShots();this.nativeBuffers.clear();this.nativeFeet=banks;return true;
    }catch{return false;}
  }
  /** Builds the (still suspended) context and graph ahead of play. Constructing an AudioContext opens the output
   * device and blocks the main thread for a few hundred milliseconds; done while the menu idles, the click that
   * starts play only has to resume it. Browsers allow a context to be created before a gesture, not to start. */
  prepare() {
    if (this.disposed || this.context || this.unavailable) return;
    this.createContext();
  }
  /** Called synchronously by Play/Continue so the browser sees a user gesture. */
  unlock() {
    if (this.disposed) return;
    if (!this.context && !this.createContext()) return;
    void this.context!.resume().then(() => this.reconcile()).catch(() => {});
  }
  private createContext() {
    try {
      if (typeof navigator !== 'undefined') useAmbientAudioSession(navigator as { audioSession?: { type: string } });
      const ctx = this.context = new AudioContext({ latencyHint: 'interactive' });
      if (typeof window !== 'undefined') this.recovery = resumeAfterInterruption(ctx, () => this.playing && !this.disposed, () => this.unlock(), window);
      this.master = ctx.createGain(); this.master.gain.value = 0;
      this.effects = ctx.createGain();
      const limiter = ctx.createDynamicsCompressor(); limiter.threshold.value = -6; limiter.knee.value = 12;
      limiter.ratio.value = 8; limiter.attack.value = 0.003; limiter.release.value = 0.12;
      this.analyser = ctx.createAnalyser(); this.analyser.fftSize = 1024;
      this.effects.connect(this.master);
      this.master.connect(limiter); limiter.connect(this.analyser); this.analyser.connect(ctx.destination);
      this.unavailable = false; this.loaded = true; this.attachNative();
    } catch {
      this.unavailable = true; void this.context?.close().catch(() => {}); this.context = null; return false;
    }
    return true;
  }
  private reconcile() {
    // Serialize state changes and consult the latest intent, including pause during async loading.
    this.stateQueue = this.stateQueue.then(async () => {
      const ctx = this.context;
      if (!ctx || this.disposed || ctx.state === 'closed') return;
      if (this.playing && ctx.state !== 'running') await ctx.resume();
      else if (!this.playing && ctx.state === 'running') await ctx.suspend();
    }).catch(() => {});
    // A resume the browser holds back (no gesture behind it, an interruption not over) waits for the next touch.
    this.recovery?.check();
  }
  setPlaying(playing: boolean) {
    this.playing = playing;
    if (playing) this.unlock();
    else { this.stopShots();  }
    this.applySettings(); this.reconcile();
  }
  setSettings(settings: AudioSettings) {
    this.settings = parseAudioSettings(settings); saveAudioSettings(this.settings);
    if(this.settings.muted||this.settings.master===0||this.settings.effects===0)this.stopShots();
    this.applySettings();
  }
  /** CAEAudioHardware::SetEffectsFaderScalingFactor: the screen fade's factor every channel's gain is scaled by. */
  private fader=1;
  setFaderScalingFactor(factor:number){const f=Math.min(1,Math.max(0,factor));if(f===this.fader)return;this.fader=f;this.applySettings();}
  private applySettings() {
    if (!this.context) return;
    const t = this.context.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(this.playing && !this.settings.muted ? this.settings.master*this.fader : 0, t, 0.015);
    this.effects.gain.setTargetAtTime(this.settings.effects, t, 0.015);
    this.nativeOut?.gain.setTargetAtTime(this.playing && !this.settings.muted ? this.settings.master*this.settings.effects*this.fader : 0, t, 0.015);
  }
  private panner(ctx: AudioContext, position: Vec3) {
    const panner = ctx.createPanner(); panner.panningModel = 'HRTF'; panner.distanceModel = 'inverse';
    panner.refDistance = 2; panner.rolloffFactor = 1.2; panner.maxDistance = 180;
    panner.positionX.value = position.x; panner.positionY.value = position.y; panner.positionZ.value = position.z;
    return panner;
  }
  reset(sim: Simulation) { this.events.reset(sim); this.stopShots();   }
  tick(sim: Simulation, landingContacts?: readonly ('right' | 'left')[], playerSurface?: FootstepCategory, native?:{surface:SurfaceAudioFlags|undefined;move:'walk'|'run'|'sprint'}) {
    for (const event of this.events.observe(sim, true, landingContacts, playerSurface)) {
      if(this.native&&native&&event.footstep){
        if(this.audible){if(event.landed){this.native.landing(native.surface,sim.fallLandingSound);sim.fallLandingSound=false;}if(!event.landingOnly)this.native.footstep(native.move,sim.player.crouched,native.surface);}
        continue;
      }
      this.shot(event);
    }
  }
  private shot(event: SoundEvent,combat?:{sound:SfxSound;key:string;duration?:number}) {
    const ctx = this.context;
    if(!ctx||ctx.state!=='running'||!this.playing||this.settings.muted||this.settings.master===0||this.settings.effects===0||this.voices.size>=16||
      Math.hypot(event.position.x-this.ear.x,event.position.z-this.ear.z)>(combat?150:35))return;
    let buffer:AudioBuffer|undefined,native=false,headroomGain=1,rate=event.rate;
    if(ctx&&this.nativeFeet&&event.footstep){
      const choice=nativeFootstepChoice(event.footstep,Math.random()),key=`${choice.bank}/${choice.sound}`,sound=this.nativeFeet[choice.bank][choice.sound];
      buffer=this.nativeBuffers.get(key);
      if(!buffer){const samples=sfxPcmSamples(sound);buffer=ctx.createBuffer(1,samples.length,sound.sampleRate);buffer.copyToChannel(samples,0);this.nativeBuffers.set(key,buffer);}
      native=true;headroomGain=nativeHeadroomGain(sound.headroom);rate=nativeSoundFrequency(1,.0588,Math.random());
    }
    if(combat){buffer=this.nativeBuffers.get(combat.key);if(!buffer){const samples=sfxPcmSamples(combat.sound);buffer=ctx.createBuffer(1,samples.length,combat.sound.sampleRate);buffer.copyToChannel(samples,0);this.nativeBuffers.set(combat.key,buffer);}native=true;headroomGain=nativeHeadroomGain(combat.sound.headroom);}
    if (!buffer) return;
    const source = ctx.createBufferSource(), gain = ctx.createGain(), panner = this.panner(ctx, event.position);
    source.buffer = buffer; source.playbackRate.value = rate; gain.gain.value = event.gain*headroomGain;
    source.connect(gain); gain.connect(panner); panner.connect(this.effects);
    const cleanup = () => { source.disconnect(); gain.disconnect(); panner.disconnect(); this.voices.delete(source); };
    this.voices.set(source, cleanup); source.onended = cleanup; source.start(0,0,combat?.duration); this.shotsPlayed++;if(combat)this.combatShots++;if(native)this.nativeShotsPlayed++;
  }
  private stopShots() {
    for (const [source, cleanup] of this.voices) { source.stop(); source.onended = null; cleanup(); }
  }
  update(ear: Vec3, yaw: number, pitch: number) {
    const ctx = this.context; this.ear = { ...ear };
    if (!ctx || !this.playing) return;
    const listener = ctx.listener, now = ctx.currentTime;
    listener.positionX.value = ear.x; listener.positionY.value = ear.y; listener.positionZ.value = ear.z;
    listener.forwardX.value = -Math.sin(yaw) * Math.cos(pitch); listener.forwardY.value = -Math.sin(pitch); listener.forwardZ.value = -Math.cos(yaw) * Math.cos(pitch);
    listener.upX.value = 0; listener.upY.value = 1; listener.upZ.value = 0;
  }
  /** What the menu's audio line needs, without the meter or the voice snapshots. */
  status() { return { unavailable: this.unavailable, failed: this.failed, loaded: this.loaded }; }
  state() {
    let rms = 0;
    if (this.context?.state === 'running') {
      this.analyser.getFloatTimeDomainData(this.meter);
      rms = Math.sqrt(this.meter.reduce((sum, value) => sum + value * value, 0) / this.meter.length);
    }
    return { context: this.context?.state ?? 'uninitialized', loaded: this.loaded, failed: this.failed, unavailable: this.unavailable,
      native:this.native?{...this.native.snapshot(),frames:this.nativeFrames}:null,nativeCombatBanks:this.combatBanks.size,combatShots:this.combatShots,nativeFootstepBanks:this.nativeFeet?.length??0,nativeShotsPlayed:this.nativeShotsPlayed,speechPlayed:this.speechPlayed,tracksPlayed:this.tracksPlayed,trackPlaying:!!this.track,ambiencePlayed:this.ambiencePlayed,ambienceGain:this.ambience?+this.ambience.gain.gain.value.toFixed(4):null,ambienceRate:this.ambience?this.ambienceRate:null,speechVoices:this.speechVoices.size,buffers: this.nativeBuffers.size, voices: this.voices.size, shotsPlayed: this.shotsPlayed, rms, settings: { ...this.settings } };
  }
  dispose() {
    this.nativeLoad++;this.nativeFeet=undefined;this.native?.reset();this.nativeChannels?.dispose();this.combatBanks.clear();this.nativeBuffers.clear();
    for(const slot of [...this.speechVoices.keys()])this.stopSpeech(slot);
    this.stopTrack();this.stopAmbience();
    this.disposed = true; this.playing = false; this.stopShots();
    this.recovery?.dispose(); void this.context?.close().catch(() => {});
  }
}
