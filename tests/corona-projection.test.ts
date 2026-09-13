import {expect,test} from 'vitest';
import {PerspectiveCamera,Vector3} from 'three';
import {projectCorona} from '../src/render/coronaProjection';

test('corona projection agrees with the browser camera under translation, rotation, aspect and view offsets',()=>{
  for(const [width,height] of [[640,480],[1920,1080],[480,640]]){
    const camera=new PerspectiveCamera(55,width/height,.08,650);
    camera.position.set(10,20,30);camera.lookAt(-5,8,-30);camera.updateMatrixWorld(true);
    for(const offset of [false,true]){
      if(offset){camera.setViewOffset(width*2,height*2,width/4,height/3,width,height);camera.updateProjectionMatrix();}
      const point=new Vector3(2,-1,-100).applyMatrix4(camera.matrixWorld);
      const projected=projectCorona(camera,point,width,height,70)!,ndc=point.clone().project(camera);
      expect(projected.x).toBeCloseTo((ndc.x+1)*width/2,9);expect(projected.y).toBeCloseTo((1-ndc.y)*height/2,9);
      expect(projected.depth).toBeCloseTo(100,10);expect(projected.widthScale).toBeCloseTo(width/100,10);
    }
  }
});

test('native size FOV changes size without moving the center and clipping uses view depth',()=>{
  const camera=new PerspectiveCamera(60,1,.1,100);camera.updateMatrixWorld(true);
  const point=new Vector3(20,0,-50),normal=projectCorona(camera,point,600,600,70)!,zoomed=projectCorona(camera,point,600,600,35)!;
  expect(normal.x).toBe(zoomed.x);expect(zoomed.widthScale).toBe(normal.widthScale*2);
  expect(projectCorona(camera,new Vector3(0,0,1),600,600,70)).toBeUndefined();
  expect(projectCorona(camera,new Vector3(0,0,-1.1),600,600,70)).toBeUndefined();
  expect(projectCorona(camera,new Vector3(0,0,-100),600,600,70)).toBeUndefined();
  expect(projectCorona(camera,new Vector3(200,0,-99),600,600,70)).toBeDefined(); // No horizontal clipping in CalcScreenCoors.
});
