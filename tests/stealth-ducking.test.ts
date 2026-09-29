import {expect,test} from 'vitest';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';

// CPedIntelligence::TestForStealthKill: `if (target->bIsDucking || target->m_fHealth < 1.0f) return false;`
test('a ducking ped cannot be stealth-killed',()=>{
  const ped=(crouched:boolean)=>({id:1,officer:false,collider:{handle:7},health:100,down:0,stealth:undefined,actor:{player:{position:{x:0,y:0,z:1},heading:0,speed:0,crouched}}}) as any;
  const self=(people:any[])=>Object.assign(Object.create(WorldPedestrians.prototype),{catalog:{stealth:{kill_knife_ped_die:{}}},people,moveState:()=>0,attackingPlayer:()=>false});
  const pick=(crouched:boolean)=>(WorldPedestrians.prototype as any).stealthTarget.call(self([ped(crouched)]),{x:0,y:0,z:0});
  expect(pick(false)).toBeDefined();
  expect(pick(true)).toBeUndefined();
});
