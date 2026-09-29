import {test,expect} from '@playwright/test';
/** Y and N at a pedestrian (CPad::ConversationYesJustDown and ConversationNoJustDown): the ped stops, turns to CJ and
 * answers; an N makes a passer-by give him the finger and a rival gang member square up and come for him. */
test('a ped answers the player\'s Y and N, and an insulted rival comes for him',async({page})=>{
 test.setTimeout(180000);await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{WorldPedestrians},{WantedSystem},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/simulation/WantedSystem.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(/* @vite-ignore */ p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(2490,12,1680));
  sim.respawn={x:2490,y:12.55,z:1680};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const crowd=new WorldPedestrians(sim,scene,base,()=>undefined,new WantedSystem()) as any;
  const said:string[]=[];crowd.onGreet=()=>said.push('greet');crowd.onThreat=()=>said.push('threat');
  const tick=()=>{crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();for(const p of crowd.people)p.view.update(p.actor,1/60);};
  const standBeside=(p:any)=>{const q=p.actor.player.position;sim.player.position={x:q.x+2,y:q.y,z:q.z};sim.player.heading=-Math.PI/2;
   sim.playerBody.setTranslation({x:q.x+2,y:q.y+.9,z:q.z},true);sim.playerBody.setNextKinematicTranslation({x:q.x+2,y:q.y+.9,z:q.z});sim.world.step();};
  // Ballas turf: their members and ordinary passers-by walk the street.
  crowd.gangTurf=()=>({gang:0,strength:255});crowd.gangsNeeded=()=>1;
  const member=async(gang:number|undefined)=>{const fits=(p:any)=>p.gang===gang&&!p.officer&&p.health>0&&p.down===0&&!p.chat&&!p.rage;
   for(let i=0;i<400&&!crowd.people.some(fits);i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}
   const p=crowd.people.find(fits);if(!p)throw new Error(`no member of gang ${gang}: `+JSON.stringify(crowd.people.map((q:any)=>[q.gang,q.officer,q.health,q.down]))+JSON.stringify(crowd.snapshot().targets));p.loiter=true;return p;};
  const out:Record<string,unknown>={};
  try{
   // Nobody within reach ahead: nothing is said.
   out.nobody=crowd.converse('yes',{range:.01});
   // A passer-by: one of the street's peds taken out of the gang and its party, with the normal decision maker.
   const homie=await member(0);crowd.leaveParty(homie);homie.gang=undefined;homie.decisionMaker=2;for(let i=0;i<30;i++)tick();standBeside(homie);
   out.yes=crowd.converse('yes',{range:4});
   const from={...homie.actor.player.position};let moved=0;
   for(let i=0;i<120;i++){tick();moved=Math.max(moved,Math.hypot(homie.actor.player.position.x-from.x,homie.actor.player.position.z-from.z));}
   out.yesSaid=[...said];out.yesMoved=moved;said.length=0;
   for(let i=0;i<200&&homie.chat;i++)tick();
   standBeside(homie);out.no=crowd.converse('no',{range:4});
   let fist=false;for(let i=0;i<120;i++){tick();if(homie.view.reactionName==='fucku')fist=true;}
   out.noSaid=[...said];out.fist=fist;said.length=0;
   const rival=await member(0);crowd.leaveParty(rival);for(let i=0;i<30;i++)tick();standBeside(rival);
   out.insult=crowd.converse('no',{range:4});
   let came=false;for(let i=0;i<600&&!came;i++){tick();came=rival.retaliate>0;}
   out.came=came;out.rivalSaid=[...said];
   return out;
  }finally{crowd.dispose();sim.dispose();}
 });
 expect(result.nobody).toBe('none');
 expect(result.yes).toBe('reply');expect(result.yesSaid).toEqual(['greet']);expect(result.yesMoved).toBeLessThan(.3);
 expect(result.no).toBe('reply');expect(result.noSaid).toEqual(['threat']);expect(result.fist).toBe(true);
 expect(result.insult).toBe('fight');expect(result.rivalSaid).toContain('threat');expect(result.came).toBe(true);
});
