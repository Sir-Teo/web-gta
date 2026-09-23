import {expect,test} from 'vitest';
import {WorldCar} from '../src/simulation/WorldCar';

// A car on its roof: a half turn about the forward axis.
const flipped=(extra:object={})=>({wrecked:false,canBeDamaged:true,occupied:false,health:600,upsideDownCounter:0,upsideDownClock:0,
 car:{body:{isEnabled:()=>true,rotation:()=>({x:0,y:0,z:1,w:0}),linvel:()=>({x:0,y:0,z:0})}},...extra} as any);
const step=(car:any,seconds:number)=>(WorldCar.prototype as any).upsideDownDamage.call(car,seconds);

test('a flipped car loses 4 health a frame unless SET_UPSIDEDOWN_CAR_NOT_DAMAGED set bDoesNotGetDamagedUpsideDown',()=>{
 const plain=flipped();step(plain,1);expect(plain.health).toBe(400);
 const kept=flipped({noUpsideDownDamage:true});step(kept,1);expect(kept.health).toBe(600);
});
