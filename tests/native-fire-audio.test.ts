import {expect,test} from 'vitest';
import {NativeAudioEngine,NATIVE_AUDIO_FRAME_MS} from '../src/audio/native/NativeAudioEngine';
import {NativeBankLoader,SLOT,type NativeBankManifest} from '../src/audio/native/NativeBankLoader';
import type {NativeCamera} from '../src/audio/native/NativeSound';
const camera=(x=0,y=0,z=0):NativeCamera=>({position:{x,y,z},right:{x:1,y:0,z:0},forward:{x:0,y:1,z:0},up:{x:0,y:0,z:1},firstPerson:false,justSwitched:false});
const flush=()=>new Promise(r=>setTimeout(r,0));
function syntheticBank(count:number,loop=true){
 const samples=800,bytes=new Uint8Array(4804+count*samples*2),view=new DataView(bytes.buffer);view.setUint16(0,count,true);
 for(let i=0;i<count;i++){const e=4+i*12;view.setUint32(e,i*samples*2,true);view.setUint32(e+4,loop?0:0xffffffff,true);view.setUint16(e+8,8000,true);view.setInt16(e+10,0,true);}
 return {bytes,dataBytes:count*samples*2};
}
function engine(){
 const banks=new Map<number,ReturnType<typeof syntheticBank>>();
 const manifest:NativeBankManifest={version:1,packageSha256:'',banks:[]};
 const counts:Record<number,number>={13:2,27:24,39:72,52:5,59:31,74:14,105:16,138:45,143:89};
 for(let id=0;id<=143;id++){const b=syntheticBank(counts[id]??6);banks.set(id,b);manifest.banks.push({id,path:`bank-${id}.bin`,dataBytes:b.dataBytes,bytes:b.bytes.length,sounds:16,sha256:''});}
 const loader=new NativeBankLoader(manifest,async entry=>banks.get(entry.id)!.bytes);
 let n=0;return new NativeAudioEngine(loader,undefined,()=>((n++*.6180339)%1));
}
const fireFrame=(fire:{},at={x:0,y:5,z:0})=>(e:NativeAudioEngine)=>e.frame(NATIVE_AUDIO_FRAME_MS,()=>({camera:camera(),vehicles:[],fires:[[fire,at]]}));

test('burning fires start the crackle pair at the EVENTVOL fire volume',{timeout:30000},async()=>{
 const e=engine();await flush();
 e.eventVolumes=new Int8Array(45402).fill(-4);
 const fire={};
 for(let i=0;i<3;i++){fireFrame(fire)(e);await flush();}
 const crackle=e.manager.sounds.filter(s=>s.inUse&&s.slot===SLOT.explosions&&s.sound===0);
 const low=e.manager.sounds.filter(s=>s.inUse&&s.slot===SLOT.vehicleGen&&s.sound===26);
 expect(crackle).toHaveLength(1);expect(low).toHaveLength(1);
 expect(crackle[0].volume).toBe(-4);
 expect(low[0].clientVariable).toBe(-1);
 expect(low[0].speed).toBeCloseTo(.6,10);
 // The low loop ramps +2 dB per frame toward its ceiling, then fades.
 for(let i=0;i<12;i++){fireFrame(fire)(e);await flush();}
 expect(low[0].event).toBe(2);
 expect(e.snapshot().fires).toBe(1);
});

test('fires stop sounding once their owner is gone',{timeout:30000},async()=>{
 const e=engine();await flush();
 const fire={};
 fireFrame(fire)(e);await flush();
 expect(e.manager.sounds.filter(s=>s.inUse&&(s.slot===SLOT.explosions||s.slot===SLOT.vehicleGen)).length).toBeGreaterThan(0);
 // Physical stops propagate over frames: unbind, then clear.
 e.frame(NATIVE_AUDIO_FRAME_MS,()=>({camera:camera(),vehicles:[]}));
 e.frame(NATIVE_AUDIO_FRAME_MS,()=>({camera:camera(),vehicles:[]}));
 await flush();
 expect(e.manager.sounds.filter(s=>s.inUse&&(s.slot===SLOT.explosions||s.slot===SLOT.vehicleGen))).toHaveLength(0);
 expect(e.snapshot().fires).toBe(0);
});
