import {test,expect} from 'vitest';import {readIpl} from '../src/assets/ipl';
const fields=[12.125,-34.5,7.75,1.5707963,593,-1,6,3,25,50,-1,-1];
const text=(values:(number|string)[]=fields)=>new TextEncoder().encode(`cars\n${values.join(', ')}\nend\n`);
function binary(){const b=new Uint8Array(124),v=new DataView(b.buffer);b.set(new TextEncoder().encode('bnry'));v.setUint32(20,1,true);v.setUint32(60,76,true);fields.forEach((n,i)=>{if(i<4)v.setFloat32(76+i*4,n,true);else v.setInt32(76+i*4,n,true);});return b;}
test('text and binary CFileCarGenerator records preserve all fields and radian heading',()=>{
 const a=readIpl(text()),b=readIpl(binary());expect(a.carGenerators).toEqual(b.carGenerators);expect(a.warnings).toEqual([]);expect(b.warnings).toEqual([]);
 expect(a.carGenerators[0]).toEqual({position:[12.125,-34.5,7.75],angle:Math.fround(1.5707963),modelId:593,primaryColor:-1,secondaryColor:6,flags:3,alarmChance:25,doorLockChance:50,minDelay:-1,maxDelay:-1});
});
test('binary generator bounds and overlap are checked independently of instance records',()=>{
 expect(()=>readIpl(binary().slice(0,123))).toThrow('range');const b=binary(),v=new DataView(b.buffer);v.setUint32(60,4,true);expect(()=>readIpl(b)).toThrow('range');
 const overlap=new Uint8Array(164);overlap.set(binary());const view=new DataView(overlap.buffer);view.setUint32(4,1,true);view.setUint32(28,76,true);view.setFloat32(100,1,true);view.setInt32(104,400,true);view.setUint32(108,0,true);view.setInt32(112,-1,true);expect(()=>readIpl(overlap)).toThrow('Overlapping');
});
test('random model/color and delay sentinels survive, while malformed numbers never become usable spawn records',()=>{
 const random=[...fields];random[4]=-1;random[6]=-1;expect(readIpl(text(random)).carGenerators[0]).toMatchObject({modelId:-1,primaryColor:-1,secondaryColor:-1,minDelay:-1,maxDelay:-1});
 for(const index of [0,3,4,7,11]){const bad:(number|string)[]=[...fields];bad[index]='NaN';expect(()=>readIpl(text(bad))).toThrow();}
 expect(()=>readIpl(text(fields.slice(1)))).toThrow('12 fields');
 const unsigned=[...fields];unsigned[7]=-1;expect(readIpl(text(unsigned)).carGenerators[0].flags).toBe(0xffffffff);
});
