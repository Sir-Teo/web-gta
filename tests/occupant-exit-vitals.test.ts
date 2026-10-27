import {expect,test,vi} from 'vitest';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';
import {WorldTraffic} from '../src/simulation/WorldTraffic';
import {GangDriveBy} from '../src/simulation/GangDriveBy';

function fixture(){
 const ped:any={health:100,armour:0},speeds={walk:1,run:2,sprint:3},stats={attack:1,defend:1};
 const catalog={models:[{}],modelSpeeds:[speeds],modelStats:[stats],character:async()=>({}),characterSpeeds:async()=>speeds,characterStats:async()=>stats};
 const onCreated=vi.fn(()=>({health:ped.health,armour:ped.armour})),response=vi.fn();
 const host:any=Object.assign(Object.create(WorldPedestrians.prototype),{catalog,disposed:false,nearestNode:()=>({position:[0,0,0]}),createPed:vi.fn(()=>ped),layDragged:(_p:any,_lying:any,then:()=>void)=>then(),jackedResponse:response,fleeCar:response});
 const spawn=(kind:string,model:number|string,vitals?:{health:number;armour:number})=>kind==='jacked'?host.spawnJacked(model,{x:0,y:0,z:0},0,undefined,{position:()=>({x:0,y:0,z:0})},false,undefined,onCreated,vitals):kind==='fleeing'?host.spawnFleeing(model,{x:0,y:0,z:0},0,undefined,{from:{x:1,z:1},safe:15},vitals):host.spawnRoadRage(model,{x:0,y:0,z:0},0,undefined,vitals);
 return {ped,host,onCreated,response,spawn};
}
for(const kind of ['jacked','fleeing','road rage'])for(const model of [0,'MALE01']){
 test(`${kind} model ${model} retains wounds when its foot body is constructed`,async()=>{
  const {ped,host,onCreated,spawn}=fixture(),vitals={health:37.5,armour:12.25};expect(spawn(kind,model,vitals)).toBe(true);await vi.waitFor(()=>expect(host.createPed).toHaveBeenCalledOnce());expect(ped).toMatchObject(vitals);if(kind==='jacked')expect(onCreated.mock.results[0].value).toEqual(vitals);
 });
}
test.each(['jacked','fleeing','road rage'])('%s keeps constructor defaults when no retained vitals exist',async kind=>{
 const {ped,host,spawn}=fixture();expect(spawn(kind,0)).toBe(true);await vi.waitFor(()=>expect(host.createPed).toHaveBeenCalledOnce());expect(ped).toMatchObject({health:100,armour:0});
});
test('an exit copies a positive fractional scripted health without applying a new damage threshold',async()=>{
 const {ped,host,spawn}=fixture();spawn('jacked','MALE01',{health:.5,armour:7});await vi.waitFor(()=>expect(host.createPed).toHaveBeenCalledOnce());expect(ped).toMatchObject({health:.5,armour:7});
});
test('a traffic driver description retains its current surviving health',()=>{
 const car={},host:any=Object.assign(Object.create(WorldTraffic.prototype),{drivers:[{car,health:37.5}],driverModel:()=> 'MALE01'});expect(host.driverOf(car)).toMatchObject({vitals:{health:37.5,armour:0},dead:false});
});
test('gang driver, passenger and undragged-passenger exits retain their own wounds',()=>{
 const car={},unit:any={car,driver:'FAM1',driverHealth:37.5,shooterHealth:63.25,shooter:{model:'FAM2',gunState:{active:true}}},host:any=Object.assign(Object.create(GangDriveBy.prototype),{units:[unit]});expect(host.driverOf(car)).toMatchObject({vitals:{health:37.5,armour:0}});expect(host.frontPassengerOf(car)).toMatchObject({vitals:{health:63.25,armour:0}});expect(host.crewLeave(car)).toMatchObject({vitals:{health:63.25,armour:0}});
});
