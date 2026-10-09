import {test,expect} from '@playwright/test';
// GET_CHAR_HIGHEST_PRIORITY_EVENT (iOS 0x1001fb880) reads what CEventGroup::Add recorded (0x10035ca24): the received
// event of highest priority, a quiet sound (8) under a shot heard (35) under one whizzing by (36) under damage (65);
// the script loop clears a mission ped's once the scripts have run. impound.scm's guards wake on 15, 49 and 9, or on 62
// within five units.
test('a ped records the highest-priority event it receives until the scripts have looked',async({page})=>{
 test.setTimeout(180000);await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{WorldPedestrians},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(/* @vite-ignore */ p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene();
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(150,.5,150).setTranslation(2490,12,1680));
  sim.respawn={x:2490,y:12.55,z:1680};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const crowd=new WorldPedestrians(sim,scene,new URL('/play/world/',location.href).href,()=>undefined) as any;
  try{
   for(let i=0;i<300&&!crowd.people.length;i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,25));}
   const p=crowd.people[0];if(!p)throw new Error('no ped');
   p.mission=true;p.health=1000;
   const q=p.actor.player.position,seen=()=>p.highestEvent?.type??0,out:Record<string,number>={};
   // CJ's footsteps right beside him: a quiet sound.
   crowd.hearSoundQuiet({source:'player',level:55,position:{x:q.x+1,y:-q.z,z:q.y+1}});out.footsteps=seen();
   // A shot fired 20 away, aimed elsewhere: heard. Then one along a line passing a unit from him: whizzed by.
   crowd.gunShot({x:q.x+20,y:q.y+1,z:q.z},false,undefined,{x:q.x+20,y:q.y+1,z:q.z+40});out.heard=seen();
   crowd.gunShot({x:q.x+20,y:q.y+1,z:q.z+1},false,undefined,{x:q.x-20,y:q.y+1,z:q.z+1});out.whizzed=seen();
   // A quiet sound after it is lower and changes nothing.
   crowd.hearSoundQuiet({source:'player',level:55,position:{x:q.x+1,y:-q.z,z:q.y+1}});out.stillWhizzed=seen();
   crowd.damageCollider(p.collider.handle,1,{x:0,z:1},'bullet',{weapon:22});out.damaged=seen();
   crowd.clearMissionEvents();out.cleared=seen();
   return out;
  }finally{crowd.dispose();sim.dispose();}
 });
 expect(result).toEqual({footsteps:62,heard:15,whizzed:49,stillWhizzed:49,damaged:9,cleared:0});
});
