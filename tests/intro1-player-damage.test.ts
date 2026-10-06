import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation} from '../src/simulation/Simulation';

beforeAll(async()=>{await RAPIER.init();});

// iOS CPedDamageResponseCalculator::ComputeWillKillPed (0x10028a1b8): when the damaged ped is the player and intro1
// heads pActiveScripts, m_fDamageFactor × 0.77 (0x3F451EB8), after armour.
test('CJ takes 0.77 of a hit while intro1 heads the script list',()=>{
 const hit=(head:string|undefined,armour=0)=>{const sim=new Simulation();sim.player.health=100;sim.player.armour=armour;sim.headScriptName=()=>head;sim.damagePlayer(20,false,{weapon:22});return sim;};
 const plain=100-hit(undefined).player.health;
 expect(100-hit('INTRO1').player.health).toBeCloseTo(plain*Math.fround(.77),5);
 expect(100-hit('intro').player.health).toBeCloseTo(plain,9);
 // Armour soaks first: what gets through is scaled.
 const armoured=hit('INTRO1',5);expect(armoured.player.armour).toBe(0);
 expect(100-armoured.player.health).toBeCloseTo((plain-5)*Math.fround(.77),5);
});
