import type * as THREE from 'three';
import {NativeLightPools} from './NativeLightPools';
import {SCRIPT_SHADOW_TEXTURES,type ScriptShadow} from './nativeScriptShadow';

/** RenderStoredShadows batches matching raster/type pairs in their first-occurrence order. */
export class NativeScriptShadows {
 private pools:NativeLightPools[];
 drawn=0;
 types:number[]=[];
 constructor(scene:THREE.Scene){this.pools=SCRIPT_SHADOW_TEXTURES.map((texture,i)=>new NativeLightPools(scene,{blend:i===2||i===4?'additive':'alpha',name:`Script shadow ${texture}`,renderOrder:5.4}));}
 clear(){for(const pool of this.pools)pool.clear();}
 frame(shadows:readonly ScriptShadow[],camera:readonly [number,number,number],receivers:Parameters<NativeLightPools['frame']>[2],raster:(name:string)=>THREE.Texture|undefined){
  const order=[...new Set(shadows.map(s=>s.textureType))];this.drawn=0;this.types=[];
  this.pools.forEach((pool,i)=>{
   pool.renderOrder=5.4+Math.max(0,order.indexOf(i+1))*.001;
   // CastPlayerShadowSectorList receives signed int16 intensity; vertex alpha narrows it to a byte.
   pool.frame(shadows.filter(s=>s.textureType===i+1).map(s=>({...s,intensity:s.intensity&255})),camera,receivers,raster(SCRIPT_SHADOW_TEXTURES[i]));
   if(pool.drawn){this.drawn+=pool.drawn;this.types.push(i+1);}
  });
 }
 dispose(){for(const pool of this.pools)pool.dispose();}
}
