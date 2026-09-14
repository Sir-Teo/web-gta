import {nativeRasterOutput} from './nativeRasterOutput';
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
import { buildingMaterial, BUILDING_DN_PIPELINE, isBuildingPipeline, type BuildingLightingState } from './buildingMaterial';

/** Generic material instances and their immutable import provenance; specialized building variants are separate. */
export interface ModelMaterialBinding {material:THREE.MeshBasicMaterial|THREE.MeshLambertMaterial;source:ModelMaterial;geometryFlags:number;texture?:ModelTexture}

// One proper rotation converts GTA Z-up to the runtime's Y-up: (x,y,z) -> (x,z,-y).
export function modelObject(model: DffModel, textures: ModelTexture[] = [], placement?: IplInstance, pool = new TexturePool(), options: { worldLighting?: boolean; ambient?: NativeAmbientState; buildingLighting?: BuildingLightingState } = {}) {
  const materialBindings:ModelMaterialBinding[]=[];
  const palettes = model.geometries.map(g => g.skin ? skinFrames(model, g.skin.boneCount) : undefined);
  const cpuPrelight = new Set(model.atomics.filter(a => (a.flags & 4) &&
    !(options.buildingLighting && !model.geometries[a.geometry].skin && isBuildingPipeline(a.pipeline))).map(a => a.geometry));
  const skeletons: THREE.Skeleton[] = [];
  const root = new THREE.Group();
  if (placement) { root.matrixAutoUpdate = false; root.matrix.copy(placementMatrix(placement)); }
  else root.rotation.x = -Math.PI / 2;
  const frames = model.frames.map((frame, index) => { const group = frame.hanim ? new THREE.Bone() : new THREE.Group(); group.name = frame.name; group.userData.nativeFrame = index; group.matrixAutoUpdate = false; group.matrix.fromArray(frame.matrix); return group; });
  frames.forEach((frame, i) => (model.frames[i].parent < 0 ? root : frames[model.frames[i].parent]).add(frame));
  const acquired:ModelTexture[]=[], ownedGeometries=new Set<THREE.BufferGeometry>(), ownedMaterials=new Set<THREE.Material>();
  let disposed=false;
  const dispose=()=>{if(disposed)return;disposed=true;root.removeFromParent();skeletons.forEach(s=>s.dispose());ownedGeometries.forEach(g=>g.dispose());ownedMaterials.forEach(m=>m.dispose());acquired.forEach(t=>pool.release(t));};
  try {
  const maps = new Map(textures.map(t => {const map=pool.acquire(t);acquired.push(t);return [t.name.toLowerCase(), { map, source: t, alpha: t.hasAlpha }] as const;}));
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
    if (cpuPrelight.has(geometryIndex) && (source.colors || source.nightColors)) geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(source.positions.length / 3 * 4).fill(1), 4));
    // Native BinMesh data already supplies the index order and draw spans.
    // Only models without it need triangles regrouped by material.
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
    spans.forEach((mesh, slot) => { if (mesh.count) geometry.addGroup(mesh.start,mesh.count,slot); });
    geometry.setIndex(new THREE.BufferAttribute(indices, 1)); if (!source.normals) geometry.computeVertexNormals();
    const vertexAlpha = [source.colors, source.nightColors].some(colors => colors?.some((value, i) => i % 4 === 3 && value < 255));
    const materials = source.materials.map(m => {
      const texture = source.uvs.length ? maps.get(m.texture.toLowerCase()) : undefined;
      const parameters = {
      map: texture?.map ?? null, alphaTest: texture?.alpha ? 1 / 255 : 0,
      color: source.flags & 64 ? new THREE.Color().setRGB(m.color[0] / 255, m.color[1] / 255, m.color[2] / 255) : 0xffffff,
      opacity: m.color[3] / 255, transparent: m.color[3] < 255 || vertexAlpha || !!texture?.alpha,
      depthWrite: !(m.color[3] < 255 || vertexAlpha || texture?.alpha),
      vertexColors: !!(source.colors || source.nightColors), side: THREE.FrontSide,
    };
      const material = options.worldLighting && source.flags & 0x20 ? nativeLitMaterial(parameters, source.flags & 0x10 ? m.surface : [m.surface[0],m.surface[1],0], options.ambient) : nativeRasterOutput(new THREE.MeshBasicMaterial(parameters));
      ownedMaterials.add(material);
      materialBindings.push({material,source:m,geometryFlags:source.flags,texture:texture?.source});
      material.userData.nativeFadeColor = m.color.slice(0, 3).map(value => value / 255);
      material.userData.nativeTextureAlpha = !!texture?.alpha;
      return material;
    });
    const drawSpans = spans;
    return { geometry, materials, drawMaterials: drawSpans.map(span => materials[span.material]), source, spans: drawSpans, building: new Map<number, THREE.MeshBasicMaterial[]>() };
  });
  model.atomics.forEach((atomic, atomicIndex) => {
    if (!(atomic.flags & 4)) return;
    const record = geometries[atomic.geometry], { geometry, source } = record;
    let materials = record.drawMaterials;
    if (options.buildingLighting && !source.skin && isBuildingPipeline(atomic.pipeline)) {
      if (!geometry.hasAttribute('nativeDay')) {
        geometry.setAttribute('nativeDay', new THREE.BufferAttribute(source.colors ?? new Uint8Array(source.positions.length / 3 * 4).fill(255), 4, true));
        geometry.setAttribute('nativeNight', new THREE.BufferAttribute(source.nightColors ?? source.colors ?? new Uint8Array(source.positions.length / 3 * 4).fill(255), 4, true));
      }
      let selected = record.building.get(atomic.pipeline!);
      if (!selected) {
        const dayNight = atomic.pipeline === BUILDING_DN_PIPELINE;
        const vertexAlpha = materialVertexAlpha([source.colors, ...(dayNight ? [source.nightColors] : [])], record.spans);
        selected = record.drawMaterials.map((material,i) => {const result=buildingMaterial(material as THREE.MeshBasicMaterial, source.materials[record.spans[i].material].surface[0], options.buildingLighting!, dayNight, vertexAlpha[i]);ownedMaterials.add(result);return result;}); record.building.set(atomic.pipeline!,selected);
      }
      materials = selected;
    }
    if (source.skin) {
      const inverses = Array.from({ length: source.skin.boneCount }, (_, i) => new THREE.Matrix4().fromArray(source.skin!.inverseMatrices, i * 16));
      const skeleton = new THREE.Skeleton(palettes[atomic.geometry]!.map(i => frames[i] as THREE.Bone), inverses);
      skeletons.push(skeleton);
      const mesh = new THREE.SkinnedMesh(geometry, materials); mesh.normalizeSkinWeights();
      mesh.userData.nativeAtomic = atomicIndex; mesh.userData.nativePipeline = atomic.pipeline;
      frames[atomic.frame].add(mesh); mesh.bind(skeleton, new THREE.Matrix4());
    } else { const mesh = new THREE.Mesh(geometry, materials); mesh.userData.nativeAtomic = atomicIndex; mesh.userData.nativePipeline = atomic.pipeline; frames[atomic.frame].add(mesh); }
  });
  let lastNight: number | undefined;
  const setNight = (amount: number) => {
    if (!Number.isFinite(amount)) throw new Error('Night prelight amount must be finite.');
    amount = THREE.MathUtils.clamp(amount, 0, 1);
    if (amount === lastNight) return;
    const initializing = lastNight === undefined; lastNight = amount;
    geometries.forEach(({ geometry, source }) => {
      if (!initializing && !source.nightColors) return;
      const color = geometry.getAttribute('color'); if (!color) return;
      for (let i = 0; i < color.array.length; i++) {
        const day = source.colors?.[i] ?? 255, night = source.nightColors?.[i] ?? day;
        color.array[i] = (day + (night - day) * amount) / 255;
      }
      color.needsUpdate = true;
    });
  };
  setNight(0); root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  if (!bounds.isEmpty() && [...bounds.min.toArray(), ...bounds.max.toArray()].some(v => !Number.isFinite(v) || Math.abs(v) > 1e7)) {
    dispose(); throw new Error('Model world bounds exceed the preview coordinate limit.');
  }
  return { root, setNight, dispose, materialBindings };
  }catch(error){dispose();throw error;}
}
export function placedModelObjects(model: DffModel, textures: ModelTexture[], placements: IplInstance[], pool = new TexturePool(), options: { buildingLighting?: BuildingLightingState; worldLighting?:boolean; ambient?:NativeAmbientState } = {}) {
  const triangles = model.atomics.filter(a => a.flags & 4).reduce((sum, a) => sum + model.geometries[a.geometry].indices.length / 3, 0);
  if (!placements.length || placements.length > 4096 || placements.length * triangles > 2000000 || placements.length * (model.frames.length + model.atomics.length) > 100000) throw new Error('Placement preview exceeds its instance, triangle or hierarchy limit.');
  const source = modelObject(model, textures, undefined, pool, options), root = new THREE.Group(), skeletons = new Set<THREE.Skeleton>();
  let disposed=false;
  const dispose = () => { if(disposed)return;disposed=true;root.removeFromParent();skeletons.forEach(s => s.dispose()); skeletons.clear(); source.dispose(); };
  try {
   for (const placement of placements) {
    const instance = cloneSkinned(source.root);
    instance.traverse(object => { if (object instanceof THREE.SkinnedMesh) skeletons.add(object.skeleton); });
    instance.matrixAutoUpdate = false;
    instance.matrix.copy(placementMatrix(placement)); root.add(instance);
   }
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  if (!bounds.isEmpty() && [...bounds.min.toArray(), ...bounds.max.toArray()].some(v => !Number.isFinite(v) || Math.abs(v) > 1e7)) throw new Error('Placed model bounds exceed the coordinate limit.');
  } catch(error) { dispose();throw error; }
  // Object hierarchies are separate; mesh geometry, materials and textures are shared.
  return { root, setNight: source.setNight, dispose };
}
