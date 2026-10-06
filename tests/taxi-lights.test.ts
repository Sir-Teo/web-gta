import {expect,test} from 'vitest';
import {Vector3} from 'three';
import {taxiLightLevel,taxiLights} from '../src/render/taxiLights';
import type {WorldCar} from '../src/simulation/WorldCar';

const car=(modelId:number,taxiLight=true)=>({modelId,taxiLight,wrecked:false,disposed:false,car:{body:{handle:3}},
 // WorldCar.worldPoint with no rotation: native (x, y, z) is the body's (x, z, -y), here about (10, 2, 5).
 worldPoint:(l:{x:number;y:number;z:number})=>new Vector3(10+l.x,2+l.z,5-l.y)}) as unknown as WorldCar;

test('the sign is red and green at the sprite brightness × 10, over the roof',()=>{
 expect(taxiLightLevel(10)).toBe(100);expect(taxiLightLevel(3.95)).toBe(39);
 const {coronas,pointLights}=taxiLights([car(438)],{spriteBrightness:10,lodMultiplier:1,highQuality:false});
 expect(coronas).toHaveLength(1);
 expect(coronas[0]).toMatchObject({color:[100,100,0],intensity:255,size:.8,range:150,reflection:true,pullTowardsCamera:1.5,fadeSpeed:15});
 expect(coronas[0].position[2]).toBeCloseTo(2.85,5);
 expect(pointLights).toEqual([{position:coronas[0].position,radius:10,color:[.1,.1,.05]}]);
});

test('the Taxi\'s sign shows only at high FX quality; an unlit sign never',()=>{
 expect(taxiLights([car(420)],{spriteBrightness:10,lodMultiplier:1,highQuality:false}).coronas).toHaveLength(0);
 const lit=taxiLights([car(420)],{spriteBrightness:10,lodMultiplier:1,highQuality:true}).coronas;
 expect(lit).toHaveLength(1);expect(lit[0].position[1]).toBeCloseTo(-5-.4,5);expect(lit[0].position[2]).toBeCloseTo(2.95,5);
 expect(taxiLights([car(438,false)],{spriteBrightness:10,lodMultiplier:1,highQuality:true}).coronas).toHaveLength(0);
});
