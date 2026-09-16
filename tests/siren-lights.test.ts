import {expect,test} from 'vitest';
import {Scene} from 'three';
import {SirenLights,sirenPhase} from '../src/render/SirenLights';
import type {WorldCar} from '../src/simulation/WorldCar';

test('siren phase alternates sides every half period',()=>{
  expect(sirenPhase(0)).toBe('left');
  expect(sirenPhase(279)).toBe('left');
  expect(sirenPhase(280)).toBe('right');
  expect(sirenPhase(559)).toBe('right');
  expect(sirenPhase(560)).toBe('left');
});

const fakeCar=(over:Partial<{siren:boolean;wrecked:boolean;modelId:number;handle:number}>={})=>({
 siren:over.siren??true,wrecked:over.wrecked??false,modelId:over.modelId??596,
 car:{body:{handle:over.handle??7,translation:()=>({x:10,y:2,z:5}),rotation:()=>({x:0,y:0,z:0,w:1})},assets:{collision:{bounds:{max:[2,2,2.5],min:[-2,0,-2.5]}}}},
 assets:{collision:{bounds:{max:[2,2,2.5],min:[-2,0,-2.5]}}},
}) as unknown as WorldCar;

test('siren lights track sounding siren cars and release the rest',()=>{
  const scene=new Scene(),lights=new SirenLights(scene);
  try{
    lights.update([fakeCar()],0);
    expect(lights.snapshot().cars).toBe(1);
    // Identity rotation: left sprite sits at x − 0.55, roof + 0.15.
    const at=SirenLights.anchor(fakeCar(),-1);
    expect(at.x).toBeCloseTo(9.45,10);expect(at.y).toBeCloseTo(4.65,10);expect(at.z).toBe(5);
    // Civilian models, wrecked cars and silent sirens stay dark.
    lights.update([fakeCar({modelId:492}),fakeCar({wrecked:true,handle:8}),fakeCar({siren:false,handle:9})],300);
    expect(lights.snapshot().cars).toBe(0);
    expect(scene.children).toHaveLength(0);
  }finally{lights.dispose();}
});
