import {expect,test} from 'vitest';
import {Group,OrthographicCamera,Vector3} from 'three';
import {configureNativeShadowCamera} from '../src/render/nativeShadowCamera';
test('native shadow framing uses a radius-sized parallel view and preserves its supplied orientation',()=>{
 const camera=new OrthographicCamera();camera.rotation.set(.3,.7,-.2);const quaternion=camera.quaternion.clone();
 const center=new Vector3(2495,13,1687);configureNativeShadowCamera(camera,center,2);
 expect([camera.left,camera.right,camera.top,camera.bottom,camera.near,camera.far,camera.zoom]).toEqual([-2,2,2,-2,Math.fround(.002),4,1]);
 expect(camera.quaternion.angleTo(quaternion)).toBeCloseTo(0,6);
 const direction=camera.getWorldDirection(new Vector3());expect(camera.position.clone().addScaledVector(direction,2).distanceTo(center)).toBeLessThan(1e-10);
 const projected=center.clone().project(camera);expect(projected.x).toBeCloseTo(0,10);expect(projected.y).toBeCloseTo(0,10);
 const right=new Vector3(1,0,0).applyQuaternion(quaternion);expect(center.clone().addScaledVector(right,2).project(camera).x).toBeCloseTo(1,10);
 const top=new Vector3(0,1,0).applyQuaternion(quaternion);expect(center.clone().addScaledVector(top,2).project(camera).y).toBeCloseTo(1,10);
});
test('moving the center preserves projection scale and reframing refreshes both camera matrices',()=>{
 const camera=new OrthographicCamera();configureNativeShadowCamera(camera,{x:0,y:1,z:0},1);const projection=camera.projectionMatrix.clone();
 camera.setViewOffset(200,200,0,0,100,100);camera.zoom=3;
 configureNativeShadowCamera(camera,{x:10,y:20,z:30},1);expect(camera.projectionMatrix.equals(projection)).toBe(true);
 expect(new Vector3(10,20,30).project(camera).x).toBeCloseTo(0,8);
 configureNativeShadowCamera(camera,{x:10,y:20,z:30},2);expect(camera.projectionMatrix.elements[0]).toBe(.5);expect(camera.position.z).toBe(32);
});
test('invalid or parented camera inputs fail before changing its framing',()=>{
 const camera=new OrthographicCamera();configureNativeShadowCamera(camera,{x:0,y:0,z:0},1);const position=camera.position.clone(),projection=camera.projectionMatrix.clone();
 for(const radius of [0,-1,NaN,Infinity,1e-50,1e40])expect(()=>configureNativeShadowCamera(camera,{x:0,y:0,z:0},radius)).toThrow('framing');
 expect(()=>configureNativeShadowCamera(camera,{x:NaN,y:0,z:0},1)).toThrow('framing');
 new Group().add(camera);expect(()=>configureNativeShadowCamera(camera,{x:0,y:0,z:0},1)).toThrow('unparented');
 expect(camera.position.equals(position)).toBe(true);expect(camera.projectionMatrix.equals(projection)).toBe(true);
});
