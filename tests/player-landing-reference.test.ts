import {expect,test} from 'vitest';
import reference from './fixtures/player-landing-reference.json';
import {nativeLandingStatModifier,nativeLandingPlayback} from '../src/simulation/nativeLanding';

for(const [i,row] of reference.modifiers.entries())test(`captured landing stat modifier ${i}: fat ${row.fat}, muscle ${row.muscle}`,()=>{
 expect(nativeLandingStatModifier(row.fat,row.muscle)).toBe(row.modifier);
});
for(const [i,row] of reference.cases.entries())test(`captured landing playback ${i}`,()=>{
 const v=row.input;
 expect(nativeLandingPlayback({initialSpeed:v.initialSpeed,modifier:nativeLandingStatModifier(v.fat,v.muscle),sprintState:v.moveState===7,sprintHeld:v.held,isPlayer:v.isPlayer,tired:v.animId===10})).toBe(row.first.speed);
});
