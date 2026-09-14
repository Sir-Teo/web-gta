import {expect,test} from 'vitest';
import {Group,Matrix4} from 'three';
import {nativeSuspensionLine} from '../src/simulation/nativeSuspension';
import {nativeSuspensionRestPose} from '../src/simulation/nativeSuspensionRestPose';
import {applyNativeWheelRestPose} from '../src/render/nativeWheelRestPose';
import {NATIVE_CAR_WHEELS,type CarWheel} from '../src/simulation/nativeDriveContacts';
function lines(){return Object.fromEntries(NATIVE_CAR_WHEELS.map(w=>[w,nativeSuspensionLine({x:0,y:0,z:-.35},.32,-.2,.7)])) as Parameters<typeof nativeSuspensionRestPose>[0];}
test('Greenwood setup aligns initial wheel centers with the analytic resting height',()=>{
 const pose=nativeSuspensionRestPose(lines(),1.1);expect(pose.frontHeight).toBeCloseTo(.78181818,6);expect(pose.rearHeight).toBe(pose.frontHeight);
 for(const wheel of NATIVE_CAR_WHEELS)expect(pose.positions[wheel]).toBeCloseTo(-.43181818,6);
 expect(()=>nativeSuspensionRestPose(lines(),0)).toThrow(/positive/);
});
test('unequal rear suspension retains the source front-height rule for rear wheel initialization',()=>{
 const input=lines();for(const w of ['rearLeft','rearRight'] as const)input[w]=nativeSuspensionLine({x:0,y:0,z:-.2},.4,-.3,1);
 const result=nativeSuspensionRestPose(input,1);expect(result.frontHeight).toBeCloseTo(.77,6);expect(result.rearHeight).toBeCloseTo(.825,6);
 expect(result.positions.rearLeft).toBeCloseTo(-.27,6);expect(result.positions.rearRight).toBe(result.positions.rearLeft);
});
test('render adapter changes only local Z, resolves frame IDs and validates all targets before writing',()=>{
 const root=new Group(),ids={} as Record<CarWheel,number>;
 NATIVE_CAR_WHEELS.forEach((w,i)=>{ids[w]=i;const g=new Group();g.matrixAutoUpdate=false;g.userData.nativeFrame=i;g.matrix=new Matrix4().makeRotationZ(.5);g.matrix.setPosition(i,2,3);root.add(g);});
 const before=root.children.map(o=>o.matrix.toArray()),pose=nativeSuspensionRestPose(lines(),1.1);
 applyNativeWheelRestPose(root,ids,pose.positions);
 root.children.forEach((g,i)=>{const expected=[...before[i]];expected[14]=pose.positions[NATIVE_CAR_WHEELS[i]];expect(g.matrix.toArray()).toEqual(expected);});
 const saved=root.children.map(o=>o.matrix.toArray());expect(()=>applyNativeWheelRestPose(root,ids,{...pose.positions,rearRight:NaN})).toThrow();expect(root.children.map(o=>o.matrix.toArray())).toEqual(saved);
});
