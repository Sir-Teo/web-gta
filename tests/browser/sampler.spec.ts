import {test,expect} from '@playwright/test';
test('native mip modes distinguish texel and mip interpolation on the GPU',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/tests/fixtures/sampler-probe.html');
 await page.waitForFunction(()=>typeof (window as any).sampleNativeFilter==='function');
 const sample=(filter:number,lod:number,one=false)=>page.evaluate(([f,l,o])=>(window as any).sampleNativeFilter(f,l,o),[filter,lod,one]);
 const close=(actual:number[],expected:number[])=>actual.forEach((n,i)=>expect(Math.abs(n-expected[i])).toBeLessThanOrEqual(2));
 close(await sample(4,.25),[128,0,128,255]);
 close(await sample(5,.25),[0,64,191,255]);
 close(await sample(4,-1),[128,0,128,255]);
 close(await sample(5,-1),[0,0,255,255]);
 close(await sample(4,2,true),[128,0,128,255]);
 close(await sample(5,2,true),[0,0,255,255]);
 expect(errors).toEqual([]);
});
