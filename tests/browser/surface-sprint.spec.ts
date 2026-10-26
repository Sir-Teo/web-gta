import {test,expect} from '@playwright/test';
for(const restricted of [true,false])test(`native surface sprint restriction ${restricted?'downgrades to run':'allows sprint'}`,async({page})=>{
 const token=`surface-${restricted}`;
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({token,restricted})=>{
  const channel=new BroadcastChannel(`scene-test-${token}`);
  channel.onmessage=async({data})=>{
   if(data.type!=='ready')return;
   const modulePath='/src/assets/dff.ts';const {readDff}=await import(modulePath);
   const model=readDff(new Uint8Array(await(await fetch('/tests/fixtures/dragonff-model.dff')).arrayBuffer()));
   const mesh={positions:new Float32Array([-50,-50,0,50,-50,0,50,50,0,-50,50,0]),indices:new Uint32Array([0,1,2,0,2,3]),materials:new Uint8Array([0,0]),lights:new Uint8Array([187,187])};
   const collision={name:'floor',id:0,version:3,flags:2,bounds:{min:[-50,-50,0],max:[50,50,0],center:[0,0,0],radius:71},spheres:[],boxes:[],mesh,shadow:null,faceGroups:[],warnings:[]};
   const flags=Array(29).fill('0');flags[15]=restricted?'1':'0';
   const row=['DEFAULT','ROAD','1','-.25','DEFAULT','NONE',...flags,'NONE','DEFAULT'].join(' ');
   const part={name:'floor',model,collision,textures:[],dictionaryNames:[],notices:[],placements:[{modelId:1,modelName:'floor',instanceType:0,interior:0,position:[0,0,0],rotation:[0,0,0,1],lodIndex:-1}]};
   channel.postMessage({type:'scene',parts:[part],preferredSpawn:{x:0,z:0},environment:{surfaceInfo:new File([row],'surfinfo.dat')}});
   channel.close();
  };
 },{token,restricted});
 await page.goto(`/?sceneTest=${token}`);
 await expect(page.getByRole('button',{name:'Walk imported scene',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Walk imported scene',exact:true}).click();
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 expect((await state()).movementSurfaceDefinitions).toBe(1);
 await page.keyboard.down('ShiftLeft');await page.keyboard.down('KeyW');
 await expect.poll(async()=>(await state()).player.speed).toBeGreaterThan(restricted?3.5:6.5);
 const running=await state();expect(running.surfaceSprintBlocked).toBe(restricted);
  if(restricted){expect(running.player.speed).toBeLessThan(6);expect(running.player.stamina).toBe(450);}
 else await expect.poll(async()=>(await state()).player.stamina).toBeLessThan(450);
 await page.keyboard.up('KeyW');await page.keyboard.up('ShiftLeft');expect(errors).toEqual([]);
});
