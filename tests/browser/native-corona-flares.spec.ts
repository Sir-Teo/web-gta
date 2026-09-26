import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
import {scriptClockSettled} from './scriptClock';
// CCoronas::Render's flare pass: with the morning sun on screen and its line to the camera clear, its 26 lens-flare
// sprites are strung along the line from the screen centre through it.
test('the sun draws its lens flare when it is on screen',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 await scriptClockSettled(page);await endStoryMission(page);
 await page.evaluate(()=>(window as any).__game.setTime(8*60));
 // The corona fades in only while it is on screen, so look up at the low morning sun in the east.
 await page.mouse.move(700,600);await page.mouse.down();await page.mouse.move(700,150,{steps:10});await page.mouse.up();
 let found=-1,centred=2;
 for(let i=0;i<12;i++){
  await page.evaluate(h=>(window as any).__game.turnPlayer(h),i*Math.PI/6);
  await page.waitForTimeout(400);
  const {drawn,sun}=(await state()).coronaFlares;
  if(drawn>0&&sun&&Math.abs(sun[0])<centred){found=i;centred=Math.abs(sun[0]);}
 }
 expect(found).toBeGreaterThanOrEqual(0);
 await page.evaluate(h=>(window as any).__game.turnPlayer(h),found*Math.PI/6);
 await page.waitForTimeout(700);
 // Every sprite of SunFlareDef draws while the sun's corona is lit.
 const flares=(await state()).coronaFlares;
 expect(flares.drawn).toBe(26);
 // The eighth sprite sits at a quarter of the sun's offset from the centre. Hiding the flares takes its warm light
 // off that spot and leaves the rest of the frame alone.
 const pixelAt=(ndc:[number,number])=>page.evaluate(ndc=>new Promise<number[]>(resolve=>requestAnimationFrame(()=>{
  const canvas=document.querySelector<HTMLCanvasElement>('canvas.world')!,gl=canvas.getContext('webgl2')!,pixel=new Uint8Array(4);
  gl.readPixels(Math.floor((ndc[0]+1)/2*canvas.width),Math.floor((ndc[1]+1)/2*canvas.height),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);resolve([...pixel]);
 })),ndc);
 const spot:[number,number]=[flares.sun[0]*.25,flares.sun[1]*.25];
 const lit=await pixelAt(spot);
 await page.evaluate(()=>(window as any).__game.hideFlares(true));await page.waitForTimeout(200);
 const dark=await pixelAt(spot);
 await page.evaluate(()=>(window as any).__game.hideFlares(false));await page.waitForTimeout(200);
 // The sprite is warm: it adds far more red than blue.
 expect(lit[0]-dark[0]).toBeGreaterThan(10);
 expect(lit[0]-dark[0]).toBeGreaterThan(lit[2]-dark[2]);
 await page.screenshot({path:'artifacts/native-corona-flares.png'});
 // Facing away from the sun leaves none.
 await page.evaluate(h=>(window as any).__game.turnPlayer(h),found*Math.PI/6+Math.PI);
 await expect.poll(async()=>(await state()).coronaFlares.drawn,{timeout:10000}).toBe(0);
 expect(errors).toEqual([]);
});
