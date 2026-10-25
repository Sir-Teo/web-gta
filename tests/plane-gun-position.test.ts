import {beforeAll,expect,test,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import RAPIER from '@dimforge/rapier3d-compat';
import {Vector3,Quaternion} from 'three';
import {PLANE_GUN_POSITIONS,planeGunPosition,aircraftGunDummy} from '../src/simulation/nativePlaneGunPosition';
import {Simulation} from '../src/simulation/Simulation';
import {WeaponSystem} from '../src/weapons/WeaponSystem';
import type {WorldPlane} from '../src/simulation/WorldPlane';

beforeAll(async()=>RAPIER.init());
test('native model positions and aircraft dummy identity agree with the pinned executable capture',()=>{
 const capture=JSON.parse(readFileSync('docs/research/plane-gun-positions-capture.json','utf8'));
 expect(PLANE_GUN_POSITIONS).toEqual(Object.fromEntries(capture.records.map((r:any)=>[r.model,r.offset])));
 expect(capture.dummyRecords.map((r:any)=>[r.name,r.id,r.flags])).toEqual([['miscpos_a',13,9],['miscpos_a',13,9]]);
 expect(planeGunPosition(999)).toEqual([0,0,0]);
});
test('PC nonzero model dummies win before Rustler spacing; a zero dummy falls through to native fallback',()=>{
 expect(planeGunPosition(476,2,[3,4,5])).toEqual([3,4,5]);expect(planeGunPosition(999,0,[3,4,5])).toEqual([3,4,5]);
 expect(planeGunPosition(476,1,[0,0,0])).toEqual(PLANE_GUN_POSITIONS[476]);
 expect([0,1,2].map(c=>planeGunPosition(476,c)[0])).toEqual([Math.fround(Math.fround(2.19)-Math.fround(.2)),Math.fround(2.19),Math.fround(Math.fround(2.19)+Math.fround(.2))]);
});
test('gun dummy preprocessing includes nested parent transforms and excludes the clump root',()=>{
 const matrix=(x=0,y=0,z=0)=>[1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1],parent=matrix(10,20,30);parent[0]=0;parent[1]=1;parent[4]=-1;parent[5]=0;
 const frames=[{name:'clump',parent:-1,matrix:matrix(100,200,300)},{name:'chassis',parent:0,matrix:parent},{name:'miscpos_a',parent:1,matrix:matrix(2,3,4)}];
 expect(aircraftGunDummy(frames)).toEqual([7,22,34]);expect(aircraftGunDummy(frames.slice(0,2))).toBeUndefined();
 expect(()=>aircraftGunDummy([{name:'miscpos_a',parent:0,matrix:matrix()}])).toThrow('Invalid aircraft gun dummy hierarchy');
});
function fixture(model=476,dummy?:[number,number,number]){
 const sim=new Simulation(),rotation=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),.6),position={x:20,y:50,z:70},body=sim.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(position.x,position.y,position.z).setRotation(rotation));
 const plane={body,modelId:model,occupied:true,health:1000,armed:true,gunPosition:(cycle:number)=>planeGunPosition(model,cycle,dummy),assets:{collision:{bounds:{radius:6}}}} as unknown as WorldPlane;
 const weapons=new WeaponSystem(sim,()=>undefined,()=>({cars:[],planes:[plane]} as any)),gunshot=vi.fn();weapons.fx={ready:true,gunshot,bulletHit:vi.fn(),areaEffect:vi.fn(),explosion:vi.fn()};
 (weapons as any).nowMs=1000;
 return {sim,weapons,plane,body,gunshot,position,rotation,dispose(){weapons.dispose();sim.dispose();}};
}
test('Rustler cycles advance on accepted shots, persist across cooldowns, and remain local to each aircraft',()=>{
 const f=fixture();try{
  const actual:number[]=[];for(let i=0;i<4;i++){expect(f.weapons.fireAircraft(f.plane)).toBe(true);const from=f.gunshot.mock.calls.at(-1)![0],local=new Vector3(from.x-f.position.x,from.y-f.position.y,from.z-f.position.z).applyQuaternion(f.rotation.clone().invert());actual.push(local.x);expect(f.weapons.fireAircraft(f.plane)).toBe(false);f.weapons.tick(.081);}
  for(const [i,cycle]of [1,2,0,1].entries())expect(actual[i]).toBeCloseTo(planeGunPosition(476,cycle)[0],5);
  const another={...f.plane} as WorldPlane;expect(f.weapons.fireAircraft(another)).toBe(true);const from=f.gunshot.mock.calls.at(-1)![0],local=new Vector3(from.x-f.position.x,from.y-f.position.y,from.z-f.position.z).applyQuaternion(f.rotation.clone().invert());expect(local.x).toBeCloseTo(Math.fround(2.19),5);
 }finally{f.dispose();}
});
test.each([425,447,464,476,520])('model %s uses the transformed native muzzle and a full frame of creator velocity',model=>{
 const f=fixture(model);try{
  const velocity={x:6,y:3,z:-9};f.body.setLinvel(velocity,true);f.weapons.tick(.02);expect(f.weapons.fireAircraft(f.plane)).toBe(true);
  const [x,y,z]=planeGunPosition(model,model===476?1:0),expected=new Vector3(x,z,-y).applyQuaternion(f.rotation).add(new Vector3(f.position.x,f.position.y,f.position.z)).addScaledVector(new Vector3(velocity.x,velocity.y,velocity.z),.02),from=f.gunshot.mock.calls[0][0];
  for(const axis of ['x','y','z'] as const)expect(from[axis]).toBeCloseTo(expected[axis],5);
 }finally{f.dispose();}
});
