import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** The group buttons as the game's help text states them: "Hold PED_LOCK_TARGET to target a gang member and press
 * GROUP_CONTROL_FWD or GROUP_CONTROL_BWD to recruit him"; with a group, BWD tells it to stay in position and FWD to
 * follow; holding either for 1.2 s (iOS ProcessGroupBehaviour) disbands it. */
test('G and H recruit a targeted homie, order stay and follow, and a held button disbands',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().pedestrians.people.some((p:any)=>p.gang===1&&p.health>0)),{timeout:90000}).toBe(true);
 // A Families member two and a half units ahead of CJ.
 await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position,ped=g.pedestrians().people.find((p:any)=>p.gang===1&&p.health>0);
  const b=ped.body.translation();ped.body.setTranslation({x:p.x,y:b.y-ped.actor.player.position.y+p.y,z:p.z-2.5},true);ped.actor.player.position={x:p.x,y:p.y,z:p.z-2.5};
  g.turnPlayer(Math.PI);});
 const crew=()=>page.evaluate(()=>(window as any).__game.pedestrians().people.filter((p:any)=>p.follow).length);
 const staying=()=>page.evaluate(()=>(window as any).__game.pedestrians().people.filter((p:any)=>p.follow&&p.holdPosition).length);
 const frames=async(n:number)=>{const t=await page.evaluate(()=>(window as any).__game.gameTimeMs());await expect.poll(()=>page.evaluate(()=>(window as any).__game.gameTimeMs()),{timeout:30000}).toBeGreaterThan(t+n*34);};
 // Not targeted: nothing to command, nobody joins.
 await page.keyboard.press('KeyG');await frames(3);
 expect(await crew()).toBe(0);
 await page.mouse.move(700,450);await page.mouse.down({button:'right'});await frames(3);
 await page.keyboard.press('KeyG');await frames(3);await page.mouse.up({button:'right'});
 await expect.poll(crew,{timeout:30000}).toBe(1);
 await page.keyboard.press('KeyH');await expect.poll(staying,{timeout:30000}).toBe(1);
 await page.keyboard.press('KeyG');await expect.poll(staying,{timeout:30000}).toBe(0);
 expect(await crew()).toBe(1);
 // CTaskComplexGangFollower by a still CJ: member slot 0 stands at Offsets[0] (-1, 1), a unit west and a unit north.
 const offSpot=()=>page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position,m=g.pedestrians().people.find((q:any)=>q.follow),q=m.actor.player.position;return Math.hypot(q.x-(p.x-1),q.z-(p.z-1));});
 await expect.poll(offSpot,{timeout:30000}).toBeLessThan(.7);
 // A mission's cleanup puts the group on FOLLOW_LIMITED until the next group command.
 const allocator=()=>page.evaluate(()=>(window as any).__game.pedestrians().playerGroupAllocator);
 await page.evaluate(()=>(window as any).__game.pedestrians().missionCleanup());expect(await allocator()).toBe('followLimited');
 await page.keyboard.press('KeyG');await expect.poll(allocator,{timeout:30000}).toBe('random');
 // ProcessGroupBehaviour's hold: 1200 ms of GROUP_CONTROL_BWD with a group and nobody targeted disbands it.
 await page.keyboard.down('KeyH');await frames(15);
 expect(await crew()).toBe(1);
 await expect.poll(crew,{timeout:60000}).toBe(0);
 await page.keyboard.up('KeyH');
 expect(errors).toEqual([]);
});
