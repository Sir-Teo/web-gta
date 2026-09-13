import { expect, test } from 'vitest';
import * as THREE from 'three';
import { applySurfaceUV } from '../src/render/surfaceUV';

test('surface tiles preserve metre scale on long pavement, vertical walls and sloping roofs', () => {
  for (const transform of [
    new THREE.Matrix4().makeScale(3, 130, 1),
    new THREE.Matrix4().makeRotationX(Math.PI / 2).scale(new THREE.Vector3(3, 130, 1)),
    new THREE.Matrix4().makeRotationY(0.7).multiply(new THREE.Matrix4().makeRotationX(0.45)).scale(new THREE.Vector3(12, 8, 1)),
  ]) {
    const geometry = new THREE.PlaneGeometry(1, 1).toNonIndexed(); geometry.applyMatrix4(transform);
    applySurfaceUV(geometry, 3);
    const position = geometry.getAttribute('position'), uv = geometry.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < position.count; i += 3) for (let j = 0; j < 3; j++) {
      const a = i + j, b = i + (j + 1) % 3;
      const worldLength = new THREE.Vector3().fromBufferAttribute(position, a).distanceTo(new THREE.Vector3().fromBufferAttribute(position, b));
      const uvLength = new THREE.Vector2().fromBufferAttribute(uv, a).distanceTo(new THREE.Vector2().fromBufferAttribute(uv, b));
      expect(uvLength * 3).toBeCloseTo(worldLength, 4);
    }
    geometry.dispose();
  }
});
