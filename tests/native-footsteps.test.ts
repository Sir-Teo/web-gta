import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import {nativeFootstepChoice,readNativeFootsteps} from '../src/assets/nativeFootsteps';
test('native footstep sample ranges match every supported surface bank',()=>{
 for(const [category,bank,start,end] of [['concrete',0,1,5],['grass',1,0,4],['gravel',2,0,4],['metal',3,0,4],['sand',4,0,3],['tile',5,0,4],['wood',6,0,4],['water',0,1,5]] as const){
  expect(nativeFootstepChoice(category,0)).toEqual({bank,sound:start});expect(nativeFootstepChoice(category,.999999)).toEqual({bank,sound:end});
 }
 for(const value of [-1,1,NaN])expect(()=>nativeFootstepChoice('grass',value)).toThrow();
});
test.skipIf(!process.env.GTA_CONTENT_DIR)('native footstep installation resolves the acquired package and rejects wrong packages',async()=>{
 const root=process.env.GTA_CONTENT_DIR!;
 const file=(path:string,name:string)=>new File([readFileSync(`${root}/audio/${path}`)],name);
 const files={bankLookup:file('CONFIG/BankLkup.dat','BankLkup.dat'),packageLookup:file('CONFIG/PakFiles.dat','PakFiles.dat'),feet:file('SFX/FEET','FEET')};
 const banks=await readNativeFootsteps(files);expect(banks.map(b=>b.length)).toEqual([9,5,5,5,4,5,5]);
 await expect(readNativeFootsteps({...files,feet:new File([await files.feet.arrayBuffer()],'GENRL')})).rejects.toThrow('different package');
 await expect(readNativeFootsteps({...files,feet:new File(['truncated'],'FEET')})).rejects.toThrow('range exceeds');
});
