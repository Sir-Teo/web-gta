import {existsSync,readFileSync} from 'node:fs';
import {test,expect} from '@playwright/test';
import {readNativeFootsteps} from '../../src/assets/nativeFootsteps';
import {PLAYER_CLASSIC_FILES} from '../../src/assets/readPlayerBaseBody';
for(const variant of ['fat','normal'] as const)test(`native clothed ${variant} player installs through the workshop and keeps shoulder correction through locomotion`,async({page:entry})=>{
 test.setTimeout(90000);let page=entry;
 const root=process.env.GTA_CONTENT_DIR,reference=process.env.GTA_REFERENCE_DIR;
 const animation=variant==='normal'?`${root}/animations/ped.ifp`:`${reference}/fat.ifp`;
 test.skip(!root||!existsSync(animation),'Requires acquired native player files and matching movement IFP.');
 const clips=variant==='normal'?['IDLE_stance','WALK_player','run_player']:['FatIdle','FatWalk','FatRun'];
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 if(variant==='normal'){
  await entry.context().addInitScript(()=>{
   const gains=new WeakMap<AudioBufferSourceNode,GainNode>(),connect=AudioNode.prototype.connect,start=AudioBufferSourceNode.prototype.start;
   (window as any).__footstepStarts=[];
   AudioNode.prototype.connect=function(this:AudioNode,...args:any[]){
    if(this instanceof AudioBufferSourceNode&&args[0] instanceof GainNode)gains.set(this,args[0]);
    return (connect as any).apply(this,args);
   } as any;
   AudioBufferSourceNode.prototype.start=function(...args:any[]){
    const gain=gains.get(this);if(this.buffer&&gain)(window as any).__footstepStarts.push({rate:this.buffer.sampleRate,frames:this.buffer.length,gain:gain.gain.value,playbackRate:this.playbackRate.value});
    return (start as any).apply(this,args);
   };
  });
  await entry.goto('/models.html');await entry.getByLabel('Local content folder',{exact:true}).setInputFiles(root!);
  await entry.getByLabel('Map region',{exact:true}).selectOption('grove-street');
  await entry.getByRole('button',{name:'Load region from folder',exact:true}).click();
  await expect(entry.getByRole('status')).toHaveText('Archive scene assembled locally.',{timeout:45000});
  const imported=entry.waitForEvent('popup');await entry.getByRole('button',{name:'Walk scene',exact:true}).click();page=await imported;
  page.on('pageerror',e=>errors.push(e.message));
  await page.getByRole('button',{name:'Walk imported scene',exact:true}).click();
  expect(await page.evaluate(()=>(window as any).__game.state().lighting.imported)).toBe('timecycp.dat');
  expect(await page.evaluate(()=>(window as any).__game.state().audio.surfaceDefinitions)).toBeGreaterThan(100);
  expect(await page.evaluate(()=>(window as any).__game.state().audio.nativeFootstepBanks)).toBe(7);
 }else{
  await page.goto('/?area=verdant-meadows');await page.getByRole('button',{name:'Explore Verdant Meadows',exact:true}).click();
 }
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().player.grounded)).toBe(true);
 await page.keyboard.press('Escape');
 const popup=page.waitForEvent('popup');await page.getByRole('link',{name:'Open character workshop for this session'}).click();const workshop=await popup;
 workshop.on('pageerror',e=>errors.push(e.message));
 await workshop.getByText('Assemble native CJ',{exact:true}).click();
 await workshop.getByLabel('CJ body and clothing files',{exact:true}).setInputFiles(`${root}/player/player.dff`);
 await workshop.getByRole('button',{name:'Assemble CJ',exact:true}).click();await expect(workshop.getByRole('status')).toContainText('Missing player base file: torso.dff');
 await workshop.getByLabel('CJ body and clothing files',{exact:true}).setInputFiles(PLAYER_CLASSIC_FILES.map(n=>`${root}/player/${n}`));
 await workshop.getByLabel('CJ body variant',{exact:true}).selectOption(variant);
 await workshop.getByRole('button',{name:'Assemble CJ',exact:true}).click();
 await expect(workshop.getByRole('status')).toHaveText('Native CJ assembled locally.');
 await expect(workshop.locator('#summary')).toContainText(`${variant} · classic · 1721 vertices · 2332 triangles`);
 await expect(workshop.getByLabel('Character coordinates',{exact:true})).toHaveValue('san-andreas-ped');
 await expect(workshop.getByLabel('Character coordinates',{exact:true})).toBeDisabled();
 expect(await workshop.evaluate(()=>(window as any).__modelPreview.state().playerBody)).toBe(true);
 await workshop.getByLabel('Optional .ifp animations',{exact:true}).setInputFiles(animation);
 await expect(workshop.getByLabel('Animation clip',{exact:true})).toBeEnabled();
 if(variant==='normal'){
  await workshop.getByRole('button',{name:'Assign normal CJ movement',exact:true}).click();
  await expect(workshop.locator('#character-assignments')).toHaveText('Idle: IDLE_stance · Walk: WALK_player · Run: run_player · Sprint: sprint_civi');
  await expect(workshop.getByLabel('Animation movement',{exact:true})).toHaveValue('0');
  await workshop.screenshot({path:'artifacts/native-cj-movement-preset.png',fullPage:true});
 }else for(const [clip,role] of [[clips[0],'idle'],[clips[1],'walk'],[clips[2],'run']]){
  await workshop.getByLabel('Animation clip',{exact:true}).selectOption({label:clip});
  if(role!=='idle')await workshop.getByLabel('Animation movement',{exact:true}).selectOption('0');
  await workshop.getByRole('button',{name:`Assign ${role}`,exact:true}).click();
 }
 await workshop.getByLabel('Model preview').screenshot({path:`artifacts/native-cj-${variant}-workshop.png`});
 await workshop.getByRole('button',{name:'Use character in linked game',exact:true}).click();
 await expect(workshop.locator('#animation-status')).toHaveText('Character installed. Return to the linked game to play.');
 await page.bringToFront();await page.getByRole('button',{name:'Resume game',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().nativeCharacter.playerBody)).toBe(true);
 const before=await page.evaluate(()=>(window as any).__game.state().player.position);
 if(variant==='normal')await page.keyboard.down('AltLeft');
 await page.keyboard.down('KeyW');await page.waitForTimeout(700);
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().nativeCharacter.action)).toBe('walk');
 if(variant==='normal'){
  await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().audio.nativeShotsPlayed)).toBeGreaterThan(0);
  const file=(path:string,name:string)=>new File([readFileSync(`${root}/audio/${path}`)],name);
  const banks=await readNativeFootsteps({bankLookup:file('CONFIG/BankLkup.dat','BankLkup.dat'),packageLookup:file('CONFIG/PakFiles.dat','PakFiles.dat'),feet:file('SFX/FEET','FEET')});
  const generic=banks[0].slice(1,6),starts=await page.evaluate(()=>(window as any).__footstepStarts as {rate:number;frames:number;gain:number;playbackRate:number}[]);
  const native=starts.flatMap(start=>{const sample=generic.find((s:any)=>s.sampleRate===start.rate&&s.pcm16.length/2===start.frames);return sample?[{start,sample}]:[];});
  expect(native.length).toBeGreaterThan(0);
  for(const {start,sample} of native){
   expect(start.gain).toBeCloseTo(.32*10**(-Math.fround(sample.headroom/100)/20),6);
   expect(start.playbackRate).toBeGreaterThanOrEqual(.9411999);expect(start.playbackRate).toBeLessThanOrEqual(1.0588001);
  }
 }
 await page.screenshot({path:`artifacts/native-cj-${variant}-walking.png`});
 if(variant==='normal')await page.keyboard.up('AltLeft');
 await page.keyboard.down('ShiftLeft');await page.waitForTimeout(350);
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().nativeCharacter.action)).toBe(variant==='normal'?'sprint':'run');
 await page.screenshot({path:`artifacts/native-cj-${variant}-${variant==='normal'?'sprinting':'running'}.png`});
 await page.keyboard.up('ShiftLeft');
 if(variant==='normal'){
  await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().nativeCharacter.action)).toBe('run');
  await page.screenshot({path:'artifacts/native-cj-normal-running.png'});
 }
 await page.keyboard.up('KeyW');await page.waitForTimeout(250);
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().nativeCharacter.action)).toBe('idle');
 const after=await page.evaluate(()=>(window as any).__game.state().player.position);
 expect(Math.hypot(after.x-before.x,after.z-before.z)).toBeGreaterThan(.3);
 await page.screenshot({path:`artifacts/native-cj-${variant}-idle.png`});
 if(variant==='normal'){
  const audioState=()=>page.evaluate(()=>(window as any).__game.state().audio);
  const original=(await audioState()).settings;
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Audio',exact:true}).click();
  for(const setting of ['mute','effects','master'] as const){
   await expect.poll(async()=>(await audioState()).context).toBe('suspended');expect((await audioState()).voices).toBe(0);
   if(setting==='mute')await page.getByLabel('Mute all sound').check();
   else await page.getByLabel(setting==='effects'?'Sound effects':'Master volume').fill('0');
   const count=(await audioState()).nativeShotsPlayed;
   await page.getByRole('button',{name:'Resume game',exact:true}).click();
   await page.keyboard.down('KeyW');await page.waitForTimeout(650);await page.keyboard.up('KeyW');await page.waitForTimeout(300);
   expect((await audioState()).nativeShotsPlayed).toBe(count);expect((await audioState()).voices).toBe(0);
   await page.keyboard.press('Escape');
   if(setting==='mute')await page.getByLabel('Mute all sound').uncheck();
   else await page.getByLabel(setting==='effects'?'Sound effects':'Master volume').fill(String(Math.round(original[setting]*100)));
   await page.getByRole('button',{name:'Resume game',exact:true}).click();await page.waitForTimeout(300);
   expect((await audioState()).nativeShotsPlayed).toBe(count);
   await page.keyboard.down('KeyW');await expect.poll(async()=>(await audioState()).nativeShotsPlayed).toBeGreaterThan(count);await page.keyboard.up('KeyW');await page.waitForTimeout(200);
   await page.keyboard.press('Escape');
  }
  await page.getByRole('button',{name:'Resume game',exact:true}).click();
  await page.keyboard.press('KeyC');
  await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().nativeCharacter.action)).toBe('crouchIdle');
  await page.waitForTimeout(300);
  expect(await page.evaluate(()=>(window as any).__game.state().nativeCharacter.visible)).toBe(true);
  await page.screenshot({path:'artifacts/native-cj-normal-crouch-idle.png'});
  await page.keyboard.down('KeyW');await page.waitForTimeout(700);
  await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().nativeCharacter.action)).toBe('crouchWalk');
  await page.screenshot({path:'artifacts/native-cj-normal-crouch-walk.png'});
  await page.keyboard.up('KeyW');await page.keyboard.press('KeyC');
  await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().nativeCharacter.action)).toBe('idle');
  const flight=page.evaluate(()=>new Promise<any[]>((resolve,reject)=>{
   const samples:any[]=[];let landed=false,frame=0;
   const timeout=setTimeout(()=>{cancelAnimationFrame(frame);reject(new Error('Native jump did not return to idle.'));},6000);
   const sample=()=>{
    const s=(window as any).__game.state(),action=s.nativeCharacter.action;
    samples.push({action,visible:s.nativeCharacter.visible,grounded:s.player.grounded,y:s.player.position.y,x:s.player.position.x,z:s.player.position.z});
    landed ||= action==='landing';
    if(landed&&action==='idle'){clearTimeout(timeout);resolve(samples);return;}
    frame=requestAnimationFrame(sample);
   };sample();
  }));
  await page.keyboard.press('Space');
  await page.waitForFunction(()=>(window as any).__game.state().nativeCharacter.action==='airborne');
  await page.screenshot({path:'artifacts/native-cj-normal-jump.png'});
  const samples=await flight;
  expect(samples.some(s=>s.action==='launch')).toBe(true);
  expect(samples.some(s=>s.action==='airborne'&&!s.grounded)).toBe(true);
  expect(samples.some(s=>s.action==='landing'&&s.grounded)).toBe(true);
  expect(samples.every(s=>s.visible)).toBe(true);
  const firstLanding=samples.find(s=>s.action==='landing'),lastLanding=samples.filter(s=>s.action==='landing').at(-1);
  expect(Math.hypot(lastLanding.x-firstLanding.x,lastLanding.z-firstLanding.z)).toBeGreaterThan(.2);
  expect(Math.max(...samples.map(s=>s.y))-samples[0].y).toBeGreaterThan(.2);
  expect(Math.abs(samples.at(-1).y-samples[0].y)).toBeLessThan(.08);
  await page.waitForTimeout(300);
  await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().nativeCharacter.action)).toBe('idle');
  await page.screenshot({path:'artifacts/native-cj-normal-after-jump.png'});
  await page.keyboard.down('KeyW');await page.waitForTimeout(600);
  await page.keyboard.press('Space');
  await page.waitForFunction(()=>(window as any).__game.state().nativeCharacter.action==='airborne');
  await page.waitForFunction(()=>(window as any).__game.state().nativeCharacter.action==='landingMoving');
  expect(await page.evaluate(()=>(window as any).__game.state().nativeCharacter.visible)).toBe(true);
  expect(await page.evaluate(()=>(window as any).__game.state().nativeCharacter.playbackSpeed)).toBe(1);
  await page.screenshot({path:'artifacts/native-cj-normal-moving-land.png'});
  await page.keyboard.up('KeyW');
  await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().nativeCharacter.action)).toBe('idle');
  await page.keyboard.down('ShiftLeft');await page.keyboard.down('KeyW');await page.waitForTimeout(600);
  await page.keyboard.press('Space');
  await page.waitForFunction(()=>(window as any).__game.state().nativeCharacter.action==='airborne');
  const sprintLanding=await page.waitForFunction(()=>{const s=(window as any).__game.state();return s.nativeCharacter.action==='landingMoving'?{speed:s.nativeCharacter.playbackSpeed,visible:s.nativeCharacter.visible}:false;});
  expect(await sprintLanding.jsonValue()).toEqual({speed:2,visible:true});
  await page.keyboard.up('ShiftLeft');await page.keyboard.up('KeyW');
  await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().nativeCharacter.action)).toBe('idle');
 }
 await workshop.getByLabel('Open a .dff model',{exact:true}).setInputFiles('tests/fixtures/dragonff-skin.dff');
 await expect(workshop.getByRole('status')).toHaveText('dragonff-skin.dff loaded locally.');
 expect(await workshop.evaluate(()=>(window as any).__modelPreview.state().playerBody)).toBe(false);
 await expect(workshop.getByLabel('Character coordinates',{exact:true})).toBeEnabled();
 await expect(workshop.getByRole('button',{name:'Assign normal CJ movement',exact:true})).toBeDisabled();
 expect(errors).toEqual([]);await workshop.close();
});
