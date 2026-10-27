import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';

test('native boat fire uses PC model offsets and survives partial repairs until the boat recovery boundary',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{openStaticWorld},{openStaticWorldVehicles},{WorldBoat},{WorldFx},{Simulation},{resolveCarColors},{THREE,RAPIER}]=await Promise.all(['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/simulation/WorldBoat.ts','/src/simulation/fx/WorldFx.ts','/src/simulation/Simulation.ts','/src/assets/carColors.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(/* @vite-ignore */ p)));
  await RAPIER.init();const base=new URL('/play/world/',location.href).href,catalog=await openStaticWorldVehicles(await openStaticWorld(base)),sim=new Simulation(),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(45,1.5,.05,1000);sim.player.position={x:0,y:0,z:0};sim.playerCollider.setEnabled(false);
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(900,600);renderer.setClearColor(0x25303b);const fx=new WorldFx(scene,sim,camera);await fx.load(base);const rows:any[]=[],images:Record<string,string>={};
  const look=(x:number,y:number,z:number)=>{camera.position.set(x,y,z);camera.lookAt(0,2,0);camera.updateMatrixWorld();};
  try{
   for(const model of [430,452,453]){
    const assets=await catalog.load(model),boat=new WorldBoat(sim,scene,assets,{x:0,y:2,z:0},0,resolveCarColors(catalog.colors,assets.vehicle.model,0).colors);boat.setLighting([1,1,1],1,0);boat.frozen=true;boat.health=249;
    const fire=()=>fx.boatDamage.get(boat)?.fire;
    const step=(seconds:number,include=true)=>{for(let i=0;i<Math.round(seconds*60);i++){if(include){boat.beforeStep(1/60,undefined,camera.position);boat.update(1);}fx.step(1/60,[],[],[],[],include?[boat]:[]);}fx.draw(0);};
    const capture=(name:string)=>{const system=fire();return {name,health:boat.health,timer:boat.burnTimer,fire:!!system,local:system?[...system.local].slice(9):null,velAdd:system?[...system.velAdd]:null,particles:fx.manager.prims.flatMap((p:any)=>p.particles).filter((p:any)=>p.system===system).length,overheat:fx.manager.systems.filter((s:any)=>s.name.startsWith('overheat')).length};};
    try{
     look(250,2,0);step(.1);const distant=capture('distant');look(199,2,-199);step(.1);const diagonal=capture('diagonal'),original=fire();look(14,9,16);step(.6);const burning=capture('burning');renderer.render(scene,camera);images[String(model)]=renderer.domElement.toDataURL();
     boat.health=300;step(.5);const partial=capture('partially repaired'),sameAt300=fire()===original;boat.health=460;step(.1);const boundary=capture('recovery boundary'),sameAt460=fire()===original;
     boat.health=461;step(.1);const repaired=capture('repaired');boat.health=200;step(.1);const restarted=capture('reignited'),fresh=fire()!==original;boat.blowUp();step(.1);const wrecked=capture('wrecked');boat.dispose();step(4,false);
     rows.push({model,distant,diagonal,burning,partial,boundary,repaired,restarted,wrecked,sameAt300,sameAt460,fresh,remaining:fx.manager.systems.filter((s:any)=>s.name==='fire_car').length});
    }finally{if(!boat.disposed)boat.dispose();}
   }
  }finally{fx.dispose();sim.dispose();}
  renderer.render(scene,camera);const geometries=renderer.info.memory.geometries;renderer.dispose();return {rows,images,geometries,children:scene.children.length};
 });
 for(const [name,data] of Object.entries(result.images))writeFileSync(`artifacts/boat-fire-${name}.png`,Buffer.from(data.split(',')[1],'base64'));
 writeFileSync('artifacts/boat-fire.json',JSON.stringify({rows:result.rows,geometries:result.geometries,children:result.children,errors},null,2));
 const expected:Record<number,number[]>={430:[-1.5,-.5,1.2],452:[.4,-2.4,.8],453:[2,-1,.5]};
 for(const r of result.rows){expect(r.distant.fire).toBe(false);expect(r.distant.timer).toBe(0);expect(r.diagonal.fire).toBe(true);expect(r.diagonal.timer).toBeGreaterThan(0);expect(r.burning.local).toEqual(expected[r.model].map(Math.fround));expect(r.burning.velAdd).toEqual([0,0,0]);expect(r.burning.particles).toBeGreaterThan(0);expect(r.burning.overheat).toBe(0);
  expect(r.partial.fire).toBe(true);expect(r.sameAt300).toBe(true);expect(r.partial.timer).toBe(r.burning.timer);expect(r.boundary.fire).toBe(true);expect(r.sameAt460).toBe(true);expect(r.repaired.fire).toBe(false);expect(r.repaired.timer).toBe(0);expect(r.restarted.fire).toBe(true);expect(r.fresh).toBe(true);expect(r.wrecked.fire).toBe(false);expect(r.wrecked.timer).toBe(0);expect(r.remaining).toBe(0);
 }
 expect(result.geometries).toBe(0);expect(result.children).toBe(0);expect(errors).toEqual([]);
});
