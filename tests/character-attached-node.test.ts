import {expect,test} from 'vitest';
import {Bone,Group,Matrix4,Vector3} from 'three';
import {NativeCharacter} from '../src/render/NativeCharacter';

test('an attached gunflash follows current actor and bone locals even while Three bone worlds are stale',()=>{
 const root=new Group(),hand=new Bone(),gun=new Group(),flash=new Group();root.add(hand);hand.add(gun);gun.add(flash);
 hand.matrixAutoUpdate=false;hand.matrixWorldAutoUpdate=false;hand.matrix.makeTranslation(.3,1.2,0);
 gun.matrixAutoUpdate=false;gun.matrix.makeTranslation(0,0,-.2);flash.matrixAutoUpdate=false;flash.matrix.makeTranslation(0,0,-.4);root.updateMatrixWorld(true);
 root.position.set(2490,13,1680);root.rotation.y=Math.PI/2;
 const actor=Object.assign(Object.create(NativeCharacter.prototype),{root,chainScratch:[],worldScratch:new Matrix4()}) as NativeCharacter;
 const expected=new Vector3(.3,1.2,-.6).applyAxisAngle(new Vector3(0,1,0),Math.PI/2).add(root.position),before=actor.nodePosition(flash);
 for(const axis of ['x','y','z'] as const)expect(before[axis]).toBeCloseTo(expected[axis],8);
 expect(flash.getWorldPosition(new Vector3()).distanceTo(expected)).toBeGreaterThan(1000);
 hand.matrix.makeTranslation(.5,1.1,0);root.position.x+=2;
 const moved=new Vector3(.5,1.1,-.6).applyAxisAngle(new Vector3(0,1,0),Math.PI/2).add(root.position),after=actor.nodePosition(flash);
 for(const axis of ['x','y','z'] as const)expect(after[axis]).toBeCloseTo(moved[axis],8);
});
