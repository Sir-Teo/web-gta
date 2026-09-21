import {test,expect} from '@playwright/test';

test('a gang party hangs out like CTaskComplexGangLeader: the leader stands, turns to a member, talks with the gangs clips, looks at members, then walks off and the party breaks up',async({page})=>{
 test.setTimeout(180000);await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{WorldPedestrians},{WantedSystem},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/simulation/WantedSystem.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(/* @vite-ignore */ p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(300,.5,300).setTranslation(2490,12,1680));
  sim.respawn={x:2450,y:12.55,z:1720};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const crowd=new WorldPedestrians(sim,scene,base,()=>undefined,new WantedSystem()) as any;
  const strengths=Array(10).fill(0);strengths[1]=255;
  crowd.canSpawn=()=>true;crowd.gangTurf=()=>({gang:1,strength:255});crowd.gangsNeeded=()=>2;crowd.pedTargets=()=>({dealers:0,gangs:6,cops:0,other:0,gangStrengths:strengths});
  crowd.gangWeaponRandom=()=>.9;
  // No walk at the start (.5), then no ambient draws (.9) until the probe asks for them.
  let ambient=.9;crowd.hangoutRandom=()=>ambient;
  try{
   // The party this test is about is the one CTaskComplexGangLeader forms, which has a leader and members to
   // turn to and look at. Under load the models stream in one at a time, so a party can exist for a moment
   // with fewer; waiting for the party the assertions describe is what keeps this from reading that moment.
   const party=()=>crowd.people.find((p:any)=>p.hangout&&(p.party?.members?.length??0)>=3);
   for(let i=0;i<400&&!party();i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}
   const leader=party();if(!leader)throw new Error('no party');
   const members=leader.party.members as any[];
   const tick=()=>{crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();for(const p of members)p.view.update(p.actor,1);};
   for(let i=0;i<5;i++)tick();
   const phase=()=>leader.hangout?.phase??null;
   const until=(want:(ph:string|null)=>boolean,cap:number)=>{let i=0;for(;i<cap&&!want(phase());i++)tick();return i;};
   const start={phase:phase(),size:members.length,positions:members.map((m:any)=>({...m.actor.player.position}))};
   // The stand: nobody moves until the leader turns to face a member (the draw of .9 picks the last other member).
   until(ph=>ph!=='stand',1200);
   const drift=Math.max(...members.map((m:any,i:number)=>Math.hypot(m.actor.player.position.x-start.positions[i].x,m.actor.player.position.z-start.positions[i].z)));
   const facePhase=phase(),facing=leader.hangout?.facing;
   let faced=false;for(let i=0;i<300&&!faced&&facing;i++){tick();const d=Math.atan2(facing.actor.player.position.x-leader.actor.player.position.x,facing.actor.player.position.z-leader.actor.player.position.z)-leader.actor.player.heading;faced=Math.abs(Math.atan2(Math.sin(d),Math.cos(d)))<=.25;}
   until(ph=>ph!=='face',300);
   const afterFace=phase();
   // Ambient draws in the stand: a talk clip (5 in 501) and a look at a member (5 %), forced by a low draw for two ticks.
   ambient=.005;tick();tick();ambient=.9;
   const talk=members.map((m:any)=>m.view.reactionName??null),looks=members.map((m:any)=>!!m.look&&!!m.lookTarget);
   // The next face ends on a low draw: the walk (0.15 s of it) and the party breaks up.
   until(ph=>ph==='face',1200);ambient=.01;until(ph=>ph!=='face',300);
   const wander=phase();
   until(ph=>ph===null,120);
   const dissolved=members.every((m:any)=>!m.party)&&!leader.hangout;
   return {start:{phase:start.phase,size:start.size},drift,facePhase,facingIsMember:!!facing&&members.includes(facing)&&facing!==leader,faced,afterFace,talk,looks,wander,dissolved};
  }finally{crowd.dispose();sim.dispose();}
 });
 expect(result.start.size).toBeGreaterThanOrEqual(3);expect(result.start.phase).toBe('stand');
 expect(result.drift).toBeLessThan(0.5);
 expect(result.facePhase).toBe('face');expect(result.facingIsMember).toBe(true);expect(result.faced).toBe(true);
 expect(result.afterFace).toBe('stand');
 expect(result.talk.some(t=>t&&/^prtial_gngtlk[a-h]$/.test(t))).toBe(true);
 expect(result.looks.some(Boolean)).toBe(true);
 expect(result.wander).toBe('wander');expect(result.dissolved).toBe(true);
});
