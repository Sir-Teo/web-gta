import * as THREE from 'three';
import { installNativeFogCurve } from './nativeFog';
import { random, type Vec3 } from '../core/math';
import { sampleTimecycle } from '../world/timecycle';
import { sampleSun } from '../world/sun';
import type { ImportedLighting } from '../world/LocalTimecycle';
import type { StreetLamp } from './environment';

export class WorldLighting {
  private sky: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private ambient = new THREE.HemisphereLight();
  private sun = new THREE.DirectionalLight();
  private stars: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private lamps: { light: THREE.SpotLight; lens: THREE.Mesh; halo: THREE.Sprite }[] = [];
  private lampMaterial = new THREE.MeshBasicMaterial({ color: 0xffce87 });
  private haloMaterial: THREE.SpriteMaterial;
  private authoredFog = new THREE.FogExp2(0,.0042);
  private importedFog = new THREE.Fog(0,0,650);
  private originalFar = new WeakMap<THREE.PerspectiveCamera,number>();
  night = 0;
  nativeTimecycle?: (minutes:number)=>ImportedLighting|undefined;
  constructor(private scene: THREE.Scene, streetLamps: StreetLamp[], private windows: THREE.MeshLambertMaterial[]) {
    installNativeFogCurve();
    scene.background = new THREE.Color(); scene.fog = this.authoredFog;
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(500, 24, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { topColor: { value: new THREE.Color() }, bottomColor: { value: new THREE.Color() },
        sunDirection: { value: new THREE.Vector3() }, sunCore: { value: new THREE.Color() }, sunCorona: { value: new THREE.Color() }, coreVisible: { value: 0 }, coronaVisible: { value: 0 } },
      vertexShader: 'varying vec3 vPosition; void main() { vPosition = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }',
      fragmentShader: `uniform vec3 topColor; uniform vec3 bottomColor; uniform vec3 sunDirection; uniform vec3 sunCore; uniform vec3 sunCorona; uniform float coreVisible; uniform float coronaVisible; varying vec3 vPosition;
        void main() {
          vec3 direction = normalize(vPosition);
          vec3 color = mix(bottomColor, topColor, smoothstep(-0.03, 0.38, direction.y));
          float alignment = max(0.0, dot(direction, sunDirection));
          float disc = smoothstep(0.99982, 0.99991, alignment);
          float halo = pow(alignment, 230.0) * 0.22;
          color += sunCore * disc * 1.2 * coreVisible + sunCorona * halo * coronaVisible;
          gl_FragColor = vec4(color, 1.0);\n #include <tonemapping_fragment>\n #include <colorspace_fragment>\n
        }`,
    }));
    this.sky.renderOrder = -10;
    scene.add(this.sky, this.ambient, this.sun, this.sun.target);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 0.5, far: 210 });
    this.sun.shadow.normalBias = 0.025; this.sun.shadow.bias = -0.00008;
    const rand = random(1972), points: number[] = [];
    for (let i = 0; i < 260; i++) {
      const y = 0.1 + rand() * 0.9, angle = rand() * Math.PI * 2, radius = Math.sqrt(1 - y * y);
      points.push(Math.cos(angle) * radius * 450, y * 450, Math.sin(angle) * radius * 450);
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    this.stars = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xd2d8dc, size: 1.25, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    scene.add(this.stars);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d')!, gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, '#ffffff'); gradient.addColorStop(0.13, '#ffffffbb'); gradient.addColorStop(0.45, '#ffffff28'); gradient.addColorStop(1, '#ffffff00');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
    this.haloMaterial = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), color: 0xffc474, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const lensGeometry = new THREE.BoxGeometry(0.46, 0.04, 0.22);
    for (const position of streetLamps) {
      const light = new THREE.SpotLight(0xffc782, 0, 27, 0.88, 0.65, 2);
      light.position.copy(position); light.target.position.set(position.x, 0, position.z);
      const lens = new THREE.Mesh(lensGeometry, this.lampMaterial); lens.position.copy(position);
      const halo = new THREE.Sprite(this.haloMaterial); halo.position.copy(position); halo.scale.setScalar(1.6);
      scene.add(light, light.target, lens, halo); this.lamps.push({ light, lens, halo });
    }
  }
  update(minutes: number, player: Vec3, camera: THREE.PerspectiveCamera) {
    const sample = sampleTimecycle(minutes),native = this.nativeTimecycle?.(minutes);
    if(native){sample.top=native.top;sample.horizon=native.horizon;}
    this.night = sample.night;
    const uniforms = this.sky.material.uniforms;
    uniforms.topColor.value.setRGB(...sample.top); uniforms.bottomColor.value.setRGB(...sample.horizon);
    const visibleSun=sampleSun(minutes);
    uniforms.sunCore.value.setRGB(...(native?.sunCore??sample.sun));
    uniforms.sunCorona.value.setRGB(...(native?.sunCorona??sample.sun));
    uniforms.sunDirection.value.copy(visibleSun.direction);
    uniforms.coreVisible.value=Number(visibleSun.coreVisible);
    uniforms.coronaVisible.value=Number(visibleSun.coronaVisible);
    this.sky.position.copy(camera.position); this.stars.position.copy(camera.position);
    this.stars.material.opacity = Math.max(0, (sample.night - 0.65) / 0.35) * 0.8;
    (this.scene.background as THREE.Color).setRGB(...sample.horizon);
    if(!this.originalFar.has(camera))this.originalFar.set(camera,camera.far);
    const fog=native?.fog;
    if(fog){this.importedFog.near=fog.start;this.importedFog.far=fog.end;this.scene.fog=this.importedFog;}
    else{this.authoredFog.density=sample.fog;this.scene.fog=this.authoredFog;}
    this.scene.fog.color.setRGB(...sample.horizon);
    const far=fog?.end??this.originalFar.get(camera)!;
    if(camera.far!==far){camera.far=far;camera.updateProjectionMatrix();}
    this.stars.scale.setScalar(Math.min(1,camera.far/500));
    this.ambient.color.setRGB(...sample.ambient); this.ambient.groundColor.setRGB(...sample.ground); this.ambient.intensity = sample.ambientIntensity;
    this.sun.color.setRGB(...sample.sun); this.sun.intensity = sample.sunIntensity;
    // Keep the shadow camera above the ground when the sun has set; its contribution fades to zero.
    const x = Math.round(player.x / 4) * 4, z = Math.round(player.z / 4) * 4;
    this.sun.target.position.set(x, 0, z);
    this.sun.position.set(x + sample.direction.x * 90, Math.max(6, sample.direction.y * 90), z + sample.direction.z * 90);
    this.windows.forEach((material, i) => { material.emissiveIntensity = sample.night * (0.65 + i * 0.2); });
    this.lampMaterial.color.set(0xffce87).multiplyScalar(0.18 + sample.night * 1.5);
    this.haloMaterial.opacity = sample.night * 0.65;
    for (const lamp of this.lamps) lamp.light.intensity = sample.night * 190;
  }
  dispose() {
    this.stars.geometry.dispose(); this.stars.material.dispose();
    this.haloMaterial.map?.dispose(); this.haloMaterial.dispose();
    this.sun.shadow.map?.dispose();
  }
}
