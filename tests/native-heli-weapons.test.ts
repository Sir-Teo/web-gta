import {expect,test} from 'vitest';
import {heliWeaponRequests,nativeAircraftGunRequest} from '../src/simulation/nativeHeliWeapons';
import capture from './fixtures/native-heli-weapons.json';
const v=(a:readonly number[])=>({x:a[0],y:a[1],z:a[2]});
for(const [index,row]of capture.cases.entries())test(`native helicopter gun and rocket capture ${index}`,()=>{
 const i=row.input,launch=row.native.launches[0];
 expect(heliWeaponRequests(v(i.position),v(i.basis[0]),v(i.basis[1]),v(i.target),i.selection,i.now,i.previous)).toEqual({
  guns:row.native.guns,rocket:launch?{origin:v(launch.origin),direction:v(launch.direction)}:undefined,
 });
});
test('no weapon target issues no gun or rocket request',()=>{
 const p={x:0,y:0,z:0};expect(nativeAircraftGunRequest(p,{x:0,y:1,z:0},undefined,0)).toBe(false);
 expect(heliWeaponRequests(p,{x:1,y:0,z:0},{x:0,y:1,z:0},undefined,0,250,249)).toEqual({guns:false,rocket:undefined});
});
