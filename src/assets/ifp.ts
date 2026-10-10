import { BinaryReader, requireAsset } from './binary';
export interface AnimationTrack {
  name: string;
  boneId: number;
  frameType: number;
  /** Absolute source timestamps in seconds, not frame durations. */
  times: Float32Array;
  /** Source-space xyzw quaternions. Normalization belongs to sampling. */
  rotations: Float32Array;
  translations?: Float32Array;
}
export interface NativeAnimation { name: string; flags: number; duration: number; tracks: AnimationTrack[] }
export interface AnimationPackage { format: 'ANP2' | 'ANP3' | 'ANPK'; name: string; animations: NativeAnimation[] }
/** PC ANP2/ANP3, and the older ANPK the cutscenes' clips use. No axes or skeleton conventions are silently changed here. */
export function readIfp(bytes: Uint8Array): AnimationPackage {
  requireAsset(bytes.length <= 64 * 1024 * 1024, 'IFP exceeds 64 MiB.');
  const input = new BinaryReader(bytes), format = input.name(4);
  if (format === 'ANPK') return readAnpk(bytes);
  requireAsset(format === 'ANP2' || format === 'ANP3', 'Unsupported IFP format; expected ANP2 or ANP3.');
  const size = input.u32();
  const r = new BinaryReader(input.take(size));
  requireAsset(input.take(bytes.length - input.position).every(n => n === 0), 'Unexpected data after IFP package.');
  const name = r.name(24), count = r.u32();
  requireAsset(count <= 2048, 'IFP exceeds 2048 animations.');
  const animations: NativeAnimation[] = [], names = new Set<string>();
  let totalFrames = 0, totalTracks = 0;
  for (let a = 0; a < count; a++) {
    const name = r.name(24), key = name.toLowerCase();
    requireAsset(name.length && !names.has(key), 'Empty or duplicate IFP animation name.'); names.add(key);
    const trackCount = r.u32(), frameBytes = format === 'ANP3' ? r.u32() : undefined, flags = format === 'ANP3' ? r.u32() : 0;
    totalTracks += trackCount;
    requireAsset(trackCount <= 512 && totalTracks <= 65536, 'IFP track budget exceeded.');
    const tracks: AnimationTrack[] = [], bindings = new Map<string, number>(); let consumed = 0, duration = 0;
    for (let t = 0; t < trackCount; t++) {
      const name = r.name(24), frameType = r.u32(), frames = r.u32(), boneId = r.i32();
      requireAsset(frameType >= 1 && frameType <= 4, 'Unsupported IFP keyframe type.');
      requireAsset(boneId >= -1, 'Invalid IFP bone ID.');
      const binding = boneId === -1 ? `name:${name.trim().toLowerCase()}` : `id:${boneId}`;
      requireAsset(boneId !== -1 || name.trim().length, 'Empty IFP bone binding.');
      totalFrames += frames;
      requireAsset(totalFrames <= 1_000_000, 'IFP exceeds one million keyframes.');
      const compressed = frameType >= 3, translated = frameType === 2 || frameType === 4;
      if (format === 'ANP3') requireAsset(!!(flags & 1) === compressed, 'IFP compression flag disagrees with track format.');
      const stride = compressed ? translated ? 16 : 10 : translated ? 32 : 20;
      requireAsset(frames * stride <= r.bytes.length - r.position, 'Truncated IFP keyframes.');
      consumed += frames * stride;
      const times = new Float32Array(frames), rotations = new Float32Array(frames * 4), translations = translated ? new Float32Array(frames * 3) : undefined;
      // The keyframe block's extent was checked above, so its values are read straight from the view.
      const view = r.view; let at = r.position;
      const short = () => { const value = view.getInt16(at, true); at += 2; return value; };
      const float = () => { const value = view.getFloat32(at, true); at += 4; requireAsset(Number.isFinite(value), 'Non-finite model coordinate.'); return value; };
      for (let f = 0; f < frames; f++) {
        for (let q = 0; q < 4; q++) rotations[f * 4 + q] = compressed ? short() / 4096 : float();
        const norm = Math.hypot(rotations[f * 4], rotations[f * 4 + 1], rotations[f * 4 + 2], rotations[f * 4 + 3]);
        // Any finite rotation is kept, as the loader keeps it: PROLOG1's csplay has zero ones and a corrupt band of keys,
        // and a compressed one can reach 8 a component once its store wraps. Sampling normalizes.
        requireAsset(Number.isFinite(norm), 'Invalid IFP quaternion.');
        const time = Math.fround(compressed ? short() / 60 : float());
        // A key timed before the one ahead of it is held at that one's time: the loader's deltas make it a negative
        // step the sequence passes in an instant (PROLOG3's cshandcuff steps back 18 ms four times, PROLOG1's csplay a
        // float's noise), and sampling needs the times in order. A first key before nothing is kept (a cutscene cut
        // from a longer take: CAS6B_2's start 40 s before it).
        requireAsset(Math.abs(time) <= 86400, 'Invalid IFP timestamp.'); times[f] = f ? Math.max(time, times[f - 1]) : time;
        if (translations) for (let axis = 0; axis < 3; axis++) {
          const value = compressed ? short() / 1024 : float();
          // Finite is all the loader asks: PROLOG1's clips carry a corrupt band of keys at 22.333 s (1e29 and the like).
          requireAsset(Number.isFinite(value), 'IFP translation is not finite.'); translations[f * 3 + axis] = value;
        }
      }
      r.position = at;
      if (frames) duration = Math.max(duration, times[frames - 1]);
      bind(tracks, bindings, binding, { name, boneId, frameType, times, rotations, translations });
    }
    requireAsset(frameBytes === undefined || frameBytes === consumed, 'IFP animation keyframe byte count mismatch.');
    animations.push({ name, flags, duration, tracks });
  }
  requireAsset(r.position === r.bytes.length, 'Unexpected data inside IFP package.');
  return { format, name, animations };
}

/** Some IFP clips name their tracks without bone IDs. Resolve each name through the bone IDs the
 * rest of `pack` uses, with the finger aliases the SA clips disagree on. Throws when a name maps to
 * no single bone. */
export function resolveTrackBones(clip:NativeAnimation,pack:AnimationPackage):NativeAnimation{
 if(!clip.tracks.some(t=>t.boneId<0))return clip;
 const names=new Map<string,Set<number>>();
 for(const c of pack.animations)for(const t of c.tracks)if(t.boneId>=0){const name=t.name.trim().toLowerCase();if(!names.has(name))names.set(name,new Set());names.get(name)!.add(t.boneId);}
 const aliases:Record<string,string>={'r fingers':'r finger','l fingers':'l finger','root l finger01':'l finger01','root r finger01':'r finger01'};
 return {...clip,tracks:clip.tracks.map(t=>{if(t.boneId>=0)return t;const name=t.name.trim().toLowerCase(),ids=names.get(aliases[name]??name);if(ids?.size!==1)throw new Error(`Unresolved animation bone: ${t.name}.`);return {...t,boneId:[...ids][0]};})};
}

/** ANPK (CAnimManager::LoadAnimFile_ANPK, gta-reversed AnimManager.cpp from 0x4D4863): chunks of a four-letter id and a
 * length rounded up to four. INFO (count, block name), then per clip NAME, DGAN, INFO (sequence count) and per sequence
 * CPAN, ANIM (a 28-byte name, the frame count, next and previous, and a bone tag when the chunk is 44 bytes) and the
 * keys: KR00 (rotation), KRT0 (and translation) or KRTS (and a scale, skipped), each followed by its time. The loader
 * conjugates every rotation, so the tracks here hold the engine's rotations, as ANP3's do. A sequence with no frames
 * binds nothing and is left out. */
function readAnpk(bytes: Uint8Array): AnimationPackage {
  // A non-finite value reads as 0, as the compressing load stores it (fcvtzs of a NaN): PROLOG1 has one garbage key in
  // a toe of csplay's and of csstew's clips.
  const r = new BinaryReader(bytes), round = (n: number) => n + (4 - n % 4) % 4;
  const chunk = (id?: string) => { const name = r.name(4), size = r.u32(); requireAsset(!id || name === id, `Expected IFP chunk ${id}.`); return { name, size }; };
  r.sanitizeNonFinite = true;
  const outer = chunk('ANPK');requireAsset(8 + outer.size <= bytes.length, 'Truncated IFP package.');
  const info = chunk('INFO'), infoStart = r.position, count = r.u32(), name = r.name(Math.max(0, info.size - 4));r.position = infoStart + round(info.size);
  requireAsset(count <= 2048, 'IFP exceeds 2048 animations.');
  const animations: NativeAnimation[] = [], names = new Set<string>();let totalFrames = 0;
  for (let a = 0; a < count; a++) {
    const named = chunk('NAME'), nameStart = r.position, clipName = r.name(named.size);r.position = nameStart + round(named.size);
    const key = clipName.toLowerCase();requireAsset(clipName.length && !names.has(key), 'Empty or duplicate IFP animation name.');names.add(key);
    chunk('DGAN');
    const seqInfo = chunk('INFO'), seqStart = r.position, sequences = r.u32();r.position = seqStart + round(seqInfo.size);
    requireAsset(sequences <= 512, 'IFP track budget exceeded.');
    const tracks: AnimationTrack[] = [], bindings = new Map<string, number>();let duration = 0;
    for (let t = 0; t < sequences; t++) {
      chunk('CPAN');
      const anim = chunk('ANIM'), animStart = r.position, trackName = r.name(28), frames = r.u32();r.u32();r.u32();
      const boneId = anim.size >= 44 ? r.i32() : -1;r.position = animStart + round(anim.size);
      if (!frames) continue;
      const keys = chunk(), translated = keys.name[2] === 'T', scaled = keys.name[3] === 'S';
      requireAsset(['KR00', 'KRT0', 'KRTS'].includes(keys.name), 'Unsupported IFP keyframe chunk.');
      const stride = 20 + (translated ? 12 : 0) + (scaled ? 12 : 0);
      requireAsset(frames * stride <= keys.size, 'Truncated IFP keyframes.');
      totalFrames += frames;requireAsset(totalFrames <= 4_000_000, 'IFP exceeds four million keyframes.');
      const keysStart = r.position, times = new Float32Array(frames), rotations = new Float32Array(frames * 4), translations = translated ? new Float32Array(frames * 3) : undefined;
      for (let f = 0; f < frames; f++) {
        const x = r.f32(), y = r.f32(), z = r.f32(), w = r.f32();
        rotations.set([-x, -y, -z, w], f * 4);
        if (translations) { translations[f * 3] = r.f32(); translations[f * 3 + 1] = r.f32(); translations[f * 3 + 2] = r.f32(); }
        if (scaled) r.position += 12;
        const time = Math.fround(r.f32());requireAsset(Math.abs(time) <= 86400, 'Invalid IFP timestamp.');times[f] = f ? Math.max(time, times[f - 1]) : time;
      }
      r.position = keysStart + round(keys.size);
      duration = Math.max(duration, times[frames - 1]);
      const binding = boneId === -1 ? `name:${trackName.trim().toLowerCase()}` : `id:${boneId}`;
      bind(tracks, bindings, binding, { name: trackName, boneId, frameType: translated ? 2 : 1, times, rotations, translations });
    }
    animations.push({ name: clipName, flags: 0, duration, tracks });
  }
  return { format: 'ANPK', name, animations };
}

/** A track for a frame an earlier track of the clip already drives takes its place: CAnimBlendAssociation::Init keeps
 * one node a frame and the later sequence overwrites it (CRASV2A's spade names its wrist effects twice, cut short at 24
 * characters; RIOT_4D's SMG its control). The clip's length still counts both, as CalcTotalTime does. */
function bind(tracks: AnimationTrack[], bindings: Map<string, number>, binding: string, track: AnimationTrack) {
  const earlier = bindings.get(binding);
  if (earlier === undefined) { bindings.set(binding, tracks.length); tracks.push(track); } else tracks[earlier] = track;
}
