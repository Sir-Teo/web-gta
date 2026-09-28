import {afterEach,expect,test} from 'vitest';
import {WorldBike} from '../src/simulation/WorldBike';
import {CHEATS} from '../src/simulation/nativeCheats';

afterEach(()=>{if(CHEATS.isActive('hugeBunnyHop'))CHEATS.toggle('hugeBunnyHop');});

// CBmx::LaunchBunnyHopCB: ApplyMoveForce(0.06 × mass × power × up), power = min(charge / 25, 1) + 1, and the Huge Bunny
// Hop cheat multiplies the power by 5.
const hop=()=>{
  let v={x:0,y:0,z:0};
  const bike=Object.assign(Object.create(WorldBike.prototype),{modelId:481,occupied:true,controlJump:25,hopLaunch:.001,wheelsDown:()=>true,
    body:{rotation:()=>({x:0,y:0,z:0,w:1}),linvel:()=>v,setLinvel:(n:any)=>{v=n;}}});
  (WorldBike.prototype as any).bunnyHop.call(bike,.01,false);
  return v.y;
};
test('the Huge Bunny Hop cheat makes the hop five times as strong',()=>{
  const plain=hop();expect(plain).toBeCloseTo(.06*2*50,6);
  CHEATS.toggle('hugeBunnyHop');
  expect(hop()).toBeCloseTo(plain*5,6);
});
