import {test,expect} from '@playwright/test';

test('native text sentinels suppress glyphs and backgrounds in loaded fonts and the async fallback',async({page})=>{
 await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [f,l,m]=await Promise.all(['/src/ui/NativeScriptFonts.ts','/src/ui/ScriptTextLayer.ts','/src/engine/ScmMessages.ts'].map(p=>import(/* @vite-ignore */ p))),fonts=await f.loadNativeScriptFonts(new URL('/play/world/',location.href).href),host=document.createElement('div'),fade=document.createElement('div');document.body.append(host);host.append(fade);
  const layer=new l.ScriptTextLayer(fade,fade),line=new m.ScmIntroText().pending;Object.assign(line,{key:'TEST',position:{x:20,y:20},scale:{x:1,y:2},background:true,dropShadow:0,textEdge:0});
  const draw=(text:string)=>layer.draw({lines:[line],count:1,rectangles:[],rectangleCount:0},()=>text,640,448,1),pixels=()=>Array.from(host.querySelectorAll<HTMLCanvasElement>('canvas')).some(c=>c.getContext('2d')!.getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0)),frame=()=>host.querySelector<HTMLCanvasElement>('canvas.after-fade')!.getContext('2d')!.getImageData(0,0,640,448).data;
  const checks:boolean[]=[];
  try{
   for(const loaded of [false,true]){if(loaded)layer.setFonts(fonts);for(const text of ['', '*A','\0A']){draw('A');checks.push(pixels());draw(text);checks.push(!pixels());}draw('~r~*A');checks.push(pixels());draw('A\0B');const a=frame();draw('A');const b=frame();checks.push(a.every((v,i)=>v===b[i]));}
   const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d')!;for(const text of ['', '*A','\0A'])checks.push(fonts.draw(ctx,line,text,1,1)&&!ctx.getImageData(0,0,64,64).data.some((v,i)=>i%4===3&&v>0));
   return checks;
  }finally{layer.dispose();host.remove();}
 });expect(result).toEqual(Array(19).fill(true));
});
