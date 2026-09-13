import {expect,test} from 'vitest';
import {OrthographicCamera,Vector3} from 'three';
import {nativeShadowOrientation} from '../src/render/nativeShadowOrientation';
import {configureNativeShadowCamera} from '../src/render/nativeShadowCamera';
import {viceCityShadowProjection} from '../src/render/relatedShadowProjection';
const camera=()=>{const c=new OrthographicCamera();c.quaternion.copy(nativeShadowOrientation({x:0,y:1,z:1}).rotation);configureNativeShadowCamera(c,{x:0,y:1,z:0},1);return c;};
test('related terrain mapping tilts independently of the horizontal capture camera',()=>{
 const c=camera(),before=c.matrixWorld.clone(),mapping=viceCityShadowProjection(c);
 expect(c.matrixWorld.equals(before)).toBe(true);
 const foot=new Vector3(0,0,0).applyMatrix4(mapping);expect(foot.x).toBeCloseTo(.5,12);expect(foot.y).toBeCloseTo(1,12);expect(foot.z).toBeCloseTo(Math.SQRT2/.8,12);
 const extent=1.8*Math.SQRT2,far=new Vector3(0,0,-extent).applyMatrix4(mapping);expect(far.x).toBeCloseTo(.5,12);expect(far.y).toBeCloseTo(0,12);
 expect(new Vector3(.9,0,0).applyMatrix4(mapping).x).toBeCloseTo(0,12);expect(new Vector3(-.9,0,0).applyMatrix4(mapping).x).toBeCloseTo(1,12);
});
test('translated and scaled capture frames give consistent reference projection coordinates',()=>{
 const c=camera(),point=new Vector3(.2,0,-1),expected=point.clone().applyMatrix4(viceCityShadowProjection(c));
 configureNativeShadowCamera(c,{x:2495,y:15,z:1687},2);
 const transformed=point.multiplyScalar(2).add(new Vector3(2495,13,1687)).applyMatrix4(viceCityShadowProjection(c));expect(transformed.distanceTo(expected)).toBeLessThan(1e-10);
});
test('non-square framing is rejected instead of silently mixing projection conventions',()=>{
 const c=camera();c.top=2;expect(()=>viceCityShadowProjection(c)).toThrow('square');
});
