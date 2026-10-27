import {expect,test,vi} from 'vitest';
import {GangDriveBy} from '../src/simulation/GangDriveBy';

function fixture(wave=true){
 const position={x:20,y:0,z:0},car:any={occupied:false,wrecked:false,disposed:false,driverOut:false,missionCar:false,trafficOrigin:!wave,activeRadius:250,autopilot:{mission:61},car:{body:{translation:()=>position,rotation:()=>({x:0,y:0,z:0,w:1}),linvel:()=>({x:0,y:0,z:0})}}};
 const unit:any={car,gang:0,driver:'BALLAS1',shooter:{model:'BALLAS2',gunState:{active:true},seconds:0},driverHealth:100,shooterHealth:100,seconds:0,mission:'attack',leaveAt:Infinity,...(wave?{wave:{fireRate:50,firing:true,stopped:false}}:{})};
 const fleet={cars:new Set([car]),removeTrafficCar:vi.fn((c:any)=>c.trafficOrigin&&fleet.cars.delete(c)),removeVehicle:vi.fn((c:any)=>{fleet.cars.delete(c);c.disposed=true;})},carMissions={forget:vi.fn(),clear:vi.fn(),carMission:vi.fn()},stepShooter=vi.fn();
 const host:any=Object.assign(Object.create(GangDriveBy.prototype),{units:[unit],seconds:0,sim:{player:{position:{x:0,y:0,z:0},health:100}},fleet,carMissions,canSpawn:()=>false,stepShooter});
 const step=(seconds:number)=>{for(let n=0;n<seconds*60;n++)host.beforeStep(1/60);};return {car,unit,position,fleet,host,carMissions,stepShooter,step};
}
test('an attack-wave car and its shooter survive beyond the ambient drive-by timeout',()=>{
 const {car,unit,fleet,host,step,stepShooter}=fixture();step(65);
 expect(host.units).toEqual([unit]);expect(unit.seconds).toBeGreaterThan(64);expect(stepShooter).toHaveBeenCalledTimes(3900);expect(host.waveDrivers()).toHaveLength(1);expect(fleet.cars.has(car)).toBe(true);expect(fleet.removeTrafficCar).not.toHaveBeenCalled();
});
test('an ordinary ambient drive-by retains its lifetime budget',()=>{
 const {host,fleet,step}=fixture(false);step(46);expect(host.units).toHaveLength(0);expect(fleet.removeTrafficCar).toHaveBeenCalledOnce();
});
test('releasing wave membership preserves the existing crew, wounds and driving task beyond 45 seconds',()=>{
 const {car,unit,host,step,carMissions,stepShooter}=fixture();car.missionCar=true;unit.driverHealth=40;unit.shooterHealth=60;const mission=car.autopilot;
 host.releaseCarsInAttackWave();host.releaseCarsInAttackWave();step(65);
 expect(car.missionCar).toBe(false);expect(unit.wave.released).toBe(true);expect(host.waveDrivers()).toEqual([]);expect(host.units).toEqual([unit]);expect(car.autopilot).toBe(mission);expect(unit.driverHealth).toBe(40);expect(unit.shooterHealth).toBe(60);expect(stepShooter).toHaveBeenCalledTimes(3900);expect(carMissions.forget).not.toHaveBeenCalled();expect(carMissions.clear).not.toHaveBeenCalled();expect(carMissions.carMission).not.toHaveBeenCalled();
});
test.each(['visible','inside radius','mission protected'])('a %s wave car stays in the population',kind=>{
 const {position,host,car,fleet,step}=fixture();position.x=300;host.canSpawn=()=>true;
 if(kind==='visible')host.canSpawn=()=>false;if(kind==='inside radius')position.x=250;if(kind==='mission protected')car.missionCar=true;
 step(1);expect(host.units).toHaveLength(1);expect(fleet.removeTrafficCar).not.toHaveBeenCalled();
});
test('an unseen random wave car outside the active radius is removed and its mission forgotten',()=>{
 const {position,host,car,fleet,carMissions,step}=fixture();position.x=251;host.canSpawn=()=>true;step(1);
 expect(host.units).toHaveLength(0);expect(carMissions.forget).toHaveBeenCalledExactlyOnceWith(car);expect(fleet.removeVehicle).toHaveBeenCalledExactlyOnceWith(car);expect(car.disposed).toBe(true);expect(fleet.cars.has(car)).toBe(false);
});
test('taking a wave car releases manager ownership without deleting the player vehicle',()=>{
 const {host,car,fleet,carMissions,step}=fixture();car.occupied=true;step(1);expect(host.units).toHaveLength(0);expect(fleet.cars.has(car)).toBe(true);expect(fleet.removeTrafficCar).not.toHaveBeenCalled();expect(carMissions.forget).toHaveBeenCalledExactlyOnceWith(car);
});

test('disposing a wave manager removes its script-created cars and car missions',()=>{const {host,car,fleet,carMissions}=fixture();host.dispose();expect(fleet.removeVehicle).toHaveBeenCalledExactlyOnceWith(car);expect(car.disposed).toBe(true);expect(carMissions.forget).toHaveBeenCalledExactlyOnceWith(car);expect(host.units).toEqual([]);});
