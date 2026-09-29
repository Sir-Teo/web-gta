import {expect,test} from 'vitest';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';
import {TASK} from '../src/ped/nativeDecisionMaker';

// CEventHandler::IsKillTaskAppropriate: a mission ped always takes on his attacker; otherwise he does so when he holds a
// gun or the attacker holds none. A knife or a bat is no gun (IsTypeMelee).
const answer=(ped:{mission?:boolean;weaponType?:number},attackerWeapon:number)=>{
  const p={officer:false,health:100,retaliate:0,flee:0,mission:ped.mission,weapon:ped.weaponType===undefined?undefined:{info:{type:ped.weaponType}}} as any;
  let fought=false,fled=false;
  const self=Object.assign(Object.create(WorldPedestrians.prototype),{takesPriority:()=>true,decide:()=>TASK.killPedOnFoot,relationshipTo:()=>0,
    killPedOnFoot:()=>{fought=true;},fleeFromPlayer:()=>{fled=true;}});
  (WorldPedestrians.prototype as any).damageResponse.call(self,p,attackerWeapon);
  return fought?'fight':fled?'flee':'none';
};
test('an unarmed mission ped shot at fights back',()=>{
  expect(answer({mission:true},22)).toBe('fight');
  expect(answer({},22)).toBe('flee');
});
test('a ped holding a knife is not armed against a gun',()=>{
  expect(answer({weaponType:4},22)).toBe('flee');
  expect(answer({weaponType:4},0)).toBe('fight');
  expect(answer({weaponType:22},22)).toBe('fight');
});
