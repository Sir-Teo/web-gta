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

// CBoat::ProcessControl (0x6F0F50) fire section.
function hull(health:number,over:Partial<{wrecked:boolean;burnTimer:number;at:{x:number;z:number};player:{x:number;z:number}}>={}){
 const boat:any={health,wrecked:false,burnTimer:0,blowUps:0,body:{translation:()=>({x:over.at?.x??0,y:0,z:over.at?.z??0})},sim:{player:{position:{x:over.player?.x??0,y:0,z:over.player?.z??0}}},blowUp(){boat.blowUps++;},...over};
 return boat;
}
const fire=(boat:any,dt:number)=>(WorldBoat.prototype as any).processFire.call(boat,dt);
test('the boat fire timer runs below 250 health, holds between 250 and 460, and clears only above 460 or wrecked',()=>{
 const burning=hull(200,{burnTimer:4.9});fire(burning,.2);expect(burning.burnTimer).toBeCloseTo(5.1,9);expect(burning.blowUps).toBe(1);
 const held=hull(300,{burnTimer:3});fire(held,1);expect(held.burnTimer).toBe(3);expect(held.blowUps).toBe(0);
 const sound=hull(500,{burnTimer:3});fire(sound,1);expect(sound.burnTimer).toBe(0);
 const wrecked=hull(100,{burnTimer:3,wrecked:true});fire(wrecked,1);expect(wrecked.burnTimer).toBe(0);expect(wrecked.blowUps).toBe(0);
});
test('a burning boat farther than 200 units from the camera along either ground axis does not burn down',()=>{
 const far=hull(200,{burnTimer:4.9,at:{x:250,z:0}});fire(far,1);expect(far.burnTimer).toBe(4.9);expect(far.blowUps).toBe(0);
 const farZ=hull(200,{burnTimer:4.9,at:{x:0,z:-210}});fire(farZ,1);expect(farZ.burnTimer).toBe(4.9);
 const near=hull(200,{burnTimer:4.9,at:{x:190,z:190}});fire(near,.2);expect(near.blowUps).toBe(1);
});
