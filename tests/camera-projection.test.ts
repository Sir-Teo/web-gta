import {expect,test} from 'vitest';
import {PerspectiveCamera,Vector3} from 'three';
import {applyWindowedCameraProjection,windowedCameraProjection} from '../src/render/cameraProjection';

test('windowed source FOV reaches the larger-axis frustum edge across viewport shapes',()=>{
  for(const [width,height] of [[640,480],[1920,1080],[480,640],[500,500]]){
    for(const fov of [35,70,100]){
      const camera=new PerspectiveCamera(55,1,.08,650);
      applyWindowedCameraProjection(camera,width,height,fov);camera.updateMatrixWorld(true);
      const depth=10,majorExtent=depth*Math.tan(fov*Math.PI/360);
      const right=new Vector3(majorExtent*Math.min(1,width/height),0,-depth).project(camera);
      const top=new Vector3(0,majorExtent*Math.min(1,height/width),-depth).project(camera);
      expect(right.x).toBeCloseTo(1,12);expect(top.y).toBeCloseTo(1,12);
      expect(camera.near).toBe(.08);expect(camera.far).toBe(650);
      // Equal world-space lengths project to equal pixel lengths on both axes.
      const unit=new Vector3(1,1,-depth).project(camera);
      expect(unit.x*width).toBeCloseTo(unit.y*height,10);
    }
  }
});

test('landscape FOV is horizontal and portrait FOV is vertical',()=>{
  expect(windowedCameraProjection(4,3,70).verticalFov).toBeCloseTo(55.412927,5);
  expect(windowedCameraProjection(16,9,70).verticalFov).toBeCloseTo(42.995661,5);
  expect(windowedCameraProjection(3,4,70).verticalFov).toBeCloseTo(70,12);
});

test('invalid projection input cannot corrupt an existing camera',()=>{
  const camera=new PerspectiveCamera(55,2,.1,100),before=camera.projectionMatrix.clone();
  for(const [width,height,fov] of [[0,100,70],[100,-1,70],[NaN,100,70],[100,Infinity,70],[100,100,0],[100,100,180],[100,100,NaN]]){
    expect(()=>applyWindowedCameraProjection(camera,width,height,fov)).toThrow(/projection/);
    expect(camera.fov).toBe(55);expect(camera.aspect).toBe(2);expect(camera.projectionMatrix.equals(before)).toBe(true);
  }
});
