import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** The 40-pixel touch buttons (pause, camera, the context pills, Yes) take a touch a few pixels outside their edge, as a
 * phone's 44-point targets ask, without being drawn larger; neighbours 8 pixels apart still each keep their side. */
test.use({hasTouch:true,viewport:{width:667,height:375}});
test('a small phone\'s small buttons take a touch just outside their edge',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?touch=1');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 // A help naming Yes and Action puts up their buttons.
 await page.evaluate(()=>{const g=(window as any).__game.missionForProfiling().runtime.game;g.help.set('Press ~k~~CONVERSATION_YES~ or ~k~~PED_ANSWER_PHONE~.',false,true,false,g.messages);});
 const names=['Pause','Camera view','Yes','Action'];
 for(const name of names)await expect(page.getByRole('button',{name,exact:true})).toBeVisible();
 const hits=await page.evaluate(names=>names.map(name=>{const b=[...document.querySelectorAll<HTMLElement>('.touch-controls button')].find(e=>(e.getAttribute('aria-label')??e.textContent)===name&&e.offsetParent)!;const r=b.getBoundingClientRect(),cx=r.x+r.width/2,cy=r.y+r.height/2;
  // A side at the screen's edge (Yes stands at the bottom) has nothing beyond it to touch.
  const at=(x:number,y:number)=>x<0||y<0||x>=innerWidth||y>=innerHeight||document.elementFromPoint(x,y)?.closest('button')===b;
  return {name,size:Math.round(r.height),drawn:at(cx,cy),left:at(r.left-3,cy),right:at(r.right+3,cy),above:at(cx,r.top-3),below:at(cx,r.bottom+3),far:at(r.right+9,cy)};}),names);
 for(const h of hits){expect(h,JSON.stringify(h)).toMatchObject({drawn:true,left:true,right:true,above:true,below:true,far:false});expect(h.size).toBeLessThan(44);}
 // A real touch 3 pixels right of the pause button's edge pauses the game.
 const pause=(await page.getByRole('button',{name:'Pause',exact:true}).boundingBox())!;
 const cdp=await page.context().newCDPSession(page);const x=pause.x+pause.width+3,y=pause.y+pause.height/2;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:4}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await expect(page.getByRole('button',{name:'Resume game',exact:true})).toBeVisible({timeout:10000});
 expect(errors).toEqual([]);
});
