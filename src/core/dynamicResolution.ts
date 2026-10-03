/* A phone slows as it warms: after ten minutes or so its GPU is held back and the frame rate the first play measured
 * (autoQuality) is gone. Console and later mobile ports answer with dynamic resolution, drawing fewer pixels while the
 * GPU falls behind; the picture softens, the game keeps its pace. Here a window of drawn frames slower than 26 a second
 * (the frame limiter asks 30) steps the renderer's pixels down a step, and a game that keeps up for a while tries a step
 * back up. A step that buys nothing (the GPU was not what held the game back: the CPU, a load) is taken back, and the
 * next try waits longer. */
/** The share of the chosen resolution drawn at each step. */
export const RESOLUTION_STEPS=[1,.85,.72,.6] as const;
/** The fewest pixels drawn, per CSS pixel, whatever the step and the chosen resolution. */
export const RESOLUTION_FLOOR=.5;
export class DynamicResolution {
 private level=0;private last?:number;private played=0;private intervals:number[]=[];
 /** How long the game has kept up since the last change, and how long it must before a step up is tried. */
 private keptUp=0;private upAfter:number;
 /** The step just taken and the median before it, judged by the next window; and play left before stepping down again. */
 private trying?:{down:boolean;before:number};private holdDown=0;private holdFor:number;
 constructor(private readonly windowMs=3000,private readonly slowMs=1000/26,upAfterMs=30000,holdDownMs=60000,private readonly stallMs=250,private readonly gain=.92){
  this.upAfter=upAfterMs;this.holdFor=holdDownMs;
 }
 /** The share of the chosen resolution drawn now. */
 get scale(){return RESOLUTION_STEPS[this.level];}
 /** A drawn frame at `now` (ms). Only frames in play count, and a stall (a load's hitch) is left out. The new scale when
  * a window changes it. */
 frame(now:number,playing:boolean):number|undefined{
  if(!playing){this.last=undefined;return;}
  const interval=this.last===undefined?undefined:now-this.last;this.last=now;
  if(interval===undefined||interval>this.stallMs)return;
  this.played+=interval;this.intervals.push(interval);
  if(this.played<this.windowMs)return;
  const sorted=[...this.intervals].sort((a,b)=>a-b),median=sorted[sorted.length>>1],windowMs=this.played;
  this.played=0;this.intervals=[];this.holdDown=Math.max(0,this.holdDown-windowMs);
  return this.judge(median,windowMs);
 }
 private judge(median:number,windowMs:number):number|undefined{
  const slow=median>this.slowMs,trying=this.trying;this.trying=undefined;
  if(trying?.down&&slow&&median>trying.before*this.gain){
   // Fewer pixels did not quicken a game still behind: they are not what holds it back. Back up, and leave the
   // resolution be for a while, longer each time.
   this.level--;this.holdDown=this.holdFor;this.holdFor*=2;this.keptUp=0;return this.scale;
  }
  if(trying&&!trying.down&&slow){
   // The step up was too much: back down, and wait twice as long before the next.
   this.level++;this.upAfter*=2;this.keptUp=0;return this.scale;
  }
  if(slow){
   this.keptUp=0;
   if(this.level>=RESOLUTION_STEPS.length-1||this.holdDown>0)return;
   this.trying={down:true,before:median};this.level++;return this.scale;
  }
  this.keptUp+=windowMs;
  if(this.level>0&&this.keptUp>=this.upAfter){this.trying={down:false,before:median};this.level--;this.keptUp=0;return this.scale;}
  return;
 }
}
/** The renderer's pixels per CSS pixel: the chosen resolution's at the dynamic step, never under the floor (nor raised
 * to it from a chosen ratio already under it). */
export function scaledRatio(ratio:number,scale:number){return Math.min(ratio,Math.max(RESOLUTION_FLOOR,ratio*scale));}
