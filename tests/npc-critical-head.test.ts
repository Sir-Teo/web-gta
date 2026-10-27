import {afterEach,expect,test,vi} from 'vitest';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';

afterEach(()=>vi.restoreAllMocks());
function fixture(){
 const ped={id:7,health:5000,armour:40,defendMult:1,pedType:'CIVFEMALE',collider:{handle:12},actor:{player:{position:{x:0,y:0,z:0}}},view:{reactionPlayedOut:false,reactionName:'ko_shot_front',hasReaction:()=>false}} as any;
 const host=Object.assign(Object.create(WorldPedestrians.prototype),{people:[ped],onKill:vi.fn(),noteEvent:vi.fn(),hitPiece:()=>3,applyReaction:vi.fn(),damageReaction:vi.fn(()=>({})),sameScriptGroup:vi.fn(()=>false)}) as any;
 const hit=(weapon=22,piece=9)=>host.npcBulletHit(12,10,weapon,{x:0,z:1},{x:0,y:1.6,z:0},piece,{pedType:'COP'});
 return {ped,host,hit};
}
// Independently emulated iOS 0x10028a4b0: nonplayer foot victims, raw nonplayer source, samples 0..7.
test.each([22,23,24,25,26,27,28,29,30,31,32,38,52])('weapon %s forces only the zero low-three-bit critical outcome',weapon=>{
 for(let sample=0;sample<8;sample++){
  const f=fixture(),random=vi.spyOn(Math,'random').mockReturnValue(sample/32768);expect(f.hit(weapon)).toBe(true);expect(f.ped.health).toBe(sample===0?0:5000);expect(f.ped.armour).toBe(30);expect(f.host.onKill).toHaveBeenCalledTimes(sample===0?1:0);expect(random).toHaveBeenCalledOnce();random.mockRestore();
 }
});
test.each([33,34])('rifle %s forces a native head death without consuming RNG',weapon=>{
 const f=fixture(),random=vi.spyOn(Math,'random').mockReturnValue(7/32768);expect(f.hit(weapon)).toBe(true);expect(f.ped.health).toBe(0);expect(f.ped.armour).toBe(30);expect(f.host.onKill).toHaveBeenCalledOnce();expect(random).not.toHaveBeenCalled();
});
test.each([22,33,34,38,52])('no-critical-hits retains ordinary armour spending for weapon %s',weapon=>{
 const f=fixture(),random=vi.spyOn(Math,'random').mockReturnValue(0);f.ped.noCriticalHits=true;expect(f.hit(weapon)).toBe(true);expect(f.ped.health).toBe(5000);expect(f.ped.armour).toBe(30);expect(f.host.onKill).not.toHaveBeenCalled();expect(random).not.toHaveBeenCalled();
});
test('a body hit consumes the ordinary gun draw but never forces head death',()=>{
 const f=fixture(),random=vi.spyOn(Math,'random').mockReturnValue(0);expect(f.hit(22,3)).toBe(true);expect(f.ped.health).toBe(5000);expect(f.ped.armour).toBe(30);expect(random).toHaveBeenCalledOnce();
});
test.each(['proof','type','group'])('rejected %s contacts spend neither armour nor critical RNG',mode=>{
 const f=fixture(),random=vi.spyOn(Math,'random').mockReturnValue(0);if(mode==='proof')f.ped.proofs={bullet:true};if(mode==='type')f.ped.pedType='COP';if(mode==='group')f.host.sameScriptGroup.mockReturnValue(true);expect(f.hit()).toBe(false);expect(f.ped.health).toBe(5000);expect(f.ped.armour).toBe(40);expect(random).not.toHaveBeenCalled();
});
test('a counted corpse accepts another contact without critical RNG or another death',()=>{
 const f=fixture();f.ped.health=0;const random=vi.spyOn(Math,'random').mockReturnValue(0);expect(f.hit()).toBe(true);expect(f.host.onKill).not.toHaveBeenCalled();expect(random).not.toHaveBeenCalled();
});
