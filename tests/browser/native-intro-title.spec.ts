import {test,expect} from '@playwright/test';
/** The game opens on MAIN's DO_FADE 0 0 black, and INTRO's title cards (DISPLAY_TEXT with SET_TEXT_DRAW_BEFORE_FADE
 * off) are drawn over the fade as CHud::DrawAfterFade draws them. The radar and the zone name are not: CHud::Draw's
 * layer is under the fade, and INTRO has zone names off. */
test('the opening title card draws over the black fade, with the HUD under it',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 const card=page.locator('canvas.script-text.after-fade');
 await expect(card).toBeVisible({timeout:120000});
 const state=await page.evaluate(()=>{
  const g=(window as any).__game,r=g.missionForProfiling().runtime,canvas=document.querySelector<HTMLCanvasElement>('canvas.script-text.after-fade')!;
  const pixels=canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data;let lit=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i])lit++;
  const z=(selector:string)=>{const e=document.querySelector(selector);return e?getComputedStyle(e).zIndex:null;};
  return {fade:g.state().fadeAlpha,lines:r.game.introText.lines.slice(0,r.game.introText.count).map((l:any)=>l.key),lit,
   card:z('canvas.script-text.after-fade'),screen:z('.screen-fade'),radar:z('.native-navigation'),areaNames:r.game.displayAreaName};
 });
 expect(state.fade).toBe(255);
 expect(state.lines).toEqual(['LOAD_01','LOAD_03','LOAD_04']);
 expect(state.lit).toBeGreaterThan(0);
 expect(Number(state.card)).toBeGreaterThan(Number(state.screen));
 expect(state.radar).toBe('auto');expect(state.areaNames).toBe(false);
 await expect(page.locator('.location')).toBeHidden();
 expect(errors).toEqual([]);
});
