/* The iOS port picks its quality settings by the device the first time it runs (its settings table's device presets,
 * read from the executable): a weak device gets Visual Effects Low, Resolution 0, Draw Distance 20 and Shadows and Car
 * Reflections off; middling ones Medium or High with Draw Distance 55 to 80; the strongest Max and 100 throughout. A
 * browser does not name the device, so on a touch screen the first play is measured instead: after a warm-up, a run of
 * drawn frames whose median interval is slower than 24 a second (the frame limiter asks 30) steps the settings down a
 * preset, and the next is measured in turn, until the game keeps up or the lowest is reached. Play at the wheel is
 * measured apart from play on foot (a car's camera sees further and its steps cost more), and flying apart from both
 * (the furthest view and the world streaming in fastest beneath it): a phone that keeps up on foot and not in a car,
 * or at the wheel and not in the air, steps down too. Each is measured once; a player who sets any of them has chosen. */
import type {TouchSettings} from '../input/touchSettings';
/** The presets below the game's own: the port's middling Draw Distance and its weakest device's settings. */
export const QUALITY_PRESETS:Readonly<Record<'medium'|'low',Partial<TouchSettings>>>={
 medium:{effects:'medium',drawDistance:55},
 low:{effects:'low',drawDistance:20,resolution:'low',density:'low',carReflections:false,shadows:false},
};
/** The preset a step down from the settings now, or none from the lowest. */
export function lowerPreset(settings:Pick<TouchSettings,'effects'>):'medium'|'low'|undefined{
 return settings.effects==='high'?'medium':settings.effects==='medium'?'low':undefined;
}
/** The port's device presets go before the first frame; a browser names no device, but Chrome on Android gives the
 * device's memory (navigator.deviceMemory, in GB, rounded and capped at 8) and its cores. A device of 2 GB or less
 * starts at the weakest preset, one of 4 GB or less with four cores or fewer at the middling one; anything else, and a
 * browser that says nothing (Safari), starts at the game's own and is measured. */
export function devicePreset(nav:{deviceMemory?:number;hardwareConcurrency?:number}):'medium'|'low'|undefined{
 const memory=nav.deviceMemory,cores=nav.hardwareConcurrency;
 if(memory===undefined)return undefined;
 if(memory<=2)return 'low';
 if(memory<=4&&cores!==undefined&&cores<=4)return 'medium';
 return undefined;
}
/** Where the frames are played: a car's camera sees further and its steps cost more, so play at the wheel is judged
 * on its own. */
export type QualityContext='foot'|'vehicle'|'aircraft';
export class AutoQuality {
 private last?:number;private context?:QualityContext;private played=0;private intervals:number[]=[];
 /** The contexts a window has found fine at the settings now. */
 private fine=new Set<QualityContext>();
 constructor(private readonly warmupMs=5000,private readonly windowMs=8000,private readonly slowMs=1000/24,private readonly stallMs=1000,
  private readonly contexts:readonly QualityContext[]=['foot','vehicle','aircraft']){}
 /** The context the last window found fine, for the host to keep (a player who never flies keeps the rest). */
 settled?:QualityContext;
 /** Whether play in `context` is still to be judged: the adaptive resolution steers the rest. */
 measuring(context:QualityContext){return this.contexts.includes(context)&&!this.fine.has(context);}
 /** A drawn frame at `now` (ms) in `context`. Only frames in play count (not under a menu, a load or a hidden page),
  * and a stall (a load's hitch, over a second) is left out; a frame of a quarter second is a slow one, not a hitch: a
  * phone crawling at a few frames a second in a car is the slowness this is for. A change of context warms up again. 'slow' once a window in either
  * context says the game cannot keep up (the next settings are measured afresh), 'fine' once a window in each has
  * said it can. */
 frame(now:number,playing:boolean,context:QualityContext='foot'):'slow'|'fine'|undefined{
  if(!playing){this.last=undefined;return;}
  if(context!==this.context){this.context=context;this.played=0;this.intervals=[];this.last=undefined;}
  const interval=this.last===undefined?undefined:now-this.last;this.last=now;
  if(interval===undefined||interval>this.stallMs)return;
  if(this.fine.has(context))return;
  this.played+=interval;if(this.played<this.warmupMs)return;
  this.intervals.push(interval);
  if(this.played<this.warmupMs+this.windowMs)return;
  const sorted=[...this.intervals].sort((a,b)=>a-b),median=sorted[sorted.length>>1];
  this.played=0;this.intervals=[];
  if(median>this.slowMs){this.fine.clear();return 'slow';}
  this.fine.add(context);this.settled=context;
  return this.contexts.every(c=>this.fine.has(c))?'fine':undefined;
 }
}
