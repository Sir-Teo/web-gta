import * as THREE from 'three';

/** Planar, metre-scaled UVs for non-indexed static triangles after their world transform. */
export function applySurfaceUV(geometry: THREE.BufferGeometry, tileSize: number) {
  const positions = geometry.getAttribute('position');
  const uv = new Float32Array(positions.count * 2);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const normal = new THREE.Vector3(), u = new THREE.Vector3(), v = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0), east = new THREE.Vector3(1, 0, 0);
  for (let i = 0; i < positions.count; i += 3) {
    a.fromBufferAttribute(positions, i); b.fromBufferAttribute(positions, i + 1); c.fromBufferAttribute(positions, i + 2);
    normal.crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize();
    // Walls retain horizontal courses; roof and ground tiles follow the surface slope.
    if (Math.abs(normal.y) > 0.5) u.copy(east).addScaledVector(normal, -normal.x).normalize();
    else u.crossVectors(up, normal).normalize();
    v.crossVectors(normal, u).normalize();
    for (const [offset, point] of [a, b, c].entries()) {
      uv[(i + offset) * 2] = point.dot(u) / tileSize;
      uv[(i + offset) * 2 + 1] = point.dot(v) / tileSize;
    }
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
