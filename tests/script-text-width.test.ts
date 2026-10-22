import {readFileSync} from 'node:fs';
import {afterEach,beforeAll,expect,test,vi} from 'vitest';
import {nativeScriptTextWidth,scriptSubFontCharacter} from '../src/ui/nativeScriptTextWidth';
import {ScmMission} from '../src/simulation/ScmMission';
import {decodeScmInstructions,readScmHeader} from '../src/assets/scm';
import {gxtCharsToText,gxtControlKeyText,gxtFontCode,loadNativeText,setControlNaming,useTouchControlNames} from '../src/assets/gxt';
vi.mock('../src/assets/staticWorldArchive',()=>({openStaticWorld:async()=>({manifest:{resources:[{path:'text/american.gxt'}]},resource:async()=>({arrayBuffer:async()=>new Uint8Array(readFileSync('public/play/world/files/text/american.gxt')).buffer})})}));
const style=(extra:Record<string,unknown>={})=>({scale:{x:.5,y:1},fontStyle:0,proportional:true,textEdge:0,...extra});
const bytes=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm')),header=readScmHeader(bytes);
let text:Awaited<ReturnType<typeof loadNativeText>>;beforeAll(async()=>{text=await loadNativeText('/play/world/');});afterEach(()=>{useTouchControlNames(false);setControlNaming({keys:true,pad:undefined});});

test('native font widths include spaces, signed outline bytes, fixed spacing and final truncation',()=>{
 expect(nativeScriptTextWidth('A 1',style())).toBe(25);expect(nativeScriptTextWidth('A 1',style({textEdge:2}))).toBe(28);expect(nativeScriptTextWidth('A 1',style({textEdge:255}))).toBe(24);
 expect(nativeScriptTextWidth('A 1',style({proportional:false,textEdge:2}))).toBe(43);expect(nativeScriptTextWidth('~r~A~n~ 1~w~',style())).toBe(25);
 expect(nativeScriptTextWidth('A\0MMMM',style())).toBe(12);expect(nativeScriptTextWidth('A'.repeat(450),style())).toBe(4987);
});

test('all four script font styles use their native texture and subfont glyphs',()=>{
 expect([0,1,2,3].map(fontStyle=>nativeScriptTextWidth('A',style({fontStyle,scale:{x:1,y:1}})))).toEqual([25,22,29,19]);
 expect(scriptSubFontCharacter(6,2)).toBe(206);expect(scriptSubFontCharacter(62,2)).toBe(62);expect(scriptSubFontCharacter(62,1)).toBe(32);expect(scriptSubFontCharacter(1,1)).toBe(208);
 expect(nativeScriptTextWidth('!',style({fontStyle:3,scale:{x:1,y:1}}))).toBe(10);
});

test('decoded GXT accents and remapped ASCII recover their native glyph indices',()=>{
 const codes=[0x80,0x81,0x8e,0xad,0xae,0xb1,0x5b,0x5d,0x5e];expect(Array.from(gxtCharsToText(new Uint8Array(codes)),gxtFontCode)).toEqual(codes);
 expect(nativeScriptTextWidth('Á',style({scale:{x:1,y:1}}))).toBe(25);expect(nativeScriptTextWidth('´',style({scale:{x:1,y:1}}))).toBe(10);
});

test('control names retain colour tags for measurement and use the active input vocabulary',()=>{
 const raw='~r~~k~~PED_SPRINT~ Select';expect(gxtControlKeyText(raw)).toBe('~r~SHIFT Select');expect(nativeScriptTextWidth(gxtControlKeyText(raw),style())).toBe(92);
 setControlNaming({keys:false});useTouchControlNames(true);expect(gxtControlKeyText(raw)).toBe('~r~SPRINT Select');expect(nativeScriptTextWidth(gxtControlKeyText(raw),style())).not.toBe(92);
 expect(()=>nativeScriptTextWidth('~m~',style())).toThrow('control-icon scale');expect(nativeScriptTextWidth('~m~A',style(),20)).toBe(32);
});

function execute(m:ScmMission,site:ReturnType<typeof decodeScmInstructions>[number],number?:number){
 const code=new Uint8Array(site.end-site.offset+2);code.set(bytes.subarray(site.offset,site.end));code.set([0x4e,0],site.end-site.offset);const slot=m.runtime.start(0,[],{space:code,mission:true});slot.thread.usesMissionCleanup=false;if(number!==undefined)slot.thread.locals.setInt32(39*4,number,true);slot.thread.run(1000,100,1);return slot.thread.locals.getInt32((site.parameters.at(-1)!.value as number)*4,true);
}
test('OTB’s three original control-label width instructions write native integers instead of skipped zero outputs',()=>{
 text.loadMissionText('OTB');const m=new ScmMission(bytes,{infoLabels:['TEST'],population:[]} as any,{} as any);Object.assign(m.runtime.game.introText.pending,style());const block=header.missions[7],sites=decodeScmInstructions(bytes,block.start,block.end).filter(i=>i.opcode===0x9fd);
 expect(sites).toHaveLength(3);expect(sites.map(i=>execute(m,i))).toEqual([92,43,44]);expect(m.snapshot().skipped).toEqual([]);expect(m.snapshot().gaveUp).toEqual([]);
});

test('POOL2’s original number-width query inserts its local number before measuring the comma string',()=>{
 text.loadMissionText('POOL');const m=new ScmMission(bytes,{infoLabels:['TEST'],population:[]} as any,{} as any);Object.assign(m.runtime.game.introText.pending,style());const block=header.missions[8],site=decodeScmInstructions(bytes,block.start,block.end).find(i=>i.opcode===0xa08)!;
 expect(execute(m,site,1234)).toBe(63);expect(execute(m,site,-12)).toBe(41);expect(m.runtime.world!.getStringWidth!('NO_TEXT')).toBe(0);expect(m.snapshot().skipped).toEqual([]);expect(m.snapshot().gaveUp).toEqual([]);
});
