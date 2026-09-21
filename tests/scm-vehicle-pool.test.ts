import {describe,expect,test} from 'vitest';
import {ScmVehiclePool,type ScmVehiclePoolHost} from '../src/simulation/ScmVehiclePool';

/** A car the fake browser holds, with the place it was last put. */
interface FakeCar {id:number;position:{x:number;y:number;z:number};heading:number;alive:boolean}
/** A host whose spawning finishes only when the test says so, which is what the browser's really does. */
function pool(options:{fails?:boolean}={}){
 let nextId=1;
 const spawned:FakeCar[]=[];
 const pending:(()=>void)[]=[];
 const host:ScmVehiclePoolHost<FakeCar>={
  spawn:(_model,position,heading)=>new Promise(resolve=>{
   pending.push(()=>{
    if(options.fails){resolve(undefined);return;}
    const car:FakeCar={id:nextId++,position:{...position},heading,alive:true};
    spawned.push(car);resolve(car);
   });
  }),
  place:(car,position,heading)=>{car.position={...position};car.heading=heading;},
  positionOf:car=>car.position,
  headingOf:car=>car.heading,
  aliveOf:car=>car.alive,
  remove:car=>{car.alive=false;},
 };
 return {pool:new ScmVehiclePool(host),spawned,settle:async()=>{const queued=pending.splice(0);for(const run of queued)run();await Promise.resolve();await Promise.resolve();}};
}

describe('the cars a script creates before the browser can build them',()=>{
 test('the handle comes back at once and the car follows',async()=>{
  const {pool:cars,settle,spawned}=pool();
  const handle=cars.create(411,{x:10,y:20,z:3},90);
  expect(handle).toBeGreaterThan(0);
  expect(cars.exists(handle)).toBe(true);
  expect(spawned.length).toBe(0);
  await settle();
  expect(spawned.length).toBe(1);
  expect(cars.exists(handle)).toBe(true);
 });

 test('what the script sets before the car arrives is applied when it does',async()=>{
  const {pool:cars,settle,spawned}=pool();
  const handle=cars.create(411,{x:0,y:0,z:0},0);
  cars.setPosition(handle,{x:100,y:200,z:5});
  cars.setHeading(handle,180);
  // Reading back before it arrives gives what the script itself set.
  expect(cars.positionOf(handle)).toEqual({x:100,y:200,z:5});
  expect(cars.headingOf(handle)).toBe(180);
  await settle();
  expect(spawned[0].position).toEqual({x:100,y:200,z:5});
  expect(spawned[0].heading).toBe(180);
 });

 test('once the car is there its own place is read, not the script’s last word',async()=>{
  const {pool:cars,settle,spawned}=pool();
  const handle=cars.create(411,{x:0,y:0,z:0},0);
  await settle();
  spawned[0].position={x:7,y:8,z:9};
  expect(cars.positionOf(handle)).toEqual({x:7,y:8,z:9});
 });

 test('a car deleted before it arrives is refused on arrival and never joins the world',async()=>{
  const {pool:cars,settle,spawned}=pool();
  const handle=cars.create(411,{x:0,y:0,z:0},0);
  cars.delete(handle);
  expect(cars.exists(handle)).toBe(false);
  await settle();
  expect(spawned.length).toBe(1);
  expect(spawned[0].alive).toBe(false);
  expect(cars.count).toBe(0);
 });

 test('a car deleted after it arrives goes at once',async()=>{
  const {pool:cars,settle,spawned}=pool();
  const handle=cars.create(411,{x:0,y:0,z:0},0);
  await settle();
  cars.delete(handle);
  expect(spawned[0].alive).toBe(false);
  expect(cars.exists(handle)).toBe(false);
 });

 test('a spawn that fails leaves a handle that does not exist',async()=>{
  const {pool:cars,settle}=pool({fails:true});
  const handle=cars.create(99999,{x:0,y:0,z:0},0);
  expect(cars.exists(handle)).toBe(true);
  await settle();
  expect(cars.exists(handle)).toBe(false);
 });

 test('a car the streamer may reclaim stops being addressable but is not removed',async()=>{
  const {pool:cars,settle,spawned}=pool();
  const handle=cars.create(411,{x:0,y:0,z:0},0);
  await settle();
  cars.markNoLongerNeeded(handle);
  expect(cars.exists(handle)).toBe(false);
  expect(spawned[0].alive).toBe(true);
 });

 test('a car the browser has since dropped stops existing',async()=>{
  const {pool:cars,settle,spawned}=pool();
  const handle=cars.create(411,{x:0,y:0,z:0},0);
  await settle();
  spawned[0].alive=false;
  expect(cars.exists(handle)).toBe(false);
 });

 test('handles are distinct and a placement that is not a number is refused',()=>{
  const {pool:cars}=pool();
  const first=cars.create(411,{x:0,y:0,z:0},0),second=cars.create(411,{x:0,y:0,z:0},0);
  expect(first).not.toBe(second);
  expect(()=>cars.create(411,{x:Number.NaN,y:0,z:0},0)).toThrow(/Invalid/);
  expect(()=>cars.positionOf(999)).toThrow(/names nothing/);
 });
});
