import {expect,test,vi} from 'vitest';
import {copHealth,copArmour} from '../src/ped/nativeCopVitals';
import {WorldPolice} from '../src/simulation/WorldPolice';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';

test.each([['lapd1',0],['csher',0],['swat',50],['fbi',100],['army',100]] as const)('native %s cops start at 100 health and %s armour', (model,armour)=>{
 expect(copHealth(model)).toBe(100);expect(copArmour(model)).toBe(armour);
});
function fixture(model='swat'){
 const car:any={wrecked:false,occupied:false,health:1000,onFire:false,heading:()=>0,car:{body:{translation:()=>({x:0,y:0,z:0}),rotation:()=>({x:0,y:0,z:0,w:1})}},animGroup:{id:0},doors:[{closed:true}],doorMissing:()=>true};
 const unit:any={car,member:{model,weapon:28,accuracy:68},seats:[true,true],seatHealth:[100,100],deadSeats:[false,false],leaving:[],entering:[],returning:new Map(),seconds:7,siren:true};
 const host:any=Object.assign(Object.create(WorldPolice.prototype),{units:[unit],law:{level:0},clips:{slot:()=>undefined},doorPoint:()=>({x:0,y:0,z:0}),sim:{player:{position:{x:0,y:0,z:0}},world:{castRay:()=>null}},spawnOfficer:vi.fn()});
 car.worldPoint=(p:any)=>p;return {car,unit,host};
}
test('a seated SWAT cop spends armour before health, while a forced head death spends only the hit factor',()=>{
 const {car,unit,host}=fixture();expect(host.crewShot(car,0,25,22)).toBe('hit');expect(unit.seatHealth[0]).toBe(100);expect(unit.seatArmour[0]).toBe(25);
 expect(host.crewShot(car,0,10,22,true)).toBe('killed');expect(unit.seatHealth[0]).toBe(0);expect(unit.seatArmour[0]).toBe(15);expect(unit.driverDying).toEqual({at:7});
 expect(host.crewShot(car,0,25,22)).toBe('killed');expect(unit.seatArmour[0]).toBe(15);
});
test('a wounded seated cop retains both values on exit and in the drag-out description',()=>{
 const {car,unit,host}=fixture('fbi');host.crewShot(car,1,125,22);
 expect(host.frontPassengerOf(car).officer.vitals).toEqual({health:75,armour:0});host.finishExit(unit,1);
 expect(host.spawnOfficer.mock.calls[0][7]).toEqual({health:75,armour:0});
});
test('a cop returning to a different seat retains live health and armour before entering',()=>{
 const {car,unit,host}=fixture('army');unit.seats=[false,false];unit.returning.set(9,{seat:0,time:0,best:1,stall:0});
 host.crew={list:()=>[{id:9,seat:1,health:63,armour:17,position:{x:0,y:0,z:0},down:false}],board:vi.fn(()=>true),goTo:vi.fn()};host.enterPhase=vi.fn();host.recallCrew(unit,.1);
 expect(unit.seatHealth[0]).toBe(63);expect(unit.seatArmour[0]).toBe(17);expect(host.enterPhase).toHaveBeenCalledWith(unit,0,'align');
});
test('the walking crew list exposes actual wounds before the body is removed on boarding',()=>{
 const unit={},ped:any={id:9,health:63,armour:17,crew:{unit,seat:1},actor:{player:{position:{x:0,y:0,z:0}}},down:0};
 const host:any=Object.assign(Object.create(WorldPedestrians.prototype),{people:[ped],remove:vi.fn()});
 expect(host.footCrew(unit)[0]).toMatchObject({health:63,armour:17});expect(host.boardOfficer(9)).toBe(true);expect(host.people).toEqual([]);
});
