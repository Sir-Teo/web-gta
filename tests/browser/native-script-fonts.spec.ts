import {test,expect} from '@playwright/test';

test('script text uses the packaged PC glyph masks, native advances and both fade layers',async({page})=>{
 await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const paths=['/src/ui/NativeScriptFonts.ts','/src/ui/ScriptTextLayer.ts','/src/engine/ScmMessages.ts','/src/assets/txd.ts'];
  const [fontsModule,layerModule,messages,txd]=await Promise.all(paths.map(p=>import(/* @vite-ignore */ p)));
  const fonts=await fontsModule.loadNativeScriptFonts(new URL('/play/world/',location.href).href),host=document.createElement('div'),fade=document.createElement('div');document.body.append(host);host.append(fade);
  const layer=new layerModule.ScriptTextLayer(fade,fade);layer.setFonts(fonts);
  const line=new messages.ScmIntroText().pending;Object.assign(line,{key:'TEST',scale:{x:1,y:2},position:{x:100,y:40},fontStyle:0,colour:[255,0,0,255],dropShadow:0,textEdge:0,drawBeforeFade:false,wrapX:640,background:false});
  const after=host.querySelector('canvas.after-fade') as HTMLCanvasElement,before=host.querySelector('canvas.before-fade') as HTMLCanvasElement;
  const draw=(text:string)=>layer.draw({lines:[{...line}],count:1,rectangles:[],rectangleCount:0},()=>text,640,448,1);
  // An independent crop from the locked raw atlas detects accidental fallback to a browser typeface.
  const rasters=txd.readTxd(new Uint8Array(await(await fetch('/play/world/files/models/fonts.txd')).arrayBuffer())),atlases=['font2','font1'].map(name=>{const raster=rasters.find((r:any)=>r.name===name),c=document.createElement('canvas');c.width=c.height=512;c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(txd.decodeTexture(raster,0)),512,512),0,0);return c;});
  const expected=document.createElement('canvas');expected.width=640;expected.height=448;const reference=expected.getContext('2d')!;
  const equal=()=>{const a=after.getContext('2d')!.getImageData(0,0,640,448).data,b=reference.getImageData(0,0,640,448).data;return a.every((v,i)=>v===b[i]);};
  const renderReference=(font:number,at:number,step:number,count:number)=>{reference.clearRect(0,0,640,448);const cell=font>=2?{x:352,y:360}:{x:32,y:80};for(let i=0;i<count;i++)reference.drawImage(atlases[font===1||font===3?1:0],cell.x,cell.y,32,40,at+i*step,40,32,20);reference.globalCompositeOperation='source-in';reference.fillStyle='red';reference.fillRect(0,0,640,448);reference.globalCompositeOperation='source-over';};
  const measure=CanvasRenderingContext2D.prototype.measureText;CanvasRenderingContext2D.prototype.measureText=function(){throw Error('Native script text called browser font metrics');};
  const checks:boolean[]=[];
  try{
   for(const [font,width] of [[0,25],[1,22],[2,29],[3,19]]){line.fontStyle=font;line.centred=false;line.rightJustify=false;draw('AA');renderReference(font,100,width,2);checks.push(equal());}
   line.fontStyle=0;line.centred=true;draw('AA');renderReference(0,75,25,2);checks.push(equal());
   line.centred=false;line.rightJustify=true;draw('AA');renderReference(0,50,25,2);checks.push(equal());
   // Two leading spaces advance 24 units; alignment measures them along with the two 25-unit As.
   for(const [centred,rightJustify,first] of [[false,false,124],[true,false,87],[false,true,50]] as const){line.centred=centred;line.rightJustify=rightJustify;draw('  AA');renderReference(0,first,25,2);checks.push(equal());}
   line.centred=false;line.rightJustify=false;line.wrapX=211;
   for(const text of ['AA AA','AA  AA']){draw(text);renderReference(0,100,25,2);reference.drawImage(atlases[0],32,80,32,40,100,58,32,20);reference.drawImage(atlases[0],32,80,32,40,125,58,32,20);reference.globalCompositeOperation='source-in';reference.fillStyle='red';reference.fillRect(0,0,640,448);reference.globalCompositeOperation='source-over';checks.push(equal());}
  }finally{CanvasRenderingContext2D.prototype.measureText=measure;}
  line.colour=[10,20,30,128];line.wrapX=211;draw('~r~AA ~h~AA~n~~s~A');reference.clearRect(0,0,640,448);
  // Native palette/highlight values and expected wrapped positions are supplied independently of the parser.
  for(const [y,colour,count] of [[40,[180,25,29],2],[58,[255,37,43],2],[76,[225,225,225],1]] as const){const tinted=document.createElement('canvas');tinted.width=tinted.height=512;const ctx=tinted.getContext('2d')!;ctx.drawImage(atlases[0],0,0);ctx.globalCompositeOperation='source-in';ctx.fillStyle=`rgb(${colour.join(',')})`;ctx.fillRect(0,0,512,512);reference.globalAlpha=128/255;for(let i=0;i<count;i++)reference.drawImage(tinted,32,80,32,40,100+i*25,y,32,20);}
  reference.globalAlpha=1;checks.push(equal());line.colour=[255,0,0,255];
  line.wrapX=640;line.dropShadow=2;line.dropShadowColour=[0,0,255,255];draw('A');const pixels=after.getContext('2d')!.getImageData(0,0,640,448).data;let red=0,blue=0;for(let i=0;i<pixels.length;i+=4){if(pixels[i]>0)red++;if(pixels[i+2]>0)blue++;}
  line.dropShadow=0;line.textEdge=2;draw('A');const outlined=after.getContext('2d')!.getImageData(0,0,640,448).data;let outlineBlue=0;for(let i=0;i<outlined.length;i+=4)if(outlined[i+2]>0)outlineBlue++;
  line.drawBeforeFade=true;draw('A');const fadePass=before.hidden===false&&after.hidden===true;
  layer.draw(undefined,()=>'',640,448,1);const cleared=before.hidden&&after.hidden;
  layer.dispose();const disposed=host.querySelectorAll('canvas').length===0&&!layer.nativeFontsReady;host.remove();
  // Installing fonts invalidates an earlier fallback frame, including the following empty frame.
  const h=document.createElement('div'),f=document.createElement('div');document.body.append(h);h.append(f);const delayed=new layerModule.ScriptTextLayer(f,f);line.drawBeforeFade=false;delayed.draw({lines:[line],count:1,rectangles:[],rectangleCount:0},()=> 'A',640,448,1);delayed.setFonts(await fontsModule.loadNativeScriptFonts(new URL('/play/world/',location.href).href));delayed.draw(undefined,()=>'',640,448,1);const delayedCleared=Array.from(h.querySelectorAll('canvas')).every(c=>c.hidden);delayed.dispose();h.remove();
  return {checks,red,blue,outlineBlue,fadePass,cleared,disposed,delayedCleared};
 });
 expect(result.checks).toEqual(Array(12).fill(true));expect(result.red).toBeGreaterThan(0);expect(result.blue).toBeGreaterThan(0);expect(result.outlineBlue).toBeGreaterThan(result.blue);expect(result.fadePass).toBe(true);expect(result.cleared).toBe(true);expect(result.disposed).toBe(true);expect(result.delayedCleared).toBe(true);
});
