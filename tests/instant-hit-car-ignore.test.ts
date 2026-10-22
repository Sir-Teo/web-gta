import {readFileSync} from 'node:fs';
import {beforeAll,expect,test,vi} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {instantHitIgnoredVehicle} from '../src/ped/nativeVehicleTargeting';
import {Simulation} from '../src/simulation/Simulation';
import {WeaponSystem} from '../src/weapons/WeaponSystem';
import {readWeaponData} from '../src/weapons/weaponData';
beforeAll(async()=>{await RAPIER.init();});
const native=readWeaponData(new TextDecoder('windows-1252').decode(readFileSync('public/play/world/files/data/weapon.dat')));
const camera={origin:{x:0,y:1.3,z:0},direction:{x:0,y:0,z:-1}};

test('ordinary instant-hit exclusion prefers an unflagged occupied vehicle, then an unflagged attached vehicle',()=>{
 const own={pedTargetable:false},attached={pedTargetable:false};expect(instantHitIgnoredVehicle(true,own,attached)).toBe(own);own.pedTargetable=true;expect(instantHitIgnoredVehicle(true,own,attached)).toBe(attached);attached.pedTargetable=true;expect(instantHitIgnoredVehicle(true,own,attached)).toBeUndefined();
 own.pedTargetable=false;expect(instantHitIgnoredVehicle(false,own,undefined)).toBeUndefined();expect(instantHitIgnoredVehicle(false,undefined,{pedTargetable:false,bike:true})).toMatchObject({bike:true});
});

function fixture(){
 const sim=new Simulation(),body=sim.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,1.3,-2)),wall=sim.world.createCollider(RAPIER.ColliderDesc.cuboid(3,3,.2),body),target=sim.world.createCollider(RAPIER.ColliderDesc.cuboid(3,3,.1).setTranslation(0,1.3,-10));sim.world.step();let damage=0;
 const crowd={damageCollider:(h:number,amount:number)=>{if(h!==target.handle)return false;damage+=amount;return true;},targets:()=>[{id:7,handle:target.handle,position:{x:0,y:1.3,z:-10},health:100}],gunShot:()=>undefined} as any;
 const fleet={cars:[] as any[]},weapons=new WeaponSystem(sim,()=>crowd,()=>fleet as any);weapons.installNative(native);weapons.aiming=true;const carrier={body,pedTargetable:false};weapons.instantHitIgnoredBody=()=>instantHitIgnoredVehicle(false,undefined,carrier)?.body;
 return {sim,weapons,carrier,wall,target,fleet,damage:()=>damage,dispose:()=>{weapons.dispose();sim.dispose();}};
}

test('a collision-disabled attached player can shoot through its unflagged carrier, while enabling the flag exposes its bodywork',()=>{
 const f=fixture(),impact=vi.fn();try{f.sim.playerCollider.setEnabled(false);f.weapons.onPlayerBulletImpact=impact;f.weapons.inventory.select(22);
  expect(f.weapons.fire(camera)).toBe(true);expect(f.damage()).toBeGreaterThan(0);expect(impact).toHaveBeenLastCalledWith(f.target.handle);const first=f.damage();
  f.weapons.inventory.tick(2);f.carrier.pedTargetable=true;expect(f.weapons.fire(camera)).toBe(true);expect(f.damage()).toBe(first);expect(impact).toHaveBeenLastCalledWith(f.wall.handle);
 }finally{f.dispose();}
});

test('native shotgun pellets use the same carrier exclusion as their central shot',()=>{
 const f=fixture();try{f.sim.playerCollider.setEnabled(false);f.weapons.inventory.select(25);expect(f.weapons.fire(camera)).toBe(true);expect(f.damage()).toBeGreaterThan(0);const first=f.damage();f.weapons.inventory.tick(3);f.carrier.pedTargetable=true;expect(f.weapons.fire(camera)).toBe(true);expect(f.damage()).toBe(first);}finally{f.dispose();}
});

test('an ignored vehicle’s analytic wheel spheres cannot intercept a shot after its body is excluded',()=>{
 const f=fixture(),burst=vi.fn(()=>true);try{f.fleet.cars.push({car:{body:f.carrier.body},modelId:400,wrecked:false,wheelSpheres:()=>[{wheel:0,center:{x:0,y:1.3,z:-2},radius:.4}],burstTyre:burst});f.weapons.inventory.select(22);
  expect(f.weapons.fire(camera)).toBe(true);expect(f.damage()).toBeGreaterThan(0);expect(burst).not.toHaveBeenCalled();const first=f.damage();
  f.weapons.inventory.tick(2);f.carrier.pedTargetable=true;expect(f.weapons.fire(camera)).toBe(true);expect(f.damage()).toBe(first);expect(burst).toHaveBeenCalledWith(0,true,'player');
 }finally{f.dispose();}
});

test('the separate drive-by firing path excludes its vehicle even when the normal instant-hit selector returns none',()=>{
 const f=fixture();try{f.carrier.pedTargetable=true;f.weapons.inventory.select(28);const car={occupied:true,wrecked:false,car:{body:f.carrier.body},assets:{}} as any;expect(f.weapons.fireDriveby(car,camera)).toBe(true);expect(f.damage()).toBeGreaterThan(0);}finally{f.dispose();}
});
