import {expect,test} from 'vitest';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';

// A fresh wander picks its next node from where the ped stands: one let go far from its old target walks on from the
// nearest node.
test('a ped released far from its old wander target rejoins at the nearest node',()=>{
  const far={position:[500,0,0]},near={position:[10,-10,0]};
  const ped={target:far,previousNode:{},actor:{player:{position:{x:12,y:0,z:10}}}} as any;
  (WorldPedestrians.prototype as any).rejoinWander.call({nearestNode:()=>near},ped);
  expect(ped.target).toBe(near);expect(ped.previousNode).toBeUndefined();
  // Within 20 units of its target the wander carries on unchanged.
  const close={target:near,previousNode:far,actor:{player:{position:{x:12,y:0,z:10}}}} as any;
  (WorldPedestrians.prototype as any).rejoinWander.call({nearestNode:()=>far},close);
  expect(close.target).toBe(near);
});
