import { expect, test } from 'vitest';
import * as THREE from 'three';
import { unionPlacedBounds, assertPlacedBounds } from '../src/assets/ModelObjects';
import type { IplInstance } from '../src/assets/ipl';

function placement(x: number, y: number, z: number): IplInstance {
  return { modelName: 'test', modelId: 1, position: [x, y, z], rotation: [0, 0, 0, 1], lodIndex: -1, interior: 0 } as unknown as IplInstance;
}

test('placed bounds map native offsets through the Y-up rotation', () => {
  const source = new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
  const root = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
  // Native (x,y,z) renders at (x,z,-y): (10,20,30) -> (10,30,-20).
  const union = unionPlacedBounds(source, root, [placement(10, 20, 30)]);
  expect(union.min.toArray().map(v => Math.round(v * 1e6) / 1e6)).toEqual([9, 29, -21]);
  expect(union.max.toArray().map(v => Math.round(v * 1e6) / 1e6)).toEqual([11, 31, -19]);
});

test('placed bounds union across placements', () => {
  const source = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(2, 2, 2));
  const root = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
  const union = unionPlacedBounds(source, root, [placement(0, 0, 0), placement(100, 0, 0)]);
  // First at (0,0,0)->(0..2, 0..2 mapped), second shifted +100 in x.
  expect(union.min.x).toBeCloseTo(0, 6);
  expect(union.max.x).toBeCloseTo(102, 6);
});

test('placed bounds validation keeps the coordinate limit', () => {
  assertPlacedBounds(new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(10, 10, 10)));
  expect(() => assertPlacedBounds(new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(2e7, 0, 0)))).toThrow('Placed model bounds exceed the coordinate limit.');
});

test('empty source bounds stay empty', () => {
  const empty = new THREE.Box3(); empty.makeEmpty();
  const union = unionPlacedBounds(empty, new THREE.Matrix4(), [placement(0, 0, 0)]);
  expect(union.isEmpty()).toBe(true);
});
