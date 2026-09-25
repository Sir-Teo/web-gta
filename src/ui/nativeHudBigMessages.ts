/* CHud's big messages in the styles other than STYLE_MIDDLE and STYLE_WHITE_MIDDLE, pinned gta-reversed Hud.cpp:
 * SetBigMessage (which CMessages::Display calls once a frame with the front of each style's queue, or nothing),
 * DrawMissionTitle (0x58D240) and DrawOddJobMessage (0x58CC80).
 * - STYLE_BOTTOM_RIGHT, the mission title, runs its own clock once it starts, and SetBigMessage leaves it alone until
 *   it has gone:
 *   - its first frame takes the zone name off and clears the help message, and draws nothing;
 *   - a counter goes from -60 up to the screen's width less 20 at 0.3 a millisecond (the PC dropped Vice City's
 *     scaling, so a wider screen shows the title longer);
 *   - then 120 time steps of 1/50 s pass;
 *   - then it fades out at 1 alpha a millisecond, and is cleared.
 * - STYLE_MIDDLE_SMALLER_HIGHER, the odd-job title, draws while no mission title does. It draws before the fade or
 *   after it, as DRAW_ODDJOB_TITLE_BEFORE_FADE says.
 * - STYLE_LIGHT_BLUE_TOP and STYLE_MIDDLE_SMALLER draw while they are queued, before the fade.
 * - STYLE_WHITE_MIDDLE_SMALLER, the odd-job result, runs OddJob2's cycle:
 *   - a slide in, stepped a frame at a time;
 *   - 1.5 s held;
 *   - a slide out;
 *   - 5 s off before the next cycle.
 *   It draws for the whole cycle, while no mission title does. The slide's offset is computed but, in both
 *   gta-reversed and reVC, the text is printed at the centre. A new text starts the cycle again.
 * Frame-stepped parts advance on the game's 30 fps frames. Times are milliseconds. */

export const STYLE_BOTTOM_RIGHT=1,STYLE_MIDDLE_SMALLER=3,STYLE_MIDDLE_SMALLER_HIGHER=4,STYLE_WHITE_MIDDLE_SMALLER=5,STYLE_LIGHT_BLUE_TOP=6;
const NUM_MESSAGE_STYLES=7;
/** CTimer's frames as the port counts them. */
const FRAME_MS=1000/30;

export interface DrawnHudBigMessages {
 /** DrawMissionTitle: gold pricedown at the bottom right, its alpha 0..255. */
 missionTitle?:{text:string;alpha:number};
 /** DrawOddJobMessage's STYLE_MIDDLE_SMALLER_HIGHER, and whether it is drawn after the fade. */
 oddJobTitle?:{text:string;afterFade:boolean};
 lightBlueTop?:string;
 middleSmaller?:string;
 whiteMiddleSmaller?:string;
}

export class NativeHudBigMessages {
 /** CHud::m_BigMessage, BigMessageX, BigMessageAlpha and BigMessageInUse. */
 readonly text:string[]=new Array(NUM_MESSAGE_STYLES).fill('');
 readonly x:number[]=new Array(NUM_MESSAGE_STYLES).fill(0);
 readonly alpha:number[]=new Array(NUM_MESSAGE_STYLES).fill(0);
 readonly inUse:number[]=new Array(NUM_MESSAGE_STYLES).fill(0);
 private lastWhiteMiddleSmaller='';
 oddJob2OffTimer=0;oddJob2On=0;oddJob2XOffset=0;oddJob2Timer=0;
 private frameClock=0;private oddJob2Drawn=false;
 /** CHud::SetBigMessage: taken unless the style's own clock is running. */
 set(style:number,text:string){
  if(this.x[style]!==0)return;
  this.text[style]=text;
  if(style===STYLE_WHITE_MIDDLE_SMALLER){
   if(text!==this.lastWhiteMiddleSmaller){this.oddJob2OffTimer=0;this.oddJob2On=0;}
   this.lastWhiteMiddleSmaller=text;
  }
 }
 /** Whether DrawAreaName steps aside for the mission title (BigMessageX[STYLE_BOTTOM_RIGHT] != 0). */
 get missionTitleShowing(){return this.x[STYLE_BOTTOM_RIGHT]!==0;}
 /** CMessages::ClearThisPrintBigNow's CHud part (and CRunningScript::Process's scene skip, which blanks the title's
  * text and so ends its clock the next frame). */
 clear(style:number){this.x[style]=0;this.text[style]='';}
 /** One game frame of CHud::Draw's DrawOddJobMessage(true), then DrawAfterFade's DrawMissionTitle and
  * DrawOddJobMessage(false). `screenWidth` is RsGlobal.maximumWidth; `onMissionTitle` is the title's first frame's
  * m_ZoneState = NAME_DONT_SHOW and SetHelpMessage(nullptr). */
 draw(dtMs:number,screenWidth:number,oddJobTitleBeforeFade:boolean,onMissionTitle?:()=>void):DrawnHudBigMessages{
  const out:DrawnHudBigMessages={};
  // DrawOddJobMessage(true): OddJob2's cycle steps on whole frames.
  this.frameClock+=dtMs;
  while(this.frameClock>=FRAME_MS){this.frameClock-=FRAME_MS;this.stepOddJob2(FRAME_MS);}
  const titleText=this.text[STYLE_BOTTOM_RIGHT];
  if(this.text[STYLE_LIGHT_BLUE_TOP])out.lightBlueTop=this.text[STYLE_LIGHT_BLUE_TOP];
  if(this.text[STYLE_MIDDLE_SMALLER])out.middleSmaller=this.text[STYLE_MIDDLE_SMALLER];
  if(this.oddJob2Drawn&&this.text[STYLE_WHITE_MIDDLE_SMALLER]&&!titleText)out.whiteMiddleSmaller=this.text[STYLE_WHITE_MIDDLE_SMALLER];
  // DrawMissionTitle, after the fade.
  const title=this.drawMissionTitle(dtMs,screenWidth,onMissionTitle);
  if(title)out.missionTitle=title;
  // The odd-job title, in whichever pass DRAW_ODDJOB_TITLE_BEFORE_FADE names, while no mission title is set (the
  // before-fade pass reads the title before DrawMissionTitle can clear it; the difference lasts a frame).
  if(!this.text[STYLE_BOTTOM_RIGHT]&&this.text[STYLE_MIDDLE_SMALLER_HIGHER])
   out.oddJobTitle={text:this.text[STYLE_MIDDLE_SMALLER_HIGHER],afterFade:!oddJobTitleBeforeFade};
  return out;
 }
 private stepOddJob2(stepMs:number){
  if(this.oddJob2OffTimer>0)this.oddJob2OffTimer-=stepMs;
  // The cycle's frame is drawn, its last step included, unless the off timer is still running as it starts.
  this.oddJob2Drawn=!!this.text[STYLE_WHITE_MIDDLE_SMALLER]&&this.oddJob2OffTimer<=0;
  if(!this.oddJob2Drawn)return;
  switch(this.oddJob2On){
   case 0:this.oddJob2XOffset=380;this.oddJob2On=1;break;
   case 1:
    if(this.oddJob2XOffset<=2){this.oddJob2On=2;this.oddJob2Timer=0;}
    else this.oddJob2XOffset-=Math.min(this.oddJob2XOffset/6,40);
    break;
   case 2:
    // A uint16 of whole milliseconds.
    this.oddJob2Timer=(this.oddJob2Timer+Math.trunc(stepMs))&0xffff;
    if(this.oddJob2Timer>1500)this.oddJob2On=3;
    break;
   case 3:
    this.oddJob2XOffset-=Math.max(this.oddJob2XOffset/5,30);
    if(this.oddJob2XOffset<-380){this.oddJob2On=0;this.oddJob2OffTimer=5000;}
    break;
  }
 }
 private drawMissionTitle(dtMs:number,screenWidth:number,onStart?:()=>void){
  const s=STYLE_BOTTOM_RIGHT;
  if(!this.text[s]){this.x[s]=0;return undefined;}
  if(this.x[s]===0){
   this.inUse[s]=-60;this.x[s]=1;onStart?.();
   return undefined;
  }
  if(this.inUse[s]>=screenWidth-20){
   // CTimer::GetTimeStep: the frame's time in fiftieths of a second.
   this.x[s]+=dtMs/20;
   if(this.x[s]>=120){this.x[s]=120;this.alpha[s]-=dtMs;}
   if(this.alpha[s]<=0){this.alpha[s]=0;this.text[s]='';this.x[s]=0;return undefined;}
  }else{
   this.alpha[s]=255;
   this.inUse[s]+=dtMs*.3;
  }
  return {text:this.text[s],alpha:this.alpha[s]};
 }
}
