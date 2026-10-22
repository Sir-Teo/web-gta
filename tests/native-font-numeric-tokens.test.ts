import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import fixture from './fixtures/native-font-numeric-tokens.json';
import {gxtHudText,insertNumbers,NativeText,readGxt} from '../src/assets/gxt';
for(const[index,row]of fixture.cases.entries())test(`native closed numeric token ${index}: ${JSON.stringify(row.input)}`,()=>{
 const text=row.input.token+'TAIL';expect(gxtHudText(text)).toBe(text.slice(row.consumedCodeUnits));expect(gxtHudText(text,true)).toBe(row.remaining);
 expect(row.colour).toEqual([100,101,102,103]);expect(row.tag).toBe(90);expect(row.newline).toBe(0);expect(row.symbol).toBe(127);
});
test('the stock ZERO2 fuel label draws without its unfilled numeric token',()=>{
 const text=new NativeText(readGxt(readFileSync('public/play/world/files/text/american.gxt')));text.loadMissionText('ZERO2');expect(text.get('ZER2_28')).toBe('FUEL ~1~');expect(gxtHudText(text.get('ZER2_28')).trim()).toBe('FUEL');
});
test('number insertion precedes font parsing, while adjacent palette tokens remain available to script text',()=>{
 expect(gxtHudText(insertNumbers('~r~REWARD $~1~',500),true)).toBe('~r~REWARD $500');expect(gxtHudText('FUEL ~1~~r~ready~s~',true)).toBe('FUEL ~r~ready~s~');expect(gxtHudText('literal ~1')).toBe('literal ~1');
});
