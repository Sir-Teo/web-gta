import {test,expect} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
test('actual FAM1 animation is captured and projected with stable candidate sphere framing',async({page})=>{
 const directory=process.env.GTA_REFERENCE_DIR;test.skip(!directory,'Set GTA_REFERENCE_DIR for local FAM1 and animation data.');
 const [dff,ifp]=await Promise.all([readFile(join(directory!,'fam1.dff')),readFile(join(directory!,'fat.ifp'))]);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/tests/fixtures/native-shadow.html');
 const result=await page.evaluate(input=>(window as any).nativeShadowProbe(input),{dff:[...dff],ifp:[...ifp]});
 await writeFile('/tmp/web-gta-native-shadow-framing.json',JSON.stringify(result,null,2));
 expect(result.tracks).toBe(32);expect(result.samples).toHaveLength(192);
 for(const sample of result.samples)expect(sample.pixels).toBeGreaterThan(100);
 const padded=result.samples.filter((sample:{scale:number})=>sample.scale===1.1);
 expect(padded).toHaveLength(96);
 for(const sample of padded){expect(sample.outsideVertices,`${sample.clip}/${sample.azimuth}/${sample.phase}`).toBe(0);expect(sample.border).toBe(0);}
 // Keep the failing unpadded control: otherwise a broken measurement returning
 // zero for every vertex could falsely certify the padded candidate.
 for(const name of ['FatWalk','FatRun'])expect(result.samples.some((sample:{clip:string;scale:number;outsideVertices:number})=>sample.clip===name&&sample.scale===1&&sample.outsideVertices>0)).toBe(true);
 expect(result.firstMass).toBeGreaterThan(1000);expect(result.secondMass).toBeGreaterThan(1000);expect(result.changedPixels).toBeGreaterThan(100);
 expect(result.hiddenMass).toBe(0);expect(result.repeatChangedPixels).toBe(0);expect(errors).toEqual([]);
 await page.locator('canvas').screenshot({path:'artifacts/native-fam1-shadow.png'});
});
