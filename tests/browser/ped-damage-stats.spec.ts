import {test,expect} from '@playwright/test';
// iOS CPedDamageResponseCalculator::AccountForPedDamageStats (0x10028a070): a ped takes any weapon's damage times its
// pedstats defend weakness, and the player's own blow on a member of his group is cut to a tenth, 12.5 at most, unless
// it is a flamethrower's or a blast's.
test('a ped takes damage by its defend weakness, and a recruit a tenth of the player\'s shot',async({page})=>{
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
   const shoot=(damage:number,weapon:number,kind='bullet')=>{const before=p.health;crowd.damageCollider(p.collider.handle,damage,{x:0,z:1},kind,{weapon,byPlayer:true});return +(before-p.health).toFixed(3);};
   p.health=1000;p.defendMult=1.8;
   const tourist=shoot(10,22);
   p.health=1000;p.defendMult=1;p.follow=true;
   const recruit=shoot(10,22);
   p.health=1000;p.follow=true;
   const recruitHard=shoot(200,22);
   p.health=1000;p.follow=true;
   const recruitFlame=shoot(10,37);
   // IsFriendlyWith, either way round: a Families member whose table respects PLAYER1 (MAIN sets it), not a civilian.
   const {NativeAcquaintance}=await import('/src/ped/nativeAcquaintance.ts' as string);
   const respects=new NativeAcquaintance();respects.setAs(0,1<<0);
   const friends={homie:crowd.friendlyWithPlayer({pedType:'GANG2',acquaintance:respects}),stranger:crowd.friendlyWithPlayer({pedType:'CIVMALE',acquaintance:new NativeAcquaintance()})};
   // One ped's shot at another: the victim's defend weakness, and a mission ped's own group cut.
   const victim={defendMult:1.5,mission:false} as any,damager={} as any;
   const street=crowd.pedOnPedDamage(victim,damager,10,22);
   victim.mission=true;victim.defendMult=1;crowd.sameScriptGroup=(a:any,b:any)=>a===victim&&b===damager;
   const sameGroup=crowd.pedOnPedDamage(victim,damager,10,22),sameGroupBlast=crowd.pedOnPedDamage(victim,damager,10,51);
   crowd.sameScriptGroup=()=>false;
   const otherGroup=crowd.pedOnPedDamage(victim,damager,10,22);
   return {tourist,recruit,recruitHard,recruitFlame,friends,pedOnPed:{street,sameGroup,sameGroupBlast,otherGroup}};
  }finally{crowd.dispose();sim.dispose();}
 });
 // A tourist's 1.8.
 expect(result.tourist).toBeCloseTo(18,3);
 // A tenth of it from the player to his recruit, never more than 12.5; a flamethrower's is not cut.
 expect(result.recruit).toBeCloseTo(1,3);
 expect(result.recruitHard).toBeCloseTo(12.5,3);
 expect(result.recruitFlame).toBeCloseTo(10,3);
 expect(result.friends).toEqual({homie:true,stranger:false});
 expect(result.pedOnPed.street).toBeCloseTo(15,3);
 expect(result.pedOnPed.sameGroup).toBeCloseTo(1,3);
 expect(result.pedOnPed.sameGroupBlast).toBeCloseTo(10,3);
 expect(result.pedOnPed.otherGroup).toBeCloseTo(10,3);
});
