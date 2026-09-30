import {expect,test} from 'vitest';
import {Quaternion,Vector3} from 'three';
import {uprightRollRate} from '../src/simulation/WorldBike';
/** Steps a body's rotation under an angular velocity (rad/s, world axes) for `seconds` at 50 Hz, the rate taken
 * from uprightRollRate each step as WorldBike.beforeStep does. */
function settle(q:Quaternion,seconds:number){
 for(let i=0;i<seconds*50;i++){
  const forward=new Vector3(0,0,-1).applyQuaternion(q),rate=uprightRollRate(q,forward);
  const w=forward.clone().multiplyScalar(rate),angle=w.length()/50;
  if(angle>0)q.premultiply(new Quaternion().setFromAxisAngle(w.normalize(),angle));
 }
 return q;
}
test('a ridden bike knocked onto its side is rolled back upright about its forward axis',()=>{
 for(const roll of [70,-70,20]){
  const q=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),.8).multiply(new Quaternion().setFromAxisAngle(new Vector3(0,0,1),roll*Math.PI/180));
  const heading=new Vector3(0,0,-1).applyQuaternion(q.clone());
  settle(q,1.5);
  const up=new Vector3(0,1,0).applyQuaternion(q),forward=new Vector3(0,0,-1).applyQuaternion(q);
  expect(up.y).toBeGreaterThan(.999);
  // Its heading is the one it had.
  expect(forward.distanceTo(heading)).toBeLessThan(1e-6);
 }
});
test('the pitch of a bike on a hill is kept: only the roll is taken out',()=>{
 const pitch=.2,q=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),pitch).multiply(new Quaternion().setFromAxisAngle(new Vector3(0,0,1),.6));
 settle(q,1.5);
 const forward=new Vector3(0,0,-1).applyQuaternion(q),right=new Vector3(1,0,0).applyQuaternion(q);
 expect(Math.asin(forward.y)).toBeCloseTo(pitch,6);
 expect(Math.abs(right.y)).toBeLessThan(.003);
 expect(uprightRollRate(q,forward)).toBe(0);
});
