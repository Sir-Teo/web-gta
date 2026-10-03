import {expect,test} from 'vitest';
import {ScreenAwake,SCREEN_IDLE_MS,screenIdle} from '../src/input/screenAwake';
/** A stand-in for navigator.wakeLock: its requests answer when told to, and record what was asked and let go. */
function fakeLock(){
 const log:string[]=[];let answer:(()=>void)|undefined;let refuse=false;
 const lock={request:(type:'screen')=>new Promise<{released:boolean;release():Promise<void>}>((resolve,reject)=>{log.push(`request ${type}`);
  answer=()=>{if(refuse){reject(new Error('NotAllowedError'));return;}const sentinel={released:false,release:async()=>{sentinel.released=true;log.push('release');}};resolve(sentinel);};})};
 return {lock,log,answer:async()=>{answer?.();await Promise.resolve();await Promise.resolve();},refuse:()=>{refuse=true;}};
}
test('playing keeps the screen on and pausing lets it go',async()=>{
 const f=fakeLock(),awake=new ScreenAwake(f.lock);
 const on=awake.hold(true);await f.answer();await on;expect(awake.held).toBe(true);
 // Asked again while held: no second request.
 await awake.hold(true);expect(f.log).toEqual(['request screen']);
 await awake.hold(false);expect(awake.held).toBe(false);expect(f.log).toEqual(['request screen','release']);
});
test('a pause while the browser is still answering lets the lock go when it comes',async()=>{
 const f=fakeLock(),awake=new ScreenAwake(f.lock);
 const on=awake.hold(true);await awake.hold(false);await f.answer();await on;
 expect(awake.held).toBe(false);expect(f.log).toEqual(['request screen','release']);
});
test('a refusal or a browser without the API leaves the screen to its own settings',async()=>{
 const f=fakeLock();f.refuse();const awake=new ScreenAwake(f.lock);
 const on=awake.hold(true);await f.answer();await expect(on).resolves.toBeUndefined();expect(awake.held).toBe(false);
 const none=new ScreenAwake(undefined);await expect(none.hold(true)).resolves.toBeUndefined();expect(none.held).toBe(false);
});

test('a phone put down mid-game lets its screen go after five minutes untouched, not with a finger on it or in a scene',()=>{
 expect(SCREEN_IDLE_MS).toBe(300000);
 const at=(minutes:number,o:{fingers?:number;scene?:boolean}={})=>screenIdle({fingers:o.fingers??0,lastActivity:0,now:minutes*60000,scene:o.scene??false});
 expect(at(4.9)).toBe(false);expect(at(5)).toBe(true);
 // A thumb held on the gas pedal for a long straight is play, however long nothing new is touched.
 expect(at(20,{fingers:1})).toBe(false);
 // A cutscene or a scripted scene plays without a touch.
 expect(at(20,{scene:true})).toBe(false);
 expect(screenIdle({fingers:0,lastActivity:1000,now:2000,scene:false,idleMs:500})).toBe(true);
});
