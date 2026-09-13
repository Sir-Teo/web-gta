import * as THREE from 'three';
import { batchVehicleParts } from './batchVehicleParts';
import { CharacterVisual } from './character';
import { labelTexture } from './textures';
import type { Vehicle } from '../simulation/Simulation';

export class VehicleVisual {
  readonly root = new THREE.Group();
  readonly wheels: THREE.Group[] = [];
  readonly tires: THREE.Group[] = [];
  readonly driverDoor = new THREE.Group();
  private driver?: CharacterVisual;
  private beam = new THREE.SpotLight(0xffe1b2, 0, 42, 0.48, 0.65, 2);
  private headlightMaterial = new THREE.MeshBasicMaterial({ color: 0xe8dbad });
  private tailMaterial = new THREE.MeshLambertMaterial({ color: 0x983f30, emissive: 0xff3215, emissiveIntensity: 0.015 });
  constructor(readonly vehicle: Vehicle) {
    if (vehicle.traffic) {
      this.driver = new CharacterVisual(0x817c69); this.driver.animate(0, 0, true, 0); this.driver.poseSeated(1, 0);
      this.driver.root.position.set(0.42, -0.78, 0.05); this.root.add(this.driver.root);
    }
    const paint = new THREE.MeshPhongMaterial({ color: vehicle.color, shininess: 24, specular: 0x535348 });
    const vinyl = new THREE.MeshLambertMaterial({ color: 0x37403b });
    const chrome = new THREE.MeshPhongMaterial({ color: 0xacaea2, shininess: 50 });
    const rubber = new THREE.MeshLambertMaterial({ color: 0x252a29 });
    const glass = new THREE.MeshPhongMaterial({ color: 0x273b3c, shininess: 60, specular: 0xb6c0a7, transparent: true, opacity: 0.52, depthWrite: false, side: THREE.DoubleSide });
    const headlight = this.headlightMaterial, red = this.tailMaterial;
    this.beam.position.set(0, 0.02, 2.36); this.beam.target.position.set(0, -0.6, 22);
    this.beam.shadow.mapSize.set(512, 512); this.beam.shadow.normalBias = 0.04;
    this.root.add(this.beam, this.beam.target);
    const box = (mat: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, parent: THREE.Object3D = this.root) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
    };
    // Separate floor, engine bay, quarters and doors leave a real cabin opening.
    box(paint, 0, -0.21, 0, 1.84, 0.14, 4.45);
    box(paint, 0, 0.04, 1.66, 1.84, 0.42, 1.12);
    box(paint, 0, 0.04, -1.72, 1.84, 0.42, 1.01);
    box(paint, 0, 0.31, 1.26, 1.8, 0.1, 1.85);
    box(paint, 0, 0.33, -1.66, 1.8, 0.12, 1.05);
    box(vinyl, 0, -0.1, -0.1, 1.6, 0.12, 2.4);
    box(vinyl, 0, 0.27, 0.86, 1.6, 0.18, 0.35);
    for (const x of [-0.42, 0.42]) {
      box(vinyl, x, 0.08, -0.08, 0.57, 0.18, 0.65);
      box(vinyl, x, 0.36, -0.39, 0.58, 0.55, 0.16);
      box(vinyl, x, 0.67, -0.39, 0.3, 0.17, 0.13);
    }
    box(vinyl, 0, 0.1, -0.88, 1.48, 0.22, 0.45);
    const steering = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.022, 6, 16), rubber);
    steering.position.set(0.42, 0.47, 0.54); steering.rotation.x = -0.45; this.root.add(steering);
    const windscreen = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.942), glass);
    windscreen.position.set(0, 0.635, 0.865); windscreen.rotation.x = -Math.atan2(0.57, 0.75); this.root.add(windscreen);
    const rearGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.845), glass);
    rearGlass.position.set(0, 0.635, -1.035); rearGlass.rotation.x = Math.atan2(0.39, 0.75); this.root.add(rearGlass);
    box(paint, 0, 1.015, -0.14, 1.68, 0.09, 1.47);
    const sideWindow = (parent: THREE.Object3D, x: number, offsetZ: number, points: number[]) => {
      const positions: number[] = [];
      for (let i = 0; i < points.length; i += 2) positions.push(x, points[i + 1], points[i] - offsetZ);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setIndex([0, 1, 2, 0, 2, 3]); geometry.computeVertexNormals();
      parent.add(new THREE.Mesh(geometry, glass));
    };
    for (const side of [-1, 1]) {
      const door = side === 1 ? this.driverDoor : new THREE.Group();
      door.position.set(side * 0.9, 0, 1.05); this.root.add(door);
      box(paint, 0, 0.06, -0.57, 0.09, 0.4, 1.19, door);
      box(vinyl, -side * 0.065, 0.06, -0.57, 0.035, 0.31, 1.07, door);
      sideWindow(door, -side * 0.08, 1.05, [-0.115, 0.3, 1.1, 0.3, 0.58, 0.97, -0.115, 0.97]);
      box(paint, -side * 0.07, 0.64, -1.165, 0.055, 0.74, 0.055, door);
      box(paint, -side * 0.07, 0.99, -0.825, 0.06, 0.05, 0.73, door);
      box(chrome, side * 0.055, 0.25, -0.57, 0.035, 0.055, 1.19, door);
      box(vinyl, side * 0.055, -0.13, -0.57, 0.03, 0.065, 1.19, door);
      box(chrome, side * 0.07, 0.2, -0.96, 0.045, 0.065, 0.21, door);
      box(paint, side * 0.1, 0.48, -0.19, 0.22, 0.14, 0.22, door);
      box(paint, side * 0.9, 0.04, -0.7, 0.09, 0.43, 1.15);
      sideWindow(this.root, side * 0.8, 0, [-1.23, 0.3, -0.16, 0.3, -0.16, 0.97, -0.84, 0.97]);
      box(paint, side * 0.822, 0.64, -0.14, 0.055, 0.74, 0.075);
      box(chrome, side * 0.93, 0.25, -0.73, 0.035, 0.055, 1.13);
      box(chrome, side * 0.945, 0.2, -1.01, 0.045, 0.065, 0.21);
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
    batchVehicleParts(this.root);
  }
  dispose() { this.beam.shadow.dispose(); }
  update(alpha: number, night = 0, driven = false) {
    if (this.driver) this.driver.root.visible = !this.vehicle.traffic!.claimed;
    const on = (driven || this.vehicle.traffic && !this.vehicle.traffic.claimed) && night > 0.01;
    this.beam.intensity = on ? night * 350 : 0;
    this.beam.castShadow = !!on && driven;
    this.headlightMaterial.color.set(on ? 0xffe5b2 : 0xb0b5a4).multiplyScalar(on ? 1 + night : 1);
    this.tailMaterial.emissiveIntensity = this.vehicle.brakeLights ? 1.0 : on ? 0.3 * night : 0.015;
    this.driverDoor.rotation.y = -this.vehicle.door * 1.12;
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
