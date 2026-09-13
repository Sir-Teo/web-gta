import * as THREE from 'three';
import { buildEnvironment } from './environment';
import { CharacterVisual } from './character';
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
  yaw = 0.15;
  pitch = 0.22;
  private distance = 5.0;
  private target = new THREE.Vector3();
  private cameraReady = false;
  private lastLook = 0;
  private sun: THREE.DirectionalLight;
  private observer: ResizeObserver;
  constructor(readonly canvas: HTMLCanvasElement, readonly sim: Simulation) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene.background = new THREE.Color(0xc3bd9d);
    this.scene.fog = new THREE.FogExp2(0xc3bd9d, 0.0042);
    const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 24, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { topColor: { value: new THREE.Color(0x79a7ad) }, bottomColor: { value: new THREE.Color(0xe8c598) } },
      vertexShader: 'varying vec3 vPosition; void main() { vPosition = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform vec3 topColor; uniform vec3 bottomColor; varying vec3 vPosition;
        void main() { float h = normalize(vPosition).y; vec3 color = mix(bottomColor, topColor, smoothstep(-0.03, 0.38, h));
        gl_FragColor = vec4(color, 1.0);\n #include <tonemapping_fragment>\n #include <colorspace_fragment>\n }`,
    }));
    this.scene.add(sky);
    this.scene.add(new THREE.HemisphereLight(0xd8dcce, 0x777259, 2.0));
    this.sun = new THREE.DirectionalLight(0xffd2a0, 2.3);
    this.sun.position.set(-65, 55, 35); this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 0.5, far: 180 });
    this.sun.shadow.normalBias = 0.025; this.sun.shadow.bias = -0.00008;
    this.scene.add(this.sun, this.sun.target);
    buildEnvironment(this.scene);
    this.scene.add(this.protagonist.root);
    this.cars = sim.vehicles.map(v => { const visual = new VehicleVisual(v); this.scene.add(visual.root); return visual; });
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(canvas); this.resize();
  }
  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / Math.max(h, 1); this.camera.updateProjectionMatrix();
  }
  update(dt: number, alpha: number, input: Input, elapsed: number) {
    const p = this.sim.player, inCar = !!this.sim.activeVehicle;
    this.protagonist.root.visible = !inCar;
    this.protagonist.root.position.set(THREE.MathUtils.lerp(p.previous.x, p.position.x, alpha), THREE.MathUtils.lerp(p.previous.y, p.position.y, alpha), THREE.MathUtils.lerp(p.previous.z, p.position.z, alpha));
    this.protagonist.root.rotation.y = p.heading;
    this.protagonist.animate(p.phase, p.speed, p.grounded, elapsed);
    this.cars.forEach(c => c.update(alpha));
    if (input.lookX || input.lookY) {
      this.yaw -= input.lookX * 0.003;
      this.pitch = clamp(this.pitch + input.lookY * 0.002, -0.18, 1.05);
      this.lastLook = elapsed;
      input.lookX = input.lookY = 0;
    } else if (inCar && p.speed > 1.5 && elapsed - this.lastLook > 1.6) {
      this.yaw += angleDelta(this.yaw, p.heading + Math.PI) * (1 - Math.exp(-2.0 * dt));
      this.pitch = damp(this.pitch, 0.2, 1.2, dt);
    }
    const desired = new THREE.Vector3(p.position.x, p.position.y + (inCar ? 0.6 : 1.3), p.position.z);
    if (!this.cameraReady || this.target.distanceTo(desired) > 25) { this.target.copy(desired); this.cameraReady = true; }
    this.target.lerp(desired, 1 - Math.exp(-12 * dt));
    const nominal = inCar ? 7.2 + Math.min(p.speed * 0.035, 1) : 4.8;
    const direction = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    const allowed = this.sim.cameraDistance(this.target, direction, nominal);
    this.distance = allowed < this.distance ? allowed : damp(this.distance, allowed, 5, dt);
    this.camera.position.copy(this.target).addScaledVector(direction, this.distance);
    this.camera.lookAt(this.target);
    // Shadow frustum follows the playable area rather than rendering the entire city.
    const sx = Math.round(p.position.x / 4) * 4, sz = Math.round(p.position.z / 4) * 4;
    this.sun.target.position.set(sx, 0, sz); this.sun.position.set(sx - 65, 55, sz + 35);
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.observer.disconnect();
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
    this.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      for (const m of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(m);
        for (const value of Object.values(m)) if (value instanceof THREE.Texture) textures.add(value);
      }
    });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
    this.renderer.dispose();
  }
}
