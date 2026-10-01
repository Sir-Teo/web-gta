/* An objective-following player for the mission sweep (SWEEP_BOT=1). SA missions tell the player what to do through
 * the radar: a friendly car blip is a car to get into, a friendly char blip a homie to follow, a hostile char blip
 * someone to kill, a hostile car blip a car to chase down, a coordinate blip a place to go. This reads the script's
 * own blip table each tick and does what the blips ask, as a player would: it walks or drives CJ toward the target
 * with the game's own driving AI in a vehicle and at walking pace on foot (never past the people he follows), gets into the blipped car, and shoots at what
 * it is told to kill. Nobody but CJ is ever moved; the mission's characters play their own parts.
 *
 * It runs inside the page: missionBotTick.toString() is evaluated there. It returns what it did, or null when no
 * blip asks anything, so the sweep falls back to its locate-following autopilot. */
export function missionBotTick(dtSeconds:number){
 const w=window as any,g=w.__game,m=g.missionForProfiling(),r=m.runtime,world=r.world,radar=r.game.radar;
 const mem=w.__missionBot??={lastShot:0,lastEnter:0,armed:false,friendLast:undefined as any};
 const BLIP_CAR=1,BLIP_CHAR=2,BLIP_OBJECT=3,BLIP_COORD=4,BLIP_PICKUP=7;
 const me=world.pedPosition(1),vehicle=world.pedVehicle?.(1)??0;
 const alive=(h:number)=>{try{return world.pedExists?.(h)!==false&&(world.pedHealth?.(h)??1)>0;}catch{return false;}};
 const at=(t:any)=>{
  try{
   if(t.type===BLIP_CHAR)return alive(t.entityHandle)?world.pedPosition(t.entityHandle):undefined;
   if(t.type===BLIP_CAR)return world.vehiclePosition(t.entityHandle);
   if(t.type===BLIP_OBJECT)return world.objectPosition?.(t.entityHandle)??t.position;
  }catch{return undefined;}
  return t.position;
 };
 const blips=radar.traces.filter((t:any)=>t.tracking&&t.sprite===0&&t.display!==0&&!t.shortRange)
  .map((t:any)=>({type:t.type,handle:t.entityHandle,friendly:!!t.friendly,position:at(t),entryExit:t.entryExit})).filter((b:any)=>b.position&&(b.position.x||b.position.y));
 const distance=(p:any)=>Math.hypot(p.x-me.x,p.y-me.y);
 // A shop's menu is up (the barber's chair, a counter): a player picks with the cross button, which the sweep presses.
 // When the shop refuses the highlighted item (too dear: SHOPNO; already worn: BARBNO), he moves down a row first, as
 // a player picks one he can have.
 const menus=r.game.menus;
 if(menus?.inUse?.some((used:boolean)=>used)){
  const said=r.game.messages?.briefs?.[0]?.key,now=performance.now();
  if((said==='SHOPNO'||said==='BARBNO')&&now-(mem.menuMovedAt??0)>3000){
   mem.menuMovedAt=now;mem.menuRefusals=(mem.menuRefusals??0)+1;
   const id=menus.inUse.findIndex((used:boolean,i:number)=>used&&menus.menus[i]?.numRows>1);
   const menu=id>=0?menus.menus[id]:undefined;
   // Every row refused (bought already, or too dear): a player is done here and backs out with triangle.
   if(mem.menuRefusals>(menu?.numRows??1)+1){mem.menuRefusals=0;mem.leftMenuAt=now;return {action:'menu back'};}
   if(menu){do{menu.selectedRow=(menu.selectedRow+1)%menu.numRows;}while(!menu.selectable[menu.selectedRow]&&menu.selectedRow!==0);}
   return {action:'menu next',row:menu?.selectedRow};
  }
  // Backed out of one level of the menu: keep backing out until it is gone.
  if(mem.leftMenuAt&&now-mem.leftMenuAt<20000){mem.leftMenuAt=now;return {action:'menu back'};}
  return {action:'menu accept'};
 }
 mem.leftMenuAt=undefined;
 // The homies in CJ's group, remembered: CPedGroupMembership drops a follower left past the separation range (60
 // units), and a stage that re-adds him only when CJ comes back within ten (SWEET1B after the tag wall) shows no blip.
 const players=m.groups?.get?.(0),members:number[]=players?players.all().filter((h:number)=>h!==1&&players.isFollower(h)):[];
 for(const h of members)(mem.homies??=new Set<number>()).add(h);
 // The red marker a locate highlights (HighlightImportantArea: a shop counter, the barber's chair) is where the script
 // waits for CJ to stand still; on foot within eight units of one he walks into it and stops, as a player does.
 // (Not once he has given up on the place and is walking out.) The idle time indoors starts over each time he is out
 // of doors or in a car, so the wait at one shop does not carry into the next.
 if(vehicle||me.z<500)mem.idleIndoors=0;
 const marker=vehicle||(mem.idleIndoors??0)>20?undefined:m.highlightedAreas?.().filter((h:any)=>distance(h)<8).sort((a:any,b:any)=>distance(a)-distance(b))[0];
 if(!blips.length&&!marker)return null;
 const nearest=(list:any[])=>list.sort((a,b)=>distance(a.position)-distance(b.position))[0];
 const enemies=blips.filter((b:any)=>b.type===BLIP_CHAR&&!b.friendly);
 const cars=blips.filter((b:any)=>b.type===BLIP_CAR&&b.friendly&&b.handle!==vehicle);
 const places=blips.filter((b:any)=>b.type===BLIP_COORD||b.type===BLIP_PICKUP||b.type===BLIP_OBJECT);
 const chases=blips.filter((b:any)=>b.type===BLIP_CAR&&!b.friendly);
 const friends=blips.filter((b:any)=>b.type===BLIP_CHAR&&b.friendly);
 // Moves CJ toward a point, stopping `stopAt` short of it. In a vehicle he drives there with the game's own driving
 // AI (TASK_CAR_DRIVE_TO_COORD, 0x05d1, the task INTRO1 itself gives him) under DRIVINGSTYLE_STOP_FOR_CARS, as a player
 // keeps out of the cars ahead (AVOID_CARS ploughed SWEET1's Greenwood into the traffic at a crossing), re-aimed as the
 // target moves: setting a
 // vehicle down step by step knocked CJ off his bike and wrecked it. On foot he is set down at walking pace.
 const glide=(to:any,stopAt:number)=>{
  const d=distance(to);
  if(vehicle){
   const now=performance.now(),last=mem.drive;
   if(d<=stopAt){if(last){mem.drive=undefined;try{world.clearPedTasks?.(1);}catch{}}return false;}
   // Wedged (against a homie's bike, a post): back up for a second and a half, as a player would, with the game's
   // own TASK_CAR_TEMP_ACTION (TEMPACT_REVERSE, 3), then drive on.
   const moved=mem.lastPos?Math.hypot(me.x-mem.lastPos.x,me.y-mem.lastPos.y):1;mem.lastPos={x:me.x,y:me.y};
   // Held on its brake by its own drive (a red light, the car ahead) it is waiting, not wedged.
   const own=m.vehicles.entity?.(vehicle)?.autopilot?.native,waiting=!!own&&own.gas<=.05&&own.brake>.05;
   mem.stuckFor=moved<.05*Math.max(1,dtSeconds*20)&&!waiting?(mem.stuckFor??0)+dtSeconds:0;
   // Held that long (a car left in the lane ahead: STOP_FOR_CARS waits behind it for good), a player goes round it:
   // DRIVINGSTYLE_AVOID_CARS for a few seconds.
   mem.waitingFor=waiting&&moved<.05*Math.max(1,dtSeconds*20)?(mem.waitingFor??0)+dtSeconds:0;
   if(mem.waitingFor>8){mem.waitingFor=0;mem.aroundUntil=now+6000;mem.drive=undefined;}
   const style=mem.aroundUntil&&now<mem.aroundUntil?2:0;
   if(mem.reversingUntil&&now<mem.reversingUntil)return true;
   if(mem.stuckFor>5){
    mem.stuckFor=0;mem.reversingUntil=now+1800;mem.drive=undefined;
    try{world.givePedScriptedTask(1,{kind:'carTempAction',vehicle,actionId:3,time:1500},0x0822);}catch{}
    return true;
   }
   if(!last||last.vehicle!==vehicle||last.style!==style||Math.hypot(last.x-to.x,last.y-to.y)>8||now-last.at>4000){
    mem.drive={vehicle,x:to.x,y:to.y,at:now,style};
    try{world.givePedScriptedTask(1,{kind:'carDriveToCoord',vehicle,x:to.x,y:to.y,z:to.z,speed:d>40?22:12,driveStyle:0,model:-1,drivingStyle:style},0x05d1);}catch{}
   }
   return true;
  }
  mem.drive=undefined;
  if(d<=stopAt+.05)return false;
  const step=Math.min(d-stopAt,7*dtSeconds),x=me.x+(to.x-me.x)/d*step,y=me.y+(to.y-me.y)/d*step;
  // The ground is looked for from a little over the line between the two points, not over the higher one: from
  // above a roof it finds the roof (CJ walking to the barber's door stood on the shop).
  // Over the point already but above it (on a porch roof over SWEET1B's crack house door), the ground is looked for
  // from the point's own height, so he steps down rather than walking the roof for ever.
  const over=Math.hypot(to.x-x,to.y-y)<1.5&&me.z-to.z>1.5;
  // A step of under half a metre that finds the ground six or more under him found something below the street (a
  // storm drain where the street's own collision had not streamed in): he keeps his height and lets physics decide.
  const found=world.groundZFor3DCoord?.(x,y,over?to.z+1.5:me.z+(to.z-me.z)*step/d+1.5);
  // No ground within six units under the step: inside, that is FindGroundZFor3DCoord's 0 through a wall into the void
  // round the rooms (CJ fell for ever under SWEET1B's crack den), where a player cannot walk, so the bot goes no nearer;
  // outside it is a storm drain or a spot not streamed in yet, and he keeps his height for physics to settle.
  const sheer=found===undefined||found===null||!over&&me.z-1-found>6;
  if(sheer&&me.z>500)return false;
  const z=sheer?me.z-1:found;
  world.setPedCoordinates(1,x,y,z+1);
  return true;
 };
 // Whether nothing fixed (a wall, the room's own mesh) stands between CJ's eye and a ped's chest, in script coordinates.
 const clearShot=(from:any,to:any)=>{
  const R=g.RAPIER,o={x:from.x,y:from.z+.6,z:-from.y},d={x:to.x-from.x,y:to.z-from.z,z:-(to.y-from.y)},l=Math.hypot(d.x,d.y,d.z);
  if(!R||l<.01)return true;
  return !g.sim.world.castRay(new R.Ray(o,{x:d.x/l,y:d.y/l,z:d.z/l}),l,true,R.QueryFilterFlags.ONLY_FIXED);
 };
 // The nearest point round a target, at one to four units, with a floor at its own level and a clear shot at it.
 const vantageOn=(to:any)=>{
  let best:any,bestD=Infinity;
  for(const radius of [1.5,2.5,3.5])for(let k=0;k<16;k++){
   const a=k/16*Math.PI*2,x=to.x+Math.cos(a)*radius,y=to.y+Math.sin(a)*radius,floor=world.groundZFor3DCoord?.(x,y,to.z+.5);
   if(typeof floor!=='number'||Math.abs(floor-(to.z-1))>1)continue;
   const p={x,y,z:floor+1};if(!clearShot(p,to))continue;
   const dist=Math.hypot(x-me.x,y-me.y);if(dist<bestD){bestD=dist;best=p;}
  }
  return best;
 };
 const shoot=(target:any)=>{
  if(!mem.armed){try{world.givePedWeapon?.(1,31,2000);world.setPedCurrentWeapon?.(1,31);mem.armed=true;}catch{}}
  const now=performance.now();if(now-mem.lastShot<120)return;mem.lastShot=now;
  // __game.fireAt takes renderer coordinates: x, height, -y.
  g.fireAt(target.x,target.z+.6,-target.y);
 };
 if(marker&&distance(marker)>.15&&!enemies.length&&glide({x:marker.x,y:marker.y,z:marker.z??me.z-1},.1))return {action:'go to marker'};
 if(!blips.length)return {action:'in marker'};
 if(enemies.length){
  const e=nearest(enemies);
  if(vehicle&&distance(e.position)<25){try{world.warpPedFromCarToCoord(1,me.x+1.5,me.y,me.z);}catch{}return {action:'leave car to fight',target:e.handle};}
  // Six seconds at the same target and it still stands (behind a wall in SWEET1B's crack den): a player walks up to it.
  if(mem.shootTarget!==e.handle){mem.shootTarget=e.handle;mem.shootFor=0;mem.vantage=undefined;}
  // Still standing after that with a wall between them (the den's back room, its door a few units along): a player
  // goes round to where he can see it, the nearest spot near it with a floor under it and nothing fixed in the way.
  if(mem.shootFor>6&&!mem.vantage&&!clearShot(me,e.position))mem.vantage=vantageOn(e.position);
  if(mem.vantage&&glide(mem.vantage,.2))return {action:'go round to enemy',target:e.handle};
  const reach=mem.shootFor>6?3:12;
  if(!mem.vantage&&glide(e.position,reach))return {action:'close on enemy',target:e.handle};
  mem.shootFor+=dtSeconds;
  shoot(e.position);return {action:'shoot',target:e.handle};
 }
 if(cars.length){
  const c=nearest(cars);
  if(glide(c.position,3))return {action:'go to car',target:c.handle};
  const now=performance.now();
  if(now-mem.lastEnter>3000){mem.lastEnter=now;try{if(vehicle)world.warpPedFromCarToCoord(1,me.x+1.5,me.y,me.z);world.warpPedIntoCar(1,c.handle);}catch{}}
  return {action:'get in car',target:c.handle};
 }
 // A tag to spray (SWEET1's walls): with the spray can in hand CJ stands a little out from the wall, in front of
 // the tag, and sprays at it until it is his. Tags carry no blip; the script counts them by area.
 // A homie left behind comes first: SWEET1B's CJ still has SWEET1's can, and went spraying the street's tags while the
 // mission waited for him to fetch Sweet.
 let canSpray=false;try{canSpray=!vehicle&&!!world.pedHasWeapon?.(1,41)&&!(friends.length&&distance(nearest(friends).position)>10);}catch{}
 if(canSpray){
  const tag=(g.tagsNear?.(me.x,me.y,20)??[]).filter((t:any)=>t.alpha<255).sort((a:any,b:any)=>distance(a)-distance(b))[0];
  if(tag){
   const f=tag.forward,stand={x:tag.x+f[0]*1.2,y:tag.y+f[1]*1.2,z:tag.z};
   if(glide(stand,.3))return {action:'go to tag'};
   try{world.setPedCurrentWeapon?.(1,41);}catch{}
   const now=performance.now();if(now-mem.lastShot>=60){mem.lastShot=now;g.fireAt(tag.x,tag.z,-tag.y);}
   return {action:'spray tag',alpha:tag.alpha};
  }
 }
 if(places.length){
  const p=nearest(places);
  // A place inside an interior tied to its door (SET_BLIP_ENTRY_EXIT) is reached through the door: CJ drives to it,
  // gets out and walks into the marker, as the radar shows it from outside.
  const door=p.entryExit!=null&&p.position.z>500&&me.z<500?g.entryExitEntrance?.(p.entryExit):null;
  if(door){
   if(vehicle&&distance(door)<12){try{world.warpPedFromCarToCoord(1,me.x,me.y,me.z);}catch{}return {action:'leave car at door'};}
   if(glide(door,0))return {action:'go to door'};return {action:'at door'};
  }
  // Parked at the place for a few seconds and the objective has not moved on: the script wants CJ out of the car
  // (SWEET1 waits for him to leave Sweet's Greenwood at each wall), as a player would get out at the marker.
  if(vehicle&&distance(p.position)<10){mem.parkedAtPlace=(mem.parkedAtPlace??0)+dtSeconds;
   if(mem.parkedAtPlace>4){mem.parkedAtPlace=0;mem.drive=undefined;try{world.clearPedTasks?.(1);world.warpPedFromCarToCoord(1,me.x+1.5,me.y,me.z);}catch{}return {action:'leave car at place'};}}
  else mem.parkedAtPlace=0;
  // Over the blip on a step above the street it marks (SWEET1B's porch), a player is there.
  const over=Math.hypot(p.position.x-me.x,p.position.y-me.y)<1.5&&Math.abs(p.position.z-me.z)<4;
  // The time spent about the place (within six units of it) counts toward walking into a door beside it.
  if(Math.hypot(p.position.x-me.x,p.position.y-me.y)>6)mem.idleAtPlace=0;
  if(!over&&glide(p.position,1))return {action:'go to place'};
  // Indoors with nothing left to do at the place for twenty seconds (the haircut bought, the counter served), a player
  // walks out through the interior's exit marker: INTRO2 waits for CJ back at the barber's door.
  if(!vehicle&&me.z>500){
   mem.idleIndoors=(mem.idleIndoors??0)+dtSeconds;
   if(mem.idleIndoors>20){
    const exit=g.interiorExitNear?.(me.x,me.y,me.z);
    if(exit){if(glide(exit,0))return {action:'leave interior'};return {action:'at exit'};}
   }
  }else mem.idleIndoors=0;
  // Ten seconds at the place with nothing happening and a homie no longer following: a player goes back for him.
  if(!vehicle&&(mem.idleAtPlace??0)>10){
   for(const h of [...(mem.homies??[])]){
    if(!alive(h)){mem.homies.delete(h);continue;}
    if(members.includes(h))continue;
    let pos:any;try{pos=world.pedPosition(h);}catch{continue;}
    if(distance(pos)>8){glide(pos,5);return {action:'fetch homie left behind',target:h};}
   }
  }
  // Outside with nothing happening at the place for eight seconds and a door's marker a few steps off, a player walks
  // into it: SWEET1B's blip is the street in front of the crack house, its LACRAK door up on the porch.
  if(!vehicle&&me.z<500){
   mem.idleAtPlace=(mem.idleAtPlace??0)+dtSeconds;
   // Only a door the script has switched on (SWITCH_ENTRY_EXIT): SWEET1B keeps LACRAK shut until Sweet has caught up.
   const door=mem.idleAtPlace>8?g.interiorExitNear?.(me.x,me.y,me.z,true):null;
   if(door&&distance(door)<8){if(glide({x:door.x,y:door.y,z:door.z-1},0))return {action:'go to door near place'};return {action:'at door near place'};}
  }
  return {action:marker?'in marker':'at place'};
 }
 if(chases.length){
  const c=nearest(chases);
  if(glide(c.position,15))return {action:'chase car',target:c.handle};
  shoot(c.position);return {action:'shoot car',target:c.handle};
 }
 if(friends.length){
  // Follow from behind: the point ten units back along the way he is going, never ahead of him or in his path
  // (a CJ set down in front of a riding homie wedged the two bikes together).
  const f=nearest(friends),last=mem.friendLast?.[f.handle];mem.friendLast={...(mem.friendLast??{}),[f.handle]:{...f.position}};
  const vx=last?f.position.x-last.x:0,vy=last?f.position.y-last.y:0,v=Math.hypot(vx,vy);
  // A homie who has stopped (where the script sent him, most often) is joined: CJ rides up beside him, as a player
  // would. Still means within three units of where he was five seconds ago (a recovery rocks him back and forth).
  const anchors=mem.friendAnchor??={},a=anchors[f.handle];
  if(!a||Math.hypot(f.position.x-a.x,f.position.y-a.y)>3)anchors[f.handle]={x:f.position.x,y:f.position.y,for:0};else a.for+=dtSeconds;
  if(anchors[f.handle].for>5){glide(f.position,5);return {action:'join stopped friend',target:f.handle};}
  if(v>.2){
   const ahead=(me.x-f.position.x)*vx+(me.y-f.position.y)*vy>0;if(ahead)return {action:'let him pass',target:f.handle};
   glide({x:f.position.x-vx/v*10,y:f.position.y-vy/v*10,z:f.position.z},1.5);
  }else{
   // A homie still on foot is getting to his own ride: CJ in a vehicle waits clear of him rather than ride into the
   // bikes they are climbing onto. One stopped in the saddle is followed to fifteen units.
   let onFoot=false;try{onFoot=!(world.pedVehicle?.(f.handle)>0);}catch{}
   if(vehicle&&onFoot){if(distance(f.position)<25)glide({x:me.x+(me.x-f.position.x),y:me.y+(me.y-f.position.y),z:me.z},0);return {action:'wait for friend to mount',target:f.handle};}
   glide(f.position,vehicle?15:8);
  }
  return {action:'follow',target:f.handle};
 }
 return null;
}
