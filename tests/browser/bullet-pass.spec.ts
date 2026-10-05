import {test,expect} from '@playwright/test';
// CBulletTraces::AddTrace reports a shot crossing the camera plane within 2 units, and CAEFrontendAudioEntity plays a
// whizz from its bullet-pass bank (SND_BANK_GENRL_BULLET_PASS_1, rebuilt from the iOS bundle) in slot 42.
test('a shot past the camera whizzes',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 // CAEFrontendAudioEntity::Initialise's bank, fetched and checked like the PC banks.
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().audio.native?.banks.slots.some(([slot,bank]:number[])=>slot===42&&bank===28)),{timeout:30000}).toBe(true);
 let heard=0;
 for(let k=0;k<6&&!heard;k++){
  // From 15 units behind the camera to 15 in front, one unit to its right.
  await page.evaluate(()=>{const g=(window as any).__game,c=g.state().camera,p=c.position;
   const fx=-Math.sin(c.yaw),fz=-Math.cos(c.yaw),rx=Math.cos(c.yaw),rz=-Math.sin(c.yaw);
   g.traceBullet({x:p[0]-fx*15+rx,y:p[1],z:p[2]-fz*15+rz},{x:p[0]+fx*15+rx,y:p[1],z:p[2]+fz*15+rz});});
  for(let i=0;i<10&&!heard;i++){await page.waitForTimeout(100);heard=await page.evaluate(()=>(window as any).__game.state().audio.native.slots[42]??0);}
 }
 expect(heard).toBeGreaterThan(0);
 expect(errors).toEqual([]);
});
