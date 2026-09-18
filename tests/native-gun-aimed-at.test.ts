import {describe,expect,it} from 'vitest';
import {GUN_AIMED_AT_WANDER_SECONDS,ReactToGunAimedAt,gunAimedAtAffects,gunAimedAtResponse} from '../src/ped/nativeGunAimedAt';

describe('CEventGunAimedAt::AffectsPed',()=>{
 const base={ped:{x:0,y:0,z:0},forward:{x:0,z:1},aimer:{x:0,y:0,z:10},alive:true,reacting:false};
 it('needs the aimer inside 15 units and in front',()=>{
  expect(gunAimedAtAffects(base)).toBe(true);
  expect(gunAimedAtAffects({...base,aimer:{x:0,y:0,z:15}})).toBe(false);
  expect(gunAimedAtAffects({...base,aimer:{x:0,y:0,z:-5}})).toBe(false);
 });
 it('ignores dead peds, peds already reacting, group members and passengers of driven cars',()=>{
  expect(gunAimedAtAffects({...base,alive:false})).toBe(false);
  expect(gunAimedAtAffects({...base,reacting:true})).toBe(false);
  expect(gunAimedAtAffects({...base,sameGroup:true})).toBe(false);
  expect(gunAimedAtAffects({...base,passengerOfDrivenVehicle:true})).toBe(false);
 });
});

describe('CEventHandler::ComputeGunAimedAtResponse',()=>{
 it('keeps a fleeing ped fleeing and turns an armed street ped on the player',()=>{
  expect(gunAimedAtResponse({fleeing:true,createdByGame:true,inVehicle:false,holdsGun:true,friendly:false})).toBe('flee');
  expect(gunAimedAtResponse({fleeing:false,createdByGame:true,inVehicle:false,holdsGun:true,friendly:false})).toBe('kill');
  expect(gunAimedAtResponse({fleeing:false,createdByGame:true,inVehicle:false,holdsGun:true,friendly:true})).toBe('decisionMaker');
  expect(gunAimedAtResponse({fleeing:false,createdByGame:true,inVehicle:false,holdsGun:false,friendly:false})).toBe('decisionMaker');
 });
});

describe('CTaskComplexReactToGunAimedAt',()=>{
 it('faces the aimer, raises the hands for 3 to 5 s, then walks off for 10 s',()=>{
  const task=new ReactToGunAimedAt({x:0,z:0},40,1500);
  expect(task.handsUpSeconds).toBe(4.5);
  expect(task.step(.1,false)).toBe('heading');
  expect(task.step(.1,true)).toBe('handsUp');
  expect(task.step(4.4,true)).toBe('handsUp');
  expect(task.step(.2,true)).toBe('wander');
  expect(task.step(GUN_AIMED_AT_WANDER_SECONDS,true)).toBe('done');
 });
 it('cowers then flees with pedstats flag 0x80',()=>{
  const task=new ReactToGunAimedAt({x:0,z:0},0x80,0,1.2);
  task.step(0,true);expect(task.phase).toBe('cower');
  expect(task.step(1.3,true)).toBe('flee');
 });
});
