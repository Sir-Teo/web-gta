import {applyWindowedCameraProjection, GAME_CAMERA_FOV} from './cameraProjection';
import { NativeCharacter, type CharacterSource } from './NativeCharacter';
import * as THREE from 'three';
import { DEATH_RECOVERY_SECONDS } from '../simulation/health';
import { cameraNominalDistance, nextCameraMode, readCameraSettings, saveCameraSettings } from './cameraSettings';
import { cameraGlance, coronaLookMask, glanceOrientation, type CameraGlance } from './cameraLook';
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
  readonly camera = new THREE.PerspectiveCamera(GAME_CAMERA_FOV, 1, 0.08, 650);
  readonly protagonist = new CharacterVisual();
  nativeCharacter?: NativeCharacter;
  beforeRender?: (camera: THREE.PerspectiveCamera) => void;
  installCharacter(source: CharacterSource) {
    const character = new NativeCharacter(source);
    this.nativeCharacter?.dispose(); this.nativeCharacter = character; this.scene.add(character.root);
  }
  readonly cars: VehicleVisual[];
  readonly crowd: CrowdVisual;
  yaw = 0.15;
  pitch = 0.22;
  viewYaw = this.yaw;
  viewPitch = this.pitch;
  glance: CameraGlance = 'none';
  readonly cameraSettings = readCameraSettings();
  private distance = 5.0;
  private boomLength = 5.0;
  private crouchAmount = 0;
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
    const environment = sim.imported ? { streetLamps: [], litWindows: [] } : buildEnvironment(this.scene);
    this.lighting = new WorldLighting(this.scene, environment.streetLamps, environment.litWindows);
    this.lighting.sunObstructed=(sun,camera)=>this.sim.sunObstructed(sun,camera);
    this.scene.add(this.protagonist.root);
    this.cars = sim.vehicles.map(v => { const visual = new VehicleVisual(v); this.scene.add(visual.root); return visual; });
    this.crowd = new CrowdVisual(sim.population); this.scene.add(this.crowd.root);
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(canvas); this.resize();
  }
  get distanceMode() { return this.cameraSettings[this.sim.activeVehicle ? 'vehicle' : 'foot']; }
  get followDistance() { return this.distance; }
  cycleCameraDistance() {
    const key = this.sim.activeVehicle ? 'vehicle' : 'foot';
    this.cameraSettings[key] = nextCameraMode(this.cameraSettings[key]);
    saveCameraSettings(this.cameraSettings);
    return this.cameraSettings[key];
  }
  resize() {
    const w = Math.max(1, this.canvas.clientWidth), h = Math.max(1, this.canvas.clientHeight);
    this.renderer.setSize(w, h, false); applyWindowedCameraProjection(this.camera,w,h,GAME_CAMERA_FOV);
  }
  update(dt: number, alpha: number, input: Input, elapsed: number, paused=false) {
    const p = this.sim.player, inCar = !!this.sim.activeVehicle;
    this.protagonist.root.visible = true;
    this.protagonist.root.position.set(THREE.MathUtils.lerp(p.previous.x, p.position.x, alpha), THREE.MathUtils.lerp(p.previous.y, p.position.y, alpha), THREE.MathUtils.lerp(p.previous.z, p.position.z, alpha));
    this.protagonist.root.rotation.set(0, p.heading, 0);
    this.protagonist.animate(p.phase, p.speed, p.grounded, elapsed);
    this.crouchAmount = damp(this.crouchAmount, p.crouched ? 1 : 0, 14, dt);
    this.protagonist.poseCrouched(this.crouchAmount, p.phase, p.speed);
    this.protagonist.poseSeated(this.sim.seated, this.sim.transition?.phase === 'opening' ? 0.8 : 0);
    this.protagonist.poseImpact(p.health > 0 ? Math.max(0, Math.min(1, (0.6 - this.sim.impactRemaining) / 0.08, this.sim.impactRemaining / 0.3)) : 0);
    this.protagonist.poseDead(p.health <= 0 ? Math.min(1, (DEATH_RECOVERY_SECONDS - this.sim.deathRemaining) / 0.7) : 0);
    this.nativeCharacter?.update(this.sim, alpha);
    this.protagonist.root.visible = !this.nativeCharacter?.root.visible;
    const night = sampleTimecycle(this.sim.timeMinutes).night;
    this.nativeCharacter?.setNight(night);
    this.cars.forEach(c => c.update(alpha, night, c.vehicle === this.sim.activeVehicle));
    this.crowd.update(alpha, elapsed);
    if (inCar && !this.sim.transition) {
      const car = this.cars.find(c => c.vehicle === this.sim.activeVehicle)!;
      this.protagonist.root.position.copy(car.root.position).add(new THREE.Vector3(0.42, -0.78, 0.05).applyQuaternion(car.root.quaternion));
      this.protagonist.root.quaternion.copy(car.root.quaternion);
    }
    const previousGlance = this.glance;
    this.glance = cameraGlance(inCar, input.down('KeyQ'), input.down('KeyE'),
      input.down('MouseMiddle') || !inCar && input.down('Numpad1'));
    if (this.glance !== 'none' || previousGlance !== 'none') this.lastLook = elapsed;
    if (this.glance !== 'none') {
      input.lookX = input.lookY = 0;
    } else if (input.lookX || input.lookY) {
      this.yaw -= input.lookX * 0.003;
      this.pitch = clamp(this.pitch + input.lookY * 0.002, -0.18, 1.05);
      this.lastLook = elapsed;
      input.lookX = input.lookY = 0;
    } else if (inCar && p.speed > 1.5 && elapsed - this.lastLook > 1.6) {
      this.yaw += angleDelta(this.yaw, p.heading + Math.PI) * (1 - Math.exp(-2.0 * dt));
      this.pitch = damp(this.pitch, 0.2, 1.2, dt);
    }
    const orientation = glanceOrientation(this.glance, this.yaw, this.pitch, inCar ? p.heading : undefined);
    this.viewYaw = orientation.yaw; this.viewPitch = orientation.pitch;
    const carCenter = this.sim.activeVehicle?.body.translation();
    const desired = carCenter ? new THREE.Vector3(carCenter.x, carCenter.y + 0.6, carCenter.z)
      : new THREE.Vector3(p.position.x, p.position.y + (p.health <= 0 ? 0.45 : 1.3 - 0.5 * this.crouchAmount), p.position.z);
    if (!this.cameraReady || this.target.distanceTo(desired) > 25) { this.target.copy(desired); this.cameraReady = true; }
    this.target.lerp(desired, 1 - Math.exp(-12 * dt));
    const nominal = cameraNominalDistance(this.distanceMode, inCar, p.speed);
    this.boomLength = damp(this.boomLength, nominal, 5, dt);
    const direction = new THREE.Vector3(Math.sin(this.viewYaw) * Math.cos(this.viewPitch), Math.sin(this.viewPitch), Math.cos(this.viewYaw) * Math.cos(this.viewPitch));
    const allowed = this.sim.cameraDistance(this.target, direction, this.boomLength);
    this.distance = allowed < this.distance ? allowed : damp(this.distance, allowed, 5, dt);
    this.camera.position.copy(this.target).addScaledVector(direction, this.distance);
    this.camera.lookAt(this.target);
    this.lighting.update(this.sim.timeMinutes, p.position, this.camera,dt,coronaLookMask(this.glance),GAME_CAMERA_FOV,!paused);
    this.beforeRender?.(this.camera);
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.nativeCharacter?.dispose();
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
