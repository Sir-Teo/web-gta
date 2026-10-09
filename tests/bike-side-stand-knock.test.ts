import {expect,test} from 'vitest';
import {WorldBike} from '../src/simulation/WorldBike';

// CBike::VehicleDamage (iOS 0x100450e04): a collision of more than 20 knocks a parked bike off its side stand.
const bike=(intensity:number)=>{
 const b:any=Object.create(WorldBike.prototype);
 Object.defineProperty(b,'quad',{value:false});Object.assign(b,{onSideStand:true,occupied:false,wrecked:false,stepVelocity:{x:0,y:0,z:0},assets:{handling:{values:{mass:500}}},
  body:{isEnabled:()=>true,linvel:()=>({x:3,y:0,z:0})},strongestCollision:()=>({intensity,normal:{x:-1,y:0,z:0}})});
 (WorldBike.prototype as any).collisionKnockOff.call(b);
 return b.onSideStand;
};

test('a hard knock takes a parked bike off its side stand, a light one does not',()=>{
 expect(bike(25)).toBe(false);
 expect(bike(20)).toBe(true);
 expect(bike(5)).toBe(true);
});
