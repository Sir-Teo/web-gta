import {expect,test} from 'vitest';
import {ScmIntroText} from '../src/engine/ScmMessages';
import {scriptFontGlyph,nativeScriptTextWidth} from '../src/ui/nativeScriptTextWidth';
import {scriptGlyphCell,scriptRasterRows,scriptRasterWidth} from '../src/ui/NativeScriptFonts';
import {scriptFontLineHeight,scriptFontBackgroundBounds} from '../src/ui/nativeScriptFontLayout';
const line=()=>{const out=new ScmIntroText().pending;out.scale={x:1,y:2};out.textEdge=0;return out;};

test('the four script styles select the PC atlas cells containing their native glyphs',()=>{
 const glyphs=[0,1,2,3].map(font=>scriptFontGlyph('A',font));expect(glyphs.map(g=>[g.texture,g.index,g.width])).toEqual([[0,33,25],[1,33,22],[0,155,29],[1,155,19]]);
 expect(scriptGlyphCell(33)).toEqual({x:32,y:80,width:32,height:40});expect(scriptGlyphCell(155)).toEqual({x:352,y:360,width:32,height:40});expect(scriptGlyphCell(207)).toEqual({x:480,y:480,width:32,height:32});
});

test('glyph placement retains fractional advances while the script output truncates only the final width',()=>{
 const l=line();l.scale.x=.5;expect(scriptRasterWidth('A',l)).toBe(12.5);expect(nativeScriptTextWidth('A',l)).toBe(12);expect(scriptRasterWidth('AA',l)).toBe(25);expect(nativeScriptTextWidth('AA',l)).toBe(25);
 l.proportional=false;expect(scriptRasterWidth('AA',l)).toBe(27);l.textEdge=2;expect(scriptRasterWidth('AA',l)).toBe(29);
});

test('native advances determine word wrapping and explicit line breaks across font styles',()=>{
 const l=line();expect(scriptRasterRows('AA AA',l,111)).toEqual(['AA ','AA']);expect(scriptRasterRows('AA AA',l,112)).toEqual(['AA AA']);expect(scriptRasterRows('A\n\nA',l,100)).toEqual(['A','','A']);l.fontStyle=3;expect(scriptRasterWidth('AA AA',l)).toBe(91);expect(scriptRasterRows('AA AA',l,90)).toEqual(['AA ','AA']);expect(scriptRasterRows('AA AA',l,91)).toEqual(['AA AA']);
});

test('literal space runs retain their advances while native final-space termination omits the last row',()=>{
 const l=line();expect(scriptRasterWidth('A  A',l)).toBe(74);expect(nativeScriptTextWidth('A  A',l)).toBe(74);
 expect(scriptRasterRows('A  A',l,74)).toEqual(['A  A']);expect(scriptRasterRows('A  A',l,73)).toEqual(['A  ','A']);
 expect(scriptRasterRows('  A  \n  A',l,200)).toEqual(['  A  ','  A']);expect(scriptRasterRows('   ',l,200)).toEqual([]);
 expect(scriptRasterRows('A ~r~ A',l,74)).toEqual(['A  A']);
});

test('script line spacing follows the font’s 18-unit height after HUD scaling rather than its 20-unit glyph cell',()=>{
 expect(scriptFontLineHeight(2)).toBe(18);expect(scriptFontLineHeight(2,2)).toBe(36);expect(scriptFontLineHeight(1)).toBe(9);expect(scriptFontLineHeight(0)).toBe(0);
});

test('the PC text block background uses wrap/centre bounds, four-pixel padding and scaled line height',()=>{
 const l=line();Object.assign(l,{position:{x:100,y:40},wrapX:211,centreSize:112});
 expect(scriptFontBackgroundBounds(l,2)).toEqual({left:96,right:215,top:36,bottom:80});
 expect(scriptFontBackgroundBounds(l,2,2,2)).toEqual({left:196,right:426,top:76,bottom:156});
 l.centred=true;expect(scriptFontBackgroundBounds(l,2)).toEqual({left:40,right:160,top:36,bottom:80});
 l.centred=false;l.rightJustify=true;expect(scriptFontBackgroundBounds(l,2)).toEqual({left:-4,right:100,top:36,bottom:80});
});
