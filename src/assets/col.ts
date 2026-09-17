import { readImgEntry, type ImgEntry } from './img';
import { BinaryReader, requireAsset } from './binary';
type Vec3 = [number, number, number];
/** Raw primitive surface bytes: flags is m_nPiece; brightness is packed
 * m_nLighting; light is the distinct trailing m_nLight field. */
export interface ColSurface { material: number; flags: number; brightness: number; light: number; }
export interface ColMesh { positions: Float32Array; indices: Uint32Array; materials: Uint8Array; lights: Uint8Array; }
export interface ColModel {
  name: string; id: number; version: 2 | 3; flags: number;
  bounds: { min: Vec3; max: Vec3; center: Vec3; radius: number };
  spheres: { center: Vec3; radius: number; surface: ColSurface }[];
  boxes: { min: Vec3; max: Vec3; surface: ColSurface }[];
  mesh: ColMesh; shadow: ColMesh | null;
  faceGroups: { min: Vec3; max: Vec3; start: number; end: number }[]; warnings: string[];
}
const vector = (r: BinaryReader): Vec3 => { const value: Vec3 = [r.f32(), r.f32(), r.f32()]; requireAsset(value.every(n => Math.abs(n) <= 1e7), 'COL coordinate exceeds the limit.'); return value; };
function box(r: BinaryReader) { const min = vector(r), max = vector(r); requireAsset(min.every((n, i) => n <= max[i]), 'Inverted COL bounds.'); return { min, max }; }
function sphere(r: BinaryReader) { const center = vector(r), radius = r.f32(); requireAsset(radius >= 0 && radius <= 1e7, 'Invalid COL radius.'); return { center, radius }; }
function surface(r: BinaryReader): ColSurface { return { material: r.u8(), flags: r.u8(), brightness: r.u8(), light: r.u8() }; }
function readModel(bytes: Uint8Array, version: 2 | 3, sanitize = false): ColModel {
  const regionReaders: BinaryReader[] = [];
  const r = new BinaryReader(bytes); r.position = 8;
  r.sanitizeNonFinite = sanitize;
  regionReaders.push(r);
  const name = r.name(22), id = r.u16();
  requireAsset(name && !/[\x00-\x1f\\/]/.test(name), 'Invalid COL model name.');
  const bounds = { ...box(r), ...sphere(r) };
  const sphereCount = r.u16(), boxCount = r.u16(), faceCount = r.u16(), lineCount = r.u8(); r.u8();
  const flags = r.u32(), sphereOffset = r.u32(), boxOffset = r.u32(), lineOffset = r.u32(), vertexOffset = r.u32(), faceOffset = r.u32(), planeOffset = r.u32();
  const shadowCount = version === 3 ? r.u32() : 0, shadowVertexOffset = version === 3 ? r.u32() : 0, shadowFaceOffset = version === 3 ? r.u32() : 0;
  const headerEnd = r.position, regions: { start: number; end: number }[] = [], warnings: string[] = [];
  requireAsset(!lineCount, 'COL suspension lines/disks are not supported yet.');
  if (lineOffset || planeOffset) warnings.push('Stored suspension/triangle-plane offsets are not interpreted.');
  function region(offset: number, length: number) {
    if (!length) return new BinaryReader(new Uint8Array());
    const start = offset + 4, end = start + length;
    requireAsset(offset > 0 && start >= headerEnd && end <= bytes.length, 'COL data range is outside the model.');
    requireAsset(regions.every(p => end <= p.start || start >= p.end), 'Overlapping COL data ranges.');
    regions.push({ start, end });
    const reader = new BinaryReader(bytes.subarray(start, end));
    reader.sanitizeNonFinite = sanitize;
    regionReaders.push(reader);
    return reader;
  }
  const sr = region(sphereOffset, sphereCount * 20), spheres = Array.from({ length: sphereCount }, () => ({ ...sphere(sr), surface: surface(sr) }));
  const br = region(boxOffset, boxCount * 28), boxes = Array.from({ length: boxCount }, () => ({ ...box(br), surface: surface(br) }));
  function mesh(count: number, vertices: number, faces: number): ColMesh {
    requireAsset(count <= 1000000, 'COL mesh exceeds the triangle limit.');
    const fr = region(faces, count * 8), indices = new Uint32Array(count * 3), materials = new Uint8Array(count), lights = new Uint8Array(count); let vertexCount = 0;
    for (let i = 0; i < count; i++) {
      for (let j = 0; j < 3; j++) { const index = fr.u16(); indices[i * 3 + j] = index; vertexCount = Math.max(vertexCount, index + 1); }
      materials[i] = fr.u8(); lights[i] = fr.u8();
    }
    const vr = region(vertices, vertexCount * 6), positions = new Float32Array(vertexCount * 3);
    for (let i = 0; i < positions.length; i++) { const value = vr.u16(); positions[i] = (value >= 32768 ? value - 65536 : value) / 128; }
    return { positions, indices, materials, lights };
  }
  const collision = mesh(faceCount, vertexOffset, faceOffset), faceGroups: ColModel['faceGroups'] = [];
  if (flags & 8) {
    requireAsset(faceOffset >= headerEnd, 'Invalid COL face-group location.');
    const countReader = region(faceOffset - 4, 4), count = countReader.u32();
    requireAsset(count <= faceCount, 'COL face-group count exceeds face count.');
    const gr = region(faceOffset - 4 - count * 28, count * 28);
    for (let i = 0; i < count; i++) {
      const bounds = box(gr), start = gr.u16(), end = gr.u16();
      requireAsset(start <= end && end < faceCount, 'Invalid COL face-group indices.'); faceGroups.push({ ...bounds, start, end });
    }
  }
  const shadow = version === 3 && flags & 16 ? mesh(shadowCount, shadowVertexOffset, shadowFaceOffset) : null;
  if (shadowCount && !shadow) warnings.push('Shadow data is present without the shadow-mesh flag.');
  const repaired = regionReaders.reduce((n, reader) => n + reader.repairs, 0);
  if (repaired > 0) warnings.push(`Repaired ${repaired} non-finite collision coordinates (zeroed).`);
  return { name, id, version, flags, bounds, spheres, boxes, mesh: collision, shadow, faceGroups, warnings };
}
export function readCol(bytes: Uint8Array, warnings: string[] = [], sanitize = false): ColModel[] {
  requireAsset(bytes.length <= 64 * 1024 * 1024, 'COL source exceeds 64 MiB.');
  const reader = new BinaryReader(bytes), models: ColModel[] = [], names = new Set<string>(); let vertices = 0, triangles = 0, volumes = 0;
  reader.sanitizeNonFinite = sanitize;
  while (reader.position < bytes.length) {
    const start = reader.position;
    if (bytes[start] === 0 && bytes.subarray(start).every(n => n === 0)) break;
    const magic = reader.name(4), size = reader.u32();
    if (magic !== 'COL2' && magic !== 'COL3') {
      // Corrupt-depot repair: skip one entry with a sane size instead of losing the whole archive.
      requireAsset(size >= 100 && size <= 64 * 1024 * 1024 && start + 8 + size <= bytes.length, `Unsupported collision format: ${magic || 'empty'}.`);
      warnings.push(`Skipped corrupt collision entry (${JSON.stringify(magic)}); its model falls back to repaired geometry.`);
      reader.position = start + 8 + size;
      continue;
    }
    requireAsset(size >= (magic === 'COL2' ? 100 : 112), 'COL model header is truncated.');
    reader.take(size); // Size excludes signature and size fields.
    const model = readModel(bytes.subarray(start, reader.position), magic === 'COL2' ? 2 : 3, sanitize);
    requireAsset(!names.has(model.name.toLowerCase()), `Duplicate COL model: ${model.name}.`); names.add(model.name.toLowerCase());
    volumes += model.spheres.length + model.boxes.length;
    vertices += (model.mesh.positions.length + (model.shadow?.positions.length ?? 0)) / 3;
    triangles += (model.mesh.indices.length + (model.shadow?.indices.length ?? 0)) / 3;
    requireAsset(volumes <= 200000 && vertices <= 1000000 && triangles <= 2000000 && models.length < 4096, 'COL collection exceeds decoded limits.');
    models.push(model);
  }
  requireAsset(models.length > 0 || warnings.length > 0, 'No collision models found.');
  if (reader.repairs > 0) warnings.push(`Repaired ${reader.repairs} non-finite collision coordinates (zeroed).`);
  return models;
}

export async function readCollisionFile(file?: File, archive?: File, entry?: ImgEntry): Promise<ColModel[] | undefined> {
  if (!file) {
    if (!entry) return undefined;
    requireAsset(archive, 'Collision archive is missing.');
    return readCol(await readImgEntry(archive, entry));
  }
  requireAsset(file.size <= 64 * 1024 * 1024, 'COL source exceeds 64 MiB.');
  return readCol(new Uint8Array(await file.arrayBuffer()));
}

/** Fallback box collision synthesized from model geometry bounds for a vehicle
 * whose COL entry is corrupt (finite coordinates only; unit box when empty). */
export function boxCollisionFallback(name: string, positions: Float32Array): ColModel {
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i + 2 < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    if (x < minX) minX = x; if (y < minY) minY = y; if (z < minZ) minZ = z;
    if (x > maxX) maxX = x; if (y > maxY) maxY = y; if (z > maxZ) maxZ = z;
  }
  if (!(minX <= maxX)) { minX = minY = minZ = -0.5; maxX = maxY = maxZ = 0.5; }
  const min: Vec3 = [minX, minY, minZ], max: Vec3 = [maxX, maxY, maxZ];
  const center: Vec3 = [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2];
  const radius = Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) / 2;
  const surface: ColSurface = { material: 0, flags: 0, brightness: 0, light: 0 };
  const positions8 = new Float32Array([minX, minY, minZ, maxX, minY, minZ, maxX, maxY, minZ, minX, maxY, minZ, minX, minY, maxZ, maxX, minY, maxZ, maxX, maxY, maxZ, minX, maxY, maxZ]);
  const indices = new Uint32Array([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0]);
  return {
    name, id: 0, version: 2, flags: 0,
    bounds: { min, max, center, radius },
    spheres: [{ center, radius, surface }],
    boxes: [{ min, max, surface }],
    mesh: { positions: positions8, indices, materials: new Uint8Array(12), lights: new Uint8Array(12) },
    shadow: null, faceGroups: [],
    warnings: [`Synthesized box collision for corrupt ${name}.col entry (model bounds fallback).`],
  };
}
