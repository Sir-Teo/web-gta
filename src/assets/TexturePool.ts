import type { ModelTexture } from './modelTextures';
import { nativeTexture } from './nativeTexture';
type Raster = {map:ReturnType<typeof nativeTexture>;references:number;key?:string};
/** Re-decoded rasters may share GPU storage only within an immutable dataset
 * and the same resolved TXD. Unlabeled sources retain object identity. */
export class TexturePool {
  private entries = new Map<ModelTexture, {raster:Raster;references:number}>();
  private rasters = new Map<string,Raster>();
  constructor(private readonly datasetIdentity?:string) {}
  acquire(source: ModelTexture) {
    let entry = this.entries.get(source);
    if (!entry) {
      const key=this.datasetIdentity!==undefined&&source.sourceDictionary
        ? JSON.stringify([source.sourceDictionary.toLowerCase(),source.name.toLowerCase(),source.filter,source.addressU,source.addressV,source.hasAlpha,source.mips.map(m=>[m.width,m.height])]) : undefined;
      let raster=key===undefined?undefined:this.rasters.get(key);
      if(!raster){raster={map:nativeTexture(source),references:0,key};if(key!==undefined)this.rasters.set(key,raster);}
      entry={raster,references:0};this.entries.set(source,entry);
    }
    entry.references++;entry.raster.references++;return entry.raster.map;
  }
  release(source: ModelTexture) {
    const entry = this.entries.get(source); if (!entry) return;
    if(--entry.references===0)this.entries.delete(source);
    if(--entry.raster.references===0){
      if(entry.raster.key!==undefined)this.rasters.delete(entry.raster.key);
      entry.raster.map.dispose();
    }
  }
}
