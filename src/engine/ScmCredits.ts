import {CREDITS} from '../assets/creditsTable';
/* CCredits: the end credits FINALEC rolls with START_CREDITS, waits out with ARE_CREDITS_FINISHED and ends with
 * STOP_CREDITS. Start (0x7170E0) sets bCreditsGoing and notes CTimer::GetTimeInMS; Render draws while it is set and no
 * menu is up. The iOS port's RenderCredits (0x1002e0084) scrolls a unit every 23 ms and its PrintCreditText
 * (0x1002e6174) puts a line at SCREEN_HEIGHT + its position − the scroll and moves the position on by scale × 20 (a
 * float sum truncated, where the PC truncates the scale first and steps 20); PrintCreditSpace adds its size × 25. Once
 * the last line is 10 above the top, bCreditsGoing is cleared, which is all ARE_CREDITS_FINISHED (!bCreditsGoing)
 * reads. AUTHORED: the iOS SCREEN_HEIGHT is the device's; the HUD here lays the 2D out over 448. */
export const CREDITS_SCREEN_HEIGHT=448;
/** RenderCredits' magic number: one unit of scroll every 23 ms. */
export const CREDITS_MS_PER_UNIT=23;
export type CreditLine={key:string;scale:number;heading:boolean;position:number};
/** Each line's position from the top of the roll, and where the roll ends, as RenderCredits steps them. */
export const CREDIT_LINES:readonly CreditLine[]=[];
export let CREDITS_LENGTH=0;
{
 const f=Math.fround,lines:CreditLine[]=[];let position=0;
 for(const entry of CREDITS){
  if(typeof entry==='number'){position=Math.trunc(f(position+entry));continue;}
  const [key,scale,heading]=entry;
  lines.push({key,scale,heading:heading===1,position});
  position=Math.trunc(f(f(f(scale)*20)+position));
 }
 (CREDIT_LINES as CreditLine[]).push(...lines);CREDITS_LENGTH=position;
}
export class ScmCredits {
 /** bCreditsGoing. */
 going=false;
 /** CreditsStartTime (game time, ms). */
 startMs=0;
 start(nowMs:number){this.going=true;this.startMs=nowMs;}
 stop(){this.going=false;}
 /** ARE_CREDITS_FINISHED. */
 get finished(){return !this.going;}
 /** RenderCredits at `nowMs`, which a drawn frame runs while no menu is up: how far the roll has scrolled (units), the
  * roll's top then sitting at SCREEN_HEIGHT − that. Clears bCreditsGoing once the end is 10 above the top. */
 render(nowMs:number):number{
  const scroll=Math.fround(Math.max(0,nowMs-this.startMs)/CREDITS_MS_PER_UNIT);
  if(Math.fround(CREDITS_LENGTH+CREDITS_SCREEN_HEIGHT)-scroll< -10)this.going=false;
  return scroll;
 }
 reset(){this.going=false;this.startMs=0;}
}
