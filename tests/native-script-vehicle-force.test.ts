import {expect,test} from 'vitest';
import capture from './fixtures/native-script-vehicle-force.json';
import {nativeScriptVehicleForce} from '../src/simulation/nativeScriptVehicleForce';
const vector=(v:number[])=>({x:v[0],y:v[1],z:v[2]});
for(const[index,row]of capture.cases.entries())test(`native vehicle force ${index} flags=${row.input.flags}`,()=>{
 const i=row.input,r=nativeScriptVehicleForce({mass:i.mass,turnMass:i.turnMass,force:vector(i.force),offset:vector(i.offset),centreOfMass:vector(i.centre),basis:{right:vector(i.basis[0]),forward:vector(i.basis[1]),up:vector(i.basis[2])},linear:vector(i.linear),angular:vector(i.angular),flags:i.flags});
 expect(Object.values(r.linear)).toEqual(row.native.linear);expect(Object.values(r.angular)).toEqual(row.native.angular);expect(r.effectiveMass).toBe(row.native.effectiveMass);
});
