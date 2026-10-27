import {expect,test,vi} from 'vitest';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';

for(const entry of ['npc','player','remote'])for(const mode of ['quantized','tiny','armour','fatal'])test(`${entry} ${mode} bullet reports the native calculator response independently of stored HP loss`,()=>{
 const health=mode==='quantized'?2**30:mode==='fatal'?28:100,armour=mode==='armour'?40:0,damage=mode==='tiny'?1e-8:25,factor=Math.fround(Math.fround(damage)*Math.fround(1.1)),absorbed=Math.min(factor,armour),remaining=Math.fround(factor-absorbed),ped={id:7,health,armour,defendMult:1.1,noCriticalHits:true,pedType:'CIVFEMALE',collider:{handle:12},actor:{player:{position:{x:0,y:0,z:0},heading:0}},view:{hasReaction:()=>false}} as any;
 const host=Object.assign(Object.create(WorldPedestrians.prototype),{people:[ped],onKill:vi.fn(),noteEvent:vi.fn(),hitPiece:()=>3,applyReaction:vi.fn(),damageReaction:vi.fn(()=>({})),damageResponse:vi.fn(()=>true),sameScriptGroup:()=>false}) as any;
 const accepted=entry==='npc'?host.npcBulletHit(12,damage,22,{x:0,z:1},{x:0,y:1,z:0},3):host.damageCollider(12,damage,{x:0,z:1},'bullet',{weapon:22,piece:3,point:{x:0,y:1,z:0},byPlayer:entry==='player'});
 expect(accepted).toBeTruthy();expect(ped.health).toBe(mode==='fatal'?0:Math.fround(health-remaining));expect(ped.armour).toBe(Math.fround(armour-absorbed));expect(host.damageReaction.mock.calls[0][2]).toBe(mode==='fatal'?health:remaining);expect(host.damageReaction.mock.calls[0][9]).toBe(absorbed);expect(ped.lastWeaponDamage).toBe(22);expect(host.onKill).toHaveBeenCalledTimes(mode==='fatal'?1:0);
});
