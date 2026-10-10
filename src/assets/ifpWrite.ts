import { requireAsset } from './binary';
import type { AnimationPackage, AnimationTrack, NativeAnimation } from './ifp';
/* Writes an animation package as ANP3, the layout readIfp reads, compressing each clip the way the loader does. A
 * cutscene's ANPK clips are compressed as they load (CCutsceneMgr::LoadCutsceneData_postload calls
 * CAnimManager::LoadAnimFile with loadCompressed set; iOS 0x1002e7b38 does the same), except the ones its "uncompress"
 * section names, so the published clip is what the game holds in memory. */

/** KeyFrameCompressed (gta-reversed AnimSequenceFrames.h): the rotation as FixedQuat<int16, 4096> and the translation
 * as FixedVector<int16, 1024>, both truncated toward zero; the time as FixedFloat<int16, 60, true>, rounded. */
const ROTATION = 4096, TRANSLATION = 1024, TIME = 60;
/** The float's integer part kept to its low 16 bits, as iOS stores it (arm64 fcvtzs to 32 bits, saturating, then a
 * 16-bit store): a value out of range wraps, as a few of PROLOG1's csstew keys do. */
const int16 = (value: number) => { const v = Math.max(-(2 ** 31), Math.min(2 ** 31 - 1, Math.trunc(value))); return (v << 16) >> 16; };
const truncated = (value: number, scale: number) => int16(Math.fround(Math.fround(value) * scale));
const rounded = (value: number, scale: number) => int16(Math.fround(Math.fround(value) * scale + 0.5));

/** CAnimManager::LoadAnimFile_ANPK's compression choice: compressed unless the name is in the uncompressed list
 * (compared upper-case, as CKeyGen::GetUppercaseKey hashes both). */
export function compressedOnLoad(animation: NativeAnimation, uncompressed: readonly string[]) {
 const name = animation.name.toUpperCase();
 return !uncompressed.some(u => u.toUpperCase() === name);
}

/** ANP3: "ANP3", the size, the block name (24 bytes) and clip count; per clip its name (24), track count, keyframe
 * bytes and flags (1: compressed); per track its name (24), frame type (1 KR00, 2 KRT0, 3 and 4 compressed), frame
 * count and bone tag, then the keys: the rotation, the time, and the translation if any. */
export function writeAnp3(pkg: AnimationPackage, compressed: (animation: NativeAnimation) => boolean): Uint8Array {
 const encoder = new TextEncoder(), parts: Uint8Array[] = [];
 const name = (text: string, length: number) => { const bytes = new Uint8Array(length), encoded = encoder.encode(text); requireAsset(encoded.length < length, `IFP name too long: ${text}.`); bytes.set(encoded); return bytes; };
 const u32 = (...values: number[]) => { const bytes = new Uint8Array(values.length * 4), view = new DataView(bytes.buffer); values.forEach((v, i) => view.setInt32(i * 4, v, true)); return bytes; };
 parts.push(name(pkg.name, 24), u32(pkg.animations.length));
 for (const animation of pkg.animations) {
  const packed = compressed(animation), frames = animation.tracks.map(track => keys(track, packed));
  parts.push(name(animation.name, 24), u32(animation.tracks.length, frames.reduce((sum, f) => sum + f.length, 0), packed ? 1 : 0));
  animation.tracks.forEach((track, i) => {
   const translated = !!track.translations;
   parts.push(name(track.name, 24), u32(packed ? translated ? 4 : 3 : translated ? 2 : 1, track.times.length, track.boneId), frames[i]);
  });
 }
 const size = parts.reduce((sum, p) => sum + p.length, 0), out = new Uint8Array(8 + size);
 out.set(encoder.encode('ANP3')); new DataView(out.buffer).setUint32(4, size, true);
 let at = 8; for (const p of parts) { out.set(p, at); at += p.length; }
 return out;
}
function keys(track: AnimationTrack, packed: boolean) {
 const translated = !!track.translations, count = track.times.length, stride = packed ? translated ? 16 : 10 : translated ? 32 : 20;
 const bytes = new Uint8Array(count * stride), view = new DataView(bytes.buffer);
 for (let f = 0, at = 0; f < count; f++) {
  for (let q = 0; q < 4; q++) {
   const value = track.rotations[f * 4 + q];
   if (packed) { view.setInt16(at, truncated(value, ROTATION), true); at += 2; } else { view.setFloat32(at, value, true); at += 4; }
  }
  if (packed) { view.setInt16(at, rounded(track.times[f], TIME), true); at += 2; } else { view.setFloat32(at, track.times[f], true); at += 4; }
  if (translated) for (let axis = 0; axis < 3; axis++) {
   const value = track.translations![f * 3 + axis];
   if (packed) { view.setInt16(at, truncated(value, TRANSLATION), true); at += 2; } else { view.setFloat32(at, value, true); at += 4; }
  }
 }
 return bytes;
}
