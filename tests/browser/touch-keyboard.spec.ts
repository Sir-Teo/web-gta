import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** A keyboard played on a touch screen (a tablet's, or one paired with a phone): the touch buttons give way to the keys
 * and the help names the keys, as for a played pad; a finger dragging on the right still looks without bringing them
 * back, while a tap there, or a touch elsewhere, does. */
test.use({hasTouch:true,viewport:{width:1024,height:768}});
test('a tablet played with its keyboard puts the touch buttons away until it is touched',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?touch=1');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 const controls=page.locator('.touch-controls'),fire=page.getByRole('button',{name:'Fire',exact:true});
 await expect(fire).toBeVisible();await expect(controls).not.toHaveClass(/\bkeys\b/);
 const help=()=>page.evaluate(()=>{const g=(window as any).__game.missionForProfiling().runtime.game;g.help.set('Hold ~k~~PED_SPRINT~ to run.',false,true,false,g.messages);});
 await help();await expect(page.locator('.help-box')).toHaveText('Hold SPRINT to run.');
 // A key the game reads: the buttons go, the help shown reads again with the key's name, and the key walks CJ.
 const start=await page.evaluate(()=>({...(window as any).__game.state().player.position}));
 await page.keyboard.down('KeyW');
 await expect(controls).toHaveClass(/\bkeys\b/);await expect(fire).toBeHidden();
 await expect(page.locator('.help-box')).toHaveText('Hold SHIFT to run.');
 await expect.poll(()=>page.evaluate(s=>{const p=(window as any).__game.state().player.position;return Math.hypot(p.x-s.x,p.z-s.z);},start),{timeout:8000}).toBeGreaterThan(.5);
 await page.keyboard.up('KeyW');
 const cdp=await page.context().newCDPSession(page);
 const touch=(type:'touchStart'|'touchMove'|'touchEnd',x:number,y:number)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y,id:7}]});
 // A drag on the right looks, and the buttons stay away.
 const yaw=()=>page.evaluate(()=>(window as any).__game.state().camera.viewYaw as number);const before=await yaw();
 await touch('touchStart',700,300);for(let i=1;i<=8;i++){await touch('touchMove',700-i*15,300);await page.waitForTimeout(30);}await touch('touchEnd',580,300);
 await page.waitForTimeout(300);expect(Math.abs(await yaw()-before)).toBeGreaterThan(.02);
 await expect(controls).toHaveClass(/\bkeys\b/);await expect(fire).toBeHidden();
 // A tap there brings them back, and the help names the touch buttons again.
 await touch('touchStart',700,300);await touch('touchEnd',700,300);
 await expect(controls).not.toHaveClass(/\bkeys\b/);await expect(fire).toBeVisible();
 await help();await expect(page.locator('.help-box')).toHaveText('Hold SPRINT to run.');
 // Keys again, then a touch on the stick's side brings them back at once.
 await page.keyboard.press('KeyD');await expect(fire).toBeHidden();
 await touch('touchStart',120,600);await touch('touchEnd',120,600);
 await expect(fire).toBeVisible();
 // A volume or media key leaves the touch buttons as they are.
 await page.keyboard.press('AudioVolumeUp');await page.waitForTimeout(300);await expect(fire).toBeVisible();
 expect(errors).toEqual([]);
});
