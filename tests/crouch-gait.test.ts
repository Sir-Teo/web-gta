import { expect, test } from 'vitest';
import * as THREE from 'three';
import { CharacterVisual } from '../src/render/character';
import { crouchFootTarget } from '../src/render/crouchGait';

test('crouch soles stay above the ground throughout a stride and stance transition', () => {
  const rig = new CharacterVisual();
  for (const amount of [0.1, 0.25, 0.5, 0.75, 1]) for (let i = 0; i <= 64; i++) {
    const phase = i * Math.PI / 32;
    rig.animate(phase, 1.4, true, 0); rig.poseCrouched(amount, phase, 1.4); rig.root.updateMatrixWorld(true);
    for (const name of ['left-foot', 'right-foot']) {
      const foot = rig.root.getObjectByName(name)!;
      expect(new THREE.Box3().setFromObject(foot).min.y).toBeGreaterThan(0.02);
      const up = new THREE.Vector3(0, 1, 0).transformDirection(foot.matrixWorld);
      expect(up.y).toBeCloseTo(1, 5);
    }
  }
  rig.animate(0.8, 3.7, true, 0); rig.root.updateMatrixWorld(true);
  const standing = rig.root.getObjectByName('left-foot')!.matrixWorld.clone();
  rig.poseCrouched(0.000001, 0.8, 3.7); rig.root.updateMatrixWorld(true);
  expect(rig.root.getObjectByName('left-foot')!.matrixWorld.equals(standing)).toBe(true);
  rig.animate(0, 0, true, 0); rig.poseSeated(1, 0); rig.root.updateMatrixWorld(true);
  const seated = rig.root.getObjectByName('left-foot')!.matrixWorld.clone();
  rig.animate(0, 0, true, 0); rig.poseCrouched(1, 0, 0); rig.poseSeated(1, 0); rig.root.updateMatrixWorld(true);
  expect(rig.root.getObjectByName('left-foot')!.matrixWorld.equals(seated)).toBe(true);
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  rig.root.traverse(o => { if (o instanceof THREE.Mesh) { geometries.add(o.geometry); materials.add(o.material as THREE.Material); } });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
});

test('the planted foot travels backward at movement speed through its stance interval', () => {
  const speed = 1.4, dt = 1 / 60, phase = 1;
  const before = crouchFootTarget(phase, speed), after = crouchFootTarget(phase + speed * dt * 6, speed);
  expect(after.z - before.z).toBeCloseTo(-speed * dt, 5);
  expect(before.y).toBe(after.y);
});
