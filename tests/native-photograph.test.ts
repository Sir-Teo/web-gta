import {expect,test} from 'vitest';
import {PerspectiveCamera} from 'three';
import {inPhotograph} from '../src/weapons/nativePhotograph';

test('a photo catches what is within 125 units and inside the middle 80% of the frame (TakePhotograph)',()=>{
 const camera=new PerspectiveCamera(70,16/9,.1,1000);camera.position.set(0,0,0);camera.lookAt(0,0,-1);
 expect(inPhotograph(camera,{x:0,y:0,z:-20})).toBe(true);
 // Too far, behind, and near the frame's edge.
 expect(inPhotograph(camera,{x:0,y:0,z:-130})).toBe(false);
 expect(inPhotograph(camera,{x:0,y:0,z:20})).toBe(false);
 const edge=Math.tan(35*Math.PI/180)*.85*20;
 expect(inPhotograph(camera,{x:0,y:edge,z:-20})).toBe(false);
 expect(inPhotograph(camera,{x:0,y:edge*.5,z:-20})).toBe(true);
});
