import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('the zone name fades after its few seconds and the vehicle name shows on getting in',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 const zone=page.locator('.location'),vehicle=page.locator('.vehicle-name');
 // INTRO keeps zone names off (DISPLAY_ZONE_NAMES 0) until its end; free roam has them.
 await endStoryMission(page);
 // CHud::DrawAreaName: fade in, hold, fade out, then nothing.
 await expect(zone).toBeVisible({timeout:20000});
 // CPlaceName::Process: the smallest navigation zone at Grove Street is GAN1, whose GXT text is Ganton.
 await expect(zone).toHaveText('Ganton');
 expect(await zone.evaluate(e=>getComputedStyle(e).color)).toBe('rgb(172, 203, 241)');
 await expect(zone).toBeHidden({timeout:20000});
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 // The Greenwood streams in after CJ lands; F does nothing until it is there.
 await expect.poll(async()=>(await state()).nativeCar!=null,{timeout:30000}).toBe(true);
 await page.keyboard.press('KeyF');
 await expect.poll(async()=>(await state()).nativeCar?.occupied,{timeout:15000}).toBe(true);
 // CHud::DrawVehicleName in HUD green, and no control prompt.
 await expect(vehicle).toBeVisible({timeout:5000});await expect(vehicle).toHaveText('Greenwood');
 expect(await vehicle.evaluate(e=>getComputedStyle(e).color)).toBe('rgb(54, 104, 44)');
 await expect(page.locator('.prompt')).not.toContainText('W/S drive');
 // DisplayRadioStationName: the station at the top centre in HUD gold for 2.5 s, again on tuning.
 const radio=page.locator('.radio-name');
 await expect(radio).toBeVisible();expect(await radio.evaluate(e=>getComputedStyle(e).color)).toBe('rgb(144, 98, 16)');
 const first=await radio.textContent();await expect(radio).toBeHidden({timeout:4000});
 await page.keyboard.press('KeyN');await expect(radio).toBeVisible();expect(await radio.textContent()).not.toBe(first);
 // The names are the GXT's FEA_R0 to FEA_R10 and FEA_NON: tuning round the dial reaches "RADIO OFF" and "K Rose".
 const seen=new Set<string>();for(let i=0;i<12;i++){await page.keyboard.press('KeyN');await page.waitForTimeout(60);seen.add((await radio.textContent())??'');}
 expect(seen.has('RADIO OFF'),JSON.stringify([...seen])).toBe(true);expect(seen.has('K Rose')).toBe(true);
 await expect(page.locator('.prompt')).not.toContainText('Radio ·');
 await expect(vehicle).toBeHidden({timeout:8000});
 expect(errors).toEqual([]);
});
