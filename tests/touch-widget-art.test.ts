import {describe,expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {GL,elementSize,levelBytes,levelCount,runLengthDecode,toRgba} from '../scripts/content/mobileTextureDatabase.mjs';
import {TOUCH_WIDGET_ATLAS,TOUCH_WIDGET_CELLS} from '../src/input/touchWidgetArt';
import {enterWidgetArt} from '../src/input/TouchControls';

describe('the iOS port’s texture database',()=>{
 test('a run is [marker][count][element], anything else an element as it is',()=>{
  // Element size 4: a run of two copies, a literal, then a run of one.
  const src=new Uint8Array([0x11,2,1,2,3,4, 9,8,7,6, 0x11,1,5,5,5,5]);
  const {bytes,end}=runLengthDecode(src,0,16,4,0x11);
  expect([...bytes]).toEqual([1,2,3,4,1,2,3,4,9,8,7,6,5,5,5,5]);expect(end).toBe(src.length);
 });
 test('the 16-bit types decode two pixels an element, through a mip chain to 2 by 2 of width and height together',()=>{
  expect(elementSize(GL.rgba4444)).toBe(4);expect(elementSize(GL.rgb565)).toBe(4);expect(elementSize(0x83f0)).toBe(8);expect(elementSize(0x83f2)).toBe(16);
  expect(levelCount(256,256,true)).toBe(9);expect(levelCount(256,256,false)).toBe(1);expect(levelCount(64,32,true)).toBe(7);
  expect(levelBytes(256,256,GL.rgba4444,0)).toBe(131072);expect(levelBytes(256,256,GL.rgba4444,8)).toBe(2);expect(levelBytes(4,2,GL.rgb565,2)).toBe(2);
 });
 test('GL_UNSIGNED_SHORT_4_4_4_4 keeps red in the high nibble',()=>{
  const pixel=new Uint8Array([0x2c,0x88]);// 0x882c: red 8, green 8, blue 2, alpha 12
  expect([...toRgba(GL.rgba4444,1,1,pixel)]).toEqual([136,136,34,204]);
  expect([...toRgba(GL.rgb565,1,1,new Uint8Array([0x1f,0xf8]))]).toEqual([255,0,255,255]);
 });
});

describe('the published widget atlas',()=>{
 const png=readFileSync(`public/${TOUCH_WIDGET_ATLAS.path}`);
 test('is the one the module names, a cell per widget',()=>{
  expect(png.length).toBe(TOUCH_WIDGET_ATLAS.bytes);
  expect(createHash('sha256').update(png).digest('hex')).toBe(TOUCH_WIDGET_ATLAS.sha256);
  expect(png.readUInt32BE(16)).toBe(TOUCH_WIDGET_ATLAS.columns*TOUCH_WIDGET_ATLAS.cell);expect(png.readUInt32BE(20)).toBe(TOUCH_WIDGET_ATLAS.rows*TOUCH_WIDGET_ATLAS.cell);
  const cells=Object.values(TOUCH_WIDGET_CELLS);
  expect(new Set(cells).size).toBe(cells.length);expect(Math.max(...cells)).toBeLessThan(TOUCH_WIDGET_ATLAS.columns*TOUCH_WIDGET_ATLAS.rows);
 });
 test('the service worker keeps it with the game page',()=>{
  expect(readFileSync('vite.config.ts','utf8')).toContain(`'${TOUCH_WIDGET_ATLAS.path}'`);
 });
});

describe('the enter widget’s vehicle',()=>{
 const car={type:'car',modelId:400};
 test('a vehicle beside the player or under him shows its kind',()=>{
  expect(enterWidgetArt(car,true,false)).toBe('hud_car');
  expect(enterWidgetArt({type:'bike',modelId:522},true,false)).toBe('hud_bike');expect(enterWidgetArt({type:'quad',modelId:471},false,false)).toBe('hud_bike');
  expect(enterWidgetArt({type:'bmx',modelId:481},true,false)).toBe('hud_bicycle');expect(enterWidgetArt({type:'heli',modelId:487},true,false)).toBe('hud_chopper');
  expect(enterWidgetArt({type:'plane',modelId:513},false,false)).toBe('hud_plane');expect(enterWidgetArt({type:'boat',modelId:452},true,false)).toBe('hud_boat');
  expect(enterWidgetArt({type:'mtruck',modelId:444},true,false)).toBe('hud_monstertruck');expect(enterWidgetArt({type:'train',modelId:537},true,false)).toBe('hud_train');
  expect(enterWidgetArt({type:'trailer',modelId:435},true,false)).toBe('hud_trailer');
 });
 test('the Vortex is a boat, a car with hydraulics its own to enter, and a jetpack the drop',()=>{
  expect(enterWidgetArt({type:'car',modelId:539},true,false)).toBe('hud_boat');
  expect(enterWidgetArt({...car,hydraulics:true},true,false)).toBe('hydraulicCar');expect(enterWidgetArt({...car,hydraulics:true},false,false)).toBe('hud_car');
  expect(enterWidgetArt(undefined,false,true)).toBe('hud_drop_jetpack');expect(enterWidgetArt(undefined,false,false)).toBe('hud_car');
 });
});
