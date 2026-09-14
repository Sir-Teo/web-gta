import {decodeSkyTextures} from './sunTexture';
self.onmessage=async({data:file}:{data:File})=>{
  try{
    if(file.size>64*1024*1024)throw new Error('Particle dictionary exceeds the 64 MiB file limit.');
    const result=decodeSkyTextures(new Uint8Array(await file.arrayBuffer()));
    self.postMessage(result,{transfer:[result.texture,...(result.cloud?[result.cloud]:[])].flatMap(t=>t.mips.map(m=>m.data.buffer as ArrayBuffer))});
  }catch(error){self.postMessage({error:error instanceof Error?error.message:'Could not decode the sun texture.'});}
};
