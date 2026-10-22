import {expect,test,vi} from 'vitest';
import fixture from './fixtures/native-all-vehicle-damage.json';
import {WorldFleet} from '../src/simulation/WorldFleet';

const renderer=(p:number[])=>({x:p[0],y:p[2],z:-p[1]});
function fleetWith(vehicles:any[]){
 const fleet=Object.create(WorldFleet.prototype)as any;
 fleet.cars=new Set(vehicles.filter(v=>v.index===0));fleet.bikes=new Set(vehicles.filter(v=>v.index===1));fleet.planes=new Set(vehicles.filter(v=>v.index===2||v.index===3));fleet.boats=new Set(vehicles.filter(v=>v.index===4));fleet.trains=new Set(vehicles.filter(v=>v.index===5));return fleet;
}
for(const row of fixture.cases)test(`captured whole vehicle pool: ${row.input.name}, argument ${row.input.argument}`,()=>{
 const vehicles=row.input.positions.map((position,index)=>({index,disposed:!row.input.valid[index],canBeDamaged:!!(BigInt(row.before[index])&0x200000n),health:200,burnTimer:2,wrecked:false,car:{body:{translation:()=>renderer(position)}}})),fleet=fleetWith(vehicles),extinguished:number[]=[];
 fleet.setAllCanBeDamaged(row.input.argument!==0);
 if(!row.input.argument)fleet.extinguishVehicleFiresInArea(renderer(row.input.player),4000,(v:any)=>extinguished.push(v.index));
 expect(vehicles.map(v=>v.canBeDamaged)).toEqual(row.after.map(flags=>!!(BigInt(flags)&0x200000n)));
 expect(extinguished.sort((a,b)=>a-b)).toEqual(row.extinguished);
 for(const v of vehicles){expect(v.health).toBe(row.extinguished.includes(v.index)?300:200);expect(v.burnTimer).toBe(row.extinguished.includes(v.index)&&[0,2,3].includes(v.index)?0:2);}
});
test('a whole-pool flag write affects current valid vehicles, including wrecks; future vehicles retain their default',()=>{
 const old={index:0,disposed:false,canBeDamaged:true,health:0,wrecked:true},fleet=fleetWith([old]);fleet.setAllCanBeDamaged(false);expect(old.canBeDamaged).toBe(false);
 const future={index:0,disposed:false,canBeDamaged:true};fleet.cars.add(future);expect(future.canBeDamaged).toBe(true);expect(old.canBeDamaged).toBe(false);fleet.setAllCanBeDamaged(true);expect(old.canBeDamaged).toBe(true);
});
test('vehicle fire cleanup preserves wrecked and higher health, clears represented automobile burn timers and visits fires',()=>{
 const vehicles=[{index:0,health:0,wrecked:true,burnTimer:4},{index:1,health:500,wrecked:false,burnTimer:4},{index:2,health:100,wrecked:false,burnTimer:4}].map(v=>({...v,disposed:false,car:{body:{translation:()=>({x:0,y:0,z:0})}}})),fleet=fleetWith(vehicles),stop=vi.fn();fleet.extinguishVehicleFiresInArea({x:0,y:0,z:0},4000,stop);
 expect(vehicles.map(v=>v.health)).toEqual([0,500,300]);expect(vehicles.map(v=>v.burnTimer)).toEqual([0,4,0]);expect(stop).toHaveBeenCalledTimes(3);
});
