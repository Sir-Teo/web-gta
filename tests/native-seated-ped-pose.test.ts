import {expect,test} from 'vitest';
import {Quaternion,Vector3} from 'three';
import {nativeSeatedPedPose} from '../src/simulation/nativeSeatedPedPose';
const zero={x:0,y:0,z:0,w:1};
test('successive script queries retain independent seat points',()=>{
 const first=nativeSeatedPedPose({x:1,y:2,z:3},zero,{x:0,y:0,z:0});
 const second=nativeSeatedPedPose({x:4,y:5,z:6},zero,{x:0,y:0,z:0},{bikeLean:.4,boundsMinZ:-1});
 expect(first.position.toArray()).toEqual([1,2,3]);expect(second.position.x).toBe(4);expect(first.position).not.toBe(second.position);
});
test('native seat position becomes the ped origin and facing does not rotate the seat translation',()=>{
 const position={x:10,y:20,z:30},local={x:1,y:2,z:3},front=nativeSeatedPedPose(position,zero,local),rear=nativeSeatedPedPose(position,zero,local,{headingOffset:-Math.PI/2});
 expect(front.position.toArray()).toEqual([11,23,28]);expect(front.heading).toBeCloseTo(0);expect(rear.position).toEqual(front.position);expect(rear.heading).toBeCloseTo(270);
 const turned=nativeSeatedPedPose(position,new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.PI/2),local,{headingOffset:Math.PI/2});expect(turned.position.x).toBeCloseTo(8);expect(turned.position.y).toBeCloseTo(23);expect(turned.position.z).toBeCloseTo(29);expect(turned.heading).toBeCloseTo(180);
});
test('a bike passenger follows the lean matrix and its bounding-box drop',()=>{
 const lean=.3,pitch=-.05*lean,pose=nativeSeatedPedPose({x:0,y:0,z:0},zero,{x:0,y:0,z:1},{bikeLean:lean,boundsMinZ:-.6});
 expect(pose.position.x).toBeCloseTo(Math.sin(lean)*Math.cos(pitch));expect(pose.position.y).toBeCloseTo(Math.cos(lean)*Math.cos(pitch)+(1-Math.cos(lean))*-.6);expect(pose.position.z).toBeCloseTo(Math.sin(pitch));expect(pose.heading).toBeGreaterThan(0);
});
test('native bike lean drops along the original vehicle up vector when the bike is pitched',()=>{
 const q=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),Math.PI/2),lean=.4,pose=nativeSeatedPedPose({x:10,y:20,z:30},q,{x:0,y:0,z:0},{bikeLean:lean,boundsMinZ:-1});
 expect(pose.position.x).toBeCloseTo(10);expect(pose.position.y).toBeCloseTo(20);expect(pose.position.z).toBeCloseTo(30-(1-Math.cos(lean)));
});
