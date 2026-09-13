import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { houses, type House } from '../world/layout';
import { random } from '../core/math';
import { labelTexture, surfaceTexture } from './textures';

export function buildEnvironment(scene: THREE.Scene) {
  const root = new THREE.Group();
  const textures = {
    asphalt: surfaceTexture('asphalt'), concrete: surfaceTexture('concrete'), grass: surfaceTexture('grass'),
    siding: surfaceTexture('siding'), roof: surfaceTexture('roof'), wood: surfaceTexture('wood'), fence: surfaceTexture('fence'),
  };
  textures.grass.repeat.set(50, 50);
  textures.asphalt.repeat.set(5, 34);
  textures.roof.repeat.set(3, 2);
  textures.siding.repeat.set(2, 2);
  textures.fence.repeat.set(4, 1);
  const materials = new Map<string, THREE.MeshLambertMaterial>();
  const mat = (color: number, map?: THREE.Texture) => {
    const key = `${color}:${map?.uuid ?? ''}`;
    if (!materials.has(key)) materials.set(key, new THREE.MeshLambertMaterial({ color, ...(map ? { map } : {}) }));
    return materials.get(key)!;
  };
  const concrete = mat(0xc2b9a4, textures.concrete), curb = mat(0xc8bda8), trim = mat(0xc9c8b1);
  const darkTrim = mat(0x494d43), glass = mat(0x324548), wood = mat(0x8c8170, textures.wood);
  const metal = mat(0x6a6b60), asphalt = mat(0xcdcdc7, textures.asphalt), trunk = mat(0x8b7960, textures.wood);
  const leaf = new THREE.MeshLambertMaterial({ color: 0x687740, side: THREE.DoubleSide, vertexColors: true });
  const fence = new THREE.MeshLambertMaterial({ map: textures.fence, transparent: true, alphaTest: 0.25, side: THREE.DoubleSide, depthWrite: true });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  function box(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number) {
    const mesh = new THREE.Mesh(boxGeo, material); mesh.position.set(x, y, z); mesh.scale.set(w, h, d);
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  function pole(parent: THREE.Object3D, x: number, y: number, z: number, radius: number, height: number, material = metal) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.85, radius, height, 7), material);
    mesh.position.set(x, y, z); mesh.castShadow = true; parent.add(mesh); return mesh;
  }
  function plane(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, w: number, d: number) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
    mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, y, z); mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  plane(root, mat(0xb7b18b, textures.grass), 0, -0.04, 40, 500, 500);
  // Residential street, its widened turning head, and the cross street.
  plane(root, concrete, 0, 0, 73, 21, 170);
  plane(root, asphalt, 0, 0.014, 82, 14, 164);
  const apron = new THREE.Mesh(new THREE.CircleGeometry(19, 64), concrete);
  apron.rotation.x = -Math.PI / 2; apron.position.y = 0.006; apron.receiveShadow = true; root.add(apron);
  const circleMap = textures.asphalt.clone(); circleMap.repeat.set(5, 5);
  const head = new THREE.Mesh(new THREE.CircleGeometry(16.5, 64), mat(0xcdcdc7, circleMap));
  head.rotation.x = -Math.PI / 2; head.position.y = 0.02; head.receiveShadow = true; root.add(head);
  plane(root, concrete, 0, 0.008, 161, 460, 24);
  plane(root, asphalt, 0, 0.021, 161, 460, 18);
  plane(root, concrete, 0, 0.007, -82, 185, 18);
  plane(root, asphalt, 0, 0.015, -82, 185, 13);
  for (const side of [-1, 1]) {
    box(root, curb, side * 7.2, 0.085, 88, 0.22, 0.2, 145);
    box(root, curb, side * 10.3, 0.07, 86, 0.18, 0.18, 145);
    for (let z = 18; z < 153; z += 3) box(root, mat(0x999587), side * 8.7, 0.016, z, 2.9, 0.012, 0.026);
  }
  const turningCurb = new THREE.Mesh(new THREE.TorusGeometry(16.65, 0.11, 5, 70, Math.PI * 1.72), curb);
  turningCurb.rotation.set(Math.PI / 2, 0, 0.44); turningCurb.position.y = 0.1; root.add(turningCurb);
  for (let x = -220; x < 225; x += 6) {
    box(root, mat(0xb7a875), x, 0.025, 160.8, 3.2, 0.012, 0.12);
    box(root, mat(0xb7a875), x, 0.025, 161.2, 3.2, 0.012, 0.12);
  }
  function roofGeometry(w: number, d: number, height: number) {
    const shape = new THREE.Shape(); shape.moveTo(-w / 2, 0); shape.lineTo(0, height); shape.lineTo(w / 2, 0); shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false }); geometry.translate(0, 0, -d / 2); return geometry;
  }
  function house(h: House, index: number) {
    const group = new THREE.Group(); group.position.set(h.x, 0, h.z); group.rotation.y = h.angle; root.add(group);
    const wall = mat(h.color, textures.siding), roofing = mat(h.roof, textures.roof);
    const lawnMap = textures.grass.clone(); lawnMap.repeat.set(4, 3);
    plane(group, mat(index % 3 === 0 ? 0x9daa7b : 0xb8b18b, lawnMap), 0, -0.025, h.depth / 2 + 4.2, h.width + 1.0, 8.5);
    box(group, concrete, 0, 0.13, 0, h.width + 0.3, 0.3, h.depth + 0.3);
    box(group, wall, 0, h.height / 2 + 0.22, 0, h.width, h.height, h.depth);
    const roof = new THREE.Mesh(roofGeometry(h.width + 0.9, h.depth + 0.9, 2.0), roofing);
    roof.position.y = h.height + 0.22; roof.castShadow = true; roof.receiveShadow = true; group.add(roof);
    box(group, trim, 0, h.height + 0.2, h.depth / 2 + 0.12, h.width + 0.8, 0.16, 0.28);
    box(group, trim, 0, h.height + 0.2, -h.depth / 2 - 0.12, h.width + 0.8, 0.16, 0.28);
    for (let floor = 0; floor < (h.height > 4 ? 2 : 1); floor++) {
      const y = 1.8 + floor * 2.5;
      for (const x of [-h.width * 0.3, h.width * 0.28]) {
        box(group, darkTrim, x, y, h.depth / 2 + 0.055, 1.75, 1.5, 0.1);
        box(group, glass, x, y, h.depth / 2 + 0.12, 1.52, 1.28, 0.05);
        box(group, trim, x, y, h.depth / 2 + 0.16, 0.07, 1.36, 0.06);
        box(group, trim, x, y, h.depth / 2 + 0.16, 1.6, 0.07, 0.06);
        box(group, trim, x, y - 0.77, h.depth / 2 + 0.18, 1.95, 0.12, 0.2);
        // Drawn curtains sit behind the central mullion, leaving dark glass edges.
        box(group, mat(0xa7a997), x - 0.48, y, h.depth / 2 + 0.15, 0.32, 1.18, 0.025);
        box(group, mat(0xa7a997), x + 0.48, y, h.depth / 2 + 0.15, 0.32, 1.18, 0.025);
      }
    }
    box(group, darkTrim, 0.1, 1.43, h.depth / 2 + 0.04, 1.28, 2.43, 0.1);
    box(group, wood, 0.1, 1.4, h.depth / 2 + 0.12, 1.1, 2.26, 0.12);
    box(group, metal, 0.5, 1.3, h.depth / 2 + 0.2, 0.08, 0.12, 0.06);
    box(group, concrete, 0.1, 0.24, h.depth / 2 + 1.3, 5.7, 0.48, 2.5);
    box(group, trim, 0.1, 2.8, h.depth / 2 + 1.2, 6.1, 0.18, 2.8);
    for (const x of [-2.55, 2.75]) box(group, trim, x, 1.55, h.depth / 2 + 2.35, 0.14, 2.7, 0.14);
    for (let i = 0; i < 3; i++) box(group, concrete, 0, 0.07 + i * 0.08, h.depth / 2 + 3.1 - i * 0.3, 2, 0.14 + i * 0.16, 0.4);
    plane(group, concrete, 0, 0.017, h.depth / 2 + 5.6, 1.9, 4.7);
    // Side driveway, low weathered perimeter fence, and mailbox.
    plane(group, concrete, h.width / 2 + 2.4, 0.018, 2.5, 3.5, h.depth + 10);
    for (const side of [-1, 1]) {
      box(group, wood, side * (h.width / 2 + 0.7), 0.65, h.depth / 2 + 3, 0.1, 1.3, 5.5);
      for (let z = 0; z < 6; z += 1.8) box(group, darkTrim, side * (h.width / 2 + 0.7), 0.75, h.depth / 2 + z, 0.13, 1.5, 0.13);
    }
    pole(group, 2.2, 0.6, h.depth / 2 + 7.4, 0.045, 1.2);
    box(group, mat(0x485851), 2.2, 1.25, h.depth / 2 + 7.4, 0.38, 0.3, 0.54);
    const number = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.16), new THREE.MeshBasicMaterial({ map: labelTexture(String(2490 + index * 2), '#333c33', '#dedaca') }));
    number.position.set(0.1, 2.6, h.depth / 2 + 0.15); group.add(number);
    box(group, wall, -h.width * 0.32, h.height + 1.2, -1.5, 0.7, 1.8, 0.8);
  }
  houses.forEach(house);
  const rand = random(191);
  function palm(x: number, z: number, height: number, seed: number) {
    const r = random(seed); const group = new THREE.Group(); group.position.set(x, 0, z); root.add(group);
    const bend = r() * 0.9 - 0.45;
    const trunkMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.29, height, 7, 6), trunk);
    trunkMesh.position.set(bend * 0.5, height / 2, 0); trunkMesh.rotation.z = -bend / height; trunkMesh.castShadow = true; group.add(trunkMesh);
    for (let i = 0; i < 11; i++) {
      const angle = i / 11 * Math.PI * 2 + r() * 0.25, length = 3.0 + r() * 2.4;
      const positions: number[] = [], colors: number[] = [], uvs: number[] = [];
      const points: THREE.Vector3[][] = [];
      for (let j = 0; j <= 8; j++) {
        const t = j / 8, width = Math.sin(Math.PI * t) * 0.57;
        const y = Math.sin(t * Math.PI) * 0.65 - t * t * 1.7;
        const center = new THREE.Vector3(Math.sin(angle) * t * length, y, Math.cos(angle) * t * length);
        points.push([center.clone().add(new THREE.Vector3(Math.cos(angle) * width, -width * 0.15, -Math.sin(angle) * width)), center, center.clone().add(new THREE.Vector3(-Math.cos(angle) * width, -width * 0.15, Math.sin(angle) * width))]);
      }
      for (let j = 0; j < 8; j++) for (let side = 0; side < 2; side++) {
        for (const [a, b] of [[j, side], [j + 1, side], [j + 1, side + 1], [j, side], [j + 1, side + 1], [j, side + 1]]) {
          const p = points[a][b]; positions.push(p.x, p.y, p.z); uvs.push(a / 8, b / 2);
          const shade = 0.64 + (b === 1 ? 0.3 : 0) + r() * 0.14; colors.push(shade, shade, shade * 0.8);
        }
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, leaf); mesh.position.set(bend, height, 0); mesh.castShadow = true; group.add(mesh);
    }
  }
  for (const [x, z, h] of [[-16, -25, 14], [18, -27, 16], [-41, -5, 17], [40, 5, 15], [-17, 23, 14], [18, 42, 17], [-19, 65, 16], [20, 85, 14]]) palm(x, z, h, x * z);
  for (let i = 0; i < 24; i++) palm((rand() > 0.5 ? 1 : -1) * (48 + rand() * 65), -60 + rand() * 250, 11 + rand() * 9, i + 5);
  // Telephone infrastructure frames the street and establishes scale.
  const wireMaterial = new THREE.MeshBasicMaterial({ color: 0x403d33 });
  for (const x of [-12, 12]) {
    for (let z = -8; z <= 142; z += 30) {
      pole(root, x, 5, z, 0.16, 10, trunk);
      box(root, wood, x, 9.0, z, 2.8, 0.12, 0.14);
      for (const offset of [-1.1, 0, 1.1]) {
        pole(root, x + offset, 9.22, z, 0.075, 0.32, darkTrim);
        if (z < 142) {
          const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(x + offset, 9.3, z), new THREE.Vector3(x + offset, 7.5, z + 15), new THREE.Vector3(x + offset, 9.3, z + 30));
          root.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.016, 3, false), wireMaterial));
        }
      }
    }
  }
  for (let z = 10; z < 145; z += 45) {
    pole(root, 10.7, 3.7, z, 0.08, 7.4);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.8, 6), metal); arm.position.set(9.45, 7.3, z); arm.rotation.z = 1.45; root.add(arm);
    box(root, trim, 8.15, 7.43, z, 0.6, 0.12, 0.28);
  }
  for (const x of [-42, -17, 17, 42]) box(root, concrete, x, 4.1, 113, 1.5, 8.2, 7.6);
  box(root, concrete, 0, 8.2, 113, 190, 1.3, 11);
  for (const z of [107.6, 118.4]) {
    box(root, concrete, 0, 9.3, z, 190, 1.1, 0.35);
    box(root, metal, 0, 9.98, z, 190, 0.06, 0.08);
    for (let x = -94; x <= 94; x += 4) box(root, metal, x, 9.7, z, 0.06, 0.6, 0.08);
  }
  // Utility fencing and perimeter scenery remain outside the starter street.
  for (let z = -45; z < 130; z += 12) {
    for (const x of [-48, 48]) {
      pole(root, x, 1, z, 0.04, 2);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(12, 1.8), fence); mesh.position.set(x, 0.95, z + 6); mesh.rotation.y = Math.PI / 2; root.add(mesh);
    }
  }
  const skylineMat = mat(0x9ea7a0);
  for (let i = 0; i < 22; i++) {
    const x = -170 - rand() * 90, z = 175 + rand() * 100, h = 8 + rand() ** 2 * 42;
    box(root, skylineMat, x, h / 2, z, 8 + rand() * 14, h, 9 + rand() * 15);
  }
  const hillMaterial = mat(0x949a78);
  for (let i = 0; i < 9; i++) {
    const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 11, 7), hillMaterial);
    hill.position.set(-220 + i * 60, -10, -290 - rand() * 60);
    hill.scale.set(70 + rand() * 50, 30 + rand() * 25, 60);
    root.add(hill);
  }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshLambertMaterial({ map: labelTexture('GROVE ST', '#355f4b') }));
  sign.position.set(10.7, 3.3, 151); root.add(sign);
  // Merge only by shared material and shadow policy, preserving source transforms.
  root.updateMatrixWorld(true);
  const batches = new Map<string, { material: THREE.Material; geometries: THREE.BufferGeometry[]; cast: boolean; receive: boolean }>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
    const key = `${object.material.uuid}:${object.castShadow}:${object.receiveShadow}`;
    let batch = batches.get(key);
    if (!batch) { batch = { material: object.material, geometries: [], cast: object.castShadow, receive: object.receiveShadow }; batches.set(key, batch); }
    const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld); batch.geometries.push(geometry);
  });
  const result = new THREE.Group(); result.name = 'Grove Street authored district';
  for (const batch of batches.values()) {
    const geometry = mergeGeometries(batch.geometries, false);
    if (!geometry) throw new Error('Static geometry merge failed');
    const mesh = new THREE.Mesh(geometry, batch.material); mesh.castShadow = batch.cast; mesh.receiveShadow = batch.receive; result.add(mesh);
    batch.geometries.forEach(g => g.dispose());
  }
  const originals = new Set<THREE.BufferGeometry>(); root.traverse(o => { if (o instanceof THREE.Mesh) originals.add(o.geometry); }); originals.forEach(g => g.dispose());
  scene.add(result);
  return result;
}
