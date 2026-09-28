import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** CTaskSimpleUseGun::AimGun's PointArm straightens the arm at the aim point while the wrist keeps the fire clip's hold,
 * so the pistol lies along the forearm and its barrel (the hand's +X, the weapon's attachment axis) meets the aim,
 * standing and while strafing. */
test('an aimed pistol points its barrel at the aim, standing and moving',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await page.keyboard.press('Tab');await page.locator('[data-weapon="22"]').click();
 await page.waitForFunction(()=>(window as any).__game.state().weapons.ready,undefined,{timeout:30000});
 const offDegrees=()=>page.evaluate(()=>{const nc=(window as any).__game.render().nativeCharacter,V=nc.root.position.constructor,hand=nc.hand(24);
  const barrel=new V(1,0,0).transformDirection(hand.matrixWorld),to=nc.weaponAimPoint.clone().sub(new V().setFromMatrixPosition(hand.matrixWorld)).normalize();
  return Math.acos(Math.max(-1,Math.min(1,barrel.dot(to))))*180/Math.PI;});
 await page.mouse.move(700,450);await page.mouse.down({button:'right'});await page.waitForTimeout(1500);
 const standing=await offDegrees();
 await page.keyboard.down('KeyA');await page.waitForTimeout(1500);
 const strafing=await offDegrees();
 await page.keyboard.up('KeyA');await page.mouse.up({button:'right'});
 expect(standing).toBeLessThan(15);
 expect(strafing).toBeLessThan(15);
 expect(errors).toEqual([]);
});
