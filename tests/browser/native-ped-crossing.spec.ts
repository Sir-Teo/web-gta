import {test,expect} from '@playwright/test';

// CTaskComplexObserveTrafficLightsAndAchieveHeading: a wanderer reaching a link that crosses a road at a pedestrian
// light faces the road, looks (ROADCROSS) and waits while the light is not green, then crosses.
test('a wanderer waits for the pedestrian green at a signalled crossing',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{WorldPedestrians},{Simulation},{THREE,RAPIER},{wanderSector,wanderTargetOffset}]=await Promise.all(['/src/simulation/WorldPedestrians.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts','/src/ped/nativeWander.ts'].map(p=>import(/* @vite-ignore */p)));
  await RAPIER.init();
  const sim=new Simulation(),scene=new THREE.Scene();
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(400,.5,400).setTranslation(2490,12,1680));
  sim.respawn={x:2490,y:12.55,z:1680};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const crowd=new WorldPedestrians(sim,scene,new URL('/play/world/',location.href).href,()=>undefined);
  try{
   for(let i=0;i<300&&!crowd.snapshot().people.length;i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,25));}
   const internal=crowd as any,catalog=internal.catalog;
   // A pedestrian link with the road-cross and pedestrian-light bits, near Grove Street.
   let found:any;
   for(const area of catalog.areas.values())for(const node of area.nodes){
    if(found||node.kind!=='pedestrian')continue;
    for(let i=0;i<node.linkCount;i++){const bits=area.intersections[node.baseLink+i]??0,ref=area.links[node.baseLink+i];if((bits&3)===3&&ref.area===area.area){found={node,next:area.nodes[ref.node]};break;}}
   }
   if(!found)return {found:false};
   let light=0;internal.lightClock=()=>light;
   const tick=()=>{crowd.beforeStep(1/60,[]);sim.world.step();crowd.afterStep();crowd.render(1,[.7,.7,.7],0);};
   const p=internal.people.find((q:any)=>!q.officer&&q.health>0);p.loiter=false;p.flee=0;
   // A fixed seed: UpdateDir's (3 × frame + seed) % 100 draw must not turn him off the crossing link at the node.
   p.seed=0;
   // Stand the ped half a unit short of its point at the crossing's near node, facing its link across the road.
   const near=wanderTargetOffset(found.node.width,p.seed),at={x:found.node.position[0]+near.x,z:-(found.node.position[1]+near.y)};
   // The crossing may lie beyond the pad: a floor under it, or the ped hangs in the air (CTaskSimpleInAir) instead of walking.
   sim.world.createCollider(RAPIER.ColliderDesc.cuboid(80,.5,80).setTranslation(at.x,12,at.z));sim.world.step();
   const q=p.actor.player.position;p.actor.player.position={x:at.x,y:q.y,z:at.z-.3};p.body.setTranslation({x:at.x,y:q.y+.9,z:at.z-.3},true);p.collider.setTranslation({x:at.x,y:q.y+.9,z:at.z-.3});
   p.target=found.node;p.previousNode=undefined;
   p.wanderDir=wanderSector(found.next.position[0]-found.node.position[0],found.next.position[1]-found.node.position[1]);
   // Light time 0: the pedestrian phase is red.
   let started=-1,looked=false;
   for(let i=0;i<60*8;i++){tick();if(p.crossing&&started<0)started=i;if(p.view.reactionName==='roadcross')looked=true;}
   const waiting=!!p.crossing&&p.target===found.next,phase=p.crossing?.phase;
   const before={...p.actor.player.position};
   // 26 s into the cycle: the pedestrian green.
   light=26000;for(let i=0;i<60*6;i++)tick();
   return {found:true,started,looked,waiting,phase,crossed:!p.crossing,moved:Math.hypot(p.actor.player.position.x-before.x,p.actor.player.position.z-before.z)};
  }finally{crowd.dispose();}
 });
 expect(result.found).toBe(true);
 expect(result.started).toBeGreaterThanOrEqual(0);expect(result.looked).toBe(true);
 expect(result.waiting).toBe(true);
 expect(result.crossed).toBe(true);expect(result.moved).toBeGreaterThan(1);
 expect(errors).toEqual([]);
});
