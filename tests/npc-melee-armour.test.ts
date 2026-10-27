import {expect,test,vi} from 'vitest';
import reference from './fixtures/ped-armour-reference.json';
import {spendPedArmourFloat32} from '../src/ped/damage';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';
import {CHEATS} from '../src/simulation/nativeCheats';

for(const row of reference.cases)test(`native armour capture weapon=${row.weapon} factor=${row.damage} armour=${row.armour}`,()=>{
 expect(spendPedArmourFloat32(row.damage,row.armour,row.weapon)).toEqual({armour:row.remainingArmour,damageHealth:row.damageHealth,damageArmour:row.damageArmour});
});

function fixture(health:number,armour:number){
 const source={id:11,pedType:'CIVMALE',attackMult:1,actor:{player:{position:{x:0,y:0,z:-1}}}},victim={id:7,pedType:'CIVFEMALE',health,armour,defendMult:1.1,actor:{player:{position:{x:0,y:0,z:0},heading:0}},view:{hasReaction:()=>false},down:0,retaliate:0};
 const host=Object.assign(Object.create(WorldPedestrians.prototype),{people:[source,victim],sameScriptGroup:()=>false,onKill:vi.fn(),onMeleeHit:vi.fn(),damageReaction:vi.fn(()=>({})),applyReaction:vi.fn(()=>false)});
 return {source,victim,host,hit:(damage=25)=>host.strikeFoe(source,victim,2,damage)};
}
test.each([
 {mode:'one',health:28.5,armour:0,expectedHealth:1,expectedArmour:0,healthResponse:27.5,armourResponse:0},
 {mode:'absorbed',health:100,armour:40,expectedHealth:100,expectedArmour:12.5,healthResponse:0,armourResponse:27.5},
 {mode:'partial',health:1.5,armour:27,expectedHealth:1,expectedArmour:0,healthResponse:.5,armourResponse:27},
 {mode:'below',health:28,armour:0,expectedHealth:0,expectedArmour:0,healthResponse:28,armourResponse:0},
])('NPC fist $mode preserves native armour/health and passes calculator response to animation',row=>{
 const f=fixture(row.health,row.armour);f.hit();expect(f.victim.health).toBe(row.expectedHealth);expect(f.victim.armour).toBe(row.expectedArmour);expect(f.host.onKill).toHaveBeenCalledTimes(row.expectedHealth?0:1);
 expect(f.host.damageReaction.mock.calls[0][2]).toBe(row.healthResponse);expect(f.host.damageReaction.mock.calls[0][9]).toBe(row.armourResponse);expect(f.victim).toHaveProperty('lastWeaponDamage',0);
});
test.each(['proof','only player'])('NPC fist rejection for %s spends neither armour nor health',mode=>{
 const f=fixture(100,40);Object.assign(f.victim,mode==='proof'?{proofs:{melee:true}}:{onlyDamagedByPlayer:true});f.hit();expect(f.victim.health).toBe(100);expect(f.victim.armour).toBe(40);expect(f.host.damageReaction).not.toHaveBeenCalled();expect(f.host.onKill).not.toHaveBeenCalled();
});
test('NPC fist strength is rounded before weakness and partial armour',()=>{
 const f=fixture(100,1);f.source.attackMult=1.3;f.hit(6);const damage=Math.fround(Math.fround(6*Math.fround(1.3))*Math.fround(1.1)),remaining=Math.fround(damage-1);expect(f.victim.health).toBe(Math.fround(100-remaining));expect(f.victim.armour).toBe(0);expect(f.host.damageReaction.mock.calls[0][2]).toBe(remaining);expect(f.host.damageReaction.mock.calls[0][9]).toBe(1);
});
test('NPC fist reads the native attack-strength float before multiplication',()=>{
 const f=fixture(100,0);f.source.attackMult=1.3;f.victim.defendMult=1;f.hit(6);expect(f.host.damageReaction.mock.calls[0][2]).toBe(Math.fround(Math.fround(6)*Math.fround(1.3)));
});
test.each(['street','script'])('NPC fist on a protected %s groupmate is rejected before armour',kind=>{
 const f=fixture(100,40);if(kind==='street'){Object.assign(f.source,{follow:true});Object.assign(f.victim,{follow:true});}else f.host.sameScriptGroup=()=>true;
 f.hit();expect(f.victim.health).toBe(100);expect(f.victim.armour).toBe(40);expect(f.host.damageReaction).not.toHaveBeenCalled();expect(f.host.onMeleeHit).not.toHaveBeenCalled();
});
test.each([0,1])('native player source type %s retains its group-damage exception',scriptPedType=>{
 const f=fixture(100,40);f.host.sameScriptGroup=()=>true;Object.assign(f.source,{scriptPedType});f.hit();expect(f.victim.health).toBe(100);expect(f.victim.armour).toBe(12.5);
});
test('equal noncivilian types can land a fist blow outside a shared group',()=>{
 const f=fixture(100,40);f.source.pedType=f.victim.pedType='COP';f.hit();expect(f.victim.health).toBe(100);expect(f.victim.armour).toBe(12.5);
});
test('mega punch spends the ordinary armour factor before forcing the whole health response',()=>{
 const f=fixture(100,40);CHEATS.enable('megaPunch');try{f.hit();expect(f.victim.health).toBe(0);expect(f.victim.armour).toBe(12.5);expect(f.host.onKill).toHaveBeenCalledOnce();expect(f.host.damageReaction.mock.calls[0][2]).toBe(100);expect(f.host.damageReaction.mock.calls[0][9]).toBe(27.5);}finally{CHEATS.disable('megaPunch');}
});
test('a sub-ULP fist retains a positive response when stored native HP does not change',()=>{
 const f=fixture(100,0);f.hit(1e-8);expect(f.victim.health).toBe(100);expect(f.host.damageReaction.mock.calls[0][2]).toBe(Math.fround(Math.fround(1e-8)*Math.fround(1.1)));expect(f.host.onKill).not.toHaveBeenCalled();
});
