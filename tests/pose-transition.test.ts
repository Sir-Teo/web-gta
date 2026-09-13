import { expect, test } from 'vitest';
import { Object3D, Quaternion, Vector3 } from 'three';
import { PoseTransition } from '../src/animation/PoseTransition';
test('blends position rotation and scale with exact endpoints', () => {
  const target=new Object3D();target.matrixAutoUpdate=false;
  const blend=new PoseTransition([target]);
  const destination=target.matrix.clone().compose(new Vector3(2,4,6),new Quaternion().setFromAxisAngle(new Vector3(0,0,1),Math.PI/2),new Vector3(2,2,2));
  target.matrix.copy(destination);blend.apply(.5);
  const p=new Vector3(),q=new Quaternion(),s=new Vector3();target.matrix.decompose(p,q,s);
  expect(p.toArray()).toEqual([1,2,3]);expect(s.x).toBeCloseTo(1.5);expect(new Vector3(1,0,0).applyQuaternion(q).x).toBeCloseTo(Math.SQRT1_2);
  target.matrix.copy(destination);blend.apply(0);expect(target.matrix.elements).toEqual(new Object3D().matrix.elements);
  target.matrix.copy(destination);blend.apply(1);expect(target.matrix.elements).toEqual(destination.elements);
});
test('interrupted blends start from the current composite pose and rest reset prevents accumulation', () => {
  const target=new Object3D(),blend=new PoseTransition([target]);
  target.matrix.makeTranslation(10,0,0);blend.apply(.4);expect(target.matrix.elements[12]).toBeCloseTo(4);
  blend.capture();target.matrix.makeTranslation(-2,0,0);blend.apply(0);expect(target.matrix.elements[12]).toBeCloseTo(4);
  target.matrix.makeTranslation(-2,0,0);blend.apply(.5);expect(target.matrix.elements[12]).toBeCloseTo(1);
  blend.restoreTargets();expect(target.matrix.elements[12]).toBe(0);
});
