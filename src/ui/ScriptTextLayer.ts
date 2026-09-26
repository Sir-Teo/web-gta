import type {ScmIntroRectangle,ScmIntroTextLine} from '../engine/ScmMessages';
import {RECT_MONOCOLOR,RECT_TEXT} from '../engine/ScmMessages';
/* CHud::DrawScriptText: the script's DISPLAY_TEXT lines and DRAW_RECT boxes for the frame, in two passes. CHud::Draw
 * draws the ones marked SET_TEXT_DRAW_BEFORE_FADE (and SET_SPRITES_DRAW_BEFORE_FADE) under the screen fade; DoFade
 * covers them; CHud::DrawAfterFade draws the rest over it, which is how INTRO's title cards ("Francis INTL. Airport,
 * Liberty City, 1992.") show on the black screen. Neither pass draws while a STYLE_MIDDLE big message is up, and the
 * user pause stops both.
 *
 * CFont draws a glyph cell 20 x m_fHeight tall and its proportional width x m_fWidth wide, with m_fHeight the line's
 * y scale halved and both stretched from the 640x448 design space to the screen (SCREEN_SCALE_X, SCREEN_SCALE_Y). The
 * browser draws the text in the matching web font at the cell's height and stretches it across to the x scale.
 * Textured sprites (DRAW_SPRITE) need the script's texture dictionary and are not drawn. */
/** CFont's font styles: FONT_GOTHIC, FONT_SUBTITLES, FONT_MENU, FONT_PRICEDOWN. */
const FONTS=['700 {px}px Unifraktur,Georgia,serif','700 {px}px Arial,Helvetica,sans-serif','900 {px}px \'Arial Black\',Arial,sans-serif','400 {px}px Impact,\'Arial Narrow\',sans-serif'];
/** An average glyph's proportional width in CFont's 32-unit cells over the web font's advance per em. */
const WIDTH_RATIO=14/.6;
type Resolve=(key:string,number1:number,number2:number)=>string;
const rgba=(c:readonly number[])=>`rgba(${c[0]},${c[1]},${c[2]},${(c[3]/255).toFixed(3)})`;
class Pass{
 readonly canvas=document.createElement('canvas');
 private readonly context=this.canvas.getContext('2d');
 private shown='';
 constructor(className:string){this.canvas.className=className;this.canvas.setAttribute('aria-hidden','true');this.canvas.hidden=true;}
 draw(lines:readonly {line:ScmIntroTextLine;text:string}[],rectangles:readonly ScmIntroRectangle[],width:number,height:number,ratio:number){
  const signature=lines.length||rectangles.length?`${width}x${height}@${ratio}|${JSON.stringify(rectangles)}|${JSON.stringify(lines)}`:'';
  if(signature===this.shown)return;
  this.shown=signature;this.canvas.hidden=!signature;
  const context=this.context;if(!signature||!context)return;
  const pixelWidth=Math.max(1,Math.round(width*ratio)),pixelHeight=Math.max(1,Math.round(height*ratio));
  if(this.canvas.width!==pixelWidth||this.canvas.height!==pixelHeight){this.canvas.width=pixelWidth;this.canvas.height=pixelHeight;}
  context.setTransform(ratio,0,0,ratio,0,0);context.clearRect(0,0,width,height);
  const sx=width/640,sy=height/448;
  for(const r of rectangles){
   if(r.type!==RECT_MONOCOLOR&&r.type!==RECT_TEXT)continue;
   // The runtime keeps the corners in the 640x448 design space.
   context.fillStyle=rgba(r.colour);
   context.fillRect(Math.min(r.cornerA.x,r.cornerB.x)*sx,Math.min(r.cornerA.y,r.cornerB.y)*sy,Math.abs(r.cornerB.x-r.cornerA.x)*sx,Math.abs(r.cornerB.y-r.cornerA.y)*sy);
  }
  for(const {line,text} of lines){
   const cell=10*line.scale.y*sy;if(!(cell>0)||!text)continue;
   const stretch=Math.min(3,Math.max(.25,WIDTH_RATIO*line.scale.x*sx/cell));
   context.font=(FONTS[line.fontStyle]??FONTS[1]).replace('{px}',cell.toFixed(2));context.textBaseline='top';
   // CFont wraps a left-justified line at the wrap x, a centred one within the centre size about its x.
   const x=line.position.x*sx,y=line.position.y*sy;
   const limit=line.centred?line.centreSize*sx:line.rightJustify?x:Math.max(cell,line.wrapX*sx-x);
   const rows=wrap(context,text,limit/stretch);
   rows.forEach((row,i)=>{
    const top=y+i*cell;
    context.save();context.translate(x,top);context.scale(stretch,1);
    context.textAlign=line.centred?'center':line.rightJustify?'right':'left';
    if(line.background){const w=context.measureText(row).width,left=line.centred?-w/2:line.rightJustify?-w:0;context.fillStyle=rgba(line.backgroundColour);context.fillRect(left-2,-2,w+4,cell+4);}
    if(line.textEdge>0){context.lineJoin='round';context.lineWidth=line.textEdge*2*sx/stretch;context.strokeStyle=rgba(line.dropShadowColour);context.strokeText(row,0,0);}
    else if(line.dropShadow>0){context.fillStyle=rgba(line.dropShadowColour);context.fillText(row,line.dropShadow*sx/stretch,line.dropShadow*sy);}
    context.fillStyle=rgba(line.colour);context.fillText(row,0,0);
    context.restore();
   });
  }
 }
}
/** Breaks the text at spaces so each row fits the width, and at ~n~'s newlines. */
function wrap(context:CanvasRenderingContext2D,text:string,width:number){
 const rows:string[]=[];
 for(const paragraph of text.split('\n')){
  let row='';
  for(const word of paragraph.split(' ')){const next=row?`${row} ${word}`:word;if(row&&context.measureText(next).width>width){rows.push(row);row=word;}else row=next;}
  rows.push(row);
 }
 return rows;
}
export class ScriptTextLayer{
 private readonly before=new Pass('script-text before-fade');
 private readonly after=new Pass('script-text after-fade');
 /** `beforeFade` goes where CHud::Draw's layer is (under the fade), the other over it. */
 constructor(beforeFade:HTMLElement,afterFade:HTMLElement){beforeFade.before(this.before.canvas);afterFade.after(this.after.canvas);}
 /** Once a frame: the lines and boxes the scripts left this frame, or none to clear both passes. */
 draw(frame:{lines:readonly ScmIntroTextLine[];count:number;rectangles:readonly ScmIntroRectangle[];rectangleCount:number}|undefined,resolve:Resolve,width:number,height:number,ratio=1){
  for(const [pass,beforeFade] of [[this.before,true],[this.after,false]] as const){
   const lines=frame?frame.lines.slice(0,frame.count).filter(l=>l.key&&l.drawBeforeFade===beforeFade).map(line=>({line,text:resolve(line.key,line.number1,line.number2)})):[];
   const rectangles=frame?frame.rectangles.slice(0,frame.rectangleCount).filter(r=>r.drawBeforeFade===beforeFade):[];
   pass.draw(lines,rectangles,width,height,ratio);
  }
 }
}
