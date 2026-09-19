import {test,expect} from '@playwright/test';
// CPickups::GivePlayerGoodiesWithPickUpMI: an adrenaline pill gives 20 s of m_bAdrenaline and a full sprint.
test('an adrenaline pill gives CJ 20 s of adrenaline and full stamina',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{WorldPickups},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPickups.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(/* @vite-ignore */p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  const pickups=new WorldPickups(sim,scene,base,{weaponForModel:()=>undefined,giveWeapon:()=>false,wantedLevel:()=>0,setWantedLevel:()=>{},armour:()=>0,setArmour:()=>{}});
  pickups.setPickups([{id:'1241:0',command:'CREATE_PICKUP',section:'INITIAL',offset:0,modelId:1241,model:'adrenaline',dictionary:'icons',type:15,category:'adrenaline',ammo:0,position:[0,0,1]}]);
  sim.player.stamina=20;sim.player.sprintExhausted=true;sim.player.position={x:0,y:0,z:-1.1};pickups.step(1/60);
  const out={adrenaline:sim.player.adrenaline,stamina:sim.player.stamina,exhausted:sim.player.sprintExhausted,active:pickups.snapshot().active};
  pickups.dispose();sim.dispose();return out;
 });
 expect(result).toEqual({adrenaline:20,stamina:100,exhausted:false,active:0});
 expect(errors).toEqual([]);
});
