import {LocalWater} from './LocalWater';
import {nativeAltitudeFarClip} from '../world/nativeFarClip';
import {GAME_CAMERA_FOV} from './cameraProjection';
import * as THREE from 'three';
import { installNativeFogCurve } from './nativeFog';
import { random, type Vec3 } from '../core/math';
import { sampleTimecycle } from '../world/timecycle';
import { NATIVE_LIGHT_DIRECTION } from '../world/sun';
import { SunCoronas } from './SunCoronas';
import {LocalSunTexture} from './LocalSunTexture';
import {TexturedSun} from './TexturedSun';
import { NativeSky } from './NativeSky';
import { NativeStreak } from './NativeStreak';
import { NativeStars } from './NativeStars';
import { NativeLowClouds } from './NativeLowClouds';
import { proceduralSkySun } from './proceduralSkySun';
import type { ImportedLighting } from '../world/LocalTimecycle';
import type { StreetLamp } from './environment';

export class WorldLighting {
  private cameraWorldPosition = new THREE.Vector3();
  private sky: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private nativeSky: NativeSky;
  private nativeStars: NativeStars;
  private lowClouds: NativeLowClouds;
  private streak: NativeStreak;
  readonly water:LocalWater;
  private skyTimeMs=0;
  // Runtime factors can be supplied independently; local weather rows use the documented viewer fog approximation.
  readonly skyWeather = { foggyness: 0, underwaterness: 0 };
  private ambient = new THREE.HemisphereLight();
  private sun = new THREE.DirectionalLight();
  private stars: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private lamps: { light: THREE.SpotLight; lens: THREE.Mesh; halo: THREE.Sprite }[] = [];
  private lampMaterial = new THREE.MeshBasicMaterial({ color: 0xffce87 });
  private haloMaterial: THREE.SpriteMaterial;
  private authoredFog = new THREE.FogExp2(0,.0042);
  private importedFog = new THREE.Fog(0,0,650);
  private originalFar = new WeakMap<THREE.PerspectiveCamera,number>();
  area=0;
  private sunCoronas = new SunCoronas();
  get sunLightMultiplier(){return this.sunCoronas.lightMultiplier;}
  readonly sunTexture=new LocalSunTexture();
  private texturedSun:TexturedSun;
  night = 0;
  nativeWorldAmbient?: readonly number[];
  nativeObjectAmbient?: readonly number[];
  nativeShadowStrength?:number;
  nativeTimecycle?: (minutes:number)=>ImportedLighting|undefined;
  sunObstructed?: (sun:THREE.Vector3,camera:THREE.Vector3)=>boolean;
  constructor(private scene: THREE.Scene, streetLamps: StreetLamp[], private windows: THREE.MeshLambertMaterial[]) {
    this.water=new LocalWater(scene);
    this.texturedSun=new TexturedSun(scene);
    installNativeFogCurve();
    scene.background = new THREE.Color(); scene.fog = this.authoredFog;
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(500, 24, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { topColor: { value: new THREE.Color() }, bottomColor: { value: new THREE.Color() },
        coreDirection: { value: new THREE.Vector3() }, coronaDirection: { value: new THREE.Vector3() }, sunCore: { value: new THREE.Color() }, sunCorona: { value: new THREE.Color() }, coreVisible: { value: 0 }, coronaVisible: { value: 0 } },
      vertexShader: 'varying vec3 vPosition; void main() { vPosition = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }',
      fragmentShader: `uniform vec3 topColor; uniform vec3 bottomColor; varying vec3 vPosition; ${proceduralSkySun}
        void main() {
          vec3 direction = normalize(vPosition);
          vec3 color = mix(bottomColor, topColor, smoothstep(-0.03, 0.38, direction.y));
          color += skySun(direction);
          gl_FragColor = vec4(color, 1.0);\n #include <tonemapping_fragment>\n #include <colorspace_fragment>\n
        }`,
    }));
    this.sky.renderOrder = -10;
    this.nativeSky = new NativeSky(scene,this.sky.material.uniforms);
    this.nativeStars = new NativeStars(scene);
    this.lowClouds = new NativeLowClouds(scene);
    this.streak = new NativeStreak(scene);
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
  update(minutes: number, player: Vec3, camera: THREE.PerspectiveCamera, seconds=0,lookMask=0,sourceFov=GAME_CAMERA_FOV,advanceSun=true) {
    const sample = sampleTimecycle(minutes),native = this.nativeTimecycle?.(minutes);
    this.nativeObjectAmbient=native?.objectAmbient;this.nativeWorldAmbient=native?.ambient;
    this.nativeShadowStrength=native?.shadowStrength;
    if(native){sample.top=native.top;sample.horizon=native.horizon;}
    this.night = sample.night;
    const uniforms = this.sky.material.uniforms;
    uniforms.topColor.value.setRGB(...sample.top); uniforms.bottomColor.value.setRGB(...sample.horizon);
    camera.getWorldPosition(this.cameraWorldPosition);
    this.sky.position.copy(this.cameraWorldPosition); this.stars.position.copy(this.cameraWorldPosition);
    this.stars.material.opacity = Math.max(0, (sample.night - 0.65) / 0.35) * 0.8;
    (this.scene.background as THREE.Color).setRGB(...sample.horizon);
    if(!this.originalFar.has(camera))this.originalFar.set(camera,camera.far);
    const sourceFog=native?.fog;
    const fog=sourceFog ? {start:sourceFog.start,end:nativeAltitudeFarClip(sourceFog.end,camera.getWorldPosition(this.cameraWorldPosition).y)} : undefined;
    if(fog){this.importedFog.near=fog.start;this.importedFog.far=fog.end;this.scene.fog=this.importedFog;}
    else{this.authoredFog.density=sample.fog;this.scene.fog=this.authoredFog;}
    this.scene.fog.color.setRGB(...sample.horizon);
    const far=fog?.end??this.originalFar.get(camera)!;
    if(camera.far!==far){camera.far=far;camera.updateProjectionMatrix();}
    camera.updateMatrixWorld(true);
    this.nativeSky.update(camera,native?.skyColors,minutes,{
      foggyness:native?.skyFoggyness??this.skyWeather.foggyness,underwaterness:this.skyWeather.underwaterness,
    });
    this.sky.visible=!this.nativeSky.mesh.visible;
    this.stars.visible=!native;
    this.nativeStars.update(camera,minutes,!!native&&this.area===0,this.sunTexture.texture,sourceFov,advanceSun);
    if(advanceSun)this.skyTimeMs=(this.skyTimeMs+Math.max(0,seconds)*1000)%0x100000000;
    this.streak.update(camera,minutes,this.skyTimeMs,!!native?.extraSunny&&this.area===0);
    this.water.update(this.area,native?.water,this.sunTexture.waterTexture);
    this.lowClouds.update(camera,this.area===0?native?.lowClouds:undefined,this.sunTexture.cloudTexture,sourceFov);
    if(advanceSun)this.sunCoronas.update(minutes,camera,native?.sunCore??sample.sun,native?.sunCorona??sample.sun,seconds,lookMask,this.sunObstructed,native?.sunSize??0,this.area===0);
    const {core,corona}=this.sunCoronas;
    if(core){uniforms.sunCore.value.setRGB(...core.color);uniforms.coreDirection.value.copy(core.direction);}
    if(corona){uniforms.sunCorona.value.setRGB(...corona.color);uniforms.coronaDirection.value.copy(corona.direction);}
    uniforms.coreVisible.value=(core?.intensity??0)/255;
    uniforms.coronaVisible.value=(corona?.intensity??0)/255;
    const textured=!!this.sunTexture.texture&&!!native&&native.sunSize>=0;
    this.texturedSun.update(camera,textured?this.sunTexture.texture:undefined,core,corona,sourceFov);
    if(textured){uniforms.coreVisible.value=0;uniforms.coronaVisible.value=0;}
    this.stars.scale.setScalar(Math.min(1,camera.far/500));
    this.ambient.color.setRGB(...sample.ambient); this.ambient.groundColor.setRGB(...sample.ground); this.ambient.intensity = sample.ambientIntensity;
    if(native?.directionalMultiplier!==undefined){
      this.sun.color.setRGB(1,1,1);
      this.sun.intensity=Math.fround(Math.fround(native.directionalMultiplier*.99609375)*this.sunLightMultiplier);
    }else{
      this.sun.color.setRGB(...sample.sun);this.sun.intensity=sample.sunIntensity;
    }
    const x = Math.round(player.x / 4) * 4, z = Math.round(player.z / 4) * 4;
    if(native){
      // Native illumination is fixed independently of the visible sun. Follow terrain
      // height without changing that direction or leaving the shadow volume below it.
      this.sun.target.position.set(x,player.y,z);
      this.sun.position.copy(this.sun.target.position).addScaledVector(NATIVE_LIGHT_DIRECTION,90);
    }else{
      // Authored lighting keeps its above-ground shadow camera after sunset.
      this.sun.target.position.set(x,0,z);
      this.sun.position.set(x+sample.direction.x*90,Math.max(6,sample.direction.y*90),z+sample.direction.z*90);
    }
    this.windows.forEach((material, i) => { material.emissiveIntensity = sample.night * (0.65 + i * 0.2); });
    this.lampMaterial.color.set(0xffce87).multiplyScalar(0.18 + sample.night * 1.5);
    this.haloMaterial.opacity = sample.night * 0.65;
    for (const lamp of this.lamps) lamp.light.intensity = sample.night * 190;
  }
  dispose() {
    this.nativeSky.dispose();
    this.nativeStars.dispose();
    this.lowClouds.dispose();
    this.streak.dispose();
    this.water.dispose();
    this.texturedSun.dispose();this.sunTexture.dispose();
    this.stars.geometry.dispose(); this.stars.material.dispose();
    this.haloMaterial.map?.dispose(); this.haloMaterial.dispose();
    this.sun.shadow.map?.dispose();
  }
}
