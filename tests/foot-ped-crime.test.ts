import {expect,test,vi} from 'vitest';
import {WeaponSystem} from '../src/weapons/WeaponSystem';
import {WantedSystem,CRIME} from '../src/simulation/WantedSystem';

function fixture(pedType='COP',officer=false){
 const crowd={damageCollider:vi.fn(()=>({id:8,officer,pedType})),targets:()=>[],frighten(){}},weapons=new WeaponSystem({} as any,()=>crowd,()=>undefined),crime=vi.fn();weapons.onCrime=crime;
 const hit=(creator:'ped'|'vehicle'|'remote'='ped',sniper=false,byPlayer=true)=>(weapons as any).damage(12,25,{x:0,y:0,z:1},false,'bullet',{weapon:sniper?34:22,sniper,creator,byPlayer});
 return {weapons,crowd,crime,hit};
}
test.each([false,true])('a script COP with a civilian model retains cop crime selection (sniper=%s)',sniper=>{
 const f=fixture();f.hit('ped',sniper);expect(f.crime.mock.calls).toEqual([[CRIME.damagedPed,'ped:8',false,false],[CRIME.damageCopCar,'ped:8',true,false],[sniper?CRIME.damageCopCar:CRIME.damageCar,'ped:8',false,false]]);
});
test('an explicit civilian type takes precedence over a cop-model officer flag',()=>{
 const f=fixture('CIVMALE',true);f.hit('ped',true);expect(f.crime.mock.calls).toEqual([[CRIME.damagedPed,'ped:8',false,false],[CRIME.damageCar,'ped:8',true,false],[CRIME.damageCar,'ped:8',false,false]]);
});
test.each(['GANG1','GANG2','GANG3','GANG4','GANG5','GANG6','GANG7','GANG8','GANG9','GANG10','DEALER','CRIMINAL'])('on-foot %s damage carries native police-care classification with its identity',pedType=>{
 const f=fixture(pedType);f.hit();expect(f.crime.mock.calls).toEqual([[CRIME.damagedPed,'ped:8',false,true],[CRIME.damageCar,'ped:8',true,true],[CRIME.damageCar,'ped:8',false,true]]);
});
test.each(['CIVMALE','CIVFEMALE','COP','MEDIC','FIREMAN','MISSION1'])('player-driven vehicle fire queues only the %s victim event',pedType=>{
 const f=fixture(pedType);f.hit('vehicle');expect(f.crime.mock.calls).toEqual([[pedType==='COP'?CRIME.damageCopCar:CRIME.damageCar,'ped:8',true,false]]);
});
test.each(['COP','GANG1','CIVMALE'])('remote and NPC sources do not report player damage crimes against %s',pedType=>{
 const f=fixture(pedType);f.hit('remote');f.hit('ped',false,false);expect(f.crime).not.toHaveBeenCalled();
});
test('the vehicle creator rule reaches CWanted once, retaining the on-foot ped identity for deduplication',()=>{
 const f=fixture(),law=new WantedSystem();f.weapons.onCrime=(type,victim,queued,dontCare)=>{if(queued)law.registerCrime(type,victim!,dontCare);else law.crime(type,victim,dontCare);};
 f.hit('vehicle');expect(law.native.snapshot().queued).toBe(1);f.hit('vehicle');expect(law.native.snapshot().queued).toBe(1);
});
