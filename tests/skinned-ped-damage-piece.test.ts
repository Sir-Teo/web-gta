import {expect,test,vi} from 'vitest';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';

function fixture(bulletProofVest=false){
 const ped={id:3,health:100,defendMult:1,bulletProofVest,pedType:'CIVMALE',collider:{handle:12},actor:{player:{position:{x:0,y:0,z:0},heading:0}},view:{}} as any;
 const host={people:[ped],hitPiece:()=>9,noteEvent:vi.fn(),damageReaction:vi.fn(()=>({})),applyReaction:()=>true,damageResponse:()=>true,onKill:vi.fn()} as any;
 const hit=(piece:number)=>WorldPedestrians.prototype.damageCollider.call(host,12,25,{x:0,z:1},'bullet',{weapon:22,piece,point:{x:0,y:1.6,z:0}});
 return {ped,host,hit};
}
test('a raised native arm piece overrides the old height-based head classification in damage and reactions',()=>{
 const f=fixture();f.hit(5);expect(f.ped.health).toBe(75);expect(f.host.damageReaction.mock.calls[0][8]).toBe(5);expect(f.host.onKill).not.toHaveBeenCalled();
 expect(WorldPedestrians.prototype.bulletImpact.call(f.host,12,{x:0,y:1.6,z:0},5)).toEqual({head:false,dead:false});
});
test('an actual native head piece retains critical death',()=>{
 const f=fixture();f.hit(9);expect(f.ped.health).toBe(0);expect(f.host.onKill).toHaveBeenCalledOnce();
});
test('native pieces feed the vest gate: torso is blocked, a raised arm is not',()=>{
 const f=fixture(true);expect(f.hit(3)).toBe(false);expect(f.ped.health).toBe(100);expect(f.host.damageReaction).not.toHaveBeenCalled();f.hit(5);expect(f.ped.health).toBe(75);
});
