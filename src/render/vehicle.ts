import * as THREE from 'three';
import { labelTexture } from './textures';
import type { Vehicle } from '../simulation/Simulation';

export class VehicleVisual {
  readonly root = new THREE.Group();
  readonly wheels: THREE.Group[] = [];
  readonly tires: THREE.Group[] = [];
  constructor(readonly vehicle: Vehicle) {
    const paint = new THREE.MeshPhongMaterial({ color: vehicle.color, shininess: 24, specular: 0x535348 });
    const vinyl = new THREE.MeshLambertMaterial({ color: 0x37403b });
    const chrome = new THREE.MeshPhongMaterial({ color: 0xacaea2, shininess: 50 });
    const rubber = new THREE.MeshLambertMaterial({ color: 0x252a29 });
    const glass = new THREE.MeshPhongMaterial({ color: 0x273b3c, shininess: 60, specular: 0xb6c0a7 });
    const headlight = new THREE.MeshBasicMaterial({ color: 0xe8dbad });
    const red = new THREE.MeshLambertMaterial({ color: 0x983f30, emissive: 0x301008 });
    const box = (mat: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, parent: THREE.Object3D = this.root) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
    };
    box(paint, 0, 0, 0, 1.84, 0.52, 4.45);
    box(paint, 0, 0.31, 1.26, 1.8, 0.1, 1.85);
    box(paint, 0, 0.33, -1.66, 1.8, 0.12, 1.05);
    // Sloped glasshouse and roof retain the long hood / squared sedan silhouette.
    const profile = new THREE.Shape(); profile.moveTo(-1.23, 0.26); profile.lineTo(-0.84, 1.01); profile.lineTo(0.58, 1.01); profile.lineTo(1.15, 0.26); profile.closePath();
    const cabinGeo = new THREE.ExtrudeGeometry(profile, { depth: 1.6, bevelEnabled: false });
    cabinGeo.rotateY(-Math.PI / 2); cabinGeo.translate(0.8, 0, 0);
    const cabin = new THREE.Mesh(cabinGeo, glass); cabin.castShadow = true; this.root.add(cabin);
    box(paint, 0, 1.015, -0.14, 1.68, 0.09, 1.47);
    for (const side of [-1, 1]) {
      box(paint, side * 0.822, 0.64, -0.13, 0.055, 0.74, 0.075);
      box(chrome, side * 0.93, 0.25, 0, 0.035, 0.055, 4.24);
      box(vinyl, side * 0.929, -0.13, 0, 0.03, 0.065, 4.18);
      for (const z of [-0.78, 0.58]) {
        box(chrome, side * 0.945, 0.2, z, 0.045, 0.065, 0.24);
        box(vinyl, side * 0.93, 0.0, z + 0.21, 0.015, 0.4, 0.018);
      }
      box(paint, side * 1.0, 0.48, 0.86, 0.22, 0.14, 0.22);
      box(chrome, side * 0.63, -0.06, 2.25, 0.53, 0.27, 0.09);
      for (const shift of [-0.14, 0.14]) box(headlight, side * 0.63 + shift, -0.03, 2.3, 0.23, 0.19, 0.035);
      box(red, side * 0.68, 0.02, -2.25, 0.43, 0.22, 0.05);
    }
    box(chrome, 0, -0.21, 2.27, 1.9, 0.11, 0.14);
    box(chrome, 0, -0.2, -2.28, 1.9, 0.12, 0.13);
    box(rubber, 0, -0.02, 2.256, 0.61, 0.23, 0.025);
    for (let x = -0.25; x <= 0.25; x += 0.08) box(chrome, x, -0.02, 2.275, 0.025, 0.2, 0.02);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.16), new THREE.MeshBasicMaterial({ map: labelTexture('LS 1992', '#d1ceae', '#253f49') }));
    plate.position.set(0, -0.03, -2.32); plate.rotation.y = Math.PI; this.root.add(plate);
    for (let i = 0; i < 4; i++) {
      const x = i % 2 ? 0.91 : -0.91, z = i < 2 ? 1.4 : -1.4;
      const pivot = new THREE.Group(); pivot.position.set(x, -0.27, z); this.root.add(pivot); this.wheels.push(pivot);
      const rolling = new THREE.Group(); pivot.add(rolling); this.tires.push(rolling);
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.22, 16), rubber); tire.rotation.z = Math.PI / 2; tire.castShadow = true; rolling.add(tire);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.235, 12), chrome); hub.rotation.z = Math.PI / 2; rolling.add(hub);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.25, 10), vinyl); cap.rotation.z = Math.PI / 2; rolling.add(cap);
    }
  }
  update(alpha: number) {
    const p = this.vehicle.body.translation();
    this.root.position.set(THREE.MathUtils.lerp(this.vehicle.previous.x, p.x, alpha), THREE.MathUtils.lerp(this.vehicle.previous.y, p.y, alpha), THREE.MathUtils.lerp(this.vehicle.previous.z, p.z, alpha));
    this.root.quaternion.copy(this.vehicle.body.rotation());
    for (let i = 0; i < 4; i++) {
      this.wheels[i].rotation.y = i < 2 ? this.vehicle.steer : 0;
      this.wheels[i].position.y = -0.04 - (this.vehicle.controller.wheelSuspensionLength(i) ?? 0.24);
      this.tires[i].rotation.x = this.vehicle.controller.wheelRotation(i) ?? 0;
    }
  }
}
