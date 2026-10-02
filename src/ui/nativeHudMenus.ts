import {ALIGN_CENTER,ALIGN_RIGHT,MENU_TYPE_GRID,type ScmMenu} from '../engine/ScmMenus';
import {HUD_COLOURS,HUD_COLOUR_DARK_GRAY,HUD_COLOUR_GREEN,HUD_COLOUR_LIGHT_BLUE,HUD_COLOUR_NIGHT_BLUE} from './nativeHudColours';
/* CMenuSystem::DisplayStandardMenu (0x580E00) and DisplayGridMenu (0x5816E0), pinned gta-reversed: where each box,
 * header and row of a script menu goes, in the 640 x 448 screen, and in which colour. The HUD draws the list. */
type Rgb=readonly [number,number,number];
export interface MenuDrawText {x:number;y:number;text:string;align:number;colour:Rgb;/** The column's width, which CFont shrinks the row's text to fit. */fit?:number;header?:boolean}
export interface MenuDraw {
 /** FrontEndMenuManager.DrawWindow: the box (black at 190), and its title in gothic, light grey less the window's dimming. */
 box?:{x:number;y:number;width:number;height:number;title?:string;titleColour:Rgb};
 texts:MenuDrawText[];
 /** A grid's cells: the highlight's white square and each car colour three units inside its cell. */
 rects:{x:number;y:number;width:number;height:number;colour:Rgb}[];
}
/** `bright` is the current menu's (Process draws the others dimmed by 120). `text` is TheText.Get with the numbers
 * inserted, `carColour` the carcols colour table. */
export function layoutMenu(menu:ScmMenu,bright:boolean,text:(key:string,first:number,second:number)=>string,carColour:(index:number)=>Rgb=()=>[0,0,0]):MenuDraw{
 const draw:MenuDraw={texts:[],rects:[]};
 if(menu.type===MENU_TYPE_GRID){
  const cell=menu.widths[0],n=menu.numColumns;
  if(menu.background)draw.box={x:menu.x,y:menu.y,width:n*cell,height:n*cell,titleColour:[225,225,225]};
  let index=0;
  for(let c=0;c<n;c++)for(let r=0;r<n;r++){
   if(index===menu.selectedRow)draw.rects.push({x:r*cell+menu.x,y:c*cell+menu.y,width:cell,height:cell,colour:[225,225,225]});
   draw.rects.push({x:r*cell+menu.x+3,y:c*cell+menu.y+3,width:cell-6,height:cell-6,colour:carColour(menu.carColours[index]??0)});
   index++;
  }
  return draw;
 }
 const dim=bright?0:120;let baseY=20;
 if(menu.background){
  let width=0,height=50;
  for(let i=0;i<menu.numColumns;i++){width+=menu.widths[i];if(menu.headers[i]){height=70;baseY=40;}}
  width+=20;height+=menu.numRows*16;
  draw.box={x:menu.x,y:menu.y,width,height,title:menu.title?text(menu.title,-1,-1):undefined,titleColour:[225-dim,225-dim,225-dim]};
 }
 const columnX=(column:number)=>{
  let x=menu.x+10;for(let i=0;i<column;i++)x+=menu.widths[i];
  const align=menu.alignment[column];
  return align===ALIGN_CENTER?x+menu.widths[column]/2:align===ALIGN_RIGHT?x+menu.widths[column]:x;
 };
 for(let column=0;column<menu.numColumns;column++){
  const header=menu.headers[column];if(!header)continue;
  const align=menu.headerAlignment[column]<0?menu.alignment[column]:menu.headerAlignment[column];
  draw.texts.push({x:columnX(column),y:menu.y+20,text:text(header,-1,-1),align,colour:[225-dim,225-dim,225-dim],header:true});
 }
 const colour=(row:number):Rgb=>{
  if(menu.interactive[0]){
   if(row===menu.selectedRow&&menu.selectable[row])return HUD_COLOURS[HUD_COLOUR_LIGHT_BLUE];
   if(menu.bought[row])return HUD_COLOURS[HUD_COLOUR_GREEN];
   return HUD_COLOURS[menu.selectable[row]?HUD_COLOUR_NIGHT_BLUE:HUD_COLOUR_DARK_GRAY];
  }
  if(menu.bought[row])return HUD_COLOURS[HUD_COLOUR_GREEN];
  return HUD_COLOURS[menu.selectable[row]?HUD_COLOUR_LIGHT_BLUE:HUD_COLOUR_NIGHT_BLUE];
 };
 for(let row=0;row<menu.numRows;row++){
  for(let column=0;column<menu.numColumns;column++){
   const key=menu.rowTitles[column][row];if(!key)continue;
   draw.texts.push({x:columnX(column),y:menu.y+baseY,text:text(key,menu.numbers[column][row],menu.secondNumbers[column][row]),align:menu.alignment[column],colour:colour(row),fit:menu.widths[column]});
  }
  baseY+=16;
 }
 return draw;
}
/** The row (a grid's cell) under a point on the 640 x 448 screen, as layoutMenu places them, or undefined: a touch
 * screen's tap on a menu's line. A standard menu's rows are 16 high from 20 below its top (40 under headers), across
 * its columns and the 10 either side; a grid's cells are its column width square. */
export function menuItemAt(menu:ScmMenu,x:number,y:number):number|undefined{
 if(menu.type===MENU_TYPE_GRID){
  const cell=menu.widths[0],n=menu.numColumns,r=Math.floor((x-menu.x)/cell),c=Math.floor((y-menu.y)/cell);
  return r>=0&&r<n&&c>=0&&c<n&&c*n+r<menu.numRows?c*n+r:undefined;
 }
 let width=20;for(let i=0;i<menu.numColumns;i++)width+=menu.widths[i];
 const top=menu.y+(menu.background&&menu.headers.slice(0,menu.numColumns).some(Boolean)?40:20),row=Math.floor((y-top)/16);
 return x>=menu.x&&x<=menu.x+width&&row>=0&&row<menu.numRows?row:undefined;
}
