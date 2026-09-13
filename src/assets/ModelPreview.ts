import type { ScenePart } from './scene';
import type { IplInstance } from './ipl';
import { placementMatrix } from './placement';
import { TexturePool } from './TexturePool';
import type { ModelTexture } from './modelTextures';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { DffModel } from './dff';

// One proper rotation converts GTA Z-up to the runtime's Y-up: (x,y,z) -> (x,z,-y).
export function modelObject(model: DffModel, textures: ModelTexture[] = [], placement?: IplInstance, pool = new TexturePool()) {
  const root = new THREE.Group();
  if (placement) { root.matrixAutoUpdate = false; root.matrix.copy(placementMatrix(placement)); }
  else root.rotation.x = -Math.PI / 2;
  const frames = model.frames.map(frame => { const group = new THREE.Group(); group.name = frame.name; group.matrixAutoUpdate = false; group.matrix.fromArray(frame.matrix); return group; });
  frames.forEach((frame, i) => (model.frames[i].parent < 0 ? root : frames[model.frames[i].parent]).add(frame));
  const maps = new Map(textures.map(t => [t.name.toLowerCase(), { map: pool.acquire(t), source: t, alpha: t.hasAlpha }]));
  const geometries = model.geometries.map(source => {
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(source.positions, 3));
    if (source.normals) geometry.setAttribute('normal', new THREE.BufferAttribute(source.normals, 3));
    source.uvs.forEach((uv, i) => geometry.setAttribute(i ? `uv${i}` : 'uv', new THREE.BufferAttribute(uv, 2)));
    if (source.colors || source.nightColors) geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(source.positions.length / 3 * 4).fill(1), 4));
    const buckets = source.materials.map(() => [] as number[]);
    source.materialIds.forEach((id, triangle) => buckets[id].push(source.indices[triangle * 3], source.indices[triangle * 3 + 1], source.indices[triangle * 3 + 2]));
    const indices = new Uint32Array(source.indices.length); let offset = 0;
    buckets.forEach((bucket, material) => { indices.set(bucket, offset); if (bucket.length) geometry.addGroup(offset, bucket.length, material); offset += bucket.length; });
    geometry.setIndex(new THREE.BufferAttribute(indices, 1)); if (!source.normals) geometry.computeVertexNormals();
    const vertexAlpha = [source.colors, source.nightColors].some(colors => colors?.some((value, i) => i % 4 === 3 && value < 255));
    const materials = source.materials.map(m => {
      const texture = source.uvs.length ? maps.get(m.texture.toLowerCase()) : undefined;
      return new THREE.MeshBasicMaterial({
      map: texture?.map ?? null, alphaTest: texture?.alpha ? 1 / 255 : 0,
      color: source.flags & 64 ? new THREE.Color().setRGB(m.color[0] / 255, m.color[1] / 255, m.color[2] / 255) : 0xffffff,
      opacity: m.color[3] / 255, transparent: m.color[3] < 255 || vertexAlpha || !!texture?.alpha,
      depthWrite: !(m.color[3] < 255 || vertexAlpha || texture?.alpha),
      vertexColors: !!(source.colors || source.nightColors), side: THREE.FrontSide,
    }); });
    return { geometry, materials, source };
  });
  model.atomics.forEach(atomic => {
    if (!(atomic.flags & 4)) return;
    const { geometry, materials } = geometries[atomic.geometry]; frames[atomic.frame].add(new THREE.Mesh(geometry, materials));
  });
  const setNight = (amount: number) => {
    geometries.forEach(({ geometry, source }) => {
      const color = geometry.getAttribute('color'); if (!color) return;
      for (let i = 0; i < color.array.length; i++) {
        const day = source.colors?.[i] ?? 255, night = source.nightColors?.[i] ?? day;
        color.array[i] = (day + (night - day) * amount) / 255;
      }
      color.needsUpdate = true;
    });
  };
  setNight(0); root.updateMatrixWorld(true);
  let disposed = false;
  const dispose = () => { if (disposed) return; disposed = true; geometries.forEach(g => { g.geometry.dispose(); g.materials.forEach(m => m.dispose()); }); maps.forEach(t => pool.release(t.source)); };
  const bounds = new THREE.Box3().setFromObject(root);
  if (!bounds.isEmpty() && [...bounds.min.toArray(), ...bounds.max.toArray()].some(v => !Number.isFinite(v) || Math.abs(v) > 1e7)) {
    dispose(); throw new Error('Model world bounds exceed the preview coordinate limit.');
  }
  return { root, setNight, dispose };
}
export function placedModelObjects(model: DffModel, textures: ModelTexture[], placements: IplInstance[], pool = new TexturePool()) {
  const triangles = model.atomics.filter(a => a.flags & 4).reduce((sum, a) => sum + model.geometries[a.geometry].indices.length / 3, 0);
  if (!placements.length || placements.length > 4096 || placements.length * triangles > 2000000 || placements.length * (model.frames.length + model.atomics.length) > 100000) throw new Error('Placement preview exceeds its instance, triangle or hierarchy limit.');
  const source = modelObject(model, textures, undefined, pool), root = new THREE.Group();
  for (const placement of placements) {
    const instance = source.root.clone(true); instance.matrixAutoUpdate = false;
    instance.matrix.copy(placementMatrix(placement)); root.add(instance);
  }
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  if (!bounds.isEmpty() && [...bounds.min.toArray(), ...bounds.max.toArray()].some(v => !Number.isFinite(v) || Math.abs(v) > 1e7)) { source.dispose(); throw new Error('Placed model bounds exceed the coordinate limit.'); }
  // Object hierarchies are separate; mesh geometry, materials and textures are shared.
  return { root, setNight: source.setNight, dispose: source.dispose };
}
export class ModelPreview {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(45, 1, 0.01, 10000);
  private controls: OrbitControls;
  private current: ReturnType<typeof modelObject> | null = null;
  private observer: ResizeObserver;
  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true }); this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    // Unlit raw vertex-color inspection, not an attempt to reproduce the game's complete pipeline.
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace; this.renderer.setClearColor(0x202720);
    this.controls = new OrbitControls(this.camera, canvas); this.controls.enableDamping = false;
    this.controls.addEventListener('change', this.draw);
    this.observer = new ResizeObserver(() => {
      const { width, height } = canvas.getBoundingClientRect(); this.renderer.setSize(width, height, false); this.camera.aspect = width / Math.max(1, height); this.camera.updateProjectionMatrix(); this.draw();
    }); this.observer.observe(canvas);
  }
  load(model: DffModel, textures: ModelTexture[] = [], placements?: IplInstance[]) {
    this.clear(); this.current = placements ? placedModelObjects(model, textures, placements) : modelObject(model, textures); this.scene.add(this.current.root); this.frame();
  }
  loadScene(parts: ScenePart[]) {
    this.clear(); const pool = new TexturePool(), root = new THREE.Group(), owners: ReturnType<typeof placedModelObjects>[] = [];
    try {
      for (const part of parts) { const object = placedModelObjects(part.model, part.textures, part.placements, pool); owners.push(object); root.add(object.root); }
      this.current = { root, setNight: amount => owners.forEach(o => o.setNight(amount)), dispose: () => owners.forEach(o => o.dispose()) };
      this.scene.add(root); this.frame();
    } catch (error) { owners.forEach(o => o.dispose()); throw error; }
  }
  frame() {
    if (!this.current) return;
    this.current.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.current.root); if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3()), radius = Math.max(0.1, box.getSize(new THREE.Vector3()).length() / 2);
    const distance = radius / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2)) * Math.max(1, 1 / this.camera.aspect) * 1.15;
    this.controls.target.copy(center); this.camera.position.copy(center).add(new THREE.Vector3(1, 0.65, 1).normalize().multiplyScalar(distance));
    this.camera.near = Math.max(0.001, radius / 1000); this.camera.far = Math.max(100, distance + radius * 100); this.camera.updateProjectionMatrix();
    this.controls.minDistance = radius * 0.02; this.controls.maxDistance = distance * 10; this.controls.update(); this.draw();
  }
  night(amount: number) { this.current?.setNight(amount); this.draw(); }
  clear() { if (this.current) { this.scene.remove(this.current.root); this.current.dispose(); this.current = null; } this.draw(); }
  snapshot() { return { camera: this.camera.position.toArray(), target: this.controls.target.toArray(), bounds: this.current ? new THREE.Box3().setFromObject(this.current.root) : null, memory: { ...this.renderer.info.memory }, draws: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles }; }
  private draw = () => this.renderer.render(this.scene, this.camera);
  dispose() { this.observer.disconnect(); this.controls.dispose(); this.clear(); this.renderer.dispose(); }
}
