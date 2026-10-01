import {expect,test,beforeAll} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation} from '../src/simulation/Simulation';
import {WeaponSystem} from '../src/weapons/WeaponSystem';

beforeAll(async()=>{await RAPIER.init();});

test('a bullet line passes a shoot-through box (a chain-link fence) and stops at the wall behind it',()=>{
  const sim=new Simulation(),weapons=new WeaponSystem(sim,()=>undefined,()=>undefined);
  try{
    // A fence box 0.4 thick at x=5 and a wall at x=12, across the line.
    const fence=sim.world.createCollider(RAPIER.ColliderDesc.cuboid(.2,2,5).setTranslation(5,1,0));
    sim.world.createCollider(RAPIER.ColliderDesc.cuboid(.2,2,5).setTranslation(12,1,0));
    sim.world.step();
    const origin={x:0,y:1,z:0},along={x:1,y:0,z:0};
    // Without the surface table's say-so the fence stops the bullet.
    expect(weapons.lineOfFire(origin,along,30)).toBeCloseTo(4.8,3);
    (weapons as any).fx={isShootThrough:(hit:RAPIER.RayColliderIntersection)=>hit.collider.handle===fence.handle};
    expect(weapons.lineOfFire(origin,along,30)).toBeCloseTo(11.8,3);
    // Nothing behind it: the line runs its full range.
    expect(weapons.lineOfFire({x:0,y:1,z:20},along,8)).toBeUndefined();
  }finally{sim.dispose();}
});
