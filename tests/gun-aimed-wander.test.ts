import {expect,test} from 'vitest';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';
import {ReactToGunAimedAt} from '../src/ped/nativeGunAimedAt';

// CTaskComplexReactToGunAimedAt's last subtask is CTaskComplexWanderStandard(PEDMOVE_WALK, NodeHeading(ped - aimer)):
// the ped walks off along the path network from the nearest node, setting off away from the aimer, rather than
// straight through whatever stands behind it.
test('after its hands go down the ped wanders off along the path network, away from the aimer',()=>{
  const node={position:[0,0,0]},next={position:[0,-10,0]};
  const task=new ReactToGunAimedAt({x:0,z:-5},0,0);task.phase='handsUp';task.time=10;
  const ped={gunReact:task,health:100,down:0,retaliate:0,flee:0,headingChange:7.5,actor:{player:{position:{x:0,y:0,z:0},heading:Math.PI}},view:{playReaction(){},reactionName:undefined},target:{position:[50,50,0]},previousNode:{}} as any;
  let rerouted=false;
  const self={nearestNode:()=>node,chooseTarget:(p:any,reroute:boolean)=>{rerouted=reroute;p.previousNode=p.target;p.target=next;}};
  const speed=(WorldPedestrians.prototype as any).stepGunReact.call(self,ped,1/50,()=>{throw new Error('no straight steer');});
  expect(speed).toBeUndefined();
  expect(rerouted).toBe(true);expect(ped.target).toBe(next);
  // The aimer stood at browser z -5 (native y +5): away from it is native −y, four eighths of a turn round.
  expect(ped.wanderDir).toBe(4);
});
