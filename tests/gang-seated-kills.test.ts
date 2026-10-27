import {expect,test,vi} from 'vitest';
import {GangDriveBy} from '../src/simulation/GangDriveBy';

function fixture(gang=0){
 const model=['BALLAS1','FAM1','LSV1'][gang],car:any={wrecked:false,occupied:false,driverOut:false};
 const unit:any={car,gang,driver:model,shooter:{model,gunState:{active:true}},driverHealth:5000,shooterHealth:5000,seconds:7};
 const killed=vi.fn((_car,seat,_gang,_creator)=>{expect(seat?unit.shooterHealth:unit.driverHealth).toBe(0);expect(unit.deathAccounted[seat]).toBe(true);if(seat)expect(unit.shooter.gunState.active).toBe(false);});
 const host:any=Object.assign(Object.create(GangDriveBy.prototype),{units:[unit],onCrewKilled:killed});return {car,unit,host,killed};
}
test.each([0,1,2])('gang %s occupants report their gang and creator once, including forced death above the old 1000 amount',gang=>{
 for(const creator of ['ped','vehicle','remote'])for(const seat of [0,1]){
  const {car,unit,host,killed}=fixture(gang);expect(host.crewShot(car,seat,25,false,creator)).toBe('hit');expect(killed).not.toHaveBeenCalled();
  expect(host.crewShot(car,seat,25,true,creator)).toBe('killed');expect(killed).toHaveBeenCalledExactlyOnceWith(car,seat,gang,creator);
  host.crewShot(car,seat,1000,true,creator);host.crewShot(car,seat,1000,true,creator);expect(killed).toHaveBeenCalledOnce();
  expect(seat?host.frontPassengerOf(car):host.driverOf(car)).toMatchObject({dead:true,deathAccounted:true});
 }
});
test.each(['occupied','wrecked','invalid seat','dead driver','gone shooter','zero health'])('a %s entry reports no new gang kill',kind=>{
 const {car,unit,host,killed}=fixture();let seat=0;if(kind==='occupied')car.occupied=true;if(kind==='wrecked')car.wrecked=true;if(kind==='invalid seat')seat=2;if(kind==='dead driver')unit.driverDead=true;if(kind==='gone shooter'){seat=1;unit.shooterGone=true;}if(kind==='zero health')unit.driverHealth=0;
 host.crewShot(car,seat,25,true,'ped');expect(killed).not.toHaveBeenCalled();
});
