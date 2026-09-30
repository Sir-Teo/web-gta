/* An objective-following player for the mission sweep (SWEEP_BOT=1). SA missions tell the player what to do through
 * the radar: a friendly car blip is a car to get into, a friendly char blip a homie to follow, a hostile char blip
 * someone to kill, a hostile car blip a car to chase down, a coordinate blip a place to go. This reads the script's
 * own blip table each tick and does what the blips ask, as a player would: it walks or drives CJ toward the target
 * at a player's pace (never teleporting past the people he follows), gets into the blipped car, and shoots at what
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
  .map((t:any)=>({type:t.type,handle:t.entityHandle,friendly:!!t.friendly,position:at(t)})).filter((b:any)=>b.position&&(b.position.x||b.position.y));
 if(!blips.length)return null;
 const distance=(p:any)=>Math.hypot(p.x-me.x,p.y-me.y);
 const nearest=(list:any[])=>list.sort((a,b)=>distance(a.position)-distance(b.position))[0];
 const enemies=blips.filter((b:any)=>b.type===BLIP_CHAR&&!b.friendly);
 const cars=blips.filter((b:any)=>b.type===BLIP_CAR&&b.friendly&&b.handle!==vehicle);
 const places=blips.filter((b:any)=>b.type===BLIP_COORD||b.type===BLIP_PICKUP||b.type===BLIP_OBJECT);
 const chases=blips.filter((b:any)=>b.type===BLIP_CAR&&!b.friendly);
 const friends=blips.filter((b:any)=>b.type===BLIP_CHAR&&b.friendly);
 // Moves CJ, or the vehicle he is in, toward a point at a player's pace, stopping `stopAt` short of it.
 const glide=(to:any,stopAt:number)=>{
  const d=distance(to);if(d<=stopAt)return false;
  const speed=vehicle?20:7,step=Math.min(d-stopAt,speed*dtSeconds),x=me.x+(to.x-me.x)/d*step,y=me.y+(to.y-me.y)/d*step;
  const z=world.groundZFor3DCoord?.(x,y,Math.max(me.z,to.z)+4)??to.z;
  if(vehicle)world.setVehicleCoordinates(vehicle,x,y,z+.5);else world.setPedCoordinates(1,x,y,z+1);
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
 if(places.length){const p=nearest(places);if(glide(p.position,1))return {action:'go to place'};return {action:'at place'};}
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
  if(v>.2){
   const ahead=(me.x-f.position.x)*vx+(me.y-f.position.y)*vy>0;if(ahead)return {action:'let him pass',target:f.handle};
   glide({x:f.position.x-vx/v*10,y:f.position.y-vy/v*10,z:f.position.z},1.5);
  }else glide(f.position,8);
  return {action:'follow',target:f.handle};
 }
 return null;
}
