import type { RootMotionPolicy } from '../animation/rootMotion';
import { bindAnimation } from '../animation/bind';
import type { NativeAnimation } from './ifp';
import { collisionOverlay } from './CollisionOverlay';
import type { ColModel } from './col';
import type { ScenePart } from './scene';
import type { SceneRegion } from './sceneRegion';
import type { IplInstance } from './ipl';
import { modelObject, placedModelObjects } from './ModelObjects';
export { modelObject, placedModelObjects } from './ModelObjects';
import { TexturePool } from './TexturePool';
import type { ModelTexture } from './modelTextures';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { DffModel } from './dff';
import {sceneVisibility} from '../render/sceneVisibility';
import {bindPlayerShoulders} from '../animation/playerShoulders';

export class ModelPreview {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(45, 1, 0.01, 10000);
  private controls: OrbitControls;
  private animationModel?: DffModel;
  private animationTextures: ModelTexture[] = [];
  private playerShoulders?:ReturnType<typeof bindPlayerShoulders>;
  characterSource(clip: NativeAnimation, track: number) {
    if (!this.animationModel) throw new Error("Load one unplaced model first.");
    return { model: this.animationModel, textures: this.animationTextures, clip, track, ...(this.playerShoulders?{playerBody:true as const}:{}) };
  }
  private animation?: ReturnType<typeof bindAnimation>;
  private current: ReturnType<typeof modelObject> | null = null;
  private sceneParts?:ScenePart[];
  private sceneRoots:THREE.Object3D[]=[];
  private visibility?:ReturnType<typeof sceneVisibility>;
  private rawVisibility=new Map<THREE.Object3D,boolean>();
  private overlays: ReturnType<typeof collisionOverlay>[] = [];
  private collisionVisible = true;
  private overlayLines = 0;
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
  load(model: DffModel, textures: ModelTexture[] = [], placements?: IplInstance[], collision?: ColModel,playerBody=false) {
    this.clear(); this.current = placements ? placedModelObjects(model, textures, placements) : modelObject(model, textures); this.animationModel = placements ? undefined : model; this.animationTextures = textures; this.scene.add(this.current.root); if (collision) this.addCollision(collision, placements); this.frame();
    if(playerBody){this.playerShoulders=bindPlayerShoulders(model,this.current.root);this.draw();}
  }
  loadScene(parts: ScenePart[], region?:SceneRegion) {
    this.clear(); const pool = new TexturePool(), root = new THREE.Group(), owners: ReturnType<typeof placedModelObjects>[] = [];
    try {
      for (const part of parts) { const object = placedModelObjects(part.model, part.textures, part.placements, pool); owners.push(object); root.add(object.root); if (part.collision) this.addCollision(part.collision, part.placements); }
      this.current = { root, setNight: amount => owners.forEach(o => o.setNight(amount)), dispose: () => owners.forEach(o => o.dispose()) };
      this.sceneParts=parts;this.sceneRoots=owners.map(owner=>owner.root);
      this.scene.add(root); this.frame(region);
    } catch (error) { owners.forEach(o => o.dispose()); this.clear(); throw error; }
  }
  private addCollision(model: ColModel, placements?: IplInstance[]) { const lines = (model.spheres.length * 500 + model.boxes.length * 12 + model.mesh.indices.length) * (placements?.length ?? 1); if (this.overlayLines + lines > 2000000) throw new Error('Scene collision overlays exceed the line limit.'); this.overlayLines += lines; const overlay = collisionOverlay(model, placements); overlay.root.visible = this.collisionVisible; this.overlays.push(overlay); this.scene.add(overlay.root); }
  showCollision(visible: boolean) { this.collisionVisible = visible; this.overlays.forEach(o => { o.root.visible = visible; }); this.draw(); }
  setLodVisibility(enabled:boolean) {
    if(enabled===!!this.visibility)return;
    if(enabled){
      if(!this.sceneParts)throw new Error('Assemble a scene before previewing LOD visibility.');
      this.rawVisibility=new Map(this.sceneRoots.flatMap(root=>root.children.map(object=>[object,object.visible] as const)));
      this.visibility=sceneVisibility(this.sceneParts,this.sceneRoots);
    }else{
      this.visibility?.dispose();this.visibility=undefined;
      for(const [object,visible] of this.rawVisibility)object.visible=visible;
      this.rawVisibility.clear();
    }
    this.draw();
  }
  frame(region?:SceneRegion) {
    if (!this.current) return;
    this.current.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.current.root); this.overlays.filter(o => o.root.visible).forEach(o => box.union(new THREE.Box3().setFromObject(o.root))); if (box.isEmpty()) return;
    if(region){
      const selected=box.clone().intersect(new THREE.Box3(
        new THREE.Vector3(region.x-region.radius,box.min.y,-region.y-region.radius),
        new THREE.Vector3(region.x+region.radius,box.max.y,-region.y+region.radius)));
      if(!selected.isEmpty())box.copy(selected);
    }
    const center = box.getCenter(new THREE.Vector3()), radius = Math.max(0.1, box.getSize(new THREE.Vector3()).length() / 2);
    const distance = radius / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2)) * Math.max(1, 1 / this.camera.aspect) * 1.15;
    this.controls.target.copy(center); this.camera.position.copy(center).add(new THREE.Vector3(1, 0.65, 1).normalize().multiplyScalar(distance));
    this.camera.near = Math.max(0.001, radius / 1000); this.camera.far = Math.max(100, distance + radius * 100); this.camera.updateProjectionMatrix();
    this.controls.minDistance = radius * 0.02; this.controls.maxDistance = distance * 10; this.controls.update(); this.draw();
  }
  loadAnimation(clip: NativeAnimation, motion?: RootMotionPolicy) {
    if (!this.current || !this.animationModel) throw new Error('Load one unplaced model before selecting an animation.');
    const binding = bindAnimation(this.animationModel, this.current.root, clip, motion);
    this.animation?.restore(); this.animation = binding; binding.sample(0, false); this.draw();
    return { duration: binding.duration, trackCount: binding.trackCount };
  }
  sampleAnimation(seconds: number) { this.animation?.sample(seconds, false); this.draw(); }
  restoreAnimation() { this.animation?.restore(); this.animation = undefined; this.draw(); }
  night(amount: number) { this.current?.setNight(amount); this.draw(); }
  clear() { this.playerShoulders=undefined;this.visibility?.dispose();this.visibility=undefined;this.rawVisibility.clear();this.sceneParts=undefined;this.sceneRoots=[];this.animationTextures = []; this.animation = undefined; this.animationModel = undefined; this.overlays.forEach(o => { this.scene.remove(o.root); o.dispose(); }); this.overlays = []; this.overlayLines = 0; if (this.current) { this.scene.remove(this.current.root); this.current.dispose(); this.current = null; } this.draw(); }
  snapshot() { return { playerBody:!!this.playerShoulders,lod:{enabled:!!this.visibility,visible:this.visibility?.count??this.sceneParts?.reduce((n,p)=>n+p.placements.length,0)??0,models:this.visibility?.models()},camera: this.camera.position.toArray(), target: this.controls.target.toArray(), bounds: this.current ? new THREE.Box3().setFromObject(this.current.root) : null, memory: { ...this.renderer.info.memory }, collisionOverlays: this.overlays.length, lines: this.renderer.info.render.lines, draws: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles }; }
  private draw = () => {this.playerShoulders?.update();this.visibility?.update(this.camera);this.renderer.render(this.scene, this.camera);};
  dispose() { this.observer.disconnect(); this.controls.dispose(); this.clear(); this.renderer.dispose(); }
}
