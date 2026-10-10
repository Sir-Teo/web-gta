import { Group, type Object3D, type Scene } from 'three';
import { readCutsceneFile, readCutsceneCameraPaths, type CutsceneDefinition, type CutsceneCameraPaths } from '../assets/cutscene';
import { readIfp, type AnimationPackage } from '../assets/ifp';
import { decodeCutsceneBundle } from '../assets/cutsceneBundle';
import type { DffModel } from '../assets/dff';
import type { ModelTexture } from '../assets/modelTextures';
import { modelObject } from '../assets/ModelObjects';
import { nativeAmbientState } from '../assets/nativeMaterial';
import { ModelReadCache, readModel } from '../assets/readModel';
import { openStaticWorld } from '../assets/staticWorldArchive';
import { bindAnimation, withoutForeignTracks } from '../animation/bind';
import { FlyByCamera } from '../engine/nativeFlyByCamera';
import { fxMatFromVec } from '../simulation/fx/nativeFxEffects';
import type { FxMatrix } from '../simulation/fx/NativeFx';
/* CCutsceneMgr (gta-reversed CutsceneMgr.cpp, reversed): a cutscene's data, cast and camera for the browser. The
 * published cutscenes (public/play/cuts/manifest.json) play; any other one is left to end as it starts, as the
 * browser has no data for it. The load reads the .cut, the .dat and the clips, and makes the cast: CJ in his clothes
 * for csplay (CClothes::RebuildCutscenePlayer) and the model of the name from MODELS\CUTSCENE.IMG for every other one.
 * The start sets the camera on its spline (StartCutscene) and, the next frame, puts the cast at the offset with their
 * clips running (SetupCutsceneToStart); each frame the timer moves the clips and the text on (Update_overlay). */
export interface CutsceneCastSource { model: DffModel; textures: ModelTexture[] }
interface Published { bundle: { file: string }; track?: number }
interface CastMember {
 model: string; frames: number; group: Group; dispose(): void; sample?(seconds: number): void;
 /** The clump's frames by HAnim bone tag and by name, for an effect riding one (LoadCutsceneData_loading). */
 bone(tag: number): Object3D | undefined; frame(name: string): Object3D | undefined; readonly skinned: boolean;
}
/** The host's particle systems (Fx_c / FxManager_c): made with a local matrix under a parent one, both native. */
export interface CutsceneEffects {
 create(name: string, local: FxMatrix, parent: FxMatrix | undefined): unknown;
 setParent(system: unknown, parent: FxMatrix): void; play(system: unknown): void; stop(system: unknown): void; kill(system: unknown): void;
}
/** tCutsceneParticleEffect as it runs: the system, the bone or frame it rides, and m_bPlaying / m_bStopped. */
interface RunningEffect { system: unknown; start: number; end: number; rides?: Object3D; playing: boolean; stopped: boolean }
/** A frame's world matrix (renderer axes) as a native RwMatrix: right, up, at and position, renderer (x, y, z) being
 * native (x, z, -y). */
function nativeMatrix(object: Object3D, out: FxMatrix = new Float64Array(12)) {
 const e = object.matrixWorld.elements;
 for (let c = 0; c < 4; c++) { out[c * 3] = e[c * 4]; out[c * 3 + 1] = -e[c * 4 + 2]; out[c * 3 + 2] = e[c * 4 + 1]; }
 return out;
}
/** Update_overlay's fade: the camera fades out over the last second (g_bCutSceneFinishing). */
const FINISH_FADE_MS = 1000;
export type CutsceneState = 'none' | 'loading' | 'loaded' | 'failed';

export class CutscenePlayer {
 private published?: Record<string, Published>;
 private readonly ready: Promise<void>;
 state: CutsceneState = 'none';
 /** ms_cutsceneName, lower-cased, while one is loaded or loading. */
 name?: string;
 definition?: CutsceneDefinition;
 /** The stream track FindCutsceneAudioTrackId gives it, -1 for none. */
 track = -1;
 camera?: FlyByCamera;
 private paths?: CutsceneCameraPaths;
 private cast: CastMember[] = [];
 /** ms_cutscenePlayStatus STARTING: the cast goes in on the next update (SetupCutsceneToStart). */
 private starting = false;
 /** ms_running and ms_cutsceneTimerS. */
 running = false; timerSeconds = 0;
 /** ms_currTextOutput, and g_bCutSceneFinishing. */
 private textIndex = 0; private finishing = false;
 /** ms_wasCutsceneSkipped. */
 skipped = false;
 /** The host's part of LoadCutSceneFile once the .cut is read: the offset's scene (CStreaming::LoadScene) and the
  * extra colour. */
 onDefinition?: (definition: CutsceneDefinition) => void;
 /** The host's particle systems, for the .cut's peffect lines. */
 effects?: CutsceneEffects;
 /** CCutsceneMgr::HideRequestedObjects: the host hides the map's objects of each removal's model within 1.5 of its point
  * (CWorld::FindObjectsOfTypeInRange, 2D) and answers how to show them again (DeleteCutsceneData). */
 hideObjects?: (removals: CutsceneDefinition['removals']) => () => void;
 /** The txd an IDE gives a cast model that has none of its own name (a gta3.img ped or prop in the cast). */
 textureDictionary?: (model: string) => string | undefined;
 private effectSystems: RunningEffect[] = [];
 private showObjects?: () => void;
 /** The scene's ambient for the cast, as a ped's (NativeCharacter.setAmbient). */
 readonly ambient = nativeAmbientState();
 private load?: { name: string; cancelled: boolean };
 private source?: ReturnType<typeof openStaticWorld>;
 private cache?: ModelReadCache;
 error?: string;
 constructor(private readonly scene: Scene, private readonly base: string, private readonly playBase: string,
  private readonly playerBody: () => Promise<CutsceneCastSource | undefined>) {
  this.ready = fetch(new URL('cuts/manifest.json', playBase)).then(r => r.ok ? r.json() : undefined)
   .then((m: { cutscenes?: Record<string, Published> } | undefined) => { this.published = m?.cutscenes ?? {}; })
   .catch(() => { this.published = {}; });
 }
 /** Whether the cutscene is one the browser has: answered once the manifest is in, no before. */
 publishes(name: string) { return !!this.published?.[name.toLowerCase()]; }
 /** CCutsceneMgr::LoadCutsceneData for a published cutscene; `false` for one the browser cannot play. */
 begin(name: string) {
  const key = name.toLowerCase(), entry = this.published?.[key];
  this.clear();
  if (!entry) return false;
  this.name = key; this.state = 'loading'; this.track = entry.track ?? -1; this.skipped = false;
  const load = this.load = { name: key, cancelled: false };
  void this.read(key, entry).then(() => { if (!load.cancelled) this.state = 'loaded'; })
   .catch(error => { if (load.cancelled) return; this.error = String(error); this.state = 'failed'; this.disposeCast(); });
  return true;
 }
 private async fetchBytes(file: string) {
  const response = await fetch(new URL(`cuts/${file}`, this.playBase));
  if (!response.ok) throw new Error(`Cutscene file ${file}: HTTP ${response.status}.`);
  let bytes = new Uint8Array(await response.arrayBuffer());
  // The bundle is gzipped on disk; a server that decodes it on the way leaves it as it is.
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  return bytes;
 }
 private async read(name: string, entry: Published) {
  const latin = new TextDecoder('latin1');
  const { cut, dat, anp3 } = decodeCutsceneBundle(await this.fetchBytes(entry.bundle.file));
  const definition = readCutsceneFile(latin.decode(cut)), paths = readCutsceneCameraPaths(latin.decode(dat)), clips = readIfp(anp3);
  if (this.load?.name !== name || this.load.cancelled) return;
  this.definition = definition; this.paths = paths;
  this.onDefinition?.(definition);
  // LoadCutsceneData_loading: an object per model line with its clip on it, the models read side by side. A line's
  // further clips (a repeated slot, which SetCutsceneAnim layers on the object made last) are not played; no
  // cutscene has one. A model that will not load leaves its slot empty, so the effects still count objects from one.
  const slots = await Promise.all(definition.cast.filter(member => !member.repeat).map(member =>
   this.member(member.model, member.anim, clips).catch(error => { this.error = `${member.model}: ${error}`; return undefined; })));
  if (this.load?.name !== name || this.load.cancelled) { for (const built of slots) built?.dispose(); return; }
  this.cast = slots.filter((built): built is CastMember => !!built);
  // The effects, each on its object's bone (a skinned clump: the part is a bone tag) or frame (by name), or none.
  for (const effect of definition.effects) {
   const owner = effect.object > 0 ? slots[effect.object - 1] : undefined;
   const rides = owner && (owner.skinned ? owner.bone(Number(effect.part)) : owner.frame(effect.part));
   const p = effect.position, d = effect.direction, system = this.effects?.create(effect.name, fxMatFromVec([p.x, p.y, p.z], [d.x, d.y, d.z]), rides ? nativeMatrix(rides) : undefined);
   if (system !== undefined) this.effectSystems.push({ system, start: effect.start, end: effect.end, rides, playing: false, stopped: false });
  }
 }
 private async model(name: string): Promise<CutsceneCastSource | undefined> {
  if (name === 'csplay') return this.playerBody();
  const source = await (this.source ??= openStaticWorld(this.base));this.cache ??= new ModelReadCache(source.file, source.entries);
  const dictionary = source.entry(`${name}.txd`) ? name : this.textureDictionary?.(name) ?? name;
  const entry = source.entry(`${name}.dff`), textureEntry = source.entry(`${dictionary}.txd`);
  if (!entry) throw new Error('model not in the archives');
  const read = await readModel({ file: source.file, entry, textureEntry }, this.cache);
  return { model: read.model, textures: read.textures };
 }
 private async member(name: string, anim: string, clips: AnimationPackage): Promise<CastMember | undefined> {
  const asset = await this.model(name);
  if (!asset) return undefined;
  const built = modelObject(asset.model, asset.textures, undefined, undefined, { worldLighting: true, ambient: this.ambient });
  const group = new Group(); group.add(built.root); group.visible = false;
  const clip = clips.animations.find(a => a.name.toLowerCase() === anim);
  // A clip's tracks for frames the model has not (csplay's face on the 32-bone body) are left alone, as
  // RpAnimBlendClumpInit finds no node for them.
  const binding = clip ? bindAnimation(asset.model, built.root, withoutForeignTracks(asset.model, clip)) : undefined;
  const byIndex = new Map<number, Object3D>();
  built.root.traverse(object => { const index = object.userData.nativeFrame; if (Number.isInteger(index)) byIndex.set(index, object); });
  const frames = asset.model.frames;
  return {
   model: name, frames: frames.length, group, dispose: () => { group.removeFromParent(); built.dispose(); },
   sample: binding ? seconds => { binding.sample(seconds, false); } : undefined,
   skinned: asset.model.geometries.some(g => !!g.skin),
   bone: tag => { const i = frames.findIndex(f => f.hanim?.id === tag); return i < 0 ? undefined : byIndex.get(i); },
   frame: frame => { const key = frame.trim().toLowerCase(), i = frames.findIndex(f => f.name.trim().toLowerCase() === key); return i < 0 ? undefined : byIndex.get(i); },
  };
 }
 /** CCutsceneMgr::StartCutscene: the camera takes the spline from the offset; the cast goes in on the next update. */
 start() {
  if (this.state !== 'loaded' || !this.definition || !this.paths) return false;
  this.camera = new FlyByCamera(this.paths, this.definition.offset);
  this.starting = true;
  return true;
 }
 /** SetupCutsceneToStart: the offset raised by one (ms_cutsceneOffset.z += 1), each object put there and its clip
  * started; ms_cutsceneTimerS from nothing. */
 private setup() {
  const o = this.definition!.offset;
  for (const member of this.cast) {
   member.group.position.set(o.x, o.z + 1, -o.y);
   member.sample?.(0);
   member.group.visible = true;
   this.scene.add(member.group);
  }
  // HideRequestedObjects.
  if (this.definition!.removals.length) this.showObjects = this.hideObjects?.(this.definition!.removals);
  this.timerSeconds = 0; this.running = true; this.starting = false; this.textIndex = 0; this.finishing = false;
 }
 /** Update_overlay's effects: each starts at its time and, unless its end is -1, stops at start + end (the .cut's
  * end is a length), once; one riding a bone follows it. */
 private serviceEffects(ms: number) {
  const effects = this.effects;if (!effects) return;
  for (const e of this.effectSystems) {
   if (e.rides) effects.setParent(e.system, nativeMatrix(e.rides));
   if (e.playing) { if (e.end !== -1 && ms >= e.end + e.start) { effects.stop(e.system); e.playing = false; e.stopped = true; } }
   else if (!e.stopped && ms >= e.start) { effects.play(e.system); e.playing = true; }
  }
 }
 /** One frame of Update_overlay: `seconds` is the frame's time step unclipped, `timeStep` in 50ths (the camera's). The
  * callbacks are the host's: a line to show (CMessages::AddMessageJump) and the fade at the end. */
 update(seconds: number, timeStep: number, say: (key: string, durationMs: number) => void, fadeOut: (ms: number) => void) {
  if (this.state !== 'loaded') return;
  if (this.starting) this.setup();
  if (!this.running) return;
  this.timerSeconds += seconds;
  const ms = Math.trunc(this.timerSeconds * 1000), texts = this.definition!.texts;
  for (const member of this.cast) member.sample?.(this.timerSeconds);
  this.serviceEffects(ms);
  if (this.textIndex < texts.length && ms >= texts[this.textIndex].start) { const text = texts[this.textIndex++]; say(text.key, text.duration); }
  const camera = this.camera!;
  camera.process(timeStep);
  if (!camera.finished && ms + FINISH_FADE_MS > camera.finishTime && !this.finishing) { this.finishing = true; fadeOut(FINISH_FADE_MS); }
 }
 /** HasCutsceneFinished: the camera at the spline's end. */
 get finished() { return !!this.camera && this.camera.positionAlongSpline === 1; }
 /** GetCutsceneTimeInMilleseconds. */
 get timeMs() { return Math.trunc(this.timerSeconds) * 1000; }
 /** SkipCutscene: FinishCutscene, the camera's clock at its end. */
 skip() { if (!this.running || !this.camera) return; this.skipped = true; this.timerSeconds = this.camera.finishTime / 1000; this.camera.finish(); }
 private disposeCast() {
  for (const member of this.cast) member.dispose();
  this.cast = [];
  for (const e of this.effectSystems) this.effects?.kill(e.system);
  this.effectSystems = [];
  this.showObjects?.(); this.showObjects = undefined;
 }
 /** DeleteCutsceneData: the cast goes and the camera lets go. */
 clear() {
  if (this.load) this.load.cancelled = true;
  this.load = undefined; this.disposeCast();
  this.state = 'none'; this.name = undefined; this.definition = undefined; this.paths = undefined; this.camera = undefined;
  this.running = false; this.starting = false; this.timerSeconds = 0; this.textIndex = 0; this.finishing = false; this.track = -1;
 }
 /** Each cast member's model and its frame count, for the dev hook. */
 castFrames() { return this.cast.map(member => `${member.model}:${member.frames}`); }
 /** The manifest, for a host that wants to know before it asks. */
 whenReady() { return this.ready; }
 dispose() { this.clear(); }
}
