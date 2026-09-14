import {nativeSoundFrequency} from './nativeFrequency';
import {nativeHeadroomGain} from './nativeHeadroom';
import {readNativeFootsteps,nativeFootstepChoice,type NativeFootstepFiles} from '../assets/nativeFootsteps';
import {sfxPcmSamples,type SfxSound} from '../assets/sfx';
import type {FootstepCategory} from '../assets/surfaceAudio';
import { clamp, type Vec3 } from '../core/math';
import type { Simulation } from '../simulation/Simulation';
import { SoundEvents, type SoundEvent } from './events';
import { parseAudioSettings, readAudioSettings, saveAudioSettings, type AudioSettings } from './settings';

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
  private playing = false;
  private disposed = false;
  private loaded = false;
  private failed = 0;
  private unavailable = false;
  private ear: Vec3 = { x: 0, y: 0, z: 0 };
  private shotsPlayed = 0;
  private nativeFeet?:SfxSound[][];
  private nativeBuffers=new Map<string,AudioBuffer>();
  private nativeLoad=0;
  private nativeShotsPlayed=0;
  async loadNativeFootsteps(files:NativeFootstepFiles){
    const generation=++this.nativeLoad;
    try{const banks=await readNativeFootsteps(files);if(this.disposed||generation!==this.nativeLoad)return false;
      this.stopShots();this.nativeBuffers.clear();this.nativeFeet=banks;return true;
    }catch{return false;}
  }
  /** Called synchronously by Play/Continue so the browser sees a user gesture. */
  unlock() {
    if (this.disposed) return;
    if (!this.context) {
      try {
        const ctx = this.context = new AudioContext({ latencyHint: 'interactive' });
        this.master = ctx.createGain(); this.master.gain.value = 0;
        this.effects = ctx.createGain();
        const limiter = ctx.createDynamicsCompressor(); limiter.threshold.value = -6; limiter.knee.value = 12;
        limiter.ratio.value = 8; limiter.attack.value = 0.003; limiter.release.value = 0.12;
        this.analyser = ctx.createAnalyser(); this.analyser.fftSize = 1024;
        this.effects.connect(this.master);
        this.master.connect(limiter); limiter.connect(this.analyser); this.analyser.connect(ctx.destination);
        this.unavailable = false; this.loaded = true;
      } catch {
        this.unavailable = true; void this.context?.close().catch(() => {}); this.context = null; return;
      }
    }
    void this.context.resume().then(() => this.reconcile()).catch(() => {});
  }
  private reconcile() {
    // Serialize state changes and consult the latest intent, including pause during async loading.
    this.stateQueue = this.stateQueue.then(async () => {
      const ctx = this.context;
      if (!ctx || this.disposed || ctx.state === 'closed') return;
      if (this.playing && ctx.state !== 'running') await ctx.resume();
      else if (!this.playing && ctx.state === 'running') await ctx.suspend();
    }).catch(() => {});
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
  private applySettings() {
    if (!this.context) return;
    const t = this.context.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(this.playing && !this.settings.muted ? this.settings.master : 0, t, 0.015);
    this.effects.gain.setTargetAtTime(this.settings.effects, t, 0.015);
  }
  private panner(ctx: AudioContext, position: Vec3) {
    const panner = ctx.createPanner(); panner.panningModel = 'HRTF'; panner.distanceModel = 'inverse';
    panner.refDistance = 2; panner.rolloffFactor = 1.2; panner.maxDistance = 180;
    panner.positionX.value = position.x; panner.positionY.value = position.y; panner.positionZ.value = position.z;
    return panner;
  }
  reset(sim: Simulation) { this.events.reset(sim); this.stopShots();   }
  tick(sim: Simulation, landingContacts?: readonly ('right' | 'left')[], playerSurface?: FootstepCategory) {
    for (const event of this.events.observe(sim, true, landingContacts, playerSurface)) this.shot(event);
  }
  private shot(event: SoundEvent) {
    const ctx = this.context;
    if(!ctx||ctx.state!=='running'||!this.playing||this.settings.muted||this.settings.master===0||this.settings.effects===0||this.voices.size>=16||
      Math.hypot(event.position.x-this.ear.x,event.position.z-this.ear.z)>35)return;
    let buffer:AudioBuffer|undefined,native=false,headroomGain=1,rate=event.rate;
    if(ctx&&this.nativeFeet&&event.footstep){
      const choice=nativeFootstepChoice(event.footstep,Math.random()),key=`${choice.bank}/${choice.sound}`,sound=this.nativeFeet[choice.bank][choice.sound];
      buffer=this.nativeBuffers.get(key);
      if(!buffer){const samples=sfxPcmSamples(sound);buffer=ctx.createBuffer(1,samples.length,sound.sampleRate);buffer.copyToChannel(samples,0);this.nativeBuffers.set(key,buffer);}
      native=true;headroomGain=nativeHeadroomGain(sound.headroom);rate=nativeSoundFrequency(1,.0588,Math.random());
    }
    if (!buffer) return;
    const source = ctx.createBufferSource(), gain = ctx.createGain(), panner = this.panner(ctx, event.position);
    source.buffer = buffer; source.playbackRate.value = rate; gain.gain.value = event.gain*headroomGain;
    source.connect(gain); gain.connect(panner); panner.connect(this.effects);
    const cleanup = () => { source.disconnect(); gain.disconnect(); panner.disconnect(); this.voices.delete(source); };
    this.voices.set(source, cleanup); source.onended = cleanup; source.start(); this.shotsPlayed++;if(native)this.nativeShotsPlayed++;
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
  state() {
    let rms = 0;
    if (this.context?.state === 'running') {
      this.analyser.getFloatTimeDomainData(this.meter);
      rms = Math.sqrt(this.meter.reduce((sum, value) => sum + value * value, 0) / this.meter.length);
    }
    return { context: this.context?.state ?? 'uninitialized', loaded: this.loaded, failed: this.failed, unavailable: this.unavailable,
      nativeFootstepBanks:this.nativeFeet?.length??0,nativeShotsPlayed:this.nativeShotsPlayed,buffers: this.nativeBuffers.size, voices: this.voices.size, shotsPlayed: this.shotsPlayed, rms, settings: { ...this.settings } };
  }
  dispose() {
    this.nativeLoad++;this.nativeFeet=undefined;this.nativeBuffers.clear();
    this.disposed = true; this.playing = false; this.stopShots();
    void this.context?.close().catch(() => {});
  }
}
