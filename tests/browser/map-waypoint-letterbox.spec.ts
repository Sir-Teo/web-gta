import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** In a short window the full map's box is wider than tall and the square map is drawn contained in it: a click on a
 * spot of the drawn map sets the waypoint there, not where the box's own proportions would put it. */
test('a waypoint clicked on the full map in a short window lands where it was clicked',async({page})=>{
 test.setTimeout(240000);await page.setViewportSize({width:800,height:400});
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});await endStoryMission(page);
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await page.keyboard.press('KeyM');
 const map=page.getByLabel('Full San Andreas map; click to set a waypoint');await expect(map).toBeVisible();
 const box=(await map.boundingBox())!;
 // Where CJ stands (2495, 1687 in browser space) on the drawn square.
 const side=Math.min(box.width,box.height),u=(2495+3000)/6000,v=(1687+3000)/6000;
 await page.mouse.click(box.x+(box.width-side)/2+u*side,box.y+(box.height-side)/2+v*side);
 const metres=Number((await page.locator('.map-status').textContent())?.match(/Waypoint (\d+) m/)?.[1]);
 // A pixel of the drawn map is some 15 m of San Andreas at this size.
 expect(metres).toBeLessThan(60);
});
