import {expect,test} from 'vitest';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';

// A gang party member the population manager removes leaves the party; a party left with one member breaks up.
test('removing a party member takes it out of its party',()=>{
  const leader={} as any,a={} as any,b={} as any,party={leader,members:[leader,a,b]};
  leader.party=a.party=b.party=party;
  const self={bodyHandles:new Set(),sim:{world:{removeCharacterController(){},removeRigidBody(){}}},leaveParty:(WorldPedestrians.prototype as any).leaveParty} as any;
  const ped=(p:any)=>Object.assign(p,{body:{handle:1},view:{dispose(){}},controller:{}});
  (WorldPedestrians.prototype as any).remove.call(self,ped(b));
  expect(party.members).toEqual([leader,a]);expect(b.party).toBeUndefined();
  (WorldPedestrians.prototype as any).remove.call(self,ped(a));
  expect(leader.party).toBeUndefined();
});
