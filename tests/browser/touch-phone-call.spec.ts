import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** A script waiting on the phone's button (an incoming call, the camera's "have your picture taken") reads it every
 * frame; while it does, on foot, the touch controls put up Action (the port's PHONE widget), though the game's help
 * names the button only the first time, and Action presses it for the script. A script stood in for here by reading
 * the pad as IS_BUTTON_PRESSED 0 4 does. */
test.use({hasTouch:true,isMobile:true,viewport:{width:844,height:390}});
test('a call waiting on the phone\'s button puts up Action, which answers it',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?touch=1');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 const action=page.getByRole('button',{name:'Action',exact:true});
 await page.waitForTimeout(1000);await expect(action).toBeHidden();
 // The phone rings: a script reads the button each frame, and notes when it is pressed.
 await page.evaluate(()=>{const w=window as any,pads=w.__game.missionForProfiling().runtime.game.pads;w.__answered=false;w.__ringing=true;
  const poll=()=>{if(!w.__ringing)return;if(pads.isPressed(0,4))w.__answered=true;requestAnimationFrame(poll);};poll();});
 await expect(action).toBeVisible({timeout:5000});
 const b=(await action.boundingBox())!;
 for(const type of ['pointerdown','pointerup'])await page.evaluate(({type,x,y})=>document.querySelector('.touch-context button[data-code=Tab]')!.dispatchEvent(new PointerEvent(type,{pointerId:41,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true})),{type,x:b.x+5,y:b.y+5});
 await expect.poll(()=>page.evaluate(()=>(window as any).__answered),{timeout:5000}).toBe(true);
 // Answered, the script stops reading: Action goes.
 await page.evaluate(()=>{(window as any).__ringing=false;});
 await expect(action).toBeHidden({timeout:5000});
 expect(errors).toEqual([]);
});
