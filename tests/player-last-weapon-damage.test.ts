import {expect,test} from 'vitest';
import {Simulation} from '../src/simulation/Simulation';

const player=(extra:object={})=>({player:{health:100,armour:0,speed:0},playerCanBeDamaged:true,damageEvents:[],deathRemaining:0,lastWeaponDamage:-1,...extra} as any);
const hurt=(sim:any,amount:number,event?:object)=>(Simulation.prototype as any).damagePlayer.call(sim,amount,false,event);

test('the player keeps the weapon of a hit that took health, and a fall as WEAPON_FALL',()=>{
 const sim=player();
 hurt(sim,10,{weapon:22});expect(sim.lastWeaponDamage).toBe(22);
 hurt(sim,10,{weapon:0,fall:true});expect(sim.lastWeaponDamage).toBe(54);
 // Damage with no event (a hazard the port has no weapon for) leaves it as it was.
 hurt(sim,5);expect(sim.lastWeaponDamage).toBe(54);
});

test('a hit the armour soaks up whole is no health lost, so the weapon is not kept',()=>{
 const sim=player({player:{health:100,armour:100,speed:0}});
 hurt(sim,10,{weapon:31});expect(sim.lastWeaponDamage).toBe(-1);
 expect(sim.player.health).toBe(100);
});
