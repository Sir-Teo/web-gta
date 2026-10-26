import {expect,test,vi} from 'vitest';
import {CarEntry} from '../src/simulation/CarEntry';

function fixture(stopped=false){
 const sim={world:{castRay:()=>null},playerCollider:{}},car={disposed:false,wrecked:false,modelFlags:0,maximumPassengers:3,animGroup:{},assets:{handling:{values:{seatOffset:.3}}},
  car:{body:{handle:10,translation:()=>({x:0,y:2,z:0}),linvel:()=>({x:0,y:0,z:stopped?0:5})},nativeFramePosition:(name:string)=>({x:.5,y:name==='ped_backseat'?-1:1,z:.2})},
  seat:()=>({x:.5,y:1,z:.2}),worldPoint:(p:any)=>({x:p.x,y:p.z,z:-p.y}),heading:()=>0,canStepOut:()=>stopped,speed2D:()=>0};
 const entry=new CarEntry(sim as any,{slot:()=>undefined} as any),spawnPassenger=vi.fn((..._args:unknown[])=>true),spawnDead=vi.fn(),killed=vi.fn();
 entry.crowd={followers:()=>[],boardPassenger:()=>undefined,spawnPassenger,spawnDead};entry.onPassengerKilled=killed;
 entry.car=car as any;entry.phase='seated';
 const weapon={info:{type:22}},rider={modelRef:'FAM1',seat:2 as const,follow:true,gang:1,keep:{health:75,weapon,slot:1,id:8},driveBy:{} as any,groupDriveBy:'threat'};
 entry.passengers.push(rider);entry.stepPassengers(0);
 return {entry,car:car as any,rider,weapon,spawnPassenger,spawnDead,killed};
}

test('a seated recruit loses retained health and takes the same weapon and remaining health out of the car',()=>{
 const {entry,car,rider,weapon,spawnPassenger}=fixture();
 expect(entry.passengerShot(car,2,25,false)).toBe('hit');expect(rider.keep).toMatchObject({health:50,weapon,slot:1,id:8});
 expect(entry.passengerShot(car,3,25)).toBeUndefined();expect(entry.passengerShot({} as any,2,25)).toBeUndefined();
 entry.phase='waitSlow';expect(entry.passengerTargets()).toHaveLength(1);expect(entry.passengerPoses()).toHaveLength(1);
 entry.phase=undefined;entry.car=undefined;entry.stepPassengers(0);
 expect(entry.passengerTargets()).toHaveLength(1);entry.stepPassengers(3);
 expect(spawnPassenger).toHaveBeenCalledOnce();expect(spawnPassenger.mock.calls[0][4]).toMatchObject({health:50,weapon});
 expect(entry.passengerTargets()).toEqual([]);
});

test('a moving car keeps a dead recruit slumped, stops its drive-by and reports the death only once',()=>{
 const {entry,car,rider,killed,spawnPassenger}=fixture();
 expect(entry.passengerShot(car,2,1000,false)).toBe('killed');
 expect(rider).toMatchObject({diedInSeat:true,keep:{health:0},driveBy:undefined,groupDriveBy:undefined});
 expect(killed).toHaveBeenCalledExactlyOnceWith(rider,false);expect(entry.passengerTargets()).toEqual([]);expect(entry.ridingFollowers()).toBe(0);
 expect(entry.passengerPoses()[0]).toMatchObject({clip:'car_dead_rhs',seconds:1e6});
 expect(entry.passengerShot(car,2,1000)).toBeUndefined();
 entry.phase=undefined;entry.car=undefined;entry.stepPassengers(0);entry.stepPassengers(20);
 expect(spawnPassenger).not.toHaveBeenCalled();expect(entry.leavingPoses()[0]).toMatchObject({clip:'car_dead_rhs',seconds:1e6});
 expect(killed).toHaveBeenCalledOnce();car.disposed=true;entry.stepPassengers(1);expect(entry.leavingPoses()).toEqual([]);
 expect((entry as any).leaving).toEqual([]);
});

test('a shot passenger can step out of a stopped car as a corpse without receiving another kill event',()=>{
 const {entry,car,rider,killed,spawnPassenger,spawnDead}=fixture(true);
 expect(entry.passengerShot(car,2,1000,true,true)).toBe('killed');
 expect(entry.passengers).toEqual([]);expect(entry.passengerTargets()).toEqual([]);expect(entry.ridingFollowers()).toBe(0);
 expect(spawnPassenger).toHaveBeenCalledOnce();expect(spawnPassenger.mock.calls[0][4]).toMatchObject({health:0});expect(spawnPassenger.mock.calls[0][5]).toBeUndefined();
 expect(spawnDead).not.toHaveBeenCalled();expect(killed).toHaveBeenCalledExactlyOnceWith(rider,true);
});

test('a recruit killed while waiting to exit a moving car stays in that seat instead of reviving outside',()=>{
 const {entry,car,spawnPassenger}=fixture();entry.phase=undefined;entry.car=undefined;entry.stepPassengers(0);
 expect(entry.passengerShot(car,2,1000,false)).toBe('killed');entry.stepPassengers(20);
 expect(spawnPassenger).not.toHaveBeenCalled();expect(entry.leavingPoses()).toHaveLength(1);expect(entry.ridingFollowers()).toBe(0);
});

test('wrecked or disposed vehicles expose no live recruit targets',()=>{
 for(const flag of ['wrecked','disposed']){const {entry,car}=fixture();car[flag]=true;expect(entry.passengerTargets()).toEqual([]);expect(entry.passengerShot(car,2,10)).toBeUndefined();}
});

test('ordinary player damage keeps friendly-fire scaling and weakness, while a critical head hit still kills',()=>{
 const {entry,car,rider}=fixture();rider.keep={...rider.keep,defendMult:2} as any;
 expect(entry.passengerShot(car,2,25,true)).toBe('hit');expect((rider.keep as any).health).toBeCloseTo(70,5);
 // Even a large noncritical friendly hit is capped at 12.5.
 expect(entry.passengerShot(car,2,1000,true)).toBe('hit');expect((rider.keep as any).health).toBeCloseTo(57.5,5);
 expect(entry.passengerShot(car,2,1,true,true)).toBe('killed');expect((rider.keep as any).health).toBe(0);
});

test('a dead rider still owns his seat when the leader gets back into the same car',()=>{
 const {entry,car}=fixture();entry.passengerShot(car,2,1000,false);entry.phase=undefined;entry.car=undefined;entry.stepPassengers(0);
 car.doorMissing=()=>true;
 entry.car=car;entry.phase='seated';entry.crowd!.followers=()=>[1,2,3].map(id=>({id,health:100,down:0,position:{x:0,y:0,z:0}}));
 entry.crowd!.boardPassenger=id=>({modelRef:`FAM${id}`,follow:true,keep:{health:100}});
 entry.stepPassengers(0);
 expect(entry.passengers.map(p=>p.seat)).toEqual([1,3]);expect(entry.leavingPoses()).toHaveLength(1);
});

test.each([{byPlayer:false,headshot:false},{byPlayer:true,headshot:false},{byPlayer:false,headshot:true},{byPlayer:true,headshot:true}])('retained bullet proof rejects a seated wound or forced head death (%j)',c=>{
 const {entry,car,rider,killed}=fixture(),proofs={bullet:true,fire:false,explosion:false,collision:false,melee:false};rider.keep={...rider.keep,proofs} as any;
 expect(entry.passengerShot(car,2,1000,c.byPlayer,c.headshot,{weapon:38,piece:9})).toBeUndefined();expect(rider.keep.health).toBe(75);expect(rider).not.toHaveProperty('diedInSeat');expect(killed).not.toHaveBeenCalled();
 proofs.bullet=false;expect(entry.passengerShot(car,2,10,c.byPlayer,false,{weapon:22,piece:9})).toBe('hit');expect(rider.keep.health).toBeCloseTo(c.byPlayer?74:65,5);
});
test('a seated only-player recruit rejects NPC rounds but keeps ordinary player friendly-fire scaling',()=>{
 const {entry,car,rider,killed}=fixture();rider.keep={...rider.keep,onlyDamagedByPlayer:true} as any;
 expect(entry.passengerShot(car,2,1000,false,true,{weapon:22,piece:9})).toBeUndefined();expect(rider.keep.health).toBe(75);expect(killed).not.toHaveBeenCalled();
 expect(entry.passengerShot(car,2,10,true,false,{weapon:22,piece:9})).toBe('hit');expect(rider.keep.health).toBeCloseTo(74,5);
});
test.each([{piece:3,weapon:22,blocked:true},{piece:4,weapon:34,blocked:true},{piece:5,weapon:22,blocked:false},{piece:9,weapon:22,blocked:false},{piece:3,weapon:51,blocked:false}])('a retained vest only protects native instant-hit torso/ass contacts (%j)',c=>{
 const {entry,car,rider,killed}=fixture();rider.keep={...rider.keep,bulletProofVest:true} as any;
 expect(entry.passengerShot(car,2,10,false,false,c)).toBe(c.blocked?undefined:'hit');expect(rider.keep.health).toBe(c.blocked?75:65);expect(killed).not.toHaveBeenCalled();
});
