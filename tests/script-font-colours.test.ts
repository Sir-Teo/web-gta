import {expect,test} from 'vitest';
import {scriptTextGlyphs,scriptTextSuppressed} from '../src/ui/nativeScriptTextTokens';
import {scriptRasterRows,scriptRasterWidth} from '../src/ui/NativeScriptFonts';
import {ScmIntroText} from '../src/engine/ScmMessages';
import {gxtHudText,controlsNamedIn,setControlNaming,useTouchControlNames} from '../src/assets/gxt';

test('CFont color tokens select the native HUD palette, preserve alpha and accept their native cases',()=>{
 const glyphs=scriptTextGlyphs('A~r~B~G~C~b~D~p~E~y~F~w~G~s~H~l~I~L~J',[1,2,3,93]);
 expect(glyphs.map(g=>g.colour)).toEqual([[1,2,3,93],[180,25,29,93],[54,104,44,93],[50,60,127,93],[168,110,252,93],[226,192,99,93],[225,225,225,93],[225,225,225,93],[0,0,0,93],[0,0,0,93]]);
});

test('highlights compound with truncated saturated RGB and normal tags select light gray rather than resetting the initial color',()=>{
 const initial=[101,171,3,128],glyphs=scriptTextGlyphs('~h~A~H~B~s~C',initial);expect(glyphs.map(g=>g.colour)).toEqual([[151,255,4,128],[226,255,6,128],[225,225,225,128]]);expect(initial).toEqual([101,171,3,128]);
});

test('formatting has no glyph advance and color changes survive explicit and wrapped line breaks',()=>{
 const l=new ScmIntroText().pending;l.scale={x:1,y:2};l.textEdge=0;expect(scriptRasterWidth('A~r~A',l)).toBe(50);expect(scriptRasterRows('~r~AA ~h~AA~n~~g~A',l,111)).toEqual(['AA ','AA','A']);
 const g=scriptTextGlyphs('~r~A~N~B',[0,0,0,1]);expect(g.map(g=>g.character)).toEqual(['A','\n','B']);expect(g.every(g=>g.colour.join(',')==='180,25,29,1')).toBe(true);
});

test('script resolution retains color tokens and control discovery while ordinary HUD text stays plain',()=>{
 useTouchControlNames(false);setControlNaming({keys:true,pad:undefined});const text='~r~Press ~k~~PED_SPRINT~~h~ now~n~~w~Done';
 const script=gxtHudText(text,true),plain=gxtHudText(text);expect(script).toBe('~r~Press SHIFT~h~ now\n~w~Done');expect(plain).toBe('Press SHIFT now\nDone');expect(controlsNamedIn(script)).toEqual(['PED_SPRINT']);expect(controlsNamedIn(plain)).toEqual(['PED_SPRINT']);
 expect(scriptTextGlyphs('A~z~B~a~C~r',[255,255,255,255]).map(g=>g.character).join('')).toBe('ABC');
});

test('native string sentinels apply before token parsing, while embedded NUL terminates glyphs',()=>{
 for(const text of ['', '\0A','*A'])expect(scriptTextSuppressed(text)).toBe(true);
 for(const text of ['A*','~r~*A',' *A'])expect(scriptTextSuppressed(text)).toBe(false);
 expect(scriptTextGlyphs('A\0~r~B',[1,2,3,4])).toEqual([{character:'A',colour:[1,2,3,4]}]);
 expect(scriptTextGlyphs('A~r\0~B',[1,2,3,4])).toEqual([{character:'A',colour:[1,2,3,4]}]);
});
