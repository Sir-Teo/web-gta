import {openStaticWorld} from '../assets/staticWorldArchive';
import {readTxd,decodeTexture,type NativeTexture} from '../assets/txd';
import {requireAsset} from '../assets/binary';
import {assetConnectionRetryMs} from '../assets/assetConnectionRetry';
import {RECT_TEXTURED,RECT_MONOCOLOR_ANGLED,type ScmSpriteBinding,type ScmIntroRectangle} from '../engine/ScmMessages';
type SpritePixels={width:number;height:number;pixels:Uint8Array|Uint8ClampedArray;smooth:boolean};
type Dictionary={textures?:Map<string,NativeTexture>;request:Promise<void>;error?:string;failures:number;retry?:ReturnType<typeof setTimeout>};
type Tint={source:string;canvas:HTMLCanvasElement};
const key=(b:ScmSpriteBinding)=>JSON.stringify([b.dictionary,b.name]);
/** D3D texture-stage RGB modulation. Alpha stays in the source image and is multiplied by globalAlpha at draw. */
export function modulateScriptSprite(pixels:Uint8Array|Uint8ClampedArray,colour:readonly number[]){
 const out=new Uint8ClampedArray(pixels);for(let at=0;at<out.length;at+=4)for(let channel=0;channel<3;channel++)out[at+channel]=Math.round(out[at+channel]*colour[channel]/255);return out;
}
function image(data:SpritePixels,colour?:readonly number[]){
 const canvas=document.createElement('canvas');canvas.width=data.width;canvas.height=data.height;
 canvas.getContext('2d')!.putImageData(new ImageData(colour?modulateScriptSprite(data.pixels,colour):new Uint8ClampedArray(data.pixels),data.width,data.height),0,0);return canvas;
}
function release(canvas:HTMLCanvasElement){canvas.width=canvas.height=1;}
/** ScriptSprites' bound texture resources. Loading is asynchronous in the browser; revisions redraw a cached frame
 * when a dictionary arrives. Native RenderWare filtering/mip/viewport precision is not fully reproduced. */
export class NativeScriptSprites {
 private bindings:readonly (ScmSpriteBinding|undefined)[]=[];
 private signature='';private disposed=false;
 private readonly dictionaries=new Map<string,Dictionary>();
 private readonly decoded=new Map<string,SpritePixels>();
 private readonly images=new Map<string,HTMLCanvasElement>();
 private readonly tints=new Map<string,Tint>();
 private readonly errors=new Map<string,string>();
 revision=0;
 constructor(private readonly fetchDictionary:(name:string)=>Promise<readonly NativeTexture[]>){ }
 setBindings(bindings:readonly (ScmSpriteBinding|undefined)[]){
  if(this.disposed)return;
  const signature=JSON.stringify(bindings);if(signature===this.signature)return;this.signature=signature;this.bindings=bindings.map(b=>b&&({...b}));this.revision++;
  const needed=new Set(this.bindings.filter((b):b is ScmSpriteBinding=>!!b?.dictionary).map(key)),dictionaries=new Set(this.bindings.flatMap(b=>b?.dictionary?[b.dictionary]:[]));
  for(const [name,record] of this.dictionaries)if(!dictionaries.has(name)){if(record.retry!==undefined)clearTimeout(record.retry);this.dictionaries.delete(name);}
  for(const [name] of this.decoded)if(!needed.has(name))this.decoded.delete(name);
  for(const [name,canvas] of this.images)if(!needed.has(name)){release(canvas);this.images.delete(name);}
  for(const [name,tint] of this.tints)if(!needed.has(tint.source)){release(tint.canvas);this.tints.delete(name);}
  this.errors.clear();
  for(const name of dictionaries){
   if(this.dictionaries.has(name))continue;
   const record:Dictionary={request:Promise.resolve(),failures:0};this.dictionaries.set(name,record);this.request(name,record);
  }
 }
 /** Connection errors may recover without a new LOAD_SPRITE or a changed frame. Invalid content stays observable. */
 private request(name:string,record:Dictionary){
  record.retry=undefined;record.error=undefined;
  record.request=Promise.resolve().then(()=>this.fetchDictionary(name)).then(textures=>{
   if(this.disposed||this.dictionaries.get(name)!==record)return;
   record.textures=new Map(textures.map(texture=>[texture.name.toLowerCase(),texture]));record.failures=0;this.revision++;
  }).catch(error=>{
   if(this.disposed||this.dictionaries.get(name)!==record)return;
   record.error=String(error);record.failures++;this.revision++;
   const delay=assetConnectionRetryMs(error,record.failures);
   if(delay!==undefined){
    record.retry=setTimeout(()=>{if(!this.disposed&&this.dictionaries.get(name)===record){this.revision++;this.request(name,record);}},delay);
   }
  });
 }
 async settled(){await Promise.all([...this.dictionaries.values()].map(d=>d.request));}
 pixelsFor(slot:number):SpritePixels|undefined{
  const binding=this.bindings[slot];if(this.disposed||!binding?.dictionary)return;
  const id=key(binding),cached=this.decoded.get(id);if(cached)return cached;
  const record=this.dictionaries.get(binding.dictionary);if(!record?.textures)return;
  const texture=record.textures.get(binding.name.toLowerCase());
  if(!texture){this.errors.set(id,`Missing script texture ${binding.dictionary}/${binding.name}`);return;}
  try{const data={width:texture.width,height:texture.height,pixels:decodeTexture(texture,0),smooth:[2,5,6].includes(texture.filter)};this.decoded.set(id,data);return data;}
  catch(error){this.errors.set(id,String(error));}
 }
 private bitmap(slot:number,colour:readonly number[]){
  const data=this.pixelsFor(slot),binding=this.bindings[slot];if(!data||!binding)return;
  const source=key(binding);
  if(colour[0]===255&&colour[1]===255&&colour[2]===255){let canvas=this.images.get(source);if(!canvas){canvas=image(data);this.images.set(source,canvas);}return {canvas,smooth:data.smooth};}
  const id=JSON.stringify([source,...colour.slice(0,3)]),old=this.tints.get(id);
  if(old){this.tints.delete(id);this.tints.set(id,old);return {canvas:old.canvas,smooth:data.smooth};}
  const canvas=image(data,colour);this.tints.set(id,{source,canvas});
  if(this.tints.size>8){const first=this.tints.keys().next().value!;release(this.tints.get(first)!.canvas);this.tints.delete(first);}
  return {canvas,smooth:data.smooth};
 }
 draw(ctx:CanvasRenderingContext2D,rectangle:ScmIntroRectangle,sx:number,sy:number){
  if(rectangle.type!==RECT_TEXTURED&&rectangle.type!==RECT_MONOCOLOR_ANGLED)return false;
  if(rectangle.colour[3]<=0)return true;
  const bitmap=this.bitmap(rectangle.textureId,rectangle.colour);if(!bitmap)return true;
  const a=rectangle.cornerA,b=rectangle.cornerB,width=(b.x-a.x)*sx,height=(b.y-a.y)*sy;
  ctx.save();ctx.globalAlpha=rectangle.colour[3]/255;ctx.imageSmoothingEnabled=bitmap.smooth;
  ctx.translate((a.x+b.x)*.5*sx,(a.y+b.y)*.5*sy);if(rectangle.type===RECT_MONOCOLOR_ANGLED)ctx.rotate(rectangle.angle);
  ctx.scale(width<0?-1:1,height<0?-1:1);ctx.drawImage(bitmap.canvas,-Math.abs(width)*.5,-Math.abs(height)*.5,Math.abs(width),Math.abs(height));ctx.restore();return true;
 }
 state(){return {retrying:[...this.dictionaries.values()].filter(d=>d.retry!==undefined).length,pending:[...this.dictionaries.values()].filter(d=>!d.textures&&!d.error).length,loaded:[...this.dictionaries].filter(([,d])=>!!d.textures).map(([name])=>name),errors:[...[...this.dictionaries.values()].flatMap(d=>d.error?[d.error]:[]),...this.errors.values()],decoded:this.decoded.size,tints:this.tints.size};}
 dispose(){if(this.disposed)return;this.disposed=true;for(const record of this.dictionaries.values())if(record.retry!==undefined)clearTimeout(record.retry);for(const canvas of this.images.values())release(canvas);for(const tint of this.tints.values())release(tint.canvas);this.images.clear();this.tints.clear();this.decoded.clear();this.dictionaries.clear();this.errors.clear();this.bindings=[];this.revision++;}
}
export function createNativeScriptSprites(base:string){
 let source:ReturnType<typeof openStaticWorld>|undefined;
 const open=()=>{if(!source){const pending=openStaticWorld(base);source=pending;void pending.catch(()=>{if(source===pending)source=undefined;});}return source;};
 return new NativeScriptSprites(async name=>{const world=await open(),resource=world.manifest.resources.find(r=>r.path===`models/txd/${name.toLowerCase()}.txd`);requireAsset(resource,`Script texture dictionary is not published: ${name}`);return readTxd(new Uint8Array(await(await world.resource(resource)).arrayBuffer()));});
}
