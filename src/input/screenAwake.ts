/* A phone dims and locks its screen after a while without a touch, which a cutscene or a long drive with the thumbs
 * still can be. While the game plays, the touch controls ask the browser's Screen Wake Lock to keep it on (the mobile
 * ports keep the screen on the same way), and let it go when the game pauses. A browser without the API, or one that
 * refuses (low battery), leaves the screen to its own settings. */
interface WakeLockSentinelLike {released?:boolean;release():Promise<void>}
interface WakeLockLike {request(type:'screen'):Promise<WakeLockSentinelLike>}
export class ScreenAwake {
 private sentinel?:WakeLockSentinelLike;private wanted=false;private asking=false;
 constructor(private readonly lock:WakeLockLike|undefined=(globalThis.navigator as {wakeLock?:WakeLockLike}|undefined)?.wakeLock){}
 get held(){return !!this.sentinel&&!this.sentinel.released;}
 /** Keep the screen on (the game plays) or not (it pauses). */
 async hold(on:boolean){
  this.wanted=on;
  if(!on){const sentinel=this.sentinel;this.sentinel=undefined;await sentinel?.release().catch(()=>{});return;}
  if(this.held||this.asking||!this.lock)return;
  this.asking=true;
  try{const sentinel=await this.lock.request('screen');
   // A pause while the browser was answering: the lock is not wanted any more.
   if(this.wanted)this.sentinel=sentinel;else await sentinel.release().catch(()=>{});}
  catch{/* refused: the screen keeps its own settings */}
  finally{this.asking=false;}
 }
}
/** How long a phone put down mid-game keeps its screen on: with no finger on the glass and nothing touched, keyed or
 * played on a pad for this long (a cutscene or a scripted scene aside, which play without a touch), the wake lock goes,
 * so the phone dims and locks on its own time (which hides the page and pauses the game) rather than drawing to an empty
 * room until its battery runs down. A touch takes the lock again. */
export const SCREEN_IDLE_MS=5*60*1000;
export function screenIdle({fingers,lastActivity,now,scene,idleMs=SCREEN_IDLE_MS}:{fingers:number;lastActivity:number;now:number;scene:boolean;idleMs?:number}){
 return fingers===0&&!scene&&now-lastActivity>=idleMs;
}
