import { MotionTransition } from '../animation/MotionTransition';
import { PoseTransition } from '../animation/PoseTransition';
import { Group, Matrix4, Object3D, Mesh } from 'three';
import { bindAnimation } from '../animation/bind';
import { locomotionMotion } from '../animation/locomotion';
import { modelObject } from '../assets/ModelObjects';
import type { DffModel } from '../assets/dff';
import type { NativeAnimation } from '../assets/ifp';
import type { ModelTexture } from '../assets/modelTextures';
import type { Controls, Simulation } from '../simulation/Simulation';
export interface CharacterClip { clip: NativeAnimation; track?: number }
export interface CharacterSource { model: DffModel; textures: ModelTexture[]; clip: NativeAnimation; track: number; idle?: CharacterClip; run?: CharacterClip; crouchIdle?: CharacterClip; crouchWalk?: CharacterClip }
type Action = 'idle' | 'walk' | 'run' | 'crouchIdle' | 'crouchWalk';
const idleAction = (action: Action) => action === 'idle' || action === 'crouchIdle';
const TRANSITION_SECONDS = .18;
/** Session-local native locomotion. The simulation owns time and physical position. */
export class NativeCharacter {
  readonly root = new Group();
  private owner: ReturnType<typeof modelObject>;
  private clips: Partial<Record<Action, { binding: ReturnType<typeof bindAnimation>; motion?: ReturnType<typeof locomotionMotion>; parent: Matrix4; duration: number }>> = {};
  private action: Action = 'idle';
  private get active() { return this.clips[this.action] ?? this.clips.walk!; }
  private basis = new Matrix4();
  private seconds = 0;
  private previous = 0;
  private transition: PoseTransition;
  private motionTransition = new MotionTransition(TRANSITION_SECONDS);
  private transitionTime = TRANSITION_SECONDS;
  private previousTransitionTime = TRANSITION_SECONDS;
  constructor(source: CharacterSource) {
    if (!source.model.geometries.some(g => g.skin) || !(source.clip.duration > 0)) throw new Error('Character testing requires a skinned model and a nonzero-duration clip.');
    if (!!source.crouchIdle !== !!source.crouchWalk) throw new Error('Assign both crouched idle and crouched walk clips.');
    this.owner = modelObject(source.model, source.textures, undefined, undefined, { worldLighting: true });
    this.owner.root.traverse(o => { if (o instanceof Mesh) { o.castShadow = true; o.receiveShadow = true; } });
    try {
      for (const [action, assignment] of Object.entries({ walk: { clip: source.clip, track: source.track }, idle: source.idle, run: source.run, crouchIdle: source.crouchIdle, crouchWalk: source.crouchWalk })) {
        if (!assignment) continue;
        const { clip, track: index } = assignment;
        if (!(clip.duration > 0)) throw new Error('Assigned clips need a nonzero duration.');
        if (!idleAction(action as Action) && index === undefined) throw new Error('Moving clips need an extraction track.');
        const binding = bindAnimation(source.model, this.owner.root, clip, index === undefined ? undefined : { track: index });
        const parent = new Matrix4();
        let motion: ReturnType<typeof locomotionMotion> | undefined;
        if (index !== undefined) {
          motion = locomotionMotion(clip, { track: index });
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
          for (const time of track.times) motion.between(0, time, parent);
        }
        this.clips[action as Action] = { binding, motion, parent, duration: clip.duration };
      }
      const tracks = [source.clip, source.idle?.clip, source.run?.clip, source.crouchIdle?.clip, source.crouchWalk?.clip].flatMap(clip => clip?.tracks.filter(t => t.times.length) ?? []);
      const animatedFrames = new Set(source.model.frames.flatMap((f,i) => tracks.some(t => t.boneId >= 0 ? t.boneId === f.hanim?.id : t.name.trim().toLowerCase() === f.name.trim().toLowerCase()) ? [i] : []));
      const targets: Object3D[] = []; this.owner.root.traverse(o => { if (animatedFrames.has(o.userData.nativeFrame)) targets.push(o); });
      this.transition = new PoseTransition(targets);
      this.root.add(this.owner.root); this.samplePose(0, TRANSITION_SECONDS);
    } catch (error) { this.owner.dispose(); throw error; }
  }
  supported(sim: Simulation) { return sim.player.health > 0 && sim.player.grounded && (!sim.player.crouched || !!this.clips.crouchIdle && !!this.clips.crouchWalk) && !sim.activeVehicle && !sim.transition && sim.impactRemaining === 0; }
  step(dt: number, controls: Controls, sim: Simulation): Controls {
    const moving = Math.hypot(controls.x, controls.y) > 0;
    const runnable = !!this.clips.run && sim.player.stamina > 0 && (!sim.player.sprintExhausted || sim.player.stamina >= 20);
    const action: Action = !this.supported(sim) ? 'idle' : sim.player.crouched ? moving ? 'crouchWalk' : 'crouchIdle' : !moving ? 'idle' : controls.sprint && runnable ? 'run' : 'walk';
    if (action !== this.action) {
      this.samplePose(this.seconds, this.transitionTime);
      this.transition.capture(); this.transitionTime = 0; this.motionTransition.begin();
      const phase = this.seconds / this.active.duration;
      this.active.binding.restore();
      const preservePhase = !idleAction(action) && !idleAction(this.action);
      this.action = action;
      this.seconds = preservePhase ? phase * this.active.duration : 0;
    }
    this.previous = this.seconds;
    this.previousTransitionTime = this.transitionTime;
    this.transitionTime = Math.min(TRANSITION_SECONDS, this.transitionTime + dt);
    if (!this.supported(sim)) { this.seconds = this.previous = 0; this.transitionTime = this.previousTransitionTime = TRANSITION_SECONDS; this.motionTransition.reset(); return controls; }
    if (idleAction(action)) {
      if (this.clips[action]) this.seconds += dt;
      else this.seconds = this.previous = 0;
      return { ...controls, sprint: false, animationMotion: this.motionTransition.advance({x:0,z:0},dt) };
    }
    const dx = controls.x * Math.cos(controls.cameraYaw) - controls.y * Math.sin(controls.cameraYaw);
    const dz = -controls.x * Math.sin(controls.cameraYaw) - controls.y * Math.cos(controls.cameraYaw);
    this.basis.makeRotationY(Math.atan2(dx,dz)).multiply(this.active.parent);
    this.seconds += dt;
    return { ...controls, sprint: action === 'run', animationMotion: this.motionTransition.advance(this.active.motion!.between(this.previous, this.seconds, this.basis),dt) };
  }
  update(sim: Simulation, alpha: number) {
    const p = sim.player; this.root.visible = this.supported(sim);
    this.root.position.set(p.previous.x+(p.position.x-p.previous.x)*alpha,p.previous.y+(p.position.y-p.previous.y)*alpha,p.previous.z+(p.position.z-p.previous.z)*alpha);
    this.root.rotation.y = p.heading;
    this.samplePose(this.previous + (this.seconds-this.previous)*alpha, this.previousTransitionTime + (this.transitionTime-this.previousTransitionTime)*alpha);
  }
  private samplePose(seconds: number, transitionTime: number) {
    this.transition.restoreTargets();
    this.active.binding.sample(seconds);
    this.transition.apply(transitionTime / TRANSITION_SECONDS);
    this.owner.root.updateMatrixWorld(true);
  }
  setNight(amount: number) { this.owner.setNight(amount); }
  snapshot() { return { transition: this.transitionTime / TRANSITION_SECONDS, action: this.action, seconds: this.seconds, visible: this.root.visible }; }
  dispose() { this.root.removeFromParent(); this.owner.dispose(); }
}
