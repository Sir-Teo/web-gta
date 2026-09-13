import { Group, Matrix4, Object3D } from 'three';
import { bindAnimation } from '../animation/bind';
import { locomotionMotion } from '../animation/locomotion';
import { modelObject } from '../assets/ModelObjects';
import type { DffModel } from '../assets/dff';
import type { NativeAnimation } from '../assets/ifp';
import type { ModelTexture } from '../assets/modelTextures';
import type { Controls, Simulation } from '../simulation/Simulation';
export interface CharacterClip { clip: NativeAnimation; track?: number }
export interface CharacterSource { model: DffModel; textures: ModelTexture[]; clip: NativeAnimation; track: number; idle?: CharacterClip; run?: CharacterClip }
type Action = 'idle' | 'walk' | 'run';
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
  constructor(source: CharacterSource) {
    if (!source.model.geometries.some(g => g.skin) || !(source.clip.duration > 0)) throw new Error('Character testing requires a skinned model and a nonzero-duration clip.');
    this.owner = modelObject(source.model, source.textures);
    try {
      for (const [action, assignment] of Object.entries({ walk: { clip: source.clip, track: source.track }, idle: source.idle, run: source.run })) {
        if (!assignment) continue;
        const { clip, track: index } = assignment;
        if (!(clip.duration > 0)) throw new Error('Assigned clips need a nonzero duration.');
        if (action !== 'idle' && index === undefined) throw new Error('Moving clips need an extraction track.');
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
      this.root.add(this.owner.root); this.active.binding.sample(0);
    } catch (error) { this.owner.dispose(); throw error; }
  }
  supported(sim: Simulation) { return sim.player.health > 0 && sim.player.grounded && !sim.player.crouched && !sim.activeVehicle && !sim.transition && sim.impactRemaining === 0; }
  step(dt: number, controls: Controls, sim: Simulation): Controls {
    const moving = Math.hypot(controls.x, controls.y) > 0;
    const runnable = !!this.clips.run && sim.player.stamina > 0 && (!sim.player.sprintExhausted || sim.player.stamina >= 20);
    const action: Action = !this.supported(sim) || !moving ? 'idle' : controls.sprint && runnable ? 'run' : 'walk';
    if (action !== this.action) {
      const phase = this.seconds / this.active.duration;
      this.active.binding.restore();
      const preservePhase = action !== 'idle' && this.action !== 'idle';
      this.action = action;
      this.seconds = preservePhase ? phase * this.active.duration : 0;
    }
    this.previous = this.seconds;
    if (!this.supported(sim)) { this.seconds = this.previous = 0; return controls; }
    if (action === 'idle') {
      if (this.clips.idle) this.seconds += dt;
      else this.seconds = this.previous = 0;
      return { ...controls, sprint: false, animationMotion: { x: 0, z: 0 } };
    }
    const dx = controls.x * Math.cos(controls.cameraYaw) - controls.y * Math.sin(controls.cameraYaw);
    const dz = -controls.x * Math.sin(controls.cameraYaw) - controls.y * Math.cos(controls.cameraYaw);
    this.basis.makeRotationY(Math.atan2(dx,dz)).multiply(this.active.parent);
    this.seconds += dt;
    return { ...controls, sprint: action === 'run', animationMotion: this.active.motion!.between(this.previous, this.seconds, this.basis) };
  }
  update(sim: Simulation, alpha: number) {
    const p = sim.player; this.root.visible = this.supported(sim);
    this.root.position.set(p.previous.x+(p.position.x-p.previous.x)*alpha,p.previous.y+(p.position.y-p.previous.y)*alpha,p.previous.z+(p.position.z-p.previous.z)*alpha);
    this.root.rotation.y = p.heading;
    this.active.binding.sample(this.previous + (this.seconds-this.previous)*alpha);
  }
  snapshot() { return { action: this.action, seconds: this.seconds, visible: this.root.visible }; }
  dispose() { this.root.removeFromParent(); this.owner.dispose(); }
}
