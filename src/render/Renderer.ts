import * as THREE from 'three';
import { sampleTimecycle } from '../world/timecycle';
import { WorldLighting } from './WorldLighting';
import { buildEnvironment } from './environment';
import { CharacterVisual } from './character';
import { CrowdVisual } from './CrowdVisual';
import { VehicleVisual } from './vehicle';
import type { Simulation } from '../simulation/Simulation';
import type { Input } from '../input/Input';
import { angleDelta, clamp, damp } from '../core/math';

export class GameRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(55, 1, 0.08, 650);
  readonly protagonist = new CharacterVisual();
  readonly cars: VehicleVisual[];
  readonly crowd: CrowdVisual;
  yaw = 0.15;
  pitch = 0.22;
  private distance = 5.0;
  private target = new THREE.Vector3();
  private cameraReady = false;
  private lastLook = 0;
  readonly lighting: WorldLighting;
  private observer: ResizeObserver;
  constructor(readonly canvas: HTMLCanvasElement, readonly sim: Simulation) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    const environment = buildEnvironment(this.scene);
    this.lighting = new WorldLighting(this.scene, environment.streetLamps, environment.litWindows);
    this.scene.add(this.protagonist.root);
    this.cars = sim.vehicles.map(v => { const visual = new VehicleVisual(v); this.scene.add(visual.root); return visual; });
    this.crowd = new CrowdVisual(sim.population); this.scene.add(this.crowd.root);
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(canvas); this.resize();
  }
  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / Math.max(h, 1); this.camera.updateProjectionMatrix();
  }
  update(dt: number, alpha: number, input: Input, elapsed: number) {
    const p = this.sim.player, inCar = !!this.sim.activeVehicle;
    this.protagonist.root.visible = true;
    this.protagonist.root.position.set(THREE.MathUtils.lerp(p.previous.x, p.position.x, alpha), THREE.MathUtils.lerp(p.previous.y, p.position.y, alpha), THREE.MathUtils.lerp(p.previous.z, p.position.z, alpha));
    this.protagonist.root.rotation.set(0, p.heading, 0);
    this.protagonist.animate(p.phase, p.speed, p.grounded, elapsed);
    this.protagonist.poseSeated(this.sim.seated, this.sim.transition?.phase === 'opening' ? 0.8 : 0);
    const night = sampleTimecycle(this.sim.timeMinutes).night;
    this.cars.forEach(c => c.update(alpha, night, c.vehicle === this.sim.activeVehicle));
    this.crowd.update(alpha, elapsed);
    if (inCar && !this.sim.transition) {
      const car = this.cars.find(c => c.vehicle === this.sim.activeVehicle)!;
      this.protagonist.root.position.copy(car.root.position).add(new THREE.Vector3(0.42, -0.78, 0.05).applyQuaternion(car.root.quaternion));
      this.protagonist.root.quaternion.copy(car.root.quaternion);
    }
    if (input.lookX || input.lookY) {
      this.yaw -= input.lookX * 0.003;
      this.pitch = clamp(this.pitch + input.lookY * 0.002, -0.18, 1.05);
      this.lastLook = elapsed;
      input.lookX = input.lookY = 0;
    } else if (inCar && p.speed > 1.5 && elapsed - this.lastLook > 1.6) {
      this.yaw += angleDelta(this.yaw, p.heading + Math.PI) * (1 - Math.exp(-2.0 * dt));
      this.pitch = damp(this.pitch, 0.2, 1.2, dt);
    }
    const carCenter = this.sim.activeVehicle?.body.translation();
    const desired = carCenter ? new THREE.Vector3(carCenter.x, carCenter.y + 0.6, carCenter.z)
      : new THREE.Vector3(p.position.x, p.position.y + 1.3, p.position.z);
    if (!this.cameraReady || this.target.distanceTo(desired) > 25) { this.target.copy(desired); this.cameraReady = true; }
    this.target.lerp(desired, 1 - Math.exp(-12 * dt));
    const nominal = inCar ? 7.2 + Math.min(p.speed * 0.035, 1) : 4.8;
    const direction = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    const allowed = this.sim.cameraDistance(this.target, direction, nominal);
    this.distance = allowed < this.distance ? allowed : damp(this.distance, allowed, 5, dt);
    this.camera.position.copy(this.target).addScaledVector(direction, this.distance);
    this.camera.lookAt(this.target);
    this.lighting.update(this.sim.timeMinutes, p.position, this.camera);
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.observer.disconnect(); this.lighting.dispose(); this.cars.forEach(car => car.dispose());
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
    this.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      if (object instanceof THREE.InstancedMesh) object.dispose();
      for (const m of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(m);
        for (const value of Object.values(m)) if (value instanceof THREE.Texture) textures.add(value);
      }
    });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
    this.renderer.dispose();
  }
}
