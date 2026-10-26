import {expect,test,vi} from 'vitest';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';

function fixture(health=100,armour=40,weakness=1){
 const source={ped:{id:99}},ped={id:7,pedType:'CIVMALE',health,armour,defendMult:weakness,noCriticalHits:true,onlyDamagedByPlayer:true,proofs:{bullet:true,fire:true,explosion:true,collision:true,melee:true},lastWeaponDamage:34,lastDamagedBy:source,down:0,collider:{handle:12},actor:{player:{position:{x:0,y:0,z:0},heading:0}},view:{hasReaction:vi.fn(()=>true),playReaction:vi.fn(),installReactions:vi.fn()}} as any;
 const proto=WorldPedestrians.prototype as any,host=Object.assign(Object.create(proto),{people:[ped],disposed:false,onKill:vi.fn(),noteEvent:vi.fn(),hitPiece:()=>3,hit:vi.fn(),applyReaction:vi.fn(()=>false),damageReaction:vi.fn(()=>({})),damageResponse:vi.fn(()=>true),catalog:{scriptAnimation:vi.fn(async()=>({name:'custom_die'}))}}) as any;
 host.damageCollider=vi.fn(function(this:any,...args:any[]){return proto.damageCollider.apply(this,args);});
 return {ped,host,source,task:(order:any={kind:'die'})=>proto.applyOrder.call(host,ped,order)};
}
test.each([
 {mode:'ordinary proofs',health:100,armour:40,weakness:1},
 {mode:'high health',health:2**30,armour:0,weakness:1},
 {mode:'high armour',health:100,armour:20000,weakness:1},
 {mode:'zero weakness',health:100,armour:0,weakness:0},
])('TASK_DIE directly kills through $mode without spending armour or inventing damage/kill credit',row=>{
 const f=fixture(row.health,row.armour,row.weakness);f.task();expect(f.ped.health).toBe(0);expect(f.ped.armour).toBe(row.armour);expect(f.ped.down).toBe(Infinity);expect(f.ped.view.playReaction).toHaveBeenCalledExactlyOnceWith('ko_shot_front',Infinity);
 expect(f.ped.lastWeaponDamage).toBe(34);expect(f.ped.lastDamagedBy).toBe(f.source);expect(f.host.damageCollider).not.toHaveBeenCalled();expect(f.host.noteEvent).not.toHaveBeenCalled();expect(f.host.damageReaction).not.toHaveBeenCalled();expect(f.host.onKill).not.toHaveBeenCalled();
});
test('a loaded named death preserves armour and prior damage metadata without another kill credit',()=>{
 const f=fixture(2**30,20000);f.task({kind:'die',name:'KO_SHOT_FRONT',file:'PED'});expect(f.ped.health).toBe(0);expect(f.ped.armour).toBe(20000);expect(f.ped.lastWeaponDamage).toBe(34);expect(f.ped.view.playReaction).toHaveBeenCalledExactlyOnceWith('ko_shot_front',Infinity);expect(f.host.onKill).not.toHaveBeenCalled();
});
test.each([true,false])('an asynchronously loaded named death (animation available=%s) still kills directly',async available=>{
 const f=fixture(2**30,20000);f.ped.view.hasReaction.mockReturnValue(false);f.host.catalog.scriptAnimation.mockResolvedValue(available?{name:'custom_die'}:undefined);f.task({kind:'die',name:'CUSTOM_DIE',file:'CUSTOM'});expect(f.ped.health).toBe(2**30);await Promise.resolve();
 expect(f.ped.health).toBe(0);expect(f.ped.armour).toBe(20000);expect(f.ped.lastWeaponDamage).toBe(34);expect(f.ped.view.playReaction).toHaveBeenCalledExactlyOnceWith(available?'custom_die':'ko_shot_front',Infinity);expect(f.host.damageCollider).not.toHaveBeenCalled();expect(f.host.onKill).not.toHaveBeenCalled();
});
test.each(['removed','already dead','disposed'])('a late named death load does not touch a %s body',async mode=>{
 const f=fixture();f.ped.view.hasReaction.mockReturnValue(false);let resolve!:(v:any)=>void;f.host.catalog.scriptAnimation.mockReturnValue(new Promise(r=>{resolve=r;}));f.task({kind:'die',name:'CUSTOM_DIE',file:'CUSTOM'});
 if(mode==='removed')f.host.people=[];if(mode==='already dead')f.ped.health=0;if(mode==='disposed')f.host.disposed=true;resolve({name:'custom_die'});await Promise.resolve();
 expect(f.ped.health).toBe(mode==='already dead'?0:100);expect(f.ped.armour).toBe(40);expect(f.ped.view.installReactions).not.toHaveBeenCalled();expect(f.ped.view.playReaction).not.toHaveBeenCalled();expect(f.host.onKill).not.toHaveBeenCalled();
});
test('repeating the direct die request does not restart its held clip or register a kill',()=>{
 const f=fixture();f.task();f.task();expect(f.ped.health).toBe(0);expect(f.ped.armour).toBe(40);expect(f.ped.view.playReaction).toHaveBeenCalledOnce();expect(f.host.onKill).not.toHaveBeenCalled();
});
test('starting a direct death resets its corpse-removal and dying-animation clocks',()=>{
 const f=fixture();f.ped.deadTime=70;f.ped.corpseHitReady=true;f.task();expect(f.ped.deadTime).toBe(0);expect(f.ped.corpseHitReady).toBe(false);expect(f.host.damageCollider(12,1,{x:0,z:1},'bullet',{weapon:22})).toBe(false);expect(f.host.onKill).not.toHaveBeenCalled();
});
