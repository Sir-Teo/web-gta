import {expect,test} from 'vitest';
import {generatePlateText,plateCharCell,plateDesignForRegion,plateRandomInRange,renderPlateRaster,plateModelTextures} from '../src/vehicle/nativeCarPlates';
import {WEATHER_REGION} from '../src/world/weatherRegion';
test('GetCharacterPositionInCharSet: letters and digits in order, four cells a row, the blank cell for anything else',()=>{
 expect(plateCharCell('a')).toEqual({col:0,row:0});expect(plateCharCell('A')).toEqual({col:0,row:0});expect(plateCharCell('d')).toEqual({col:3,row:0});expect(plateCharCell('e')).toEqual({col:0,row:1});
 expect(plateCharCell('z')).toEqual({col:1,row:6});expect(plateCharCell('0')).toEqual({col:2,row:6});expect(plateCharCell('1')).toEqual({col:3,row:6});expect(plateCharCell('2')).toEqual({col:0,row:7});expect(plateCharCell('9')).toEqual({col:3,row:8});
 expect(plateCharCell(' ')).toEqual({col:0,row:9});expect(plateCharCell('-')).toEqual({col:0,row:9});
});
test('GeneratePlateText: two letters, two digits, a space, a digit and two letters; the original draws A..W and 0..8',()=>{
 expect(generatePlateText(()=>0)).toBe('AA00 0AA');
 expect(generatePlateText(()=>1)).toBe('WW88 8WW');
 expect(generatePlateText(()=>1,8,true)).toBe('ZZ99 9ZZ');
 expect(generatePlateText(()=>.5)).toBe('LL44 4LL');
 expect(generatePlateText(()=>0,3)).toBeUndefined();expect(generatePlateText(()=>0,4)).toBe('AA00');
 expect(plateRandomInRange(()=>.999,65,88)).toBe(86);expect(plateRandomInRange(()=>1,65,88)).toBe(87);expect(plateRandomInRange(()=>.999,65,90,true)).toBe(89);
});
test('GetMapRegionPlateDesign: LA takes plateback3, LV and the desert plateback2, SF and the default plateback1',()=>{
 expect(plateDesignForRegion(WEATHER_REGION.la)).toBe(2);expect(plateDesignForRegion(WEATHER_REGION.lv)).toBe(1);expect(plateDesignForRegion(WEATHER_REGION.desert)).toBe(1);
 expect(plateDesignForRegion(WEATHER_REGION.sf)).toBe(0);expect(plateDesignForRegion(WEATHER_REGION.default)).toBe(0);
});
test('RenderLicenseplateTextToRaster copies each character cell into the 64 x 16 plate',()=>{
 const charset={width:32,height:256,data:new Uint8ClampedArray(32*256*4)};
 for(let y=0;y<256;y++)for(let x=0;x<32;x++){const i=(y*32+x)*4;charset.data[i]=Math.floor(x/8);charset.data[i+1]=Math.floor(y/16);charset.data[i+2]=x%8;charset.data[i+3]=y%16;}
 const plate=renderPlateRaster('AB12 3CD',charset);
 const cell=(letter:number,x:number,y:number)=>{const i=(y*64+letter*8+x)*4;return [plate[i],plate[i+1],plate[i+2],plate[i+3]];};
 expect(cell(0,0,0)).toEqual([0,0,0,0]);expect(cell(1,7,15)).toEqual([1,0,7,15]);expect(cell(2,0,0)).toEqual([3,6,0,0]);expect(cell(3,0,0)).toEqual([0,7,0,0]);
 expect(cell(4,3,3)).toEqual([0,9,3,3]);expect(cell(5,0,0)).toEqual([1,7,0,0]);expect(cell(6,0,0)).toEqual([2,0,0,0]);expect(cell(7,0,0)).toEqual([3,0,0,0]);
 expect(()=>renderPlateRaster('AB12 3CD',{width:16,height:256,data:new Uint8ClampedArray(16*256*4)})).toThrow();
 const made=plateModelTextures('AB12 3CD',{name:'platecharset',filter:1,addressU:1,addressV:1,hasAlpha:false,mips:[{width:32,height:256,data:charset.data}]},[{name:'plateback1',filter:2,addressU:1,addressV:1,hasAlpha:false,mips:[{width:64,height:32,data:new Uint8ClampedArray(64*32*4)}]}],0);
 expect(made.carplate.name).toBe('carplate');expect(made.carplate.mips[0]).toMatchObject({width:64,height:16});expect(made.carplate.filter).toBe(1);
 expect(made.carpback?.name).toBe('carpback');expect(made.carpback?.mips[0].width).toBe(64);
});
