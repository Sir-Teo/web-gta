import {test,expect,type Page} from '@playwright/test';
import {endStoryMission} from './freeRoam';

const state=(page:Page)=>page.evaluate(()=>(window as any).__game.state());

test('tuning parts are drawn at the car\'s upgrade positions, a linked pair both sides, and come off again',async({page})=>{
 test.setTimeout(240000);
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await endStoryMission(page);
 await expect.poll(async()=>(await state(page)).player.grounded,{timeout:60000}).toBe(true);
 await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(2486,g.groundAt(2486,1662,40)+.05,1662);});
 await page.waitForTimeout(2500);
 // A Sultan: its spoiler position hangs from the boot, the roof and both wing positions from the chassis.
 const ids=await page.evaluate(async()=>{
  const g=(window as any).__game,fleet=g.fleet(),up=fleet.catalog.upgrades;
  const car=await fleet.spawnScriptCar(560,{x:2481,y:g.groundAt(2481,1666,40),z:1666},Math.PI/2);(window as any).__sultan=car;
  const ids={spoiler:up.idOf('spl_a_s_b'),roof:up.idOf('rf_a_s'),skirtLeft:up.idOf('wg_l_a_s'),skirtRight:up.idOf('wg_r_a_s')};
  for(const id of [ids.spoiler,ids.roof,ids.skirtLeft])fleet.drawUpgradePart(car,id);
  return ids;
 });
 const parts=async()=>page.evaluate(()=>{const car=(window as any).__sultan,out:Record<string,{parent:string;meshes:number;painted:boolean}>={};
  for(const name of ['ug_spoiler','ug_roof','ug_wing_left','ug_wing_right']){
   const frame=car.car.root.getObjectByName(name);let meshes=0,painted=false;
   frame?.traverse((o:any)=>{if(o!==frame&&o.isMesh){meshes++;}});
   // The part's primary-colour materials take the car's paint.
   const primary=car.assets.colors[0].map((v:number)=>v/255);
   frame?.traverse((o:any)=>{if(o.isMesh)for(const m of [o.material].flat())if(m.color&&Math.abs(m.color.r-primary[0])<.01&&Math.abs(m.color.g-primary[1])<.01&&Math.abs(m.color.b-primary[2])<.01)painted=true;});
   out[name]={parent:frame?.parent?.name??'',meshes,painted};
  }
  return out;});
 await expect.poll(async()=>Object.values(await parts()).every(p=>p.meshes>0),{timeout:15000}).toBe(true);
 const on=await parts();
 expect(on.ug_spoiler.parent).toBe('boot_dummy');expect(on.ug_roof.parent).toBe('chassis');
 expect(on.ug_wing_right.meshes).toBeGreaterThan(0);
 expect(Object.values(on).some(p=>p.painted)).toBe(true);
 expect(await page.evaluate(()=>(window as any).__game.fleet().drawnUpgradeParts((window as any).__sultan).sort())).toEqual([ids.spoiler,ids.roof,ids.skirtLeft,ids.skirtRight].sort());
 await page.evaluate(()=>{const g=(window as any).__game,car=(window as any).__sultan,r=g.render(),t=car.car.body.translation(),cam=r.camera.position.clone();
  r.fixedCamera={position:cam.clone().set(t.x-4,t.y+2.4,t.z+5),target:()=>cam.clone().set(t.x,t.y+.4,t.z)};});
 await page.waitForTimeout(800);
 await page.screenshot({path:test.info().outputPath('sultan-parts.png'),scale:'css'});
 // RemoveVehicleUpgrade: the skirts go together; another spoiler in the same position replaces the first.
 await page.evaluate(id=>{const g=(window as any).__game,car=(window as any).__sultan,fleet=g.fleet();fleet.removeUpgradePart(car,id);fleet.drawUpgradePart(car,fleet.catalog.upgrades.idOf('spl_c_s_b'));},ids.skirtLeft);
 await expect.poll(async()=>{const p=await parts();return [p.ug_wing_left.meshes,p.ug_wing_right.meshes];},{timeout:10000}).toEqual([0,0]);
 const after=await page.evaluate(()=>(window as any).__game.fleet().drawnUpgradeParts((window as any).__sultan));
 expect(after).toContain(await page.evaluate(()=>(window as any).__game.fleet().catalog.upgrades.idOf('spl_c_s_b')));
 expect(after).not.toContain(ids.spoiler);
});

test('a dummy part replaces the car\'s own exhaust or bumper, hiding it, and shows its damaged atomic with the bumper\'s damage',async({page})=>{
 test.setTimeout(240000);
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await endStoryMission(page);
 await expect.poll(async()=>(await state(page)).player.grounded,{timeout:60000}).toBe(true);
 await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(2486,g.groundAt(2486,1662,40)+.05,1662);});
 await page.waitForTimeout(2500);
 const ids=await page.evaluate(async()=>{
  const g=(window as any).__game,fleet=g.fleet(),up=fleet.catalog.upgrades;
  const car=await fleet.spawnScriptCar(560,{x:2481,y:g.groundAt(2481,1666,40),z:1666},Math.PI/2);(window as any).__sultan=car;
  const ids={exhaust:up.idOf('exh_a_s'),front:up.idOf('fbmp_a_s'),rear:up.idOf('rbmp_a_s'),spoiler:up.idOf('spl_a_s_b')};
  const before:Record<string,number>={};for(const name of ['exhaust_ok','bump_front_dummy','bump_rear_dummy']){let n=0;car.car.root.getObjectByName(name)?.traverse((o:any)=>{if(o.userData.nativeAtomic!==undefined&&o.visible)n++;});before[name]=n;}
  for(const id of Object.values(ids))fleet.drawUpgradePart(car,id);
  return {...ids,doubleExhaust:(car.modelFlags&0x2000)!==0,before};
 });
 // Per component frame: the car's own atomics shown, and the part's intact and damaged atomics shown.
 const look=async()=>page.evaluate(()=>{const car=(window as any).__sultan,out:Record<string,{own:number;parts:number;ok:number;dam:number}>={};
  for(const name of ['exhaust_ok','bump_front_dummy','bump_rear_dummy','ug_spoiler']){
   const frame=car.car.root.getObjectByName(name);let own=0,parts=0,ok=0,dam=0;
   const walk=(node:any,inPart:boolean)=>{const part=inPart||!!node.userData.nativePart;if(node.userData.nativeAtomic!==undefined){if(part){parts++;if(node.visible)(/_dam$/i.test(node.parent?.name??'')?dam++:ok++);}else if(node.visible)own++;}for(const c of node.children)walk(c,part);};
   if(frame)walk(frame,false);out[name]={own,parts,ok,dam};
  }
  return out;});
 await expect.poll(async()=>{const l=await look();return l.exhaust_ok.parts>0&&l.bump_front_dummy.parts>0&&l.bump_rear_dummy.parts>0&&l.ug_spoiler.parts>0;},{timeout:15000}).toBe(true);
 const on=await look();
 expect(on.bump_front_dummy).toMatchObject({own:0,ok:1,dam:0});expect(on.bump_rear_dummy).toMatchObject({own:0,ok:1,dam:0});
 expect(on.exhaust_ok.own).toBe(0);expect(on.exhaust_ok.ok).toBe(ids.doubleExhaust?2:1);
 // The spoiler's own damaged atomic (spl_a_s_b_dam) is not drawn over its intact one.
 expect(on.ug_spoiler).toMatchObject({ok:1,dam:0});
 await page.evaluate(()=>{const g=(window as any).__game,car=(window as any).__sultan,r=g.render(),t=car.car.body.translation(),cam=r.camera.position.clone();
  r.fixedCamera={position:cam.clone().set(t.x+5,t.y+1.6,t.z+3),target:()=>cam.clone().set(t.x,t.y+.3,t.z)};});
 await page.waitForTimeout(800);
 await page.screenshot({path:test.info().outputPath('sultan-kit.png'),scale:'css'});
 // The front bumper damaged: the part's damaged atomic, as the bumper's own would have been.
 await page.evaluate(()=>(window as any).__sultan.car.setComponentDamage({bump_front:1}));
 expect((await look()).bump_front_dummy).toMatchObject({own:0,ok:0,dam:1});
 // Off again: the car's own exhaust and bumpers back (the front one damaged, as its component is).
 await page.evaluate(i=>{const g=(window as any).__game,car=(window as any).__sultan;for(const id of [i.exhaust,i.front,i.rear])g.fleet().removeUpgradePart(car,id);},ids);
 const off=await look();
 expect(off.exhaust_ok).toMatchObject({own:ids.before.exhaust_ok,parts:0});expect(off.bump_rear_dummy).toMatchObject({own:ids.before.bump_rear_dummy,parts:0});expect(off.bump_front_dummy).toMatchObject({own:ids.before.bump_front_dummy,parts:0});
});

test('a wheel set replaces all four wheels, scaled to the car\'s wheels by m_fWheelScale and its wheel flags, and comes off again',async({page})=>{
 test.setTimeout(240000);
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await endStoryMission(page);
 await expect.poll(async()=>(await state(page)).player.grounded,{timeout:60000}).toBe(true);
 await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(2486,g.groundAt(2486,1662,40)+.05,1662);});
 await page.waitForTimeout(2500);
 // An Infernus: 0.7 wheels all round, its rear ones widened (WHEEL_R_WIDE, 0x4000).
 const wheel=await page.evaluate(async()=>{
  const g=(window as any).__game,fleet=g.fleet(),up=fleet.catalog.upgrades;
  const car=await fleet.spawnScriptCar(411,{x:2481,y:g.groundAt(2481,1666,40),z:1666},Math.PI/2);(window as any).__car=car;
  const id=up.idOf('wheel_sr6');fleet.drawUpgradePart(car,id);return id;
 });
 const wheels=async()=>page.evaluate(()=>{const car=(window as any).__car,names=car.car.wheelFrameNames(),out:Record<string,{own:number;parts:number;scale:number[]}>={};
  for(const [wheel,name] of Object.entries(names) as [string,string][]){
   const frame=car.car.root.getObjectByName(name);let own=0,parts=0;
   const walk=(node:any,inPart:boolean)=>{const part=inPart||!!node.userData.nativePart;if(node.userData.nativeAtomic!==undefined&&node.visible)part?parts++:own++;for(const c of node.children)walk(c,part);};
   walk(frame,false);
   const e=frame.matrix.elements,len=(i:number)=>Math.hypot(e[i],e[i+1],e[i+2]);
   out[wheel]={own,parts,scale:[len(0),len(4),len(8)].map(v=>+v.toFixed(3))};
  }
  return {out,wheelScale:car.wheelScale};});
 await expect.poll(async()=>Object.values((await wheels()).out).every(w=>w.parts>0),{timeout:15000}).toBe(true);
 await page.waitForTimeout(300);
 const on=await wheels();
 expect(on.wheelScale).toBeCloseTo(.7,5);
 for(const [name,w] of Object.entries(on.out)){
  expect(w.own).toBe(0);
  // Width (the axle) 0.7/0.7 times the diameter, the rear ones 1.1 times wider; diameter the 0.7 wheel size.
  expect(w.scale[0]).toBeCloseTo(name.startsWith('rear')?1.1:1,2);expect(w.scale[1]).toBeCloseTo(.7,2);expect(w.scale[2]).toBeCloseTo(.7,2);
 }
 await page.evaluate(()=>{const g=(window as any).__game,car=(window as any).__car,r=g.render(),t=car.car.body.translation(),cam=r.camera.position.clone();
  r.fixedCamera={position:cam.clone().set(t.x+1.5,t.y+1.2,t.z+5),target:()=>cam.clone().set(t.x,t.y+.2,t.z)};});
 await page.waitForTimeout(800);
 await page.screenshot({path:test.info().outputPath('infernus-wheels.png'),scale:'css'});
 await page.evaluate(id=>{const g=(window as any).__game;g.fleet().removeUpgradePart((window as any).__car,id);},wheel);
 await page.waitForTimeout(300);
 const off=await wheels();
 expect(off.wheelScale).toBe(1);
 for(const w of Object.values(off.out)){expect(w.parts).toBe(0);expect(w.own).toBe(1);expect(w.scale.map(v=>Math.round(v*100)/100)).toEqual([1,1,1]);}
});
