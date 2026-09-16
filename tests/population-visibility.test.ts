import {expect,test} from 'vitest';
import {PerspectiveCamera} from 'three';
import {populationOutsideView} from '../src/render/populationVisibility';
test('spawns wait outside the whole viewport including entity bounds and camera turns',()=>{
 const camera=new PerspectiveCamera(70,16/9,.1,250);camera.position.set(0,2,0);camera.lookAt(0,2,-10);
 expect(populationOutsideView(camera,{x:0,y:2,z:-70},6)).toBe(false);
 expect(populationOutsideView(camera,{x:0,y:2,z:70},6)).toBe(true);
 // A bounding sphere crossing the right edge must also wait.
 expect(populationOutsideView(camera,{x:87,y:2,z:-70},6)).toBe(false);
 camera.lookAt(0,2,70);expect(populationOutsideView(camera,{x:0,y:2,z:70},6)).toBe(false);
});
