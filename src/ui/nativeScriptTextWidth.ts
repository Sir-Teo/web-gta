import {requireAsset} from '../assets/binary';
import {gxtFontCode} from '../assets/gxt';
import type {ScmIntroTextLine} from '../engine/ScmMessages';
import {NATIVE_FONT_METRICS} from './nativeFontMetrics';
const PRICEDOWN_GLYPHS:Readonly<Record<number,number>>={1:208,4:93,7:206,8:94,9:95,14:207,26:154};
/** iOS FindSubFontCharacter 0x10037b49c. The menu ampersand and underscore differ from the PC reference reversal. */
export function scriptSubFontCharacter(id:number,style:1|2){
 if(style===1&&PRICEDOWN_GLYPHS[id]!==undefined)return PRICEDOWN_GLYPHS[id];
 if(id===6)return style===2?206:10;
 if(id===31)return 91;
 if(id===62)return style===1?32:62;
 if(id===143)return 205;
 if(id>=16&&id<=25)return id+128;
 if(id>=33&&id<=58)return id+122;
 if(id>=65&&id<=90)return id+90;
 if(id>=96&&id<=118)return id+85;
 if(id>=119&&id<=140)return id+62;
 if(id>=141&&id<=142)return 204;
 return id;
}
type ScriptFont=Pick<ScmIntroTextLine,'scale'|'fontStyle'|'proportional'|'textEdge'>;
/** Font texture/glyph selected by the native script-font path, before spacing/outline/scale are applied. */
export function scriptFontGlyph(character:string,font:number){
 requireAsset(Number.isInteger(font)&&font>=0&&font<=3,'Unsupported script font style');
 const texture=font===2?0:font===3?1:font,metrics=NATIVE_FONT_METRICS[texture];let id=(gxtFontCode(character)-32)&0xffff;if(id===63)id=0;
 if(font===2||font===3)id=scriptSubFontCharacter(id,font===2?2:1);
 else if(id===145)id=64;else if(id>155)id=0;
 const width=id===208?metrics.space:id===209?metrics.unproportional:metrics.widths[id];requireAsset(width!==undefined,'Unsupported native font glyph');
 return {texture,index:id,width};
}
export function scriptGlyphAdvance(character:string,line:ScriptFont){const font=line.fontStyle,texture=font===2?0:font===3?1:font;requireAsset(Number.isInteger(font)&&font>=0&&font<=3,'Unsupported script font style');const width=line.proportional?scriptFontGlyph(character,font).width:NATIVE_FONT_METRICS[texture].unproportional;return Math.fround(Math.fround(line.scale.x)*Math.fround(width+((line.textEdge<<24)>>24)));}
/** GetStringWidth(full=true, scriptText=true): pending intro-line metrics, float32 advances and final signed int.
 * The PC atlas renderer shares these metrics; control-icon global scale and non-PC languages remain separate work. */
export function nativeScriptTextWidth(text:string,line:ScriptFont,iconWidth?:number){
 requireAsset(Number.isInteger(line.fontStyle)&&line.fontStyle>=0&&line.fontStyle<=3,'Unsupported script font style');
 const f=Math.fround;
 let sum=0;const chars=Array.from(text.split('\0',1)[0].slice(0,399));
 for(let i=0;i<chars.length;i++){
  const char=chars[i];
  if(char==='~'){
   const start=i,end=chars.indexOf('~',i+1);if(end<0)break;i=end;
   if(chars[start+1]==='m'){requireAsset(iconWidth!==undefined&&Number.isFinite(iconWidth),'Native control-icon scale is unavailable');sum=f(sum+f(iconWidth));}
   continue;
  }
  sum=f(sum+scriptGlyphAdvance(char,line));
 }
 return Number.isNaN(sum)?0:Math.max(-2147483648,Math.min(2147483647,Math.trunc(sum)));
}
