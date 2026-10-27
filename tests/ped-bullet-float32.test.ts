import {expect,test,vi} from 'vitest';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';

function fixture(health=28.5,armour=0){
 const ped={id:7,health,armour,defendMult:1.1,noCriticalHits:true,pedType:'CIVFEMALE',collider:{handle:12},actor:{player:{position:{x:0,y:0,z:0},heading:0}},view:{reactionPlayedOut:false,reactionName:'ko_shot_front',hasReaction:()=>false}} as any;
 const host=Object.assign(Object.create(WorldPedestrians.prototype),{people:[ped],onKill:vi.fn(),noteEvent:vi.fn(),hitPiece:()=>3,applyReaction:vi.fn(),damageReaction:vi.fn(()=>({})),damageResponse:vi.fn(()=>true),sameScriptGroup:()=>false}) as any;
 return {ped,host};
}
for(const entry of ['npc','player','remote'])test(`${entry} body hits preserve an exact native one-HP remainder after STAT weakness`,()=>{
 const f=fixture();const hit=entry==='npc'?f.host.npcBulletHit(12,25,22,{x:0,z:1},{x:0,y:1,z:0},3):f.host.damageCollider(12,25,{x:0,z:1},'bullet',{weapon:22,piece:3,point:{x:0,y:1,z:0},byPlayer:entry==='player'});expect(hit).toBeTruthy();expect(f.ped.health).toBe(1);expect(f.host.onKill).not.toHaveBeenCalled();
});
for(const entry of ['npc','player','remote'])test(`${entry} armour keeps its native float32 remainder after STAT weakness`,()=>{
 const f=fixture(100,40);if(entry==='npc')f.host.npcBulletHit(12,25,22,{x:0,z:1},{x:0,y:1,z:0},3);else f.host.damageCollider(12,25,{x:0,z:1},'bullet',{weapon:22,piece:3,point:{x:0,y:1,z:0},byPlayer:entry==='player'});expect(f.ped.health).toBe(100);expect(f.ped.armour).toBe(12.5);
});
for(const entry of ['npc','player','remote'])test(`${entry} partial armour leaves exactly one HP through both native subtractions`,()=>{
 const f=fixture(1.5,27);if(entry==='npc')f.host.npcBulletHit(12,25,22,{x:0,z:1},{x:0,y:1,z:0},3);else f.host.damageCollider(12,25,{x:0,z:1},'bullet',{weapon:22,piece:3,point:{x:0,y:1,z:0},byPlayer:entry==='player'});expect(f.ped.health).toBe(1);expect(f.ped.armour).toBe(0);expect(f.host.onKill).not.toHaveBeenCalled();
});
for(const entry of ['npc','player','remote'])test(`${entry} still dies when the native remainder is below one`,()=>{
 const f=fixture(28,0);if(entry==='npc')f.host.npcBulletHit(12,25,22,{x:0,z:1},{x:0,y:1,z:0},3);else f.host.damageCollider(12,25,{x:0,z:1},'bullet',{weapon:22,piece:3,point:{x:0,y:1,z:0},byPlayer:entry==='player'});expect(f.ped.health).toBe(0);expect(f.host.onKill).toHaveBeenCalledOnce();
});
test('the native float32 friendly bullet factor also preserves an exact one-HP remainder',()=>{
 const f=fixture(3.75,0);f.ped.follow=true;f.host.damageCollider(12,25,{x:0,z:1},'bullet',{weapon:22,piece:3,point:{x:0,y:1,z:0},byPlayer:true});expect(f.ped.health).toBe(1);expect(f.host.onKill).not.toHaveBeenCalled();
});
