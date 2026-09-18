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
export interface AnimationPackage { format: 'ANP2' | 'ANP3'; name: string; animations: NativeAnimation[] }
/** PC ANP2/ANP3 only. No axes or skeleton conventions are silently changed here. */
export function readIfp(bytes: Uint8Array): AnimationPackage {
  requireAsset(bytes.length <= 64 * 1024 * 1024, 'IFP exceeds 64 MiB.');
  const input = new BinaryReader(bytes), format = input.name(4);
  requireAsset(format === 'ANP2' || format === 'ANP3', 'Unsupported IFP format; expected ANP2 or ANP3.');
  const size = input.u32();
  const r = new BinaryReader(input.take(size));
  requireAsset(input.take(bytes.length - input.position).every(n => n === 0), 'Unexpected data after IFP package.');
  const name = r.name(24), count = r.u32();
  requireAsset(count <= 2048, 'IFP exceeds 2048 animations.');
  const animations: NativeAnimation[] = [], names = new Set<string>();
  let totalFrames = 0, totalTracks = 0;
  const signed = () => (r.u16() << 16) >> 16;
  for (let a = 0; a < count; a++) {
    const name = r.name(24), key = name.toLowerCase();
    requireAsset(name.length && !names.has(key), 'Empty or duplicate IFP animation name.'); names.add(key);
    const trackCount = r.u32(), frameBytes = format === 'ANP3' ? r.u32() : undefined, flags = format === 'ANP3' ? r.u32() : 0;
    totalTracks += trackCount;
    requireAsset(trackCount <= 512 && totalTracks <= 65536, 'IFP track budget exceeded.');
    const tracks: AnimationTrack[] = [], bindings = new Set<string>(); let consumed = 0, duration = 0;
    for (let t = 0; t < trackCount; t++) {
      const name = r.name(24), frameType = r.u32(), frames = r.u32(), boneId = r.i32();
      requireAsset(frameType >= 1 && frameType <= 4, 'Unsupported IFP keyframe type.');
      requireAsset(boneId >= -1, 'Invalid IFP bone ID.');
      const binding = boneId === -1 ? `name:${name.trim().toLowerCase()}` : `id:${boneId}`;
      requireAsset((boneId !== -1 || name.trim().length) && !bindings.has(binding), 'Empty or duplicate IFP bone binding.'); bindings.add(binding);
      totalFrames += frames;
      requireAsset(totalFrames <= 1_000_000, 'IFP exceeds one million keyframes.');
      const compressed = frameType >= 3, translated = frameType === 2 || frameType === 4;
      if (format === 'ANP3') requireAsset(!!(flags & 1) === compressed, 'IFP compression flag disagrees with track format.');
      const stride = compressed ? translated ? 16 : 10 : translated ? 32 : 20;
      requireAsset(frames * stride <= r.bytes.length - r.position, 'Truncated IFP keyframes.');
      consumed += frames * stride;
      const times = new Float32Array(frames), rotations = new Float32Array(frames * 4), translations = translated ? new Float32Array(frames * 3) : undefined;
      for (let f = 0; f < frames; f++) {
        for (let q = 0; q < 4; q++) rotations[f * 4 + q] = compressed ? signed() / 4096 : r.f32();
        const norm = Math.hypot(...rotations.subarray(f * 4, f * 4 + 4));
        requireAsset(norm > 1e-6 && norm < 2, 'Invalid IFP quaternion.');
        const time = Math.fround(compressed ? signed() / 60 : r.f32());
        requireAsset(time >= 0 && time <= 86400 && (!f || time >= times[f - 1]), 'Invalid or decreasing IFP timestamp.'); times[f] = time;
        if (translations) for (let axis = 0; axis < 3; axis++) {
          const value = compressed ? signed() / 1024 : r.f32();
          requireAsset(Math.abs(value) <= 1e7, 'IFP translation exceeds coordinate limit.'); translations[f * 3 + axis] = value;
        }
      }
      if (frames) duration = Math.max(duration, times[frames - 1]);
      tracks.push({ name, boneId, frameType, times, rotations, translations });
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
