import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** The Display settings' Radar (FrontEndMenuManager.m_nRadarMode, the PC's and the mobile ports' Radar Mode): Blips
 * only draws the blips with no map or disc under them, Off no radar at all, and the pause menu's Map (the PC front
 * end's first page) opens the full map, the one way to it on a touch screen with the radar off. */
test.use({hasTouch:true,isMobile:true,viewport:{width:844,height:390}});
test('a phone sets the radar to blips only or off, and opens the map from the pause menu',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?touch=1');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 const radar=page.locator('.minimap-button');await expect(radar).toBeVisible();
 // How much of the radar canvas is drawn on, a ring between its centre and its rim (the map's area, not the blips'
 // centre arrow).
 const covered=()=>page.evaluate(()=>{const c=document.querySelector<HTMLCanvasElement>('.minimap-button canvas')!,x=c.getContext('2d')!,d=x.getImageData(0,0,c.width,c.height).data,C=c.width/2;
  let drawn=0,all=0;for(let y=0;y<c.height;y+=3)for(let i=0;i<c.width;i+=3){const r=Math.hypot(i-C,y-C);if(r<C*.35||r>C*.8)continue;all++;if(d[(y*c.width+i)*4+3]>0)drawn++;}return drawn/all;});
 await expect.poll(covered,{timeout:10000}).toBeGreaterThan(.95);
 const setRadar=async(mode:string)=>{
  await page.locator('.touch-button.pause').dispatchEvent('pointerdown',{pointerType:'touch'});
  // The menu keeps the page last opened.
  const select=page.locator('#display-radar');if(!await select.isVisible())await page.getByRole('button',{name:'Audio',exact:true}).tap();
  await select.selectOption(mode);
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('grove-display-v1')!).radarMode)).toBe(mode);
 };
 // Blips only: the map and the disc go, the blips stay (most of the ring is bare).
 await setRadar('blips');await page.getByRole('button',{name:'Resume game',exact:true}).tap();
 await expect(radar).toBeVisible();await expect.poll(covered,{timeout:10000}).toBeLessThan(.2);
 // Off: no radar; the pause menu's Map opens the full map over the game.
 await setRadar('off');await expect(radar).toBeHidden();
 await page.getByRole('button',{name:'Map',exact:true}).tap();
 await expect(page.locator('.world-map-panel')).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().paused)).toBe(false);
 await expect(radar).toBeHidden();
 // Back to the map and blips: kept for the next visit.
 await page.reload();await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('grove-display-v1')!).radarMode)).toBe('off');
 expect(errors).toEqual([]);
});
