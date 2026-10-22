import {expect,test} from 'vitest';
import fixture from './fixtures/native-dead-ped-pickup.json';
import {deadPedPickupCoors} from '../src/ped/nativeDeadPedPickup';
type Input={ped:number[];player:number[];ground:number;draws:number[];noGround?:boolean;blockedLine?:boolean;blockedVehicle?:boolean;blockPickup?:number[]};
for(const row of fixture.cases)test(`captured dead-ped pickup: ${row.input.name}`,()=>{
 const input=row.input as Input,groundQueries:number[][]=[],lines:{from:number[];to:number[];vehiclesAndObjects:boolean}[]=[],spheres:{point:number[];radius:number}[]=[];let draws=0;
 const point=deadPedPickupCoors({x:input.ped[0],y:input.ped[1],z:input.ped[2]},{x:input.player[0],y:input.player[1]},{
  random256:()=>input.draws[draws++%input.draws.length],
  groundZ:(x,y,z)=>{groundQueries.push([x,y,z]);return input.noGround?undefined:input.ground;},
  pickupsInBubble:()=>!!input.blockPickup,
  lineOfSightClear:(from,to,vehiclesAndObjects)=>{lines.push({from:[from.x,from.y,from.z],to:[to.x,to.y,to.z],vehiclesAndObjects});return!input.blockedLine;},
  vehicleInSphere:(p,radius)=>{spheres.push({point:[p.x,p.y,p.z],radius});return!!input.blockedVehicle;},
 });
 expect([point.x,point.y,point.z]).toEqual(row.point);expect(draws).toBe(row.draws);expect(groundQueries).toEqual(row.groundQueries);expect(lines).toEqual(row.lines);expect(spheres).toEqual(row.spheres);
});
