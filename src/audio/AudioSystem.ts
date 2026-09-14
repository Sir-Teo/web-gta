import {nativeHeadroomGain} from './nativeHeadroom';
import {readNativeFootsteps,nativeFootstepChoice,type NativeFootstepFiles} from '../assets/nativeFootsteps';
import {sfxPcmSamples,type SfxSound} from '../assets/sfx';
import type {FootstepCategory} from '../assets/surfaceAudio';
import { clamp, type Vec3 } from '../core/math';
import type { Simulation } from '../simulation/Simulation';
import { sampleTimecycle } from '../world/timecycle';
import { SoundEvents, type SoundEvent } from './events';
import { ambienceSamples } from './synthesis';
import { parseAudioSettings, readAudioSettings, saveAudioSettings, type AudioSettings } from './settings';

const CLIPS = ['engine', 'door-open', 'door-close', ...['concrete', 'grass'].flatMap(surface => [0, 1, 2].map(i => `step-${surface}-${i}`))];
interface Loop { source: AudioBufferSourceNode; gain: GainNode; panner?: PannerNode }
export class AudioSystem {
  settings = readAudioSettings();
  private context: AudioContext | null = null;
  private master!: GainNode;
  private effects!: GainNode;
  private ambience!: GainNode;
  private analyser!: AnalyserNode;
  private meter = new Float32Array(1024);
  private buffers = new Map<string, AudioBuffer>();
  private voices = new Map<AudioBufferSourceNode, () => void>();
  private loops: Loop[] = [];
  private engine?: Loop;
  private wind?: Loop;
  private crickets?: Loop;
  private traffic?: Loop;
  private horn?: Loop;
  private events = new SoundEvents();
  private abort = new AbortController();
  private encoded: Promise<({ name: string; data: ArrayBuffer } | null)[]>;
  private stateQueue = Promise.resolve();
  private playing = false;
  private disposed = false;
  private loaded = false;
  private failed = 0;
  private unavailable = false;
  private ear: Vec3 = { x: 0, y: 0, z: 0 };
  private gear = 0;
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
  constructor() {
    this.encoded = Promise.all(CLIPS.map(async name => {
      const request = new AbortController(), cancel = () => request.abort();
      this.abort.signal.addEventListener('abort', cancel, { once: true });
      const timeout = setTimeout(cancel, 8000);
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}audio/${name}.wav`, { signal: request.signal });
        if (!response.ok) throw new Error(`Audio response ${response.status}`);
        return { name, data: await response.arrayBuffer() };
      } catch { if (!this.disposed) this.failed++; return null; }
      finally { clearTimeout(timeout); this.abort.signal.removeEventListener('abort', cancel); }
    }));
  }
  /** Called synchronously by Play/Continue so the browser sees a user gesture. */
  unlock() {
    if (this.disposed) return;
    if (!this.context) {
      try {
        const ctx = this.context = new AudioContext({ latencyHint: 'interactive' });
        this.master = ctx.createGain(); this.master.gain.value = 0;
        this.effects = ctx.createGain(); this.ambience = ctx.createGain();
        const limiter = ctx.createDynamicsCompressor(); limiter.threshold.value = -6; limiter.knee.value = 12;
        limiter.ratio.value = 8; limiter.attack.value = 0.003; limiter.release.value = 0.12;
        this.analyser = ctx.createAnalyser(); this.analyser.fftSize = 1024;
        this.effects.connect(this.master); this.ambience.connect(this.master);
        this.master.connect(limiter); limiter.connect(this.analyser); this.analyser.connect(ctx.destination);
        this.unavailable = false; void this.load(ctx);
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
    else { this.stopShots(); this.silenceLoops(); }
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
    this.ambience.gain.setTargetAtTime(this.settings.ambience, t, 0.015);
  }
  private async load(ctx: AudioContext) {
    const files = await this.encoded;
    await Promise.all(files.map(async file => {
      if (!file || this.disposed) return;
      try { const buffer = await ctx.decodeAudioData(file.data); if (!this.disposed) this.buffers.set(file.name, buffer); }
      catch { if (!this.disposed) this.failed++; }
    }));
    if (this.disposed) return;
    const engine = this.buffers.get('engine');
    if (engine) {
      this.engine = this.loop(ctx, engine, this.effects, { x: 0, y: 0, z: 0 });
      this.traffic = this.loop(ctx, engine, this.ambience, { x: 0, y: 2, z: 161 });
      this.traffic.source.playbackRate.value = 0.7; this.traffic.panner!.refDistance = 18;
    }
    for (const kind of ['wind', 'crickets', 'horn'] as const) {
      const data = ambienceSamples(ctx.sampleRate, kind), buffer = ctx.createBuffer(1, data.length, ctx.sampleRate);
      buffer.copyToChannel(data, 0);
      const loop = this.loop(ctx, buffer, kind === 'horn' ? this.effects : this.ambience, kind === 'horn' ? { x: 0, y: 0, z: 0 } : undefined);
      if (kind === 'wind') this.wind = loop; else if (kind === 'crickets') this.crickets = loop; else this.horn = loop;
    }
    this.loaded = true; this.applySettings(); this.reconcile();
  }
  private panner(ctx: AudioContext, position: Vec3) {
    const panner = ctx.createPanner(); panner.panningModel = 'HRTF'; panner.distanceModel = 'inverse';
    panner.refDistance = 2; panner.rolloffFactor = 1.2; panner.maxDistance = 180;
    panner.positionX.value = position.x; panner.positionY.value = position.y; panner.positionZ.value = position.z;
    return panner;
  }
  private loop(ctx: AudioContext, buffer: AudioBuffer, bus: AudioNode, position?: Vec3): Loop {
    const source = ctx.createBufferSource(), gain = ctx.createGain(); gain.gain.value = 0;
    source.buffer = buffer; source.loop = true; source.connect(gain);
    const panner = position ? this.panner(ctx, position) : undefined;
    if (panner) { gain.connect(panner); panner.connect(bus); } else gain.connect(bus);
    source.start(); const loop = { source, gain, panner }; this.loops.push(loop); return loop;
  }
  reset(sim: Simulation) { this.events.reset(sim); this.stopShots(); this.silenceLoops(); this.gear = 0; }
  tick(sim: Simulation, landingContacts?: readonly ('right' | 'left')[], playerSurface?: FootstepCategory) {
    for (const event of this.events.observe(sim, true, landingContacts, playerSurface)) this.shot(event);
  }
  private shot(event: SoundEvent) {
    const ctx = this.context;
    if(!ctx||ctx.state!=='running'||!this.playing||this.settings.muted||this.settings.master===0||this.settings.effects===0||this.voices.size>=16||
      Math.hypot(event.position.x-this.ear.x,event.position.z-this.ear.z)>35)return;
    let buffer = this.buffers.get(event.sound),native=false,headroomGain=1;
    if(ctx&&this.nativeFeet&&event.footstep){
      const choice=nativeFootstepChoice(event.footstep,Math.random()),key=`${choice.bank}/${choice.sound}`,sound=this.nativeFeet[choice.bank][choice.sound];
      buffer=this.nativeBuffers.get(key);
      if(!buffer){const samples=sfxPcmSamples(sound);buffer=ctx.createBuffer(1,samples.length,sound.sampleRate);buffer.copyToChannel(samples,0);this.nativeBuffers.set(key,buffer);}
      native=true;headroomGain=nativeHeadroomGain(sound.headroom);
    }
    if (!buffer) return;
    const source = ctx.createBufferSource(), gain = ctx.createGain(), panner = this.panner(ctx, event.position);
    source.buffer = buffer; source.playbackRate.value = event.rate; gain.gain.value = event.gain*headroomGain;
    source.connect(gain); gain.connect(panner); panner.connect(this.effects);
    const cleanup = () => { source.disconnect(); gain.disconnect(); panner.disconnect(); this.voices.delete(source); };
    this.voices.set(source, cleanup); source.onended = cleanup; source.start(); this.shotsPlayed++;if(native)this.nativeShotsPlayed++;
  }
  private silenceLoops() {
    const now = this.context?.currentTime ?? 0;
    for (const loop of this.loops) { loop.gain.gain.cancelScheduledValues(now); loop.gain.gain.setValueAtTime(0, now); }
  }
  private stopShots() {
    for (const [source, cleanup] of this.voices) { source.stop(); source.onended = null; cleanup(); }
  }
  update(sim: Simulation, ear: Vec3, yaw: number, pitch: number, throttle: number, horn: boolean) {
    const ctx = this.context; this.ear = { ...ear };
    if (!ctx || !this.playing) return;
    const listener = ctx.listener, now = ctx.currentTime;
    listener.positionX.value = ear.x; listener.positionY.value = ear.y; listener.positionZ.value = ear.z;
    listener.forwardX.value = -Math.sin(yaw) * Math.cos(pitch); listener.forwardY.value = -Math.sin(pitch); listener.forwardZ.value = -Math.cos(yaw) * Math.cos(pitch);
    listener.upX.value = 0; listener.upY.value = 1; listener.upZ.value = 0;
    const car = sim.activeVehicle, speed = car ? Math.abs(car.controller.currentVehicleSpeed()) : 0;
    const bands = [0, 7, 14, 23, 34, 55];
    while (this.gear < 4 && speed > bands[this.gear + 1] + 0.7) this.gear++;
    while (this.gear > 0 && speed < bands[this.gear] - 1.2) this.gear--;
    if (this.engine) {
      const ratio = clamp((speed - bands[this.gear]) / (bands[this.gear + 1] - bands[this.gear]), 0, 1);
      this.engine.source.playbackRate.setTargetAtTime(0.62 + ratio * 0.9 + Math.max(0, throttle) * 0.15, now, 0.08);
      this.engine.gain.gain.setTargetAtTime(car ? 0.48 + Math.abs(throttle) * 0.15 : 0, now, 0.08);
    }
    for (const loop of [this.engine, this.horn]) if (loop?.panner && car) {
      const p = car.body.translation(); loop.panner.positionX.value = p.x; loop.panner.positionY.value = p.y; loop.panner.positionZ.value = p.z;
    }
    this.horn?.gain.gain.setTargetAtTime(car && horn ? 0.65 : 0, now, 0.015);
    const night = sampleTimecycle(sim.timeMinutes).night;
    this.wind?.gain.gain.setTargetAtTime(0.14, now, 0.2);
    this.crickets?.gain.gain.setTargetAtTime(night * 0.22, now, 0.5);
    this.traffic?.gain.gain.setTargetAtTime(0.16 * (1 - night * 0.5), now, 0.5);
  }
  state() {
    let rms = 0;
    if (this.context?.state === 'running') {
      this.analyser.getFloatTimeDomainData(this.meter);
      rms = Math.sqrt(this.meter.reduce((sum, value) => sum + value * value, 0) / this.meter.length);
    }
    return { context: this.context?.state ?? 'uninitialized', loaded: this.loaded, failed: this.failed, unavailable: this.unavailable,
      nativeFootstepBanks:this.nativeFeet?.length??0,nativeShotsPlayed:this.nativeShotsPlayed,buffers: this.buffers.size, loops: this.loops.length, voices: this.voices.size, shotsPlayed: this.shotsPlayed, rms, settings: { ...this.settings } };
  }
  dispose() {
    this.nativeLoad++;this.nativeFeet=undefined;this.nativeBuffers.clear();
    this.disposed = true; this.playing = false; this.abort.abort(); this.stopShots();
    for (const loop of this.loops) { loop.source.stop(); loop.source.disconnect(); loop.gain.disconnect(); loop.panner?.disconnect(); }
    this.loops = []; this.buffers.clear(); void this.context?.close().catch(() => {});
  }
}
