import {expect,test,vi} from 'vitest';
import {WorldTraffic} from '../src/simulation/WorldTraffic';

function fixture(){
 const car:any={occupied:false,driverOut:false,wrecked:false,autopilot:{}},driver:any={car,health:5000,fleeScene:true,cruiseSpeed:10};
 const killed=vi.fn((_car,_creator)=>{expect(driver.health).toBe(0);expect(driver.deathAccounted).toBe(true);expect(car.driverDead).toBe(true);});
 const host:any=Object.assign(Object.create(WorldTraffic.prototype),{drivers:[driver],elapsed:7,driverModel:()=> 'MALE01',driverStats:()=>({defend:1.1}),onDriverKilled:killed});return {car,driver,host,killed};
}
test.each(['ped','vehicle','remote'] as const)('a traffic %s hit applies weakness, then reports a forced head death and its creator once',creator=>{
 const {car,driver,host,killed}=fixture();expect(host.driverShot(car,25,false,creator)).toBe('hit');expect(driver.health).toBe(4972.5);expect(killed).not.toHaveBeenCalled();
 expect(host.driverShot(car,25,true,creator)).toBe('killed');expect(killed).toHaveBeenCalledExactlyOnceWith(car,creator);
 expect(host.driverShot(car,1000,true,creator)).toBe('killed');expect(host.driverShot(car,1000,true,creator)).toBe('killed');expect(killed).toHaveBeenCalledOnce();
 expect(host.driverOf(car)).toEqual({model:'MALE01',vitals:{health:0,armour:0},dead:true,deathAccounted:true});expect(driver.dying).toEqual({at:7000});
});
test.each(['occupied','out','wrecked','no autopilot','dead','fled','raged','zero health'])('a %s driver entry reports no new kill',kind=>{
 const {car,driver,host,killed}=fixture();if(kind==='occupied')car.occupied=true;if(kind==='out')car.driverOut=true;if(kind==='wrecked')car.wrecked=true;if(kind==='no autopilot')car.autopilot=undefined;if(kind==='dead')driver.dead=true;if(kind==='fled')driver.fled=true;if(kind==='raged')driver.raged=true;if(kind==='zero health')driver.health=0;
 host.driverShot(car,1000,true,'ped');expect(killed).not.toHaveBeenCalled();
});
test('native weakness is applied before the ordinary one-HP death boundary',()=>{
 const {car,driver,host}=fixture();driver.health=28.5;expect(host.driverShot(car,25)).toBe('hit');expect(driver.health).toBe(1);
 driver.health=28;expect(host.driverShot(car,25)).toBe('killed');expect(driver.health).toBe(0);
});
test.each([false,true])('vehicle destruction preserves prior death accounting (accounted=%s)',accounted=>{
 const {car,driver,host}=fixture();driver.deathAccounted=accounted;host.onDriverDied=vi.fn();host.driverVehicleDied(driver,true);
 expect(host.onDriverDied).toHaveBeenCalledExactlyOnceWith(car,{armour:0,accounted});
});
test.each(['zero health','dying','dead','already exiting','occupied','out','no autopilot'])('a %s driver does not take a live exit when the vehicle catches fire',kind=>{
 const {car,driver,host}=fixture();if(kind==='zero health')driver.health=0;if(kind==='dying')driver.dying={at:0};if(kind==='dead')driver.dead=true;if(kind==='already exiting')driver.fired=true;if(kind==='occupied')car.occupied=true;if(kind==='out')car.driverOut=true;if(kind==='no autopilot')car.autopilot=undefined;host.onFire=vi.fn();host.driverVehicleOnFire(driver);expect(host.onFire).not.toHaveBeenCalled();
});
test('a living occupant takes the fire exit once',()=>{
 const {car,driver,host}=fixture();host.onFire=vi.fn();host.driverVehicleOnFire(driver);host.driverVehicleOnFire(driver);expect(host.onFire).toHaveBeenCalledExactlyOnceWith(car);expect(driver.fired).toBe(true);
});
