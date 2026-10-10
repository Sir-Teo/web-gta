import {nativeDayNightBalance} from '../world/nativeDayNight';
import { retainPrograms } from './retainPrograms';
import { ProgramWarmer } from './programWarmer';
import { setCompressedTextureSupport } from '../assets/nativeTexture';
import {nativeContactBrightness,nativeContactLightMultiplier} from '../simulation/nativeContactLighting';
import {applyWindowedCameraProjection, GAME_CAMERA_FOV} from './cameraProjection';
import { NativeCharacter, type CharacterSource } from './NativeCharacter';
import {NativeCharacterShadow,type ShadowReceiverQuery} from './NativeCharacterShadow';
import * as THREE from 'three';
import { cameraNominalDistance, nextCameraMode, readCameraSettings, saveCameraSettings, vehicleZoomScale } from './cameraSettings';
import { cameraGlance, coronaLookMask, glanceOrientation, type CameraGlance } from './cameraLook';
import { WorldLighting } from './WorldLighting';
import type { Simulation } from '../simulation/Simulation';
import type { Input } from '../input/Input';
import { angleDelta, clamp, damp } from '../core/math';
import {FirstPersonZoom,firstPersonAlphaRange,firstPersonSourceOffset,isRocketMode,type FirstPersonMode} from '../weapons/nativeFirstPerson';
import {MOUSE_ACCEL_DEFAULT} from '../input/mouseSettings';
import {AIM_ASSIST_SETTLE as LOOK_SETTLE,aimAssistTurn} from '../input/aimAssist';

export class GameRenderer {
  readonly renderer: THREE.WebGLRenderer;
  // The scene root never moves. With auto-update off it no longer forces every world matrix in the
  // tree to be recomputed each frame; moving objects still update their own subtrees.
  readonly scene = (() => { const scene = new THREE.Scene(); scene.matrixAutoUpdate = false; return scene; })();
  readonly camera = new THREE.PerspectiveCamera(GAME_CAMERA_FOV, 1, 0.08, 650);
  /** Links new objects' shader programs beside the frames instead of in the one they first draw in. */
  readonly programWarmer: ProgramWarmer;
  aiming=false;
  /** The target button held with a weapon the follow camera stays for (a melee weapon's fight stance, a thrown one):
   * CJ faces where the camera looks, so the string must not drag it after him. */
  targetHeld=false;
  /** The touch controls' aim assist (input/aimAssist): the point the aimed follow camera eases the crosshair onto. */
  aimAssist?:{x:number;y:number;z:number};
  private assistPoint=new THREE.Vector3();
  /** The camera's first-person weapon mode (see nativeFirstPerson), or undefined for the follow camera. */
  firstPerson?:FirstPersonMode;
  get scoped(){return !!this.firstPerson;}
  /** Process_Sniper's zoom, and this frame's zoom input: `notch` +1 for a wheel notch in and −1 out, `held` +1 while
   * zoom in is held and −1 for zoom out. */
  readonly zoom=new FirstPersonZoom();
  zoomInput={notch:0,held:0};
  /** CCam::m_fFOV: the native FOV the projection is built from. */
  private sourceFov=GAME_CAMERA_FOV;
  get fov(){return this.sourceFov;}
  private wasFirstPerson=false;
  private wasAiming=false;
  /** The frontend's mouse options: the sensitivity slider turns the sideways look only (the retail camera's vertical
   * rate stays 0.0015), and CPad::UpdateMouse inverts the vertical movement in play with bInvertMouseY. */
  mouseYawScale=1;mouseYSign=1;
  private head=new THREE.Vector3();
  /** Player car entry, exit or driving pose; replaces on-foot animation while set. */
  /** The player's camera follow point (feet position) when a task moves it off the ped, as CTaskSimpleClimb::GetCameraTargetPos. */
  cameraFocus?:{x:number;y:number;z:number};
  vehiclePose?:{frame:Parameters<NativeCharacter['updateVehicle']>[0];pose:Parameters<NativeCharacter['updateVehicle']>[1]};
  vehicleView=false;
  /** Where the follow camera itself sat last frame, before any fixed or first-person camera took the view. */
  private followPosition=new THREE.Vector3();
  /** CPed::PreRenderAfterTest's drawRealTimeShadow for the player (see drawsRealTimeShadow). */
  playerShadowAllowed=true;
  /** MODE_FIXED after CCamera::TakeControl: the camera sits at a native-script position and looks at the target. */
  /** `roll`: radians about the view, + leaning the top of the view right (CCam::Process_AttachedCam's tilt). */
  fixedCamera?:{position:THREE.Vector3;target:()=>THREE.Vector3;roll?:number;
    /** CAMERA_SET_LERP_FOV's field of view while it runs (or persists); 70 otherwise. */
    fov?:number;
    /** The view's up (CCam::Up), for a camera that sets its own: the cutscene's fly-by. */
    up?:THREE.Vector3};
  /** CCam::Process_1stPerson's source and the vehicle's frame for the bumper view, from the host each frame. */
  bumper?:{source:{x:number;y:number;z:number};quaternion:{x:number;y:number;z:number;w:number}};
  /** TheCamera.m_bDisableFirstPersonInCar off. */
  bumperAllowed=true;
  get bumperView(){return this.vehicleView&&this.cameraSettings.vehicle==='bumper'&&!!this.bumper&&this.bumperAllowed;}
  /** CCamera::m_fCamShakeForce left this frame, for the shake below. */
  shake?:()=>number;
  /** CCamera::m_fNearClipScript while m_bUseNearClipScript holds (SET_NEAR_CLIP, until a restore). */
  scriptNearClip?:number;
  /** CCamera::m_bCamDirectlyBehind, which SET_CAMERA_BEHIND_PLAYER sets: the string camera swings straight
   * behind the ped on the next update and the flag clears. Its in-front counterpart is the other side. */
  /** m_fPedOrientForBehindOrInFront: the ped's heading when SET_CAMERA_BEHIND_PLAYER or _IN_FRONT_OF_PLAYER ran. */
  camDirectlyBehind?:number;camDirectlyInFront?:number;
  vehicleDistance=9;
  /** Whether Q and E look left and right from the vehicle (not in aircraft, where they are the rudder). */
  vehicleLooks=true;
  contactLighting?: number;
  nativeCharacter?: NativeCharacter;
  readonly nativeShadow=new NativeCharacterShadow();
  shadowReceivers?:ShadowReceiverQuery;
  beforeRender?: (camera: THREE.PerspectiveCamera) => void;
  /** Runs right after the scene is drawn (CCamera's made-invisible entities come back). */
  afterRender?: () => void;
  /** Cumulative milliseconds per update section, for the dev state. */
  readonly profile={frames:0,character:0,lighting:0,beforeRender:0,shadow:0,render:0};
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
  private lastLook = 0;private lastElapsed = 0;
  /** Whether a look (a drag, the mouse, a glance) turned the camera a moment ago: the aim assist waits it out. */
  get lookingAround(){return this.lastElapsed-this.lastLook<=LOOK_SETTLE;}
  private wasVehicleView=false;
  readonly lighting: WorldLighting;
  private observer: ResizeObserver;
  constructor(readonly canvas: HTMLCanvasElement, readonly sim: Simulation) {
    // Native PS2-era presentation uses blob shadows (NativeCharacterShadow), not
    // real-time shadow maps. Shadow maps over thousands of streamed placements
    // are the dominant frame cost; keep them off for both fidelity and speed.
    // Pixel ratio is capped at 1: native raster output is low-res upscaled, and
    // 1.5x on retina multiplies fragment work without matching reference detail.
    // A phone's touch settings may ask for more (setPixelRatio).
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    // three.js reads every new program's link status and info logs back when it compiles it, a synchronous wait on the
    // driver that stalls the frame each time streaming brings a new material variant (it was a sixth of the CPU in a
    // steady walk). A development build keeps the checks so a broken shader still says why.
    this.renderer.debug.checkShaderErrors = import.meta.env.DEV;
    this.programWarmer = new ProgramWarmer(this.renderer, this.scene, this.camera);
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
    // In a vehicle the V key steps CCamera's car zoom, not the on-foot one.
    if (this.vehicleView) this.cameraSettings.vehicle = nextCameraMode(this.cameraSettings.vehicle, true, this.bumperAllowed);
    else this.cameraSettings.foot = nextCameraMode(this.cameraSettings.foot);
    const key = this.vehicleView ? 'vehicle' : 'foot';
    saveCameraSettings(this.cameraSettings);
    return this.cameraSettings[key];
  }
  /** Draws at `ratio` device pixels per CSS pixel (the touch settings' Resolution). */
  setPixelRatio(ratio: number) {
    if (this.renderer.getPixelRatio() === ratio) return;
    this.renderer.setPixelRatio(ratio); this.resize();
  }
  resize() {
    const w = Math.max(1, this.canvas.clientWidth), h = Math.max(1, this.canvas.clientHeight);
    this.renderer.setSize(w, h, false); applyWindowedCameraProjection(this.camera,w,h,this.sourceFov);
  }
  /** SET_CHAR_VISIBLE off on the player. */
  scriptPlayerHidden = false;
  update(dt: number, alpha: number, input: Input, elapsed: number, paused=false) {
    const p = this.sim.player;this.lastElapsed=elapsed;
    const clock=()=>performance.now();let mark=clock();const lap=(key:keyof typeof this.profile)=>{const now=clock();(this.profile as any)[key]+=now-mark;mark=now;};
    this.crouchAmount = damp(this.crouchAmount, p.crouched ? 1 : 0, 14, dt);
    if(this.vehiclePose&&this.nativeCharacter){if(!this.nativeCharacter.updateVehicle(this.vehiclePose.frame,this.vehiclePose.pose))this.nativeCharacter.root.visible=false;}
    else{this.nativeCharacter?.update(this.sim, alpha);if((this.vehicleView||this.firstPerson)&&this.nativeCharacter)this.nativeCharacter.root.visible=false;}
    // SET_CHAR_VISIBLE on the player (CEntity::m_bIsVisible): nothing of him is drawn, in a vehicle or out.
    if(this.scriptPlayerHidden&&this.nativeCharacter)this.nativeCharacter.root.visible=false;
    // The prelight night blend on the schedule every other entity uses (CustomBuildingRenderer's DN balance).
    this.nativeCharacter?.setNight(nativeDayNightBalance(this.sim.timeMinutes));lap('character');
    const fp=this.firstPerson;
    // CCamera::SetCameraDirectlyBehindForFollowPed_CamOnAString records the ped's facing and the camera takes
    // it on the next update. The camera sits along its own direction from the ped, so behind him is his facing
    // turned half round, which is the same angle the first-person and vehicle views already use.
    if(this.camDirectlyBehind!==undefined){this.yaw=this.camDirectlyBehind+Math.PI;this.camDirectlyBehind=undefined;this.lastLook=elapsed;}
    if(this.camDirectlyInFront!==undefined){this.yaw=this.camDirectlyInFront;this.camDirectlyInFront=undefined;this.lastLook=elapsed;}
    // CCamera::StartTransition into a first-person weapon mode: the ped's heading, level, and Process_Sniper's reset zoom.
    if(fp&&!this.wasFirstPerson){this.yaw=p.heading+Math.PI;this.pitch=0;this.zoom.reset();}
    else if(!fp&&this.wasFirstPerson)this.pitch=clamp(this.pitch,this.aiming?-1.1:-.18,1.05);
    // Leaving the aimed view puts the follow camera back within its own pitch range, as leaving first person does.
    else if(!fp&&!this.aiming&&this.wasAiming)this.pitch=clamp(this.pitch,-.18,1.05);
    this.wasFirstPerson=!!fp;this.wasAiming=this.aiming;
    const previousGlance = this.glance;
    // Looking behind is a third-person control (AffectControllerStateOn_ButtonDown_ThirdPersonOnly).
    // In a road vehicle Q and E look left and right and both together look behind (m_bLookingLeft/Right).
    const carLooks=this.vehicleView&&this.vehicleLooks;
    // A held game (the pause menu, the map, the arsenal) takes no camera input: the view stays as it was left.
    if (!paused) this.glance = cameraGlance(carLooks, !fp&&input.down('KeyQ'), !fp&&input.down('KeyE'),
      !fp&&(input.down('MouseMiddle') || !this.vehicleView&&input.down('Numpad1')));
    if (this.glance !== 'none' || previousGlance !== 'none') this.lastLook = elapsed;
    if (paused) {
      input.lookX = input.lookY = 0;
    } else if (this.glance !== 'none') {
      input.lookX = input.lookY = 0;
    } else if (input.lookX || input.lookY) {
      if(fp){
        // CCam::Process_Rocket and Process_1rstPersonPedOnPC: the horizontal angle moves by -3 x dx x (FOV / 80) x
        // m_fMouseAccelHorzntl (the sensitivity slider, 0.0025 by default) and the vertical by 4 x dy x (FOV / 80) x
        // m_fMouseAccelVertical (0.0015). The browser pitch is minus the camera's vertical angle.
        const fovScale=this.zoom.fov/80,range=firstPersonAlphaRange(fp);
        this.yaw -= input.lookX * 3 * fovScale * MOUSE_ACCEL_DEFAULT * this.mouseYawScale;
        this.pitch = clamp(this.pitch + input.lookY * this.mouseYSign * 4 * fovScale * .0015, -range.max, -range.min);
      }else{
        this.yaw -= input.lookX * .003 * this.mouseYawScale;
        this.pitch = clamp(this.pitch + input.lookY * this.mouseYSign * .002, this.aiming?-1.1:-.18, 1.05);
      }
      this.lastLook = elapsed;
      input.lookX = input.lookY = 0;
    }
    // Gyro aiming (a touch setting): the phone turned is the camera turned, radian for radian, a scope's scaled by its
    // zoom as the mouse's is; past the tremor it is a look as a drag is, and the aim assist waits for it to settle.
    if (input.gyroYaw || input.gyroPitch) {
      if (!paused && this.glance === 'none') {
        if (fp) { const scale = this.zoom.fov / 80, range = firstPersonAlphaRange(fp); this.yaw += input.gyroYaw * scale; this.pitch = clamp(this.pitch - input.gyroPitch * scale, -range.max, -range.min); }
        else { this.yaw += input.gyroYaw; this.pitch = clamp(this.pitch - input.gyroPitch, this.aiming ? -1.1 : -.18, 1.05); }
        this.lastLook = elapsed;
      }
      input.gyroYaw = input.gyroPitch = 0;
    }
    // The touch aim assist turns the aimed camera toward its target (a fifth of a second to settle), but not while a
    // finger is dragging the view or for a moment after.
    if(this.aimAssist&&this.aiming&&!fp&&this.glance==='none'&&elapsed-this.lastLook>LOOK_SETTLE&&this.cameraReady){
      const ndc=this.assistPoint.set(this.aimAssist.x,this.aimAssist.y,this.aimAssist.z).project(this.camera);
      if(ndc.z<1&&Math.abs(ndc.x)<1.5&&Math.abs(ndc.y)<1.5){
        const turn=aimAssistTurn(ndc,THREE.MathUtils.degToRad(this.camera.fov),this.camera.aspect,1-Math.exp(-10*dt));
        this.yaw+=turn.yaw;this.pitch=clamp(this.pitch+turn.pitch,-1.1,1.05);
      }
    }
    // Process_FollowCar_SA is a retail stub; authored from play: the car camera swings behind the vehicle as soon as
    // the ped is in (also when it stands still), and returns there two seconds after the last look.
    if(this.vehicleView&&!this.wasVehicleView)this.lastLook=-Infinity;
    this.wasVehicleView=this.vehicleView;
    if(this.vehicleView&&elapsed-this.lastLook>2)this.yaw+=angleDelta(this.yaw,p.heading-Math.PI)*(1-Math.exp(-2*dt));
    // Process_FollowPed_SA is a retail stub too. The follow camera hangs on a string: it keeps its place while the ped
    // moves, so walking away trails it behind him and walking past it swings it round. The string is the line from
    // the ped to where the camera was last frame; the yaw eases onto it while he moves and nobody is looking round.
    // Not while the target button is held: CJ faces the camera then, and the string would turn him with it, round and
    // round as he shuffles sideways in a fight stance.
    else if(!this.vehicleView&&!fp&&!this.aiming&&!this.targetHeld&&this.glance==='none'&&elapsed-this.lastLook>1&&p.speed>.5&&this.cameraReady){
      // The follow camera's own place, not a fixed script camera's or the first-person head that may have replaced it.
      const dx=this.followPosition.x-p.position.x,dz=this.followPosition.z-p.position.z;
      if(Math.hypot(dx,dz)>.5)this.yaw+=angleDelta(this.yaw,Math.atan2(dx,dz))*(1-Math.exp(-6*dt));
    }
    const orientation = glanceOrientation(this.glance, this.yaw, this.pitch, carLooks ? p.heading : undefined);
    this.viewYaw = orientation.yaw; this.viewPitch = orientation.pitch;
    const focus = this.cameraFocus ?? p.position;
    const desired = this.desired.set(focus.x, focus.y + (p.health <= 0 ? 0.45 : 1.3 - 0.5 * this.crouchAmount), focus.z);
    if(this.aiming){desired.x+=Math.cos(this.viewYaw)*.55;desired.z-=Math.sin(this.viewYaw)*.55;}
    if (!this.cameraReady || this.target.distanceTo(desired) > 25) { this.target.copy(desired); this.cameraReady = true; }
    this.target.lerp(desired, 1 - Math.exp(-12 * dt));
    const nominal = this.aiming?2.4:this.vehicleView?this.vehicleDistance*vehicleZoomScale(this.cameraSettings.vehicle):cameraNominalDistance(this.distanceMode);
    this.boomLength = damp(this.boomLength, nominal, 5, dt);
    const direction = this.camDir.set(Math.sin(this.viewYaw) * Math.cos(this.viewPitch), Math.sin(this.viewPitch), Math.cos(this.viewYaw) * Math.cos(this.viewPitch));
    const allowed = this.sim.cameraDistance(this.target, direction, this.boomLength);
    this.distance = allowed < this.distance ? allowed : damp(this.distance, allowed, 5, dt);
    this.camera.position.copy(this.target).addScaledVector(direction, this.distance);this.followPosition.copy(this.camera.position);
    this.camera.lookAt(this.target);
    // CCam::Process_Fixed keeps the camera at m_vecCamFixedModeSource and faces the entity it took control of.
    if(this.fixedCamera){const up=this.fixedCamera.up;this.camera.position.copy(this.fixedCamera.position);if(up)this.camera.up.copy(up);this.camera.lookAt(this.fixedCamera.target());if(up)this.camera.up.set(0,1,0);if(this.fixedCamera.roll)this.camera.rotateZ(-this.fixedCamera.roll);}
    // CCam::Process_1stPerson: the source the host worked out, looking along the vehicle's own forward and up.
    else if(this.bumperView){const b=this.bumper!;this.camera.position.set(b.source.x,b.source.y,b.source.z);this.camera.quaternion.set(b.quaternion.x,b.quaternion.y,b.quaternion.z,b.quaternion.w);}
    else if(fp){
      // Process_Rocket and the Vice City Process_Sniper: the head bone plus the mode's offset, looking along the angles.
      const head=this.nativeCharacter?.headPosition(this.head)??this.head.set(p.position.x,p.position.y+1.6-.5*this.crouchAmount,p.position.z);
      const o=firstPersonSourceOffset(fp,p.crouched),sin=Math.sin(p.heading),cos=Math.cos(p.heading);
      this.camera.position.set(head.x+sin*o.forward-cos*o.right,head.y+o.up,head.z+cos*o.forward+sin*o.right);
      this.camera.lookAt(this.camera.position.x-direction.x,this.camera.position.y-direction.y,this.camera.position.z-direction.z);
    }
    // CCamera::Process's shake (a stub here; re3's, GTA III's, is the port): the force left moves the source by
    // force x 0.1 x (a random 0..15 less 7) on each axis.
    const shake=Math.min(2,Math.max(0,this.shake?.()??0));
    if(shake>0){const r=Math.floor(Math.random()*4096),o=shake*.1;this.camera.position.x+=o*((r&15)-7);this.camera.position.y+=o*(((r>>4)&15)-7);this.camera.position.z+=o*(((r>>8)&15)-7);}
    // The aimed third-person camera's 52 is authored (Process_AimWeapon and Process_FollowPedWithMouse are stubs).
    // CCam::Process_Fixed sets FOV 70 whatever mode the player was in.
    // Process_1stPerson in a vehicle sets FOV 60.
    const fov=this.fixedCamera?this.fixedCamera.fov??70:this.bumperView?60:fp?this.zoom.update(fp,dt*50,this.zoomInput.notch,this.zoomInput.held,input.pinch):this.aiming?52:GAME_CAMERA_FOV;this.zoomInput.notch=0;input.pinch=1;
    // Process_Rocket's near clip plane is 0.15.
    const near=this.scriptNearClip??(fp&&isRocketMode(fp)?.15:.08);
    if(fov!==this.sourceFov||near!==this.camera.near){this.sourceFov=fov;this.camera.near=near;applyWindowedCameraProjection(this.camera,Math.max(1,this.canvas.clientWidth),Math.max(1,this.canvas.clientHeight),fov);}
    mark=clock();this.lighting.update(this.sim.timeMinutes, p.position, this.camera,dt,coronaLookMask(this.glance),this.sourceFov,!paused);lap('lighting');
    const contact = this.contactLighting !== undefined && this.lighting.nativeWorldAmbient ? nativeContactLightMultiplier(this.lighting.nativeWorldAmbient,nativeContactBrightness(this.contactLighting!,nativeDayNightBalance(this.sim.timeMinutes))) : 1;
    this.nativeCharacter?.setAmbient(this.lighting.nativeObjectAmbient,this.lighting.sunLightMultiplier*contact,contact);
    this.beforeRender?.(this.camera);lap('beforeRender');
    this.nativeShadow.update(this.renderer,this.nativeCharacter,this.shadowReceivers,this.camera.position,this.sim.timeMinutes,this.lighting.nativeShadowStrength,paused,this.playerShadowAllowed);lap('shadow');
    this.programWarmer.beforeRender(performance.now());
    this.renderer.render(this.scene, this.camera);this.afterRender?.();retainPrograms(this.renderer);lap('render');this.profile.frames++;
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
