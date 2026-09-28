import {expect,test,beforeAll} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation} from '../src/simulation/Simulation';
import {WeaponSystem} from '../src/weapons/WeaponSystem';
import type {WorldBike} from '../src/simulation/WorldBike';

beforeAll(async()=>{await RAPIER.init();});
// A rider's drive-by: FIXED_FWD ahead of the bike when neither look key is held, else out of the looked-to side; the
// same SMG set as a car's, and nothing from an unoccupied bike.
function setup(){
  const sim=new Simulation(),weapons=new WeaponSystem(sim,()=>undefined,()=>undefined);
  const body=sim.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,1,0));
  const bike={occupied:true,wrecked:false,modelId:522,body,assets:{collision:{bounds:{max:[.4,.6,1.2],min:[-.4,0,-1.2]}}}} as unknown as WorldBike;
  return {sim,weapons,bike};
}
const camera={origin:{x:0,y:2.2,z:8},direction:{x:0,y:-0.05,z:-1}};
test('the rider shoots ahead, or out of the side he looks to',()=>{
  const {sim,weapons,bike}=setup();
  try{
    weapons.inventory.give(28,50);
    expect(weapons.fireDrivebyBike(bike,camera,'forward')).toBe(true);
    let tracer=weapons.effects.filter(e=>e.kind==='tracer').at(-1)!;
    // Ahead of the bike (its forward is -z) and no way out to a side.
    expect(tracer.from.z).toBeLessThan(0);expect(Math.abs(tracer.from.x)).toBeLessThan(.05);
    weapons.tick(1);
    expect(weapons.fireDrivebyBike(bike,camera,'left')).toBe(true);
    tracer=weapons.effects.filter(e=>e.kind==='tracer').at(-1)!;
    expect(tracer.from.x).toBeLessThan(-.5);
    weapons.tick(1);
    expect(weapons.fireDrivebyBike(bike,camera,'right')).toBe(true);
    tracer=weapons.effects.filter(e=>e.kind==='tracer').at(-1)!;
    expect(tracer.from.x).toBeGreaterThan(.5);
    weapons.tick(1);
    weapons.inventory.give(22,20);weapons.inventory.select(22);
    expect(weapons.fireDrivebyBike(bike,camera,'forward')).toBe(false);
    (bike as {occupied:boolean}).occupied=false;weapons.inventory.select(28);
    expect(weapons.fireDrivebyBike(bike,camera,'forward')).toBe(false);
  }finally{sim.dispose();}
});
