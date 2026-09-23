import {expect,test} from 'vitest';
import {stepFogReduction} from '../src/world/nativeFogReduction';
import {reduceFog} from '../src/world/LocalTimecycle';

test('CTimeCycle::m_FogReduction climbs to 64 while the camera looks down or no rain may fall, and falls back to 0',()=>{
 let fog=0;
 for(let i=0;i<70;i++)fog=stepFogReduction(fog,{cameraForwardZ:-.95,noRain:false});
 expect(fog).toBe(64);
 fog=stepFogReduction(fog,{cameraForwardZ:-.5,noRain:false});expect(fog).toBe(63);
 expect(stepFogReduction(10,{cameraForwardZ:0,noRain:true})).toBe(11);
 expect(stepFogReduction(10,{cameraForwardZ:0,noRain:false,cutscene:true})).toBe(11);
 // Rain the script forces keeps falling in a no-rain zone, but looking down still counts.
 expect(stepFogReduction(10,{cameraForwardZ:0,noRain:true,scriptsForceRain:true})).toBe(9);
 expect(stepFogReduction(10,{cameraForwardZ:-.95,noRain:false,scriptsForceRain:true})).toBe(11);
 expect(stepFogReduction(0,{cameraForwardZ:0,noRain:false})).toBe(0);
});

test('while it is up the far clip is floored at FogReduction × 10.15625',()=>{
 expect(reduceFog({farClip:300},0)).toEqual({farClip:300});
 expect(reduceFog({farClip:300},64)).toEqual({farClip:650});
 expect(reduceFog({farClip:800},64)).toEqual({farClip:800});
});
