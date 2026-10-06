import {expect,test} from 'vitest';
import {aiTyreBurstChance} from '../src/simulation/WorldCar';

// CVehicle::InflictDamage (iOS 0x1004781b4): an AI ped's round on a car's body bursts a tyre with this chance out of 128.
test('the AI tyre-burst chance by weapon, and at most 1 from a shooter on a motorbike',()=>{
 for(const pistolClass of [22,23,25,28,29,32,52])expect(aiTyreBurstChance(pistolClass)).toBe(5);
 expect(aiTyreBurstChance(30)).toBe(10);expect(aiTyreBurstChance(31)).toBe(10);
 expect(aiTyreBurstChance(24)).toBe(64);
 // The sawn-off, the SPAS 12, the rifles and everything else never do.
 for(const none of [0,26,27,33,34,38,51])expect(aiTyreBurstChance(none)).toBe(0);
 expect(aiTyreBurstChance(24,true)).toBe(1);expect(aiTyreBurstChance(26,true)).toBe(0);
});
