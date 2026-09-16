import {expect,test} from 'vitest';
import {Group,Object3D,Scene,Vector3} from 'three';
import {Skidmarks,skidEmitting} from '../src/render/Skidmarks';
import type {WorldCar} from '../src/simulation/WorldCar';

test('skid emission needs spin, DEFAULT surfaces, speed and contact',()=>{
  expect(skidEmitting(['normal','spinning','normal','normal'],'DEFAULT',10,4)).toBe(true);
  expect(skidEmitting(['normal','skidding','normal','normal'],'DEFAULT',10,4)).toBe(true);
  expect(skidEmitting(['normal','normal','normal','normal'],'DEFAULT',10,4)).toBe(false);
  expect(skidEmitting(['spinning','spinning','spinning','spinning'],'SANDY',10,4)).toBe(false);
  expect(skidEmitting(['spinning','spinning','spinning','spinning'],'MUDDY',10,4)).toBe(false);
  expect(skidEmitting(['spinning','spinning','spinning','spinning'],undefined,10,4)).toBe(false);
  expect(skidEmitting(['spinning','spinning','spinning','spinning'],'DEFAULT',2,4)).toBe(false);
  expect(skidEmitting(['spinning','spinning','spinning','spinning'],'DEFAULT',10,0)).toBe(false);
});

const rig=(states:WorldCar['audio']['states'],shift=0)=>{
  const root=new Group();root.position.x=shift;
  for(const name of ['wheel_lf_dummy','wheel_lb_dummy','wheel_rf_dummy','wheel_rb_dummy'] as const){
    const dummy=new Object3D();dummy.name=name;dummy.position.set(name.includes('_r')?1:-1,1,name.includes('_f')?2:-2);root.add(dummy);
  }
  root.updateMatrixWorld(true);
  return {
    wrecked:false,modelId:492,
    car:{body:{handle:11,translation:()=>({x:shift,y:1,z:0}),rotation:()=>({x:0,y:0,z:0,w:1}),linvel:()=>({x:10,y:0,z:0})},root,assets:{}},
    audio:{states,contactSurface:1,contactWheels:4},
    assets:{},
  } as unknown as WorldCar;
};

test('skid trails follow spinning wheels and fade out',()=>{
  const scene=new Scene(),skids=new Skidmarks(scene);
  const surfaces={skidMark:(material:number)=>material===1?'DEFAULT':undefined};
  const ground=()=>0;
  try{
    // First lay anchors the wheels; moving 0.5 m draws rear segments.
    skids.lay(rig(['normal','spinning','normal','spinning']),0,surfaces,ground);
    expect(skids.snapshot().marks).toBe(0);
    skids.lay(rig(['normal','spinning','normal','spinning'],.5),16,surfaces,ground);
    expect(skids.snapshot().marks).toBe(2);
    skids.frame(16);
    expect(skids.snapshot().marks).toBe(2);
    expect(skids.mesh.visible).toBe(true);
    const drawn=(skids.mesh.geometry.getAttribute('position') as unknown as {array:Float32Array}).array;
    expect([...drawn.slice(0,3)].every(Number.isFinite)).toBe(true);
    // Marks fade out after their lifetime.
    skids.frame(16+40000);
    expect(skids.snapshot().marks).toBe(0);
    expect(skids.mesh.visible).toBe(false);
    // Calm wheels clear their anchors without drawing.
    skids.lay(rig(['normal','normal','normal','normal']),50000,surfaces,ground);
    expect(skids.snapshot().marks).toBe(0);
  }finally{skids.dispose();}
});
