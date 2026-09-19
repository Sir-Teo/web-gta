import {openStaticWorld} from '../assets/staticWorldArchive';
import {decodeTexture,readTxd} from '../assets/txd';

/** CHud's sprites from models/hud.txd (CHud::Initialise loads the dictionary), as image URLs by raster name. */
export async function loadHudSprites(base:string,names:readonly string[]){
 const source=await openStaticWorld(base),resource=source.manifest.resources.find(r=>r.path==='models/hud.txd');
 if(!resource)throw new Error('Missing models/hud.txd.');
 const rasters=readTxd(new Uint8Array(await (await source.resource(resource)).arrayBuffer())),out:Record<string,string>={};
 for(const name of names){
  const raster=rasters.find(t=>t.name.toLowerCase()===name.toLowerCase());if(!raster)continue;
  const canvas=document.createElement('canvas');canvas.width=raster.width;canvas.height=raster.height;
  canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(decodeTexture(raster,0)),raster.width,raster.height),0,0);
  out[name]=canvas.toDataURL();
 }
 return out;
}
