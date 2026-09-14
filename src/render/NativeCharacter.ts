import {characterShadowBounds} from './characterShadowBounds';
import {playerMoveBlend} from '../animation/playerMoveBlend';
import {bindPlayerShoulders} from '../animation/playerShoulders';
import { nativeAmbientState } from '../assets/nativeMaterial';
import {nativePlayerMaterial} from './nativePlayerMaterial';
import { MotionTransition } from '../animation/MotionTransition';
import { PoseTransition } from '../animation/PoseTransition';
import { Group, Matrix4, Object3D, Mesh, Vector3 } from 'three';
import { bindAnimation } from '../animation/bind';
import { locomotionMotion } from '../animation/locomotion';
import { modelObject } from '../assets/ModelObjects';
import type { DffModel } from '../assets/dff';
import type { NativeAnimation } from '../assets/ifp';
import type { ModelTexture } from '../assets/modelTextures';
import type { Controls, Simulation } from '../simulation/Simulation';
export interface CharacterClip { clip: NativeAnimation; track?: number; forwardMotion?: boolean }
export type CharacterConvention = 'feet' | 'san-andreas-ped';
export interface CharacterSource { playerBody?: boolean; convention?: CharacterConvention; model: DffModel; textures: ModelTexture[]; clip: NativeAnimation; track: number; idle?: CharacterClip; run?: CharacterClip; sprint?: CharacterClip; crouchIdle?: CharacterClip; crouchWalk?: CharacterClip; airborne?: CharacterClip; landing?: CharacterClip; landingMoving?: CharacterClip; launch?: CharacterClip; launchRight?: CharacterClip }
type Action = 'idle' | 'walk' | 'run' | 'sprint' | 'crouchIdle' | 'crouchWalk' | 'airborne' | 'landing' | 'landingMoving' | 'launch' | 'launchRight';
const idleAction = (action: Action) => action === 'idle' || action === 'crouchIdle';
const launchAction = (action: Action) => action === 'launch' || action === 'launchRight';
const landingAction = (action: Action) => action === 'landing' || action === 'landingMoving';
const oneShot = (action: Action) => action === 'airborne' || landingAction(action) || launchAction(action);
const TRANSITION_SECONDS = .18;
/** Session-local native locomotion. The simulation owns time and physical position. */
export class NativeCharacter {
  readonly root = new Group();
  private ambient = nativeAmbientState();
  private owner: ReturnType<typeof modelObject>;
  private shoulders?: ReturnType<typeof bindPlayerShoulders>;
  private clips: Partial<Record<Action, { binding: ReturnType<typeof bindAnimation>; motion?: ReturnType<typeof locomotionMotion>; parent: Matrix4; duration: number }>> = {};
  private action: Action = 'idle';
  private lastGroundAction: Action = 'idle';
  private landingSpeed = 1;
  landingFootContacts: readonly ('right' | 'left')[] | undefined;
  private get active() { return this.clips[this.action] ?? this.clips.walk!; }
  private basis = new Matrix4();
  private seconds = 0;
  private originHeight: number;
  private sourceShadowSphere?: {center:Vector3;radius:number};
  private poseGeneration=0;
  private sampledPose='';
  private poseRevision=0;
  private shadowRootBone?: Object3D;
  private headingOffset: number;
  private motionSpace: 'world' | 'actor';
  private wasAirborne = false;
  private moveBlend = 0;
  private observedGround = false;
  private previous = 0;
  private transition: PoseTransition;
  private motionTransition = new MotionTransition(TRANSITION_SECONDS);
  private transitionTime = TRANSITION_SECONDS;
  private transitionDuration = TRANSITION_SECONDS;
  private previousTransitionTime = TRANSITION_SECONDS;
  constructor(source: CharacterSource) {
    if (source.convention !== undefined && source.convention !== 'feet' && source.convention !== 'san-andreas-ped') throw new Error('Unknown character coordinates.');
    if(source.playerBody!==undefined&&typeof source.playerBody!=='boolean')throw new Error('Invalid player body marker.');
    if(source.playerBody&&source.convention!=='san-andreas-ped')throw new Error('Native player bodies require San Andreas pedestrian coordinates.');
    // Native pedestrian COL bounds begin at Z=-1; simulation position denotes feet.
    // Keep this fixed during crouching: animation moves the body within its entity frame.
    this.originHeight = source.convention === 'san-andreas-ped' ? 1 : 0;
    // Native +Y forward becomes -Z after model import; the controller uses +Z.
    this.headingOffset = source.convention === 'san-andreas-ped' ? Math.PI : 0;
    this.motionSpace = source.convention === 'san-andreas-ped' ? 'actor' : 'world';
    if (!source.model.geometries.some(g => g.skin) || !(source.clip.duration > 0)) throw new Error('Character testing requires a skinned model and a nonzero-duration clip.');
    if (source.landingMoving && !source.landing) throw new Error('Assign a base landing clip before moving landing.');
    if (source.sprint && !source.run) throw new Error('Assign a run clip before sprint.');
    if (!!source.crouchIdle !== !!source.crouchWalk) throw new Error('Assign both crouched idle and crouched walk clips.');
    if (source.launchRight && !source.launch) throw new Error('Assign a base launch clip before its right-foot variant.');
    this.owner = modelObject(source.model, source.textures, undefined, undefined, { worldLighting: true, ambient: this.ambient });
    const shadowRootFrame=source.model.frames.findIndex(frame=>frame.hanim?.id===0);
    if(shadowRootFrame>=0)this.owner.root.traverse(object=>{if(object.userData.nativeFrame===shadowRootFrame)this.shadowRootBone=object;});
    // Shared-frame player parts use a conservative union of their native morph
    // bounds. Capture framing remains a related-source candidate, not SA parity.
    const sphere=characterShadowBounds(source.model,!!source.playerBody);
    if(source.convention==='san-andreas-ped'&&sphere&&sphere.radius>0&&Number.isFinite(sphere.radius)&&sphere.center.every(Number.isFinite))this.sourceShadowSphere={center:new Vector3(...sphere.center),radius:sphere.radius*1.1};
    const playerMaterials=new Set<import('three').Material>();
    this.owner.root.traverse(o => { if (o instanceof Mesh) {
      o.castShadow = true; o.receiveShadow = true;
      if(source.convention==='san-andreas-ped')for(const material of Array.isArray(o.material)?o.material:[o.material])playerMaterials.add(material);
    } });
    playerMaterials.forEach(nativePlayerMaterial);
    try {
      if(source.playerBody)this.shoulders=bindPlayerShoulders(source.model,this.owner.root);
      for (const [action, assignment] of Object.entries({ walk: { clip: source.clip, track: source.track }, idle: source.idle, run: source.run, sprint: source.sprint, crouchIdle: source.crouchIdle, crouchWalk: source.crouchWalk, airborne: source.airborne, landing: source.landing, landingMoving: source.landingMoving, launch: source.launch, launchRight: source.launchRight })) {
        if (!assignment) continue;
        const { clip, track: index } = assignment;
        const forwardMotion = 'forwardMotion' in assignment && assignment.forwardMotion;
        if ('forwardMotion' in assignment && assignment.forwardMotion !== undefined && typeof assignment.forwardMotion !== 'boolean') throw new Error('Invalid forward motion marker.');
        if (forwardMotion && (!landingAction(action as Action) || source.convention !== 'san-andreas-ped')) throw new Error('Forward landing motion requires a native pedestrian landing role.');
        if (!(clip.duration > 0)) throw new Error('Assigned clips need a nonzero duration.');
        if (!idleAction(action as Action) && index === undefined) throw new Error('Moving clips need an extraction track.');
        const binding = bindAnimation(source.model, this.owner.root, clip, index === undefined ? undefined : { track: index, axes: forwardMotion ? ['y'] : oneShot(action as Action) ? ['x','y','z'] : undefined });
        const parent = new Matrix4();
        let motion: ReturnType<typeof locomotionMotion> | undefined;
        if (index !== undefined) {
          if (forwardMotion || !oneShot(action as Action)) motion = locomotionMotion(clip, { track: index, axes: forwardMotion ? ['y'] : undefined });
          const track = clip.tracks[index];
          const frame = source.model.frames.findIndex(f => track.boneId >= 0 ? f.hanim?.id === track.boneId : f.name.trim().toLowerCase() === track.name.trim().toLowerCase());
          let target: Object3D | undefined;
          this.owner.root.traverse(o => { if (o.userData.nativeFrame === frame) target = o; });
          if (!target?.parent) throw new Error('Locomotion track has no model parent.');
          for (let p: Object3D | null = target.parent; p && p !== this.owner.root; p = p.parent) {
            const ancestor = source.model.frames[p.userData.nativeFrame];
            if (ancestor && clip.tracks.some(t => t.times.length && (t.boneId >= 0 ? t.boneId === ancestor.hanim?.id : t.name.trim().toLowerCase() === ancestor.name.trim().toLowerCase()))) throw new Error('Locomotion extraction from an animated parent is not supported.');
          }
          parent.copy(target.parent.matrixWorld);
          if (motion) for (const time of track.times) motion.between(0, time, parent);
        }
        this.clips[action as Action] = { binding, motion, parent, duration: clip.duration };
      }
      const tracks = [source.clip, source.idle?.clip, source.run?.clip, source.sprint?.clip, source.crouchIdle?.clip, source.crouchWalk?.clip, source.airborne?.clip, source.landing?.clip, source.landingMoving?.clip, source.launch?.clip, source.launchRight?.clip].flatMap(clip => clip?.tracks.filter(t => t.times.length) ?? []);
      const animatedFrames = new Set(source.model.frames.flatMap((f,i) => tracks.some(t => t.boneId >= 0 ? t.boneId === f.hanim?.id : t.name.trim().toLowerCase() === f.name.trim().toLowerCase()) ? [i] : []));
      const targets: Object3D[] = []; this.owner.root.traverse(o => { if (animatedFrames.has(o.userData.nativeFrame)) targets.push(o); });
      this.transition = new PoseTransition(targets);
      this.root.add(this.owner.root); this.samplePose(0, TRANSITION_SECONDS);
    } catch (error) { this.owner.dispose(); throw error; }
  }
  supported(sim: Simulation) { return sim.player.health > 0 && (sim.player.grounded ? !sim.player.crouched || !!this.clips.crouchIdle && !!this.clips.crouchWalk : !!this.clips.airborne); }
  step(dt: number, controls: Controls, sim: Simulation): Controls {
    this.landingFootContacts = undefined;
    const moving = Math.hypot(controls.x, controls.y) > 0;
    const runnable = !!(this.clips.sprint ?? this.clips.run) && sim.player.stamina > 0 && (!sim.player.sprintExhausted || sim.player.stamina >= 20);
    const landed = this.wasAirborne && sim.player.grounded;
    const footState = sim.player.health > 0;
    if (!footState) this.lastGroundAction = 'idle';
    this.moveBlend = footState ? playerMoveBlend(this.moveBlend,controls.x,controls.y,!!controls.walk,dt) : 0;
    this.observedGround = footState && (this.observedGround || sim.player.grounded);
    this.wasAirborne = this.observedGround && footState && !sim.player.grounded;
    const landing = !!this.clips.landing && !sim.player.crouched && (landed || landingAction(this.action) && this.seconds < this.active.duration);
    const selectedLanding = landingAction(this.action) && !landed ? this.action : this.clips.landingMoving && moving && this.moveBlend > 1.5 ? 'landingMoving' : 'landing';
    const canLaunch = this.supported(sim) && sim.player.grounded && !sim.player.crouched && !landing;
    const launchFinished = canLaunch && launchAction(this.action) && this.seconds >= this.active.duration;
    const launch = canLaunch && !!this.clips.launch && !launchFinished && (controls.jump || launchAction(this.action));
    // The current locomotion role supplies phase; original association weights are not yet available.
    const launchPhase = this.seconds / this.active.duration % 1 + .367;
    const rightFoot = !!this.clips.launchRight && (this.action === 'walk' || this.action === 'run' || this.action === 'sprint') && (launchPhase > 1 ? launchPhase - 1 : launchPhase) >= .5;
    const selectedLaunch = launchAction(this.action) ? this.action : rightFoot ? 'launchRight' : 'launch';
    const action: Action = !this.supported(sim) ? 'idle' : sim.player.grounded && landing ? selectedLanding : launch ? selectedLaunch : this.clips.airborne && (!sim.player.grounded || (controls.jump || launchFinished) && !sim.player.crouched) ? 'airborne' : sim.player.crouched ? moving ? 'crouchWalk' : 'crouchIdle' : !moving ? 'idle' : controls.sprint && runnable ? this.clips.sprint ? 'sprint' : 'run' : this.clips.sprint && !controls.walk ? 'run' : 'walk';
    if (sim.player.grounded && !oneShot(action)) this.lastGroundAction = action;
    if (action !== this.action) {
      this.landingSpeed = landingAction(action) && this.motionSpace === 'actor' && this.lastGroundAction === 'sprint' && controls.sprint ? 2 : 1;
      this.samplePose(this.seconds, this.transitionTime);
      const fastLandingTransition = this.motionSpace === 'actor' && (landingAction(action) || this.action === 'landingMoving' && this.seconds >= this.active.duration);
      this.transition.capture(); this.transitionDuration = fastLandingTransition ? .01 : TRANSITION_SECONDS; this.poseGeneration++; this.transitionTime = 0; this.motionTransition.begin();
      const phase = this.seconds / this.active.duration;
      this.active.binding.restore();
      const preservePhase = !idleAction(action) && !idleAction(this.action) && !oneShot(action) && !oneShot(this.action);
      this.action = action;
      this.seconds = preservePhase ? phase * this.active.duration : 0;
    }
    this.previous = this.seconds;
    this.previousTransitionTime = this.transitionTime;
    this.transitionTime = Math.min(this.transitionDuration, this.transitionTime + dt);
    if (!this.supported(sim)) { this.seconds = this.previous = 0; this.transitionTime = this.previousTransitionTime = this.transitionDuration; this.motionTransition.reset(); return controls; }
    if (this.motionSpace === 'actor' && this.clips.landing && oneShot(action)) this.landingFootContacts = [];
    if (launchFinished) {
      this.motionTransition.reset();
      if (action === 'airborne') this.seconds = Math.min(this.active.duration, this.seconds + dt);
      return { ...controls, jump: true };
    }
    if (landingAction(action) || launchAction(action)) {
      this.seconds = Math.min(this.active.duration, this.seconds + dt * (landingAction(action) ? this.landingSpeed : 1)); this.motionTransition.reset();
      if (landingAction(action) && this.landingFootContacts) this.landingFootContacts = ([['right', .1], ['left', .2]] as const).filter(([,time]) => this.previous < time && this.seconds >= time).map(([foot]) => foot);
      this.basis.makeRotationY(this.headingOffset).multiply(this.active.parent);
      const displacement = landingAction(action) && this.active.motion ? this.active.motion.between(this.previous,this.seconds,this.basis,false) : {x:0,z:0};
      return { ...controls, x: 0, y: 0, jump: false, sprint: false, animationMotionSpace: this.motionSpace, animationMotion: displacement };
    }
    if (action === 'airborne') { this.seconds = Math.min(this.active.duration, this.seconds + dt); this.motionTransition.reset(); return controls; }
    if (idleAction(action)) {
      if (this.clips[action]) this.seconds += dt;
      else this.seconds = this.previous = 0;
      return { ...controls, sprint: false, animationMotionSpace: this.motionSpace, animationMotion: this.motionTransition.advance({x:0,z:0},dt) };
    }
    const dx = controls.x * Math.cos(controls.cameraYaw) - controls.y * Math.sin(controls.cameraYaw);
    const dz = -controls.x * Math.sin(controls.cameraYaw) - controls.y * Math.cos(controls.cameraYaw);
    this.basis.makeRotationY((this.motionSpace === 'actor' ? 0 : Math.atan2(dx,dz))+this.headingOffset).multiply(this.active.parent);
    this.seconds += dt;
    return { ...controls, sprint: action === 'sprint' || action === 'run' && !this.clips.sprint, animationMotionSpace: this.motionSpace, animationMotion: this.motionTransition.advance(this.active.motion!.between(this.previous, this.seconds, this.basis),dt) };
  }
  update(sim: Simulation, alpha: number) {
    const p = sim.player; this.root.visible = this.supported(sim);
    this.root.position.set(p.previous.x+(p.position.x-p.previous.x)*alpha,p.previous.y+(p.position.y-p.previous.y)*alpha+this.originHeight,p.previous.z+(p.position.z-p.previous.z)*alpha);
    this.root.rotation.y = p.heading + this.headingOffset;
    this.samplePose(this.previous + (this.seconds-this.previous)*alpha, this.previousTransitionTime + (this.transitionTime-this.previousTransitionTime)*alpha);
  }
  private samplePose(seconds: number, transitionTime: number) {
    this.transition.restoreTargets();
    this.active.binding.sample(seconds, !oneShot(this.action));
    this.transition.apply(transitionTime / this.transitionDuration);
    this.shoulders?.update();
    this.owner.root.updateMatrixWorld(true);
    const key=`${this.action}/${seconds}/${transitionTime}/${this.poseGeneration}`;
    if(key!==this.sampledPose){this.sampledPose=key;this.poseRevision++;}
  }
  get shadowPoseRevision(){return this.poseRevision;}
  setAmbient(rgb?: readonly number[], multiplier=1, contactMultiplier=1) {
    if (!Number.isFinite(contactMultiplier)||contactMultiplier<0) throw new Error('Invalid native contact multiplier.');
    if (!Number.isFinite(multiplier) || multiplier < 0 || rgb && (rgb.length !== 3 || rgb.some(v=>!Number.isFinite(v)||v<0||!Number.isFinite(v*multiplier)))) throw new Error('Native character ambient light must be finite and nonnegative.');
    if (rgb) this.ambient.color.value.set(rgb[0]*multiplier,rgb[1]*multiplier,rgb[2]*multiplier);
    this.ambient.directMultiplier.value=contactMultiplier;
    this.ambient.enabled.value=!!rgb;
  }
  setNight(amount: number) { this.owner.setNight(amount); }
  shadowSphere(){
    if(!this.sourceShadowSphere)return undefined;
    this.root.updateWorldMatrix(true,true);
    return {center:this.sourceShadowSphere.center.clone().applyMatrix4(this.owner.root.matrixWorld),radius:this.sourceShadowSphere.radius};
  }
  /** StoreRealTimeShadow uses BONE_ROOT for distance, independently of capture bounds.
   * GetBonePosition falls back to the entity position when the bone is absent. */
  shadowPosition(){
    this.root.updateWorldMatrix(true,true);
    return new Vector3().setFromMatrixPosition((this.shadowRootBone??this.root).matrixWorld);
  }
  snapshot() { return { playbackSpeed:landingAction(this.action)?this.landingSpeed:1, moveBlend:this.moveBlend, playerBody:!!this.shoulders, transition: this.transitionTime / this.transitionDuration, action: this.action, seconds: this.seconds, visible: this.root.visible }; }
  dispose() { this.root.removeFromParent(); this.owner.dispose(); }
}
