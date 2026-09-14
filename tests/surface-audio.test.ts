import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import {readSurfaceAudio,nativeFootstepCategory,availableFootstepSurface} from '../src/assets/surfaceAudio';
test('surface audio flags use native boolean conversion, IDs and category precedence',()=>{
 const {byId,warnings}=readSurfaceAudio('# header\nTARMAC 1 0 0 0 0 0 0 0 0\nGRASS_SHORT_LUSH 0 -2 0 0 0 0 0 0 0\nGRASS_LONG_LUSH 0 0 0 0 0 0 0 1 0');
 expect(warnings).toEqual([]);expect(nativeFootstepCategory(byId.get(1))).toBe('concrete');expect(nativeFootstepCategory(byId.get(9))).toBe('grass');expect(nativeFootstepCategory(byId.get(11))).toBe('grass');
 const flags={...byId.get(9)!,concrete:true,water:true};expect(nativeFootstepCategory(flags)).toBe('water');flags.water=false;expect(nativeFootstepCategory(flags)).toBe('concrete');
 expect(availableFootstepSurface({...flags,water:true})).toBe('concrete');
});
test('surface audio rejects malformed integers and reports native DEFAULT aliases and overwrites',()=>{
 for(const text of ['TARMAC 1','TARMAC 0 0 0 0 0 0 0 0 NaN','TARMAC 0 0 0 0 0 0 0 0 2147483648'])expect(()=>readSurfaceAudio(text)).toThrow();
 const parsed=readSurfaceAudio('DEFAULT 1 0 0 0 0 0 0 0 0\nunknown 0 1 0 0 0 0 0 0 0');
 expect(parsed.warnings).toHaveLength(2);expect(nativeFootstepCategory(parsed.byId.get(0))).toBe('grass');
});
test.skipIf(!process.env.GTA_CONTENT_DIR)('public native surface audio table resolves without unknown or duplicate IDs',()=>{
 const parsed=readSurfaceAudio(readFileSync(`${process.env.GTA_CONTENT_DIR}/surfaud.dat`,'utf8'));
 expect(parsed.warnings).toEqual([]);expect(parsed.byId.size).toBeGreaterThan(100);
 expect(nativeFootstepCategory(parsed.byId.get(1))).toBe('concrete');expect(nativeFootstepCategory(parsed.byId.get(9))).toBe('grass');
});
