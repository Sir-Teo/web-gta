import { requireAsset } from './binary';
/* A published cutscene in one file: its .cut and .dat as they are, and its clips (ANP3, as the loader holds them) laid
 * out for gzip. The keyframe values are what the game stores, bit for bit; only their order changes: each track's
 * values channel by channel (time, then each rotation component, then each translation component), a compressed
 * track's int16s as zigzagged differences from the key before, split into a stream of low bytes and one of high bytes,
 * and an uncompressed track's float32s XORed with the key before, split into four byte streams. The clips of the
 * opening five went from 3.1 MB gzipped to 1.5 MB. The file itself is gzipped on disk.
 *
 *   "CSB1", u32 .cut length, .cut, u32 .dat length, .dat, u32 ANP3 length,
 *   u32 skeleton length, the ANP3 with its keyframes taken out, u32 low/high/float stream lengths, the streams. */
const MAGIC = 'CSB1';
const latin = (bytes: Uint8Array) => { let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return s; };
const zig = (v: number) => ((v << 1) ^ (v >> 15)) & 0xffff;
const unzig = (z: number) => (z >>> 1) ^ -(z & 1);
const wrap16 = (v: number) => ((v + 32768) & 0xffff) - 32768;

/** Walks an ANP3's structure: each clip's 36-byte head, each track's 36-byte head and the size of its keyframes. */
function walk(anp3: Uint8Array, visit: (track: { at: number; frames: number; channels: number; compressed: boolean } | { head: number; length: number }) => void) {
 const view = new DataView(anp3.buffer, anp3.byteOffset, anp3.byteLength);
 requireAsset(latin(anp3.subarray(0, 4)) === 'ANP3', 'A cutscene bundle carries ANP3 clips.');
 let at = 8 + 24; const clips = view.getUint32(at, true); at += 4;
 visit({ head: 0, length: at });
 for (let c = 0; c < clips; c++) {
  const tracks = view.getUint32(at + 24, true); visit({ head: at, length: 36 }); at += 36;
  for (let t = 0; t < tracks; t++) {
   const type = view.getUint32(at + 24, true), frames = view.getUint32(at + 28, true); visit({ head: at, length: 36 }); at += 36;
   requireAsset(type >= 1 && type <= 4, 'Unsupported keyframe type in a cutscene bundle.');
   const compressed = type >= 3, channels = type === 2 || type === 4 ? 8 : 5;
   visit({ at, frames, channels, compressed }); at += frames * channels * (compressed ? 2 : 4);
  }
 }
 requireAsset(at === anp3.length, 'A cutscene bundle\'s clips end where their package says.');
}

export function encodeCutsceneBundle(cut: Uint8Array, dat: Uint8Array, anp3: Uint8Array): Uint8Array {
 const view = new DataView(anp3.buffer, anp3.byteOffset, anp3.byteLength);
 const skeleton: Uint8Array[] = [], low: number[] = [], high: number[] = [], floats: number[][] = [[], [], [], []];
 walk(anp3, part => {
  if ('head' in part) { skeleton.push(anp3.subarray(part.head, part.head + part.length)); return; }
  const { at, frames, channels, compressed } = part;
  for (let c = 0; c < channels; c++) {
   let previous = 0;
   for (let f = 0; f < frames; f++) {
    if (compressed) {
     const v = view.getInt16(at + (f * channels + c) * 2, true), z = zig(wrap16(v - previous)); previous = v;
     low.push(z & 0xff); high.push(z >> 8);
    } else {
     const v = view.getUint32(at + (f * channels + c) * 4, true), x = (v ^ previous) >>> 0; previous = v;
     for (let b = 0; b < 4; b++) floats[b].push((x >>> (8 * b)) & 0xff);
    }
   }
  }
 });
 const parts: Uint8Array[] = [], u32 = (n: number) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n, true); return b; };
 const skeletonBytes = concat(skeleton);
 parts.push(new TextEncoder().encode(MAGIC), u32(cut.length), cut, u32(dat.length), dat, u32(anp3.length), u32(skeletonBytes.length), skeletonBytes,
  u32(low.length), u32(floats[0].length), Uint8Array.from(low), Uint8Array.from(high), ...floats.map(f => Uint8Array.from(f)));
 return concat(parts);
}

export function decodeCutsceneBundle(bundle: Uint8Array): { cut: Uint8Array; dat: Uint8Array; anp3: Uint8Array } {
 const view = new DataView(bundle.buffer, bundle.byteOffset, bundle.byteLength);
 requireAsset(bundle.length > 16 && latin(bundle.subarray(0, 4)) === MAGIC, 'Not a cutscene bundle.');
 let at = 4;
 const take = (length: number) => { requireAsset(at + length <= bundle.length, 'Truncated cutscene bundle.'); const out = bundle.subarray(at, at + length); at += length; return out; };
 const u32 = () => view.getUint32(take(4).byteOffset - bundle.byteOffset, true);
 const cut = take(u32()), dat = take(u32()), size = u32(), skeleton = take(u32());
 const shorts = u32(), longs = u32(), low = take(shorts), high = take(shorts), floats = [take(longs), take(longs), take(longs), take(longs)];
 requireAsset(at === bundle.length, 'Unexpected data after a cutscene bundle.');
 // The clips again: the skeleton's heads in order, each track's keyframes rebuilt channel by channel.
 const anp3 = new Uint8Array(size), out = new DataView(anp3.buffer);
 let s = 0, w = 0, si = 0, fi = 0;
 const copy = (length: number) => { requireAsset(s + length <= skeleton.length, 'Truncated cutscene bundle skeleton.'); anp3.set(skeleton.subarray(s, s + length), w); s += length; w += length; };
 // The first part is the package head; walk needs the heads in place to read the track counts, so they go in as met.
 copy(8 + 24 + 4);
 const clips = out.getUint32(32, true);
 for (let c = 0; c < clips; c++) {
  copy(36); const tracks = out.getUint32(w - 36 + 24, true);
  for (let t = 0; t < tracks; t++) {
   copy(36); const type = out.getUint32(w - 36 + 24, true), frames = out.getUint32(w - 36 + 28, true);
   requireAsset(type >= 1 && type <= 4, 'Unsupported keyframe type in a cutscene bundle.');
   const compressed = type >= 3, channels = type === 2 || type === 4 ? 8 : 5, width = compressed ? 2 : 4;
   requireAsset(w + frames * channels * width <= size, 'A cutscene bundle\'s keyframes overrun their package.');
   for (let ch = 0; ch < channels; ch++) {
    let previous = 0;
    for (let f = 0; f < frames; f++) {
     const offset = w + (f * channels + ch) * width;
     if (compressed) {
      requireAsset(si < shorts, 'Truncated cutscene bundle stream.');
      const v = wrap16(previous + unzig(low[si] | high[si] << 8)); si++; out.setInt16(offset, v, true); previous = v;
     } else {
      requireAsset(fi < longs, 'Truncated cutscene bundle stream.');
      const v = (floats[0][fi] | floats[1][fi] << 8 | floats[2][fi] << 16 | floats[3][fi] << 24) ^ previous; fi++; out.setUint32(offset, v >>> 0, true); previous = v;
     }
    }
   }
   w += frames * channels * width;
  }
 }
 requireAsset(w === size && s === skeleton.length && si === shorts && fi === longs, 'A cutscene bundle does not add up.');
 return { cut, dat, anp3 };
}

function concat(parts: Uint8Array[]) {
 const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let at = 0;
 for (const p of parts) { out.set(p, at); at += p.length; }
 return out;
}
