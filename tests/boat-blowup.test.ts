import {expect,test} from 'vitest';
import {WorldBoat} from '../src/simulation/WorldBoat';
import {nativeAmbientState} from '../src/assets/nativeMaterial';

test('CBoat::BlowUpCar throws the hull up 0.13 a frame and lights it scorched from then on',()=>{
 let velocity={x:1,y:2,z:3};
 const boat:any={wrecked:false,health:100,occupied:false,ambient:nativeAmbientState(),body:{linvel:()=>velocity,setLinvel:(v:any)=>{velocity=v;}},
  scorch:(WorldBoat.prototype as any).scorch};
 (WorldBoat.prototype as any).blowUp.call(boat);
 expect(boat.wrecked).toBe(true);expect(velocity.y).toBeCloseTo(2+6.5,9);
 expect([...boat.ambient.color.value.toArray(),boat.ambient.enabled.value,boat.ambient.directMultiplier.value]).toEqual([.18,.18,.18,true,0]);
 // The time-of-day lighting no longer reaches it.
 WorldBoat.prototype.setLighting.call(boat,[1,1,1],1,0);
 expect(boat.ambient.color.value.toArray()).toEqual([.18,.18,.18]);
});
