import {beforeAll,expect,test,vi} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation} from '../src/simulation/Simulation';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';
import {WeaponSystem} from '../src/weapons/WeaponSystem';
import {WorldFx} from '../src/simulation/fx/WorldFx';

beforeAll(async()=>RAPIER.init());
function fixture(){
 const sim=new Simulation(),body=sim.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,1,-5)),collider=sim.world.createCollider(RAPIER.ColliderDesc.capsule(.6,.3),body),order:string[]=[],blood=vi.fn();sim.world.step();
 const ped={id:3,health:100,defendMult:1,pedType:'CIVMALE',body,collider,actor:{player:{position:{x:0,y:0,z:-5},heading:0}},view:{reactionPlayedOut:false,reactionName:'ko_shot_front',hasReaction:()=>false}} as any;
 const crowd=Object.assign(Object.create(WorldPedestrians.prototype),{people:[ped],hitPiece:()=>3,applyReaction:vi.fn(),damageReaction:vi.fn(()=>({})),onKill:vi.fn(),sameScriptGroup:vi.fn(()=>false)}),weapons=new WeaponSystem(sim,()=>crowd,()=>undefined);
 weapons.fx={ready:true,gunshot(){},areaEffect(){},explosion(){},bulletHit(hit,amount){order.push('blood');WorldFx.prototype.bulletHit.call({effects:{blood},collisionSources:()=>undefined} as any,hit,amount);}};weapons.onBulletHit=()=>order.push('audio');
 const point={x:0,y:1,z:-4.8},direction={x:0,y:0,z:-1},hit={collider,pedPiece:3,timeOfImpact:4.8,normal:{x:0,y:0,z:1},featureType:RAPIER.FeatureType.Face,featureId:0};
 const fire=(source?:{pedType?:string;scriptPedType?:number;follow?:boolean})=>{const finish=weapons.prepareNpcBulletImpact(hit,point,22,direction,source);order.push('damage');const accepted=crowd.npcBulletHit(collider.handle,10,22,direction,point as any,3,source);finish?.(accepted);return accepted;};
 return {sim,ped,crowd,weapons,order,blood,fire,dispose:()=>{weapons.dispose();sim.dispose();}};
}

test.each(['COP','GANG1','GANG10','MEDIC','FIREMAN'])('an external %s ped source blocks an equal-type foot impact before audio and damage',pedType=>{
 const f=fixture();try{f.ped.pedType=pedType;expect(f.fire({pedType})).toBe(false);expect(f.ped.health).toBe(100);expect(f.order).toEqual(['damage']);expect(f.blood).not.toHaveBeenCalled();expect(f.crowd.onKill).not.toHaveBeenCalled();}finally{f.dispose();}
});
test.each([false,true])('script overrides govern both impact audio and external-ped damage (same=%s)',same=>{
 const f=fixture();try{f.ped.pedType='CIVMALE';f.ped.scriptPedType=6;const accepted=f.fire({pedType:'COP',scriptPedType:same?6:4});expect(accepted).toBe(!same);expect(f.ped.health).toBe(same?100:90);expect(f.order).toEqual(same?['damage']:['audio','damage','blood']);}finally{f.dispose();}
});
test.each(['CIVMALE','CIVFEMALE'])('equal civilian %s contacts retain their native exception',pedType=>{
 const f=fixture();try{f.ped.pedType=pedType;expect(f.fire({pedType})).toBe(true);expect(f.ped.health).toBe(90);expect(f.order).toEqual(['audio','damage','blood']);}finally{f.dispose();}
});
test('an equal-type corpse contact stays silent and rejected',()=>{
 const f=fixture();try{f.ped.health=0;f.ped.pedType='COP';expect(f.fire({pedType:'COP'})).toBe(false);expect(f.order).toEqual(['damage']);expect(f.crowd.onKill).not.toHaveBeenCalled();}finally{f.dispose();}
});
test('a mounted creator without a ped source keeps its distinct type behavior',()=>{
 const f=fixture();try{f.ped.pedType='COP';expect(f.fire()).toBe(true);expect(f.ped.health).toBe(90);expect(f.order).toEqual(['audio','damage','blood']);}finally{f.dispose();}
});
test.each(['script','follower'])('external %s groupmates retain contact audio while rejecting wounds',kind=>{
 const f=fixture(),source={pedType:'CIVFEMALE',follow:kind==='follower'};try{if(kind==='script')f.crowd.sameScriptGroup.mockReturnValue(true);else f.ped.follow=true;expect(f.fire(source)).toBe(false);expect(f.ped.health).toBe(100);expect(f.order).toEqual(['audio','damage']);if(kind==='script')expect(f.crowd.sameScriptGroup).toHaveBeenCalledWith(f.ped,source);expect(f.blood).not.toHaveBeenCalled();}finally{f.dispose();}
});
test('external source metadata preserves live proof rejection after audio',()=>{
 const f=fixture();try{f.ped.proofs={bullet:true};expect(f.fire({pedType:'COP'})).toBe(false);expect(f.ped.health).toBe(100);expect(f.order).toEqual(['audio','damage']);expect(f.blood).not.toHaveBeenCalled();}finally{f.dispose();}
});
test('external group membership does not reject a corpse or register another kill',()=>{
 const f=fixture();try{f.ped.health=0;f.crowd.sameScriptGroup.mockReturnValue(true);expect(f.fire({pedType:'CIVFEMALE'})).toBe(true);expect(f.order).toEqual(['audio','damage','blood']);expect(f.crowd.sameScriptGroup).not.toHaveBeenCalled();expect(f.crowd.onKill).not.toHaveBeenCalled();}finally{f.dispose();}
});
