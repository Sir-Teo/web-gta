import { Group, type Scene } from 'three';
import { readCutsceneFile, readCutsceneCameraPaths, type CutsceneDefinition, type CutsceneCameraPaths } from '../assets/cutscene';
import { readIfp, type AnimationPackage } from '../assets/ifp';
import type { DffModel } from '../assets/dff';
import type { ModelTexture } from '../assets/modelTextures';
import { modelObject } from '../assets/ModelObjects';
import { nativeAmbientState } from '../assets/nativeMaterial';
import { ModelReadCache, readModel } from '../assets/readModel';
import { openStaticWorld } from '../assets/staticWorldArchive';
import { bindAnimation, withoutForeignTracks } from '../animation/bind';
import { FlyByCamera } from '../engine/nativeFlyByCamera';
/* CCutsceneMgr (gta-reversed CutsceneMgr.cpp, reversed): a cutscene's data, cast and camera for the browser. The
 * published cutscenes (public/play/cuts/manifest.json) play; any other one is left to end as it starts, as the
 * browser has no data for it. The load reads the .cut, the .dat and the clips, and makes the cast: CJ in his clothes
 * for csplay (CClothes::RebuildCutscenePlayer) and the model of the name from MODELS\CUTSCENE.IMG for every other one.
 * The start sets the camera on its spline (StartCutscene) and, the next frame, puts the cast at the offset with their
 * clips running (SetupCutsceneToStart); each frame the timer moves the clips and the text on (Update_overlay). */
export interface CutsceneCastSource { model: DffModel; textures: ModelTexture[] }
interface Published { cut: { file: string }; dat: { file: string }; ifp: { file: string }; track?: number }
interface CastMember { group: Group; dispose(): void; sample?(seconds: number): void }
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
  // The clips are gzipped on disk; a server that decodes them on the way leaves them as they are.
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  return bytes;
 }
 private async read(name: string, entry: Published) {
  const latin = new TextDecoder('latin1');
  const [cut, dat, ifp] = await Promise.all([this.fetchBytes(entry.cut.file), this.fetchBytes(entry.dat.file), this.fetchBytes(entry.ifp.file)]);
  const definition = readCutsceneFile(latin.decode(cut)), paths = readCutsceneCameraPaths(latin.decode(dat)), clips = readIfp(ifp);
  if (this.load?.name !== name || this.load.cancelled) return;
  this.definition = definition; this.paths = paths;
  this.onDefinition?.(definition);
  // LoadCutsceneData_loading: an object per model line with its clip on it. A line's further clips (a repeated slot,
  // which SetCutsceneAnim layers on the object made last) are not played; none of the published cutscenes has one.
  for (const member of definition.cast) {
   if (member.repeat) continue;
   const built = await this.member(member.model, member.anim, clips).catch(error => { this.error = `${member.model}: ${error}`; return undefined; });
   if (this.load?.name !== name || this.load.cancelled) { built?.dispose(); return; }
   if (built) this.cast.push(built);
  }
 }
 private async model(name: string): Promise<CutsceneCastSource | undefined> {
  if (name === 'csplay') return this.playerBody();
  const source = await (this.source ??= openStaticWorld(this.base));this.cache ??= new ModelReadCache(source.file, source.entries);
  const entry = source.entry(`${name}.dff`), textureEntry = source.entry(`${name}.txd`);
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
  return { group, dispose: () => { group.removeFromParent(); built.dispose(); }, sample: binding ? seconds => { binding.sample(seconds, false); } : undefined };
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
  this.timerSeconds = 0; this.running = true; this.starting = false; this.textIndex = 0; this.finishing = false;
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
 private disposeCast() { for (const member of this.cast) member.dispose(); this.cast = []; }
 /** DeleteCutsceneData: the cast goes and the camera lets go. */
 clear() {
  if (this.load) this.load.cancelled = true;
  this.load = undefined; this.disposeCast();
  this.state = 'none'; this.name = undefined; this.definition = undefined; this.paths = undefined; this.camera = undefined;
  this.running = false; this.starting = false; this.timerSeconds = 0; this.textIndex = 0; this.finishing = false; this.track = -1;
 }
 /** The manifest, for a host that wants to know before it asks. */
 whenReady() { return this.ready; }
 dispose() { this.clear(); }
}
