import {expect,test} from 'vitest';
import {Quaternion,Vector3} from 'three';
import {SIREN_BAR_LAYOUTS,SirenLights,sirenCoronaColour,sirenLampPhase,sirenLampPosition,sirenPointLightColour} from '../src/render/SirenLights';
import type {WorldCar} from '../src/simulation/WorldCar';

test('each lamp steps through red, dark, its second colour and dark every 256 ms, 64 ms behind the next',()=>{
  expect([0,256,512,768].map(t=>sirenLampPhase(t,0))).toEqual(['red',undefined,'second',undefined]);
  // Lamp 1 is 64 ms ahead in the cycle: at 192 ms it has already left red.
  expect(sirenLampPhase(191,1)).toBe('red');expect(sirenLampPhase(192,1)).toBeUndefined();
  expect(sirenLampPhase(320,3)).toBe('second');
});

test('the bars are the executable\'s: four lamps across, red with blue, yellow or white',()=>{
  const police=SIREN_BAR_LAYOUTS.get(596)!;
  const end=sirenLampPosition(police,0);expect(end.x).toBe(Math.fround(-.7));expect(end.y).toBeCloseTo(-.4,6);expect(end.z).toBeCloseTo(1,6);
  expect(sirenLampPosition(police,3).x).toBeCloseTo(.7,6);
  expect(sirenLampPosition(police,1).x).toBeCloseTo(-.7/3,6);
  expect(SIREN_BAR_LAYOUTS.get(407)!.second).toEqual([255,255,0]);
  expect(SIREN_BAR_LAYOUTS.get(416)!.second).toEqual([255,255,255]);
  expect(SIREN_BAR_LAYOUTS.get(601)).toBeUndefined();
  expect(sirenCoronaColour([255,0,0],10)).toEqual([255,0,0]);
  expect(sirenCoronaColour([0,0,255],5)).toEqual([0,0,127]);
});

test('the point light is a sixth of the colour of its 512 ms half, eased over 100 ms at each end',()=>{
  const police=SIREN_BAR_LAYOUTS.get(596)!;
  expect(sirenPointLightColour(police,200)).toEqual([42,0,0]);
  expect(sirenPointLightColour(police,50)).toEqual([21,0,0]);
  expect(sirenPointLightColour(police,512+200)).toEqual([0,0,42]);
  expect(sirenPointLightColour(police,511)).toEqual([0,0,0]);
  expect(sirenPointLightColour(police,462)).toEqual([21,0,0]);
});

const fakeCar=(over:Partial<{siren:boolean;wrecked:boolean;modelId:number;handle:number}>={})=>{
 const translation={x:10,y:2,z:5},rotation={x:0,y:0,z:0,w:1};
 return {
  siren:over.siren??true,wrecked:over.wrecked??false,disposed:false,modelId:over.modelId??596,
  car:{body:{handle:over.handle??7,translation:()=>translation,rotation:()=>rotation}},
  // WorldCar.worldPoint: native (x, y, z) is the body's (x, z, -y).
  worldPoint:(l:{x:number;y:number;z:number})=>new Vector3(l.x,l.z,-l.y).applyQuaternion(new Quaternion(rotation.x,rotation.y,rotation.z,rotation.w)).add(new Vector3(translation.x,translation.y,translation.z)),
 } as unknown as WorldCar;
};
const frame=(timeMs:number,cameraForward:[number,number,number]=[0,1,0])=>({timeMs,spriteBrightness:10,lodMultiplier:1,cameraForward});

test('a sounding siren registers the lamps lit this phase and one point light; the rest stay dark',()=>{
  const lights=new SirenLights();
  try{
    // At 0 ms lamps 0 to 3 sit 0, 64, 128 and 192 ms into the cycle: all red.
    const first=lights.update([fakeCar()],frame(0));
    expect(lights.snapshot().cars).toBe(1);
    expect(first.coronas).toHaveLength(4);
    expect(first.coronas.every(c=>c.color[0]===255&&c.size===.4&&c.range===150&&c.fadeSpeed===15)).toBe(true);
    // Native frame: lamp 0 at the bar's left end, 0.4 behind the centre, a unit up.
    expect(first.coronas[0].position[0]).toBeCloseTo(9.3,5);expect(first.coronas[0].position[1]).toBeCloseTo(-5.4,5);expect(first.coronas[0].position[2]).toBeCloseTo(3,5);
    expect(first.pointLights).toEqual([{position:[10,-5,4],radius:10,color:[0,0,0]}]);
    // At 704 ms lamp 0 is 192 ms into its blue phase; lamps 1 to 3, 64 ms on each, have passed into the dark.
    const later=lights.update([fakeCar()],frame(704));
    expect(later.coronas.map(c=>c.color)).toEqual([[0,0,255]]);
    // Other siren models, wrecked cars and silent sirens stay dark.
    const none=lights.update([fakeCar({modelId:601}),fakeCar({wrecked:true,handle:8}),fakeCar({siren:false,handle:9})],frame(0));
    expect(none.coronas).toHaveLength(0);expect(none.pointLights).toHaveLength(0);
  }finally{lights.dispose();}
});

test('the FBI Rancher flashes one blue dashboard lamp, seen only from in front',()=>{
  const lights=new SirenLights(),car=fakeCar({modelId:490});
  try{
    expect(lights.update([car],frame(0,[0,-1,0])).coronas).toHaveLength(0);
    const lit=lights.update([car],frame(256,[0,-1,0])).coronas;
    expect(lit).toHaveLength(1);expect(lit[0].color).toEqual([0,0,255]);
    // Native frame: 1.2 ahead (native y +), half a unit up.
    expect(lit[0].position[1]).toBeCloseTo(-5+1.2,5);expect(lit[0].position[2]).toBeCloseTo(2.5,5);
    expect(lights.update([car],frame(256,[0,1,0])).coronas).toHaveLength(0);
  }finally{lights.dispose();}
});

test('the police bike flashes its left lamp red and its right blue by halves of 512 ms, with its engine running',()=>{
  const lights=new SirenLights(),bike=Object.assign(fakeCar({modelId:523}),{engineRunning:true});
  try{
    const red=lights.update([bike],frame(100));
    expect(red.coronas).toHaveLength(1);expect(red.coronas[0]).toMatchObject({color:[255,0,0],range:40,fadeSpeed:30,size:.4});
    // Native frame: 0.28 left of the bike, 0.6 ahead, 0.3 up.
    expect(red.coronas[0].position[0]).toBeCloseTo(10-.28,5);expect(red.coronas[0].position[1]).toBeCloseTo(-5+.6,5);
    expect(red.pointLights[0].color).toEqual([100/1024,0,155/1024]);
    const blue=lights.update([bike],frame(300));
    expect(blue.coronas[0].color).toEqual([0,0,255]);expect(blue.coronas[0].position[0]).toBeCloseTo(10.28,5);
    expect(lights.update([Object.assign(fakeCar({modelId:523}),{engineRunning:false})],frame(100)).coronas).toHaveLength(0);
  }finally{lights.dispose();}
});
