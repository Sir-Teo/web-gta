import { expect, test } from 'vitest';
import * as THREE from 'three';
import { batchVehicleParts } from '../src/render/batchVehicleParts';

test('batching preserves local transforms, moving groups, glass and shared geometry ownership', () => {
  const root = new THREE.Group(), paint = new THREE.MeshBasicMaterial(), glass = new THREE.MeshBasicMaterial({ transparent: true });
  const shared = new THREE.BoxGeometry(1, 1, 1); let disposed = false;
  shared.addEventListener('dispose', () => disposed = true);
  const left = new THREE.Mesh(shared, paint), right = new THREE.Mesh(shared, paint);
  left.position.x = -2; left.scale.x = 2; right.position.x = 2;
  left.castShadow = right.castShadow = true; root.add(left, right);
  const wheel = new THREE.Group(), tire = new THREE.Mesh(shared, paint); wheel.add(tire); root.add(wheel);
  const window = new THREE.Mesh(shared, glass); root.add(window);
  const unshadowed = new THREE.Mesh(shared, paint); root.add(unshadowed);
  batchVehicleParts(root);
  expect(root.children).toContain(wheel); expect(root.children).toContain(window); expect(root.children).toContain(unshadowed);
  expect(tire.parent).toBe(wheel); expect(disposed).toBe(false);
  const body = root.children.find(o => o.name === 'Batched vehicle body') as THREE.Mesh;
  expect(body.material).toBe(paint); expect(body.castShadow).toBe(true);
  expect(body.geometry.boundingBox!.min.x).toBe(-3); expect(body.geometry.boundingBox!.max.x).toBe(2.5);
  expect(body.geometry.getAttribute('position').count).toBe(72);
  expect(body.geometry.getAttribute('uv').count).toBe(72);
  wheel.rotation.y = 0.4; root.updateMatrixWorld(true); expect(tire.matrixWorld.elements[0]).toBeCloseTo(Math.cos(0.4));
  body.geometry.dispose(); shared.dispose(); paint.dispose(); glass.dispose();
});
