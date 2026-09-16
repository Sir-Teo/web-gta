import {expect,test} from 'vitest';
import * as THREE from 'three';
import {MAX_MOVING_FOG,MOVING_FOG_FRAME_MS,NativeMovingFog,type MovingFogInput} from '../src/render/NativeMovingFog';
const lcg=(seed=1)=>()=>(seed=(seed*1103515245+12345)%2147483648)/2147483648;
const fogInput=(over:Partial<MovingFogInput>={}):MovingFogInput=>({foggynessSF:1,outside:true,noRain:false,underwaterness:0,skyBottom:[100,130,200],...over});
const TIME_STEP=MOVING_FOG_FRAME_MS/20;

test('MovingFog_Update fills every slot around the camera before any sprite moves or draws',()=>{
 const fog=new NativeMovingFog(new THREE.Scene(),lcg()),camera={x:-2000,y:600,z:30};
 fog.step(fogInput(),camera,TIME_STEP);
 expect(fog.snapshot()).toMatchObject({active:MAX_MOVING_FOG,maxAlpha:0});
 for(let i=0;i<MAX_MOVING_FOG;i++){
  expect(Math.abs(fog.position[i*3]-camera.x)).toBeLessThanOrEqual(58);expect(Math.abs(fog.position[i*3+1]-camera.y)).toBeLessThanOrEqual(58);expect(Math.abs(fog.position[i*3+2]-camera.z)).toBeLessThanOrEqual(5.001);
  expect(fog.size[i]).toBeGreaterThanOrEqual(4);expect(fog.size[i]).toBeLessThanOrEqual(10);expect(fog.intensity[i]).toBe(1);
  expect(fog.maxIntensity[i]).toBeGreaterThanOrEqual(8);expect(fog.maxIntensity[i]).toBeLessThanOrEqual(20);expect(fog.speed[i]).toBeGreaterThanOrEqual(.5);expect(fog.speed[i]).toBeLessThanOrEqual(1.2);
 }
 const before=fog.position.slice(),speed=fog.speed[7],offset=(i:number)=>Math.hypot(before[i*3]-camera.x,before[i*3+1]-camera.y,before[i*3+2]-camera.z);
 fog.step(fogInput(),camera,TIME_STEP);
 // Drawn with the pre-update intensity of 1, then drifted by the (0.06, 0.06) wind; sprites created beyond 60 units (the square's corners) fade straight out.
 const inRange=[...Array(MAX_MOVING_FOG).keys()].filter(i=>offset(i)<=60).length;
 expect(inRange).toBeLessThan(MAX_MOVING_FOG);expect(fog.snapshot()).toMatchObject({drawn:0,maxAlpha:1,active:inRange});
 expect(fog.position[7*3]).toBeCloseTo(before[7*3]+.06*speed,3);expect(fog.position[7*3+1]).toBeCloseTo(before[7*3+1]+.06*speed,3);expect(fog.position[7*3+2]).toBe(before[7*3+2]);
 const near=[...Array(MAX_MOVING_FOG).keys()].find(i=>offset(i)<50)!;
 expect(fog.intensity[near]).toBeCloseTo(1+TIME_STEP,5);
 for(let i=0;i<20;i++)fog.step(fogInput(),camera,TIME_STEP);
 expect(fog.intensity[near]).toBe(fog.maxIntensity[near]);
 const expected=Math.max(...[...fog.intensity].filter((_,i)=>fog.slots[i]).map(Math.trunc));
 fog.step(fogInput(),camera,TIME_STEP);expect(fog.snapshot().maxAlpha).toBe(expected);
});

test('sprites beyond 60 units fade out, free their slot and respawn around the camera',()=>{
 // Random 0.5 creates every sprite at the camera: size 7, maximum intensity 14, speed 0.85.
 const fog=new NativeMovingFog(new THREE.Scene(),()=>.5);
 fog.step(fogInput(),{x:0,y:0,z:0},TIME_STEP);expect([fog.size[0],fog.maxIntensity[0],fog.speed[0]]).toEqual([7,14,Math.fround(.85)]);
 fog.step(fogInput(),{x:0,y:0,z:0},TIME_STEP);
 const far={x:500,y:0,z:0};
 fog.step(fogInput(),far,TIME_STEP);
 expect(fog.intensity[0]).toBeCloseTo(1,5);
 fog.step(fogInput(),far,TIME_STEP);
 // Intensity 1 - 1.67 <= 0 deletes the slot; the next update recreates it next to the new camera.
 expect(fog.snapshot().active).toBe(0);
 fog.step(fogInput(),far,TIME_STEP);
 expect(fog.snapshot().active).toBe(MAX_MOVING_FOG);expect(Math.abs(fog.position[0]-far.x)).toBeLessThanOrEqual(58);
});

test('CurrentFogIntensity follows no-rain zones and water, and interiors or clear weather skip the pass',()=>{
 const fog=new NativeMovingFog(new THREE.Scene(),lcg(3)),camera={x:0,y:0,z:0};
 fog.step(fogInput({noRain:true}),camera,TIME_STEP);
 expect(fog.currentFogIntensity).toBeCloseTo(1-TIME_STEP/300,6);
 for(let i=0;i<400;i++)fog.step(fogInput({noRain:true}),camera,TIME_STEP);
 expect(fog.currentFogIntensity).toBe(0);
 const frozen=fog.position.slice();
 fog.step(fogInput(),camera,TIME_STEP);expect(fog.currentFogIntensity).toBeCloseTo(TIME_STEP/300,6);
 fog.step(fogInput({underwaterness:.535}),camera,TIME_STEP);expect(fog.currentFogIntensity).toBe(0);
 fog.step(fogInput({outside:false}),camera,TIME_STEP);fog.step(fogInput({foggynessSF:0}),camera,TIME_STEP);
 expect(fog.currentFogIntensity).toBe(0);expect(fog.snapshot().maxAlpha).toBe(0);
 // Only the one frame back above zero ran MovingFog_Update.
 let moved=0;for(let i=0;i<MAX_MOVING_FOG;i++)if(fog.position[i*3]!==frozen[i*3])moved++;
 expect(moved).toBeGreaterThan(0);
});

test('frames advance at 30 Hz and sprites face the camera with the native corner order and sky tint',()=>{
 const scene=new THREE.Scene(),fog=new NativeMovingFog(scene,()=>.5),camera=new THREE.PerspectiveCamera(70,1,.1,1000),texture=new THREE.DataTexture(new Uint8Array(4),1,1);
 camera.position.set(10,20,-30);camera.updateMatrixWorld();
 const mesh=scene.getObjectByName('Native moving fog') as THREE.Mesh;
 fog.frame(0,camera,fogInput(),texture,false);
 expect(fog.snapshot().active).toBe(MAX_MOVING_FOG);expect(mesh.visible).toBe(false);
 fog.frame(10,camera,fogInput(),texture,false);expect(fog.intensity[0]).toBe(1);
 fog.frame(110,camera,fogInput(),texture,false);
 // 100 more milliseconds are three native frames; the last draw used intensity 1 + 2 time steps.
 expect(fog.intensity[0]).toBeCloseTo(1+3*TIME_STEP,5);expect(mesh.visible).toBe(true);
 expect(fog.snapshot()).toMatchObject({drawn:MAX_MOVING_FOG,maxAlpha:Math.trunc(1+2*TIME_STEP),colour:[232,255,255]});
 fog.frame(1000,camera,fogInput(),texture,true);expect(fog.intensity[0]).toBeCloseTo(1+3*TIME_STEP,5);
 const geometry=mesh.geometry,p=geometry.getAttribute('position'),uv=geometry.getAttribute('uv'),c=geometry.getAttribute('fogColor');
 expect(geometry.drawRange.count).toBe(MAX_MOVING_FOG*6);
 // Random 0.5 created the sprite at the camera (native (10, 30, 20)), size 7; the draw saw two wind drifts of 0.06 * 0.85.
 const h=3.5,drift=2*.06*.85,x=10+drift,y=20,z=-30-drift;
 const corner=(i:number,cx:number,cy:number)=>{expect(p.getX(i)).toBeCloseTo(cx,3);expect(p.getY(i)).toBeCloseTo(cy,3);expect(p.getZ(i)).toBeCloseTo(z,3);};
 // TheCamera right is screen-left: corner 0 (UV 0,0) is the top-left of the screen.
 corner(0,x-h,y+h);corner(1,x-h,y-h);corner(2,x+h,y-h);corner(3,x+h,y+h);
 expect([...uv.array.slice(0,8)]).toEqual([0,0,1,0,1,1,0,1]);expect([...(c.array as Uint8Array).slice(0,4)]).toEqual([232,255,255,Math.trunc(1+2*TIME_STEP)]);
 fog.dispose();expect(mesh.parent).toBeNull();
});
