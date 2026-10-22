import type {ScmIntroTextLine} from '../engine/ScmMessages';
import {scriptGlyphAdvance} from './nativeScriptTextWidth';
import {NATIVE_FONT_METRICS} from './nativeFontMetrics';
import {scriptTextGlyphs,type ScriptTextGlyph} from './nativeScriptTextTokens';
/** CFont::GetHeight and iOS ProcessCurrentString (10037d6f0): (32 / 2 + 2) times font Y scale.
 * CHud::DrawScriptText halves the script's Y scale before screen stretching. Glyph quads remain 20 units tall. */
export function scriptFontLineHeight(scriptScaleY:number,screenScaleY=1){
 const f=Math.fround,scale=f(f(f(scriptScaleY)*.5)*f(screenScaleY));
 return f(f(scale+scale)+f(f(scale*32)*.5));
}

/** PC CFont::GetTextRect (71A620), with the renderer's row count. Right-wrap uses CFont's initialized zero.
 * Native DrawScriptText does not set that global; interactions with other HUD font users remain separate work. */
export function scriptFontBackgroundBounds(line:ScmIntroTextLine,rows:number,sx=1,sy=1){
 const f=Math.fround,x=f(f(line.position.x)*f(sx)),y=f(f(line.position.y)*f(sy));let left:number,right:number;
 if(line.centred){const half=f(f(f(line.centreSize)*f(sx))*.5),extent=f(half+4);left=f(x-extent);right=f(x+extent);}
 else if(line.rightJustify){left=-4;right=x;}
 else{left=f(x-4);right=f(f(f(line.wrapX)*f(sx))+4);}
 return {left,right,top:f(y-4),bottom:f(f(y+4)+f(scriptFontLineHeight(line.scale.y,sy)*rows))};
}

export function scriptFontAdvance(char:string,line:ScmIntroTextLine){try{return scriptGlyphAdvance(char,line);}catch{return Math.fround(line.scale.x*(line.proportional?NATIVE_FONT_METRICS[line.fontStyle===1||line.fontStyle===3?1:0].space:NATIVE_FONT_METRICS[line.fontStyle===1||line.fontStyle===3?1:0].unproportional));}}
function glyphWidth(glyphs:readonly ScriptTextGlyph[],line:ScmIntroTextLine){let width=0;for(const g of glyphs)if(g.character!=='\n')width=Math.fround(width+scriptFontAdvance(g.character,line));return width;}
export function scriptRasterWidth(text:string,line:ScmIntroTextLine){return glyphWidth(scriptTextGlyphs(text,line.colour),line);}
type FontRow={glyphs:ScriptTextGlyph[];wrapped:boolean};
// ProcessCurrentString 10037d4bc..10037d4e0: bits for character minus 0x21 in 0x0800000042006809.
const NO_BREAK_PREFIX=new Set(['!','$',',','.','/',':','?','\\']);
/** The ordinary space-delimited branch of iOS ProcessCurrentString. Token-directed line breaks and non-PC
 * language/punctuation state remain partial; explicit newlines retain the browser's existing paragraph behavior. */
function styledRows(text:string,line:ScmIntroTextLine,limit:number){
 const rows:FontRow[]=[];let row:ScriptTextGlyph[]=[],word:ScriptTextGlyph[]=[],first=true,lastNewline=false;
 const flushWord=()=>{
  const next=[...row,...word];
  if(!first&&glyphWidth(next,line)>limit&&!NO_BREAK_PREFIX.has(word[0]?.character)){rows.push({glyphs:row,wrapped:true});row=word;}else row=next;
  word=[];
 };
 for(const glyph of scriptTextGlyphs(text,line.colour)){
  lastNewline=glyph.character==='\n';
  if(lastNewline){flushWord();rows.push({glyphs:row,wrapped:false});row=[];first=true;}
  else if(glyph.character===' '){flushWord();row.push(glyph);first=false;}
  else word.push(glyph);
 }
 // Native reaches the render call when GetNextSpace finds the terminator after a word. A trailing space instead
 // advances directly to the terminator and leaves the final row un-emitted.
 if(word.length){flushWord();rows.push({glyphs:row,wrapped:false});}
 else if(lastNewline)rows.push({glyphs:[],wrapped:false});
 return rows;
}
export function scriptRasterRows(text:string,line:ScmIntroTextLine,limit:number){return styledRows(text,line,limit).map(row=>row.glyphs.map(g=>g.character).join(''));}
export function scriptRasterLayout(text:string,line:ScmIntroTextLine,limit=line.centred?line.centreSize:line.rightJustify?line.position.x:Math.max(1,line.wrapX-line.position.x)){
 const f=Math.fround,space=scriptFontAdvance(' ',line);
 return styledRows(text,line,limit).map(({glyphs,wrapped},index)=>{
  const width=glyphWidth(glyphs,line),spaces=glyphs.filter(g=>g.character===' ').length,base=line.position.x;
  const x=f(base-(line.centred?f(width*.5):line.rightJustify?f(width-(wrapped?space:0)):0));
  const used=line.rightJustify?width:f(base+width),extra=wrapped&&line.justify&&!line.centred&&spaces>1?f(f(line.wrapX-used)/(spaces-1)):0;
  return {glyphs,x,y:f(line.position.y+f(index*scriptFontLineHeight(line.scale.y))),extra};
 });
}
