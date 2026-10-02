import {test,expect,devices} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** A trip skip on a phone: the skip icon (CHud::DrawTripSkip) is the button, pressed by a finger through the browser's own
 * touch handling (CDP touch events), and takes the car to the point the script set up, as Y does on the PC. */
const {defaultBrowserType,...phone}=devices['Pixel 7 landscape'];
test.use({...phone});
test('a phone takes a trip skip by pressing its icon',async({page,context})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('grove-touch-v1',JSON.stringify({steering:'stick'})));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const car=await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;return g.missionForProfiling().vehicles.create(400,{x:p.x+6,y:-p.z+7,z:p.y},90);});
 await page.waitForFunction(car=>!!(window as any).__game.missionForProfiling().vehicles.entity(car),car,{timeout:45000});
 await page.evaluate(car=>(window as any).__game.missionForProfiling().runtime.world.warpPedIntoCar(1,car),car);
 await expect(page.locator('.touch-controls')).toHaveAttribute('data-mode','vehicle',{timeout:20000});
 const target=await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position,w=g.missionForProfiling().runtime.world;
  const node=w.nthClosestVehicleNode(p.x-250,-p.z,p.y,1);w.setUpSkip(node.x,node.y,node.z,90);return node;});
 const icon=page.getByRole('button',{name:'Trip skip',exact:true});await expect(icon).toBeVisible({timeout:10000});
 // A finger on the icon, held a while (the headless page runs few frames a second), then lifted.
 const b=(await icon.boundingBox())!,cdp=await context.newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2,id:1}]});
 await page.waitForTimeout(1500);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.game.messages.big[1][0]?.key??null),{timeout:10000}).toBe('SKIP');
 await expect.poll(()=>page.evaluate(({car,target})=>{const q=(window as any).__game.missionForProfiling().vehicles.positionOf(car);return Math.hypot(q.x-target.x,q.y-target.y);},{car,target}),{timeout:30000}).toBeLessThan(6);
 await expect(icon).toBeHidden();
 expect(errors).toEqual([]);
});
