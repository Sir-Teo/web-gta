import {expect,test} from 'vitest';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';
import {readFileSync} from 'node:fs';
import {PED_ATTRACTOR} from '../src/assets/twoDEffect';
import {EVENT,RELATIONSHIP,makeDecision,readDecisionMaker} from '../src/ped/nativeDecisionMaker';

const effect=(type:number,probability:number,key='a')=>({key,model:'m',type,scriptName:'',probability,position:[1,0,0] as [number,number,number],queueDir:[0,1,0] as [number,number,number],useDir:[0,1,0] as [number,number,number],forwardDir:[0,1,0] as [number,number,number]});
const ped=()=>({id:1,actor:{player:{position:{x:0,y:0,z:0}}},attractorsTried:new Set<string>()} as any);
const notice=(p:any,effects:any[],rain=0,decide:(p:any,event:number)=>number|undefined=()=>undefined)=>{
 const self={attractorsNear:()=>effects,attractorQueues:new Map(),rain:()=>rain,clock:0,decide};
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

test('the decision maker then chooses: a street ped uses the effect or lets it be, a tough ped or gang member never does',()=>{
 const dm=(name:string)=>readDecisionMaker(readFileSync(`public/play/world/files/data/decision/allowed/${name}.ped`,'latin1'));
 const draw=(name:string,roll:number)=>(_:any,event:number)=>makeDecision(dm(name),event,RELATIONSHIP.neutral,false,()=>roll);
 expect(EVENT.attractor).toBe(27);
 // R_Norm: nothing 40, the effect 40 (the look, 20, is an avoided task), so the upper half of the draw uses it.
 const low=ped(),high=ped();notice(low,[effect(PED_ATTRACTOR.atm,100)],0,draw('R_Norm',.2));notice(high,[effect(PED_ATTRACTOR.atm,100)],0,draw('R_Norm',.7));
 expect(low.attract).toBeUndefined();expect(high.attract?.key).toBe('a');
 for(const name of ['R_Tough','GangMbr']){const p=ped();notice(p,[effect(PED_ATTRACTOR.atm,100)],0,draw(name,.99));expect(p.attract).toBeUndefined();}
});
