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

// iOS ComputeWillKillPed reads m_aCheatsActive[0x45], CHEAT_INFINITE_HEALTH (BAGUVIX), not the AK recruit cheat.
test('under BAGUVIX CJ takes no gunfire, but a fall or a blast still hurts',async()=>{
 const {CHEATS,playerWeaponProofCheat}=await import('../src/simulation/nativeCheats');
 const hit=(weapon:number)=>{const sim=new Simulation();sim.player.health=100;sim.playerWeaponProof=playerWeaponProofCheat;sim.damagePlayer(20,false,{weapon});return 100-sim.player.health;};
 try{
  CHEATS.enable('recruitAk');expect(hit(22)).toBeGreaterThan(0);CHEATS.disable('recruitAk');
  CHEATS.enable('infiniteHealth');
  expect(hit(22)).toBe(0);expect(hit(46)).toBe(0);
  expect(hit(51)).toBeGreaterThan(0);expect(hit(54)).toBeGreaterThan(0);
 }finally{CHEATS.reset();}
});

// AccountForPedDamageStats: from a ped CJ is friendly with, a tenth of the scaled damage, 12.5 at most, any weapon.
test('a friend\'s hit on CJ is cut to a tenth, 12.5 at most',async()=>{
 const {NATIVE_PLAYER_DAMAGE_MULT}=await import('../src/simulation/Simulation');
 const hit=(amount:number,friendly:boolean,weapon=22)=>{const sim=new Simulation();sim.player.health=100;sim.damagePlayer(amount,false,{weapon,friendly});return 100-sim.player.health;};
 expect(hit(30,false)).toBeCloseTo(30*NATIVE_PLAYER_DAMAGE_MULT,4);
 expect(hit(30,true)).toBeCloseTo(30*NATIVE_PLAYER_DAMAGE_MULT*Math.fround(.1),4);
 expect(hit(1000,true,51)).toBeCloseTo(12.5,4);
});
