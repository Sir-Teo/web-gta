import {test,expect} from '@playwright/test';
test('ordinary native exterior alpha uses strict source references and preserves depth through fades',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('/tests/fixtures/world-alpha.html');const r=await page.evaluate(()=>(window as any).worldAlphaProbe());
 const red=[255,0,0],expected={exterior:[red,red,red,red,[0,141,114],[0,255,0]],drawLast:[red,red,[0,101,154],[0,140,115],[0,141,114],[0,255,0]],interiorDrawLast:[red,[0,100,155],[0,101,154],[0,140,115],[0,141,114],[0,255,0]],fade:[red,[0,50,205],[0,51,204],[0,70,185],[0,71,184],[0,128,127]],noDepth:[red,red,red,red,red,red]};
 for(const [name,pixels] of Object.entries(expected)){pixels.forEach((rgb,i)=>rgb.forEach((v,j)=>expect(Math.abs(r[name].pixels[i][j]-v),`${name}/${i}/${j}`).toBeLessThanOrEqual(1)));expect(r[name].restored).toBe(true);}
 expect(r.exterior.state.depthWrite).toBe(true);expect(r.fade.state.depthWrite).toBe(true);expect(r.noDepth.state.depthWrite).toBe(false);expect(r.source).toEqual({depthWrite:false,alphaTest:1/255});expect(errors).toEqual([]);
});
