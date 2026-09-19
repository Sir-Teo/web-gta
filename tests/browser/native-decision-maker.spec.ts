import {test,expect} from '@playwright/test';
import {existsSync,readFileSync} from 'node:fs';

// The pedstats decision makers answering the player's punches, shots and aimed gun. The retail files come from the
// content depot, as the unit tests read them; the published world does not carry them yet.
const decision=`${process.env.GTA_CONTENT_DIR}/data/decision/allowed`;
const files=['GangMbr.ped','Cop.ped','R_Norm.ped','R_Tough.ped','R_Weak.ped','Fireman.ped','m_empty.ped','Indoors.ped'];
test.skip(!existsSync(`${decision}/R_Norm.ped`),'GTA_CONTENT_DIR has no decision makers.');

test('street peds answer the player from their decision makers',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/models.html');
 const texts=files.map(name=>readFileSync(`${decision}/${name}`,'latin1'));
 const result=await page.evaluate(async texts=>{
  const [{WorldPedestrians},{Simulation},{THREE,RAPIER},{readDecisionMaker}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts','/src/ped/nativeDecisionMaker.ts'].map(p=>import(/* @vite-ignore */p)));
  await RAPIER.init();
  const sim=new Simulation(),scene=new THREE.Scene();
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(150,.5,150).setTranslation(2490,12,1680));
  sim.respawn={x:2490,y:12.55,z:1680};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const crowd=new WorldPedestrians(sim,scene,new URL('/play/world/',location.href).href,()=>undefined);
  try{
   for(let i=0;i<300&&crowd.snapshot().people.length<2;i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,25));}
   const internal=crowd as any;internal.catalog.decisionMakers=texts.map((t:string)=>readDecisionMaker(t));
   const tick=()=>{crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();crowd.render(1,[.7,.7,.7],0);};
   const people:any[]=internal.people.filter((p:any)=>!p.officer);
   const fresh=(p:any,dm:number)=>{p.decisionMaker=dm;p.health=100;p.retaliate=0;p.flee=0;p.fleePlayer=undefined;p.event=undefined;p.gunReact=undefined;p.down=0;p.stagger=0;p.gang=undefined;p.weapon=undefined;};
   const at=(p:any)=>{const q=p.actor.player.position;sim.player.position={x:q.x,y:q.y,z:q.z-1.2};sim.player.heading=0;};
   const answer=(p:any)=>({fight:p.retaliate>0,flee:p.flee>0,react:!!p.gunReact,event:p.event?.type??null});
   const punch=(p:any)=>{at(p);crowd.damageCollider(p.collider.handle,1,{x:0,z:1},'melee',{weapon:0});tick();return answer(p);};
   const shoot=(p:any)=>{at(p);crowd.damageCollider(p.collider.handle,1,{x:0,z:1},'bullet',{weapon:22});tick();return answer(p);};
   const [a,b]=people;
   // rand_tough answers a fist with a fist (KILL_PED_ON_FOOT 100), a gun by running (IsKillTaskAppropriate fails).
   fresh(a,3);const toughPunched=punch(a);
   const repeat=(()=>{a.retaliate=3;crowd.damageCollider(a.collider.handle,1,{x:0,z:1},'melee',{weapon:0});return a.retaliate;})();
   fresh(a,3);const toughShot=shoot(a);
   // rand_weak always runs (SMART_FLEE_ENTITY 100); bystanders ignore the panicked ped.
   fresh(a,4);fresh(b,2);const bq=b.actor.player.position;b.actor.player.position={x:a.actor.player.position.x+3,y:bq.y,z:a.actor.player.position.z};
   const weakPunched=punch(a);for(let i=0;i<120;i++)tick();const bystander=answer(b);
   // rand_norm hearing the player's shot flees; rand_tough aimed at reacts (REACT_TO_GUN_AIMED_AT 100).
   fresh(a,2);const q=a.actor.player.position;crowd.gunShot({x:q.x,y:q.y+1,z:q.z-5},false);const normShot=answer(a);
   fresh(a,3);a.actor.player.heading=Math.PI;at(a);const aimed=crowd.gunAimedAt(a.collider.handle,{x:q.x,y:q.y+1,z:q.z-3});const toughAimed=answer(a);
   // The Families answer the player's shot from the friend column: mostly nothing (TASK_NONE 95).
   let familiesAnswered=0;for(let i=0;i<40;i++){fresh(a,3);a.gang=1;crowd.gunShot({x:q.x,y:q.y+1,z:q.z-5},false);if(a.flee>0||a.retaliate>0)familiesAnswered++;}
   return {toughPunched,repeat,toughShot,weakPunched,bystander,normShot,aimed,toughAimed,familiesAnswered};
  }finally{crowd.dispose();sim.dispose?.();}
 },texts);
 expect(result.toughPunched).toMatchObject({fight:true,flee:false,event:9});
 // Damage while answering damage keeps the answer: no new decision, no reset of the fight.
 expect(result.repeat).toBe(3);
 expect(result.toughShot).toMatchObject({fight:false,flee:true,event:9});
 expect(result.weakPunched).toMatchObject({fight:false,flee:true});
 expect(result.bystander).toMatchObject({fight:false,flee:false});
 expect(result.normShot).toMatchObject({flee:true,event:15});
 expect(result.aimed).toBe(true);expect(result.toughAimed).toMatchObject({react:true,event:31});
 expect(result.familiesAnswered).toBeLessThan(10);
 expect(errors).toEqual([]);
});
