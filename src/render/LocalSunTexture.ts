import {nativeTexture} from '../assets/nativeTexture';
import type {ModelTexture} from '../assets/modelTextures';

type DecodeWorker=Pick<Worker,'onmessage'|'onerror'|'onmessageerror'|'postMessage'|'terminate'>;
/** A session owns the sun/star, cloud and water rasters as an atomic set.
 * Consumers borrow them for the current frame and must not dispose or retain replacements. */
export class LocalSunTexture {
  private current?:ReturnType<typeof nativeTexture>;
  private water?:ReturnType<typeof nativeTexture>;
  get waterTexture(){return this.water;}
  private cloud?:ReturnType<typeof nativeTexture>;
  private cancel?:()=>void;
  private disposed=false;
  name='';
  get texture(){return this.current;}
  get cloudTexture(){return this.cloud;}
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
      worker.onmessage=({data}:{data:{texture?:ModelTexture;cloud?:ModelTexture;water?:ModelTexture;error?:string}})=>{
        if(this.cancel!==cancel)return;
        let next:ReturnType<typeof nativeTexture>|undefined,cloud:ReturnType<typeof nativeTexture>|undefined,water:ReturnType<typeof nativeTexture>|undefined;
        try{
          if(data.error)throw new Error(data.error);
          if(!data.texture)throw new Error('Sun texture decoder returned no raster.');
          next=nativeTexture(data.texture);cloud=data.cloud?nativeTexture(data.cloud):undefined;water=data.water?nativeTexture(data.water):undefined;
        }catch(error){next?.dispose();cloud?.dispose();water?.dispose();fail(error);return;}
        const previous=this.current,previousCloud=this.cloud,previousWater=this.water;
        this.current=next;this.cloud=cloud;this.water=water;this.name=file.name;close();resolve(true);previous?.dispose();previousCloud?.dispose();previousWater?.dispose();
      };
      worker.onerror=event=>{event.preventDefault();fail(new Error(event.message||'Sun texture decoder failed.'));};
      worker.onmessageerror=()=>fail(new Error('Sun texture decoder message could not be read.'));
      try{worker.postMessage(file);}catch(error){fail(error);}
    });
  }
  clear(){this.cancel?.();this.current?.dispose();this.cloud?.dispose();this.water?.dispose();this.water=undefined;this.current=undefined;this.cloud=undefined;this.name='';}
  dispose(){if(this.disposed)return;this.disposed=true;this.clear();}
}
