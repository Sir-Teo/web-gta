import {beforeAll,expect,test,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation} from '../src/simulation/Simulation';
import {WeaponSystem,type SeatedTarget} from '../src/weapons/WeaponSystem';
import {readWeaponData} from '../src/weapons/weaponData';
import {PED_HIT_NODES,pedSphereHit} from '../src/combat/nativePedHitSpheres';

beforeAll(async()=>RAPIER.init());
const data=readWeaponData(readFileSync('public/play/world/files/data/weapon.dat','utf8'));
function fixture(piece=3,weapon=22){
 const sim=new Simulation(),body=sim.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0,.3,-5));
 sim.world.createCollider(RAPIER.ColliderDesc.cuboid(.5,.3,1),body);sim.world.step();
 const damage=vi.fn(()=>false),car={car:{body},body,health:1000,wrecked:false,damage};
 const weapons=new WeaponSystem(sim,()=>undefined,()=>({cars:[],boats:[],bikes:[car]} as any));weapons.installNative(data);weapons.inventory.select(weapon);weapons.aiming=true;
 (weapons as any).aimSpread=(direction:unknown)=>direction;
 const target:SeatedTarget<any>={car,bike:true,seat:0,local:{x:0,y:0,z:0},kind:'script',hitSpheres:()=>[{center:{x:0,y:2,z:-5},radius:.2,piece}]},seated=vi.fn(()=> 'hit' as const);
 weapons.seatedPeds=()=>[target];weapons.onSeatedShot=seated;
 const source={x:0,y:2,z:0},direction={x:0,y:0,z:-1},fire=()=>weapons.fire({origin:source,direction});
 weapons.muzzle=()=>source;
 return {sim,weapons,target,seated,damage,body,source,direction,fire,dispose:()=>{weapons.dispose();sim.dispose();}};
}
test('the native twelve-node table distinguishes head, torso and limbs; the nearest sphere determines the piece',()=>{
 const capture=JSON.parse(readFileSync('docs/research/ped-hit-spheres-capture.json','utf8'));
 expect(PED_HIT_NODES).toEqual(capture.records.map((n:{bone:number;piece:number;center:number[];radius:number})=>({bone:n.bone,piece:n.piece,x:n.center[0],radius:n.radius})));
 expect(PED_HIT_NODES).toHaveLength(12);expect(PED_HIT_NODES.map(n=>n.piece)).toEqual([9,3,3,4,5,6,5,6,7,8,7,8]);
 const spheres=[{center:{x:0,y:0,z:-5},radius:.15,piece:9},{center:{x:0,y:0,z:-3},radius:.18,piece:7}];
 const nearest=pedSphereHit({x:0,y:0,z:0},{x:0,y:0,z:-1},10,spheres)!;expect(nearest).toMatchObject({piece:7,normal:{x:0,y:0,z:1}});expect(nearest.t).toBeCloseTo(2.82,8);
 expect(pedSphereHit({x:0,y:0,z:0},{x:0,y:0,z:-1},2,spheres)).toBeUndefined();
});
test.each([3,5,7,9])('an exposed rider piece %s is hit without a vehicle-body collision, and only the head is critical',piece=>{
 const f=fixture(piece);try{
  expect(f.sim.world.castRay(new RAPIER.Ray(f.source,f.direction),10,true)).toBeNull();
  const base=f.weapons.inventory.info()!.damage;expect(f.fire()).toBe(true);
  expect(f.seated).toHaveBeenCalledExactlyOnceWith(f.target,piece===9?1000:base,22,piece,'ped');expect(f.damage).not.toHaveBeenCalled();
 }finally{f.dispose();}
});
test('a flying sniper round hits the direct rider once and preserves ordinary body damage',()=>{
 const f=fixture(3,34);try{
  f.weapons.firstPerson='sniper';expect(f.fire()).toBe(true);f.weapons.tick(1/60);f.weapons.tick(1/60);
  expect(f.seated).toHaveBeenCalledExactlyOnceWith(f.target,125,34,3,'ped');expect(f.damage).not.toHaveBeenCalled();
 }finally{f.dispose();}
});
test.each(['wall','proof','own','ordinary-car'])('direct rider collision respects %s exclusion',kind=>{
 const f=fixture();try{
  if(kind==='wall'){f.sim.world.createCollider(RAPIER.ColliderDesc.cuboid(1,1,.1).setTranslation(0,2,-2));f.sim.world.step();}
  if(kind==='proof')f.target.canBeShot=false;
  if(kind==='ordinary-car')f.target.bike=false;
  if(kind==='own')expect(f.weapons.bikerHit(f.source,f.direction,10,f.body)).toBeUndefined();
  else{f.fire();expect(f.seated).not.toHaveBeenCalled();}
 }finally{f.dispose();}
});
test('a shotgun accumulates pellets on the same exposed rider instead of treating the body hit as one head sphere',()=>{
 const random=vi.spyOn(Math,'random').mockReturnValue(.5),f=fixture(3,25);try{
  f.target.noCriticalHits=true;const base=f.weapons.inventory.info()!.damage;f.fire();
  expect(f.seated).toHaveBeenCalledOnce();const amount=f.seated.mock.calls[0] as unknown as [unknown,number,number];expect(amount[1]).toBeGreaterThan(base);expect(amount[1]).toBeLessThanOrEqual(base*15);
 }finally{f.dispose();random.mockRestore();}
});
test('a nearer tyre takes the shot before an exposed rider',()=>{
 const f=fixture();try{
  const burstTyre=vi.fn(()=>true);(f.weapons as any).tyreHit=()=>({t:2,wheel:0,car:{burstTyre}});f.fire();
  expect(burstTyre).toHaveBeenCalledExactlyOnceWith(0,true,'player');expect(f.seated).not.toHaveBeenCalled();
 }finally{f.dispose();}
});
test.each([22,34])('weapon %s uses its native direct-rider blood rule after applying fatal damage',weapon=>{
 const f=fixture(9,weapon);try{
  const bulletHit=vi.fn();f.weapons.fx={ready:true,bulletHit,gunshot:vi.fn(),areaEffect:vi.fn(),explosion:vi.fn()};f.weapons.onSeatedShot=()=> 'killed';
  if(weapon===34)f.weapons.firstPerson='sniper';f.fire();if(weapon===34)f.weapons.tick(1/60);
  expect(bulletHit).toHaveBeenCalledOnce();expect(bulletHit.mock.calls[0][0].ped).toEqual(weapon===34?{head:false,dead:false}:{head:true,dead:true});expect(bulletHit.mock.calls[0][1]).toBe(8);
 }finally{f.dispose();}
});
