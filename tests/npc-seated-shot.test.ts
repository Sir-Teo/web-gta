import {expect,test,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {GangDriveBy} from '../src/simulation/GangDriveBy';
import {readWeaponData,nativeWeaponInfo} from '../src/weapons/weaponData';

test('a gang shooter transfers its muzzle hit to the occupant instead of damaging the vehicle body',()=>{
 const info=nativeWeaponInfo(readWeaponData(readFileSync('public/play/world/files/data/weapon.dat','utf8')),28,1)!;
 const shootingBody={handle:11,translation:()=>({x:0,y:0,z:0}),rotation:()=>({x:0,y:0,z:0,w:1})},hitBody={handle:12};
 const collider={handle:13,parent:()=>hitBody},hit=vi.fn(),damage=vi.fn(),onShot=vi.fn(),seatedShot=vi.fn((..._args:unknown[])=>({t:6,hit}));
 const host={sim:{world:{castRay:()=>({collider}),castRayAndGetNormal:()=>({collider,timeOfImpact:5,normal:{x:1,y:0,z:0}})},player:{health:100,speed:0},playerCollider:{handle:14}},fleet:{cars:[]},gunCache:{info,reloadSeconds:1},seatedShot,onShot};
 const car={car:{body:shootingBody}},target={car:{body:hitBody},damage},unit={car,shooter:{side:'right',seconds:0,shots:0,gunState:{time:0,rounds:info.clip,reload:0,active:false}}};
 for(let i=0;i<120&&!hit.mock.calls.length;i++)(GangDriveBy.prototype as any).stepShooter.call(host,unit,1/60,{x:10,y:0,z:0},target);
 expect(hit).toHaveBeenCalledExactlyOnceWith(info.damage,info.type);expect(damage).not.toHaveBeenCalled();expect(unit.shooter.shots).toBe(1);
 expect(seatedShot.mock.calls[0][3]).toBe(car);expect(seatedShot.mock.calls[0][4]).toBe(hitBody);
 const [from,to]=onShot.mock.calls[0];expect(Math.hypot(to.x-from.x,to.y-from.y,to.z-from.z)).toBeCloseTo(6,8);
});
