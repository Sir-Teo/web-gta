import {expect,test,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {readScmHeader,decodeScmInstructions} from '../src/assets/scm';
import {ScmMission} from '../src/simulation/ScmMission';
const script=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm'));
const floatBitsAsCoordinate=(value:number)=>{const b=new DataView(new ArrayBuffer(4));b.setFloat32(0,value,true);return Math.fround(b.getInt32(0,true));};

test('both actual SYND4 sites preserve the iOS handler’s integer conversion of collected float bits',()=>{
 const calls=vi.fn(),mission=new ScmMission(script,{infoLabels:['TEST'],population:[]} as any,{createScriptBirds:calls} as any),block=readScmHeader(script).missions[61];
 const sites=decodeScmInstructions(script,block.start,block.end).filter(i=>i.opcode===0x876);expect(sites).toHaveLength(2);
 for(const i of sites){const code=new Uint8Array(i.end-i.offset+2);code.set(script.subarray(i.offset,i.end));code.set([0x4e,0],i.end-i.offset);mission.runtime.start(0,[],{space:code}).thread.run(1000,100,1);}
 for(let n=0;n<sites.length;n++){const p=sites[n].parameters.map(p=>p.value as number);expect(calls.mock.calls[n]).toEqual([p.slice(0,3).map(floatBitsAsCoordinate),p.slice(3,6).map(floatBitsAsCoordinate),3,0]);}
 // This is a native dispatch quirk: it is not a truncation of the source floats to sensible map coordinates.
 expect(calls.mock.calls[0][0][0]).toBeGreaterThan(1e9);expect(calls.mock.calls[1][0][0]).toBeLessThan(-9e8);
});

test('integer coordinates and raw biome/count values reach the host without ambient gates',()=>{
 const calls=vi.fn(),mission=new ScmMission(script,{infoLabels:['TEST'],population:[]} as any,{createScriptBirds:calls} as any),code=new Uint8Array(44),view=new DataView(code.buffer);
 view.setUint16(0,0x876,true);let at=2;for(const n of [16777217,-123,28,4,5,6,-3,99]){code[at++]=1;view.setInt32(at,n,true);at+=4;}view.setUint16(at,0x4e,true);
 mission.runtime.start(0,[],{space:code}).thread.run(1000,100,1);expect(calls).toHaveBeenCalledExactlyOnceWith([16777216,-123,28],[4,5,6],-3,99);
});
