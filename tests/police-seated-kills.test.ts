import {expect,test,vi} from 'vitest';
import {WorldPolice} from '../src/simulation/WorldPolice';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';

function fixture(){
 const car:any={wrecked:false,occupied:false},unit:any={car,member:{model:'fbi'},seatHealth:[100,100],seatArmour:[100,100],seats:[true,true],leaving:[],entering:[],deadSeats:[false,false],seconds:7,siren:true};
 const killed=vi.fn((_car,_seat,_creator)=>{expect(unit.seatHealth[_seat]).toBe(0);expect(unit.deathAccounted[_seat]).toBe(true);});
 const host:any=Object.assign(Object.create(WorldPolice.prototype),{units:[unit],onCrewKilled:killed});return {car,unit,host,killed};
}
test.each(['ped','vehicle','remote'] as const)('a %s fatal hit reports a seated cop once, with its creator and retained corpse state',creator=>{
 for(const seat of [0,1]){
  const {car,unit,host,killed}=fixture();expect(host.crewShot(car,seat,25,22,false,creator)).toBe('hit');expect(killed).not.toHaveBeenCalled();
  expect(host.crewShot(car,seat,25,22,true,creator)).toBe('killed');expect(unit.seatArmour[seat]).toBe(50);expect(killed).toHaveBeenCalledExactlyOnceWith(car,seat,creator);
  host.crewShot(car,seat,1000,22,true,creator);host.crewShot(car,seat,1000,22,true,creator);expect(killed).toHaveBeenCalledOnce();expect(unit.seatArmour[seat]).toBe(50);
  const description=seat?host.frontPassengerOf(car):host.driverOf(car);expect(description).toMatchObject({dead:true,deathAccounted:true,officer:{vitals:{health:0,armour:50}}});
 }
});
test.each(['occupied','wrecked','dead seat','zero health'])('a %s entry does not report a new police kill',kind=>{
 const {car,unit,host,killed}=fixture();if(kind==='occupied')car.occupied=true;if(kind==='wrecked')car.wrecked=true;if(kind==='dead seat')unit.deadSeats[0]=true;if(kind==='zero health')unit.seatHealth[0]=0;
 host.crewShot(car,0,1000,22,true,'ped');expect(killed).not.toHaveBeenCalled();expect(unit.seatArmour[0]).toBe(100);
});
test.each([false,true])('body reconstruction retains armour and only new deaths take weapon damage (accounted=%s)',accounted=>{
 const ped:any={health:100,armour:0,money:50,collider:{handle:8}},damage=vi.fn(()=>{ped.health=0;}),restore=vi.fn((p:any)=>{p.health=0;});
 const host:any=Object.assign(Object.create(WorldPedestrians.prototype),{damageCollider:damage,restoreDeadScriptPed:restore,spawnFromCar:(...args:any[])=>{args[5](ped);return true;}});
 expect(host.spawnDead('fbi',{x:0,y:0,z:0},0,undefined,false,false,{armour:50,accounted})).toBe(true);
 expect(ped).toMatchObject({health:0,armour:50,money:0});expect(damage).toHaveBeenCalledTimes(accounted?0:1);expect(restore).toHaveBeenCalledTimes(accounted?1:0);
});
