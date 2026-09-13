import {nativeTexture} from '../assets/nativeTexture';
import type {ModelTexture} from '../assets/modelTextures';

type DecodeWorker=Pick<Worker,'onmessage'|'onerror'|'onmessageerror'|'postMessage'|'terminate'>;
/** One session owns one raster shared by both sun draws. Consumers borrow `texture`
 * for the current frame and must not dispose it or retain a replaced raster. */
export class LocalSunTexture {
  private current?:ReturnType<typeof nativeTexture>;
  private cancel?:()=>void;
  private disposed=false;
  name='';
  get texture(){return this.current;}
  constructor(private createWorker:()=>DecodeWorker=()=>new Worker(new URL('../assets/sunTexture.worker.ts',import.meta.url),{type:'module'})){}
  load(file:File):Promise<boolean>{
    if(this.disposed)return Promise.reject(new Error('Sun texture owner is disposed.'));
    this.cancel?.();
    if(file.size>64*1024*1024)return Promise.reject(new Error('Particle dictionary exceeds the 64 MiB file limit.'));
    return new Promise((resolve,reject)=>{
      const worker=this.createWorker();
      const close=()=>{worker.onmessage=null;worker.onerror=null;worker.onmessageerror=null;worker.terminate();this.cancel=undefined;};
      const cancel=()=>{if(this.cancel!==cancel)return;close();resolve(false);};
      this.cancel=cancel;
      const fail=(error:unknown)=>{if(this.cancel!==cancel)return;close();reject(error);};
      worker.onmessage=({data}:{data:{texture?:ModelTexture;error?:string}})=>{
        if(this.cancel!==cancel)return;
        try{
          if(data.error)throw new Error(data.error);
          if(!data.texture)throw new Error('Sun texture decoder returned no raster.');
          const next=nativeTexture(data.texture),previous=this.current;
          this.current=next;this.name=file.name;close();resolve(true);previous?.dispose();
        }catch(error){fail(error);}
      };
      worker.onerror=event=>{event.preventDefault();fail(new Error(event.message||'Sun texture decoder failed.'));};
      worker.onmessageerror=()=>fail(new Error('Sun texture decoder message could not be read.'));
      try{worker.postMessage(file);}catch(error){fail(error);}
    });
  }
  clear(){this.cancel?.();this.current?.dispose();this.current=undefined;this.name='';}
  dispose(){if(this.disposed)return;this.disposed=true;this.clear();}
}
