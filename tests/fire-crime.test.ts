import {expect,test} from 'vitest';
import {WeaponSystem} from '../src/weapons/WeaponSystem';
import {CRIME} from '../src/simulation/nativeWanted';

// CFire::Start on an entity reports CRIME_SET_COP_PED_ON_FIRE / CRIME_SET_PED_ON_FIRE for a ped and CRIME_SET_CAR_ON_FIRE
// for a vehicle, with the fire's creator as the offender: the player setting someone alight is a crime.
const system=(lit:boolean)=>{
  const crimes:[number,string|undefined][]=[];
  const car={wrecked:false};
  const self=Object.assign(Object.create(WeaponSystem.prototype),{nowMs:0,toNative:(v:any)=>({x:v.x,y:-v.z,z:v.y}),onCrime:(type:number,victim?:string)=>{crimes.push([type,victim]);},
    fires:{startFireOn:()=>lit?{}:undefined},
    pedestrians:()=>({targets:()=>[{handle:5,id:9,officer:false,position:{x:0,y:0,z:0}},{handle:6,id:10,officer:true,position:{x:0,y:0,z:0}}]}),
    fleet:()=>({cars:[{...car,car:{body:{handle:3}}}],bikes:[],boats:[]})});
  return {self,crimes};
};
test('the player setting a ped or a cop alight reports the fire crime',()=>{
  const {self,crimes}=system(true);
  (WeaponSystem.prototype as any).ignitePed.call(self,5,{x:0,y:0,z:0},2);
  (WeaponSystem.prototype as any).ignitePed.call(self,6,{x:0,y:0,z:0},2);
  expect(crimes).toEqual([[CRIME.setPedOnFire,'ped:9'],[CRIME.setCopPedOnFire,'ped:10']]);
});
test('no crime when no fire starts (fire-proof, or already burning)',()=>{
  const {self,crimes}=system(false);
  (WeaponSystem.prototype as any).ignitePed.call(self,5,{x:0,y:0,z:0},2);
  expect(crimes).toEqual([]);
});
// CFireManager::StartFire refuses a ped with physicalFlags.bFireProof: no fire, no crime.
test('a fire-proof ped does not catch fire from the player\'s flames',()=>{
  const {self,crimes}=system(true);let asked:any;
  self.fires={startFireOn:(_t:any,_p:any,_l:any,_g:any,_c:any,_cr:any,o:any)=>{asked=o;return o?.fireproof?undefined:{};}};
  self.pedestrians=()=>({targets:()=>[{handle:5,id:9,officer:false,fireProof:true,position:{x:0,y:0,z:0}}]});
  (WeaponSystem.prototype as any).setPedsOnFire.call(Object.assign(self,{sim:{playerBody:{isEnabled:()=>false},playerCollider:{isEnabled:()=>false},player:{health:100}}}),{x:0,y:0,z:0},6);
  expect(asked).toEqual({fireproof:true});
  expect(crimes).toEqual([]);
});
