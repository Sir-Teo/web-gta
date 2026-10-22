import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {ScmMission} from '../src/simulation/ScmMission';
import capture from './fixtures/native-object-detach.json';
const script=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm'));
test('encoded DETACH_OBJECT carries angles, push and turn flag through the mission host',()=>{
 const m=new ScmMission(script,{infoLabels:['TEST'],population:[]} as any,{} as any),objects=m.runtime.game.objects,parent=objects.create(1,{x:0,y:0,z:0},{external:false,missionCleanup:false}),o=objects.create(2,{x:10,y:20,z:30},{external:false,missionCleanup:false});
 parent.velocity={x:.1,y:-.2,z:.3};o.mass=25;o.turnMass=50;o.centreOfMass={x:0,y:.2,z:-.1};o.turnSpeed={x:.01,y:.02,z:.03};o.attachedToEntity=true;objects.attach(o.handle,'object',parent.handle,{x:0,y:0,z:1},{x:0,y:0,z:0});
 const code=new Uint8Array(26),view=new DataView(code.buffer);view.setUint16(0,0x682,true);code[2]=1;view.setInt32(3,o.handle,true);for(const[i,n]of[30,-45,.2].entries()){code[7+i*5]=6;view.setFloat32(8+i*5,n,true);}code[22]=4;code[23]=1;view.setUint16(24,0x4e,true);
 const slot=m.runtime.start(0,[],{space:code});slot.thread.usesMissionCleanup=false;slot.thread.run(0,20,1);
 const row=capture.cases.find(r=>r.input.basis[0][0]===1&&r.input.basis[1][1]===1&&r.input.velocity[0]===.1&&r.input.angles[0]===30&&r.input.turn&&r.input.centreOfMass[1]===.2)!;
 expect(Object.values(o.velocity)).toEqual(row.native.velocity);expect(Object.values(o.turnSpeed)).toEqual(row.native.turnSpeed);expect(o.attachedTo).toBeUndefined();expect(o.attachedToEntity).toBe(false);expect(o.isStatic).toBe(false);expect(o.position).toEqual({x:10,y:20,z:30});expect(o.ignoredAttachment).toEqual({kind:'object',handle:parent.handle});expect(m.snapshot().gaveUp).toEqual([]);
});
test('DETACH_OBJECT on an unattached object leaves static state and velocity alone',()=>{
 const m=new ScmMission(script,{infoLabels:['TEST'],population:[]} as any,{} as any),o=m.runtime.game.objects.create(1,{x:1,y:2,z:3},{external:false,missionCleanup:false});
 m.runtime.world!.detachObject!(o.handle,30,45,2,true);expect(o.isStatic).toBe(true);expect(o.velocity).toEqual({x:0,y:0,z:0});expect(o.ignoredAttachment).toBeUndefined();
});
