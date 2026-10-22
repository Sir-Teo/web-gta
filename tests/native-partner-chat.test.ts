import {expect,test} from 'vitest';
import transitions from './fixtures/native-partner-chat-transitions.json';
import handlers from './fixtures/native-partner-chat-handler.json';
import sequences from './fixtures/native-partner-chat-sequence.json';
import {createPartnerChat,nextPartnerChat,partnerChatPoints,partnerChatSequence,stepPartnerChat} from '../src/simulation/nativePartnerChat';
const point=(a:number[])=>({x:a[0],y:a[1],z:a[2]});
for(const row of transitions.cases)test(`native partner transition ${JSON.stringify(row.input)}`,()=>{
 const i=row.input,s=createPartnerChat(i.lead),other=createPartnerChat(!i.lead);s.phase=i.phase;s.point=point([10,20,30]);s.partnerPoint=point([12,24,30]);other.phase=i.otherPhase;
 const action=nextPartnerChat(s,i.exists&&i.reciprocal?other:undefined,i.subtype,point([10,20,30]),point([16,28,30]));
 expect(action.kind==='done').toBe(row.native.ended);
 if('phase'in row.native){expect(s.phase).toBe(row.native.phase);expect(s.first).toBe(row.native.first);expect(s.directions).toBe(row.native.directions);expect(other.first).toBe(row.native.otherFirst);expect(Object.values(s.point)).toEqual(row.native.point);expect(Object.values(other.point)).toEqual(row.native.otherPoint);}
 if(action.kind!=='done'){const native=row.native.actions[0];expect(action.kind).toBe(native.kind);if(action.kind==='stand')expect(action.ms).toBe('ms'in native?native.ms:undefined);if(action.kind==='goto')expect(Object.values(action.point)).toEqual('point'in native?native.point:undefined);}
});
for(const row of sequences.cases)test(`native partner ${row.kind} ${JSON.stringify(row.input)}`,()=>{
 if(row.kind==='points'){
  const i=row.input as {a:number[];b:number[]},n=row.native as {a:number[];b:number[]},r=partnerChatPoints(point(i.a),point(i.b));expect(Object.values(r.a)).toEqual(n.a);expect(Object.values(r.b)).toEqual(n.b);
 }else{
  const i=row.input as {point:number[];directions:number;lead:boolean};expect(partnerChatSequence(point(i.point),i.directions,i.lead)).toEqual((row.native as {kind:string;ms?:number;animation?:number}[]).map(({kind,ms})=>ms===undefined?{kind}:{kind,ms}));
 }
});
test('an unpaired listener ends after the initial stand; partner loss stops an active pair immediately',()=>{
 const s=createPartnerChat(false),p=point([1,2,3]);expect(stepPartnerChat(s,undefined,p,p,0,0,.02).kind).toBe('hold');expect(stepPartnerChat(s,undefined,p,p,0,0,.04).kind).toBe('done');
 s.phase=2;expect(stepPartnerChat(s,undefined,p,p,0,0,.01).kind).toBe('done');expect(stepPartnerChat(createPartnerChat(true),undefined,p,undefined,0,0,.01).kind).toBe('done');
});
test('a reciprocal pair approaches, faces, alternates gestures and completes four rounds',()=>{
 const a=createPartnerChat(true),b=createPartnerChat(false);let pa=point([10,20,30]),pb=point([16,20,30]),ha=Math.PI/2,hb=-Math.PI/2,doneA=false,doneB=false,chatA=0,chatB=0,moved=false;
 for(let frame=0;frame<3000&&!(doneA&&doneB);frame++){
  if(!doneA){const r=stepPartnerChat(a,doneB?undefined:b,pa,pb,ha,2,.02);if(r.kind==='move'){pa={...r.point!};moved=true;}if(r.kind==='turn')ha=Math.atan2(pb.x-pa.x,pa.y-pb.y);if(r.kind==='chat')chatA++;doneA=r.kind==='done';}
  if(!doneB){const r=stepPartnerChat(b,doneA?undefined:a,pb,pa,hb,2,.02);if(r.kind==='move')pb={...r.point!};if(r.kind==='turn')hb=Math.atan2(pa.x-pb.x,pb.y-pa.y);if(r.kind==='chat')chatB++;doneB=r.kind==='done';}
 }
 expect(moved).toBe(true);expect(chatA).toBeGreaterThan(100);expect(chatB).toBeGreaterThan(100);expect(doneA&&doneB).toBe(true);expect(a.directions).toBe(0);expect(b.directions).toBe(0);
});

for(const row of handlers.cases)test(`native PartnerChat constructor ${JSON.stringify(row.input)}`,()=>{
 const s=createPartnerChat(row.input.lead!==0),n=row.native;expect(n.allocation).toBe(144);expect(n.command).toBe('COMMAND_TASK_CHAT_WITH_CHAR');expect(n.taskId).toBe(1204);expect(n.partner).toBe(true);expect(n.distanceMultiplier).toBe(.5);expect(s.lead).toBe(n.lead);expect(s.phase).toBe(n.phase);expect(s.first).toBe(n.first);expect(s.directions).toBe(n.directions);expect(n.conversation&&n.fallback).toBe(true);
});
