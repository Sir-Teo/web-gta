import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** Gyro aiming (a touch setting, off by default): while Aim is held the phone turned turns the camera, degree for
 * degree; not aiming, or with the setting off, the phone's turning aims nothing. The device's rotation rate is stood in
 * for by devicemotion events, about the screen's up axis whichever way the screen is turned. */
test.use({hasTouch:true,isMobile:true,viewport:{width:844,height:390}});
test('with gyro aiming on, turning the phone while aiming turns the view',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{try{localStorage.setItem('grove-touch-v1',JSON.stringify({gyroAim:true,aimAssist:false,steering:'stick',steeringChosen:true,qualityChosen:true,layoutOn:'port-widescreen'}));}catch{}});
 await page.goto('/?touch=1');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);await page.waitForTimeout(1000);
 const yaw=()=>page.evaluate(()=>(window as any).__game.render().yaw as number);
 // A quarter second turning left at 40 degrees a second, about the screen's up axis.
 // The degrees the phone turned: the rate over the time between events (a gap past a tenth of a second, a stream
 // that stopped, counting nothing).
 const turnLeft=()=>page.evaluate(()=>new Promise<number>(done=>{const angle=screen.orientation?.angle??0;
  const up=[[0,1],[1,0],[0,-1],[-1,0]][((Math.round(angle/90)%4)+4)%4];let n=0,last:number|undefined,degrees=0;
  const tick=()=>{const e=new DeviceMotionEvent('devicemotion',{rotationRate:{alpha:0,beta:40*up[0],gamma:40*up[1]},interval:16});window.dispatchEvent(e);
   if(last!==undefined){const gap=(e.timeStamp-last)/1000;if(gap<=.1)degrees+=40*gap;}last=e.timeStamp;if(++n<16)setTimeout(tick,16);else setTimeout(()=>done(degrees),300);};tick();}));
 // Not aiming: nothing.
 let before=await yaw();await turnLeft();expect(Math.abs(await yaw()-before)).toBeLessThan(.01);
 // Aim held (the Aim button latches): the view turns left as far as the phone did.
 const aim=page.getByRole('button',{name:'Aim',exact:true});
 for(const type of ['pointerdown','pointerup'])await aim.dispatchEvent(type,{pointerType:'touch',pointerId:5});
 await expect(aim).toHaveClass(/\bon\b/);
 before=await yaw();const phone=await turnLeft(),turned=(await yaw()-before)*180/Math.PI;
 expect(phone).toBeGreaterThan(5);expect(Math.abs(turned-phone)).toBeLessThan(phone*.05);
 // Setting it off in the menu: the phone's turning aims nothing again.
 await page.locator('.touch-button.pause').dispatchEvent('pointerdown',{pointerType:'touch'});
 await page.getByRole('button',{name:'Controls',exact:true}).tap();
 const gyro=page.getByLabel('Gyro aiming',{exact:true});await expect(gyro).toBeChecked();await gyro.uncheck();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('grove-touch-v1')!).gyroAim)).toBe(false);
 await page.getByRole('button',{name:'Resume game',exact:true}).tap();
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().paused)).toBe(false);
 before=await yaw();await turnLeft();expect(Math.abs(await yaw()-before)).toBeLessThan(.01);
 expect(errors).toEqual([]);
});
