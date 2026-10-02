import {test,expect,devices,type Page,type CDPSession} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** A phone's play through the browser's own touch handling (CDP touch events, several fingers at once, the clicks a
 * lifted finger leaves behind), on a phone's screen: the specs beside this one press the touch controls with
 * synthetic pointer events, which skip the browser's hit testing, implicit capture and click synthesis. */
const {defaultBrowserType,...phone}=devices['Pixel 7 landscape'];
test.use({...phone});
/** Fingers on the glass: every touch event lists all the fingers down, as a touch screen reports them. */
class Fingers {
 private down=new Map<number,{x:number;y:number}>();private next=1;
 constructor(private readonly cdp:CDPSession){}
 private send(type:'touchStart'|'touchMove'|'touchEnd'){return this.cdp.send('Input.dispatchTouchEvent',{type,touchPoints:[...this.down].map(([id,p])=>({...p,id}))});}
 async press(x:number,y:number){const id=this.next++;this.down.set(id,{x,y});await this.send('touchStart');return id;}
 async move(id:number,x:number,y:number){this.down.set(id,{x,y});await this.send('touchMove');}
 async lift(id:number){this.down.delete(id);await this.send(this.down.size?'touchMove':'touchEnd');}
 async tap(x:number,y:number,ms=60){const id=await this.press(x,y);await new Promise(r=>setTimeout(r,ms));await this.lift(id);}
}
/** Where to put a finger on an element, once it is on screen (the controls come back a frame after a menu closes). */
const centre=async(page:Page,selector:string)=>{const target=page.locator(selector).first();await target.waitFor({state:'visible',timeout:10000});const b=(await target.boundingBox())!;return {x:b.x+b.width/2,y:b.y+b.height/2};};
test('a phone plays with real touches: two thumbs, three fingers, the weapon icon, the radar, the camera, the stars, a subtitle and the pause button',async({page,context})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 const fingers=new Fingers(await context.newCDPSession(page)),state=()=>page.evaluate(()=>(window as any).__game.state());
 await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(2495,g.groundAt(2495,1687,300)+.05,1687);g.turnPlayer(Math.PI);});
 await expect.poll(async()=>{const s=await state();return !s.terrainHold&&s.player.grounded;},{timeout:30000}).toBe(true);
 // Two thumbs: the stick walks CJ while the other thumb turns the camera, high on the right where no button is.
 const zone=await centre(page,'.touch-stick-zone'),look={x:page.viewportSize()!.width*.7,y:page.viewportSize()!.height*.3};
 const s0=await state(),stick=await fingers.press(zone.x,zone.y),cam=await fingers.press(look.x,look.y);
 for(let i=1;i<=15;i++){await fingers.move(stick,zone.x,zone.y-60);await fingers.move(cam,look.x+i*6,look.y);await page.waitForTimeout(60);}
 const s1=await state();
 expect(Math.hypot(s1.player.position.x-s0.player.position.x,s1.player.position.z-s0.player.position.z)).toBeGreaterThan(1);
 expect(Math.abs(s1.camera.yaw-s0.camera.yaw)).toBeGreaterThan(.05);
 // A third finger holds Sprint while both thumbs stay down.
 const sprint=await centre(page,'.touch-button.sprint:not([hidden])'),run=await fingers.press(sprint.x,sprint.y);
 await expect.poll(async()=>(await state()).nativeCharacter?.action,{timeout:10000}).toBe('sprint');
 await fingers.lift(run);await fingers.lift(cam);await fingers.lift(stick);
 // The weapon icon: a tap steps the weapon.
 const selected=()=>page.evaluate(()=>(window as any).__game.weapons().inventory.selected as number),icon=await centre(page,'.weapon-slot'),before=await selected();
 await fingers.tap(icon.x,icon.y);await expect.poll(selected,{timeout:5000}).not.toBe(before);
 // Aim (a tap latches it) and Fire held: the pistol fires.
 await page.evaluate(()=>(window as any).__game.weapons().inventory.select(22));
 const ammo=()=>page.evaluate(()=>{const a=(window as any).__game.weapons().inventory.ammo.get(22);return a.clip+a.reserve as number;}),full=await ammo();
 const aim=await centre(page,'.touch-button.aim');await fingers.tap(aim.x,aim.y);
 const fire=await centre(page,'.touch-button.fire:not([hidden])'),trigger=await fingers.press(fire.x,fire.y);
 await expect.poll(ammo,{timeout:10000}).toBeLessThan(full);await fingers.lift(trigger);await fingers.tap(aim.x,aim.y);
 // The radar opens the map, which pinches under two fingers and takes a waypoint from a tap.
 const radar=await centre(page,'.minimap-button');await fingers.tap(radar.x,radar.y);
 await expect(page.locator('.world-map-panel')).toBeVisible();
 const map=await centre(page,'.world-map-panel canvas'),a=await fingers.press(map.x-15,map.y),b=await fingers.press(map.x+15,map.y);
 for(let i=1;i<=6;i++){await fingers.move(a,map.x-15-i*8,map.y);await fingers.move(b,map.x+15+i*8,map.y);}
 await fingers.lift(b);await fingers.lift(a);
 await fingers.tap(map.x+20,map.y+20);await expect(page.locator('.map-status')).toContainText('Waypoint');
 const close=await centre(page,'.map-close');await fingers.tap(close.x,close.y);await expect(page.locator('.world-map-panel')).toBeHidden();
 // The back button closes the map, as it closes a dialog, and play goes on.
 {const again=await centre(page,'.minimap-button');await fingers.tap(again.x,again.y);}await expect(page.locator('.world-map-panel')).toBeVisible();
 await page.goBack();await expect(page.locator('.world-map-panel')).toBeHidden();expect((await state()).paused).toBe(false);
 // The camera button steps the follow camera's distance (the PC's V).
 const mode=async()=>(await state()).camera.mode,view=await mode(),camera=await centre(page,'.touch-button.camera');
 await fingers.tap(camera.x,camera.y);await expect.poll(mode,{timeout:5000}).not.toBe(view);
 // Wanted stars hang under the clock, money and bars, clear of the buttons (the PC HUD's 175 px is the cluster here).
 await page.evaluate(()=>(window as any).__game.setWantedLevel(2));await expect(page.locator('.wanted-status')).toBeVisible();
 const stars=await page.evaluate(()=>{const s=document.querySelector('.wanted-status')!.getBoundingClientRect(),status=document.querySelector('.status')!.getBoundingClientRect();
  const hit=[...document.querySelectorAll('.touch-controls .touch-button:not([hidden])')].map(b=>b.getBoundingClientRect()).filter(r=>r.width&&r.left<s.right&&r.right>s.left&&r.top<s.bottom&&r.bottom>s.top);
  return {overlaps:hit.length,below:s.top>=status.bottom};});
 expect(stars).toEqual({overlaps:0,below:true});
 await page.evaluate(()=>(window as any).__game.setWantedLevel(0));
 // A long subtitle wraps in the room left of the buttons rather than running under them.
 await page.evaluate(()=>(window as any).__game.hud().message("It's a good thing we found you and retrieved the murder weapon, Carl. Real good.",20000));
 expect(await page.evaluate(()=>{const s=document.querySelector('.prompt')!.getBoundingClientRect();
  return [...document.querySelectorAll('.touch-controls .touch-button:not([hidden])')].map(b=>b.getBoundingClientRect()).filter(r=>r.width&&r.left<s.right&&r.right>s.left&&r.top<s.bottom&&r.bottom>s.top).length;})).toBe(0);
 await page.evaluate(()=>(window as any).__game.hud().message('',1));
 // The pause button pauses, and Resume plays on.
 const pause=await centre(page,'.touch-button.pause');await fingers.tap(pause.x,pause.y);
 await expect.poll(async()=>(await state()).paused).toBe(true);
 const resume=await centre(page,'button:has-text("Resume game")');await fingers.tap(resume.x,resume.y);
 await expect.poll(async()=>(await state()).paused).toBe(false);
 expect(errors).toEqual([]);
});
