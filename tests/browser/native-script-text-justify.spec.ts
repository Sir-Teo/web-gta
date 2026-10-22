import {test,expect} from '@playwright/test';

test('native wrapped spans and signed justification place atlas and fallback glyphs at captured positions',async({page})=>{
 await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [f,l,m,txd]=await Promise.all(['/src/ui/NativeScriptFonts.ts','/src/ui/ScriptTextLayer.ts','/src/engine/ScmMessages.ts','/src/assets/txd.ts'].map(p=>import(/* @vite-ignore */ p))),fonts=await f.loadNativeScriptFonts(new URL('/play/world/',location.href).href),host=document.createElement('div'),fade=document.createElement('div');document.body.append(host);host.append(fade);const layer=new l.ScriptTextLayer(fade,fade),line=new m.ScmIntroText().pending;
  Object.assign(line,{key:'TEST',position:{x:100,y:40},scale:{x:1,y:2},centreSize:85,background:false,colour:[255,255,255,255],dropShadow:0,textEdge:0,justify:true});
  const cases=[{text:'A A A',centred:false,rightJustify:false,wrapX:185,at:[[100,40],[148,40],[100,58]]},{text:'A A A',centred:true,rightJustify:false,wrapX:185,at:[[63,40],[100,40],[87.5,58]]},{text:'A  A A',centred:false,rightJustify:false,wrapX:185,at:[[100,40],[148,40],[100,58]]},{text:'A A A A',centred:false,rightJustify:true,wrapX:85,at:[[1,40],[25,40],[49,40],[75,58]]},{text:'A A .A',centred:false,rightJustify:false,wrapX:185,justify:false,at:[[100,40],[137,40],[183,40]],dot:[174,40]}];
  const draw=(text:string)=>layer.draw({lines:[line],count:1,rectangles:[],rectangleCount:0},()=>text,640,448,1),fallback:number[][][]=[],pixels:boolean[]=[];
  const fill=CanvasRenderingContext2D.prototype.fillText;let capture:number[][]=[];CanvasRenderingContext2D.prototype.fillText=function(text,x,y,...rest){if(text==='A'&&this.canvas===host.querySelector('canvas.after-fade')){const t=this.getTransform();capture.push([Math.round((t.e+x*t.a)*1e6)/1e6,Math.round((t.f+y*t.d)*1e6)/1e6]);}return fill.call(this,text,x,y,...rest);};
  try{
   for(const c of cases){Object.assign(line,{justify:true},c);capture=[];draw(c.text);fallback.push(capture);}
  }finally{CanvasRenderingContext2D.prototype.fillText=fill;}
  const rasters=txd.readTxd(new Uint8Array(await(await fetch('/play/world/files/models/fonts.txd')).arrayBuffer())),raster=rasters.find((r:any)=>r.name==='font2'),atlas=document.createElement('canvas');atlas.width=atlas.height=512;atlas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(txd.decodeTexture(raster,0)),512,512),0,0);const expected=document.createElement('canvas');expected.width=640;expected.height=448;const reference=expected.getContext('2d')!;
  try{
   layer.setFonts(fonts);for(const c of cases){Object.assign(line,{justify:true},c);draw(c.text);reference.clearRect(0,0,640,448);for(const [x,y] of c.at)reference.drawImage(atlas,32,80,32,40,x,y,32,20);if(c.dot)reference.drawImage(atlas,448,0,32,40,c.dot[0],c.dot[1],32,20);const a=host.querySelector<HTMLCanvasElement>('canvas.after-fade')!.getContext('2d')!.getImageData(0,0,640,448).data,b=reference.getImageData(0,0,640,448).data;pixels.push(a.every((v,i)=>v===b[i]));}
   return {fallback,expected:cases.map(c=>c.at),pixels};
  }finally{layer.dispose();host.remove();}
 });expect(result.fallback.map(row=>row.length)).toEqual(result.expected.map(row=>row.length));for(let i=0;i<result.expected.length;i++)for(let j=0;j<result.expected[i].length;j++)for(let axis=0;axis<2;axis++)expect(result.fallback[i][j][axis]).toBeCloseTo(result.expected[i][j][axis],4);expect(result.pixels).toEqual(Array(5).fill(true));
});
