import { Object3D, Quaternion, Vector3 } from 'three';
/** Blend a captured local pose into freshly sampled destination poses. */
export class PoseTransition {
  private targets;
  private position = new Vector3();
  private rotation = new Quaternion();
  private destinationRotation = new Quaternion();
  private scale = new Vector3();
  constructor(targets: Object3D[]) {
    this.targets = targets.map(target => ({ target, rest: target.matrix.clone(), from: target.matrix.clone(), fromPosition: new Vector3(), fromRotation: new Quaternion(), fromScale: new Vector3() }));
    // The binding validates TRS for animated targets; retain exact rest matrices between samples.
    this.capture();
  }
  restoreTargets() {
    for (const {target,rest} of this.targets) { target.matrix.copy(rest); target.matrixWorldNeedsUpdate = true; }
  }
  capture() {
    for (const b of this.targets) { b.from.copy(b.target.matrix); b.target.matrix.decompose(b.fromPosition,b.fromRotation,b.fromScale); }
  }
  apply(amount: number) {
    const t = Math.max(0,Math.min(1,amount));
    if (t === 1) return;
    for (const b of this.targets) {
      if (t === 0) { b.target.matrix.copy(b.from); b.target.matrixWorldNeedsUpdate = true; continue; }
      b.target.matrix.decompose(this.position,this.destinationRotation,this.scale);
      this.position.lerpVectors(b.fromPosition,this.position,t);
      this.rotation.slerpQuaternions(b.fromRotation,this.destinationRotation,t);
      this.scale.lerpVectors(b.fromScale,this.scale,t);
      b.target.matrix.compose(this.position,this.rotation,this.scale); b.target.matrixWorldNeedsUpdate = true;
    }
  }
}
