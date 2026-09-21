import {describe,expect,test} from 'vitest';
import {ScmPedPool,type ScmPedPoolHost} from '../src/simulation/ScmPedPool';

/** A ped the fake browser holds, with everything the script can say about one. */
interface FakePed {id:number;position:{x:number;y:number;z:number};heading:number;health:number;accuracy:number;
 invulnerable:boolean;proofs:string[];alive:boolean;scripted:boolean}
/** A host whose spawning finishes only when the test says so, which is what the browser's really does. */
function pool(options:{fails?:boolean}={}){
 let nextId=1;
 const spawned:FakePed[]=[];
 const pending:(()=>void)[]=[];
 const host:ScmPedPoolHost<FakePed>={
  spawn:(_type,_model,position)=>new Promise(resolve=>{
   pending.push(()=>{
    if(options.fails){resolve(undefined);return;}
    const ped:FakePed={id:nextId++,position:{...position},heading:0,health:100,accuracy:60,invulnerable:false,
     proofs:[],alive:true,scripted:true};
    spawned.push(ped);resolve(ped);
   });
  }),
  place:(ped,position)=>{ped.position={...position};},
  setHeading:(ped,degrees)=>{ped.heading=degrees;},
  positionOf:ped=>ped.position,
  headingOf:ped=>ped.heading,
  healthOf:ped=>ped.health,
  setHealth:(ped,health)=>{ped.health=health;},
  kill:ped=>{ped.health=0;},
  setAccuracy:(ped,accuracy)=>{ped.accuracy=accuracy;},
  setInvulnerable:(ped,enabled)=>{ped.invulnerable=enabled;},
  setProofs:(ped,proofs)=>{ped.proofs=Object.entries(proofs).filter(([,on])=>on).map(([name])=>name);},
  aliveOf:ped=>ped.alive,
  remove:ped=>{ped.alive=false;},
  release:ped=>{ped.scripted=false;},
 };
 return {pool:new ScmPedPool(host),spawned,settle:async()=>{const queued=pending.splice(0);for(const run of queued)run();await Promise.resolve();await Promise.resolve();}};
}

describe('the peds a script creates before the browser can load them',()=>{
 test('the handle comes back at once and the ped follows',async()=>{
  const {pool:peds,settle,spawned}=pool();
  const handle=peds.create(4,'MALE01',{x:10,y:20,z:3});
  expect(peds.exists(handle)).toBe(true);
  expect(peds.isDead(handle)).toBe(false);
  expect(spawned.length).toBe(0);
  await settle();
  expect(spawned.length).toBe(1);
  expect(peds.positionOf(handle)).toEqual({x:10,y:20,z:3});
 });

 test('everything the script says before the ped arrives is applied when it does, in order',async()=>{
  const {pool:peds,settle,spawned}=pool();
  const handle=peds.create(4,'MALE01',{x:0,y:0,z:0});
  peds.setPosition(handle,{x:5,y:6,z:7});
  peds.setHeading(handle,90);
  peds.setHealth(handle,250);
  peds.setAccuracy(handle,95);
  peds.setInvulnerable(handle,true);
  peds.setProofs(handle,{bullet:true,fire:false,explosion:true,collision:false,melee:false});
  // Reading back before it arrives gives what the script itself set.
  expect(peds.positionOf(handle)).toEqual({x:5,y:6,z:7});
  expect(peds.headingOf(handle)).toBe(90);
  expect(peds.healthOf(handle)).toBe(250);
  await settle();
  const ped=spawned[0];
  expect(ped.position).toEqual({x:5,y:6,z:7});
  expect(ped.heading).toBe(90);expect(ped.health).toBe(250);expect(ped.accuracy).toBe(95);
  expect(ped.invulnerable).toBe(true);expect(ped.proofs).toEqual(['bullet','explosion']);
 });

 test('no health kills the ped rather than setting the field',async()=>{
  const {pool:peds,settle,spawned}=pool();
  const handle=peds.create(4,'MALE01',{x:0,y:0,z:0});
  peds.setHealth(handle,0);
  expect(peds.isDead(handle)).toBe(true);
  expect(peds.healthOf(handle)).toBe(0);
  await settle();
  expect(spawned[0].health).toBe(0);
  expect(peds.isDead(handle)).toBe(true);
 });

 test('a ped still on the default maximum takes its new health as the maximum too',()=>{
  const {pool:peds}=pool();
  const handle=peds.create(4,'MALE01',{x:0,y:0,z:0});
  expect(peds.maxHealthOf(handle)).toBe(100);
  peds.setHealth(handle,250);
  expect(peds.maxHealthOf(handle)).toBe(250);
  // A maximum the script set itself is not raised again by a later health.
  const other=peds.create(4,'MALE01',{x:0,y:0,z:0});
  peds.setMaxHealth(other,400);
  peds.setHealth(other,150);
  expect(peds.maxHealthOf(other)).toBe(400);
 });

 test('a ped killed after it arrives is dead at once',async()=>{
  const {pool:peds,settle,spawned}=pool();
  const handle=peds.create(4,'MALE01',{x:0,y:0,z:0});
  await settle();
  peds.kill(handle);
  expect(spawned[0].health).toBe(0);
  expect(peds.isDead(handle)).toBe(true);
 });

 test('a ped deleted before it arrives never joins the world',async()=>{
  const {pool:peds,settle,spawned}=pool();
  const handle=peds.create(4,'MALE01',{x:0,y:0,z:0});
  peds.delete(handle);
  expect(peds.exists(handle)).toBe(false);
  await settle();
  expect(spawned[0].alive).toBe(false);
  expect(peds.count).toBe(0);
 });

 test('a ped let go before it arrives is still handed back to the streamer when it does',async()=>{
  const {pool:peds,settle,spawned}=pool();
  const handle=peds.create(4,'MALE01',{x:0,y:0,z:0});
  peds.markNoLongerNeeded(handle);
  expect(peds.exists(handle)).toBe(false);
  await settle();
  expect(spawned[0].alive).toBe(true);
  expect(spawned[0].scripted).toBe(false);
 });

 test('a ped let go after it arrives stays in the world and stops being the script’s',async()=>{
  const {pool:peds,settle,spawned}=pool();
  const handle=peds.create(4,'MALE01',{x:0,y:0,z:0});
  await settle();
  peds.markNoLongerNeeded(handle);
  expect(spawned[0].alive).toBe(true);expect(spawned[0].scripted).toBe(false);
  expect(peds.exists(handle)).toBe(false);
 });

 test('a model the browser cannot load leaves a handle that names a dead ped',async()=>{
  const {pool:peds,settle}=pool({fails:true});
  const handle=peds.create(4,'NOSUCH',{x:0,y:0,z:0});
  expect(peds.exists(handle)).toBe(true);
  await settle();
  expect(peds.exists(handle)).toBe(false);
  expect(peds.isDead(handle)).toBe(true);
 });

 test('the ped is the type the script asked for, and only two types are female',()=>{
  const {pool:peds}=pool();
  // ePedType: 4 is PED_TYPE_CIVMALE, 5 PED_TYPE_CIVFEMALE, 22 PED_TYPE_PROSTITUTE, 17 PED_TYPE_DEALER.
  expect(peds.typeOf(peds.create(4,'MALE01',{x:0,y:0,z:0}))).toBe(4);
  expect(peds.isMale(peds.create(4,'MALE01',{x:0,y:0,z:0}))).toBe(true);
  expect(peds.isMale(peds.create(5,'WFYST',{x:0,y:0,z:0}))).toBe(false);
  expect(peds.isMale(peds.create(22,'WFYPRO',{x:0,y:0,z:0}))).toBe(false);
  expect(peds.isMale(peds.create(17,'DEALER',{x:0,y:0,z:0}))).toBe(true);
 });

 test('handles are distinct and a placement that is not a number is refused',()=>{
  const {pool:peds}=pool();
  const first=peds.create(4,'MALE01',{x:0,y:0,z:0}),second=peds.create(4,'MALE01',{x:0,y:0,z:0});
  expect(first).not.toBe(second);
  expect(()=>peds.create(4,'MALE01',{x:Number.NaN,y:0,z:0})).toThrow(/Invalid/);
  expect(()=>peds.positionOf(999)).toThrow(/names nothing/);
 });
});
