import {expect,test} from 'vitest';
import {discoverDistricts} from '../src/assets/discoverDistricts';
import {readImgIndex} from '../src/assets/img';
import {imgFixture} from './fixtures/native-assets';
const ipl=(name:string,x:number,interior=0)=>new File([`inst\n1 terrain ${interior} ${x} 0 0 0 0 0 1 -1\nend`],name);
test('finds overlapping supplied districts, excludes interior-only and distant sources',async()=>{
 const file=new File([imgFixture([]) as BlobPart],'gta3.img'),paths=new Map([['ipl/a/east.ipl',ipl('east.ipl',0)],['ipl/b/west.ipl',ipl('west.ipl',1)],['ipl/c/far.ipl',ipl('far.ipl',100)],['ipl/d/inside.ipl',ipl('inside.ipl',0,1)]]);
 expect(await discoverDistricts(file,await readImgIndex(file),paths,[],{x:0,y:0,radius:2})).toEqual(['a/east','b/west']);
 await expect(discoverDistricts(file,await readImgIndex(file),paths,[],{x:1000,y:0,radius:2})).rejects.toThrow('No supplied district');
});
test('includes archived binary placements even when the external IPL has no instances',async()=>{
 const bytes=new Uint8Array(116),v=new DataView(bytes.buffer);bytes.set(new TextEncoder().encode('bnry'));v.setUint32(4,1,true);v.setUint32(28,76,true);v.setFloat32(76,10,true);v.setFloat32(100,1,true);v.setInt32(104,1,true);v.setInt32(112,-1,true);
 const file=new File([imgFixture([{name:'east_stream0.ipl',bytes}]) as BlobPart],'gta3.img');
 expect(await discoverDistricts(file,await readImgIndex(file),new Map([['ipl/a/east.ipl',new File(['inst\nend'],'east.ipl')]]),[],{x:10,y:0,radius:1})).toEqual(['a/east']);
});
test('rejects excessive district overlap rather than silently dropping sources',async()=>{
 const file=new File([imgFixture([]) as BlobPart],'gta3.img'),paths=new Map(Array.from({length:17},(_,i)=>[`ipl/a/d${i}.ipl`,ipl(`d${i}.ipl`,0)]));
 await expect(discoverDistricts(file,await readImgIndex(file),paths,[],{x:0,y:0,radius:1})).rejects.toThrow('more than 16 districts');
 await expect(discoverDistricts(file,await readImgIndex(file),new Map(),[],{x:0,y:0,radius:1})).rejects.toThrow('1–100 IPL');
});
