import {expect,test} from 'vitest';
import capture from './fixtures/native-object-detach.json';
import {objectDetachMotion} from '../src/engine/nativeObjectDetach';
import {ScmGameState} from '../src/engine/ScmGameState';
const vector=(v:number[])=>({x:v[0],y:v[1],z:v[2]}),identity={right:vector([1,0,0]),forward:vector([0,1,0]),up:vector([0,0,1])};
for(const[rowIndex,row]of capture.cases.entries())test(`native object detach ${rowIndex}: ${JSON.stringify(row.input)}`,()=>{
 const i=row.input,basis={right:vector(i.basis[0]),forward:vector(i.basis[1]),up:vector(i.basis[2])},result=objectDetachMotion(basis,vector(i.velocity),{x:i.angles[0],y:i.angles[1],speed:i.angles[2]},{apply:i.turn,basis:identity,centre:vector(i.centreOfMass),mass:i.turnMass,speed:vector([.01,.02,.03])});
 expect(Object.values(result.velocity)).toEqual(row.native.velocity);expect(Object.values(result.turnSpeed)).toEqual(row.native.turnSpeed);
 expect(row.native.events).toContainEqual({setStatic:false});expect(row.native.attached).toBe(false);expect(row.native.attachedFlag).toBe(false);expect(row.native.ignoredParent).toBe(true);expect(row.native.attachmentBytes).toBe('00'.repeat(40));
});
test('detachment activates a static object, keeps its pose and inherits parent motion',()=>{
 const g=new ScmGameState(),o=g.objects.create(1,{x:1,y:2,z:3},{external:false,missionCleanup:false});g.objects.attach(o.handle,'vehicle',1024,{x:0,y:0,z:-1},{x:0,y:0,z:0});
 g.objects.detach(o.handle,{basis:identity,velocity:{x:.1,y:.2,z:.3},x:0,y:0,speed:0,turn:false});
 expect(o.isStatic).toBe(false);expect(o.attachedToEntity).toBe(false);expect(o.attachedTo).toBeUndefined();expect(o.position).toEqual({x:1,y:2,z:3});expect(o.velocity).toEqual({x:Math.fround(.1),y:Math.fround(.2),z:Math.fround(.3)});expect(o.ignoredAttachment).toEqual({kind:'vehicle',handle:1024});
});
