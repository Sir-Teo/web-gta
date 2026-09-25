import {test,expect} from '@playwright/test';

test('the script\'s brief, big message and help reach the HUD, and CMessages::Process expires them',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await expect.poll(()=>page.evaluate(()=>!!(window as any).__game.missionForProfiling()?.runtime),{timeout:60000}).toBe(true);
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().player.grounded),{timeout:60000}).toBe(true);
 await page.evaluate(()=>{
  const g=(window as any).__game.missionForProfiling().runtime.game,now=(window as any).__game.gameTimeMs();
  // PRINT_NOW CHEAT1 1500 ms, PRINT_BIG with STYLE_MIDDLE, and PRINT_HELP CHEAT8.
  g.messages.addMessageJump('CHEAT1',1500,0,false,now);
  g.messages.addBigMessage2('CHEAT8',1500,0,true,now);
  g.help.set('CHEAT8',true,false,false,g.messages);
 });
 await expect(page.locator('.prompt')).toHaveText('Cheat activated',{timeout:5000});
 await expect(page.locator('.big-message b')).toHaveText('Cheat deactivated');
 // A stat the scripts bump as they start can take the box first (SetHelpMessageStatUpdate replaces a help not yet
 // drawn), so the help is printed again until it is up.
 await expect.poll(()=>page.evaluate(()=>{
  const g=(window as any).__game.missionForProfiling().runtime.game,box=document.querySelector('.help-box') as HTMLElement;
  if(box.textContent!=='Cheat deactivated'||box.hidden)g.help.set('CHEAT8',true,false,false,g.messages);
  return box.hidden?'':box.textContent;
 }),{timeout:10000}).toBe('Cheat deactivated');
 // IS_HELP_MESSAGE_BEING_DISPLAYED and IS_THIS_HELP_MESSAGE_BEING_DISPLAYED read the box that is up.
 const showing=()=>page.evaluate(()=>{const w=(window as any).__game.missionForProfiling().runtime.world;return {any:w.isHelpMessageBeingDisplayed(),mine:w.isThisHelpMessageBeingDisplayed('CHEAT8'),other:w.isThisHelpMessageBeingDisplayed('CHEAT1')};});
 await expect.poll(showing,{timeout:5000}).toEqual({any:true,mine:true,other:false});
 // The quick help goes after its 3 s; the same help printed again comes back.
 await expect(page.locator('.help-box')).toBeHidden({timeout:15000});
 await expect.poll(showing,{timeout:5000}).toEqual({any:false,mine:false,other:false});
 await page.evaluate(()=>{const g=(window as any).__game.missionForProfiling().runtime.game;g.help.set('CHEAT8',true,false,false,g.messages);});
 await expect(page.locator('.help-box')).toHaveText('Cheat deactivated',{timeout:5000});
 // The queue's front expires after its time and the brief line clears.
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.game.messages.briefs[0]??null),{timeout:10000}).toBeNull();
 await expect(page.locator('.prompt')).toHaveText('',{timeout:5000});
 expect(errors).toEqual([]);
});
