import {expect,test} from 'vitest';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';
import {PED_ATTRACTOR} from '../src/assets/twoDEffect';

const effect=(type:number,probability:number,key='a')=>({key,model:'m',type,scriptName:'',probability,position:[1,0,0] as [number,number,number],queueDir:[0,1,0] as [number,number,number],useDir:[0,1,0] as [number,number,number],forwardDir:[0,1,0] as [number,number,number]});
const ped=()=>({id:1,actor:{player:{position:{x:0,y:0,z:0}}},attractorsTried:new Set<string>()} as any);
const notice=(p:any,effects:any[],rain=0)=>{
 const self={attractorsNear:()=>effects,attractorQueues:new Map(),rain:()=>rain,clock:0};
 (WorldPedestrians.prototype as any).noticeAttractor.call(self,p);return self;
};

test('a passer-by uses an attractor it rolls under both bytes for, and rolls each one only once (CEventAttractor::AffectsPed)',()=>{
 const p=ped(),self=notice(p,[effect(PED_ATTRACTOR.atm,100)]);
 expect(p.attract).toMatchObject({key:'a',phase:'go',slot:0});expect(self.attractorQueues.get('a')?.peds).toEqual([1]);
 const q=ped();q.attractorsTried.add('a');notice(q,[effect(PED_ATTRACTOR.atm,100)]);expect(q.attract).toBeUndefined();
});

test('no ped-existing chance ignores it, a look chance only turns the head, and a dry shelter draws no one',()=>{
 const none=ped();notice(none,[effect(PED_ATTRACTOR.atm,0)]);expect(none.attract).toBeUndefined();expect(none.look).toBeUndefined();
 // Second byte 100: always the head-look instead.
 const looker=ped();notice(looker,[effect(PED_ATTRACTOR.atm,100|100<<8)]);expect(looker.attract).toBeUndefined();expect(looker.look).toBeDefined();expect(looker.lookAt).toEqual({x:1,y:0,z:-0});
 const dry=ped();notice(dry,[effect(PED_ATTRACTOR.shelter,100)]);expect(dry.attract).toBeUndefined();
 const wet=ped();notice(wet,[effect(PED_ATTRACTOR.shelter,100)],.5);expect(wet.attract?.type).toBe(PED_ATTRACTOR.shelter);
});
