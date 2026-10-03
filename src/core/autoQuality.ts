/* The iOS port picks its quality settings by the device the first time it runs (its settings table's device presets,
 * read from the executable): a weak device gets Visual Effects Low, Resolution 0, Draw Distance 20 and Shadows and Car
 * Reflections off; middling ones Medium or High with Draw Distance 55 to 80; the strongest Max and 100 throughout. A
 * browser does not name the device, so on a touch screen the first play is measured instead: after a warm-up, a run of
 * drawn frames whose median interval is slower than 24 a second (the frame limiter asks 30) steps the settings down a
 * preset, and the next is measured in turn, until the game keeps up or the lowest is reached. It runs once; a player
 * who sets any of them has chosen. */
import type {TouchSettings} from '../input/touchSettings';
/** The presets below the game's own: the port's middling Draw Distance and its weakest device's settings. */
export const QUALITY_PRESETS:Readonly<Record<'medium'|'low',Partial<TouchSettings>>>={
 medium:{effects:'medium',drawDistance:55},
 low:{effects:'low',drawDistance:20,resolution:'low',density:'low'},
};
/** The preset a step down from the settings now, or none from the lowest. */
export function lowerPreset(settings:Pick<TouchSettings,'effects'>):'medium'|'low'|undefined{
 return settings.effects==='high'?'medium':settings.effects==='medium'?'low':undefined;
}
export class AutoQuality {
 private last?:number;private played=0;private intervals:number[]=[];
 constructor(private readonly warmupMs=5000,private readonly windowMs=8000,private readonly slowMs=1000/24,private readonly stallMs=250){}
 /** A drawn frame at `now` (ms). Only frames in play count (not under a menu, a load or a hidden page), and a stall
  * (a load's hitch) is left out. 'slow' once a window says the game cannot keep up, 'fine' once one says it can. */
 frame(now:number,playing:boolean):'slow'|'fine'|undefined{
  if(!playing){this.last=undefined;return;}
  const interval=this.last===undefined?undefined:now-this.last;this.last=now;
  if(interval===undefined||interval>this.stallMs)return;
  this.played+=interval;if(this.played<this.warmupMs)return;
  this.intervals.push(interval);
  if(this.played<this.warmupMs+this.windowMs)return;
  const sorted=[...this.intervals].sort((a,b)=>a-b),median=sorted[sorted.length>>1];
  this.played=0;this.intervals=[];
  return median>this.slowMs?'slow':'fine';
 }
}
