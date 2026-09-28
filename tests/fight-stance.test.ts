import {expect,test,beforeAll} from 'vitest';
import {readFileSync} from 'node:fs';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation} from '../src/simulation/Simulation';
import {WeaponSystem} from '../src/weapons/WeaponSystem';
import {readWeaponData} from '../src/weapons/weaponData';

beforeAll(async()=>{await RAPIER.init();});
// CTaskSimplePlayerOnFoot::ProcessPlayerWeapon: a melee press with no target makes CTaskSimpleFight(nullptr, 11, 2000):
// the fight task, and with it the fighter control of a standing player, lives two seconds past the last press.
test('an untargeted punch keeps the fight stance for two seconds',()=>{
  const sim=new Simulation(),weapons=new WeaponSystem(sim,()=>undefined,()=>undefined);
  try{
    weapons.inventory.installNative(readWeaponData(readFileSync('public/play/world/files/data/weapon.dat','utf8')));
    sim.player.health=100;sim.player.grounded=true;
    expect(weapons.fightStance).toBe(false);
    expect(weapons.fire({origin:{x:0,y:1,z:0},direction:{x:0,y:0,z:1}})).toBe(true);
    expect(weapons.fightStance).toBe(true);
    weapons.tick(1.9);expect(weapons.fightStance).toBe(true);
    weapons.tick(.2);expect(weapons.fightStance).toBe(false);
  }finally{sim.dispose();}
});
