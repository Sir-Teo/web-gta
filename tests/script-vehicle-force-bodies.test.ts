import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {WorldCar} from '../src/simulation/WorldCar';
import {WorldBike} from '../src/simulation/WorldBike';
import {WorldBoat} from '../src/simulation/WorldBoat';
import {WorldPlane} from '../src/simulation/WorldPlane';
import capture from './fixtures/native-script-vehicle-force.json';
beforeAll(async()=>{await RAPIER.init();});
for(const[family,prototype]of[['automobile',WorldCar.prototype],['bike',WorldBike.prototype],['boat',WorldBoat.prototype],['aircraft',WorldPlane.prototype]]as const){
 for(const offCentre of[false,true])test(`${family} real body preserves native ${offCentre?'off-centre':'central'} force`,()=>{
  const row=capture.cases.find(r=>r.input.flags===0&&r.input.mass===1000&&r.input.turnMass===2000&&r.input.centre[0]===.2&&r.input.basis[0][0]===1&&r.input.force[2]===.1&&r.input.force[0]===0&&r.input.offset[1]===(offCentre?2:0))!,i=row.input,w=new RAPIER.World({x:0,y:0,z:0});
  try{const body=w.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setAdditionalMassProperties(i.mass,{x:i.centre[0],y:i.centre[2],z:-i.centre[1]},{x:i.turnMass,y:i.turnMass,z:i.turnMass},{x:0,y:0,z:0,w:1}));w.step();body.setLinvel({x:i.linear[0]*50,y:i.linear[2]*50,z:-i.linear[1]*50},true);body.setAngvel({x:i.angular[0]*50,y:i.angular[2]*50,z:-i.angular[1]*50},true);
   const host={body,car:{body},mass:i.mass,turnMass:i.turnMass,assets:{handling:{values:{mass:i.mass,turnMass:i.turnMass}}},handling:{values:{mass:i.mass,turnMass:i.turnMass}}};
   prototype.applyScriptForce.call(host as never,{x:i.force[0],y:i.force[1],z:i.force[2]},{x:i.offset[0],y:i.offset[1],z:i.offset[2]});
   const f=Math.fround;expect(body.linvel()).toEqual({x:f(row.native.linear[0]*50),y:f(row.native.linear[2]*50),z:f(-row.native.linear[1]*50)});expect(body.angvel()).toEqual({x:f(row.native.angular[0]*50),y:f(row.native.angular[2]*50),z:f(-row.native.angular[1]*50)});
  }finally{w.free();}
 });
}
test('a script force leaves the host frozen-position controller in charge',()=>{
 const w=new RAPIER.World({x:0,y:0,z:0});try{const body=w.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setAdditionalMass(1000));w.step();body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased,true);WorldCar.prototype.applyScriptForce.call({car:{body},mass:1000,turnMass:2000,frozen:true}as never,{x:0,y:0,z:.1},{x:0,y:0,z:0});w.step();expect(body.isKinematic()).toBe(true);expect(body.translation()).toEqual({x:0,y:0,z:0});}finally{w.free();}
});
