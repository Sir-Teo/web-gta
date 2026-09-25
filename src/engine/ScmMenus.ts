import {requireAsset} from '../assets/binary';
import {emptyPadState,type ScmPadState} from './ScmPads';
/* CMenuSystem, pinned gta-reversed `MenuSystem.cpp` (all reversed but FillGridWithCarColours): the script's two
 * on-screen menus (shops, the barber, the wardrobe, the gym machines). A menu holds up to four columns of twelve
 * rows of GXT keys, which rows can be chosen, which are already bought, and the row the pad has highlighted and
 * the one it accepted. The host draws them; Process moves the highlight from the pad. Positions and widths are in
 * the 640 x 448 screen the script's numbers are written for. */
export const MENU_COL_COUNT=4,MENU_ROW_COUNT=12,MENU_COUNT=2,MENU_UNDEFINED=-99;
export const MENU_TYPE_DEFAULT=0,MENU_TYPE_GRID=1;
/** eFontAlignment: centre, left, right; the header's own alignment starts undefined and follows the column's. */
export const ALIGN_CENTER=0,ALIGN_LEFT=1,ALIGN_RIGHT=2,ALIGN_UNDEFINED=-1;
const INTERACTIVE_DEFAULT=0,INTERACTIVE_DPAD=1;
export interface ScmMenu {
 type:number;title:string;
 /** m_aaacRowTitles, m_aanNumberInRowTitle and m_aadw2ndNumberInRowTitle, by column then row. */
 rowTitles:string[][];numbers:number[][];secondNumbers:number[][];
 headers:string[];selectable:boolean[];bought:boolean[];alignment:number[];headerAlignment:number[];
 numRows:number;numColumns:number;
 /** m_abColumnInteractive: [0] whether the pad drives the menu, [1] whether the d-pad does too. */
 interactive:[boolean,boolean];
 widths:number[];x:number;y:number;background:boolean;
 selectedRow:number;acceptedRow:number;
 /** m_anUsedCarColors, a grid menu's carcols indices. */
 carColours:number[];
}
/** AudioEngine.ReportFrontendAudioEvent for the three menu sounds. */
export type ScmMenuSound='back'|'select'|'highlight';
const rows=<T,>(value:()=>T)=>Array.from({length:MENU_ROW_COUNT},value);
const grid=<T,>(value:()=>T)=>Array.from({length:MENU_COL_COUNT},()=>rows(value));

export class ScmMenus {
 readonly menus:(ScmMenu|undefined)[]=[undefined,undefined];
 readonly inUse=[false,false];
 currentMenuInUse=0;numInUse=0;
 /** The frontend sounds, as the host plays them. */
 onSound?:(sound:ScmMenuSound)=>void;
 /** FillGridWithCarColours (unreversed): the carcols indices a grid menu offers, which the host gives. */
 carColours?:()=>readonly number[];
 /** The pad as it was at the last Process, for the pressed-this-frame tests, and GetAnaloguePad*'s four statics. */
 private oldPad?:ScmPadState;
 private oldStick={up:0,down:0,left:0,right:0};
 private menu(id:number){const menu=this.menus[id];requireAsset(menu&&this.inUse[id],`No script menu ${id}.`);return menu!;}
 /** Initialise: every menu switched off. */
 initialise(){for(let i=0;i<MENU_COUNT;i++)if(this.inUse[i])this.switchOff(i);this.currentMenuInUse=0;}
 /** CreateNewMenu (0x582300). The id is the number of menus in use, as the source takes it. */
 create(type:number,title:string|undefined,x:number,y:number,width:number,columns:number,interactive:boolean,background:boolean,alignment:number){
  requireAsset(this.numInUse<MENU_COUNT,'Both script menus are in use.');
  const id=this.numInUse;requireAsset(!this.inUse[id],'The script menu slot is already in use.');
  requireAsset([x,y,width].every(Number.isFinite),'Invalid script menu geometry.');
  const menu:ScmMenu={type,title:'',rowTitles:grid(()=>''),numbers:grid(()=>-1),secondNumbers:grid(()=>-1),headers:['','','',''],
   selectable:rows(()=>false),bought:rows(()=>false),alignment:[0,0,0,0],headerAlignment:[ALIGN_UNDEFINED,ALIGN_UNDEFINED,ALIGN_UNDEFINED,ALIGN_UNDEFINED],
   numRows:0,numColumns:0,interactive:[interactive,true],widths:[width,0,0,0],x,y,background,selectedRow:0,acceptedRow:MENU_UNDEFINED,carColours:[]};
  this.menus[id]=menu;this.inUse[id]=true;
  if(type===MENU_TYPE_DEFAULT){
   menu.numColumns=Math.min(columns&0xff,MENU_COL_COUNT);
   menu.title=title??'';
   this.activateItems(id,rows(()=>true));
   for(let i=0;i<MENU_COL_COUNT;i++){menu.widths[i]=width;menu.alignment[i]=alignment;}
  }else{
   menu.numColumns=Math.min(columns&0xff,8);menu.numRows=menu.numColumns*menu.numColumns;
   const colours=this.carColours?.()??[];menu.carColours=Array.from({length:64},(_,i)=>colours[i]??0);
  }
  this.numInUse++;
  return id;
 }
 /** ActivateItems (0x581990): which of the twelve rows can be chosen, then the highlight moves off one that cannot
  * (the source walks it twice, once for each menu slot, on the same menu). */
 activateItems(id:number,selectable:readonly boolean[]){
  const menu=this.menu(id);
  for(let row=0;row<MENU_ROW_COUNT;row++)menu.selectable[row]=!!selectable[row];
  for(let i=0;i<MENU_COUNT;i++){this.skipDown(menu);if(menu.selectedRow>=menu.numRows)menu.selectedRow=0;}
 }
 /** ActivateOneItem (0x581B30). */
 activateOneItem(id:number,row:number,enable:boolean){
  const menu=this.menu(id);menu.selectable[row]=enable;
  this.skipDown(menu);
  if(menu.selectedRow>=menu.numRows){menu.selectedRow=0;this.skipDown(menu);}
  if(menu.selectedRow>=menu.numRows)menu.selectedRow=0;
 }
 /** HighlightOneItem (0x581C10): a row marked bought (or not), and choosable. */
 highlightOneItem(id:number,row:number,bought:boolean){const menu=this.menu(id);menu.bought[row]=bought;menu.selectable[row]=true;}
 /** InsertMenu (0x581E00): a column's header and twelve rows; every row's numbers are cleared, and the row count
  * follows the first column. */
 insertMenu(id:number,column:number,header:string|undefined,titles:readonly (string|undefined)[]){
  requireAsset(Number.isInteger(column)&&column>=0&&column<MENU_COL_COUNT,'Invalid script menu column.');
  const menu=this.menu(id);menu.headers[column]=header??'';
  for(let row=0;row<MENU_ROW_COUNT;row++)menu.rowTitles[column][row]=titles[row]??'';
  for(const list of [menu.numbers,menu.secondNumbers])for(const col of list)col.fill(-1);
  if(column===0)this.calcNonEmptyRows(menu);
 }
 /** InsertOneMenuItemWithNumber (0x581D70). */
 insertOneMenuItemWithNumber(id:number,column:number,row:number,text:string|undefined,first:number,second:number){
  requireAsset(Number.isInteger(column)&&column>=0&&column<MENU_COL_COUNT&&Number.isInteger(row)&&row>=0&&row<MENU_ROW_COUNT,'Invalid script menu cell.');
  const menu=this.menu(id);menu.rowTitles[column][row]=text??'';menu.numbers[column][row]=first;menu.secondNumbers[column][row]=second;
  this.calcNonEmptyRows(menu);
 }
 setActiveMenuItem(id:number,row:number){this.menu(id).selectedRow=row;}
 setColumnOrientation(id:number,column:number,orientation:number){requireAsset(column>=0&&column<MENU_COL_COUNT,'Invalid script menu column.');this.menu(id).alignment[column]=orientation;}
 setHeaderOrientation(id:number,column:number,orientation:number){requireAsset(column>=0&&column<MENU_COL_COUNT,'Invalid script menu column.');this.menu(id).headerAlignment[column]=orientation;}
 setColumnWidth(id:number,column:number,width:number){requireAsset(column>=0&&column<MENU_COL_COUNT,'Invalid script menu column.');this.menu(id).widths[column]=width&0xffff;}
 getCarColourFromGrid(id:number,index:number){return this.menu(id).carColours[index]??0;}
 /** CheckForAccept and CheckForSelected: MENU_UNDEFINED for a menu not in use. */
 checkForAccept(id:number){return this.inUse[id]?this.menus[id]!.acceptedRow:MENU_UNDEFINED;}
 checkForSelected(id:number){return this.inUse[id]?this.menus[id]!.selectedRow:MENU_UNDEFINED;}
 /** SwitchOffMenu (0x580750): the menu goes, and the current one is the first still in use. */
 switchOff(id:number){
  if(!this.inUse[id])return;
  this.menus[id]=undefined;this.inUse[id]=false;this.numInUse--;this.currentMenuInUse=0;
  for(let i=0;i<MENU_COUNT;i++)if(this.inUse[i]){this.currentMenuInUse=i;break;}
 }
 /** Process (0x582630) with MENU_UNDEFINED: the current menu takes the pad's input when it is interactive.
  * `paused` is CTimer::GetIsPaused. Drawing is the host's, from `menus`. */
 process(pad:ScmPadState,paused=false){
  const old=this.oldPad??emptyPadState();this.oldPad={...pad};
  const pressed=(button:keyof ScmPadState)=>pad[button]!==0&&old[button]===0;
  const input={cross:pressed('cross'),triangle:pressed('triangle'),dpadUp:pressed('dpadUp'),dpadDown:pressed('dpadDown'),dpadLeft:pressed('dpadLeft'),dpadRight:pressed('dpadRight'),
   // CPad::GetAnaloguePad*: past 15 one way from within 5 of rest.
   up:this.stick('up',pad.leftStickY,-1),down:this.stick('down',pad.leftStickY,1),left:this.stick('left',pad.leftStickX,-1),right:this.stick('right',pad.leftStickX,1)};
  const current=this.currentMenuInUse;
  if(this.inUse[current]&&this.menus[current]!.interactive[INTERACTIVE_DEFAULT]){
   if(this.menus[current]!.type===MENU_TYPE_GRID)this.inputGrid(current,input);else this.inputStandard(current,input,paused);
  }
 }
 private stick(which:keyof ScmMenus['oldStick'],value:number,sign:number){
  const old=this.oldStick[which];this.oldStick[which]=value;
  return sign<0?value< -15&&old>=-5:value>15&&old<=5;
 }
 /** InputStandardMenu (0x580800). */
 private inputStandard(id:number,input:{cross:boolean;triangle:boolean;dpadUp:boolean;dpadDown:boolean;up:boolean;down:boolean},paused:boolean){
  const menu=this.menus[id]!;
  if(this.currentMenuInUse<0)this.currentMenuInUse=1;
  while(!this.inUse[this.currentMenuInUse]&&this.currentMenuInUse>0)this.currentMenuInUse--;
  if(this.currentMenuInUse>=2)this.currentMenuInUse=0;
  while(!this.inUse[this.currentMenuInUse]&&this.currentMenuInUse<2)this.currentMenuInUse++;
  if(input.triangle&&!paused)this.onSound?.('back');
  if(input.cross){
   if(!paused)this.onSound?.('select');
   if(menu.selectable[menu.selectedRow])menu.acceptedRow=menu.selectedRow;
  }
  if(menu.acceptedRow!==menu.selectedRow)menu.acceptedRow=MENU_UNDEFINED;
  if(menu.numRows<=1)return;
  const dpad=menu.interactive[INTERACTIVE_DPAD];
  if(input.up||dpad&&input.dpadUp){this.onSound?.('highlight');this.skipUp(menu);}
  if(input.down||dpad&&input.dpadDown){this.onSound?.('highlight');menu.selectedRow++;this.skipDown(menu);}
  if(menu.selectedRow<0){menu.selectedRow=menu.numRows;this.skipUp(menu);}
  if(menu.selectedRow>=menu.numRows){menu.selectedRow=0;this.skipDown(menu);}
 }
 /** InputGridMenu (0x580BD0). */
 private inputGrid(id:number,input:{cross:boolean;dpadUp:boolean;dpadDown:boolean;dpadLeft:boolean;dpadRight:boolean;up:boolean;down:boolean;left:boolean;right:boolean}){
  const menu=this.menus[id]!,dpad=menu.interactive[INTERACTIVE_DPAD];
  if(input.cross&&menu.selectable[menu.selectedRow])menu.acceptedRow=menu.selectedRow;
  if(menu.acceptedRow!==menu.selectedRow)menu.acceptedRow=MENU_UNDEFINED;
  if((input.up||dpad&&input.dpadUp)&&menu.selectedRow>=menu.numColumns)menu.selectedRow-=menu.numColumns;
  if((input.down||dpad&&input.dpadDown)&&menu.selectedRow<menu.numRows-menu.numColumns)menu.selectedRow+=menu.numColumns;
  if((input.left||dpad&&input.dpadLeft)&&menu.selectedRow>0)menu.selectedRow--;
  if((input.right||dpad&&input.dpadRight)&&menu.selectedRow<menu.numRows-1)menu.selectedRow++;
 }
 /** The source's walk up: at least one step, on while the row cannot be chosen or is blank, down to -1. */
 private skipUp(menu:ScmMenu){
  do menu.selectedRow--;while((!menu.selectable[menu.selectedRow]||!menu.rowTitles[0][menu.selectedRow])&&menu.selectedRow>=0);
 }
 /** The source's walk down from where the highlight is: on past rows that cannot be chosen or are blank, up to
  * the row count. */
 private skipDown(menu:ScmMenu){
  for(;;){
   if(menu.selectable[menu.selectedRow]&&menu.rowTitles[0][menu.selectedRow])break;
   if(menu.selectedRow>=menu.numRows)break;
   menu.selectedRow++;
  }
 }
 /** CalcNonEmptyRows: the rows with a key in the first column. */
 private calcNonEmptyRows(menu:ScmMenu){menu.numRows=menu.rowTitles[0].filter(Boolean).length;}
}
