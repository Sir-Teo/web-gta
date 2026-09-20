/* CCustomRoadsignMgr (gta-reversed ead3051): the text on road signs. A model's roadsign 2d effect names up to four
 * 16-character lines; CEntity::CreateEffects asks CreateRoadsignAtomic for a quad per line (the sign width by the
 * height over the line count, each quad 0.95 of a line tall, stacked by the line-count table below) whose material
 * colour is the palette (white, black, grey or red) and whose texture is the line's text drawn from `roadsignfont`
 * (particle.txd): every character is an 8 x 16 cell of the 32 x 512 charset, found by RoadsignGetLineAndRow (the
 * column and row below; anything else, the underscore included, is the blank cell at column 0, row 26). The atomic's
 * frame is rotated about Z, then X, then Y (degrees, post-concatenated) and moved to the effect position.
 * RenderRoadsignAtomic draws it with alpha test 100 within 40 units and fades it out to 500. */
export const SIGN_CHAR_WIDTH=8,SIGN_CHAR_HEIGHT=16,SIGN_FONT_WIDTH=32,SIGN_FONT_HEIGHT=512,SIGN_LINE_HEIGHT_USED=0.95;
export const ROADSIGN_ALPHA_TEST=100/255,ROADSIGN_FADE_START=40,ROADSIGN_FADE_END=500;
/** CreateRoadsignAtomicA's palette: 0 white, 1 black, 2 grey, 3 red. */
export const ROADSIGN_PALETTE:readonly (readonly [number,number,number])[]=[[255,255,255],[0,0,0],[128,128,128],[255,0,0]];
const CELLS:Record<string,[number,number]>={'!':[0,0],'#':[3,21],'$':[0,22],'%':[2,21],'&':[2,0],'(':[0,1],')':[1,1],'*':[1,22],'+':[2,1],'-':[0,2],'.':[1,2],
 '0':[3,2],'1':[0,3],'2':[1,3],'3':[2,3],'4':[3,3],'5':[0,4],'6':[1,4],'7':[2,4],'8':[3,4],'9':[0,5],':':[2,5],';':[1,5],'<':[2,20],'>':[3,20],'?':[3,5],'@':[2,22],
 A:[0,6],B:[1,6],C:[2,6],D:[3,6],E:[0,7],F:[1,7],G:[2,7],H:[3,7],I:[0,8],J:[1,8],K:[2,8],L:[3,8],M:[0,9],N:[1,9],O:[2,9],P:[3,9],Q:[0,10],R:[1,10],S:[2,10],T:[3,10],
 U:[0,11],V:[1,11],W:[2,11],X:[3,11],Y:[0,12],Z:[1,12],'[':[2,12],']':[0,13],'^':[0,21],a:[1,13],b:[2,13],c:[3,13],d:[0,14],e:[1,14],f:[2,14],g:[3,14],h:[0,15],i:[1,15],
 j:[2,15],k:[3,15],l:[0,16],m:[1,16],n:[2,16],o:[3,16],p:[0,17],q:[1,17],r:[2,17],s:[3,17],t:[0,18],u:[1,18],v:[2,18],w:[3,18],x:[0,19],y:[1,19],z:[2,19],'{':[0,23],'|':[3,22],'}':[2,23],'~':[1,21]};
/** RoadsignGetLineAndRow: the charset column (`line`) and row of a character. */
export function roadsignGlyphCell(character:string):{line:number;row:number}{const c=CELLS[character];return c?{line:c[0],row:c[1]}:{line:0,row:26};}
export interface RoadsignFont {width:number;height:number;data:ArrayLike<number>}
/** RoadsignGenerateTextRaster: an 8 x letters by 16 RGBA raster of the line's first `letters` characters. */
export function roadsignLineRaster(text:string,letters:number,font:RoadsignFont){
 if(!(Number.isInteger(letters)&&letters>0&&letters<=16))throw new Error('Roadsign letters per line must be 1 to 16.');
 if(font.width<SIGN_FONT_WIDTH||font.height<SIGN_FONT_HEIGHT||font.data.length<font.width*font.height*4)throw new Error('Roadsign font raster is too small.');
 const width=SIGN_CHAR_WIDTH*letters,out=new Uint8ClampedArray(width*SIGN_CHAR_HEIGHT*4);
 for(let i=0;i<letters;i++){
  const {line,row}=roadsignGlyphCell(text[i]??' ');
  for(let y=0;y<SIGN_CHAR_HEIGHT;y++){
   const src=((row*SIGN_CHAR_HEIGHT+y)*font.width+line*SIGN_CHAR_WIDTH)*4,dst=(y*width+i*SIGN_CHAR_WIDTH)*4;
   for(let k=0;k<SIGN_CHAR_WIDTH*4;k++)out[dst+k]=font.data[src+k];
  }
 }
 return {width,height:SIGN_CHAR_HEIGHT,data:out};
}
/** CreateRoadsignAtomicA's line bottoms: each line's y offset for one to four lines. */
export function roadsignLineOffsets(height:number,numLines:number):number[]{
 const h=height/numLines;
 switch(numLines){
  case 1:return [-.5*h];
  case 2:return [0,-h];
  case 3:return [.5*h,-.5*h,-1.5*h];
  case 4:return [h,0,-h,-2*h];
  default:throw new Error('Roadsign lines must be 1 to 4.');
 }
}
/** The quad vertices (native model space, x across, y up, z flat), uvs and indices of one line. */
export function roadsignLineQuad(width:number,height:number,numLines:number,line:number){
 const y=roadsignLineOffsets(height,numLines)[line],used=height/numLines*SIGN_LINE_HEIGHT_USED,x0=-width*.5,x1=x0+width;
 return {positions:[x0,y,0,x1,y,0,x1,y+used,0,x0,y+used,0],uvs:[0,1,1,1,1,0,0,0],indices:[0,1,2,0,2,3]};
}
/** RenderRoadsignAtomic's alpha for a sign `distance` from the camera: 255 within 40, 254 down to 0 by 500. */
export function roadsignAlpha(distance:number){
 const d2=distance*distance;
 if(d2>ROADSIGN_FADE_END*ROADSIGN_FADE_END)return 0;
 if(d2<ROADSIGN_FADE_START*ROADSIGN_FADE_START)return 255;
 const fade=1-(d2-ROADSIGN_FADE_START**2)/(ROADSIGN_FADE_END**2-ROADSIGN_FADE_START**2);
 return Math.floor(254*fade);
}
