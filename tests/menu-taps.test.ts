import {expect,test} from 'vitest';
import {MENU_TYPE_DEFAULT,MENU_TYPE_GRID,ScmMenus} from '../src/engine/ScmMenus';
import {layoutMenu,menuItemAt} from '../src/ui/nativeHudMenus';
/** A touch screen's tap on a script menu finds the line layoutMenu drew there: each row's text top and the 16 below it,
 * across the box; under headers the rows start lower; a grid's cells are its column width square. */
test('a tap finds the menu line drawn under it, and nothing outside the box',()=>{
 for(const header of [undefined,'HEAD']){
  const menus=new ScmMenus(),id=menus.create(MENU_TYPE_DEFAULT,'T',29,145,180,1,true,true,0);
  menus.insertMenu(id,0,header,['A','B','C']);
  const menu=menus.menus[id]!,rows=layoutMenu(menu,true,key=>key).texts.filter(t=>!t.header);
  expect(rows).toHaveLength(3);
  for(const [row,t] of rows.entries()){expect(menuItemAt(menu,t.x+5,t.y+1)).toBe(row);expect(menuItemAt(menu,t.x+5,t.y+15)).toBe(row);}
  expect(menuItemAt(menu,rows[0].x,rows[0].y-1)).toBeUndefined();expect(menuItemAt(menu,rows[2].x,rows[2].y+16)).toBeUndefined();
  expect(menuItemAt(menu,menu.x-1,rows[1].y+5)).toBeUndefined();expect(menuItemAt(menu,menu.x+180+21,rows[1].y+5)).toBeUndefined();
 }
 const menus=new ScmMenus(),id=menus.create(MENU_TYPE_GRID,undefined,0,0,20,4,true,true,0),grid=menus.menus[id]!;
 // Cell (column 1, row 2 down) is index 2*4+1, as layoutMenu counts them.
 expect(menuItemAt(grid,25,45)).toBe(9);expect(menuItemAt(grid,85,5)).toBeUndefined();
});
