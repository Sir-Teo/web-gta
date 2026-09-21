import {expect,test} from 'vitest';
import {GANG_TALK_CLIPS,STARE_RADIUS,gangAbuseContext,stareInRange,stareStandSeconds,stareTalkClip,stareTimeoutSeconds,stepStare,type StareState} from '../src/ped/nativeStareAtPed';

test('the party stares at whoever comes within eight units of its leader',()=>{
 expect(STARE_RADIUS).toBe(8);
 expect(stareInRange({x:0,z:0},{x:7.9,z:0})).toBe(true);
 expect(stareInRange({x:0,z:0},{x:0,z:8})).toBe(false);
 expect(stareInRange({x:10,z:10},{x:14,z:14})).toBe(true);
});
test('the timeout is three to five seconds moved by up to a second, and a stand lasts half to one second',()=>{
 expect(stareTimeoutSeconds(()=>0)).toBe(2);
 expect(stareTimeoutSeconds(()=>1)).toBe(5.998);
 expect(stareTimeoutSeconds(()=>.5)).toBeCloseTo(3.999,3);
 expect(stareStandSeconds(()=>0)).toBe(.5);expect(stareStandSeconds(()=>1)).toBe(.999);
});
test('the task alternates standing still with turning to face until the timeout runs out',()=>{
 const state:StareState={remaining:2,phase:'stand',time:.5};
 // Standing until its time is spent, then facing until the turn completes.
 expect(stepStare(state,.2,false,()=>0)).toBe('stand');expect(state.phase).toBe('stand');
 expect(stepStare(state,.4,false,()=>0)).toBe('stand');expect(state.phase).toBe('face');
 expect(stepStare(state,.1,false,()=>0)).toBe('face');
 expect(stepStare(state,.1,true,()=>0)).toBe('stand');expect(state.time).toBe(.5);
 // The timeout ends it whatever the phase.
 expect(stepStare({remaining:.05,phase:'face',time:0},.1,false,()=>0)).toBe('done');
});
test('a gang talk clip plays one frame in a hundred, only with the leader near and nothing else running',()=>{
 expect(stareTalkClip(()=>0,true,false)).toBe(GANG_TALK_CLIPS[0]);
 expect(stareTalkClip(()=>.5,true,false)).toBeUndefined();
 expect(stareTalkClip(()=>0,false,false)).toBeUndefined();
 expect(stareTalkClip(()=>0,true,true)).toBeUndefined();
 // The second draw picks the clip.
 const values=[0,.99];let i=0;
 expect(stareTalkClip(()=>values[i++],true,false)).toBe(GANG_TALK_CLIPS[7]);
 expect(GANG_TALK_CLIPS).toHaveLength(8);
});
test('DoGangAbuseSpeech: a gangster abuses the player and other gangs, and says nothing to anyone else',()=>{
 expect(gangAbuseContext({talkerIsGangster:true,targetIsPlayer:true})).toBe('abuse_gang_families');
 expect(gangAbuseContext({talkerIsGangster:true,targetIsPlayer:false,targetGang:1})).toBe('abuse_gang_ballas');
 expect(gangAbuseContext({talkerIsGangster:true,targetIsPlayer:false,targetGang:7})).toBe('abuse_triad');
 expect(gangAbuseContext({talkerIsGangster:false,targetIsPlayer:true})).toBeUndefined();
 expect(gangAbuseContext({talkerIsGangster:true,targetIsPlayer:false})).toBeUndefined();
 expect(gangAbuseContext({talkerIsGangster:true,targetIsPlayer:false,targetGang:3})).toBeUndefined();
});
