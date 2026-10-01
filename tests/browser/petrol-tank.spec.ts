import {test,expect,type Page} from '@playwright/test';
import {endStoryMission} from './freeRoam';
const state=(page:Page)=>page.evaluate(()=>(window as any).__game.state());
// vehicleFlags.bPetrolTankIsWeakPoint: a bullet on a car's petrol cap blows it up at once (SWEET2, "shoot the car's gas
// tank"); a bullet anywhere else only takes its health, and SET_PETROL_TANK_WEAKPOINT off makes the tank safe.
test('a shot on the petrol cap blows the car up, elsewhere it only dents it',async({page})=>{
 test.setTimeout(300000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await endStoryMission(page);
 await expect.poll(async()=>(await state(page)).player.grounded,{timeout:60000}).toBe(true);
 // A Tampa (549), as Emmet's, six units off CJ, and the world point of its petrolcap dummy and of its bonnet.
 // On Grove Street's road, clear of the houses and fences.
 await page.evaluate(()=>(window as any).__game.missionForProfiling().adapterRef.setPedCoordinates(1,2470,-1660,-100));
 await page.waitForTimeout(1500);
 const make=()=>page.evaluate(()=>(window as any).__game.missionForProfiling().adapterRef.createCar(549,2470,-1668,-100));
 const spots=(h:number)=>page.evaluate(h=>{const m=(window as any).__game.missionForProfiling(),car=m.vehicles.entity(h),b=car.car.body,t=b.translation(),q=b.rotation();
  const rot=(v:any)=>{const ix=q.w*v.x+q.y*v.z-q.z*v.y,iy=q.w*v.y+q.z*v.x-q.x*v.z,iz=q.w*v.z+q.x*v.y-q.y*v.x,iw=-q.x*v.x-q.y*v.y-q.z*v.z;
   return {x:ix*q.w+iw*-q.x+iy*-q.z-iz*-q.y,y:iy*q.w+iw*-q.y+iz*-q.x-ix*-q.z,z:iz*q.w+iw*-q.z+ix*-q.y-iy*-q.x};};
  const at=(n:any)=>{const o=rot({x:n.x,y:n.z,z:-n.y});return {x:t.x+o.x,y:t.y+o.y,z:t.z+o.z};};
  const cap=car.car.nativeFramePosition('petrolcap'),side=Math.sign(cap.x)||1,out=rot({x:side,y:0,z:0});
  return {cap:at(cap),bonnet:at({x:0,y:1.8,z:.4}),out};},h);
 // CJ stands on the cap's side, four units out, and fires a pistol at it.
 const shoot=(target:{x:number;y:number;z:number},from:{x:number;y:number;z:number})=>page.evaluate(([target,from])=>{const g=(window as any).__game;
  g.missionForProfiling().adapterRef.setPedCoordinates(1,from.x,-from.z,from.y-1);
  g.missionForProfiling().adapterRef.givePedWeapon(1,22,50);g.missionForProfiling().adapterRef.setPedCurrentWeapon(1,22);
  return new Promise(r=>setTimeout(()=>{g.fireAt(target.x,target.y,target.z);r(null);},400));},[target,from] as const);
 const car=await make();
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h)?.car?.body,car,{timeout:60000});
 await page.waitForTimeout(3000);
 const s=await spots(car);
 const stand={x:s.cap.x+s.out.x*4,y:s.cap.y+.2,z:s.cap.z+s.out.z*4};
 // The bonnet first: health goes, the car stands.
 const wrecked=(h:number)=>page.evaluate(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h)?.wrecked,h);
 const health=(h:number)=>page.evaluate(h=>(window as any).__game.missionForProfiling().vehicles.entity(h).health,h);
 await shoot(s.bonnet,{x:s.bonnet.x+s.out.x*4,y:stand.y,z:s.bonnet.z+s.out.z*4});
 await page.waitForTimeout(300);
 expect(await wrecked(car)).toBe(false);expect(await health(car)).toBeLessThan(1000);
 // With the weak point off, the cap is as safe as the bonnet.
 await page.evaluate(h=>(window as any).__game.missionForProfiling().adapterRef.setVehiclePetrolTankWeakpoint(h,false),car);
 await shoot(s.cap,stand);await page.waitForTimeout(300);
 expect(await wrecked(car)).toBe(false);
 // On again: one round on the cap and it goes up.
 await page.evaluate(h=>(window as any).__game.missionForProfiling().adapterRef.setVehiclePetrolTankWeakpoint(h,true),car);
 await shoot(s.cap,stand);
 await expect.poll(()=>wrecked(car),{timeout:3000}).toBe(true);
 expect(errors).toEqual([]);
});
