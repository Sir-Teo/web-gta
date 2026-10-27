import {expect,test,vi} from 'vitest';
import {WeaponSystem,type SeatedTarget} from '../src/weapons/WeaponSystem';
import {WantedSystem,CRIME} from '../src/simulation/WantedSystem';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';

function fixture(){
 const weapons=new WeaponSystem({} as any,()=>undefined,()=>undefined),crime=vi.fn(),practice=vi.fn();
 weapons.onCrime=crime;weapons.onHit=practice;weapons.onSeatedShot=()=> 'hit';
 const car={car:{body:{handle:77}}},target:SeatedTarget<any>={car,seat:0,local:{x:0,y:0,z:0},kind:'script',noCriticalHits:true};
 const hit=(t=target,sniper=false)=>(weapons as any).damageSeated(t,25,sniper?34:22,sniper);
 return {weapons,crime,practice,target,hit};
}

test.each([false,true])('a live civilian seated firearm victim reports GenerateDamageEvent, impact and queued crimes (sniper=%s)',sniper=>{
 const f=fixture();f.target.crimeVictim='script-ped:41';f.target.pedType='CIVMALE';f.hit(f.target,sniper);
 expect(f.crime.mock.calls).toEqual([[CRIME.damagedPed,'script-ped:41',false,false],[CRIME.damageCar,'script-ped:41',true,false],[CRIME.damageCar,'script-ped:41',false,false]]);expect(f.practice).toHaveBeenCalledOnce();
});
test.each([false,true])('a seated script cop uses the firearm criminal event and CBulletInfo impact selection (sniper=%s)',sniper=>{
 const f=fixture();f.target.crimeVictim='script-ped:42';f.target.pedType='COP';f.hit(f.target,sniper);
 expect(f.crime.mock.calls).toEqual([[CRIME.damagedPed,'script-ped:42',false,false],[CRIME.damageCopCar,'script-ped:42',true,false],[sniper?CRIME.damageCopCar:CRIME.damageCar,'script-ped:42',false,false]]);
});
test.each(['GANG1','GANG2','GANG3','GANG4','GANG5','GANG6','GANG7','GANG8','GANG9','GANG10','DEALER','CRIMINAL'])('the seated %s victim retains PoliceDontCareAboutCrimesAgainstPedType',pedType=>{
 const f=fixture();f.target.pedType=pedType;f.target.crew=true;f.hit();
 expect(f.crime.mock.calls).toHaveLength(3);for(const call of f.crime.mock.calls)expect(call[3]).toBe(true);expect(f.practice).not.toHaveBeenCalled();
});
test('different occupants of one vehicle keep distinct crime IDs, and repeated hits on one victim deduplicate in CWanted',()=>{
 const f=fixture(),law=new WantedSystem();
 f.weapons.onCrime=(type,victim,queued,dontCare)=>{if(queued)law.registerCrime(type,victim!,dontCare);else law.crime(type,victim,dontCare);};
 const other={...f.target,seat:1};f.hit();expect(law.native.snapshot().queued).toBe(2);f.hit(other);expect(law.native.snapshot().queued).toBe(4);f.hit();expect(law.native.snapshot().queued).toBe(4);
});
test('a retained on-foot identity is used for a recruit, and absent damage targets report no damage crime',()=>{
 const f=fixture();f.target.kind='passenger';f.target.crimeVictim='ped:19';f.hit();expect(f.crime.mock.calls.every(c=>c[1]==='ped:19')).toBe(true);
 f.crime.mockClear();f.weapons.onSeatedShot=()=>undefined;f.hit();expect(f.crime).not.toHaveBeenCalled();
});
test.each([false,true])('an active drive-by victim queues damage only when killed (fatal=%s)',fatal=>{
 const f=fixture();f.target.activeDriveBy=true;f.weapons.onSeatedShot=()=>fatal?'killed':'hit';f.hit();
 expect(f.crime.mock.calls.map(c=>[c[0],c[2]])).toEqual(fatal?[[CRIME.damagedPed,false],[CRIME.damageCar,true],[CRIME.damageCar,false]]:[[CRIME.damagedPed,false],[CRIME.damageCar,false]]);
});
test.each([false,true])('an accepted on-foot cop hit uses the same native event order and sniper impact selection (sniper=%s)',sniper=>{
 const crowd={damageCollider:()=>({id:8,officer:true}),targets:()=>[],frighten:()=>{}},weapons=new WeaponSystem({} as any,()=>crowd,()=>undefined),crime=vi.fn();weapons.onCrime=crime;
 (weapons as any).damage(12,25,{x:0,y:0,z:1},false,'bullet',{weapon:sniper?34:22,sniper});
 expect(crime.mock.calls.map(([type,id,queued])=>[type,id,!!queued])).toEqual([[CRIME.damagedPed,'ped:8',false],[CRIME.damageCopCar,'ped:8',true],[sniper?CRIME.damageCopCar:CRIME.damageCar,'ped:8',false]]);
});
test('police-care classification follows a script-assigned ped type before the model type',()=>{
 const crowd={people:[{id:1,pedType:'CIVMALE',scriptPedType:7},{id:2,pedType:'GANG1',scriptPedType:6}]};
 expect(WorldPedestrians.prototype.policeDontCare.call(crowd as any,'ped:1')).toBe(true);expect(WorldPedestrians.prototype.policeDontCare.call(crowd as any,'ped:2')).toBe(false);
});
