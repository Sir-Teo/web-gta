import {expect,test,vi} from 'vitest';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';

function reaches(source:object,weapon=22,grouped=false){const inPlayerGroup=vi.fn(()=>grouped),host={inPlayerGroup};return {accepted:(WorldPedestrians.prototype as any).damagesPlayer.call(host,source,weapon),inPlayerGroup};}
test('actual GANG2 type protects CJ even when the model has no gang assignment',()=>{
 expect(reaches({pedType:'GANG2',retaliate:0}).accepted).toBe(false);
});
test('CREATE_CHAR GANG2 type overrides a rival model when protecting CJ',()=>{
 expect(reaches({pedType:'GANG1',scriptPedType:8,gang:0,retaliate:0}).accepted).toBe(false);
});
test('a civilian CREATE_CHAR in Families clothing has no native Families immunity',()=>{
 expect(reaches({pedType:'GANG2',scriptPedType:4,gang:1,retaliate:0}).accepted).toBe(true);
});
test('a known script-group member spares CJ without the street follow flag',()=>{
 const r=reaches({pedType:'COP',retaliate:1},22,true);expect(r.accepted).toBe(false);
});
test('an explicit Families kill-ped task on CJ permits the damage',()=>{
 expect(reaches({pedType:'GANG2',gang:1,retaliate:1}).accepted).toBe(true);
});
test('a Families kill task on another ped does not permit stray player damage',()=>{
 expect(reaches({pedType:'GANG2',gang:1,retaliate:1,foe:{} }).accepted).toBe(false);
});
test('family immunity starts at WEAPON_GRENADE while a nonmember can punch',()=>{
 expect(reaches({pedType:'GANG2',gang:1,retaliate:0},15).accepted).toBe(true);
 expect(reaches({pedType:'GANG2',gang:1,retaliate:0},16).accepted).toBe(false);
});
test('known script groups retain the native explosion exception',()=>{
 expect(reaches({pedType:'COP',retaliate:0},51,true).accepted).toBe(true);
});
test('known group membership still rejects a Families kill-task bullet on CJ',()=>{
 expect(reaches({pedType:'GANG2',gang:1,retaliate:1},22,true).accepted).toBe(false);
});

test('raw vehicle creators do not enter the native ped-only gates',async()=>{
 const {npcPedCanDamagePlayer}=await import('../src/ped/nativeNpcPlayerDamage');expect(npcPedCanDamagePlayer(undefined,22,{sameGroup:true})).toBe(true);
});
test('the Families gate still precedes the group explosion exception',async()=>{
 const {npcPedCanDamagePlayer}=await import('../src/ped/nativeNpcPlayerDamage');expect(npcPedCanDamagePlayer({pedType:'GANG2'},51,{sameGroup:true})).toBe(false);expect(npcPedCanDamagePlayer({pedType:'GANG2'},51,{sameGroup:true,killTaskTargetsPlayer:true})).toBe(true);
});
