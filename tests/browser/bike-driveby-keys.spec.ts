import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('real bike fire and look keys pose the rider with one visible SMG and return to riding on release',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 await page.waitForFunction(()=>(window as any).__game.sim.player.grounded,undefined,{timeout:60000});
 await page.evaluate(async()=>{
  const path='/src/weapons/WeaponView.ts',{WeaponView}=await import(path),g=(window as any).__game;
  g.__bikeDriveByOriginal=WeaponView.prototype.update;
  WeaponView.prototype.update=function(this:any){g.__bikeDriveByOriginal.call(this);g.__bikeDriveByWeapon={selected:this.selected,rightVisible:this.held?.root.visible,leftVisible:this.leftHeld?.root.visible,rightMounted:!!this.held&&this.held.root.parent===this.owner?.hand(24),error:this.error};};
  g.weapons().inventory.give(28,500);g.weapons().inventory.select(28);
 });
 const origin=await page.evaluate(()=>({...((window as any).__game.sim.player.position)})),models:any[]=[];
 try{
  for(const id of [461,481,471]){
   const handle=await page.evaluate(({id,origin:p})=>{const g=(window as any).__game;return g.missionForProfiling().vehicles.create(id,{x:p.x+6,y:-p.z+12,z:-100},90);},{id,origin});
   await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),handle,{timeout:60000});await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.warpPedIntoCar(1,h),handle);
   await page.waitForFunction(()=>(window as any).__game.weapons().ready&&(window as any).__game.__bikeDriveByWeapon?.selected===28,undefined,{timeout:45000});
   const ammoBefore=await page.evaluate(()=>{const a=(window as any).__game.weapons().inventory.ammo.get(28);return a.clip+a.reserve;});
   await page.keyboard.down('ControlRight');
   const waitPose=async(side:string)=>{await page.waitForFunction(side=>{const g=(window as any).__game;return g.fleet().occupiedBike?.riderDriveByActive&&g.render().vehiclePose?.pose.partials?.some((a:any)=>a.clip.includes('driveby')&&a.clip.endsWith(side)&&a.amount>.95)&&g.__bikeDriveByWeapon?.rightVisible===true;},side,{timeout:15000});return page.evaluate(()=>{const g=(window as any).__game,b=g.fleet().occupiedBike;return {pose:g.render().vehiclePose.pose,weapon:g.__bikeDriveByWeapon,visible:g.render().nativeCharacter.root.visible,mode:b.bicycleRider?.decision?.mode,hop:!!b.hopState?.animation};});};
   const forward=await waitPose('ft');await page.keyboard.down('KeyQ');const left=await waitPose('lhs');await page.screenshot({path:`artifacts/bike-driveby-keys-${id}.png`});
   await page.keyboard.up('KeyQ');await page.keyboard.down('KeyE');const right=await waitPose('rhs');await page.keyboard.up('KeyE');await page.keyboard.up('ControlRight');
   await page.waitForFunction(()=>{const g=(window as any).__game;return !g.fleet().occupiedBike?.riderDriveByActive&&g.__bikeDriveByWeapon?.rightVisible===false;},undefined,{timeout:15000});
   const ammoAfter=await page.evaluate(()=>{const a=(window as any).__game.weapons().inventory.ammo.get(28);return a.clip+a.reserve;});models.push({id,forward,left,right,ammoBefore,ammoAfter});
   await page.evaluate(h=>{const g=(window as any).__game,b=g.fleet().occupiedBike;b.finishExit();g.missionForProfiling().runtime.world.deleteVehicle(h);},handle);
   await page.waitForFunction(()=>!(window as any).__game.fleet().occupiedBike);
  }
 }finally{
  await page.keyboard.up('ControlRight');await page.keyboard.up('KeyQ');await page.keyboard.up('KeyE');
  await page.evaluate(async()=>{const path='/src/weapons/WeaponView.ts',{WeaponView}=await import(path),g=(window as any).__game;if(g.__bikeDriveByOriginal)WeaponView.prototype.update=g.__bikeDriveByOriginal;});
  writeFileSync('artifacts/bike-driveby-keys-live.json',JSON.stringify({models,errors},null,2));
 }
 for(const m of models){expect(m.ammoAfter).toBeLessThan(m.ammoBefore);for(const p of [m.forward,m.left,m.right]){expect(p.visible).toBe(true);expect(p.weapon.rightMounted).toBe(true);expect(p.weapon.rightVisible).toBe(true);expect(p.weapon.leftVisible).not.toBe(true);expect(p.weapon.error).toBeUndefined();if(m.id===481){expect(p.mode).toBe('ride');expect(p.hop).toBe(false);}}}
 expect(models).toHaveLength(3);expect(errors).toEqual([]);
});
