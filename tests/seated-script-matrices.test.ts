import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import {ScmMission} from '../src/simulation/ScmMission';
const bytes=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm'));
const flush=async()=>{for(let i=0;i<16;i++)await Promise.resolve();};
const seatMatrix={position:{x:101.25,y:202.5,z:303.75},right:{x:0,y:-1,z:0},forward:{x:1,y:0,z:0},up:{x:0,y:0,z:1}};
async function setup(){
 const car={position:{x:100,y:200,z:300}},rider={position:seatMatrix.position,heading:0};let settle!:(r:typeof rider)=>void;
 const host={spawnScriptVehicle:async()=>car,scriptVehicleAlive:()=>true,scriptVehiclePosition:(c:typeof car)=>c.position,scriptVehicleHeading:()=>0,
  spawnScriptPedInCar:()=>new Promise<typeof rider>(resolve=>settle=resolve),scriptPedAlive:()=>true,scriptPedHealth:()=>100,scriptPedPosition:(p:typeof rider)=>p.position,scriptPedHeading:(p:typeof rider)=>p.heading,scriptPedMatrix:()=>seatMatrix,
  playerPed:()=>({position:car.position,vehicle:{appearance:1,train:false},heading:0,matrix:seatMatrix,health:100,dead:false,stopped:true,areaCode:0})};
 const m=new ScmMission(bytes,{infoLabels:['TEST'],population:[]} as any,host as any),vehicle=m.vehicles.create(492,car.position);await m.vehicles.whenSettled(vehicle);
 const ped=m.peds.createInCar(4,'MALE01',vehicle,1);await flush();return{m,w:m.runtime.world!,car,rider,ped,settle};
}
test.each(['player','NPC'])('native coordinate/heading commands use the vehicle, while offset commands use the %s seat matrix',async kind=>{
 const {m,w,car,rider,ped:made,settle}=await setup();settle(rider);await flush();const ped=kind==='player'?1:made;
 expect(w.pedPosition!(ped)).toEqual(car.position);expect(w.pedHeading!(ped)).toBe(0);
 const i32=(n:number)=>[n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255],int=(n:number)=>[1,...i32(n)],out=(n:number)=>[3,n&255,n>>>8];
 const float=(n:number)=>{const b=new Uint8Array(5);b[0]=6;new DataView(b.buffer).setFloat32(1,n,true);return [...b];};
 // GET_CHAR_COORDINATES ped 0@ 1@ 2@; GET_CHAR_HEADING ped 3@;
 // GET_OFFSET_FROM_CHAR_IN_WORLD_COORDS ped 2 3 4 4@ 5@ 6@; TERMINATE_THIS_SCRIPT.
 const code=new Uint8Array([0xa0,0,...int(ped),...out(0),...out(1),...out(2),0x72,1,...int(ped),...out(3),0xc4,4,...int(ped),...float(2),...float(3),...float(4),...out(4),...out(5),...out(6),0x4e,0]);
 const thread=m.runtime.start(0,[],{space:code,mission:true}).thread;thread.usesMissionCleanup=false;thread.run(1000,100,1);
 expect([0,1,2,3,4,5,6].map(i=>thread.locals.getFloat32(i*4,true))).toEqual([100,200,300,0,104.25,200.5,307.75]);
});
