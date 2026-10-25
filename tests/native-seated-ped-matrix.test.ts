import {expect,test} from 'vitest';
import {Quaternion,Vector3} from 'three';
import {nativeSeatedPedMatrix} from '../src/simulation/nativeSeatedPedMatrix';
const zero={x:0,y:0,z:0,w:1};
test('a native seat matrix translates to the seat and applies facing after that translation',()=>{
 const position={x:10,y:20,z:30},local={x:1,y:2,z:3},front=nativeSeatedPedMatrix(position,zero,local),rear=nativeSeatedPedMatrix(position,zero,local,{headingOffset:-Math.PI/2});
 expect(front.position).toEqual({x:11,y:-28,z:23});expect(rear.position).toEqual(front.position);expect(rear.forward.x).toBeCloseTo(1);expect(rear.forward.y).toBeCloseTo(0);expect(rear.right.y).toBeCloseTo(-1);
 const turned=nativeSeatedPedMatrix(position,new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.PI/2),local,{headingOffset:Math.PI/2});expect(turned.position.x).toBeCloseTo(8);expect(turned.position.y).toBeCloseTo(-29);expect(turned.position.z).toBeCloseTo(23);expect(turned.forward.y).toBeCloseTo(-1);
});
test('bike seat matrices include native lean, nose dip and bounding-box drop',()=>{
 const lean=.3,pitch=-.05*lean,m=nativeSeatedPedMatrix({x:0,y:0,z:0},zero,{x:0,y:0,z:1},{bikeLean:lean,boundsMinZ:-.6});
 expect(m.position.x).toBeCloseTo(Math.sin(lean)*Math.cos(pitch));expect(m.position.z).toBeCloseTo(Math.cos(lean)*Math.cos(pitch)+(1-Math.cos(lean))*-.6);expect(m.position.y).toBeCloseTo(-Math.sin(pitch));
 for(const axis of [m.right,m.forward,m.up])expect(Math.hypot(axis.x,axis.y,axis.z)).toBeCloseTo(1);
 expect(m.right.x*m.forward.x+m.right.y*m.forward.y+m.right.z*m.forward.z).toBeCloseTo(0);
});
test('a pitched bike drops along its original up vector rather than world vertical',()=>{
 const q=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),Math.PI/2),lean=.4,m=nativeSeatedPedMatrix({x:10,y:20,z:30},q,{x:0,y:0,z:0},{bikeLean:lean,boundsMinZ:-1});
 expect(m.position.x).toBeCloseTo(10);expect(m.position.z).toBeCloseTo(20);expect(m.position.y).toBeCloseTo(-30+(1-Math.cos(lean)));
});
test('repeated offset queries return independent matrix vectors',()=>{
 const first=nativeSeatedPedMatrix({x:1,y:2,z:3},zero,{x:0,y:0,z:0}),before=structuredClone(first),second=nativeSeatedPedMatrix({x:4,y:5,z:6},zero,{x:0,y:0,z:0},{bikeLean:.4,boundsMinZ:-1});expect(first).toEqual(before);for(const key of ['position','right','forward','up'] as const)expect(first[key]).not.toBe(second[key]);
});
