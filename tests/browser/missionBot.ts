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
 if(!blips.length)return null;
 const distance=(p:any)=>Math.hypot(p.x-me.x,p.y-me.y);
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
  const z=world.groundZFor3DCoord?.(x,y,me.z+(to.z-me.z)*step/d+1.5)??to.z;
  world.setPedCoordinates(1,x,y,z+1);
  return true;
 };
 const shoot=(target:any)=>{
  if(!mem.armed){try{world.givePedWeapon?.(1,31,2000);world.setPedCurrentWeapon?.(1,31);mem.armed=true;}catch{}}
  const now=performance.now();if(now-mem.lastShot<120)return;mem.lastShot=now;
  // __game.fireAt takes renderer coordinates: x, height, -y.
  g.fireAt(target.x,target.z+.6,-target.y);
 };
 if(enemies.length){
  const e=nearest(enemies);
  if(vehicle&&distance(e.position)<25){try{world.warpPedFromCarToCoord(1,me.x+1.5,me.y,me.z);}catch{}return {action:'leave car to fight',target:e.handle};}
  if(glide(e.position,12))return {action:'close on enemy',target:e.handle};
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
 let canSpray=false;try{canSpray=!vehicle&&!!world.pedHasWeapon?.(1,41);}catch{}
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
  if(glide(p.position,1))return {action:'go to place'};return {action:'at place'};
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
