import { BinaryReader, requireAsset } from './binary';
export interface HAnimData { version: number; id: number; flags: number; keyFrameSize: number; nodes: { id: number; index: number; flags: number }[] }
export interface SkinData { boneCount: number; maxWeights: number; usedBones: Uint8Array; indices: Uint8Array; weights: Float32Array; inverseMatrices: Float32Array }
export function readHAnim(bytes: Uint8Array): HAnimData {
  const r = new BinaryReader(bytes), version = r.u32(), id = r.i32(), count = r.u32();
  requireAsset(version === 0x100 && count <= 256, 'Unsupported HAnim version or bone count.');
  const flags = count ? r.u32() : 0, keyFrameSize = count ? r.u32() : 0;
  const nodes: HAnimData['nodes'] = [], ids = new Set<number>(), indices = new Set<number>();
  for (let i = 0; i < count; i++) {
    const id = r.i32(), index = r.u32(), flags = r.u32();
    requireAsset(index < count && !indices.has(index) && !ids.has(id), 'Invalid or duplicate HAnim bone mapping.');
    ids.add(id); indices.add(index); nodes.push({ id, index, flags });
  }
  requireAsset(r.position === bytes.length, 'Unexpected HAnim payload.');
  return { version, id, flags, keyFrameSize, nodes };
}
export function readSkin(bytes: Uint8Array, vertices: number): SkinData {
  const r = new BinaryReader(bytes), boneCount = r.u8(), usedCount = r.u8(), maxWeights = r.u8(); r.u8();
  requireAsset(boneCount > 0 && usedCount <= boneCount && maxWeights <= 4, 'Invalid skin header.');
  const legacy = usedCount === 0, usedBones = r.take(usedCount).slice();
  requireAsset(new Set(usedBones).size === usedCount && usedBones.every(i => i < boneCount), 'Invalid skin used-bone list.');
  const indices = r.take(vertices * 4).slice(), weights = r.floats(vertices * 4);
  for (let v = 0; v < vertices; v++) {
    let sum = 0, influences = 0;
    for (let j = 0; j < 4; j++) {
      const at = v * 4 + j, weight = weights[at];
      requireAsset(weight >= 0 && weight <= 1, 'Invalid skin weight.');
      if (weight > 0) { requireAsset(indices[at] < boneCount && (legacy || usedBones.includes(indices[at])), 'Skin references an unavailable bone.'); influences++; }
      sum += weight;
    }
    requireAsset(Math.abs(sum - 1) <= .01 && (legacy || influences <= maxWeights), 'Invalid skin weight sum or influence count.');
  }
  const inverseMatrices = new Float32Array(boneCount * 16);
  for (let bone = 0; bone < boneCount; bone++) {
    if (legacy) r.u32();
    const at = bone * 16;
    for (let j = 0; j < 16; j++) {
      // RenderWare's fourth lane stores matrix flags/padding, not affine coefficients.
      if (j % 4 === 3) { r.u32(); inverseMatrices[at + j] = j === 15 ? 1 : 0; }
      else { const value = r.f32(); requireAsset(Math.abs(value) <= 1e7, 'Skin matrix exceeds coordinate limit.'); inverseMatrices[at + j] = value; }
    }
    const m = inverseMatrices.subarray(at, at + 16);
    const determinant = m[0] * (m[5] * m[10] - m[9] * m[6]) - m[4] * (m[1] * m[10] - m[9] * m[2]) + m[8] * (m[1] * m[6] - m[5] * m[2]);
    requireAsset(Math.abs(determinant) > 1e-12, 'Singular skin inverse matrix.');
  }
  if (!legacy) {
    r.u32(); const meshes = r.u32(), runs = r.u32();
    requireAsset(meshes === 0 && runs === 0, 'Split skin remapping is not supported yet.');
  }
  requireAsset(r.position === bytes.length, 'Unexpected skin payload.');
  return { boneCount, maxWeights, usedBones, indices, weights, inverseMatrices };
}
