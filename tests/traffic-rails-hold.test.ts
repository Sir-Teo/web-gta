import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Scene} from 'three';
import {Simulation} from '../src/simulation/Simulation';
import {WorldFleet} from '../src/simulation/WorldFleet';
import {WorldTraffic} from '../src/simulation/WorldTraffic';

beforeAll(async()=>{await RAPIER.init();});

// UpdateCarOnRails holds a car through TEMPACT_WAIT and TEMPACT_BRAKE (ModifySpeed(0)); at the end of its road, with no
// next link to time a curve by, it simply stands.
test('a car on rails holds still through a wait, with or without a next link',()=>{
 const sim=new Simulation(),scene=new Scene(),fleet=new WorldFleet(sim,scene,{} as never,undefined,'rails-hold-test:'),traffic=new WorldTraffic(sim,fleet,'rails-hold-test:');
 try{
  const node=(x:number)=>({position:[x,0,0],address:{area:0,node:x}});
  const link={from:node(0),to:node(10),navigation:{position:[5,0],direction:[1,0],width:0,oppositeLanes:0,sameLanes:1},start:{x:0,z:0},end:{x:10,z:0},length:10,dx:10,dz:0};
  const placed:unknown[]=[],body={translation:()=>({x:5,y:1,z:0}),rotation:()=>({x:0,y:0,z:0,w:1}),linvel:()=>({x:0,y:0,z:0})};
  const driver=(next:unknown)=>({car:{car:{body,placeOnRails:(...a:unknown[])=>placed.push(a)}},current:link,currentLane:0,nextLane:0,next,seed:0,
   rails:{enteredMs:0,spendMs:1000,speed:5,heightAboveRoad:1,ahead:0,behind:0}});
  const stepRails=(d:unknown)=>(traffic as unknown as {stepRails(d:unknown,now:number,dt:number,speed:number,stop:boolean,hold:boolean):void}).stepRails(d,100,1/60,10,false,true);
  const end=driver(undefined);
  expect(()=>stepRails(end)).not.toThrow();expect(end.rails.speed).toBe(0);
  const onRoad=driver(link);stepRails(onRoad);expect(onRoad.rails.speed).toBe(.01);
  expect(placed).toHaveLength(2);expect(placed[1]).toEqual([{x:5,y:1,z:0},{x:0,y:0,z:0,w:1},{x:0,y:0,z:0}]);
 }finally{traffic.dispose();fleet.dispose();sim.dispose();}
});
