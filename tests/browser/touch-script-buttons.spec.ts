import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** A minigame on the PC scripts reads the pad's buttons and names them in a help box, often only the first time; the
 * iOS port's rewritten scripts ask for widgets of their own instead. While a script reads a button the touch controls
 * show only on call, they put up the button that presses it: a gym bike's level (the d-pad's left and right, the port's
 * Easier and Harder) as arrows while the machine holds the player, and Enter for a machine's or a table's triangle away
 * from any car. Scripts stood in for here by reading the pad as IS_BUTTON_PRESSED does. */
test.use({hasTouch:true,isMobile:true,viewport:{width:844,height:390}});
test('a minigame\'s buttons come up while its script reads them, and press them for it',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?touch=1');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 const left=page.getByRole('button',{name:'Left',exact:true}),right=page.getByRole('button',{name:'Right',exact:true}),enter=page.locator('.touch-button.enter');
 await page.waitForTimeout(1000);await expect(left).toBeHidden();await expect(right).toBeHidden();
 const tap=async(selector:string,id:number)=>{for(const type of ['pointerdown','pointerup'])await page.evaluate(({selector,type,id})=>{const b=document.querySelector(selector)!,r=b.getBoundingClientRect();
  b.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',clientX:r.x+r.width/2,clientY:r.y+r.height/2,bubbles:true,cancelable:true}));},{selector,type,id});};
 // A gym bike holds the player and reads Sprint to pedal and left and right for the level, every frame.
 await page.evaluate(()=>{const w=window as any,m=w.__game.missionForProfiling(),pads=m.runtime.game.pads;m.playerControl=false;w.__pressed=[];w.__machine=true;
  const poll=()=>{if(!w.__machine)return;for(const b of [10,11,16])if(pads.isPressed(0,b)&&!w.__pressed.includes(b))w.__pressed.push(b);requestAnimationFrame(poll);};poll();});
 await expect(left).toBeVisible({timeout:5000});await expect(right).toBeVisible();
 // Sprint is on screen already: no second one. The arrows press the d-pad for the script.
 await expect(page.getByRole('button',{name:'Up',exact:true})).toBeHidden();
 await tap('.touch-context button[data-code=MenuRight]',51);
 await expect.poll(()=>page.evaluate(()=>(window as any).__pressed),{timeout:5000}).toEqual([11]);
 await tap('.touch-context button[data-code=MenuLeft]',52);
 await expect.poll(()=>page.evaluate(()=>(window as any).__pressed),{timeout:5000}).toEqual([11,10]);
 // Off the machine the script stops reading, and the arrows go.
 await page.evaluate(()=>{const w=window as any;w.__machine=false;w.__game.missionForProfiling().playerControl=true;});
 await expect(left).toBeHidden({timeout:5000});await expect(right).toBeHidden();
 // A vending machine away from any car reads the triangle: Enter comes up, and buys. (Grove Street's parked cars put
 // Enter up already: CJ goes a little way off, to where none is.)
 for(const [x,y] of [[2470,-1660],[2530,-1640],[2440,-1700],[2560,-1700]]){
  await page.evaluate(([x,y])=>{(window as any).__game.missionForProfiling().runtime.world.setPedCoordinates(1,x,y,-100);},[x,y]);
  await page.waitForTimeout(1500);if(!await enter.isVisible())break;
 }
 await expect(enter).toBeHidden({timeout:5000});
 await page.evaluate(()=>{const w=window as any,pads=w.__game.missionForProfiling().runtime.game.pads;w.__bought=false;w.__vending=true;
  const poll=()=>{if(!w.__vending)return;if(pads.isPressed(0,15))w.__bought=true;requestAnimationFrame(poll);};poll();});
 await expect(enter).toBeVisible({timeout:5000});
 await tap('.touch-button.enter',53);
 await expect.poll(()=>page.evaluate(()=>(window as any).__bought),{timeout:5000}).toBe(true);
 await page.evaluate(()=>{(window as any).__vending=false;});
 await expect(enter).toBeHidden({timeout:5000});
 expect(errors).toEqual([]);
});
