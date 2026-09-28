import {expect,test} from 'vitest';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';
import {PED_ATTRACTOR} from '../src/assets/twoDEffect';

// CTaskComplexSitDownThenIdleThenStandUp: StandStill(100) → SitDown → SitIdle → StandUp; the idle clip runs at a random
// 0.9 to 1.5 speed (CTaskSimpleSitIdle) and a disturbance below an IMMEDIATE abort only zeroes the idle, so the
// stand-up still plays before the ped answers.
const proto=WorldPedestrians.prototype as any;
function seated(){
 const played:any[][]=[];
 const view={hasReaction:()=>true,reactionDuration:(name:string)=>({seat_down:1.2,seat_idle:2,seat_up:.9}as any)[name],playReaction:(...args:any[])=>{played.push(args);},reactionName:undefined,clearReaction(){}};
 const p:any={id:1,health:100,down:0,view,actor:{player:{heading:0}}};
 const left:any[]=[];
 const self={sitClips:proto.sitClips,stepAttractor:proto.stepAttractor,standUpFromSeat:proto.standUpFromSeat,leaveAttractor:(q:any)=>{left.push(q);q.attract=undefined;},attractorQueues:new Map(),rain:()=>0};
 proto.beginAttractor.call(self,p,'bench',PED_ATTRACTOR.seat,0);
 return {p,played,left,step:(dt:number)=>self.stepAttractor.call(self,p,dt)};
}
test('a tenth of a second standing still, then the sit-down clip, then the idle at 0.9 to 1.5 speed',()=>{
 const {p,played,step}=seated();
 expect(p.attract).toMatchObject({phase:'presit',until:.1});expect(played).toEqual([]);
 step(.05);expect(p.attract.phase).toBe('presit');
 step(.06);expect(p.attract).toMatchObject({phase:'sit',until:1.2});expect(played).toEqual([['seat_down']]);
 step(1.3);expect(p.attract.phase).toBe('idle');
 expect(played[1][0]).toBe('seat_idle');const rate=played[1][5];expect(rate).toBeGreaterThanOrEqual(.9);expect(rate).toBeLessThanOrEqual(1.5);
});
test('the idle ends with the stand-up clip, after which the ped leaves',()=>{
 const {p,played,left,step}=seated();
 step(.2);step(1.3);p.attract.until=1;// a finite idle
 step(1.1);expect(p.attract).toMatchObject({phase:'up',until:.9});expect(played[2]).toEqual(['seat_up']);
 step(1);expect(left).toHaveLength(1);
});
test('a sitter marked leaving stands up out of the sit-down rather than idling',()=>{
 const {p,played,step}=seated();
 step(.2);p.attract.leaving=true;p.attract.until=Math.min(p.attract.until,p.attract.time);
 step(0);expect(p.attract.phase).toBe('up');expect(played.map(a=>a[0])).toEqual(['seat_down','seat_up']);
});
