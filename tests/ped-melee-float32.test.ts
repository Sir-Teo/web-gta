import {expect,test,vi} from 'vitest';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';

function fixture(health:number,armour=0){
 const ped={id:7,health,armour,defendMult:1.1,pedType:'CIVMALE',collider:{handle:12},actor:{player:{position:{x:0,y:0,z:0},heading:0}},view:{hasReaction:()=>false}} as any;
 const host=Object.assign(Object.create(WorldPedestrians.prototype),{people:[ped],onKill:vi.fn(),noteEvent:vi.fn(),hitPiece:()=>3,applyReaction:vi.fn(),damageReaction:vi.fn(()=>({})),damageResponse:vi.fn(()=>true)}) as any;
 return {ped,host,hit:(damage=25)=>host.damageCollider(12,damage,{x:0,z:1},'melee',{weapon:5,fight:{move:2}})};
}
test.each([
 {mode:'one',health:83.5,armour:0,after:1,armourAfter:0,response:82.5,absorbed:0},
 {mode:'armour',health:100,armour:100,after:100,armourAfter:17.5,response:0,absorbed:82.5},
 {mode:'partial',health:1.5,armour:82,after:1,armourAfter:0,response:.5,absorbed:82},
 {mode:'below',health:83,armour:0,after:0,armourAfter:0,response:83,absorbed:0},
])('player melee $mode preserves native float health, armour and damage response',row=>{
 const f=fixture(row.health,row.armour);expect(f.hit()).toBeTruthy();expect(f.ped.health).toBe(row.after);expect(f.ped.armour).toBe(row.armourAfter);expect(f.host.onKill).toHaveBeenCalledTimes(row.after?0:1);expect(f.host.damageReaction.mock.calls[0][2]).toBe(row.response);expect(f.host.damageReaction.mock.calls[0][9]).toBe(row.absorbed);
});
test('a player-friendly melee blow preserves exact one HP before the recruit leaves',()=>{
 const f=fixture(9.25);f.ped.follow=true;f.hit();expect(f.ped.health).toBe(1);expect(f.ped.follow).toBe(false);expect(f.host.damageReaction.mock.calls[0][2]).toBe(8.25);expect(f.host.onKill).not.toHaveBeenCalled();
});
test('player melee still retains the native friendly damage cap',()=>{
 const f=fixture(13.5);f.ped.follow=true;f.hit(100);expect(f.ped.health).toBe(1);expect(f.host.damageReaction.mock.calls[0][2]).toBe(12.5);
});
test('a normal player jab rounds the native strength and weakness operations',()=>{
 const factor=Math.fround(Math.fround(6*3)*Math.fround(1.1)),f=fixture(Math.fround(factor+1));f.hit(6);expect(f.ped.health).toBe(1);expect(f.host.damageReaction.mock.calls[0][2]).toBe(factor);
});
test('player melee preserves positive response when native HP rounding hides loss',()=>{
 const factor=Math.fround(Math.fround(6*3)*Math.fround(1.1)),f=fixture(2**30);f.hit(6);expect(f.ped.health).toBe(2**30);expect(f.host.damageReaction.mock.calls[0][2]).toBe(factor);expect(f.ped.lastWeaponDamage).toBe(5);
});
test('a sub-ULP player melee blow preserves its native response',()=>{
 const factor=Math.fround(Math.fround(Math.fround(1e-8)*3)*Math.fround(1.1)),f=fixture(100);f.hit(1e-8);expect(f.ped.health).toBe(100);expect(f.host.damageReaction.mock.calls[0][2]).toBe(factor);
});
test('melee proofing rejects before armour and native animation response',()=>{
 const f=fixture(100,100);f.ped.proofs={melee:true};expect(f.hit()).toBe(false);expect(f.ped.health).toBe(100);expect(f.ped.armour).toBe(100);expect(f.host.damageReaction).not.toHaveBeenCalled();
});
