import {beforeAll,expect,test,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation} from '../src/simulation/Simulation';
import {WeaponSystem} from '../src/weapons/WeaponSystem';
import {WorldFx} from '../src/simulation/fx/WorldFx';
import {readWeaponData} from '../src/weapons/weaponData';

beforeAll(async()=>RAPIER.init());
const data=readWeaponData(readFileSync('public/play/world/files/data/weapon.dat','utf8'));
function fixture({weapon=22,head=false,health=10000,proof=false,fxReady=true}={}){
 const sim=new Simulation(),body=sim.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,1,-5)),collider=sim.world.createCollider(RAPIER.ColliderDesc.cuboid(.4,.9,.4),body);sim.world.step();
 const order:string[]=[],blood=vi.fn(),rendered:any[]=[],damage=vi.fn((_h:number,amount:number)=>{order.push('damage');if(proof||health<=0)return false;health=Math.max(0,health-amount);return {id:11,officer:false,pedType:'CIVMALE'};});
 const crowd={damageCollider:damage,targets:()=>health>0?[{handle:collider.handle,position:{x:0,y:1,z:-5},noCriticalHits:true}]:[],bulletImpact:()=>({head,dead:health<=0}),trainsSkill:()=>health>0,frighten(){}};
 const weapons=new WeaponSystem(sim,()=>crowd as any,()=>undefined);weapons.installNative(data);weapons.inventory.select(weapon);weapons.aiming=true;
 (weapons as any).aimSpread=(direction:unknown)=>direction;weapons.muzzle=()=>({x:0,y:1.7,z:0});weapons.onBulletHit=()=>order.push('audio');
 weapons.fx={ready:fxReady,gunshot(){},areaEffect(){},explosion(){},bulletHit(hit,amount){order.push('blood');rendered.push({hit,amount,health});WorldFx.prototype.bulletHit.call({effects:{blood}} as any,hit,amount);}};
 const fire=()=>{if(weapon===34)weapons.firstPerson='sniper';expect(weapons.fire({origin:{x:0,y:1.7,z:0},direction:{x:0,y:0,z:-1}})).toBe(true);if(weapon===34)weapons.tick(1/60);};
 return {weapons,body,fire,damage,blood,rendered,order,health:()=>health,dispose:()=>{weapons.dispose();sim.dispose();}};
}
test.each([{head:false,health:10000,count:8},{head:true,health:10000,count:16},{head:true,health:1,count:32}])('instant-hit blood uses the resulting health and head piece (%j)',c=>{
 const f=fixture(c);try{f.fire();expect(f.blood).toHaveBeenCalledOnce();expect(f.blood.mock.calls[0][2]).toBe(c.count);expect(f.rendered[0].health).toBe(f.health());expect(f.rendered[0].hit.ped).toEqual({head:c.head,dead:f.health()<=0});expect(f.order).toEqual(['audio','damage','blood']);}finally{f.dispose();}
});
test.each([25,26,27])('shotgun %s accumulates damage and emits four torso blood particles',weapon=>{
 const random=vi.spyOn(Math,'random').mockReturnValue(.5),f=fixture({weapon});try{f.fire();expect(f.damage).toHaveBeenCalledOnce();expect(f.damage.mock.calls[0][1]).toBeGreaterThan(f.weapons.inventory.info()!.damage);expect(f.blood.mock.calls[0][2]).toBe(4);}finally{f.dispose();random.mockRestore();}
});
test('rejected instant-hit damage keeps impact notifications but emits no blood',()=>{
 const f=fixture({head:true,proof:true});try{f.fire();expect(f.damage).toHaveBeenCalledOnce();expect(f.blood).not.toHaveBeenCalled();expect(f.order).toEqual(['audio','damage']);}finally{f.dispose();}
});
test.each([false,true])('a flying sniper round emits eight blood particles even for head hits and rejected damage (proof=%s)',proof=>{
 const f=fixture({weapon:34,head:true,health:1,proof});try{f.fire();expect(f.damage).toHaveBeenCalledOnce();expect(f.blood).toHaveBeenCalledOnce();expect(f.blood.mock.calls[0][2]).toBe(8);expect(f.rendered[0].hit.ped).toEqual({head:false,dead:false});}finally{f.dispose();}
});
test('an already dead ped still gets native blood instead of a surface spark',()=>{
 const f=fixture({head:true,health:0});try{f.fire();expect(f.blood).toHaveBeenCalledOnce();expect(f.blood.mock.calls[0][2]).toBe(32);}finally{f.dispose();}
});
test('damage still lands while FX assets are unavailable',()=>{
 const f=fixture({fxReady:false});try{f.fire();expect(f.damage).toHaveBeenCalledOnce();expect(f.health()).toBeLessThan(10000);expect(f.blood).not.toHaveBeenCalled();}finally{f.dispose();}
});
test.each([{weapon:22,result:'hit',count:16},{weapon:22,result:'killed',count:32},{weapon:22,result:undefined,count:0},{weapon:34,result:'hit',count:8},{weapon:34,result:undefined,count:8}] as const)('vehicle-to-head transfer emits its native blood rule (%j)',c=>{
 const f=fixture({weapon:c.weapon});try{
  const target:any={car:{car:{body:f.body}},seat:0,local:{x:0,y:0,z:0},head:{x:0,y:1.6,z:-5},kind:'script'},shot=vi.fn(()=>c.result);
  f.weapons.seatedPeds=()=>[target];f.weapons.onSeatedShot=shot;f.fire();
  expect(shot).toHaveBeenCalledOnce();expect(f.damage).not.toHaveBeenCalled();
  if(c.count)expect(f.blood.mock.calls[0][2]).toBe(c.count);else expect(f.blood).not.toHaveBeenCalled();
 }finally{f.dispose();}
});
