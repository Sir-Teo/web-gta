import {nativeDayNightBalance} from '../world/nativeDayNight';
import { setCompressedTextureSupport } from '../assets/nativeTexture';
import {nativeContactBrightness,nativeContactLightMultiplier} from '../simulation/nativeContactLighting';
import {applyWindowedCameraProjection, GAME_CAMERA_FOV} from './cameraProjection';
import { NativeCharacter, type CharacterSource } from './NativeCharacter';
import {NativeCharacterShadow,type ShadowReceiverQuery} from './NativeCharacterShadow';
import * as THREE from 'three';
import { cameraNominalDistance, nextCameraMode, readCameraSettings, saveCameraSettings } from './cameraSettings';
import { cameraGlance, coronaLookMask, glanceOrientation, type CameraGlance } from './cameraLook';
import { sampleTimecycle } from '../world/timecycle';
import { WorldLighting } from './WorldLighting';
import type { Simulation } from '../simulation/Simulation';
import type { Input } from '../input/Input';
import { angleDelta, clamp, damp } from '../core/math';

export class GameRenderer {
  readonly renderer: THREE.WebGLRenderer;
  // The scene root never moves. With auto-update off it no longer forces every world matrix in the
  // tree to be recomputed each frame; moving objects still update their own subtrees.
  readonly scene = (() => { const scene = new THREE.Scene(); scene.matrixAutoUpdate = false; return scene; })();
  readonly camera = new THREE.PerspectiveCamera(GAME_CAMERA_FOV, 1, 0.08, 650);
  aiming=false;
  scoped=false;
  /** Player car entry, exit or driving pose; replaces on-foot animation while set. */
  /** The player's camera follow point (feet position) when a task moves it off the ped, as CTaskSimpleClimb::GetCameraTargetPos. */
  cameraFocus?:{x:number;y:number;z:number};
  vehiclePose?:{frame:Parameters<NativeCharacter['updateVehicle']>[0];pose:Parameters<NativeCharacter['updateVehicle']>[1]};
  vehicleView=false;
  /** MODE_FIXED after CCamera::TakeControl: the camera sits at a native-script position and looks at the target. */
  fixedCamera?:{position:THREE.Vector3;target:()=>THREE.Vector3};
  vehicleDistance=9;
  contactLighting?: number;
  nativeCharacter?: NativeCharacter;
  readonly nativeShadow=new NativeCharacterShadow();
  shadowReceivers?:ShadowReceiverQuery;
  beforeRender?: (camera: THREE.PerspectiveCamera) => void;
  installCharacter(source: CharacterSource) {
    const character = new NativeCharacter(source);
    this.nativeShadow.reset();
    this.nativeCharacter?.dispose(); this.nativeCharacter = character; this.scene.add(character.root);
  }
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
  private desired = new THREE.Vector3();
  private camDir = new THREE.Vector3();
  private cameraReady = false;
  private lastLook = 0;
  readonly lighting: WorldLighting;
  private observer: ResizeObserver;
  constructor(readonly canvas: HTMLCanvasElement, readonly sim: Simulation) {
    // Native PS2-era presentation uses blob shadows (NativeCharacterShadow), not
    // real-time shadow maps. Shadow maps over thousands of streamed placements
    // are the dominant frame cost; keep them off for both fidelity and speed.
    // Pixel ratio is capped at 1: native raster output is low-res upscaled, and
    // 1.5x on retina multiplies fragment work without matching reference detail.
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    // SA's PC rasters are mostly DXT: sample them compressed, as the D3D9 device does.
    setCompressedTextureSupport(this.renderer.extensions.has('WEBGL_compressed_texture_s3tc'));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = false;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.lighting = new WorldLighting(this.scene);
    this.lighting.sunObstructed=(sun,camera)=>this.sim.sunObstructed(sun,camera);
    this.scene.add(this.nativeShadow.draw.mesh);
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(canvas); this.resize();
  }
  get distanceMode() { return this.cameraSettings.foot; }
  get followDistance() { return this.distance; }
  cycleCameraDistance() {
    const key = 'foot';
    this.cameraSettings[key] = nextCameraMode(this.cameraSettings[key]);
    saveCameraSettings(this.cameraSettings);
    return this.cameraSettings[key];
  }
  resize() {
    const w = Math.max(1, this.canvas.clientWidth), h = Math.max(1, this.canvas.clientHeight);
    this.renderer.setSize(w, h, false); applyWindowedCameraProjection(this.camera,w,h,GAME_CAMERA_FOV);
  }
  update(dt: number, alpha: number, input: Input, elapsed: number, paused=false) {
    const p = this.sim.player;
    this.crouchAmount = damp(this.crouchAmount, p.crouched ? 1 : 0, 14, dt);
    if(this.vehiclePose&&this.nativeCharacter){if(!this.nativeCharacter.updateVehicle(this.vehiclePose.frame,this.vehiclePose.pose))this.nativeCharacter.root.visible=false;}
    else{this.nativeCharacter?.update(this.sim, alpha);if((this.vehicleView||this.scoped)&&this.nativeCharacter)this.nativeCharacter.root.visible=false;}
    const night = sampleTimecycle(this.sim.timeMinutes).night;
    this.nativeCharacter?.setNight(night);
    const previousGlance = this.glance;
    this.glance = cameraGlance(false, input.down('KeyQ'), input.down('KeyE'),
      input.down('MouseMiddle') || input.down('Numpad1'));
    if (this.glance !== 'none' || previousGlance !== 'none') this.lastLook = elapsed;
    if (this.glance !== 'none') {
      input.lookX = input.lookY = 0;
    } else if (input.lookX || input.lookY) {
      this.yaw -= input.lookX * (this.scoped?.0009:.003);
      this.pitch = clamp(this.pitch + input.lookY * (this.scoped?.0006:.002), this.aiming?-1.1:-.18, 1.05);
      this.lastLook = elapsed;
      input.lookX = input.lookY = 0;
    }
    if(this.vehicleView&&elapsed-this.lastLook>2&&p.speed>1)this.yaw+=angleDelta(this.yaw,p.heading-Math.PI)*(1-Math.exp(-2*dt));
    const orientation = glanceOrientation(this.glance, this.yaw, this.pitch, undefined);
    this.viewYaw = orientation.yaw; this.viewPitch = orientation.pitch;
    const focus = this.cameraFocus ?? p.position;
    const desired = this.desired.set(focus.x, focus.y + (p.health <= 0 ? 0.45 : 1.3 - 0.5 * this.crouchAmount), focus.z);
    if(this.aiming){desired.x+=Math.cos(this.viewYaw)*.55;desired.z-=Math.sin(this.viewYaw)*.55;}
    if (!this.cameraReady || this.target.distanceTo(desired) > 25) { this.target.copy(desired); this.cameraReady = true; }
    this.target.lerp(desired, 1 - Math.exp(-12 * dt));
    const nominal = this.aiming?2.4:this.vehicleView?this.vehicleDistance:cameraNominalDistance(this.distanceMode, false, p.speed);
    this.boomLength = damp(this.boomLength, nominal, 5, dt);
    const direction = this.camDir.set(Math.sin(this.viewYaw) * Math.cos(this.viewPitch), Math.sin(this.viewPitch), Math.cos(this.viewYaw) * Math.cos(this.viewPitch));
    const allowed = this.sim.cameraDistance(this.target, direction, this.boomLength);
    this.distance = allowed < this.distance ? allowed : damp(this.distance, allowed, 5, dt);
    this.camera.position.copy(this.target).addScaledVector(direction, this.distance);
    this.camera.lookAt(this.target);
    // CCam::Process_Fixed keeps the camera at m_vecCamFixedModeSource and faces the entity it took control of.
    if(this.fixedCamera){this.camera.position.copy(this.fixedCamera.position);this.camera.lookAt(this.fixedCamera.target());}
    this.lighting.update(this.sim.timeMinutes, p.position, this.camera,dt,coronaLookMask(this.glance),GAME_CAMERA_FOV,!paused);
    const contact = this.contactLighting !== undefined && this.lighting.nativeWorldAmbient ? nativeContactLightMultiplier(this.lighting.nativeWorldAmbient,nativeContactBrightness(this.contactLighting!,nativeDayNightBalance(this.sim.timeMinutes))) : 1;
    this.nativeCharacter?.setAmbient(this.lighting.nativeObjectAmbient,this.lighting.sunLightMultiplier*contact,contact);
    const fov=this.scoped?24:this.aiming?52:GAME_CAMERA_FOV;if(this.camera.fov!==fov){this.camera.fov=fov;this.camera.updateProjectionMatrix();}
    this.beforeRender?.(this.camera);
    this.nativeShadow.update(this.renderer,this.nativeCharacter,this.shadowReceivers,this.camera.position,this.sim.timeMinutes,this.lighting.nativeShadowStrength,paused);
    if(this.vehicleView)this.nativeShadow.draw.mesh.visible=false;
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.nativeCharacter?.dispose();
    this.nativeShadow.dispose();
    this.observer.disconnect(); this.lighting.dispose();
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
