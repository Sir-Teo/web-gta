import {openStaticWorld} from '../assets/staticWorldArchive';
import {readTxd,decodeTexture} from '../assets/txd';
import {requireAsset} from '../assets/binary';
import type {ScmIntroTextLine} from '../engine/ScmMessages';
import {scriptFontGlyph} from './nativeScriptTextWidth';
import {scriptTextSuppressed} from './nativeScriptTextTokens';
import {scriptFontLineHeight,scriptFontBackgroundBounds,scriptFontAdvance,scriptRasterLayout} from './nativeScriptFontLayout';
export {scriptRasterWidth,scriptRasterRows,scriptRasterLayout} from './nativeScriptFontLayout';
type RGBA=readonly number[];
/** Atlas cells are 32 by 40 pixels; the final row has 32 pixels. Native PrintChar's ordinary quads are
 * 32 x 20 times the font scale, with a shorter final row. Exact native UV insets/filtering remain unverified. */
export function scriptGlyphCell(index:number){return {x:(index&15)*32,y:(index>>4)*40,width:32,height:index>=192?32:40};}
function canvas(width:number,height:number){const out=document.createElement('canvas');out.width=width;out.height=height;return out;}
/** The PC glyph masks, tinted on demand. Four cached coloured atlases cap extra canvas storage at 4 MiB. */
export class NativeScriptFonts {
 private readonly tinted=new Map<string,HTMLCanvasElement>();
 private disposed=false;
 constructor(private readonly atlases:readonly HTMLCanvasElement[]){}
 private colour(texture:number,c:RGBA){
  const key=`${texture}:${c[0]},${c[1]},${c[2]}`,found=this.tinted.get(key);if(found){this.tinted.delete(key);this.tinted.set(key,found);return found;}
  const source=this.atlases[texture],out=canvas(source.width,source.height),ctx=out.getContext('2d')!;ctx.drawImage(source,0,0);ctx.globalCompositeOperation='source-in';ctx.fillStyle=`rgb(${c[0]},${c[1]},${c[2]})`;ctx.fillRect(0,0,out.width,out.height);
  this.tinted.set(key,out);if(this.tinted.size>4){const first=this.tinted.keys().next().value!,old=this.tinted.get(first)!;this.tinted.delete(first);old.width=old.height=1;}return out;
 }
 private glyph(ctx:CanvasRenderingContext2D,ch:string,line:ScmIntroTextLine,x:number,y:number,sx:number,sy:number,c:RGBA){
  let glyph:ReturnType<typeof scriptFontGlyph>;try{glyph=scriptFontGlyph(ch,line.fontStyle);}catch{return;}
  if(glyph.index===0||glyph.index>=208||!(c[3]>0))return;
  const cell=scriptGlyphCell(glyph.index);ctx.globalAlpha=c[3]/255;ctx.drawImage(this.colour(glyph.texture,c),cell.x,cell.y,cell.width,cell.height,x,y,32*line.scale.x*sx,(glyph.index>=192?8:10)*line.scale.y*sy);
 }
 draw(ctx:CanvasRenderingContext2D,line:ScmIntroTextLine,text:string,sx:number,sy:number){
  if(scriptTextSuppressed(text))return true;
  if(this.disposed||!Number.isInteger(line.fontStyle)||line.fontStyle<0||line.fontStyle>3)return false;
  const height=scriptFontLineHeight(line.scale.y,sy);if(!(height>0)||!(line.scale.x>0))return true;
  const y=line.position.y*sy,rows=scriptRasterLayout(text,line);
  ctx.save();ctx.imageSmoothingEnabled=true;
  if(line.background){const c=line.backgroundColour,b=scriptFontBackgroundBounds(line,rows.length,sx,sy);ctx.globalAlpha=c[3]/255;ctx.fillStyle=`rgb(${c[0]},${c[1]},${c[2]})`;ctx.fillRect(b.left,b.top,b.right-b.left,b.bottom-b.top);}
  rows.forEach((row,index)=>{
   const left=row.x*sx,top=y+index*height;
   let pen=0;for(const {character:ch,colour} of row.glyphs){const at=left+pen*sx,edge=line.textEdge;
    if(edge>0){for(const [dx,dy] of [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]])this.glyph(ctx,ch,line,at+dx*edge*sx,top+dy*edge*sy,sx,sy,line.dropShadowColour);}
    else if(line.dropShadow>0)this.glyph(ctx,ch,line,at+line.dropShadow*sx,top+line.dropShadow*sy,sx,sy,line.dropShadowColour);
    this.glyph(ctx,ch,line,at,top,sx,sy,colour);pen=Math.fround(pen+scriptFontAdvance(ch,line));if(ch===' ')pen=Math.fround(pen+row.extra);
   }
  });ctx.restore();return true;
 }
 dispose(){if(this.disposed)return;this.disposed=true;for(const c of [...this.atlases,...this.tinted.values()])c.width=c.height=1;this.tinted.clear();}
}
/** CFont::Initialise selects font2 for Gothic/menu and font1 for subtitles/pricedown. */
export async function loadNativeScriptFonts(base:string){
 const source=await openStaticWorld(base),resource=source.manifest.resources.find(r=>r.path==='models/fonts.txd');requireAsset(resource,'PC FONTS.TXD is not published.');
 const rasters=readTxd(new Uint8Array(await(await source.resource(resource)).arrayBuffer())),atlases:HTMLCanvasElement[]=[];
 try{for(const name of ['font2','font1']){const raster=rasters.find(r=>r.name===name);requireAsset(raster?.width===512&&raster.height===512,`Missing PC ${name} atlas`);const out=canvas(512,512);out.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(decodeTexture(raster,0)),512,512),0,0);atlases.push(out);}return new NativeScriptFonts(atlases);}
 catch(error){for(const out of atlases)out.width=out.height=1;throw error;}
}
