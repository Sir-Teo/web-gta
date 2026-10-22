import {expect,test,vi} from 'vitest';
import fixture from './fixtures/native-world-centre.json';
import {Simulation} from '../src/simulation/Simulation';
import {WorldFleet} from '../src/simulation/WorldFleet';
import {WorldTraffic} from '../src/simulation/WorldTraffic';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';
const renderer=(p:number[])=>({x:p[0],y:p[2],z:-p[1]});
function simulation(row:typeof fixture.cases[number]){
 const point=(name:keyof typeof fixture.positions)=>renderer(fixture.positions[name].map((v,i)=>v+(row.input.matrix?[.25,.5,.75][i]:0))),player=point(row.input.occupied?'occupied':'ped');
 const sim=Object.assign(Object.create(Simulation.prototype),{player:{position:player},streamingFocus:row.input.remote?()=>point('remote'):undefined})as Simulation;expect(sim.worldFocus).toEqual(renderer(row.position));return sim;
}
function vehicle(point:{x:number;y:number;z:number},sim:Simulation){
 const body={translation:()=>point},v={body,car:{body},disposed:false,occupied:false,missionCar:false,policeHeli:false,dispose(){this.disposed=true;},distance:()=>Math.hypot(point.x-sim.player.position.x,point.y-sim.player.position.y,point.z-sim.player.position.z)};return v;
}
for(const[index,row]of fixture.cases.entries()){
 test(`fleet retains all families around native centre ${index}: ${JSON.stringify(row.input)}`,()=>{
  const sim=simulation(row),fleet=Object.assign(Object.create(WorldFleet.prototype),{disposed:false,nextCheck:0,sim,carParkCars:new Set(),generated:new Map(),driven:new Map(),cars:new Set(),planes:new Set(),boats:new Set(),bikes:new Set(),generatedOther:new Map(),canChangePopulation:()=>true})as any;
  fleet.removeVehicle=(v:any)=>{v.dispose();fleet.carParkCars.delete(v);};fleet.removePlane=(v:any)=>{v.dispose();fleet.planes.delete(v);};
  const near=()=>vehicle({...sim.worldFocus,x:sim.worldFocus.x+10},sim),parked=near(),generated=near(),driven=near(),plane=near(),boat=near(),bike=near();fleet.carParkCars.add(parked);fleet.generated.set(generated,'generated');fleet.driven.set(driven,0);fleet.cars=new Set([generated,driven]);fleet.planes.add(plane);fleet.boats.add(boat);fleet.bikes.add(bike);
  fleet.update(200000);expect([parked,generated,driven,plane,boat,bike].map(v=>v.disposed)).toEqual([false,false,false,false,false,false]);
 });
 test(`traffic retains drivers and loads paths around native centre ${index}`,async()=>{
  const sim=simulation(row),car=vehicle({...sim.worldFocus,x:sim.worldFocus.x+10},sim),removed=vi.fn(),loadAround=vi.fn(async()=>{}),owner={sim,disposed:false,busy:false,nextCheck:0,paths:{loadAround},drivers:[{car}],fleet:{canChangePopulation:()=>true,removeTrafficCar:removed,trafficDrivers:()=>3,cars:new Set(),outside:()=>false}}as any;
  WorldTraffic.prototype.update.call(owner,200000);await Promise.resolve();await Promise.resolve();expect(removed).not.toHaveBeenCalled();expect(owner.drivers).toHaveLength(1);expect(loadAround).toHaveBeenCalledWith(sim.worldFocus.x,sim.worldFocus.z);
 });
 test(`pedestrian retirement uses native centre ${index}`,()=>{
  const sim=simulation(row),at={...sim.worldFocus,x:sim.worldFocus.x+10},ped={health:100,actor:{player:{position:at}},alpha:255,neededUntil:0},remove=vi.fn(),owner={sim,disposed:false,catalog:{},pcdm:()=>1,clock:0,people:[ped],busy:true,canSpawn:()=>true,remove}as any;
  WorldPedestrians.prototype.update.call(owner,200000);expect(remove).not.toHaveBeenCalled();expect(owner.people).toEqual([ped]);
 });
}
test('ambient vehicles beside CJ retire while the RC focus is elsewhere, but mission vehicles survive',()=>{
 const sim=simulation(fixture.cases.find(r=>r.input.remote)!),fleet=Object.assign(Object.create(WorldFleet.prototype),{disposed:false,nextCheck:0,sim,carParkCars:new Set(),generated:new Map(),driven:new Map(),cars:new Set(),planes:new Set(),boats:new Set(),bikes:new Set(),generatedOther:new Map(),canChangePopulation:()=>true})as any;
 fleet.removePlane=(v:any)=>{v.dispose();fleet.planes.delete(v);};const ambient=vehicle({...sim.player.position},sim),mission=vehicle({...sim.player.position},sim);mission.missionCar=true;fleet.bikes.add(ambient);fleet.boats.add(mission);fleet.update(200000);expect(ambient.disposed).toBe(true);expect(mission.disposed).toBe(false);
});
