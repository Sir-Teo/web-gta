import {test,expect} from '@playwright/test';
test('native player alpha rejects bytes zero and one while surviving fragments blend and occlude',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('/tests/fixtures/player-alpha.html');const results=await page.evaluate(()=>(window as any).playerAlphaProbe());
 for(const result of results){
  expect(result.depthWrite).toBe(true);
  [[255,0,0],[255,0,0],[0,2,253],[0,128,127],[0,255,0]].forEach((rgb,i)=>rgb.forEach((v,j)=>expect(Math.abs(result.pixels[i][j]-v),`${i}/${j}`).toBeLessThanOrEqual(1)));
 }
 expect(errors).toEqual([]);
});
