import {expect,test,vi} from 'vitest';
import {healthAfter} from '../src/ped/damage';
import {scriptRiderShot} from '../src/vehicle/scriptRiderShot';
import {CarEntry} from '../src/simulation/CarEntry';
import {WorldPolice} from '../src/simulation/WorldPolice';
import {GangDriveBy} from '../src/simulation/GangDriveBy';
import {WorldTraffic} from '../src/simulation/WorldTraffic';

function actor(kind:string){
 const car:any={occupied:false,wrecked:false,disposed:false,driverOut:false,autopilot:{},canStepOut:()=>false,car:{body:{handle:1,translation:()=>({x:0,y:0,z:0})}},seat:()=>({x:0,y:0,z:0}),seatPose:()=>({local:{x:0,y:0,z:0},headingOffset:0}),assets:{},animGroup:{}};
 if(kind==='mission'){const state={health:25.5,invulnerable:false},kill=vi.fn();return {hit:(damage:number)=>scriptRiderShot(state,damage,22,false,kill),health:()=>state.health,dead:()=>!!(state as any).diedInSeat};}
 if(kind==='recruit'){
  const entry=new CarEntry({} as any,{} as any),rider={modelRef:'FAM1',seat:1 as const,follow:true,keep:{health:25.5}};entry.car=car;entry.phase='seated';entry.passengers.push(rider);
  return {hit:(damage:number)=>entry.passengerShot(car,1,damage,false,false,{weapon:22,piece:9}),health:()=>rider.keep.health,dead:()=>!!(rider as any).diedInSeat};
 }
 if(kind.startsWith('police')){
  const seat=kind==='police driver'?0:1,unit={car,seats:[true,true],deadSeats:[false,false],seatHealth:[25.5,25.5],seconds:3,siren:true},host:any=Object.assign(Object.create(WorldPolice.prototype),{units:[unit]});
  return {hit:(damage:number)=>host.crewShot(car,seat,damage),health:()=>unit.seatHealth[seat],dead:()=>seat?unit.deadSeats[seat]:!!(unit as any).driverDying};
 }
 if(kind.startsWith('gang')){
  const seat=kind==='gang driver'?0:1,unit={car,driverHealth:25.5,shooterHealth:25.5,shooter:{gunState:{active:true}},seconds:3},host:any=Object.assign(Object.create(GangDriveBy.prototype),{units:[unit]});
  return {hit:(damage:number)=>host.crewShot(car,seat,damage),health:()=>seat?unit.shooterHealth:unit.driverHealth,dead:()=>seat?!!(unit as any).shooterDead:!!(unit as any).driverDying};
 }
 const driver={car,health:25.5,fleeScene:true},host:any=Object.assign(Object.create(WorldTraffic.prototype),{drivers:[driver],elapsed:3});
 return {hit:(damage:number)=>host.driverShot(car,damage),health:()=>driver.health,dead:()=>!!(driver as any).dying};
}
test.each(['mission','recruit','police driver','police passenger','gang driver','gang passenger','traffic driver'])('the %s damage entry preserves one HP but kills a positive remainder below one',kind=>{
 const alive=actor(kind);expect(alive.hit(24.5)).toBe('hit');expect(alive.health()).toBe(1);expect(alive.dead()).toBe(false);
 const dead=actor(kind);expect(dead.hit(25)).toBe('killed');expect(dead.health()).toBe(0);expect(dead.dead()).toBe(true);
});
test('the shared ordinary calculator keeps its exact boundary and clamps overkill',()=>{
 expect(healthAfter(25.5,24.5)).toBe(1);expect(healthAfter(25.5,24.75)).toBe(0);expect(healthAfter(25.5,26)).toBe(0);expect(healthAfter(25.5,10)).toBe(15.5);
});
