import {HUD_COLOURS,HUD_COLOUR_RED,HUD_COLOUR_GREEN,HUD_COLOUR_DARK_BLUE,HUD_COLOUR_PURPLE,HUD_COLOUR_LIGHT_GRAY,HUD_COLOUR_CREAM,HUD_COLOUR_BLACK} from './nativeHudColours';
export type ScriptTextGlyph={character:string;colour:readonly number[]};
/** CFont::PrintString (PC 71A700) returns before background/layout for an empty or asterisk-led string. */
export function scriptTextSuppressed(text:string){return !text||text[0]==='\0'||text[0]==='*';}
const COLOURS:Readonly<Record<string,number>>={r:HUD_COLOUR_RED,g:HUD_COLOUR_GREEN,b:HUD_COLOUR_DARK_BLUE,p:HUD_COLOUR_PURPLE,s:HUD_COLOUR_LIGHT_GRAY,w:HUD_COLOUR_LIGHT_GRAY,y:HUD_COLOUR_CREAM,l:HUD_COLOUR_BLACK};
/** CFont::ParseToken (718F00): RGB changes preserve alpha; highlight multiplies each channel by 1.5 and truncates.
 * Controller symbols and full ProcessCurrentString state remain unmodelled. Malformed tokens stop safely. */
export function scriptTextGlyphs(text:string,initial:readonly number[]):ScriptTextGlyph[]{
 text=text.split('\0',1)[0];
 const glyphs:ScriptTextGlyph[]=[];let colour=initial;
 for(let at=0;at<text.length;){
  if(text[at]==='~'){
   const end=text.indexOf('~',at+1);if(end<0)break;
   const token=text[at+1],key=token.toLowerCase(),id=token==='L'?undefined:COLOURS[key];
   if(id!==undefined)colour=[...HUD_COLOURS[id],colour[3]];
   else if(key==='h')colour=[...colour.slice(0,3).map(c=>Math.min(255,Math.trunc(c*1.5))),colour[3]];
   else if(key==='n')glyphs.push({character:'\n',colour});
   at=end+1;continue;
  }
  const character=String.fromCodePoint(text.codePointAt(at)!);glyphs.push({character,colour});at+=character.length;
 }
 return glyphs;
}
