/* Invariants the game must keep whatever the player does, checked in the page (gameInvariantsCheck.toString() is
 * evaluated there against the dev hook window.__game). Each broken one is an edge case: something no single spec
 * tests but play can reach. The fuzz spec (gameplay-fuzz.spec.ts) throws random play at the game and collects them.
 *
 * Checked:
 * - every body the game moves (CJ, cars, bikes, boats, planes, peds) has a finite position and speed;
 * - nothing that should stand on the world is well under it (fell through the ground);
 * - nothing moves impossibly fast (a physics blow-up): on foot past 30 m/s, a vehicle past 150 m/s, a spin past
 *   40 rad/s;
 * - CJ is not stuck: a push on the stick for three seconds on foot moves him (read from `pushing`);
 * - a ped's view is where its body is (the drawn character has not been left behind).
 * The world under a point is only trusted where the streamed window has collision. */
export function gameInvariantsCheck(pushing:boolean){
 const g=(window as any).__game,sim=g.sim,found:{kind:string;detail:string}[]=[];
 const fleet=g.fleet(),peds=g.pedestrians();
 const finite=(v:any)=>v&&Number.isFinite(v.x)&&Number.isFinite(v.y)&&Number.isFinite(v.z);
 const under=(p:any,margin:number)=>{const ground=g.groundAt(p.x,p.z,p.y+60);return ground!==null&&p.y<ground-margin&&g.groundAt(p.x,p.z,p.y+.5)===null;};
 const where=(p:any)=>`${p.x.toFixed(1)},${(-p.z).toFixed(1)},${p.y.toFixed(1)}`;
 const player=sim.player;
 const state=(window as any).__invariantState??={still:0,last:{...player.position}};
 if(!finite(player.position))found.push({kind:'player-nan',detail:JSON.stringify(player.position)});
 else{
  if(player.health>0&&under(player.position,3))found.push({kind:'player-under-world',detail:where(player.position)});
  const v=sim.playerBody.linvel();if(Math.hypot(v.x,v.z)>30&&!fleet.occupied&&!fleet.occupiedBike&&!fleet.occupiedPlane)found.push({kind:'player-too-fast',detail:`${Math.hypot(v.x,v.z).toFixed(1)} m/s at ${where(player.position)}`});
  const moved=Math.hypot(player.position.x-state.last.x,player.position.z-state.last.z);
  const onFoot=!fleet.occupied&&!fleet.occupiedBike&&!fleet.occupiedBoat&&!fleet.occupiedPlane&&player.health>0&&sim.knockdown===0;
  state.still=pushing&&onFoot&&moved<.05?state.still+1:0;state.last={...player.position};
  if(state.still===6)found.push({kind:'player-stuck',detail:where(player.position)});
 }
 const vehicles=[...fleet.cars].map((c:any)=>({kind:'car',body:c.car.body,id:c.modelId,wrecked:c.wrecked})).concat([...fleet.bikes,...fleet.boats,...fleet.planes].map((v:any)=>({kind:v.constructor.name,body:v.body,id:v.modelId,wrecked:v.wrecked})));
 for(const v of vehicles){
  if(!v.body.isEnabled?.())continue;
  const p=v.body.translation(),lv=v.body.linvel(),av=v.body.angvel();
  if(!finite(p)||!finite(lv)){found.push({kind:'vehicle-nan',detail:`${v.kind} ${v.id}`});continue;}
  if(Math.hypot(lv.x,lv.y,lv.z)>150)found.push({kind:'vehicle-too-fast',detail:`${v.kind} ${v.id} ${Math.hypot(lv.x,lv.y,lv.z).toFixed(0)} m/s at ${where(p)}`});
  if(Math.hypot(av.x,av.y,av.z)>40)found.push({kind:'vehicle-spin',detail:`${v.kind} ${v.id} ${Math.hypot(av.x,av.y,av.z).toFixed(0)} rad/s at ${where(p)}`});
  if(v.kind!=='WorldBoat'&&v.kind!=='WorldPlane'&&under(p,4))found.push({kind:'vehicle-under-world',detail:`${v.kind} ${v.id} at ${where(p)}`});
 }
 for(const p of peds?.people??[]){
  const q=p.actor.player.position;
  if(!finite(q)){found.push({kind:'ped-nan',detail:String(p.modelRef)});continue;}
  if(p.health>0&&under(q,3))found.push({kind:'ped-under-world',detail:`${p.modelRef} at ${where(q)}`});
  const view=p.view.root.position;if(p.view.root.visible&&Math.hypot(view.x-q.x,view.z-q.z)>3)found.push({kind:'ped-view-detached',detail:`${p.modelRef} ${Math.hypot(view.x-q.x,view.z-q.z).toFixed(1)} units from its body at ${where(q)}`});
 }
 return found;
}
