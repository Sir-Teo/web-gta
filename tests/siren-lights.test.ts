import {expect,test} from 'vitest';
import {Quaternion,Vector3} from 'three';
import {SirenLights,sirenBar,sirenPhase} from '../src/render/SirenLights';
import type {WorldCar} from '../src/simulation/WorldCar';

test('siren phase alternates sides every half period',()=>{
  expect(sirenPhase(0)).toBe('left');
  expect(sirenPhase(279)).toBe('left');
  expect(sirenPhase(280)).toBe('right');
  expect(sirenPhase(559)).toBe('right');
  expect(sirenPhase(560)).toBe('left');
});

/** A chassis whose top is a short bar 1.6 units wide at z 1.35, over a body at z 0.8, under a frame 0.35 down. */
const barModel={
 frames:[{name:'copcarla',parent:-1,matrix:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]},{name:'chassis',parent:0,matrix:[1,0,0,0,0,1,0,0,0,0,1,0,0,1.64,-.35,1]}],
 geometries:[{positions:[-1,-3,.8, 1,-3,.8, -1,2,.8, 1,2,.8, -.8,-2.1,1.35, .8,-2.1,1.35, -.8,-1.9,1.35, .8,-1.9,1.3]}],
 atomics:[{frame:1,geometry:0}],
};

test('the light bar is read off the top of the chassis, a flat roof lit at its front',()=>{
  const bar=sirenBar(barModel);
  expect(bar.left.x).toBeCloseTo(-.6,5);expect(bar.right.x).toBeCloseTo(.6,5);
  expect(bar.left.y).toBeCloseTo(-2+1.64,5);expect(bar.left.z).toBeCloseTo(1.35-.35-.04,5);
  // A flat top three units deep: the lamps go at its front edge.
  const roof=sirenBar({...barModel,geometries:[{positions:[-1,-2,1, 1,-2,1, -1,1,1, 1,1,1]}]});
  expect(roof.left.y).toBeCloseTo(1-.25+1.64,5);
  // No chassis: the collision box's top.
  expect(sirenBar(undefined,{max:[1,2,1.5],min:[-1,-2,0]}).left.z).toBeCloseTo(1.45,5);
});

const fakeCar=(over:Partial<{siren:boolean;wrecked:boolean;modelId:number;handle:number}>={})=>{
 const translation={x:10,y:2,z:5},rotation={x:0,y:0,z:0,w:1};
 return {
  siren:over.siren??true,wrecked:over.wrecked??false,disposed:false,modelId:over.modelId??596,
  car:{body:{handle:over.handle??7,translation:()=>translation,rotation:()=>rotation}},
  assets:{model:barModel,collision:{bounds:{max:[2,2,2.5],min:[-2,0,-2.5]}}},
  // WorldCar.worldPoint: native (x, y, z) is the body's (x, z, -y).
  worldPoint:(l:{x:number;y:number;z:number})=>new Vector3(l.x,l.z,-l.y).applyQuaternion(new Quaternion(rotation.x,rotation.y,rotation.z,rotation.w)).add(new Vector3(translation.x,translation.y,translation.z)),
 } as unknown as WorldCar;
};

test('a sounding siren flashes its lamps in turn through coronas and a ground pool; the rest stay dark',()=>{
  const lights=new SirenLights();
  try{
    const first=lights.update([fakeCar()],0);
    expect(lights.snapshot().cars).toBe(1);
    expect(first.coronas).toHaveLength(2);
    const [left,right]=first.coronas;
    expect(left.color).toEqual([255,0,0]);expect(right.color).toEqual([0,0,255]);
    expect(left.intensity).toBe(255);expect(right.intensity).toBeLessThan(left.intensity);
    // Native frame: the left lamp sits left of the car and above it.
    expect(left.position[0]).toBeCloseTo(9.4,5);expect(left.position[2]).toBeCloseTo(2+.96,5);
    expect(first.pools).toHaveLength(1);expect(first.pools[0].color[0]).toBeGreaterThan(0);
    const later=lights.update([fakeCar()],300);
    expect(later.coronas[1].intensity).toBe(255);expect(later.pools[0].color[2]).toBeGreaterThan(0);
    // Civilian models, wrecked cars and silent sirens stay dark.
    const none=lights.update([fakeCar({modelId:492}),fakeCar({wrecked:true,handle:8}),fakeCar({siren:false,handle:9})],300);
    expect(none.coronas).toHaveLength(0);expect(lights.snapshot().cars).toBe(0);
  }finally{lights.dispose();}
});
