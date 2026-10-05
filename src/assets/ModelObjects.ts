import { matrixFromNative } from '../core/nativeArrays';
import {nativeRasterOutput} from './nativeRasterOutput';
import {nativeCarEnvMaterial,nativeCarEnvStyle,nativeCarSpecular,type NativeCarEnvState} from './nativeCarEnvMap';
import { nativeLitMaterial, type NativeAmbientState } from './nativeMaterial';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { skinFrames } from '../animation/skeleton';
import * as THREE from 'three';
import type { DffModel, ModelMaterial } from './dff';
import type { IplInstance } from './ipl';
import type { ModelTexture } from './modelTextures';
import { placementMatrix } from './placement';
import { TexturePool } from './TexturePool';
import { materialVertexAlpha } from './vertexAlpha';
import { mergeAlikeSpans } from './mergeSpans';
import { buildingMaterial, isBuildingAtomic, isDayNightAtomic, type BuildingLightingState } from './buildingMaterial';
import { blendPrelightByte, dayNightPhase, nativeDayNightPrelight, preRenderUpdate as dayNightPreRenderUpdate, type NativeDayNightPrelight } from './nativeDayNightPrelight';
import { UvAnimationPlayer } from './uvAnimation';
import { nativeEnvMap } from './nativeEnvMap';
/** One material's RpUVAnim playback: its own texture instance (the raster is shared) whose matrix the player writes.
 * The shared image stays uploaded once; three reads `map.matrix` as the uv transform. */
export class UvAnimator {
  constructor(readonly texture: THREE.Texture, readonly player: UvAnimationPlayer) { texture.matrixAutoUpdate = false; this.apply(); }
  /** MaterialUpdateUVAnimCB: add the frame's seconds, then apply channel 0 to the material's texture transform. */
  advance(seconds: number) { this.player.addTime(seconds); this.apply(); }
  private apply() { const m = this.player.channelMatrix(0); this.texture.matrix.set(m[0], m[2], m[4], m[1], m[3], m[5], 0, 0, 1); }
}

/** Generic material instances and their immutable import provenance; specialized building variants are separate. */
export interface ModelMaterialBinding {material:THREE.MeshBasicMaterial|THREE.MeshLambertMaterial;source:ModelMaterial;geometryFlags:number;texture?:ModelTexture}

/** Where model construction spends its time, for the scene benchmark (milliseconds and counts, cumulative). */
export const modelBuildStats={models:0,clones:0,geometriesMs:0,mapsMs:0,spansMs:0,alphaScanMs:0,normalsMs:0,materialsMs:0,nightMs:0,boundsMs:0,clonesMs:0};
const clock=()=>typeof performance!=='undefined'?performance.now():0;
// One proper rotation converts GTA Z-up to the runtime's Y-up: (x,y,z) -> (x,z,-y).
export function modelObject(model: DffModel, textures: ModelTexture[] = [], placement?: IplInstance, pool = new TexturePool(), options: { worldLighting?: boolean; ambient?: NativeAmbientState; buildingLighting?: BuildingLightingState;
  /** A vehicle model: CCustomCarEnvMapPipeline's reflections from the SA reflection material, with this car's state. */ carEnv?: NativeCarEnvState } = {}) {
  const materialBindings:ModelMaterialBinding[]=[], uvAnimators: UvAnimator[] = [];
  const animationsByName = new Map((model.uvAnimations ?? []).map(anim => [anim.name.toLowerCase(), anim]));
  const palettes = model.geometries.map(g => g.skin ? skinFrames(model, g.skin.boneCount) : undefined);
  // Atomics the building pipes draw blend their prelight in the shader; the rest keep a CPU colour attribute.
  const buildingAtomic = (a: DffModel['atomics'][number]) => !!options.buildingLighting && !model.geometries[a.geometry].skin && isBuildingAtomic(a.pipeline, model.geometries[a.geometry]);
  const cpuPrelight = new Set(model.atomics.filter(a => (a.flags & 4) && !buildingAtomic(a)).map(a => a.geometry));
  const skeletons: THREE.Skeleton[] = [];
  const root = new THREE.Group();
  if (placement) { root.matrixAutoUpdate = false; root.matrix.copy(placementMatrix(placement)); }
  else root.rotation.x = -Math.PI / 2;
  const frames = model.frames.map((frame, index) => { const group = frame.hanim ? new THREE.Bone() : new THREE.Group(); group.name = frame.name; group.userData.nativeFrame = index; group.matrixAutoUpdate = false; matrixFromNative(group.matrix, frame.matrix); return group; });
  frames.forEach((frame, i) => (model.frames[i].parent < 0 ? root : frames[model.frames[i].parent]).add(frame));
  const acquired:ModelTexture[]=[], ownedGeometries=new Set<THREE.BufferGeometry>(), ownedMaterials=new Set<THREE.Material>(), ownedTextures=new Set<THREE.Texture>();
  let disposed=false;
  const dispose=()=>{if(disposed)return;disposed=true;root.removeFromParent();skeletons.forEach(s=>s.dispose());ownedGeometries.forEach(g=>g.dispose());ownedMaterials.forEach(m=>m.dispose());ownedTextures.forEach(t=>t.dispose());acquired.forEach(t=>pool.release(t));};
  try {
  modelBuildStats.models++;const startedAt=clock();let normalsMs=0,materialsMs=0,spansMs=0,alphaScanMs=0;
  const maps = new Map(textures.map(t => {const map=pool.acquire(t);acquired.push(t);return [t.name.toLowerCase(), { map, source: t, alpha: t.hasAlpha }] as const;}));
  const mapsMs=clock()-startedAt;modelBuildStats.mapsMs+=mapsMs;
  // ATOMIC_PIPE_NO_EXTRA_PASSES_LOD: a vehicle's far _vlo model draws without the car pipeline's reflection pass.
  const lodGeometries = new Set(model.atomics.filter(a => /_vlo$/i.test(model.frames[a.frame]?.name ?? '')).map(a => a.geometry));
  const geometries = model.geometries.map((source, geometryIndex) => {
    const geometry = new THREE.BufferGeometry(); ownedGeometries.add(geometry); geometry.setAttribute('position', new THREE.BufferAttribute(source.positions, 3));
    if (source.skin) {
      const indices = source.skin.indices.slice();
      indices.forEach((_, i) => { if (!source.skin!.weights[i]) indices[i] = 0; });
      geometry.setAttribute('skinIndex', new THREE.BufferAttribute(indices, 4));
      geometry.setAttribute('skinWeight', new THREE.BufferAttribute(source.skin.weights.slice(), 4));
    }
    if (source.normals) geometry.setAttribute('normal', new THREE.BufferAttribute(source.normals, 3));
    source.uvs.forEach((uv, i) => geometry.setAttribute(i ? `uv${i}` : 'uv', new THREE.BufferAttribute(uv, 2)));
    if (cpuPrelight.has(geometryIndex) && source.colors) geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(source.positions.length / 3 * 4).fill(1), 4));
    // Native BinMesh data already supplies the index order and draw spans.
    // Only models without it need triangles regrouped by material.
    const spansAt=clock();
    if(source.materialIds.some(id=>id>=source.materials.length))throw new Error('Geometry references an invalid material.');
    let spans=source.meshes,indices=source.indices;
    if(!spans){
     const buckets = source.materials.map(() => [] as number[]);
     source.materialIds.forEach((id, triangle) => buckets[id].push(source.indices[triangle * 3], source.indices[triangle * 3 + 1], source.indices[triangle * 3 + 2]));
     spans = buckets.map((bucket, material) => {
      let min = Infinity, max = -1;
      for (const index of bucket) { min = Math.min(min, index); max = Math.max(max, index); }
      return { min, max, material, start:0, count:bucket.length };
    });
     indices = new Uint32Array(source.indices.length); let offset = 0;
     buckets.forEach((bucket, material) => { indices.set(bucket, offset);spans![material].start=offset;offset += bucket.length; });
    }
    // Alike opaque spans draw as one group (mergeAlikeSpans): the same material, textured without alpha, with no vertex
    // alpha, and opaque in every prelight it carries.
    {const vertexAlpha=materialVertexAlpha([source.colors,source.nightColors],spans),index=new Map(spans.map((span,i)=>[span,i]));
     ({spans,indices}=mergeAlikeSpans(spans,indices,span=>{
      const m=source.materials[span.material];
      if(m.color[3]<255||vertexAlpha[index.get(span)!]||(source.uvs.length&&maps.get(m.texture.toLowerCase())?.alpha))return undefined;
      return JSON.stringify(m);
     }));}
    spans.forEach((mesh, slot) => { if (mesh.count) geometry.addGroup(mesh.start,mesh.count,slot); });
    spansMs += clock() - spansAt;
    geometry.setIndex(new THREE.BufferAttribute(indices, 1)); if (!source.normals) { const t = clock(); geometry.computeVertexNormals(); normalsMs += clock() - t; }
    const alphaAt = clock();
    const vertexAlpha = [source.colors, source.nightColors].some(colors => colors?.some((value, i) => i % 4 === 3 && value < 255));
    alphaScanMs += clock() - alphaAt;
    const materialsAt = clock();
    const materials = source.materials.map(m => {
      const texture = source.uvs.length ? maps.get(m.texture.toLowerCase()) : undefined;
      const parameters = {
      map: texture?.map ?? null, alphaTest: texture?.alpha ? 1 / 255 : 0,
      color: source.flags & 64 ? new THREE.Color().setRGB(m.color[0] / 255, m.color[1] / 255, m.color[2] / 255) : 0xffffff,
      opacity: m.color[3] / 255, transparent: m.color[3] < 255 || vertexAlpha || !!texture?.alpha,
      depthWrite: !(m.color[3] < 255 || vertexAlpha || texture?.alpha),
      // A geometry without prelight has no vertex colours, whatever night set it carries (not a day/night building).
      vertexColors: !!source.colors, side: THREE.FrontSide,
    };
      const material = options.worldLighting && source.flags & 0x20 ? nativeLitMaterial(parameters, source.flags & 0x10 ? m.surface : [m.surface[0],m.surface[1],0], options.ambient) : nativeRasterOutput(new THREE.MeshBasicMaterial(parameters));
      ownedMaterials.add(material);
      // RpMatFX environment mapping: the env texture comes from the same dictionary chain (vehicle.txd for cars).
      if (options.carEnv && m.carEnv) {
        // The car pipeline ignores the MatFX coefficient: shininess and the env texture's name pick the reflection.
        const style = lodGeometries.has(geometryIndex) ? undefined : nativeCarEnvStyle(m.carEnv, m.envMap?.texture, source.uvs.length > 1), env = style && m.envMap ? maps.get(m.envMap.texture.toLowerCase()) : undefined;
        if (style && env) nativeCarEnvMaterial(material, env.map, m.carEnv, style, options.carEnv);
        // MF_HAS_SPECULARITY: a specularity with a spec texture named (the texture itself is never sampled).
        if (m.carSpecular && m.carSpecular.level > 0 && m.carSpecular.texture && options.worldLighting) nativeCarSpecular(material, m.carSpecular.level, options.carEnv);
      } else if (m.envMap && m.envMap.coefficient > 0) { const env = maps.get(m.envMap.texture.toLowerCase()); if (env) nativeEnvMap(material, env.map, m.envMap.coefficient, m.envMap.fbAlpha, m.carEnv?.shininess ?? 1); }
      // RpUVAnim slots: the material gets its own texture instance whose matrix the animation drives.
      const animations = (m.uvAnimations ?? []).map(slot => animationsByName.get(slot.name.toLowerCase())).filter((anim): anim is NonNullable<typeof anim> => !!anim);
      if (animations.length && material.map) { const animated = material.map.clone(); ownedTextures.add(animated); material.map = animated; uvAnimators.push(new UvAnimator(animated, new UvAnimationPlayer(animations))); }
      materialBindings.push({material,source:m,geometryFlags:source.flags,texture:texture?.source});
      material.userData.nativeFadeColor = m.color.slice(0, 3).map(value => value / 255);
      material.userData.nativeTextureAlpha = !!texture?.alpha;
      return material;
    });
    materialsMs += clock() - materialsAt;
    const drawSpans = spans;
    return { geometry, materials, drawMaterials: drawSpans.map(span => materials[span.material]), source, spans: drawSpans, building: new Map<boolean, THREE.MeshBasicMaterial[]>(), dayNight: undefined as NativeDayNightPrelight | undefined };
  });
  modelBuildStats.geometriesMs += clock() - startedAt - mapsMs - normalsMs - materialsMs - spansMs - alphaScanMs; modelBuildStats.normalsMs += normalsMs; modelBuildStats.materialsMs += materialsMs; modelBuildStats.spansMs += spansMs; modelBuildStats.alphaScanMs += alphaScanMs;
  model.atomics.forEach((atomic, atomicIndex) => {
    if (!(atomic.flags & 4)) return;
    const record = geometries[atomic.geometry], { geometry, source } = record;
    let materials = record.drawMaterials;
    if (buildingAtomic(atomic)) {
      if (!geometry.hasAttribute('nativeDay')) {
        geometry.setAttribute('nativeDay', new THREE.BufferAttribute(source.colors ?? new Uint8Array(source.positions.length / 3 * 4).fill(255), 4, true));
        geometry.setAttribute('nativeNight', new THREE.BufferAttribute(source.nightColors ?? source.colors ?? new Uint8Array(source.positions.length / 3 * 4).fill(255), 4, true));
      }
      const dayNight = isDayNightAtomic(source);
      let selected = record.building.get(dayNight);
      if (!selected) {
        const vertexAlpha = materialVertexAlpha([source.colors, ...(dayNight ? [source.nightColors] : [])], record.spans);
        // The geometry's own DNBalance, blended at the scene's balance on creation.
        if (dayNight) record.dayNight ??= nativeDayNightPrelight(dayNightPhase(model.frames[atomic.frame]?.name ?? '', atomic.geometry), options.buildingLighting!.night.value);
        selected = record.drawMaterials.map((material,i) => {const result=buildingMaterial(material as THREE.MeshBasicMaterial, source.materials[record.spans[i].material].surface[0], options.buildingLighting!, dayNight, vertexAlpha[i], record.dayNight);ownedMaterials.add(result);return result;}); record.building.set(dayNight,selected);
      }
      materials = selected;
    }
    if (source.skin) {
      const inverses = Array.from({ length: source.skin.boneCount }, (_, i) => new THREE.Matrix4().fromArray(source.skin!.inverseMatrices, i * 16));
      const skeleton = new THREE.Skeleton(palettes[atomic.geometry]!.map(i => frames[i] as THREE.Bone), inverses);
      skeletons.push(skeleton);
      const mesh = new THREE.SkinnedMesh(geometry, materials); mesh.matrixAutoUpdate = false; mesh.normalizeSkinWeights();
      mesh.userData.nativeAtomic = atomicIndex; mesh.userData.nativePipeline = atomic.pipeline;
      frames[atomic.frame].add(mesh); mesh.bind(skeleton, new THREE.Matrix4());
    } else { const mesh = new THREE.Mesh(geometry, materials); mesh.matrixAutoUpdate = false; mesh.userData.nativeAtomic = atomicIndex; mesh.userData.nativePipeline = atomic.pipeline; frames[atomic.frame].add(mesh); }
  });
  const dayNightStates = geometries.flatMap(record => record.dayNight ? [record.dayNight] : []);
  let lastNight: number | undefined;
  /** Blends every day/night prelight at `amount` now: CEntity::CreateRwObject's PreRenderUpdate(ignoreDNBalanceParam).
   * Geometries outside the building pipes blend on the CPU, the same way, when they carry both colour sets. */
  const setNight = (amount: number) => {
    if (!Number.isFinite(amount)) throw new Error('Night prelight amount must be finite.');
    for (const state of dayNightStates) dayNightPreRenderUpdate(state, amount, 0, true);
    blendCpuPrelight(amount);
  };
  const blendCpuPrelight = (amount: number) => {
    amount = THREE.MathUtils.clamp(amount, 0, 1);
    if (amount === lastNight) return;
    const initializing = lastNight === undefined; lastNight = amount;
    geometries.forEach(({ geometry, source }) => {
      const color = geometry.getAttribute('color'); if (!color) return;
      const day = source.colors!, night = source.nightColors, array = color.array;
      if (!night) { if (initializing) { for (let i = 0; i < array.length; i++) array[i] = day[i] / 255; color.needsUpdate = true; } return; }
      for (let i = 0; i < array.length; i++) array[i] = blendPrelightByte(day[i], night[i], amount) / 255;
      color.needsUpdate = true;
    });
  };
  /** CEntity::PreRender's CCustomBuildingDNPipeline::PreRenderUpdate for a drawn model, once a game frame. */
  const preRenderUpdate = (balance: number, frame: number) => { for (const state of dayNightStates) dayNightPreRenderUpdate(state, balance, frame); };
  const nightAt = clock(); blendCpuPrelight(0); modelBuildStats.nightMs += clock() - nightAt; root.updateMatrixWorld(true);
  const boundsAt = clock();
  const bounds = new THREE.Box3().setFromObject(root);
  modelBuildStats.boundsMs += clock() - boundsAt;
  if (!bounds.isEmpty() && [...bounds.min.toArray(), ...bounds.max.toArray()].some(v => !Number.isFinite(v) || Math.abs(v) > 1e7)) {
    dispose(); throw new Error('Model world bounds exceed the preview coordinate limit.');
  }
  /** The texture the model built for a dictionary name, including ones no material uses (a car's lit-lamp texture). */
  const textureMap = (name: string) => maps.get(name.toLowerCase())?.map ?? undefined;
  return { root, setNight, preRenderUpdate, dispose, materialBindings, bounds, uvAnimators, textureMap };
  }catch(error){dispose();throw error;}
}
/** Union of one model's world bounds across placements without traversing
 * cloned hierarchies. Source bounds are mapped per placement by
 * P * sourceRoot^-1 (placements already carry the Z-up to Y-up rotation),
 * so large worlds validate with box math instead of a full-vertex walk. */
export function unionPlacedBounds(sourceBounds: THREE.Box3, sourceRootWorld: THREE.Matrix4, placements: IplInstance[]): THREE.Box3 {
  const union = new THREE.Box3(); union.makeEmpty();
  if (sourceBounds.isEmpty()) return union;
  const inverse = sourceRootWorld.clone().invert(), mapped = new THREE.Box3();
  for (const placement of placements) {
    mapped.copy(sourceBounds).applyMatrix4(placementMatrix(placement).multiply(inverse));
    union.union(mapped);
  }
  return union;
}
/** Coordinate-limit validation shared by placed-model installation. */
export function assertPlacedBounds(bounds: THREE.Box3) {
  if (!bounds.isEmpty() && [...bounds.min.toArray(), ...bounds.max.toArray()].some(v => !Number.isFinite(v) || Math.abs(v) > 1e7)) throw new Error('Placed model bounds exceed the coordinate limit.');
}
export type ModelObjectSource = ReturnType<typeof modelObject>;
/** Built model sources (geometries, materials, frame hierarchy) shared by the successive scene windows of one
 * immutable dataset. CStreaming keeps a model resident while any entity in range uses it; here a model retained
 * from the previous window keeps its Three objects, and with them its uploaded GPU buffers and compiled programs,
 * instead of being rebuilt and re-uploaded on every window. Materials capture the caller's lighting state objects,
 * so a shared source must be built and reused with the same ones. */
/** The decoded model a pooled source was built from; a retired source keeps it so the streaming worker can leave the
 * model out of a window message when the source comes back (the arrays are the ones its geometry already holds). */
export interface HeldModel { model: DffModel; textures: ModelTexture[] }
export class ModelObjectPool {
  private entries = new Map<string, { source: ModelObjectSource; references: number; bytes: number; held?: HeldModel }>();
  /** Sources no window uses any more, oldest first, kept within `retiredBudget` bytes of geometry the way
   * CStreaming keeps a model loaded until memory is needed: driving back over the same street reuses them. */
  private retired = new Map<string, { source: ModelObjectSource; bytes: number; held?: HeldModel }>();
  private retiredBytes = 0;
  constructor(readonly retiredBudget = RETAINED_MODELS.budget) {}
  get size() { return this.entries.size; }
  get retiredCount() { return this.retired.size; }
  get retiredMB() { return this.retiredBytes / 1e6; }
  acquire(key: string, build: () => ModelObjectSource, bytes = 0, held?: HeldModel) {
    let entry = this.entries.get(key);
    if (!entry) {
      const kept = this.retired.get(key);
      if (kept) { this.retired.delete(key); this.retiredBytes -= kept.bytes; entry = { source: kept.source, references: 0, bytes: kept.bytes, held: kept.held ?? held }; }
      else entry = { source: build(), references: 0, bytes, held };
      this.entries.set(key, entry);
    }
    entry.references++; return entry.source;
  }
  /** The decoded models of the retired sources, by key: still resident for the next window message. */
  retiredModels() { const out = new Map<string, HeldModel>(); for (const [key, entry] of this.retired) if (entry.held) out.set(key, entry.held); return out; }
  release(key: string) {
    const entry = this.entries.get(key); if (!entry) return;
    if (--entry.references > 0) return;
    this.entries.delete(key);
    if (entry.bytes > this.retiredBudget) { entry.source.dispose(); return; }
    this.retired.set(key, { source: entry.source, bytes: entry.bytes, held: entry.held }); this.retiredBytes += entry.bytes;
    for (const [oldKey, old] of this.retired) { if (this.retiredBytes <= this.retiredBudget) break; this.retired.delete(oldKey); this.retiredBytes -= old.bytes; old.source.dispose(); }
  }
  dispose() { for (const entry of this.entries.values()) entry.source.dispose(); this.entries.clear(); for (const old of this.retired.values()) old.source.dispose(); this.retired.clear(); this.retiredBytes = 0; }
}
/** What a pool keeps of the sources no window uses: up to `budget` bytes, counting their geometry and, with
 * `textures`, their textures too. The desktop keeps 48 MB of geometry and whatever textures come with it, so driving
 * back over a street reuses its models; a phone's browser closes a page that holds too much (iOS reloads the tab),
 * and over an 18-window drive the textures alone passed two thousand, so a touch screen keeps 32 MB of the two
 * (setRetainedModels, at boot). */
export const RETAINED_MODELS = { budget: 48 * 1024 * 1024, textures: false };
export function setRetainedModels(budget: number, textures: boolean) { RETAINED_MODELS.budget = budget; RETAINED_MODELS.textures = textures; }
/** Bytes of a model's textures, every mip as decoded (RGBA): what the GPU holds for them, and the decoded copy a
 * retired source keeps for the streaming worker. */
export function modelTextureBytes(textures: readonly ModelTexture[]) {
  let bytes = 0;
  for (const t of textures) for (const m of t.mips) bytes += m.data.byteLength;
  return bytes;
}
/** Bytes of geometry a model's source keeps on the GPU, for the pool's retired budget. */
export function modelGeometryBytes(model: DffModel) {
  let bytes = 0;
  for (const g of model.geometries) for (const a of [g.positions, g.normals, g.colors, g.nightColors, g.indices, ...g.uvs]) bytes += a?.byteLength ?? 0;
  return bytes;
}
/** Bake a static model's frame transforms into its meshes and drop the empty frames. A placement never animates
 * its hierarchy, so the frames only cost the renderer a scene walk: a streamed window keeps about a quarter
 * fewer objects, which shortens both the per-frame matrix update and three.js's render-list build. Skinned models
 * keep their bones. Running it twice is a no-op, so a shared source can be flattened once and reused. */
export function flattenStaticModel(root: THREE.Object3D) {
  let skinned = false; root.traverse(object => { if ((object as THREE.SkinnedMesh).isSkinnedMesh || (object as THREE.Bone).isBone) skinned = true; });
  if (skinned) return 0;
  root.updateMatrixWorld(true);
  const meshes: THREE.Object3D[] = []; root.traverse(object => { if ((object as THREE.Mesh).isMesh) meshes.push(object); });
  if (!meshes.length) return 0;
  const inverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  for (const mesh of meshes) {
    const local = new THREE.Matrix4().copy(mesh.matrixWorld).premultiply(inverse);
    mesh.removeFromParent(); mesh.matrix.copy(local); mesh.matrixAutoUpdate = false; mesh.matrixWorldNeedsUpdate = true; root.add(mesh);
  }
  let dropped = 0;
  for (const child of [...root.children]) if (!(child as THREE.Mesh).isMesh) { dropped++; child.removeFromParent(); }
  root.updateMatrixWorld(true);
  return dropped;
}
export function placedModelObjects(model: DffModel, textures: ModelTexture[], placements: IplInstance[], pool = new TexturePool(), options: { buildingLighting?: BuildingLightingState; worldLighting?:boolean; ambient?:NativeAmbientState; flatten?:boolean } = {}, shared?: { sources: ModelObjectPool; key: string }) {
  const triangles = model.atomics.filter(a => a.flags & 4).reduce((sum, a) => sum + model.geometries[a.geometry].indices.length / 3, 0);
  if (!placements.length || placements.length > 4096 || placements.length * triangles > 2000000 || placements.length * (model.frames.length + model.atomics.length) > 100000) throw new Error('Placement preview exceeds its instance, triangle or hierarchy limit.');
  const source = shared ? shared.sources.acquire(shared.key, () => modelObject(model, textures, undefined, pool, options), modelGeometryBytes(model) + (RETAINED_MODELS.textures ? modelTextureBytes(textures) : 0), model.geometries.length ? { model, textures } : undefined) : modelObject(model, textures, undefined, pool, options), root = new THREE.Group(), skeletons = new Set<THREE.Skeleton>();
  root.matrixAutoUpdate = false;
  let disposed=false;
  const dispose = () => { if(disposed)return;disposed=true;root.removeFromParent();skeletons.forEach(s => s.dispose()); skeletons.clear(); if (shared) shared.sources.release(shared.key); else source.dispose(); };
  try {
   const clonesAt = clock();
   if (options.flatten) flattenStaticModel(source.root);
   for (const placement of placements) {
    modelBuildStats.clones++;
    const instance = cloneSkinned(source.root);
    instance.traverse(object => { if (object instanceof THREE.SkinnedMesh) skeletons.add(object.skeleton); });
    instance.matrixAutoUpdate = false;
    instance.matrix.copy(placementMatrix(placement)); root.add(instance);
   }
   root.updateMatrixWorld(true);
   modelBuildStats.clonesMs += clock() - clonesAt;
   // Validate from the single-model bounds (box math) instead of walking
   // every cloned vertex: identical limits, no per-region vertex traversal.
   assertPlacedBounds(unionPlacedBounds(source.bounds, source.root.matrixWorld, placements));
   } catch(error) { dispose();throw error; }
  // Object hierarchies are separate; mesh geometry, materials and textures are shared.
  return { root, setNight: source.setNight, preRenderUpdate: source.preRenderUpdate, dispose, source };
}
