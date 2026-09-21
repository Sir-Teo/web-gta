/* CCustomCarPlateMgr and CVehicleModelInfo::SetCarCustomPlate (gta-reversed ead3051): number plates. When a vehicle
 * model loads, SetCarCustomPlate generates an eight-character plate text (GeneratePlateText: two letters, two digits,
 * then a space, a digit and two letters, each from CGeneral::GetRandomNumberInRange with an exclusive upper bound, so
 * letters A..W and digits 0..8 in the original) and SetupClump walks the clump's materials: the one whose texture is
 * named `carplate` gets CreatePlateTexture (a 64 x 16 raster with each character's 8 x 16 cell copied from
 * `platecharset`, 32 x 256 in vehicle.txd, four cells a row: the letters a..z and digits 0..9 in order from cell 0,
 * anything else the blank cell at column 0, row 9; nearest filtering), the one named `carpback` gets
 * `plateback1..3` by GetMapRegionPlateDesign (2 for the LA weather region, 1 for LV and the desert, 0 for SF and the
 * default). Every vehicle of the model shows the model's plate (CVehicle::CustomCarPlate_TextureCreate keeps the
 * model's text). LoadPlatecharsetDat is a raw call: the palette it loads is unused by the copy. */
import type {ModelTexture} from '../assets/modelTextures';
import {WEATHER_REGION} from '../world/weatherRegion';
export const PLATE_TEXT_LENGTH=8,PLATE_CHAR_WIDTH=8,PLATE_CHAR_HEIGHT=16,PLATE_CHARSET_COLUMNS=4,PLATE_WIDTH=64,PLATE_HEIGHT=16,PLATE_CHARSET_WIDTH=32,PLATE_CHARSET_HEIGHT=256;
export const PLATE_BLANK_CELL={col:0,row:9};
/** GetCharacterPositionInCharSet: the charset column and row of a character. */
export function plateCharCell(character:string){
 const c=character.toLowerCase();let index=-1;
 if(c>='a'&&c<='z')index=c.charCodeAt(0)-97;else if(c>='0'&&c<='9')index=26+c.charCodeAt(0)-48;
 if(index<0)return {...PLATE_BLANK_CELL};
 return {col:index%PLATE_CHARSET_COLUMNS,row:Math.floor(index/PLATE_CHARSET_COLUMNS)};
}
/** CGeneral::GetRandomNumberInRange for integers: min + the unit random over [min, max) as the original (or [min, max] with the bug fix). */
export function plateRandomInRange(random:()=>number,min:number,max:number,inclusive=false){
 const top=inclusive?max:max-1;return Math.trunc(min+(top-min)*Math.min(1,Math.max(0,random())));
}
/** GeneratePlateText: letters then digits then space-digit-letter-letter groups to the length (8). */
export function generatePlateText(random:()=>number,length=PLATE_TEXT_LENGTH,bugFix=false){
 if(length<4)return undefined;
 const A=65,Z=90,X=88,ZERO=48,NINE=57;
 const letter=()=>String.fromCharCode(bugFix?plateRandomInRange(random,A,Z,true):plateRandomInRange(random,A,X));
 const digit=()=>String.fromCharCode(plateRandomInRange(random,ZERO,NINE,bugFix));
 let out=letter()+letter()+digit()+digit();
 for(let i=out.length;i<length;i+=4)out+=' '+digit()+letter()+letter();
 return out.slice(0,length);
}
/** GetMapRegionPlateDesign: which plateback the weather region uses. */
export function plateDesignForRegion(region:number){
 switch(region){
  case WEATHER_REGION.la:return 2;
  case WEATHER_REGION.lv:case WEATHER_REGION.desert:return 1;
  default:return 0;
 }
}
export interface PlateCharset {width:number;height:number;data:ArrayLike<number>}
/** RenderLicenseplateTextToRaster: the 64 x 16 RGBA plate raster of the first eight characters. */
export function renderPlateRaster(text:string,charset:PlateCharset){
 if(charset.width<PLATE_CHARSET_WIDTH||charset.height<PLATE_CHARSET_HEIGHT||charset.data.length<charset.width*charset.height*4)throw new Error('Plate charset raster is too small.');
 const out=new Uint8ClampedArray(PLATE_WIDTH*PLATE_HEIGHT*4);
 for(let letter=0;letter<PLATE_TEXT_LENGTH;letter++){
  const {col,row}=plateCharCell(text[letter]??' ');
  for(let y=0;y<PLATE_CHAR_HEIGHT;y++){
   const src=((row*PLATE_CHAR_HEIGHT+y)*charset.width+col*PLATE_CHAR_WIDTH)*4,dst=(y*PLATE_WIDTH+letter*PLATE_CHAR_WIDTH)*4;
   for(let k=0;k<PLATE_CHAR_WIDTH*4;k++)out[dst+k]=charset.data[src+k];
  }
 }
 return out;
}
/** The model textures a car's clump gets in place of `carplate` and `carpback`: the plate text raster (nearest
 * filtering, as CreatePlateTexture sets) and the region's plateback under the material's own name. */
export function plateModelTextures(text:string,charset:ModelTexture,backs:readonly ModelTexture[],design:number):{carplate:ModelTexture;carpback:ModelTexture|undefined}{
 const mip=charset.mips[0];
 const carplate:ModelTexture={name:'carplate',filter:1,addressU:1,addressV:1,hasAlpha:false,mips:[{width:PLATE_WIDTH,height:PLATE_HEIGHT,data:renderPlateRaster(text,{width:mip.width,height:mip.height,data:mip.data})}]};
 const back=backs[design];
 return {carplate,carpback:back?{...back,name:'carpback',sourceDictionary:undefined}:undefined};
}
