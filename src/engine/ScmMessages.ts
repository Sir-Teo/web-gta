import {requireAsset} from '../assets/binary';

/* CMessages, CHud help-message state and CTheScripts intro text lines from
 * the pinned gta-reversed checkout (0076f9017b4aeef7433957ac2bd8b6988e9df166).
 * Messages are keyed by their GXT label instead of the resolved text pointer:
 * native pointer identity and strcmp on TheText.Get results coincide with
 * label equality except for two labels carrying identical text. Number and
 * string insertion, control-key substitution and drawing are HUD work that
 * consumes these queues; they are not reproduced here. */

export const NUM_BRIEF_MESSAGES=8,NUM_BIG_MESSAGE_SLOTS=4,NUM_MESSAGE_STYLES=7,NUM_PREVIOUS_BRIEFS=20;
/** eMessageStyle indices used by ClearMessages' mission-title exemption. */
export const STYLE_BOTTOM_RIGHT=1,STYLE_MIDDLE_SMALLER_HIGHER=4;
const EMPTY_NUMBERS=[-1,-1,-1,-1,-1,-1] as const;

export interface ScmMessage {key:string;insert?:string;flags:number;visibleTime:number;createdAt:number;numbers:readonly number[];previousBrief:boolean}
export interface ScmPreviousBrief {key:string;numbers:readonly number[];insert?:string}
type Slot=ScmMessage|undefined;

function numbers(values?:readonly number[]){
 if(!values)return EMPTY_NUMBERS;requireAsset(values.length===6,'Messages carry exactly six insertable numbers.');return [...values];
}
function sameNumbers(a:readonly number[],b:readonly number[]){return a.every((n,i)=>n===b[i]);}

export class ScmMessages {
 readonly briefs:Slot[]=new Array(NUM_BRIEF_MESSAGES).fill(undefined);
 readonly big:Slot[][]=Array.from({length:NUM_MESSAGE_STYLES},()=>new Array<Slot>(NUM_BIG_MESSAGE_SLOTS).fill(undefined));
 readonly previousBriefs:(ScmPreviousBrief|undefined)[]=new Array(NUM_PREVIOUS_BRIEFS).fill(undefined);
 /** ClearThisPrintBigNow also blanks CHud's big-message buffer for the style. */
 onClearBigMessage?:(style:number)=>void;
 private static style(style:number){requireAsset(Number.isInteger(style)&&style>=0&&style<NUM_MESSAGE_STYLES,`Message style ${style} is outside eMessageStyle.`);return style;}
 private static make(key:string,insert:string|undefined,flags:number,time:number,createdAt:number,previousBrief:boolean,values?:readonly number[]):ScmMessage{
  return {key,insert,flags:flags&0xffff,visibleTime:time>>>0,createdAt:createdAt>>>0,numbers:numbers(values),previousBrief};
 }
 /** CMessages::AddMessage2: instant messages overwrite slot 0; queued ones take the first free slot or are dropped. */
 addMessage2(key:string,time:number,flags:number,previousBrief:boolean,showInstantly:boolean,nowMs:number,insert?:string,values?:readonly number[]){
  const message=ScmMessages.make(key,insert,flags,time,nowMs,previousBrief,values);
  let index=showInstantly?0:this.briefs.findIndex(slot=>!slot);
  if(index<0)return;
  this.briefs[index]=message;
  if(previousBrief&&(showInstantly||index===0))this.addToPreviousBriefArray(key,message.numbers,insert);
 }
 addMessageQ(key:string,time:number,flags:number,previousBrief:boolean,nowMs:number){this.addMessage2(key,time,flags,previousBrief,false,nowMs);}
 addMessageJump(key:string,time:number,flags:number,previousBrief:boolean,nowMs:number){this.addMessage2(key,time,flags,previousBrief,true,nowMs);}
 addMessageWithNumberQ(key:string,time:number,flags:number,values:readonly number[],previousBrief:boolean,nowMs:number){this.addMessage2(key,time,flags,previousBrief,false,nowMs,undefined,values);}
 addMessageJumpQWithNumber(key:string,time:number,flags:number,values:readonly number[],previousBrief:boolean,nowMs:number){this.addMessage2(key,time,flags,previousBrief,true,nowMs,undefined,values);}
 /** CMessages::AddBigMessage2 for one eMessageStyle stack. */
 addBigMessage2(key:string,time:number,style:number,showInstantly:boolean,nowMs:number,insert?:string,values?:readonly number[]){
  const stack=this.big[ScmMessages.style(style)],index=showInstantly?0:stack.findIndex(slot=>!slot);
  if(index<0)return;
  stack[index]=ScmMessages.make(key,insert,0,time,nowMs,false,values);
 }
 /** CMessages::AddToPreviousBriefArray (0x69DD50): skip duplicates, shift the used prefix right, insert at zero. */
 addToPreviousBriefArray(key:string,values:readonly number[]=EMPTY_NUMBERS,insert?:string){
  const entry:ScmPreviousBrief={key,numbers:numbers(values),insert};
  let i=0;
  for(;i<NUM_PREVIOUS_BRIEFS;i++){
   const previous=this.previousBriefs[i];
   if(!previous)break;
   if(previous.key===key&&previous.insert===insert&&sameNumbers(previous.numbers,entry.numbers))return;
  }
  if(i===NUM_PREVIOUS_BRIEFS)i=NUM_PREVIOUS_BRIEFS-1;
  for(let k=i;k>0;k--)this.previousBriefs[k]=this.previousBriefs[k-1];
  this.previousBriefs[0]=entry;
 }
 /** CMessages::ClearMessages (0x69DCD0). */
 clearMessages(ignoreMissionTitle:boolean){
  for(let style=0;style<NUM_MESSAGE_STYLES;style++){
   if(ignoreMissionTitle&&(style===STYLE_BOTTOM_RIGHT||style===STYLE_MIDDLE_SMALLER_HIGHER))continue;
   this.big[style].fill(undefined);
  }
  this.clearSmallMessagesOnly();
 }
 clearSmallMessagesOnly(){this.briefs.fill(undefined);}
 clearPreviousBriefArray(){this.previousBriefs.fill(undefined);}
 private static clearThisPrintImpl(messages:Slot[],key:string,nowMs:number,onFirstCleared?:(message:ScmMessage)=>void){
  for(;;){
   let i=0;
   for(;;){
    const message=messages[i];
    if(!message)return;
    if(message.key===key)break;
    if(++i>=messages.length)return;
   }
   for(let k=i;k<messages.length-1;k++)messages[k]=messages[k+1];
   messages[messages.length-1]=undefined;
   if(i===0){
    const front=messages[0];
    if(front){front.createdAt=nowMs>>>0;onFirstCleared?.(front);}
   }
  }
 }
 /** CMessages::ClearThisPrint (0x69EA30): a promoted front message re-enters the previous briefs. */
 clearThisPrint(key:string,nowMs:number){
  ScmMessages.clearThisPrintImpl(this.briefs,key,nowMs,message=>this.addToPreviousBriefArray(message.key,message.numbers,message.insert));
 }
 /** CMessages::ClearThisBigPrint (0x69EBE0). */
 clearThisBigPrint(key:string,nowMs:number){for(const stack of this.big)ScmMessages.clearThisPrintImpl(stack,key,nowMs);}
 /** CMessages::ClearThisPrintBigNow (0x69ED80). */
 clearThisPrintBigNow(style:number,nowMs:number){
  const front=this.big[ScmMessages.style(style)][0];
  if(front)this.clearThisBigPrint(front.key,nowMs);
  this.onClearBigMessage?.(style);
 }
 /** CMessages::Process (0x69EEE0), called once per game frame. An expired front
  * message is dropped and the queue closes up. The pinned transcription
  * shifts the array right at this point; the original moves later entries
  * forward, which is the behaviour reproduced. */
 process(nowMs:number){
  nowMs=nowMs>>>0;
  const expire=(messages:Slot[])=>{
   const front=messages[0];
   if(!front)return;
   if(nowMs<=((front.createdAt+front.visibleTime)>>>0))return;
   for(let k=0;k<messages.length-1;k++)messages[k]=messages[k+1];
   messages[messages.length-1]=undefined;
   if(messages[0])messages[0].createdAt=nowMs;
  };
  for(const stack of this.big)expire(stack);
  expire(this.briefs);
  const front=this.briefs[0];
  if(front)this.addToPreviousBriefArray(front.key,front.numbers,front.insert);
 }
}

/** CHud help-message statics touched by SetHelpMessage (0x588BE0) and
 * SetHelpMessageWithNumber (0x588E30). Strings hold GXT labels. */
export class ScmHelpMessage {
 message='';toPrint='';last='';state=0;permanent=false;quick=false;statId=0;maxStatValue=1000;statUpdateValue=0;
 /** Conditions the HUD reads from other systems; each defaults to inactive. */
 blocked?:()=>boolean;
 /** CHud::SetHelpMessage. The three buffers are blanked before the
  * permanent-message comparison, so a null text never survives the call
  * even when the early return leaves the state flag set. */
 set(key:string|undefined,quick:boolean,permanent:boolean,addToBrief:boolean,messages:ScmMessages){
  if(this.blocked?.())return;
  this.toPrint='';this.last='';this.message=key??'';
  if(this.state&&this.message===this.toPrint)return;
  this.last='';
  if(key===undefined){this.message='';this.toPrint='';}
  if(permanent){this.state=1;this.toPrint=this.message;this.last=this.message;}
  else this.state=0;
  if(addToBrief&&key!==undefined)messages.addToPreviousBriefArray(key);
  this.permanent=permanent;this.quick=quick;this.statId=0;this.maxStatValue=1000;this.statUpdateValue=0;
 }
 /** CHud::SetHelpMessageWithNumber: the number becomes part of the displayed text. */
 setWithNumber(key:string,number:number,quick:boolean,permanent:boolean){
  if(this.blocked?.())return;
  this.message=`${key}#${number}`;this.last='';
  if(permanent){this.state=1;this.toPrint=this.message;this.last=this.message;}
  else this.state=0;
  this.permanent=permanent;this.quick=quick;this.statId=0;this.maxStatValue=1000;this.statUpdateValue=0;
 }
}

/** tScriptText defaults (0x4690A8). Screen-relative wrap/centre sizes take
 * the caller's virtual resolution because the native values are the RsGlobal
 * raster size at the time the line is initialised. */
export interface ScmIntroTextLine {
 scale:{x:number;y:number};colour:[number,number,number,number];justify:boolean;centred:boolean;background:boolean;backgroundTextOnly:boolean;
 wrapX:number;centreSize:number;backgroundColour:[number,number,number,number];proportional:boolean;dropShadowColour:[number,number,number,number];
 dropShadow:number;textEdge:number;drawBeforeFade:boolean;rightJustify:boolean;fontStyle:number;position:{x:number;y:number};key:string;number1:number;number2:number;
}
export const MAX_NUM_INTRO_TEXT_LINES=96;
/** CTheScripts::eUseTextCommandState. */
export const USE_TEXT_DISABLED=0,USE_TEXT_DISABLE_NEXT_FRAME=1,USE_TEXT_ENABLED_BY_SCRIPT=2;

export class ScmIntroText {
 readonly lines:ScmIntroTextLine[];
 count=0;
 useTextCommands=USE_TEXT_DISABLED;
 constructor(readonly screenWidth=640,readonly screenHeight=448){
  this.lines=Array.from({length:MAX_NUM_INTRO_TEXT_LINES},()=>this.defaults());
 }
 defaults():ScmIntroTextLine{
  return {scale:{x:0.48,y:1.12},colour:[225,225,225,255],justify:false,centred:false,background:false,backgroundTextOnly:false,wrapX:this.screenHeight,centreSize:this.screenWidth,
   backgroundColour:[128,128,128,128],proportional:true,dropShadowColour:[0,0,0,255],dropShadow:2,textEdge:0,drawBeforeFade:false,rightJustify:false,fontStyle:0,position:{x:0,y:0},key:'',number1:-1,number2:-1};
 }
 /** The SET_TEXT_* commands mutate the line that the next DISPLAY_TEXT claims. */
 get pending(){requireAsset(this.count<MAX_NUM_INTRO_TEXT_LINES,'Intro text lines exhausted for this frame.');return this.lines[this.count];}
 /** I_DisplayText: claim the pending line. UseTextCommands must be enabled. */
 display(x:number,y:number,key:string,number1:number,number2:number){
  requireAsset(this.useTextCommands!==USE_TEXT_DISABLED,'DISPLAY_TEXT without USE_TEXT_COMMANDS is an assertion in the source.');
  const line=this.pending;line.position={x,y};line.number1=number1;line.number2=number2;line.key=key;this.count++;
 }
 /** CTheScripts::Process frame reset while text commands are in use. */
 beginFrame(){
  if(this.useTextCommands===USE_TEXT_DISABLED)return;
  for(let i=0;i<MAX_NUM_INTRO_TEXT_LINES;i++)this.lines[i]=this.defaults();
  this.count=0;
  if(this.useTextCommands===USE_TEXT_DISABLE_NEXT_FRAME)this.useTextCommands=USE_TEXT_DISABLED;
 }
}
