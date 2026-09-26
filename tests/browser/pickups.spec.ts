import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
test('native SCM pickups spin, grant armour, ammo and bribes, regenerate after 36 s away, and pay for collectables and snapshots',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{WorldPickups},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPickups.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  const state={wanted:2,armour:0,given:[] as number[][]};
  const pickups=new WorldPickups(sim,scene,base,{weaponForModel:(model:string)=>model==='colt45'?22:undefined,giveWeapon:(weapon:number,ammo:number)=>{state.given.push([weapon,ammo]);return true;},wantedLevel:()=>state.wanted,setWantedLevel:(l:number)=>{state.wanted=l;},armour:()=>state.armour,setArmour:(v:number)=>{state.armour=v;}});
  const make=(model:string,dictionary:string,category:string,type:number,x:number,modelId:number)=>({id:`${modelId}:${x}`,command:'CREATE_PICKUP',section:'INITIAL',offset:0,modelId,model,dictionary,type,category,ammo:0,position:[x,0,1]});
  pickups.setPickups([make('bodyarmour','icons7','armour',15,0,1242),make('colt45','colt45','weapon',15,3,346),make('bribe','icons9','bribe',15,6,1247),make('cj_horse_Shoe','Horse_shoe_pick','horseshoe',3,9,954),make('camerapickup','icons','snapshot',20,12,1253),make('cj_horse_Shoe','Horse_shoe_pick','horseshoe',3,60,954)]);
  pickups.setAmbient([1,1,1]);
  const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(900,500);renderer.setClearColor(0x6f7d86);renderer.domElement.id='pickup-preview';renderer.domElement.style.cssText='position:fixed;inset:0;z-index:9999';document.body.append(renderer.domElement);
  const camera=new THREE.PerspectiveCamera(40,900/500,.05,100);camera.position.set(6,2.2,6.5);camera.lookAt(6,1,0);camera.updateMatrixWorld();
  for(let i=0;i<200&&pickups.snapshot().spawned<6;i++){pickups.render({x:6,z:0},i*16);await new Promise(r=>setTimeout(r,25));}
  const spin0=(scene.children.find((c:any)=>Math.abs(c.position.x)<.01) as any)?.rotation.y;pickups.render({x:6,z:0},512);const spin1=(scene.children.find((c:any)=>Math.abs(c.position.x)<.01) as any)?.rotation.y;
  renderer.render(scene,camera);const shot=renderer.domElement.toDataURL('image/png');
  const at=(x:number)=>{sim.player.position={x,y:0,z:-1.1};};
  at(0);pickups.step(1/60);const armour=state.armour;
  at(3);pickups.step(1/60);at(6);pickups.step(1/60);at(9);pickups.step(1/60);
  const afterCollect={...pickups.snapshot(),wanted:state.wanted,given:state.given,money:sim.money};
  // Regeneration: 36 s for ON_STREET_SLOW, and only once the player is more than 10 units away.
  at(3);for(let i=0;i<60*40;i++)pickups.step(1/60);const stayed=pickups.snapshot().active;
  at(40);pickups.step(1/60);const regenerated=pickups.snapshot().active;
  // CPickups::PictureTaken with the snapshot pickup on screen.
  camera.lookAt(12,1,0);camera.updateMatrixWorld();const photo=pickups.pictureTaken(camera);
  const final={...pickups.snapshot(),money:sim.money};pickups.dispose();sim.dispose();renderer.dispose();
  return {spawned:afterCollect.spawned,shot,spin:[spin0,spin1],armour,afterCollect,stayed,regenerated,photo,final};
 });
 const {shot,...summary}=result;console.log(JSON.stringify(summary));
 expect(result.armour).toBe(100);expect(result.afterCollect.wanted).toBe(1);expect(result.afterCollect.given).toEqual([[22,30]]);expect(result.afterCollect.money).toBe(100);expect(result.afterCollect.counts.horseshoe).toBe(1);
 expect(result.spin[1]).not.toBe(result.spin[0]);expect(result.stayed).toBe(2);expect(result.regenerated).toBe(5);expect(result.photo).toBe(true);expect(result.final.counts.snapshot).toBe(1);expect(result.final.money).toBe(200100);
 writeFileSync('artifacts/native-pickups.png',Buffer.from(shot.split(',')[1],'base64'));expect(errors).toEqual([]);
});

test('a save disc reports the save and stays where it is, as the PSAVE thread recreates it',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{WorldPickups},{Simulation},{readInitialSavePoints,nativeSaveEffects},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPickups.ts','/src/simulation/Simulation.ts','/src/assets/scmSavePoints.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  const points=readInitialSavePoints(new Uint8Array(await (await fetch(`${base}files/scripts/main.scm`)).arrayBuffer()));
  const outside=points.find((p:any)=>p.pickup[2]<900)!;
  const saves:string[]=[];
  const pickups=new WorldPickups(sim,scene,base,{weaponForModel:()=>undefined,giveWeapon:()=>false,wantedLevel:()=>0,setWantedLevel:()=>{},armour:()=>0,setArmour:()=>{},onSave:(p:any)=>saves.push(p.id)});
  pickups.setPickups([{id:'save-disc',command:'CREATE_PICKUP',section:'INITIAL',offset:0,modelId:1277,model:'pickupsave',dictionary:'pickupsave',type:3,category:'save',ammo:0,position:outside.pickup}]);
  // Walking into the disc reports the save; a car does not reach it.
  sim.player.position={x:outside.pickup[0],y:outside.pickup[2],z:-outside.pickup[1]};
  pickups.step(1/60,()=>false);const inCar=[...saves];
  pickups.step(1/60);const onFoot=[...saves];
  pickups.step(1/60);const repeat=[...saves];
  const state=pickups.snapshot();
  const effects=nativeSaveEffects({health:7,maxHealth:100,timeMinutes:23*60});
  pickups.dispose();sim.dispose();
  return {inCar,onFoot,repeat,active:state.active,effects,point:{respawn:outside.respawn,heading:outside.heading}};
 });
 console.log(JSON.stringify(result));
 expect(result.inCar).toEqual([]);expect(result.onFoot).toEqual(['save-disc']);
 // The disc stays active, so walking back in saves again.
 expect(result.repeat).toEqual(['save-disc','save-disc']);expect(result.active).toBe(1);
 expect(result.effects).toEqual({health:100,timeMinutes:5*60,passedMinutes:360,wanted:0,stamina:100});
 expect(errors).toEqual([]);
});
