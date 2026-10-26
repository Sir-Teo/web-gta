import {expect,test,vi} from 'vitest';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';

function fixture(member=true,follow=false){
 const p={id:7,pedType:'GANG2',health:100,armour:0,defendMult:1.1,noCriticalHits:true,follow,down:0,retaliate:0,collider:{handle:12,setShape:vi.fn()},actor:{player:{position:{x:0,y:0,z:0},heading:0}},view:{hasReaction:()=>false,playReaction:vi.fn()}} as any;
 const inPlayerGroup=vi.fn((source:any)=>member&&source===p),host=Object.assign(Object.create(WorldPedestrians.prototype),{people:[p],inPlayerGroup,sameScriptGroup:()=>false,onKill:vi.fn(),noteEvent:vi.fn(),hitPiece:()=>3,applyReaction:vi.fn(),damageReaction:vi.fn(()=>({})),damageResponse:vi.fn(()=>true)}) as any;
 return {p,host,inPlayerGroup};
}
for(const kind of ['bullet','melee'] as const)test(`a script group member without follow receives native friendly ${kind} scaling`,()=>{
 const f=fixture(),factor=kind==='bullet'?2.75:8.25;f.p.health=Math.fround(factor+1);f.host.damageCollider(12,25,{x:0,z:1},kind,{weapon:kind==='bullet'?22:5,piece:3});expect(f.p.health).toBe(1);expect(f.host.damageReaction.mock.calls[0][2]).toBe(factor);expect(f.inPlayerGroup).toHaveBeenCalledWith(f.p);expect(f.host.onKill).not.toHaveBeenCalled();
});
test('an actual script-group member without follow supplies no weapon practice',()=>{
 const f=fixture();expect(f.host.trainsSkill(12)).toBe(false);expect(f.inPlayerGroup).toHaveBeenCalledWith(f.p);
});
test('a removed script member can supply practice again',()=>{
 const f=fixture(false);expect(f.host.trainsSkill(12)).toBe(true);
});
test('legacy street follow membership still excludes practice without a script resolver',()=>{
 const f=fixture(false,true);f.host.inPlayerGroup=undefined;expect(f.host.trainsSkill(12)).toBe(false);
});
test('dead or unknown targets never supply practice',()=>{
 const f=fixture();f.p.health=0;expect(f.host.trainsSkill(12)).toBe(false);expect(f.host.trainsSkill(99)).toBe(false);expect(f.inPlayerGroup).not.toHaveBeenCalled();
});
for(const entry of ['player','remote','npc','fist','fire'])test(`${entry} death retains actual player-group membership without follow for native kill accounting`,()=>{
 const f=fixture();f.p.health=1;
 if(entry==='player'||entry==='remote')f.host.damageCollider(12,25,{x:0,z:1},'bullet',{weapon:22,piece:3,byPlayer:entry==='player'});
 else if(entry==='npc')f.host.npcBulletHit(12,25,22,{x:0,z:1},{x:0,y:1,z:0},3,{pedType:'COP'});
 else if(entry==='fist')f.host.strikeFoe({pedType:'CIVMALE',attackMult:1,actor:{player:{position:{x:0,y:0,z:-1}}}},f.p,2,25);
 else f.host.burn(f.p,25,false);
 expect(f.p.health).toBe(0);expect(f.host.onKill).toHaveBeenCalledOnce();expect(f.host.onKill.mock.calls[0][0]).toMatchObject({id:7,pedType:'GANG2',recruit:true,byPlayer:entry==='player'});
});
test('nonmembers retain the ordinary outgoing bullet factor',()=>{
 const f=fixture(false);f.host.damageCollider(12,25,{x:0,z:1},'bullet',{weapon:22,piece:3});expect(f.p.health).toBe(72.5);expect(f.host.damageReaction.mock.calls[0][2]).toBe(27.5);
});
test('an authoritatively removed script member can supply practice while its follow flag is stale',()=>{
 const f=fixture(false,true);expect(f.host.trainsSkill(12)).toBe(true);
});
test('an authoritatively removed script member takes the ordinary factor despite a stale follow flag',()=>{
 const f=fixture(false,true);f.host.damageCollider(12,25,{x:0,z:1},'bullet',{weapon:22,piece:3});expect(f.p.health).toBe(72.5);expect(f.host.damageReaction.mock.calls[0][2]).toBe(27.5);
});
test('a stale follow flag does not add recruited-member kill credit after actual script removal',()=>{
 const f=fixture(false,true);f.p.health=1;f.host.npcBulletHit(12,25,22,{x:0,z:1},{x:0,y:1,z:0},3,{pedType:'COP'});expect(f.host.onKill).toHaveBeenCalledOnce();expect(f.host.onKill.mock.calls[0][0]).toMatchObject({recruit:false,byPlayer:false});
});
