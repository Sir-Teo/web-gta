import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import {NativeText,gxtCharsToText,gxtKeyHash,readGxt} from '../src/assets/gxt';

const text=new NativeText(readGxt(readFileSync('public/play/world/files/text/american.gxt')));

test('the stock AMERICAN.GXT reads: vehicle game names, zone names and the CD error line',()=>{
 expect(gxtKeyHash('MONSTA')).toBe(gxtKeyHash('monsta'));
 expect(['MONSTER','MONSTA','GREENWO','ADMIRAL'].map(k=>text.get(k))).toEqual(['Monster','Monster','Greenwood','Admiral']);
 expect(text.get('SAN_AND')).toBe('San Andreas');expect(text.get('GAN')).toBe('Ganton');
 expect(text.get('CDERROR')).toMatch(/^Error reading the~n~Grand Theft Auto: San Andreas disc/);
 // CText::Get: a missing or blank key is an empty string.
 expect(text.get('NOPE_XX')).toBe('');expect(text.get(' GAN')).toBe('');
});

test('mission tables load on demand and answer after MAIN',()=>{
 expect(text.gxt.missions.size).toBe(126);
 text.loadMissionText('SWEET1B');expect(text.missionName).toBe('SWEET1B');
 expect([...text.gxt.missions.keys()]).toContain('INTRO1');
});

test('GxtCharToUTF8 maps the font codes',()=>{
 expect(gxtCharsToText(new Uint8Array([0x6e,0x61,0xa4,0x76,0x65,0x5b,0x5d,0x5e]))).toBe('naïve<>¡');
});

import {ZONE_TEXT} from '../src/ui/nativeZoneText';
test('the transcribed zone names agree with the GXT',()=>{
 expect(Object.entries(ZONE_TEXT).filter(([key,value])=>text.get(key)!==value)).toEqual([]);
});

import {gxtHudText,insertNumbers} from '../src/assets/gxt';
test('HUD text puts numbers in the ~1~s, breaks lines on ~n~ and drops colour tokens',()=>{
 expect(gxtHudText(insertNumbers(text.get('TAG_ONE'),3,100))).toBe('Tags sprayed\n3 out of 100');
 expect(gxtHudText(insertNumbers(text.get('REWARD'),500))).toBe('REWARD $500');
 expect(gxtHudText(text.get('GW_YRS'))).toBe('This hood is yours!');
 expect(insertNumbers('~1~ of ~1~',7)).toBe('7 of -1');
 expect(gxtHudText('Press ~k~~VEHICLE_ENTER_EXIT~ to get in, ~k~~PED_ANSWER_PHONE~ to answer')).toBe('Press F to get in, PED ANSWER PHONE to answer');
 expect(gxtHudText("Press ~k~~CONVERSATION_NO~ to answer 'NO' or press ~k~~CONVERSATION_YES~ to answer 'YES'.")).toBe("Press N to answer 'NO' or press Y to answer 'YES'.");
 expect(gxtHudText('Press ~k~~GROUP_CONTROL_BWD~ to instruct your gang to stay in position')).toBe('Press H to instruct your gang to stay in position');
});
