import {test,expect} from '@playwright/test';
test('native resampling and paired blur retain alignment, clamp edges and preserve renderer state',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('/tests/fixtures/shadow-filter.html');await page.waitForFunction(()=>typeof (window as any).shadowFilterProbe==='function');
 const result=await page.evaluate(()=>(window as any).shadowFilterProbe());
 let expected=Array(64).fill(0);expected[0]=255;expected[4*8+3]=255;
 const half=(input:number[],dx:number,dy:number)=>input.map((_,i)=>{
  const x=i%8,y=Math.floor(i/8),at=(x:number,y:number)=>input[Math.max(0,Math.min(7,y))*8+Math.max(0,Math.min(7,x))];
  return Math.round((at(x,y)+at(x+dx,y)+at(x,y+dy)+at(x+dx,y+dy))/4);
 });
 for(let passes=0;passes<3;passes++){
  if(passes)expected=half(half(expected,1,-1),-1,1);
  result.samples[passes].forEach((value:number,i:number)=>expect(Math.abs(value-expected[i]),`pass ${passes}, pixel ${i}`).toBeLessThanOrEqual(1));
 }
 result.combined.forEach((value:number,i:number)=>expect(Math.abs(value-Math.round(expected[i]*[76,84,92,100,108,116,124,128][Math.floor(i/8)]/255))).toBeLessThanOrEqual(2));
 result.gradient.forEach((value:number,i:number)=>expect(Math.abs(value-[76,84,92,100,108,116,124,128][Math.floor(i/8)])).toBeLessThanOrEqual(1));
 expect(result.reset.every((value:number)=>value===255)).toBe(true);
 expect(result.after).toEqual(result.before);expect(errors).toEqual([]);
});
