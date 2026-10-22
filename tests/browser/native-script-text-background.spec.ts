import {test,expect} from '@playwright/test';

test('script text uses one PC background rectangle for the whole block in native fonts and fallback',async({page})=>{
 await page.goto('/models.html');const checks=await page.evaluate(async()=>{
  const [f,l,m]=await Promise.all(['/src/ui/NativeScriptFonts.ts','/src/ui/ScriptTextLayer.ts','/src/engine/ScmMessages.ts'].map(p=>import(/* @vite-ignore */ p))),fonts=await f.loadNativeScriptFonts(new URL('/play/world/',location.href).href),host=document.createElement('div'),fade=document.createElement('div');document.body.append(host);host.append(fade);const layer=new l.ScriptTextLayer(fade,fade),line=new m.ScmIntroText().pending;
  Object.assign(line,{key:'TEST',position:{x:100,y:40},scale:{x:1,y:2},wrapX:211,centreSize:112,background:true,backgroundColour:[17,61,103,128],colour:[255,0,0,0],dropShadow:0,textEdge:0});
  const expected=document.createElement('canvas');expected.width=640;expected.height=448;const reference=expected.getContext('2d')!,results:boolean[]=[];
  try{
   for(const loaded of [false,true]){if(loaded)layer.setFonts(fonts);
    for(const [centred,rightJustify,left,width] of [[false,false,96,119],[true,false,40,120],[false,true,-4,104]] as const){
     Object.assign(line,{centred,rightJustify});layer.draw({lines:[line],count:1,rectangles:[],rectangleCount:0},()=> 'A\nA',640,448,1);
     reference.clearRect(0,0,640,448);reference.fillStyle='rgba(17,61,103,0.5019607843137255)';reference.fillRect(left,36,width,44);
     const actual=host.querySelector<HTMLCanvasElement>('canvas.after-fade')!.getContext('2d')!.getImageData(0,0,640,448).data,match=reference.getImageData(0,0,640,448).data;results.push(actual.every((v,i)=>v===match[i]));
    }
   }return results;
  }finally{layer.dispose();host.remove();}
 });expect(checks).toEqual(Array(6).fill(true));
});
