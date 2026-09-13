import * as THREE from 'three';

/** Authored articulated stand-in. Replace through the character asset adapter. */
export class CharacterVisual {
  readonly root = new THREE.Group();
  private body = new THREE.Group();
  private legs: THREE.Group[] = [];
  private knees: THREE.Group[] = [];
  private arms: THREE.Group[] = [];
  private elbows: THREE.Group[] = [];
  constructor(shirtColor = 0xdfddd0, pantsColor = 0x536b87) {
    const skin = new THREE.MeshLambertMaterial({ color: 0x805037 });
    const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
    const denim = new THREE.MeshLambertMaterial({ color: pantsColor });
    const dark = new THREE.MeshLambertMaterial({ color: 0x242726 });
    const sole = new THREE.MeshLambertMaterial({ color: 0xc5c3b6 });
    skin.name = 'skin'; shirt.name = 'shirt'; denim.name = 'pants';
    const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
    };
    this.root.add(this.body);
    const torso = mesh(new THREE.CylinderGeometry(0.25, 0.19, 0.47, 8), shirt, this.body, 0, 1.21, 0);
    torso.scale.z = 0.67;
    mesh(new THREE.BoxGeometry(0.36, 0.2, 0.23), denim, this.body, 0, 0.94, 0);
    mesh(new THREE.CylinderGeometry(0.067, 0.08, 0.12, 8), skin, this.body, 0, 1.51, 0);
    const head = mesh(new THREE.SphereGeometry(0.14, 10, 8), skin, this.body, 0, 1.68, 0.015); head.scale.set(0.9, 1.17, 0.94);
    const hair = mesh(new THREE.SphereGeometry(0.142, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.45), dark, this.body, 0, 1.7, 0.015); hair.scale.set(0.91, 1.05, 0.95);
    mesh(new THREE.BoxGeometry(0.06, 0.065, 0.055), skin, this.body, 0, 1.65, 0.145);
    for (const side of [-1, 1]) {
      mesh(new THREE.BoxGeometry(0.022, 0.012, 0.014), dark, this.body, side * 0.055, 1.702, 0.132);
      const arm = new THREE.Group(); arm.position.set(side * 0.265, 1.41, 0); this.body.add(arm); this.arms.push(arm);
      mesh(new THREE.CylinderGeometry(0.082, 0.063, 0.29, 8), skin, arm, 0, -0.115, 0);
      const elbow = new THREE.Group(); elbow.position.y = -0.25; arm.add(elbow); this.elbows.push(elbow);
      mesh(new THREE.CylinderGeometry(0.067, 0.045, 0.27, 8), skin, elbow, 0, -0.12, 0);
      const hand = mesh(new THREE.SphereGeometry(0.062, 7, 6), skin, elbow, 0, -0.28, 0); hand.scale.set(0.8, 1.25, 0.75);
      const leg = new THREE.Group(); leg.position.set(side * 0.105, 0.91, 0); this.body.add(leg); this.legs.push(leg);
      mesh(new THREE.CylinderGeometry(0.12, 0.095, 0.39, 8), denim, leg, 0, -0.18, 0);
      const knee = new THREE.Group(); knee.position.y = -0.36; leg.add(knee); this.knees.push(knee);
      mesh(new THREE.CylinderGeometry(0.096, 0.075, 0.39, 8), denim, knee, 0, -0.185, 0);
      mesh(new THREE.BoxGeometry(0.18, 0.12, 0.32), dark, knee, 0, -0.39, 0.065);
      mesh(new THREE.BoxGeometry(0.19, 0.035, 0.33), sole, knee, 0, -0.45, 0.065);
    }
  }
  poseSeated(amount: number, reaching: number) {
    // The root follows the seat anchor; the pelvis stays at its authored height.
    this.body.position.y *= 1 - amount;
    this.body.rotation.x *= 1 - amount;
    this.body.rotation.z *= 1 - amount;
    for (let i = 0; i < 2; i++) {
      this.legs[i].rotation.x = THREE.MathUtils.lerp(this.legs[i].rotation.x, -1.35, amount);
      this.knees[i].rotation.x = THREE.MathUtils.lerp(this.knees[i].rotation.x, 1.45, amount);
      this.arms[i].rotation.x = THREE.MathUtils.lerp(this.arms[i].rotation.x, -1.05, amount);
      this.elbows[i].rotation.x = THREE.MathUtils.lerp(this.elbows[i].rotation.x, -0.45, amount);
    }
    this.arms[1].rotation.x = THREE.MathUtils.lerp(this.arms[1].rotation.x, -0.95, reaching);
    this.elbows[1].rotation.x = THREE.MathUtils.lerp(this.elbows[1].rotation.x, -0.3, reaching);
  }
  animate(phase: number, speed: number, grounded: boolean, time: number) {
    const stride = Math.min(1, speed / 4);
    this.body.position.y = grounded ? Math.abs(Math.sin(phase)) * 0.035 * stride : 0.01;
    this.body.rotation.z = grounded ? Math.sin(phase) * 0.018 * stride : 0;
    this.body.rotation.x = speed > 4 ? 0.07 : 0;
    for (let i = 0; i < 2; i++) {
      const swing = Math.sin(phase + i * Math.PI);
      this.legs[i].rotation.x = grounded ? swing * 0.62 * stride : i ? 0.45 : -0.5;
      this.knees[i].rotation.x = grounded ? Math.max(0, -swing) * 0.65 * stride : 0.8;
      this.arms[i].rotation.x = grounded ? -swing * 0.55 * stride : -0.8;
      this.arms[i].rotation.z = (i ? -1 : 1) * (0.05 + Math.sin(time * 1.6) * 0.015 * (1 - stride));
      this.elbows[i].rotation.x = -0.12 - stride * 0.35;
    }
  }
}
