import {expect,test} from 'vitest';
import {NativeAudioEngine,NATIVE_AUDIO_FRAME_MS} from '../src/audio/native/NativeAudioEngine';
import {NativeBankLoader,SLOT,type NativeBankManifest} from '../src/audio/native/NativeBankLoader';
import type {NativeCamera} from '../src/audio/native/NativeSound';
const camera=(x=0,y=0,z=0):NativeCamera=>({position:{x,y,z},right:{x:1,y:0,z:0},forward:{x:0,y:1,z:0},up:{x:0,y:0,z:1},firstPerson:false,justSwitched:false});
const flush=()=>new Promise(r=>setTimeout(r,0));
function syntheticBank(count:number){
  const samples=800,bytes=new Uint8Array(4804+count*samples*2),view=new DataView(bytes.buffer);view.setUint16(0,count,true);
  for(let i=0;i<count;i++){const e=4+i*12;view.setUint32(e,i*samples*2,true);view.setUint32(e+4,0xffffffff,true);view.setUint16(e+8,8000,true);view.setInt16(e+10,0,true);}
  return {bytes,dataBytes:count*samples*2};
}
function engine(){
  const banks=new Map<number,ReturnType<typeof syntheticBank>>();
  const manifest:NativeBankManifest={version:1,packageSha256:'',banks:[]};
  for(let id=0;id<=143;id++){const b=syntheticBank(6);banks.set(id,b);manifest.banks.push({id,path:`bank-${id}.bin`,dataBytes:b.dataBytes,bytes:b.bytes.length,sounds:16,sha256:''});}
  const loader=new NativeBankLoader(manifest,async entry=>banks.get(entry.id)!.bytes);
  let n=0;return new NativeAudioEngine(loader,undefined,()=>((n++*.6180339)%1));
}
const cityInput=(over={})=>({rain:0,windClipped:0,lightningDuration:0,noRain:false,outside:true,cameraZ:10,
  city:{camPos:{x:0,y:0,z:5},camRight:{x:1,y:0,z:0},camForward:{x:0,y:1,z:0},playerPos:{x:0,y:0,z:0},inVehicle:false,moveSpeed:{x:0,y:0,z:0},los:()=>undefined,...over}});

test('city noise starts its stereo bed outside and stays silent indoors',{timeout:30000},async()=>{
  const e=engine();await flush();
  for(let i=0;i<5;i++){e.frame(NATIVE_AUDIO_FRAME_MS,()=>({camera:camera(),vehicles:[],weather:cityInput()}));await flush();}
  const bed=e.manager.sounds.filter(s=>s.inUse&&s.event===3);
  expect(bed).toHaveLength(2);
  expect(bed.map(s=>s.sound)).toEqual([0,0]);
  // Indoors the bed fades out.
  for(let i=0;i<60;i++){e.frame(NATIVE_AUDIO_FRAME_MS,()=>({camera:camera(),vehicles:[],weather:{...cityInput(),outside:false}}));await flush();}
  expect(e.manager.sounds.filter(s=>s.inUse&&s.event===3)).toHaveLength(0);
});

test('city noise whooshes speed up past lateral geometry when driving',{timeout:30000},async()=>{
  const e=engine();await flush();
  e.eventVolumes=new Int8Array(45402);
  for(let i=0;i<5;i++){e.frame(NATIVE_AUDIO_FRAME_MS,()=>({camera:camera(),vehicles:[],weather:cityInput({inVehicle:true,moveSpeed:{x:0,y:2,z:0},los:()=>({point:{x:4+i,y:1,z:5},physical:{x:0,y:0,z:0},entity:i})}) as never}));await flush();}
  const bed=e.manager.sounds.filter(s=>s.inUse&&s.event===3);
  expect(bed.length).toBeGreaterThanOrEqual(1);
  expect(Math.max(...bed.map(s=>s.speed))).toBeGreaterThan(1.75);
  // The same entity a frame later is not new: the bed goes back to its normal speed.
  for(let i=0;i<3;i++){e.frame(NATIVE_AUDIO_FRAME_MS,()=>({camera:camera(),vehicles:[],weather:cityInput({inVehicle:true,moveSpeed:{x:0,y:2,z:0},los:()=>({point:{x:4,y:1,z:5},physical:{x:0,y:0,z:0},entity:'wall'})}) as never}));await flush();}
  expect(Math.max(...e.manager.sounds.filter(s=>s.inUse&&s.event===3).map(s=>s.speed))).toBe(1);
});
