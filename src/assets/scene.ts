import { requireAsset } from './binary';
import { readIpl, type IplInstance } from './ipl';
import { readImgIndex } from './img';
import type { IdeAssociation } from './ide';
import { readModel } from './readModel';
export interface SceneRequest { file: File; placementFile: File; associations: IdeAssociation[]; parents: [string, string][]; interior: number; }
export type ScenePart = Awaited<ReturnType<typeof readModel>> & { name: string; placements: IplInstance[] };
export async function readScene(request: SceneRequest) {
  requireAsset(request.placementFile.size <= 64 * 1024 * 1024, 'IPL exceeds the 64 MiB source limit.');
  requireAsset(Number.isInteger(request.interior) && request.interior >= 0 && request.interior <= 255, 'Interior must be an integer from 0 to 255.');
  const ipl = readIpl(new Uint8Array(await request.placementFile.arrayBuffer())), entries = await readImgIndex(request.file);
  const byName = new Map(request.associations.map(a => [a.model.toLowerCase(), a])), byId = new Map<number, IdeAssociation>();
  for (const a of request.associations) {
    requireAsset(!byId.has(a.id) || byId.get(a.id)!.model.toLowerCase() === a.model.toLowerCase(), `Ambiguous IDE model ID ${a.id}.`); byId.set(a.id, a);
  }
  const groups = new Map<string, IplInstance[]>(), notices = [...ipl.warnings]; let missingIds = 0;
  const instances = ipl.instances.filter(p => p.interior === request.interior);
  requireAsset(instances.length > 0 && instances.length <= 4096, 'Scene requires 1–4,096 placements in the selected interior.');
  for (const instance of instances) {
    const name = (instance.modelName ?? byId.get(instance.modelId)?.model)?.toLowerCase();
    if (!name) { missingIds++; continue; }
    if (!groups.has(name)) groups.set(name, []); groups.get(name)!.push(instance);
  }
  if (missingIds) notices.push(`${missingIds} placements lack an IDE model definition.`);
  requireAsset(groups.size <= 256, 'Scene exceeds the 256 model limit.');
  const scene: ScenePart[] = []; let memory = 0, triangles = 0, nodes = 0, missingModels = 0;
  for (const [name, placements] of groups) {
    const entry = entries.find(e => e.name.toLowerCase() === `${name}.dff`);
    if (!entry) { missingModels += placements.length; notices.push(`Missing model: ${name}.dff (${placements.length} placements).`); continue; }
    const dictionary = byName.get(name)?.dictionary ?? name;
    const textureEntry = entries.find(e => e.name.toLowerCase() === `${dictionary.toLowerCase()}.txd`);
    const part = await readModel({ file: request.file, entry, textureEntry, parents: request.parents });
    if (!textureEntry) part.notices.push(`Missing dictionary: ${dictionary}.txd.`);
    const bound = new Set(part.textures.map(t => t.name.toLowerCase()));
    const missing = [...new Set(part.model.geometries.flatMap(g => g.materials.map(m => m.texture).filter(n => n && !bound.has(n.toLowerCase()))))];
    if (missing.length) part.notices.push(`Unbound textures: ${missing.join(', ')}`);
    for (const geometry of part.model.geometries) for (const a of [geometry.positions, geometry.normals, geometry.colors, geometry.nightColors, geometry.indices, geometry.materialIds, ...geometry.uvs]) memory += a?.byteLength ?? 0;
    for (const texture of part.textures) for (const mip of texture.mips) memory += mip.data.byteLength;
    triangles += placements.length * part.model.atomics.filter(a => a.flags & 4).reduce((n, a) => n + part.model.geometries[a.geometry].indices.length / 3, 0);
    nodes += placements.length * (part.model.frames.length + part.model.atomics.length);
    requireAsset(memory <= 128 * 1024 * 1024 && triangles <= 2000000 && nodes <= 100000, 'Scene exceeds its decoded memory, triangle or hierarchy limit.');
    scene.push({ ...part, name, placements });
  }
  requireAsset(scene.length > 0, 'No scene models could be resolved from the selected archive and definitions.');
  notices.push('Raw placements only: LOD links, draw distances, collision and streaming are not applied.');
  return { scene, notices, requested: instances.length, omitted: missingIds + missingModels };
}
