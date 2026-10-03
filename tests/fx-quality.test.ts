import {afterEach,expect,test} from 'vitest';
import {canAddParticle,fxQuality,playerRealTimeShadow,setFxQuality} from '../src/simulation/fx/fxQuality';
import {parseTouchSettings} from '../src/input/touchSettings';
afterEach(()=>setFxQuality('high'));
test('the FX quality drops particles below high as FxSystem_c\'s CanAddParticle does',()=>{
 expect(fxQuality()).toBe('high');
 // CGeneral::RandomBool(p): a roll of 0 to 99 under p.
 const rolls=[0,.49,.5,.74,.75,.99],added=()=>rolls.map(r=>canAddParticle(()=>r));
 expect(added()).toEqual([true,true,true,true,true,true]);
 setFxQuality('medium');expect(added()).toEqual([true,true,true,true,false,false]);
 setFxQuality('low');expect(added()).toEqual([true,true,false,false,false,false]);
});
test('only high and very high cast the player\'s real-time shadow',()=>{
 for(const [quality,shadow] of [['low',false],['medium',false],['high',true],['veryHigh',true]] as const){setFxQuality(quality);expect(playerRealTimeShadow()).toBe(shadow);}
});
test('the touch settings keep a Visual effects choice, high by default',()=>{
 expect(parseTouchSettings({}).effects).toBe('high');
 expect(parseTouchSettings({effects:'low'}).effects).toBe('low');expect(parseTouchSettings({effects:'medium'}).effects).toBe('medium');
 // Max (very high) is not offered.
 expect(parseTouchSettings({effects:'veryHigh'}).effects).toBe('high');
});
