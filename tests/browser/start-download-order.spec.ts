import {test,expect} from '@playwright/test';
/* What the menu's button waits on (the start package) has a phone's connection to itself: the radar's map, the streamed
 * scripts and the sound banks, wanted only once play starts, are asked for after it has arrived and the menu is up. */
test('the radar map, script.img and the sound banks wait for the start package',async({page})=>{
 test.setTimeout(240000);
 const started=new Map<string,number>(),finished=new Map<string,number>();const t0=Date.now();
 const key=(url:string)=>/world-start\.scene\.bin|san-andreas\.png|script\.img|banks\.json/.exec(url)?.[0];
 page.on('request',r=>{const k=key(r.url());if(k&&!started.has(k))started.set(k,Date.now()-t0);});
 page.on('requestfinished',r=>{const k=key(r.url());if(k&&!finished.has(k))finished.set(k,Date.now()-t0);});
 // A phone's connection: the start package takes a while.
 await page.route('**/world-start.scene.bin',async route=>{const response=await route.fetch();await new Promise(r=>setTimeout(r,4000));await route.fulfill({response});});
 await page.goto('/?touch=1');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).waitFor({timeout:120000});
 await expect.poll(()=>['san-andreas.png','script.img','banks.json'].every(k=>started.has(k)),{timeout:30000}).toBe(true);
 const pack=finished.get('world-start.scene.bin')!;expect(pack).toBeGreaterThan(0);
 for(const k of ['san-andreas.png','script.img','banks.json'])expect(started.get(k),k).toBeGreaterThanOrEqual(pack);
});
