import {readCol,type ColModel} from './col';
import { readSkin, readHAnim, type SkinData, type HAnimData } from './skin';
import { isBuildingPipeline } from './buildingPipelines';
import { BinaryReader, readChunk, requireAsset, type Chunk } from './binary';
import { BREAKABLE_PLUGIN, readBreakable, type BreakableInfo } from './breakable';
import { TWO_D_EFFECT_PLUGIN, readTwoDEffects, type Model2dEffect } from './twoDEffect';
export interface ModelMaterial { color: number[]; texture: string; mask: string; filter: number; addressU: number; addressV: number; surface: number[] }
export interface ModelFrame { name: string; parent: number; matrix: number[]; hanim?: HAnimData }
export interface ModelMesh { start: number; count: number; material: number; min: number; max: number }
export interface ModelMorphBounds { center:[number,number,number]; radius:number }
export interface ModelGeometry { morphBounds?:ModelMorphBounds[]; positions: Float32Array; normals?: Float32Array; uvs: Float32Array[]; colors?: Uint8Array; nightColors?: Uint8Array; indices: Uint32Array; materialIds: Uint16Array; materials: ModelMaterial[]; flags: number; skin?: SkinData; meshes?: ModelMesh[]; /** Rockstar breakable plugin, thrown by BreakObject_c when the object breaks. */ breakable?: BreakableInfo;
  /** The 2d effects (lights, particles, attractors) the model info takes from its geometry. */ effects?: Model2dEffect[] }
export interface DffModel { embeddedCollisions?:ColModel[]; attachments?: { kind: 'light' | 'camera'; frame: number; bytes: Uint8Array }[]; frames: ModelFrame[]; geometries: ModelGeometry[]; atomics: { frame: number; geometry: number; flags: number; pipeline?: number }[]; warnings: string[] }
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
function readFrames(bytes: Uint8Array, warnings: Set<string>, sanitize = false) {
  const parts = chunks(bytes), r = structure(parts), count = r.u32(); requireAsset(count > 0 && count <= 4096, 'Invalid model frame count.');
  r.sanitizeNonFinite = sanitize;
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
  if (r.repairs > 0) warnings.add(`Repaired ${r.repairs} non-finite frame coordinates (zeroed).`);
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
function readGeometry(bytes: Uint8Array, warnings: Set<string>, sanitize = false): ModelGeometry {
  const parts = chunks(bytes), header = one(parts, 1), r = new BinaryReader(header.bytes);
  r.sanitizeNonFinite = sanitize;
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
  const morphBounds:ModelMorphBounds[]=[];
  for (let i = 0; i < morphs; i++) {
    const sphere=r.floats(4);
    morphBounds.push({center:[sphere[0],sphere[1],sphere[2]],radius:sphere[3]});
    if(sphere[3]<0)warnings.add('A stored morph bounding sphere has a negative radius; it is retained for inspection but is not usable for framing.');
    const hasVertices = r.u32(), hasNormals = r.u32();
    requireAsset(hasVertices <= 1 && hasNormals <= 1, 'Invalid morph target flags.');
    const p = hasVertices ? r.floats(vertices * 3) : undefined, n = hasNormals ? r.floats(vertices * 3) : undefined;
    if (i === 0) { positions = p; normals = n; }
  }
  requireAsset(positions, 'The first morph target has no positions.');
  requireAsset(r.position === r.bytes.length, 'Unexpected model geometry payload.');
  if (morphs > 1) warnings.add('Only the first morph target is previewed.');
  const materials = readMaterials(one(parts, 8).bytes, warnings); let nightColors: Uint8Array | undefined, skin: SkinData | undefined, meshes: ModelMesh[] | undefined, breakable: BreakableInfo | undefined, effects: Model2dEffect[] | undefined;
  requireAsset(indices.every(i => i < vertices) && materialIds.every(i => i < materials.length), 'Model face references an invalid vertex or material.');
  for (const ext of parts.filter(c => c.type === 3)) for (const plugin of chunks(ext.bytes)) {
    if (plugin.type === 0x116) { requireAsset(!skin, 'Repeated skin plugin.'); skin = readSkin(plugin.bytes, vertices); }
    else if (plugin.type === 0x253f2f9) {
      const p = new BinaryReader(plugin.bytes); if (p.u32()) nightColors = p.take(vertices * 4).slice();
    } else if (plugin.type === 0x50e) {
      requireAsset(!meshes, 'Repeated Bin Mesh plugin.'); meshes = [];
      const p = new BinaryReader(plugin.bytes), strip = p.u32(), meshCount = p.u32(), total = p.u32();
      requireAsset(strip <= 1 && meshCount <= 4096 && total <= 3000000, 'Invalid mesh index list.');
      const faces: number[] = [], ids: number[] = []; let read = 0;
      for (let mesh = 0; mesh < meshCount; mesh++) {
        const count = p.u32(), material = p.u32(); requireAsset(count <= total - read && material < materials.length && count * 4 <= p.bytes.length - p.position, 'Invalid mesh group.');
        const verticesInMesh: number[] = []; let min = Infinity, max = -1;
        for (let i = 0; i < count; i++) {
          const index = p.u32(); requireAsset(index < vertices, 'Mesh references an invalid vertex.');
          verticesInMesh.push(index); min = Math.min(min,index); max = Math.max(max,index);
        }
        read += count; const start = faces.length;
        requireAsset(strip || count % 3 === 0, 'Invalid triangle-list length.');
        for (let i = 2; i < count; i += strip ? 1 : 3) {
          const a = verticesInMesh[i - 2], b = verticesInMesh[i - 1], c = verticesInMesh[i];
          if (strip && (a === b || b === c || a === c)) continue;
          faces.push(...(strip && i % 2 ? [b, a, c] : [a, b, c])); ids.push(material);
        }
        meshes.push({ start, count: faces.length - start, material, min, max });
      }
      requireAsset(read === total && p.position === p.bytes.length, 'Mesh index count mismatch.'); indices = new Uint32Array(faces); materialIds = new Uint16Array(ids);
    } else if (plugin.type === BREAKABLE_PLUGIN) { requireAsset(!breakable, 'Repeated breakable plugin.'); breakable = readBreakable(plugin.bytes); }
    else if (plugin.type === TWO_D_EFFECT_PLUGIN) { requireAsset(!effects, 'Repeated 2d effect plugin.'); effects = readTwoDEffects(plugin.bytes); }
    else warnings.add(`Geometry plugin 0x${plugin.type.toString(16)} is not rendered.`);
  }
  requireAsset(indices.every(i => i < vertices) && materialIds.every(i => i < materials.length), 'Model face references an invalid vertex or material.');
  if (r.repairs > 0) warnings.add(`Repaired ${r.repairs} non-finite model coordinates (zeroed).`);
  return { positions, normals, colors, nightColors, uvs, indices, materialIds, materials, flags, skin, meshes, morphBounds, breakable, ...(effects?.length ? { effects } : {}) };
}
export function readDff(bytes: Uint8Array, clumpIndex?: number, sanitize = false): DffModel {
  requireAsset(bytes.length <= 64 * 1024 * 1024, 'This model exceeds the 64 MiB import limit.');
  requireAsset(clumpIndex === undefined || Number.isInteger(clumpIndex) && clumpIndex >= 0 && clumpIndex < 16, 'Invalid model clump index.');
  const stream = new BinaryReader(bytes), roots = [readChunk(stream)];
  requireAsset(roots[0].type === 0x10, 'This is not a RenderWare model clump.');
  while (stream.position + 12 <= bytes.length) {
    const type = new DataView(bytes.buffer, bytes.byteOffset + stream.position, 4).getUint32(0, true);
    if (type !== 0x10) break; // Existing IMG sector padding is not a clump.
    requireAsset(roots.length < 16, 'This model exceeds the 16-clump limit.');
    roots.push(readChunk(stream));
  }
  requireAsset(roots.length > 0, 'This is not a RenderWare model clump.');
  requireAsset(roots.length === 1 || clumpIndex !== undefined, 'This model contains multiple clumps. Select a clump explicitly.');
  const selected = clumpIndex ?? 0;
  requireAsset(selected < roots.length, `Model clump ${selected} does not exist; this file contains ${roots.length}.`);
  const root = roots[selected];
  const parts = chunks(root.bytes);
  requireAsset(parts[0]?.type === 1 && [4, 12].includes(parts[0].bytes.length), 'Invalid clump header.');
  const header = new BinaryReader(parts[0].bytes), count = header.u32();
  const lightCount = header.bytes.length === 12 ? header.u32() : 0, cameraCount = header.bytes.length === 12 ? header.u32() : 0;
  requireAsset(count <= 4096 && lightCount + cameraCount <= 4096, 'Too many model atomics or attachments.');
  const collisionPlugins=parts.filter(part=>part.type===3).flatMap(part=>chunks(part.bytes)).filter(plugin=>plugin.type===0x253f2fa);
  requireAsset(collisionPlugins.length<=1,'Repeated embedded collision plugin.');
  const warnings = new Set<string>();
  let embeddedCollisions: ColModel[] | undefined;
  if (collisionPlugins.length) {
    // Embedded collision is auxiliary: a corrupt plugin warns and yields to
    // the caller's fallback instead of killing the model.
    try {
      embeddedCollisions = readCol(collisionPlugins[0].bytes, undefined, sanitize);
    } catch (error) {
      warnings.add(`Embedded collision is corrupt (${error instanceof Error ? error.message : error}); collision falls back to repaired geometry.`);
      embeddedCollisions = undefined;
    }
  }
  const frames = readFrames(one(parts, 0xe).bytes, warnings, sanitize), list = chunks(one(parts, 0x1a).bytes), geometryCount = structure(list).u32();
  requireAsset(geometryCount > 0 && geometryCount <= 4096, 'Invalid geometry-list count.');
  const attachments: NonNullable<DffModel['attachments']> = [];
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (part.type === 1) {
      const next = parts[++i];
      requireAsset(part.bytes.length === 4 && next && [0x12, 5].includes(next.type), 'Invalid clump attachment frame section.');
      const frame = new BinaryReader(part.bytes).u32();
      requireAsset(frame < frames.length, 'Invalid clump attachment frame.');
      // Preserve embedded object chunks for future native light/camera interpretation.
      chunks(next.bytes);
      attachments.push({kind: next.type === 0x12 ? 'light' : 'camera', frame, bytes: next.bytes.slice()});
    } else requireAsset(part.type !== 0x12 && part.type !== 5, 'Clump attachment has no frame section.');
  }
  requireAsset(attachments.filter(a => a.kind === 'light').length === lightCount && attachments.filter(a => a.kind === 'camera').length === cameraCount, 'Clump attachment count mismatch.');
  const geometryChunks = list.filter(c => c.type === 0xf);
  requireAsset(geometryChunks.length === geometryCount, 'Geometry count mismatch.');
  if (roots.length > 1) warnings.add(`Clump ${selected} of ${roots.length} selected (indices start at 0); other clumps are not assembled.`);
  const geometries = geometryChunks.map(c => readGeometry(c.bytes, warnings, sanitize));
  requireAsset(geometries.reduce((n, g) => n + g.positions.length / 3, 0) <= 1000000, 'Model exceeds the one-million-vertex limit.');
  const atomics = parts.filter(c => c.type === 0x14).map(c => {
    const atomicParts = chunks(c.bytes), r = structure(atomicParts), frame = r.u32(), geometry = r.u32(), flags = r.u32();
    const extensions = atomicParts.filter(p => p.type === 3);
    requireAsset(extensions.length <= 1, 'Repeated atomic extension.');
    const pipelines = extensions.flatMap(p => chunks(p.bytes)).filter(p => p.type === 0x253f2f3);
    requireAsset(pipelines.length <= 1, 'Repeated atomic pipeline.');
    let pipeline: number | undefined;
    if (pipelines.length) {
      requireAsset(pipelines[0].bytes.length === 4, 'Atomic pipeline must contain one identifier.');
      pipeline = new BinaryReader(pipelines[0].bytes).u32();
      warnings.add(`Atomic pipeline 0x${pipeline.toString(16).padStart(8, '0')} is retained; ${isBuildingPipeline(pipeline) ? 'inspection uses fallback materials; playable building support is partial.' : 'its custom rendering is not implemented.'}`);
    }
    requireAsset(frame < frames.length && geometry < geometries.length, 'Invalid atomic frame or geometry.'); return { frame, geometry, flags, ...(pipeline === undefined ? {} : { pipeline }) };
  });
  requireAsset(atomics.length === count, 'Atomic count mismatch.');
  const rendered = atomics.filter(a => a.flags & 4);
  const groups = geometries.map(g => g.meshes?.filter(m => m.count > 0).length ?? new Set(g.materialIds).size);
  requireAsset(rendered.reduce((n, a) => n + geometries[a.geometry].indices.length / 3, 0) <= 2000000, 'Model exceeds the two-million rendered-triangle limit.');
  requireAsset(rendered.reduce((n, a) => n + groups[a.geometry], 0) <= 16384, 'Model exceeds the material draw-group limit.');
  if (parts.some(c => c.type === 0x12 || c.type === 5)) warnings.add('Embedded lights and cameras are not previewed.');
  return { frames, geometries, atomics, warnings: [...warnings], ...(embeddedCollisions?{embeddedCollisions}:{}), ...(attachments.length ? {attachments} : {}) };
}
