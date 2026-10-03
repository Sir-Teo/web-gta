import {expect,test} from 'vitest';
import {keepStorage,openedInstalled} from '../src/core/persistentStorage';

test('an installed game asks for its storage to be kept, once granted it stays, and a browser tab does not ask',async()=>{
 const storage=(persisted:boolean,grant:boolean)=>{const asked:string[]=[];return {asked,persisted:async()=>{asked.push('persisted');return persisted;},persist:async()=>{asked.push('persist');return grant;}};};
 const fresh=storage(false,true);expect(await keepStorage(fresh,true)).toBe(true);expect(fresh.asked).toEqual(['persisted','persist']);
 const kept=storage(true,true);expect(await keepStorage(kept,true)).toBe(true);expect(kept.asked).toEqual(['persisted']);
 const refused=storage(false,false);expect(await keepStorage(refused,true)).toBe(false);
 // In a browser tab nothing is asked (Firefox would prompt).
 const tab=storage(false,true);expect(await keepStorage(tab,false)).toBe(false);expect(tab.asked).toEqual([]);
 // No Storage API, or one that throws.
 expect(await keepStorage(undefined,true)).toBe(false);expect(await keepStorage({persist:async()=>{throw new Error('no');}},true)).toBe(false);
});

test('opened installed: an iPhone\'s home-screen app, or a standalone or fullscreen display mode at launch',()=>{
 const media=(matches:boolean)=>(query:string)=>({matches:matches&&query.includes('standalone')} as MediaQueryList);
 expect(openedInstalled({standalone:true},media(false))).toBe(true);
 expect(openedInstalled({},media(true))).toBe(true);
 expect(openedInstalled({},media(false))).toBe(false);
 expect(openedInstalled({},undefined)).toBe(false);
});
