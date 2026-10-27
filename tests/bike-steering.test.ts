import {expect,test} from 'vitest';
import {Group,Vector3} from 'three';
import {bikeForkRotation,bindBikeSteering} from '../src/render/bikeSteering';

test('native fork axis uses the model rake: an upright fork yaws left and a horizontal fork pitches',()=>{
 const forward=new Vector3(0,1,0).applyMatrix4(bikeForkRotation(0,Math.PI/2));expect(forward.x).toBeCloseTo(-1);expect(forward.y).toBeCloseTo(0);expect(forward.z).toBeCloseTo(0);
 const right=new Vector3(1,0,0).applyMatrix4(bikeForkRotation(90,Math.PI/2));expect(right.x).toBeCloseTo(0);expect(right.y).toBeCloseTo(0);expect(right.z).toBeCloseTo(1);
 for(const rake of [16,23]){const left=new Vector3(0,1,0).applyMatrix4(bikeForkRotation(rake,.4)),right=new Vector3(0,1,0).applyMatrix4(bikeForkRotation(rake,-.4));expect(left.x).toBeLessThan(0);expect(left.x).toBeCloseTo(-right.x);expect(left.y).toBeCloseTo(right.y);expect(left.z).toBeCloseTo(right.z);}
});
test('the fork replaces its native rest basis, holds its mounting point and carries its child wheel without drift',()=>{
 const root=new Group(),fork=new Group(),wheel=new Group();root.add(fork);fork.add(wheel);fork.matrixAutoUpdate=false;fork.userData.nativeFrame=1;fork.matrix.makeRotationX(.1).setPosition(0,.6,.2);wheel.position.set(0,.1,-.4);
 const bind=bindBikeSteering(root,{frames:[{name:'root'},{name:'forks_front'}] as any},16);bind.update(0);expect(fork.matrix.elements.slice(12,15)).toEqual([0,.6,.2]);expect(new Vector3(0,1,0).transformDirection(fork.matrix).toArray()).toEqual([0,1,0]);
 bind.update(.4);root.updateMatrixWorld(true);const point=wheel.getWorldPosition(new Vector3());expect(Math.abs(point.x)).toBeGreaterThan(.001);expect(point.distanceTo(new Vector3(0,.6,.2))).toBeCloseTo(Math.hypot(.1,.4));expect(fork.parent).toBe(root);expect(wheel.parent).toBe(fork);const matrix=fork.matrix.clone();bind.update(.4);expect(fork.matrix.equals(matrix)).toBe(true);
 expect(()=>bind.update(NaN)).toThrow();expect(fork.matrix.equals(matrix)).toBe(true);
});
