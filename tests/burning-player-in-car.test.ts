import {expect,test} from 'vitest';
import {WeaponSystem} from '../src/weapons/WeaponSystem';
import {NativeFireManager} from '../src/combat/nativeFire';

// CFire::ProcessFire: a burning ped keeps his fire when he gets into a car, and while it burns an automobile other than
// a fire truck is held at 75 health, which sets its engine alight.
const system=(modelId:number)=>{
  const fires=new NativeFireManager();fires.random=()=>.5;
  const car={modelId,health:900,wrecked:false,damage:()=>false,get onFire(){return this.health<250;},playersVehicle:true,car:{body:{handle:3,translation:()=>({x:10,y:1,z:5})}}};
  const self=Object.assign(Object.create(WeaponSystem.prototype),{nowMs:0,fires,molotovs:[],aircraftExplosions:[],fireFrameClock:0,
    toNative:(v:any)=>({x:v.x,y:-v.z,z:v.y}),onCrime(){},damage(){},
    sim:{playerBody:{isEnabled:()=>false},playerCollider:{isEnabled:()=>false},player:{health:100,swimming:false,position:{x:10,y:1,z:5}},damagePlayer(){}},
    pedestrians:()=>({targets:()=>[]}),fleet:()=>({cars:[car],bikes:[],boats:[]})});
  fires.startFireOn({kind:'player',key:'player'},{x:10,y:-5,z:1},7000,2,{nowMs:0,random:()=>.5},'player');
  return {self,car,fires};
};
test('a burning player in a car keeps burning and sets the car alight',()=>{
  const {self,car,fires}=system(411);
  for(let i=0;i<10;i++){self.nowMs+=100;(WeaponSystem.prototype as any).updateFires.call(self,.1);}
  expect(fires.fireOn('player')).toBeTruthy();
  expect(car.health).toBe(75);
});
test('a fire truck is spared',()=>{
  const {self,car}=system(407);
  for(let i=0;i<10;i++){self.nowMs+=100;(WeaponSystem.prototype as any).updateFires.call(self,.1);}
  expect(car.health).toBe(900);
});
