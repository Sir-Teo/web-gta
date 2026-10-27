import {afterEach,beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation} from '../src/simulation/Simulation';

let sim:Simulation;
beforeAll(async()=>RAPIER.init());
afterEach(()=>{sim?.dispose();sim=undefined as unknown as Simulation;});

test('a player made safe takes nothing from anything, and takes damage again once it is off',()=>{
 sim=new Simulation();sim.respawn={x:0,y:.03,z:0};sim.resetPlayer();
 sim.player.health=100;sim.player.armour=0;
 sim.damagePlayer(30);
 expect(sim.player.health).toBeLessThan(100);
 const hurt=sim.player.health;
 // CPlayerInfo::MakePlayerSafe clears CPlayerData::m_bCanBeDamaged and sets every physicalFlags proof, so
 // nothing reaches the player at all — not even damage that bypasses armour.
 sim.playerCanBeDamaged=false;
 sim.damagePlayer(1000,true);
 expect(sim.player.health).toBe(hurt);
 sim.playerCanBeDamaged=true;
 sim.damagePlayer(10);
 expect(sim.player.health).toBeLessThan(hurt);
});

test('MAKE_PLAYER_FIRE_PROOF turns away molotov and flamethrower damage; the AK recruit cheat turns away every weapon',()=>{
 sim=new Simulation();sim.respawn={x:0,y:.03,z:0};sim.resetPlayer();sim.player.health=100;sim.player.armour=0;
 let fireProof=true,weaponProof=false;sim.playerFireProof=()=>fireProof;sim.playerWeaponProof=()=>weaponProof;
 sim.damagePlayer(20,false,{weapon:37});sim.damagePlayer(20,false,{weapon:18});expect(sim.player.health).toBe(100);
 sim.damagePlayer(10,false,{weapon:22});expect(sim.player.health).toBeLessThan(100);
 const hurt=sim.player.health;weaponProof=true;fireProof=false;
 sim.damagePlayer(10,false,{weapon:31});sim.damagePlayer(10,false,{weapon:37});expect(sim.player.health).toBe(hurt);
 // Explosions (51) and cars (49, 50) are past WEAPON_LAST_WEAPON and still hurt.
 sim.damagePlayer(10,false,{weapon:51});expect(sim.player.health).toBeLessThan(hurt);
});

import {WorldPedestrians} from '../src/simulation/WorldPedestrians';
test('a recruit\'s shot, or a Grove member\'s gun not aimed at CJ, does not hurt him (CEventDamage::AffectsPed)',()=>{
 const affects=(p:object,weapon:number)=>(WorldPedestrians.prototype as any).damagesPlayer.call({},p,weapon);
 expect(affects({follow:true,retaliate:0},22)).toBe(false);
 expect(affects({follow:true,retaliate:0},51)).toBe(true);
 expect(affects({gang:1,pedType:'GANG2',retaliate:0},22)).toBe(false);
 // A Grove member whose kill task is on the player hurts him; so do a Ballas gun and a Grove fist.
 expect(affects({gang:1,pedType:'GANG2',retaliate:3},22)).toBe(true);
 expect(affects({gang:0,pedType:'GANG1',retaliate:0},22)).toBe(true);
 expect(affects({gang:1,pedType:'GANG2',retaliate:0},0)).toBe(true);
});
