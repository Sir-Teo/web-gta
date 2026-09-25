import {describe,expect,test} from 'vitest';
import {ScmMenus,MENU_TYPE_DEFAULT,MENU_TYPE_GRID,MENU_UNDEFINED} from '../src/engine/ScmMenus';
import {emptyPadState,type ScmPadState} from '../src/engine/ScmPads';

/* CMenuSystem's input and bookkeeping (gta-reversed MenuSystem.cpp). */
const pad=(set:Partial<ScmPadState>={})=>({...emptyPadState(),...set});
function menuWith(titles:(string|undefined)[]){
 const menus=new ScmMenus(),id=menus.create(MENU_TYPE_DEFAULT,'T',29,170,180,1,true,true,1);
 menus.insertMenu(id,0,undefined,titles);
 return {menus,id};
}
/** One frame with the stick held, then one at rest, as a player's tap. */
function tap(menus:ScmMenus,set:Partial<ScmPadState>){menus.process(pad(set));menus.process(pad());}

describe('CMenuSystem',()=>{
 test('the stick walks the highlight over blank and unchoosable rows, and wraps at each end',()=>{
  const {menus,id}=menuWith(['A','B','C','D']);
  menus.activateOneItem(id,1,false);
  expect(menus.checkForSelected(id)).toBe(0);
  tap(menus,{leftStickY:100});expect(menus.checkForSelected(id)).toBe(2);
  tap(menus,{leftStickY:100});expect(menus.checkForSelected(id)).toBe(3);
  tap(menus,{leftStickY:100});expect(menus.checkForSelected(id)).toBe(0);
  tap(menus,{leftStickY:-100});expect(menus.checkForSelected(id)).toBe(3);
 });

 test('a held stick moves the highlight once; the d-pad moves it on each press',()=>{
  const {menus,id}=menuWith(['A','B','C']);
  for(let i=0;i<5;i++)menus.process(pad({leftStickY:100}));
  expect(menus.checkForSelected(id)).toBe(1);
  menus.process(pad());
  tap(menus,{dpadDown:255});tap(menus,{dpadDown:255});
  expect(menus.checkForSelected(id)).toBe(0);
 });

 test('cross accepts a choosable row for as long as it stays highlighted',()=>{
  const {menus,id}=menuWith(['A','B']);
  const sounds:string[]=[];menus.onSound=sound=>{sounds.push(sound);};
  menus.process(pad({cross:255}));
  expect(menus.checkForAccept(id)).toBe(0);
  menus.process(pad({cross:255}));
  expect(menus.checkForAccept(id)).toBe(0);
  tap(menus,{leftStickY:100});
  expect(menus.checkForAccept(id)).toBe(MENU_UNDEFINED);
  menus.activateOneItem(id,1,false);
  tap(menus,{cross:255});
  expect(sounds).toEqual(['select','highlight','select']);
 });

 test('ids follow the count in use, and switching one off leaves the current menu the first still up',()=>{
  const menus=new ScmMenus();
  expect(menus.create(MENU_TYPE_DEFAULT,undefined,0,0,100,1,true,false,0)).toBe(0);
  expect(menus.create(MENU_TYPE_DEFAULT,undefined,0,0,100,1,false,false,0)).toBe(1);
  expect(()=>menus.create(MENU_TYPE_DEFAULT,undefined,0,0,100,1,true,false,0)).toThrow(/Both/);
  menus.switchOff(0);
  expect([menus.numInUse,menus.currentMenuInUse,menus.checkForSelected(0)]).toEqual([1,1,MENU_UNDEFINED]);
 });

 test('a number rides in its cell, and a whole column clears them',()=>{
  const {menus,id}=menuWith(['A']);
  menus.insertOneMenuItemWithNumber(id,1,0,'PRICE',50,-1);
  expect(menus.menus[id]!.numbers[1][0]).toBe(50);
  menus.insertMenu(id,2,undefined,[]);
  expect(menus.menus[id]!.numbers[1][0]).toBe(-1);
 });

 test('a grid moves by columns and rows and reads its colours',()=>{
  const menus=new ScmMenus();menus.carColours=()=>Array.from({length:64},(_,i)=>i+100);
  const id=menus.create(MENU_TYPE_GRID,undefined,0,0,20,4,true,true,0);
  expect(menus.menus[id]!.numRows).toBe(16);
  tap(menus,{leftStickY:100});tap(menus,{leftStickX:100});
  expect(menus.checkForSelected(id)).toBe(5);
  expect(menus.getCarColourFromGrid(id,5)).toBe(105);
 });
});
