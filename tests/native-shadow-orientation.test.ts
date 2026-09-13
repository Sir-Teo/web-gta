import {expect,test} from 'vitest';
import {OrthographicCamera,Vector3} from 'three';
import {nativeShadowOrientation} from '../src/render/nativeShadowOrientation';
import {configureNativeShadowCamera} from '../src/render/nativeShadowCamera';
import {sampleSun} from '../src/world/sun';
test('native rotations give horizontal capture direction and downward up for cardinal sun azimuths',()=>{
 for(const [sun,forward] of [[{x:0,y:1,z:1},[0,0,-1]],[{x:1,y:1,z:0},[-1,0,0]],[{x:0,y:1,z:-1},[0,0,1]],[{x:-1,y:1,z:0},[1,0,0]]] as const){
  const result=nativeShadowOrientation(sun);
  result.forward.toArray().forEach((v,i)=>expect(v).toBeCloseTo(forward[i],12));expect(result.up.distanceTo(new Vector3(0,-1,0))).toBeLessThan(1e-12);
  const camera=new OrthographicCamera();camera.quaternion.copy(result.rotation);configureNativeShadowCamera(camera,{x:0,y:0,z:0},1);
  expect(camera.getWorldDirection(new Vector3()).distanceTo(result.forward)).toBeLessThan(1e-12);
  expect(new Vector3(0,1,0).project(camera).y).toBeCloseTo(-1,12);
 }
});
test('elevation is ignored and native camera left projects to negative screen X',()=>{
 const a=nativeShadowOrientation({x:.7,y:1.2,z:.7}),b=nativeShadowOrientation({x:.7,y:-.8,z:.7});expect(a.rotation.angleTo(b.rotation)).toBeCloseTo(0,12);
 const camera=new OrthographicCamera();camera.quaternion.copy(a.rotation);configureNativeShadowCamera(camera,{x:2495,y:13,z:1687},1);
 const left=new Vector3(Math.cos(a.azimuth),0,Math.sin(a.azimuth));
 const screen=left.add(new Vector3(2495,13,1687)).project(camera);expect(screen.x).toBeCloseTo(-1,9);expect(screen.y).toBeCloseTo(0,9);
 for(const minutes of [0,360,720,1080])expect(Math.abs(nativeShadowOrientation(sampleSun(minutes).direction).forward.y)).toBe(0);
});
test('unusable sun azimuths fail explicitly',()=>{
 for(const sun of [{x:0,y:1,z:0},{x:NaN,y:0,z:1},{x:1,y:Infinity,z:1}])expect(()=>nativeShadowOrientation(sun)).toThrow('direction');
});
