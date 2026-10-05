import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** A phone's help box, which names the touch buttons, is sized for the screen's height (not the narrow window's 11
 * pixels), and a script's wider box (SET_HELP_MESSAGE_BOX_SIZE) still stops short of the HUD and the buttons. The
 * widths are set as the command sets them, on the script's help state, which the HUD draws from each frame. */
test.use({hasTouch:true,viewport:{width:667,height:375}});
test('a phone reads the help box at a size for its screen, clear of the buttons',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?touch=1');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 const layout=()=>page.evaluate(()=>{const box=document.querySelector<HTMLElement>('.help-box')!,b=box.getBoundingClientRect();
  const over=[...document.querySelectorAll('.touch-controls button:not([hidden]), .weapon-slot, .game-time, .cash, .native-navigation')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.left<b.right&&r.right>b.left&&r.top<b.bottom&&r.bottom>b.top;}).map(e=>e.className);
  return {size:parseFloat(getComputedStyle(box).fontSize),width:b.width,over};});
 const boxSize=(width:number)=>page.evaluate(width=>{(window as any).__game.missionForProfiling().runtime.game.help.boxWidth=width;
  return new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));},width);
 await page.evaluate(()=>(window as any).__game.hud().help('Use the Stick to move CJ. Hold Sprint to run faster, Jump to jump, and press Enter by a car to get in. Your Health and Armour are shown at the top of the screen.',60000));
 const shown=await layout();
 expect(shown.size,JSON.stringify(shown)).toBeGreaterThanOrEqual(13);expect(shown.over).toEqual([]);
 // Twice the default width: wider than the space beside the radar, it keeps to that space.
 await boxSize(400);
 const wide=await layout();expect(wide.over,JSON.stringify(wide)).toEqual([]);expect(wide.width).toBeGreaterThanOrEqual(shown.width-1);
 // Half the default width narrows it.
 await boxSize(100);
 expect((await layout()).width).toBeLessThan(shown.width*.7);
 expect(errors).toEqual([]);
});
