import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';
import {EVENT,TASK,makeDecision,readDecisionMaker} from '../src/ped/nativeDecisionMaker';
import {NativeFxEffects} from '../src/simulation/fx/nativeFxEffects';

const file=(name:string)=>readDecisionMaker(readFileSync(`public/play/world/files/data/decision/allowed/${name}.ped`,'latin1'));
const makers=[file('GangMbr'),file('Cop'),file('R_Norm'),file('R_Tough'),file('R_Weak')];
const proto=WorldPedestrians.prototype as any;
const ped=(x:number,z:number,extra:object={})=>({actor:{player:{position:{x,y:0,z},heading:0}},health:100,down:0,flee:0,retaliate:0,decisionMaker:2,...extra} as any);
const danger=(people:any[],at:{x:number;z:number},radius:number)=>proto.danger.call({people,takesPriority:proto.takesPriority,answering:proto.answering,relationshipTo:()=>3,
 decide:(p:any,event:number,relationship:any)=>makeDecision(makers[p.decisionMaker],event,relationship,false,()=>.5)},()=>at,radius,'player');

test('the retail decision files answer CEventDanger with a smart flee for street peds and nothing for gang members and cops',()=>{
 expect(makers[2].get(EVENT.danger)?.map(c=>c.task)).toEqual([TASK.smartFleeEntity,TASK.carDriveMissionFleeScene]);
 const near=ped(19,0),far=ped(0,20.5),gang=ped(0,5,{decisionMaker:0,gang:3}),cop=ped(5,0,{decisionMaker:1,officer:true}),recruit=ped(1,1,{follow:true});
 danger([near,far,gang,cop,recruit],{x:0,z:0},20);
 // AffectsPed measures across the ground; the flee's safe distance is 100000, from the aircraft as it moves.
 expect(near.flee).toBeGreaterThan(0);expect(near.fleePlayer.safe).toBe(100000);expect(near.fleePlayer.entity()).toEqual({x:0,z:0});expect(near.event.type).toBe(EVENT.danger);
 expect(far.flee).toBe(0);expect(gang.flee).toBe(0);expect(cop.flee).toBe(0);expect(recruit.flee).toBe(0);
 // Priority 20 does not displace a ped answering an aimed gun (50).
 const aimedAt=ped(2,2,{event:{type:EVENT.gunAimedAt},gunReact:{phase:'x'}});
 danger([aimedAt],{x:0,z:0},20);expect(aimedAt.flee).toBe(0);
});
test('DoHeliDustEffect gives the height it raises CEventDanger from only near the camera and under 30 units',()=>{
 const effects=Object.create(NativeFxEffects.prototype) as NativeFxEffects;(effects as any).fx={create:()=>undefined};
 const state={timeConst:0},at=(z:number,camera:[number,number,number]=[0,0,0])=>effects.heliDust(state,{camera,position:[0,0,z],rotorOn:true,groundZ:0,sand:false});
 expect(at(12)).toBe(12);expect(at(30)).toBeUndefined();expect(at(12,[60,0,0])).toBeUndefined();
 expect(effects.heliDust(state,{camera:[0,0,0],position:[0,0,12],rotorOn:false,groundZ:0,sand:false})).toBeUndefined();
 // Over water deeper than the ground the height is from the surface.
 expect(effects.heliDust(state,{camera:[0,0,0],position:[0,0,12],rotorOn:true,groundZ:-5,waterLevel:2,sand:false})).toBe(10);
});
