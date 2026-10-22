import * as THREE from 'three';
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
  private fog?:ReturnType<typeof nativeTexture>;
  /** `cloudmasked` for CClouds::MovingFogRender, sampled with its render states (linear filter, clamped addressing). */
  get fogTexture(){return this.fog;}
  private pool?:ReturnType<typeof nativeTexture>;
  /** `shad_exp`, the additive light pool CShadows stores under 2d effect lights. */
  get poolTexture(){return this.pool;}
  private extras=new Map<string,ReturnType<typeof nativeTexture>>();
  /** One of EXTRA_SKY_TEXTURES, by lowercase name. */
  extraTexture(name:string){return this.extras.get(name);}
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
      worker.onmessage=({data}:{data:{texture?:ModelTexture;cloud?:ModelTexture;water?:ModelTexture;fog?:ModelTexture;pool?:ModelTexture;extras?:ModelTexture[];error?:string}})=>{
        if(this.cancel!==cancel)return;
        let next:ReturnType<typeof nativeTexture>|undefined,cloud:ReturnType<typeof nativeTexture>|undefined,water:ReturnType<typeof nativeTexture>|undefined,fog:ReturnType<typeof nativeTexture>|undefined,pool:ReturnType<typeof nativeTexture>|undefined;
        const extras=new Map<string,ReturnType<typeof nativeTexture>>();
        try{
          if(data.error)throw new Error(data.error);
          if(!data.texture)throw new Error('Sun texture decoder returned no raster.');
          next=nativeTexture(data.texture);cloud=data.cloud?nativeTexture(data.cloud):undefined;water=data.water?nativeTexture(data.water):undefined;
          if(data.fog){fog=nativeTexture(data.fog);fog.magFilter=fog.minFilter=THREE.LinearFilter;fog.wrapS=fog.wrapT=THREE.ClampToEdgeWrapping;}
          // RenderStaticShadows samples with rwFILTERLINEAR.
          if(data.pool){pool=nativeTexture(data.pool);pool.magFilter=pool.minFilter=THREE.LinearFilter;pool.wrapS=pool.wrapT=THREE.ClampToEdgeWrapping;}
          // RenderStoredShadows samples its rasters clamped and linear.
          for(const extra of data.extras??[]){const t=nativeTexture(extra);if(extra.name.toLowerCase().startsWith('shad_')||['headlight','bloodpool_64'].includes(extra.name.toLowerCase())){t.magFilter=t.minFilter=THREE.LinearFilter;t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;}extras.set(extra.name.toLowerCase(),t);}
        }catch(error){next?.dispose();cloud?.dispose();water?.dispose();fog?.dispose();pool?.dispose();extras.forEach(t=>t.dispose());fail(error);return;}
        const previous=this.current,previousCloud=this.cloud,previousWater=this.water,previousFog=this.fog,previousPool=this.pool,previousExtras=this.extras;
        this.current=next;this.cloud=cloud;this.water=water;this.fog=fog;this.pool=pool;this.extras=extras;this.name=file.name;close();resolve(true);previous?.dispose();previousCloud?.dispose();previousWater?.dispose();previousFog?.dispose();previousPool?.dispose();previousExtras.forEach(t=>t.dispose());
      };
      worker.onerror=event=>{event.preventDefault();fail(new Error(event.message||'Sun texture decoder failed.'));};
      worker.onmessageerror=()=>fail(new Error('Sun texture decoder message could not be read.'));
      try{worker.postMessage(file);}catch(error){fail(error);}
    });
  }
  clear(){this.cancel?.();this.current?.dispose();this.cloud?.dispose();this.water?.dispose();this.fog?.dispose();this.pool?.dispose();this.extras.forEach(t=>t.dispose());this.extras=new Map();this.water=undefined;this.current=undefined;this.cloud=undefined;this.fog=undefined;this.pool=undefined;this.name='';}
  dispose(){if(this.disposed)return;this.disposed=true;this.clear();}
}
