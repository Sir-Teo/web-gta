import { readSkin, readHAnim, type SkinData, type HAnimData } from './skin';
import { BinaryReader, readChunk, requireAsset, type Chunk } from './binary';
export interface ModelMaterial { color: number[]; texture: string; mask: string; filter: number; addressU: number; addressV: number; surface: number[] }
export interface ModelFrame { name: string; parent: number; matrix: number[]; hanim?: HAnimData }
export interface ModelGeometry { positions: Float32Array; normals?: Float32Array; uvs: Float32Array[]; colors?: Uint8Array; nightColors?: Uint8Array; indices: Uint32Array; materialIds: Uint16Array; materials: ModelMaterial[]; flags: number; skin?: SkinData }
export interface DffModel { frames: ModelFrame[]; geometries: ModelGeometry[]; atomics: { frame: number; geometry: number; flags: number }[]; warnings: string[] }
function chunks(bytes: Uint8Array) {
  const r = new BinaryReader(bytes), result: Chunk[] = [];
  while (r.position < bytes.length) { requireAsset(result.length < 16384, 'Too many model chunks.'); result.push(readChunk(r)); }
  return result;
}
function one(parts: Chunk[], type: number) {
  const matches = parts.filter(c => c.type === type); requireAsset(matches.length === 1, `Missing or repeated model section ${type}.`); return matches[0];
}
function structure(parts: Chunk[]) { return new BinaryReader(one(parts, 1).bytes); }
function rwVersion(id: number) { return id & 0xffff0000 ? (((id >>> 14) & 0x3ff00) + 0x30000) | ((id >>> 16) & 63) : id << 8; }
function readFrames(bytes: Uint8Array) {
  const parts = chunks(bytes), r = structure(parts), count = r.u32(); requireAsset(count > 0 && count <= 4096, 'Invalid model frame count.');
  const frames: ModelFrame[] = [];
  for (let i = 0; i < count; i++) {
    const values = r.floats(12), parent = r.i32(); r.u32();
    requireAsset(parent >= -1 && parent < count && parent !== i, 'Invalid frame parent.');
    frames.push({ name: `frame_${i}`, parent, matrix: [values[0], values[1], values[2], 0, values[3], values[4], values[5], 0, values[6], values[7], values[8], 0, values[9], values[10], values[11], 1] });
  }
  const extensions = parts.filter(c => c.type === 3); requireAsset(extensions.length === count, 'Frame extension count mismatch.');
  extensions.forEach((extension, i) => {
    for (const c of chunks(extension.bytes)) {
      if (c.type === 0x253f2fe) frames[i].name = new BinaryReader(c.bytes).name(c.bytes.length);
      if (c.type === 0x11e) { requireAsset(!frames[i].hanim, 'Repeated HAnim plugin.'); frames[i].hanim = readHAnim(c.bytes); }
    }
  });
  frames.forEach((_, i) => {
    const seen = new Set<number>(); let at = i;
    while (at >= 0) { requireAsset(!seen.has(at) && seen.size < 256, 'Cyclic or excessively deep frame hierarchy.'); seen.add(at); at = frames[at].parent; }
  });
  return frames;
}
function readMaterial(bytes: Uint8Array, warnings: Set<string>): ModelMaterial {
  const parts = chunks(bytes), r = structure(parts); r.u32(); const color = [...r.take(4)]; r.u32(); const textured = r.u32();
  const surface = r.bytes.length - r.position >= 12 ? [...r.floats(3)] : [1, 1, 1];
  let texture = '', mask = '', filter = 0, addressU = 0, addressV = 0;
  if (textured) {
    const tex = chunks(one(parts, 6).bytes), sampling = structure(tex).u32(), names = tex.filter(c => c.type === 2);
    requireAsset(names.length === 2, 'Invalid material texture names.');
    texture = new BinaryReader(names[0].bytes).name(names[0].bytes.length); mask = new BinaryReader(names[1].bytes).name(names[1].bytes.length);
    filter = sampling & 255; addressU = (sampling >>> 8) & 15; addressV = (sampling >>> 12) & 15;
  }
  for (const ext of parts.filter(c => c.type === 3)) for (const plugin of chunks(ext.bytes)) warnings.add(`Material plugin 0x${plugin.type.toString(16)} is not rendered.`);
  return { color, texture, mask, filter, addressU, addressV, surface };
}
function readMaterials(bytes: Uint8Array, warnings: Set<string>) {
  const parts = chunks(bytes), r = structure(parts), count = r.u32(); requireAsset(count > 0 && count <= 4096, 'Invalid material count.');
  const refs: number[] = []; for (let i = 0; i < count; i++) refs.push(r.i32());
  const payloads = parts.filter(c => c.type === 7); let cursor = 0; const materials: ModelMaterial[] = [];
  refs.forEach((ref, i) => {
    requireAsset(ref === -1 || ref >= 0 && ref < i, 'Invalid shared material reference.');
    if (ref >= 0) materials.push(materials[ref]);
    else { requireAsset(cursor < payloads.length, 'Missing model material.'); materials.push(readMaterial(payloads[cursor++].bytes, warnings)); }
  });
  requireAsset(cursor === payloads.length, 'Unexpected model material.'); return materials;
}
function readGeometry(bytes: Uint8Array, warnings: Set<string>): ModelGeometry {
  const parts = chunks(bytes), header = one(parts, 1), r = new BinaryReader(header.bytes);
  const flags = r.u32(), triangles = r.u32(), vertices = r.u32(), morphs = r.u32();
  requireAsset(!(flags & 0x01000000), 'Platform-native DFF geometry is not supported yet.');
  requireAsset(vertices > 0 && vertices <= 65536 && triangles <= 1000000 && morphs > 0 && morphs <= 8, 'Invalid model geometry counts.');
  if (rwVersion(header.version) < 0x34000) r.floats(3);
  const colors = flags & 8 ? r.take(vertices * 4).slice() : undefined;
  const uvCount = (flags >>> 16) & 255 || (flags & 4 ? 1 : flags & 128 ? 2 : 0); requireAsset(uvCount <= 8, 'Too many UV layers.');
  const uvs: Float32Array[] = []; for (let i = 0; i < uvCount; i++) uvs.push(r.floats(vertices * 2));
  requireAsset(triangles * 8 <= r.bytes.length - r.position, 'Truncated model faces.');
  let indices = new Uint32Array(triangles * 3), materialIds = new Uint16Array(triangles);
  for (let i = 0; i < triangles; i++) { const b = r.u16(), a = r.u16(), material = r.u16(), c = r.u16(); indices.set([a, b, c], i * 3); materialIds[i] = material; }
  let positions: Float32Array | undefined, normals: Float32Array | undefined;
  for (let i = 0; i < morphs; i++) {
    r.floats(4); const hasVertices = r.u32(), hasNormals = r.u32();
    requireAsset(hasVertices <= 1 && hasNormals <= 1, 'Invalid morph target flags.');
    const p = hasVertices ? r.floats(vertices * 3) : undefined, n = hasNormals ? r.floats(vertices * 3) : undefined;
    if (i === 0) { positions = p; normals = n; }
  }
  requireAsset(positions, 'The first morph target has no positions.');
  requireAsset(r.position === r.bytes.length, 'Unexpected model geometry payload.');
  if (morphs > 1) warnings.add('Only the first morph target is previewed.');
  const materials = readMaterials(one(parts, 8).bytes, warnings); let nightColors: Uint8Array | undefined, skin: SkinData | undefined;
  for (const ext of parts.filter(c => c.type === 3)) for (const plugin of chunks(ext.bytes)) {
    if (plugin.type === 0x116) { requireAsset(!skin, 'Repeated skin plugin.'); skin = readSkin(plugin.bytes, vertices); }
    else if (plugin.type === 0x253f2f9) {
      const p = new BinaryReader(plugin.bytes); if (p.u32()) nightColors = p.take(vertices * 4).slice();
    } else if (plugin.type === 0x50e) {
      if (triangles > 0) continue;
      const p = new BinaryReader(plugin.bytes), strip = p.u32(), meshCount = p.u32(), total = p.u32();
      requireAsset(strip <= 1 && meshCount <= 4096 && total <= 3000000, 'Invalid mesh index list.');
      const faces: number[] = [], ids: number[] = []; let read = 0;
      for (let mesh = 0; mesh < meshCount; mesh++) {
        const count = p.u32(), material = p.u32(); requireAsset(count <= total - read && material < materials.length && count * 4 <= p.bytes.length - p.position, 'Invalid mesh group.');
        const verticesInMesh: number[] = []; for (let i = 0; i < count; i++) verticesInMesh.push(p.u32()); read += count;
        requireAsset(strip || count % 3 === 0, 'Invalid triangle-list length.');
        for (let i = 2; i < count; i += strip ? 1 : 3) {
          const a = verticesInMesh[i - 2], b = verticesInMesh[i - 1], c = verticesInMesh[i];
          if (strip && (a === b || b === c || a === c)) continue;
          faces.push(...(strip && i % 2 ? [b, a, c] : [a, b, c])); ids.push(material);
        }
      }
      requireAsset(read === total, 'Mesh index count mismatch.'); indices = new Uint32Array(faces); materialIds = new Uint16Array(ids);
    } else warnings.add(`Geometry plugin 0x${plugin.type.toString(16)} is not rendered.`);
  }
  requireAsset(indices.every(i => i < vertices) && materialIds.every(i => i < materials.length), 'Model face references an invalid vertex or material.');
  return { positions, normals, colors, nightColors, uvs, indices, materialIds, materials, flags, skin };
}
export function readDff(bytes: Uint8Array): DffModel {
  requireAsset(bytes.length <= 64 * 1024 * 1024, 'This model exceeds the 64 MiB import limit.');
  const root = readChunk(new BinaryReader(bytes)); requireAsset(root.type === 0x10, 'This is not a RenderWare model clump.');
  const parts = chunks(root.bytes), count = structure(parts).u32(); requireAsset(count <= 4096, 'Too many model atomics.');
  const frames = readFrames(one(parts, 0xe).bytes), list = chunks(one(parts, 0x1a).bytes), geometryCount = structure(list).u32();
  requireAsset(geometryCount > 0 && geometryCount <= 4096, 'Invalid geometry-list count.');
  const warnings = new Set<string>(), geometryChunks = list.filter(c => c.type === 0xf);
  requireAsset(geometryChunks.length === geometryCount, 'Geometry count mismatch.');
  const geometries = geometryChunks.map(c => readGeometry(c.bytes, warnings));
  requireAsset(geometries.reduce((n, g) => n + g.positions.length / 3, 0) <= 1000000, 'Model exceeds the one-million-vertex limit.');
  const atomics = parts.filter(c => c.type === 0x14).map(c => {
    const r = structure(chunks(c.bytes)), frame = r.u32(), geometry = r.u32(), flags = r.u32();
    requireAsset(frame < frames.length && geometry < geometries.length, 'Invalid atomic frame or geometry.'); return { frame, geometry, flags };
  });
  requireAsset(atomics.length === count, 'Atomic count mismatch.');
  const rendered = atomics.filter(a => a.flags & 4);
  const groups = geometries.map(g => new Set(g.materialIds).size);
  requireAsset(rendered.reduce((n, a) => n + geometries[a.geometry].indices.length / 3, 0) <= 2000000, 'Model exceeds the two-million rendered-triangle limit.');
  requireAsset(rendered.reduce((n, a) => n + groups[a.geometry], 0) <= 16384, 'Model exceeds the material draw-group limit.');
  if (parts.some(c => c.type === 0x12 || c.type === 5)) warnings.add('Embedded lights and cameras are not previewed.');
  return { frames, geometries, atomics, warnings: [...warnings] };
}
