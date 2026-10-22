import type {ScmIntroRectangle,ScmIntroTextLine,ScmSpriteBinding} from '../engine/ScmMessages';
import {RECT_MONOCOLOR,RECT_TEXT} from '../engine/ScmMessages';
import type {NativeScriptFonts} from './NativeScriptFonts';
import {NativeScriptFontLoader} from './NativeScriptFontLoader';
import type {NativeScriptSprites} from './NativeScriptSprites';
import {scriptTextSuppressed} from './nativeScriptTextTokens';
import {scriptFontLineHeight,scriptFontBackgroundBounds,scriptRasterLayout,scriptFontAdvance} from './nativeScriptFontLayout';
import {scriptWindowHeaderLine} from './nativeScriptWindow';
/* CHud::DrawScriptText: the script's DISPLAY_TEXT lines and DRAW_RECT boxes for the frame, in two passes. CHud::Draw
 * draws the ones marked SET_TEXT_DRAW_BEFORE_FADE (and SET_SPRITES_DRAW_BEFORE_FADE) under the screen fade; DoFade
 * covers them; CHud::DrawAfterFade draws the rest over it, which is how INTRO's title cards ("Francis INTL. Airport,
 * Liberty City, 1992.") show on the black screen. Neither pass draws while a STYLE_MIDDLE big message is up, and the
 * user pause stops both.
 *
 * CFont draws a glyph cell 20 x m_fHeight tall and its proportional width x m_fWidth wide, with m_fHeight the line's
 * y scale halved and both stretched from the 640x448 design space to the screen (SCREEN_SCALE_X, SCREEN_SCALE_Y). The
 * PC atlas renderer uses the native glyph masks and proportional advances. A web font is retained while the
 * atlas resource is unavailable; native UV insets, filtering and full token semantics remain unverified.
 * Textured sprites use the packaged PC dictionary bound by LOAD_SPRITE. */
/** CFont's font styles: FONT_GOTHIC, FONT_SUBTITLES, FONT_MENU, FONT_PRICEDOWN. */
const FONTS=['700 {px}px Unifraktur,Georgia,serif','700 {px}px Arial,Helvetica,sans-serif','900 {px}px \'Arial Black\',Arial,sans-serif','400 {px}px Impact,\'Arial Narrow\',sans-serif'];
/** An average glyph's proportional width in CFont's 32-unit cells over the web font's advance per em. */
const WIDTH_RATIO=14/.6;
type Resolve=(key:string,number1:number,number2:number)=>string;
const rgba=(c:readonly number[])=>`rgba(${c[0]},${c[1]},${c[2]},${(c[3]/255).toFixed(3)})`;
class Pass{
 readonly canvas=document.createElement('canvas');
 private readonly context=this.canvas.getContext('2d');
 private shown:string|undefined='';
 constructor(className:string){this.canvas.className=className;this.canvas.setAttribute('aria-hidden','true');this.canvas.hidden=true;}
 invalidate(){this.shown=undefined;}
 dispose(){this.canvas.remove();this.canvas.width=this.canvas.height=1;}
 draw(lines:readonly {line:ScmIntroTextLine;text:string}[],rectangles:readonly ScmIntroRectangle[],width:number,height:number,ratio:number,fonts?:NativeScriptFonts,sprites?:NativeScriptSprites,headers:readonly string[]=[]){
  const signature=lines.length||rectangles.length?`${width}x${height}@${ratio}|${sprites?.revision??0}|${JSON.stringify(rectangles)}|${JSON.stringify(headers)}|${JSON.stringify(lines)}`:'';
  if(signature===this.shown)return;
  this.shown=signature;this.canvas.hidden=!signature;
  const context=this.context;if(!signature||!context)return;
  const pixelWidth=Math.max(1,Math.round(width*ratio)),pixelHeight=Math.max(1,Math.round(height*ratio));
  if(this.canvas.width!==pixelWidth||this.canvas.height!==pixelHeight){this.canvas.width=pixelWidth;this.canvas.height=pixelHeight;}
  context.setTransform(ratio,0,0,ratio,0,0);context.clearRect(0,0,width,height);
  const sx=width/640,sy=height/448;
  for(const [index,r] of rectangles.entries()){
   if(sprites?.draw(context,r,sx,sy))continue;
   if(r.type!==RECT_MONOCOLOR&&r.type!==RECT_TEXT)continue;
   // The runtime keeps the corners in the 640x448 design space.
   context.fillStyle=rgba(r.colour);
   context.fillRect(Math.min(r.cornerA.x,r.cornerB.x)*sx,Math.min(r.cornerA.y,r.cornerB.y)*sy,Math.abs(r.cornerB.x-r.cornerA.x)*sx,Math.abs(r.cornerB.y-r.cornerA.y)*sy);
   if(r.type===RECT_TEXT&&headers[index])this.drawText(context,scriptWindowHeaderLine(r),headers[index],sx,sy,fonts);
  }
  for(const {line,text} of lines)this.drawText(context,line,text,sx,sy,fonts);
 }
 private drawText(context:CanvasRenderingContext2D,line:ScmIntroTextLine,text:string,sx:number,sy:number,fonts?:NativeScriptFonts){
   if(scriptTextSuppressed(text))return;
   if(fonts?.draw(context,line,text,sx,sy))return;
   const cell=10*line.scale.y*sy;if(!(cell>0)||!text)return;
   const stretch=Math.min(3,Math.max(.25,WIDTH_RATIO*line.scale.x*sx/cell));
   context.font=(FONTS[line.fontStyle]??FONTS[1]).replace('{px}',cell.toFixed(2));context.textBaseline='top';
   const y=line.position.y*sy,rows=scriptRasterLayout(text,line);
   if(line.background){const b=scriptFontBackgroundBounds(line,rows.length,sx,sy);context.fillStyle=rgba(line.backgroundColour);context.fillRect(b.left,b.top,b.right-b.left,b.bottom-b.top);}
   rows.forEach((row,i)=>{
    const top=y+i*scriptFontLineHeight(line.scale.y,sy);
    context.save();context.translate(row.x*sx,top);context.scale(stretch,1);context.textAlign='left';
    let pen=0;for(const {character,colour} of row.glyphs){
     const at=pen*sx/stretch;
     if(line.textEdge>0){context.lineJoin='round';context.lineWidth=line.textEdge*2*sx/stretch;context.strokeStyle=rgba(line.dropShadowColour);context.strokeText(character,at,0);}
     else if(line.dropShadow>0){context.fillStyle=rgba(line.dropShadowColour);context.fillText(character,at+line.dropShadow*sx/stretch,line.dropShadow*sy);}
     context.fillStyle=rgba(colour);context.fillText(character,at,0);pen=Math.fround(pen+scriptFontAdvance(character,line));if(character===' ')pen=Math.fround(pen+row.extra);
    }
    context.restore();
   });
 }
}
export class ScriptTextLayer{
 private fonts?:NativeScriptFonts;
 private fontLoader?:NativeScriptFontLoader;private disposed=false;
 private sprites?:NativeScriptSprites;
 get spritesReady(){return !!this.sprites;}
 get spriteState(){return this.sprites?.state();}
 setSprites(sprites:NativeScriptSprites){if(this.sprites!==sprites)this.sprites?.dispose();this.sprites=sprites;this.before.invalidate();this.after.invalidate();}
 get nativeFontsReady(){return !!this.fonts;}
 get fontState(){return this.fontLoader?.state()??{pending:false,retrying:false,error:null};}
 /** The layer cancels retries on replacement/teardown; fallback text remains until the atlas arrives. */
 loadFonts(load:()=>Promise<NativeScriptFonts>){if(this.disposed)return;this.fontLoader?.dispose();this.fontLoader=new NativeScriptFontLoader(load,fonts=>this.installFonts(fonts));}
 setFonts(fonts:NativeScriptFonts){this.fontLoader?.dispose();this.fontLoader=undefined;this.installFonts(fonts);}
 private installFonts(fonts:NativeScriptFonts){if(this.disposed){fonts.dispose();return;}if(this.fonts!==fonts)this.fonts?.dispose();this.fonts=fonts;this.before.invalidate();this.after.invalidate();}
 private readonly before=new Pass('script-text before-fade');
 private readonly after=new Pass('script-text after-fade');
 /** `beforeFade` goes where CHud::Draw's layer is (under the fade), the other over it. */
 constructor(beforeFade:HTMLElement,afterFade:HTMLElement){beforeFade.before(this.before.canvas);afterFade.after(this.after.canvas);}
 /** Once a frame: the lines and boxes the scripts left this frame, or none to clear both passes. */
 draw(frame:{lines:readonly ScmIntroTextLine[];count:number;rectangles:readonly ScmIntroRectangle[];rectangleCount:number;sprites?:readonly (ScmSpriteBinding|undefined)[]}|undefined,resolve:Resolve,width:number,height:number,ratio=1){
  if(frame?.sprites)this.sprites?.setBindings(frame.sprites);
  for(const [pass,beforeFade] of [[this.before,true],[this.after,false]] as const){
   const lines=frame?frame.lines.slice(0,frame.count).filter(l=>l.key&&l.drawBeforeFade===beforeFade).map(line=>({line,text:resolve(line.key,line.number1,line.number2)})):[];
   const rectangles=frame?frame.rectangles.slice(0,frame.rectangleCount).filter(r=>r.drawBeforeFade===beforeFade):[];
   const headers=rectangles.map(r=>r.type===RECT_TEXT&&r.header?resolve(r.header,-1,-1):'');
   pass.draw(lines,rectangles,width,height,ratio,this.fonts,this.sprites,headers);
  }
 }
 dispose(){if(this.disposed)return;this.disposed=true;this.fontLoader?.dispose();this.fontLoader=undefined;this.before.dispose();this.after.dispose();this.fonts?.dispose();this.fonts=undefined;this.sprites?.dispose();this.sprites=undefined;}
}
