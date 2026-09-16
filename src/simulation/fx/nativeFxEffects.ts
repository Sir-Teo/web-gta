import {fxIdentity,fxPrtMult,fxTransformVector,processEmission,type FxMatrix,type FxVec,type NativeFxManager,type NativeFxSystem} from './NativeFx';
/** eExplosionType values used by CExplosion::AddExplosion. */
export const EXPLOSION={grenade:0,molotov:1,rocket:2,car:4,quickCar:5,boat:6,aircraft:7,mine:8,object:9,tankFire:10,small:11,rcVehicle:12,weakRocket:3} as const;
/** eSparkType. */
export const SPARK={spark:0,spark2:1} as const;
/** SurfaceInfos BULLET_FX column. */
export type BulletFx='NONE'|'SPARKS'|'SAND'|'WOOD'|'DUST';
/** Fx_c::CreateMatFromVec: `up` follows the direction and `right` is up x Z. */
export function fxMatFromVec(origin:FxVec,direction:FxVec):FxMatrix{
 const m=fxIdentity(),l=Math.hypot(...direction)||1,up:FxVec=[direction[0]/l,direction[1]/l,direction[2]/l];
 let right:FxVec=[up[1],-up[0],0];const rl=Math.hypot(...right);right=rl>1e-6?[right[0]/rl,right[1]/rl,0]:[1,0,0];
 const at:FxVec=[right[1]*up[2]-right[2]*up[1],right[2]*up[0]-right[0]*up[2],right[0]*up[1]-right[1]*up[0]];
 m.set([...right,...up,...at,...origin]);return m;
}
/** The static randomFactor local in CVehicle::AddExhaustParticles, drawn once. */
let exhaustRandomFactor:number|undefined;
const STATIC_SYSTEMS=['prt_blood','prt_boatsplash','prt_bubble','prt_cardebris','prt_collisionsmoke','prt_gunshell','prt_sand','prt_sand2','prt_smoke_huge','prt_smokeII_3_expand','prt_spark','prt_spark_2','prt_splash','prt_wake','prt_watersplash','prt_wheeldirt','prt_glass'] as const;
/** Fx_c: the static particle systems and the game's FX triggers. Call sites follow the reversed game code; the
 * bodies of AddBlood, AddSparks, AddBulletImpact, AddDebris and TriggerGunshot are reconstructions (their
 * addresses are not reversed) that feed the native blueprints. */
export class NativeFxEffects {
 readonly statics:Record<typeof STATIC_SYSTEMS[number],NativeFxSystem|undefined>;
 constructor(readonly fx:NativeFxManager,private camera:()=>FxVec){
  // Fx_c::InitStaticSystems: created at the origin, never played; particles arrive through AddParticle.
  this.statics=Object.fromEntries(STATIC_SYSTEMS.map(name=>[name,fx.create(name,[0,0,0],undefined,true)])) as NativeFxEffects['statics'];
 }
 private random(min:number,max:number){return min+(max-min)*this.fx.world.random();}
 private withinCamera(position:FxVec,rangeSquared:number){const c=this.camera();return (c[0]-position[0])**2+(c[1]-position[1])**2+(c[2]-position[2])**2<=rangeSquared;}
 /** CExplosion::AddExplosion FX (CreateAndPlayFxWithSound). Returns the system name played. */
 explosion(type:number,position:FxVec){
  const name=type===EXPLOSION.molotov?'explosion_molotov':type===EXPLOSION.car||type===EXPLOSION.quickCar?'explosion_medium':type===EXPLOSION.boat||type===EXPLOSION.aircraft||type===EXPLOSION.tankFire?'explosion_large':type===EXPLOSION.rcVehicle?'explosion_tiny':type===EXPLOSION.mine||type===EXPLOSION.object?undefined:'explosion_small';
  if(!name)return undefined;
  this.fx.create(name,position)?.playAndKill();return name;
 }
 /** CExplosion::Update: car/boat/aircraft explosions throw up to four "explosion_fuel_car" bursts along their fuel
  * directions during the first 200 ms. Returns the fuel state to step. */
 fuelBursts(position:FxVec){
  return Array.from({length:4},(_,i)=>i&&this.fx.world.random()>=.5?undefined:{direction:[this.random(-1,1),this.random(-1,1),this.random(.2,1)] as FxVec,offset:this.random(.5,2),speed:this.random(20,30)}).filter(f=>f).map(f=>({...f!,origin:position}));
 }
 stepFuelBurst(burst:{origin:FxVec;direction:FxVec;offset:number;speed:number},timerMs:number){
  const t=timerMs/1000,d=burst.offset+t*burst.speed;
  this.fx.create('explosion_fuel_car',[burst.origin[0]+burst.direction[0]*d,burst.origin[1]+burst.direction[1]*d,burst.origin[2]+burst.direction[2]*d])?.playAndKill();
 }
 /** CFire::CreateFxSysForStrength. */
 fire(position:FxVec,strength=1,parent?:FxMatrix){
  return this.fx.create(strength>1?strength>2?'fire_large':'fire_med':'fire',position,parent,true)?.play();
 }
 /** CWeapon::DoWeaponEffect: flamethrower, extinguisher and spray can follow the muzzle at constant time 1. */
 weaponEffect(current:NativeFxSystem|undefined,weapon:number,origin:FxVec,direction:FxVec){
  const name=weapon===37?'flamethrower':weapon===42?'extinguisher':weapon===41?'spraycan':undefined;
  if(!name){current?.kill();return undefined;}
  const matrix=fxMatFromVec(origin,direction);
  if(current&&!current.destroyed){current.setMatrix(matrix);current.setConstTime(true,1);return current;}
  const system=this.fx.create(name,[0,0,0],matrix);if(!system)return undefined;
  system.copyParentMatrix();system.play();system.setMustCreatePrts(true);system.setConstTime(true,1);return system;
 }
 /** CWeapon::AddGunshell: within 10 m of the camera; shotgun shells are red. */
 gunshell(position:FxVec,direction:[number,number],size:number,shotgun=false){
  if(!this.withinCamera(position,100))return;
  this.statics.prt_gunshell?.addParticle(position,[direction[0],direction[1],this.random(.4,1.6)],0,shotgun?fxPrtMult(.6,.1,.1,1,size,1,1):fxPrtMult(.5,.5,.5,1,size,1,1));
 }
 /** Fx_c::TriggerGunshot (reconstructed): muzzle flash and smoke along the shot. */
 gunshot(origin:FxVec,direction:FxVec,flash:boolean){
  const matrix=fxMatFromVec(origin,direction);
  if(flash)this.fx.create('gunflash',matrix)?.playAndKill();
  this.fx.create('gunsmoke',matrix)?.playAndKill();
 }
 /** A velocity drawn from a static blueprint's own emission cone and speed, aimed along `direction`. */
 private coneVelocity(system:NativeFxSystem|undefined,direction:FxVec,speedScale=1):FxVec{
  const prim=system?.emitters[0]?.prim.bp;
  const e=prim?processEmission(prim,0,0,0,false):undefined,angle=e?this.random(e.angleMin,e.angleMax)*Math.PI/180:0,around=this.random(0,Math.PI*2);
  const m=fxMatFromVec([0,0,0],direction),local=[Math.cos(around)*Math.sin(angle),Math.cos(angle),Math.sin(around)*Math.sin(angle)] as FxVec,v=fxTransformVector(m,...local);
  const speed=((e?.speed??1)+(e?.speedBias??0)*this.random(-1,1))*speedScale;return [v[0]*speed,v[1]*speed,v[2]*speed];
 }
 /** Fx_c::AddBlood (reconstructed): dark red streaks from prt_blood along the hit normal, dimmed by surface lighting. */
 blood(position:FxVec,direction:FxVec,amount:number,lightMult:number){
  const blood=this.statics.prt_blood;if(!blood)return;
  for(let i=0;i<amount;i++)blood.addParticle(position,this.coneVelocity(blood,direction,this.random(.5,1)),0,fxPrtMult(this.random(.35,.55),0,0,1,1,1,this.random(.7,1)),-1,lightMult,.6);
 }
 /** Fx_c::AddSparks (reconstructed). */
 sparks(origin:FxVec,direction:FxVec,force:number,amount:number,across:FxVec,type:number,spread:number,life:number){
  const system=type===SPARK.spark2?this.statics.prt_spark_2:this.statics.prt_spark;if(!system)return;
  for(let i=0;i<amount;i++){
   const a=this.random(-1,1),v:FxVec=[direction[0]*force+across[0]*a+this.random(-spread,spread),direction[1]*force+across[1]*a+this.random(-spread,spread),direction[2]*force+across[2]*a+this.random(-spread,spread)];
   system.addParticle(origin,v,0,fxPrtMult(1,1,1,1,1,1,life));
  }
 }
 /** Fx_c::AddBulletImpact (reconstructed): a smoke puff plus the surface's BULLET_FX particles. Glass-flagged surfaces (SURFINFO.DAT GLASS column) also throw prt_glass shards; the shatter audio entity is not reversed. */
 bulletImpact(position:FxVec,normal:FxVec,bulletFx:BulletFx,amount:number,lightMult:number,glass=false){
  const smoke=this.statics.prt_smokeII_3_expand;
  smoke?.addParticle(position,[normal[0]*.3,normal[1]*.3,normal[2]*.3+.1],0,fxPrtMult(.5,.5,.5,.35,.08,1,.35),-1,lightMult,.6);
  if(glass)for(let i=0;i<Math.max(4,Math.min(12,amount));i++)this.statics.prt_glass?.addParticle(position,this.coneVelocity(undefined,normal,this.random(1,3)),0,fxPrtMult(.75,.85,1,.9,.02,1,.3),-1,lightMult,.6);
  switch(bulletFx){
   case 'SPARKS':this.sparks(position,normal,this.random(1,2),Math.max(1,amount>>1),[0,0,0],SPARK.spark,.6,.4);break;
   case 'SAND':for(let i=0;i<Math.max(1,amount>>2);i++)this.statics.prt_sand?.addParticle(position,this.coneVelocity(undefined,normal,this.random(.5,1.5)),0,fxPrtMult(.73,.6,.46,.4,.04,1,.3),-1,lightMult,.6);break;
   case 'WOOD':for(let i=0;i<Math.max(1,amount>>1);i++)this.statics.prt_cardebris?.addParticle(position,this.coneVelocity(undefined,normal,this.random(1,3)),0,fxPrtMult(.45,.3,.15,1,.02,1,.25),-1,lightMult,.6);break;
   case 'DUST':smoke?.addParticle(position,[normal[0]*.5,normal[1]*.5,normal[2]*.5],0,fxPrtMult(.6,.55,.5,.5,.12,1,.5),-1,lightMult,.6);break;
  }
 }
 /** Fx_c::AddDebris (reconstructed): coloured car fragments from prt_cardebris. */
 debris(position:FxVec,color:[number,number,number],scale:number,amount:number){
  for(let i=0;i<amount;i++)this.statics.prt_cardebris?.addParticle(position,[this.random(-2,2),this.random(-2,2),this.random(1,4)],0,fxPrtMult(color[0]/255,color[1]/255,color[2]/255,1,scale,1,1));
 }
 /** Fx_c::TriggerWaterSplash / TriggerBulletSplash / TriggerFootSplash: within 25 m of the camera. */
 waterSplash(position:FxVec,size:'big'|'bullet'|'foot'){
  if(!this.withinCamera(position,625))return;
  this.fx.create(size==='big'?'water_splash_big':size==='bullet'?'water_splash':'water_splsh_sml',position)?.playAndKill();
 }
 /** CVehicle::AddDamagedVehicleParticles: overheat smoke between 650 and 250 health, at the engine dummy. */
 overheat(current:NativeFxSystem|undefined,health:number,electric:boolean,engine:FxVec,modelling:FxMatrix,velocity:FxVec,submerged:boolean){
  if(health>=650||health<250||submerged){current?.kill();return undefined;}
  let system=current&&!current.destroyed?current:undefined;
  if(!system){system=this.fx.create(electric?'overheat_car_electric':'overheat_car',engine,modelling);system?.play();}
  if(system){system.parent=modelling;system.setConstTime(true,1-(health-250)/400);system.setVelAdd(velocity[0],velocity[1],velocity[2]);}
  return system;
 }
 /** CAutomobile::ProcessCarOnFireAndExplode: "fire_car" at the engine dummy while health is below 250. */
 carFire(current:NativeFxSystem|undefined,burning:boolean,engine:FxVec,modelling:FxMatrix,velocity:FxVec){
  if(!burning){current?.kill();return undefined;}
  let system=current&&!current.destroyed?current:undefined;
  if(!system){system=this.fx.create('fire_car',engine,modelling);system?.play();}
  if(system){system.parent=modelling;system.setVelAdd(velocity[0],velocity[1],velocity[2]);}
  return system;
 }
 /** CAutomobile::dmgDrawCarCollidingParticles: sparks, huge smoke and paint debris at a car impact. */
 carCollision(position:FxVec,carPosition:FxVec,velocity:FxVec,force:number,paint:[number,number,number],brightness:number,timeStep:number){
  const speed=Math.hypot(...velocity),dir:FxVec=speed>0?[velocity[0]/speed,velocity[1]/speed,velocity[2]/speed]:[0,0,0];
  this.sparks(position,dir,speed*-10,((Math.trunc(force)<<24>>24)/10+4|0)%64,velocity,SPARK.spark2,.3,1);
  const at:FxVec=[carPosition[0]+(position[0]-carPosition[0])*.7,carPosition[1]+(position[1]-carPosition[1])*.7,carPosition[2]+(position[2]-carPosition[2])*.7];
  const smokes=Math.max(1,Math.trunc(speed*timeStep*4));for(let i=0;i<smokes;i++)this.statics.prt_smoke_huge?.addParticle(at,[0,0,0],0,fxPrtMult(.4,.4,.4,.6,.4,1,1));
  if(speed*speed<=.25**2)this.debris(at,paint.map(c=>c*brightness) as [number,number,number],.06,Math.trunc(force/100)+1);
 }
 /** CVehicle::AddExhaustParticles: within 16 m (every other frame beyond 8 m), puffs from the exhaust dummy
  * (mirrored for double exhausts) into prt_smokeII_3_expand, or bubbles when the pipe is under water. */
 exhaust(input:{camera:FxVec;position:FxVec;matrix:FxMatrix;exhaust:FxVec;doubleExhaust:boolean;moveSpeed:FxVec;gasPedal:number;gear:number;frame:number;modelId:number;brightness:number;waterLevel?:(x:number,y:number)=>number|undefined}){
  const {camera,position,matrix,moveSpeed}=input,dist=(position[0]-camera[0])**2+(position[1]-camera[1])**2+(position[2]-camera[2])**2;
  if(dist>256||dist>64&&!((input.frame+input.modelId)&1))return;
  if(input.exhaust[0]===0&&input.exhaust[1]===0&&input.exhaust[2]===0)return;
  const forward:FxVec=[matrix[3],matrix[4],matrix[5]],ahead=forward[0]*moveSpeed[0]+forward[1]*moveSpeed[1]+forward[2]*moveSpeed[2];
  exhaustRandomFactor??=this.random(-1.8,-.9);
  const velocity:FxVec=ahead>=.05?[moveSpeed[0]*30,moveSpeed[1]*30,moveSpeed[2]*30]:[forward[0]*exhaustRandomFactor,forward[1]*exhaustRandomFactor,forward[2]*exhaustRandomFactor];
  const at=(x:number,y:number,z:number):FxVec=>[x*matrix[0]+y*matrix[3]+z*matrix[6]+matrix[9],x*matrix[1]+y*matrix[4]+z*matrix[7]+matrix[10],x*matrix[2]+y*matrix[5]+z*matrix[8]+matrix[11]];
  const first=at(...input.exhaust),second=at(-input.exhaust[0],input.exhaust[1],input.exhaust[2]);
  const submerged=(p:FxVec)=>{const level=input.waterLevel?.(p[0],p[1]);return level!==undefined&&level>=p[2];};
  const firstWet=submerged(first),secondWet=input.doubleExhaust&&submerged(second);
  if(this.random(1,3)*(input.gasPedal+1.1)<=2.5)return;
  const speed=Math.hypot(...moveSpeed)*.5,alpha=Math.max(0,.25-speed),life=Math.max(.2-speed,0);
  const mult=fxPrtMult(.9,.9,1,alpha,.2,1,life);
  const add=(p:FxVec,wet:boolean)=>{if(wet){mult.a=alpha*.5;mult.size=.6;}(wet?this.statics.prt_bubble:this.statics.prt_smokeII_3_expand)?.addParticle(p,velocity,0,mult,-1,input.brightness);};
  for(let i=0;i<2;i++){
   add(first,firstWet);if(input.doubleExhaust)add(second,secondWet);
   if(input.gasPedal>.5&&input.gear<3){if(this.fx.world.random()<.5)add(first,firstWet);else if(input.doubleExhaust)add(second,secondWet);}
  }
 }
 /** CAutomobile::DoHeliDustEffect: rotor wash within 50 m of the camera and below 30 m, dust, sand or water spray
  * by the ground under the aircraft, with constant time stepping 0.04 toward the squared height progress. */
 heliDust(current:{system?:NativeFxSystem;timeConst:number},input:{camera:FxVec;position:FxVec;rotorOn:boolean;groundZ?:number;sand:boolean;waterLevel?:number;timeConstMult?:number;maxZMult?:number}){
  const kill=()=>{current.system?.kill();current.system=undefined;current.timeConst=0;};
  const p=input.position;
  if((input.camera[0]-p[0])**2+(input.camera[1]-p[1])**2+(input.camera[2]-p[2])**2>=50*50||!input.rotorOn||input.groundZ===undefined){kill();return;}
  const underWater=input.waterLevel!==undefined&&input.waterLevel>input.groundZ,groundZ=underWater?input.waterLevel!:input.groundZ,height=p[2]-groundZ,maxZ=30*(input.maxZMult??1);
  if(height>=maxZ){kill();return;}
  if(!current.system){current.system=this.fx.create('heli_dust',[0,0,0],undefined,true);if(!current.system)return;current.system.setLocalParticles(true);current.system.play();}
  const progress=(maxZ-height)/maxZ*(input.timeConstMult??1),target=progress*progress;
  current.timeConst=current.timeConst<target?Math.min(current.timeConst+.04,target):Math.max(current.timeConst-.04,target);
  current.system.setConstTime(true,current.timeConst);current.system.setOffsetPos(p[0],p[1],groundZ);
  current.system.enablePrim(0,!underWater&&!input.sand);current.system.enablePrim(1,!underWater&&input.sand);current.system.enablePrim(2,underWater);
 }
 /** CWeather::AddSandStormParticles. */
 sandstorm(camera:FxVec,forward:FxVec,windDir:FxVec){
  const p:FxVec=[camera[0]+forward[0]*10+this.random(0,40)-20,camera[1]+forward[1]*10+this.random(0,40)-20,camera[2]+this.random(0,7)-2];
  this.statics.prt_sand2?.addParticle(p,[windDir[0]*25,windDir[1]*25,windDir[2]*25],0,fxPrtMult(.67,.65,.55,.25,1,0,.2));
 }
 dispose(){this.fx.clear();}
}
