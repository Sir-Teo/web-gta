import {expect,test,vi} from 'vitest';
import {WorldEmergency} from '../src/simulation/WorldEmergency';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';

function fixture(kind:'medic'|'fireman'='medic'){
 const car:any={occupied:false,wrecked:false,disposed:false,driverOut:false,siren:true,autopilot:{},car:{body:{translation:()=>({x:0,y:0,z:0}),rotation:()=>({x:0,y:0,z:0,w:1}),linvel:()=>({x:0,y:0,z:0}),angvel:()=>({x:0,y:0,z:0})},nativeFramePosition:()=>({x:1,y:0,z:0})}};
 const member:any={car,model:kind==='medic'?'laemt1':'lafd1',...(kind==='medic'?{medics:[0,2].map(seat=>({seat,state:'seated',time:0}))}:{aim:{yaw:0,pitch:0}})};
 const host:any=Object.assign(Object.create(WorldEmergency.prototype),{units:kind==='medic'?[member]:[],trucks:kind==='fireman'?[member]:[],seconds:7,driving:{forget:vi.fn()},modelStats:()=>({defend:kind==='medic'?1.4:.8,pedType:kind==='medic'?'MEDIC':'FIREMAN'})});return {car,member,host};
}
for(const kind of ['medic','fireman'] as const)for(const creator of ['ped','vehicle','remote'] as const)test(`${kind} seated damage reports ${creator} death once with native weakness and type`,()=>{
 const {car,member,host}=fixture(kind),seat=kind==='medic'?2:1,state=host.vitals(member,seat);state.health=5000;host.onCrewKilled=vi.fn(()=>{expect(state.health).toBe(0);expect(state.accounted).toBe(true);});
 expect(host.crewShot(car,seat,25,22,false,creator)).toBe('hit');expect(state.health).toBe(kind==='medic'?4965:4980);expect(host.onCrewKilled).not.toHaveBeenCalled();expect(host.crewShot(car,seat,25,22,true,creator)).toBe('killed');expect(host.onCrewKilled).toHaveBeenCalledExactlyOnceWith(car,seat,member.model,creator,kind==='medic'?'MEDIC':'FIREMAN');host.crewShot(car,seat,1000,22,true,creator);expect(host.onCrewKilled).toHaveBeenCalledOnce();expect(state.dead).toBe(true);
});
test.each(['medic','fireman'] as const)('a killed %s driver coasts normally and hands off an accounted corpse once',kind=>{
 const {car,member,host}=fixture(kind);host.onCrewKilled=vi.fn();host.onCrewDiesOut=vi.fn();expect(host.crewShot(car,0,25,22,true,'remote')).toBe('killed');expect(car.driverDead).toBe(true);expect(host.driverOf(car)).toMatchObject({vitals:{health:0,armour:0},dead:true,deathAccounted:true});expect(host.driving.forget).toHaveBeenCalledExactlyOnceWith(car);
 expect(host.crewShot(car,0,25,22,true,'remote')).toBe('killed');host.seconds=8.99;host.stepDeadDriver(member);expect(host.onCrewDiesOut).not.toHaveBeenCalled();host.seconds=9;host.stepDeadDriver(member);host.stepDeadDriver(member);expect(host.onCrewDiesOut).toHaveBeenCalledExactlyOnceWith(car,member.model,{armour:0,accounted:true});expect(car.driverOut).toBe(true);expect(host.onCrewKilled).toHaveBeenCalledOnce();
});
test.each(['occupied','wrecked','disposed','out','leaving','foot','missing seat'])('an ineligible %s medic entry receives no damage',kind=>{
 const {car,member,host}=fixture();if(kind==='occupied')car.occupied=true;if(kind==='wrecked')car.wrecked=true;if(kind==='disposed')car.disposed=true;if(kind==='out')car.driverOut=true;if(kind==='leaving')member.medics[0].state='leaving';if(kind==='foot')member.medics[0].state='foot';host.onCrewKilled=vi.fn();expect(host.crewShot(car,kind==='missing seat'?1:0,1000,22,true)).toBeUndefined();expect(host.onCrewKilled).not.toHaveBeenCalled();
});
test('only actual seated emergency crew are bullet targets and dead passengers are removed from the target list',()=>{
 const {car,member,host}=fixture();expect(host.crewSeats().map((p:any)=>p.seat)).toEqual([0,2]);member.medics[1].state='foot';expect(host.crewSeats().map((p:any)=>p.seat)).toEqual([0]);member.medics[1].state='seated';host.crewShot(car,2,25,22,true);expect(host.crewSeats().map((p:any)=>p.seat)).toEqual([0]);
});
test('medic armour and the exact-one boundary are applied before forced death',()=>{
 const {car,member,host}=fixture(),v=host.vitals(member,0);v.health=36;v.armour=20;expect(host.crewShot(car,0,25)).toBe('hit');expect(v).toMatchObject({health:21,armour:0});v.health=36;expect(host.crewShot(car,0,25)).toBe('hit');expect(v.health).toBe(1);v.health=35.5;expect(host.crewShot(car,0,25)).toBe('killed');expect(v.health).toBe(0);
});
test('a dead driver stops the fire engine cannon',()=>{
 const {car,member,host}=fixture('fireman');member.mission='cannon';member.fire={active:true};expect(host.cannons()).toHaveLength(1);host.crewShot(car,0,25,22,true);expect(host.cannons()).toEqual([]);
});
test('a moving driver holds the dead seat instead of taking an exit that the car cannot support',()=>{
 const {car,member,host}=fixture();car.car.body.linvel=()=>({x:100,y:0,z:0});host.onCrewDiesOut=vi.fn();host.crewShot(car,0,25,22,true);host.seconds=9;host.stepDeadDriver(member);expect(host.onCrewDiesOut).not.toHaveBeenCalled();expect(member.driverDead).toBe(true);expect(host.vitals(member,0).dead).toBe(true);expect(car.driverOut).toBe(false);expect(host.crewSeats().map((p:any)=>p.seat)).toEqual([2]);
});
test('a wounded fireman passenger description preserves live and counted-dead vitals',()=>{
 const {car,member,host}=fixture('fireman');host.crewShot(car,1,25);expect(host.frontPassengerOf(car)).toMatchObject({vitals:{health:80,armour:0},dead:false,deathAccounted:false});host.crewShot(car,1,25,22,true);expect(host.frontPassengerOf(car)).toMatchObject({vitals:{health:0,armour:0},dead:true,deathAccounted:true});
});
test('an exiting medic supplies current seat vitals to the actual foot-body bridge',async()=>{
 const {car,member,host}=fixture(),m=member.medics[1];host.crewShot(car,2,25);host.doorPoint=()=>({x:0,y:0,z:0});car.worldPoint=(p:any)=>p;car.heading=()=>0;host.sim={world:{castRay:()=>null}};host.crowd={spawnCrew:vi.fn(async()=>false)};await host.finishExit(member,m);expect(host.crowd.spawnCrew.mock.calls[0][4]).toMatchObject({health:65,armour:0});
});
test('a returning medic copies foot wounds before its entry task and clears stale seat death accounting',()=>{
 const {car,member,host}=fixture(),m=member.medics[0],v=host.vitals(member,0);v.accounted=true;v.dead=true;m.state='foot';m.id=9;m.task='return';m.best=Infinity;m.stall=0;host.doorPoint=()=>({x:0,y:0,z:0});car.worldPoint=(p:any)=>p;host.crowd={crewState:()=>({position:{x:0,y:0,z:0},health:63,armour:17,alive:true,down:false,busy:false}),board:vi.fn(()=>true)};host.enterPhase=vi.fn();host.stepMedic(member,m,1/60);expect(v).toMatchObject({health:63,armour:17,dead:false,accounted:false});expect(host.enterPhase).toHaveBeenCalledWith(member,m,'align');
});
test('the foot crew state exposes actual health and armour',()=>{
 const p:any={id:9,health:63,armour:17,down:0,actor:{player:{position:{x:0,y:0,z:0}}}},host:any=Object.assign(Object.create(WorldPedestrians.prototype),{people:[p]});expect(host.crewState(9)).toMatchObject({health:63,armour:17,alive:true,down:false});
});
test('constructing an emergency foot body restores its retained vitals',async()=>{
 const ped:any={id:9,health:100,armour:0},crew={unit:{},seat:2},host:any=Object.assign(Object.create(WorldPedestrians.prototype),{disposed:false,catalog:{character:async()=>({}),characterSpeeds:async()=>({walk:1,run:2,sprint:3}),characterStats:async()=>({attack:1,defend:1})},nearestNode:()=>({}),createPed:()=>ped});expect(await host.spawnCrew('laemt1',{x:0,y:0,z:0},0,crew,{health:63,armour:17})).toBe(9);expect(ped).toMatchObject({health:63,armour:17,crew});
});
test.each(['medic','fireman'] as const)('the %s death controller relinquishes the car once CJ takes it',kind=>{
 const {car,member,host}=fixture(kind);host.crewShot(car,0,25,22,true);car.occupied=true;member.taken=true;const controls={throttle:1};car.autopilot=controls;if(kind==='medic')host.stepUnit(member,1/60);else host.stepTruck(member,1/60);expect(car.autopilot).toBe(controls);
});
test.each(['medic','fireman'] as const)('dragging a dying %s driver out cancels the later death-exit body',kind=>{
 const {car,member,host}=fixture(kind);host.onCrewDiesOut=vi.fn();host.crewShot(car,0,25,22,true);car.driverOut=true;host.seconds=8;if(kind==='medic')host.stepUnit(member,1/60);else host.stepTruck(member,1/60);host.seconds=10;if(kind==='medic')host.stepUnit(member,1/60);else host.stepTruck(member,1/60);expect(host.onCrewDiesOut).not.toHaveBeenCalled();expect(member.driverDying).toBeUndefined();expect(host.driverOf(car)).toMatchObject({dead:true,deathAccounted:true});
});
