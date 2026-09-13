import { Group, Matrix4, Object3D } from 'three';
import { bindAnimation } from '../animation/bind';
import { locomotionMotion } from '../animation/locomotion';
import { modelObject } from '../assets/ModelObjects';
import type { DffModel } from '../assets/dff';
import type { NativeAnimation } from '../assets/ifp';
import type { ModelTexture } from '../assets/modelTextures';
import type { Controls, Simulation } from '../simulation/Simulation';
export interface CharacterSource { model: DffModel; textures: ModelTexture[]; clip: NativeAnimation; track: number }
/** Session-local native locomotion. The simulation owns time and physical position. */
export class NativeCharacter {
  readonly root = new Group();
  private owner: ReturnType<typeof modelObject>;
  private binding: ReturnType<typeof bindAnimation>;
  private motion: ReturnType<typeof locomotionMotion>;
  private parent = new Matrix4();
  private basis = new Matrix4();
  private seconds = 0;
  private previous = 0;
  constructor(source: CharacterSource) {
    if (!source.model.geometries.some(g => g.skin) || !(source.clip.duration > 0)) throw new Error('Character testing requires a skinned model and a nonzero-duration clip.');
    this.owner = modelObject(source.model, source.textures);
    try {
      this.motion = locomotionMotion(source.clip, { track: source.track });
      this.binding = bindAnimation(source.model, this.owner.root, source.clip, { track: source.track });
      const track = source.clip.tracks[source.track];
      const frame = source.model.frames.findIndex(f => track.boneId >= 0 ? f.hanim?.id === track.boneId : f.name.trim().toLowerCase() === track.name.trim().toLowerCase());
      let target: Object3D | undefined;
      this.owner.root.traverse(o => { if (o.userData.nativeFrame === frame) target = o; });
      if (!target?.parent) throw new Error('Locomotion track has no model parent.');
      // A moving ancestor would require extracting motion from its animated coordinate frame.
      for (let p: Object3D | null = target.parent; p && p !== this.owner.root; p = p.parent) {
        const ancestor = source.model.frames[p.userData.nativeFrame];
        if (ancestor && source.clip.tracks.some(t => t.times.length && (t.boneId >= 0 ? t.boneId === ancestor.hanim?.id : t.name.trim().toLowerCase() === ancestor.name.trim().toLowerCase()))) throw new Error('Locomotion extraction from an animated parent is not supported.');
      }
      this.parent.copy(target.parent.matrixWorld);
      for (const time of track.times) this.motion.between(0, time, this.parent);
      this.root.add(this.owner.root); this.binding.sample(0);
    } catch (error) { this.owner.dispose(); throw error; }
  }
  supported(sim: Simulation) { return sim.player.health > 0 && sim.player.grounded && !sim.player.crouched && !sim.activeVehicle && !sim.transition && sim.impactRemaining === 0; }
  step(dt: number, controls: Controls, sim: Simulation): Controls {
    this.previous = this.seconds;
    if (!this.supported(sim)) { this.seconds = this.previous = 0; return controls; }
    if (!Math.hypot(controls.x, controls.y)) { this.seconds = this.previous = 0; return { ...controls, animationMotion: { x: 0, z: 0 } }; }
    const dx = controls.x * Math.cos(controls.cameraYaw) - controls.y * Math.sin(controls.cameraYaw);
    const dz = -controls.x * Math.sin(controls.cameraYaw) - controls.y * Math.cos(controls.cameraYaw);
    this.basis.makeRotationY(Math.atan2(dx,dz)).multiply(this.parent);
    this.seconds += dt;
    return { ...controls, animationMotion: this.motion.between(this.previous, this.seconds, this.basis) };
  }
  update(sim: Simulation, alpha: number) {
    const p = sim.player; this.root.visible = this.supported(sim);
    this.root.position.set(p.previous.x+(p.position.x-p.previous.x)*alpha,p.previous.y+(p.position.y-p.previous.y)*alpha,p.previous.z+(p.position.z-p.previous.z)*alpha);
    this.root.rotation.y = p.heading;
    this.binding.sample(this.previous + (this.seconds-this.previous)*alpha);
  }
  snapshot() { return { seconds: this.seconds, visible: this.root.visible }; }
  dispose() { this.root.removeFromParent(); this.owner.dispose(); }
}
