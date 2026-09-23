import {expect,test} from 'vitest';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';
import {TASK} from '../src/ped/nativeDecisionMaker';

const ped=(x:number,y:number,z:number,heading:number,extra:object={})=>({actor:{player:{position:{x,y,z},heading}},health:100,down:0,decisionMaker:2,...extra} as any);
const event=(dead:any,people:any[],decide:(p:any)=>number|undefined=()=>TASK.investigateDeadPed)=>
 (WorldPedestrians.prototype as any).deadPedEvent.call({people,decide,relationshipTo:()=>3,deadPedRandom:()=>.5},dead);

test('CEventDeadPed reaches a ped within 8 units in 3D with the body ahead, cops too, but not a body under water',()=>{
 const body=ped(0,0,0,0),level=ped(0,0,-5,0),above=ped(0,7,-5,0),cop=ped(0,0,5,Math.PI,{officer:true});
 event(body,[body,level,above,cop]);
 expect(level.investigate?.phase).toBe('stand');
 // √(49+25) > 8: a ped on a ledge above never sees it, though 5 away across the ground.
 expect(above.investigate).toBeUndefined();
 // A cop hears the event; without a script decision maker the Cop one answers nothing.
 expect(cop.investigate?.phase).toBe('stand');
 const plainCop=ped(0,0,5,Math.PI,{officer:true,decisionMaker:1});
 event(body,[body,plainCop],()=>undefined);
 expect(plainCop.investigate).toBeUndefined();
 const drowned=ped(0,0,0,0,{drowned:true}),near=ped(0,0,-3,0);
 event(drowned,[drowned,near]);
 expect(near.investigate).toBeUndefined();
});
