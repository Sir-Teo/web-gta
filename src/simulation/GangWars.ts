import {gxtHudText,gxtText} from '../assets/gxt';
import {worldZoneAt,type WorldZone,type WorldZones} from '../assets/worldZones';
import type {ZonePopulation} from '../assets/scmZonePopulation';
/* CGangWars (gta-reversed ead3051): the turf wars. Provocation from the player's on-foot kills of Ballas and Vagos
 * starts an offensive war in the zone he stands in (three waves, 10 s apart, the zone's gang strength shifting to
 * the Families after each), and a defensive war timer (648 to 1,620 s, LA time; 0.6× elsewhere) picks a Families
 * zone near enemy turf for an attack the player must reach (200 ms a unit plus 240 s) and beat (30 s more), or
 * lose 30 strength and 30 respect. `CreateAttackWave` is a retail stub: the host authors the offensive waves.
 * Native coordinates throughout (x, y, z up). */
export const GANG={ballas:0,grove:1,vagos:2,rifa:3,danang:4,mafia:5,triad:6,aztecas:7} as const;
export const WAR_STATE={notInWar:0,preFirstWave:1,firstWave:2,preSecondWave:3,secondWave:4,preThirdWave:5,thirdWave:6} as const;
export const ATTACK_STATE={none:0,notified:1,playerCame:2} as const;
/** gaGangColors: Ballas purple, Families green, Vagos yellow, Rifa blue, Da Nang, Mafia, Triad, Aztecas. */
export const GANG_COLOURS:readonly [number,number,number][]=[[200,0,200],[70,200,0],[255,200,0],[0,0,200],[255,220,190],[200,200,200],[240,140,240],[0,200,255],[255,255,255],[255,255,255]];
/** eRadarSprite for the defensive war's blip: RADAR_SPRITE_GANGP 59, GANGY 60, GANGB 58, ENEMYATTACK 19. */
export function attackBlipSprite(gang:number){return gang===GANG.ballas?59:gang===GANG.vagos||gang===GANG.danang?60:gang===GANG.rifa?58:19;}
/** The messages CGangWars queues, by TheText label: the port's own wording, used only until AMERICAN.GXT has loaded. */
export const GANG_WAR_TEXT={GW_PROV:'Gang war started! Defeat three waves to take the territory.',GW_CLR1:'First wave cleared.',GW_CLR2:'Second wave cleared.',GW_YRS:'The territory is yours!',GW_FLEE:'You fled the gang war.',GW_WARN:'Get back to the war or lose it!',GW_ATK:'Your territory is under attack! Get there and defend it.',GW_NOSH:'You failed to defend your territory.',GW_WON:'You defended your territory.',GW_SLOW:'You took too long to beat the attack.'} as const;
/** TheText.Get of a gang war label, as the HUD draws it. */
const gangWarText=(key:keyof typeof GANG_WAR_TEXT)=>gxtHudText(gxtText(key,GANG_WAR_TEXT[key]));
export interface GangWarHost {
 nowMs():number;
 /** The player's native position. */
 player():{x:number;y:number;z:number};
 playerOnMission():boolean;
 /** CGangWars::bCanTriggerGangWarWhenOnAMission. */
 canTriggerGangWarWhenOnAMission?():boolean;
 playerInAircraft():boolean;
 /** CWeather::WeatherRegion == LA: the defensive timer runs at full speed there. */
 weatherLA():boolean;
 zones():WorldZones|undefined;
 /** CreateAttackWave(ferocity, wave): true once the wave stands. Authored by the host (retail stub). */
 createAttackWave(ferocity:number,wave:number):boolean;
 /** CreateDefendingGroup at the point of attack: false until the defenders stand (models, nodes, the player 40 units off). */
 createDefendingGroup(gang:number,point:{x:number;y:number;z:number},difficulty:number):boolean;
 attackWaveOvercome():boolean;
 /** Returns the number of peds released. */
 releasePedsInAttackWave(endOfWar:boolean,restoreWander:boolean):number;
 releaseCarsInAttackWave():void;
 tellGangMembersTo(warEnding:boolean):void;
 clearTheStreets():void;
 message(text:string):void;
 help(text:string):void;
 respect(delta:number):void;
 /** CGangWars::CanPlayerStartAGangWarHere for a zone info: the training zone only, or the script's specific zones,
  * or anywhere when it has named none. */
 canStartHere?(zoneInfoIndex:number):boolean;
 /** STAT_TERRITORIES_TAKEN_OVER / _LOST (+1), and STAT_TERRITORIES_HELD with its record. */
 territoryStat?(kind:'taken'|'lost'|'held',value:number):void;
 /** The defensive war's coord blip. */
 blip(state:{position:{x:number;y:number;z:number};gang:number;visible:boolean}|undefined):void;
 /** CTheZones::FillZonesWithGangColours / RadarMode 2: the contested zone shown red on the radar, or the gang colours. */
 zoneColours(contested:WorldZone|undefined):void;
 streamGangs():void;
 random():number;
}
const GROVE_HOME={x:2500,y:-1666};
export class GangWars {
 state:number=WAR_STATE.notInWar;state2:number=ATTACK_STATE.none;
 /** bGangWarsActive: the script switches it on after the Doberman mission; the browser has no campaign, so on. */
 active=true;
 provocation=0;timeTillNextAttack=0;fightTimer=0;warFerocity=0;difficulty=0;gang1=GANG.ballas as number;gang2=GANG.ballas as number;
 timeStarted=0;lastTimeInArea=0;previousNow=0;territoryUnderControlPercentage=0;playerCloseby=false;
 zoneToFightOver?:WorldZone;zoneInfoToFightOver?:ZonePopulation;pointOfAttack={x:0,y:0,z:0};coorsAtStartOfWar={x:0,y:0,z:0};
 private radarBlip=false;
 constructor(private host:GangWarHost){this.timeTillNextAttack=this.calculateTimeTillNextAttack();}
 /** CGangWars::AddKillToProvocation: a Ballas or Vagos kill by the player on foot. */
 addKillToProvocation(gang:number|undefined){
  if(!this.host.canTriggerGangWarWhenOnAMission?.()&&this.host.playerOnMission())return;
  if(gang!==GANG.ballas&&gang!==GANG.vagos)return;
  this.provocation+=1;
 }
 calculateTimeTillNextAttack(){return 648000+this.host.random()*(1620000-648000);}
 zoneInfo(zone:WorldZone){return this.host.zones()?.population?.[zone.zoneInfoIndex];}
 doesPlayerControlThisZone(info:ZonePopulation|undefined){
  if(!info)return false;
  const enemy=info.gangStrength[GANG.ballas]+info.gangStrength[GANG.vagos],grove=info.gangStrength[GANG.grove];
  return grove!==0&&grove>=enemy;
 }
 /** CGangWars::UpdateTerritoryUnderControlPercentage: the Families' share of the gang zones. */
 updateTerritoryUnderControlPercentage(){
  const zones=this.host.zones();if(!zones)return;
  let grove=0,ballas=0,vagos=0;
  for(const zone of zones.navigation){
   const info=zones.population?.[zone.zoneInfoIndex];if(!info)continue;
   const b=info.gangStrength[GANG.ballas],g=info.gangStrength[GANG.grove],v=info.gangStrength[GANG.vagos];
   if(g>b+v)grove++;else if(b>v)ballas++;else if(v>b)vagos++;
  }
  this.host.territoryStat?.('held',grove);
  const all=grove+ballas+vagos;
  this.territoryUnderControlPercentage=all?grove/all:0;
 }
 /** CGangWars::MakePlayerGainInfluenceInZone: every other gang loses `removeMult` of its strength (under 4 goes to 0)
  * to the Families; true when no enemy strength is left. */
 makePlayerGainInfluenceInZone(removeMult:number){
  const info=this.zoneInfoToFightOver;if(!info)return true;
  const controlledBefore=this.doesPlayerControlThisZone(info);
  // GangStrength is a uint8 array and totalEnemyDensity a uint8: both wrap.
  let enemy=0;
  for(const gang of [0,2,3,4,5,6,7,8,9]){
   const before=info.gangStrength[gang];let density=Math.trunc((1-removeMult)*before)&255;if(density<4)density=0;
   info.gangStrength[gang]=density;info.gangStrength[GANG.grove]=info.gangStrength[GANG.grove]+before-density&255;enemy=enemy+density&255;
  }
  if(!controlledBefore&&this.doesPlayerControlThisZone(info))this.host.territoryStat?.('taken',1);
  return enemy===0;
 }
 makeEnemyGainInfluenceInZone(gang:number,density:number){
  const info=this.zoneInfoToFightOver;if(!info)return;
  if(!(info.gangStrength[GANG.ballas]+info.gangStrength[GANG.grove]+info.gangStrength[GANG.vagos]))return;
  info.gangStrength[gang]=info.gangStrength[gang]+density&255;
  if(!this.doesPlayerControlThisZone(info))this.host.territoryStat?.('lost',1);
 }
 strengthenPlayerInfluenceInZone(density:number){
  const info=this.zoneInfoToFightOver;if(!info)return;
  const controlledBefore=this.doesPlayerControlThisZone(info);
  if(info.gangStrength[GANG.grove]<55)info.gangStrength[GANG.grove]=Math.min(info.gangStrength[GANG.grove]+density,55);
  if(!controlledBefore&&this.doesPlayerControlThisZone(info))this.host.territoryStat?.('taken',1);
 }
 /** CTheZones::GetZoneInfo: FindSmallestZoneForPosition(point, false), the smallest navigation zone of any type. */
 private zoneAt(zones:WorldZones,p:{x:number;y:number;z:number}){
  try{return worldZoneAt(zones,[p.x,p.y,p.z],false);}catch{return undefined;}
 }
 private inside(zone:WorldZone,x:number,y:number,margin=0){return zone.min[0]-margin<=x&&zone.max[0]+margin>=x&&zone.min[1]-margin<=y&&zone.max[1]+margin>=y;}
 /** CTheZones::Calc2DDistanceBetween2Zones: the gap between two zone rectangles. */
 static zoneDistance(a:WorldZone,b:WorldZone){
  const dx=Math.max(0,a.min[0]-b.max[0],b.min[0]-a.max[0]),dy=Math.max(0,a.min[1]-b.max[1],b.min[1]-a.max[1]);
  return Math.hypot(dx,dy);
 }
 /** CGangWars::PickZoneToAttack: an enemy zone (Ballas plus Vagos 20 or more), then a Families zone (over 15) within
  * 10 units of it, not the Grove Street home zone, more than 60 units from the player. */
 pickZoneToAttack(){
  const zones=this.host.zones();if(!zones)return false;
  const order=[...zones.navigation];
  for(let i=order.length-1;i>0;i--){const j=Math.floor(this.host.random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
  let enemyZone:WorldZone|undefined;
  for(const zone of order){const info=zones.population?.[zone.zoneInfoIndex];if(info&&info.gangStrength[GANG.ballas]+info.gangStrength[GANG.vagos]>=20){enemyZone=zone;break;}}
  if(!enemyZone)return false;
  const enemyInfo=zones.population![enemyZone.zoneInfoIndex],player=this.host.player();
  for(const zone of order){
   const info=zones.population?.[zone.zoneInfoIndex];if(!info)continue;
   if(this.inside(zone,GROVE_HOME.x,GROVE_HOME.y))continue;
   if(info.gangStrength[GANG.grove]<=15)continue;
   if(GangWars.zoneDistance(enemyZone,zone)<10){
    this.zoneToFightOver=zone;this.zoneInfoToFightOver=info;
    this.pointOfAttack={x:(zone.min[0]+zone.max[0])/2,y:(zone.min[1]+zone.max[1])/2,z:10};
    this.gang1=enemyInfo.gangStrength[GANG.ballas]>enemyInfo.gangStrength[GANG.vagos]?GANG.ballas:GANG.vagos;
    if(Math.hypot(player.x-this.pointOfAttack.x,player.y-this.pointOfAttack.y)>60)return true;
   }
  }
  return false;
 }
 /** CGangWars::StartDefensiveGangWar. */
 startDefensiveGangWar(){
  if(this.pickZoneToAttack()){
   this.difficulty=this.territoryUnderControlPercentage;
   this.host.help(gangWarText('GW_ATK'));
   this.state2=ATTACK_STATE.notified;
   const player=this.host.player();
   this.fightTimer=Math.hypot(this.pointOfAttack.x-player.x,this.pointOfAttack.y-player.y)*200+240000;
   this.radarBlip=true;this.host.blip({position:{...this.pointOfAttack},gang:this.gang1,visible:true});
   this.playerCloseby=false;
   this.zoneColours(this.zoneToFightOver);
  }else this.timeTillNextAttack=this.calculateTimeTillNextAttack();
 }
 /** CGangWars::StartOffensiveGangWar in the zone the player stands in. */
 startOffensiveGangWar(){
  const zones=this.host.zones();const player=this.host.player();this.coorsAtStartOfWar={...player};
  const zone=zones?this.zoneAt(zones,player):undefined;const info=zone?this.zoneInfo(zone):undefined;
  this.zoneToFightOver=zone;this.zoneInfoToFightOver=info;this.difficulty=this.territoryUnderControlPercentage;
  this.provocation=0;
  if(!zone||!info)return;
  if(this.host.canStartHere&&!this.host.canStartHere(zone.zoneInfoIndex))return;
  let gang1=0,gang2=0;info.gangStrength.forEach((v,i)=>{if(v>info.gangStrength[gang1])gang1=i;});
  info.gangStrength.forEach((v,i)=>{if(i!==gang1&&v>(gang2===gang1?-1:info.gangStrength[gang2]))gang2=i;});
  if(gang2===gang1)gang2=info.gangStrength.findIndex((_,i)=>i!==gang1);
  this.gang1=gang1;this.gang2=gang2;
  const sum=info.gangStrength.reduce((a,b)=>a+b,0);
  if(sum&&(gang1===GANG.ballas||gang1===GANG.vagos)){
   if(this.state2!==ATTACK_STATE.none)return;
   this.host.message(gangWarText('GW_PROV'));
   this.timeStarted=this.host.nowMs();this.state=WAR_STATE.preFirstWave;
   this.host.clearTheStreets();
   // The reference's override of this from the territory share sits behind STAT_CITY_UNLOCKED < 0, which never holds.
   this.warFerocity=Math.min(Math.trunc(sum/15),2);
   if(this.host.playerOnMission())this.warFerocity=0;
   if(info.gangStrength[gang1]>info.gangStrength[gang2]/3)this.gang2=gang1;
   this.host.tellGangMembersTo(false);
   this.zoneColours(zone);
  }
 }
 /** CGangWars::EndGangWar. */
 endGangWar(end:boolean){
  this.state=WAR_STATE.notInWar;
  if(this.state2===ATTACK_STATE.notified){
   this.state2=ATTACK_STATE.none;this.timeTillNextAttack=this.calculateTimeTillNextAttack();
   const released=this.host.releasePedsInAttackWave(true,false);this.makeEnemyGainInfluenceInZone(this.gang1,3*released);
  }
  this.provocation=0;this.zoneColours(undefined);
  this.host.releasePedsInAttackWave(true,end);this.host.releaseCarsInAttackWave();
 }
 /** CGangWars::DoStuffWhenPlayerVictorious. */
 doStuffWhenPlayerVictorious(){
  this.host.releasePedsInAttackWave(true,false);this.host.releaseCarsInAttackWave();
  this.state=WAR_STATE.notInWar;this.host.message(gangWarText('GW_YRS'));this.provocation=0;
  this.host.tellGangMembersTo(true);this.host.respect(45);this.zoneColours(undefined);
  this.timeTillNextAttack=Math.min(this.timeTillNextAttack-240000,30000);
 }
 setActive(active:boolean){
  if(active!==this.active){this.zoneColours(undefined);this.timeTillNextAttack=this.calculateTimeTillNextAttack();if(!active)this.endGangWar(false);}
  this.active=active;
 }
 gangWarGoingOn(){return this.state!==WAR_STATE.notInWar||this.state2===ATTACK_STATE.notified;}
 gangWarFightingGoingOn(){return this.state!==WAR_STATE.notInWar||this.state2===ATTACK_STATE.playerCame;}
 /** CGangWars::DontCreateCivilians. */
 dontCreateCivilians(){return this.state!==WAR_STATE.notInWar;}
 /** CGangWars::Update, once a frame; `dtMs` the frame's milliseconds (CTimer::GetTimeStepInMS). */
 update(dtMs:number){
  const now=this.host.nowMs(),previous=this.previousNow;this.previousNow=now;
  if(!this.active)return;
  // Provocation fades by 1/2000 a native time step (a fiftieth of a second).
  this.provocation=Math.max(this.provocation-(dtMs/20)/2000,0);
  const player=this.host.player();
  let victorious=false;
  switch(this.state){
   case WAR_STATE.notInWar:if(this.provocation>2.1)this.startOffensiveGangWar();break;
   case WAR_STATE.preFirstWave:case WAR_STATE.preSecondWave:case WAR_STATE.preThirdWave:{
    const wave=this.state===WAR_STATE.preFirstWave?0:this.state===WAR_STATE.preSecondWave?1:2;
    if(now>this.timeStarted+10000&&this.host.createAttackWave(Math.max(this.warFerocity,0)+wave,wave)){this.state=this.state+1;this.timeStarted=now;}
    break;
   }
   case WAR_STATE.firstWave:case WAR_STATE.secondWave:{
    if(!this.host.attackWaveOvercome())break;
    this.host.releasePedsInAttackWave(false,false);this.host.releaseCarsInAttackWave();
    if(this.makePlayerGainInfluenceInZone(.3)){victorious=true;break;}
    this.host.message(this.state===WAR_STATE.firstWave?gangWarText('GW_CLR1'):gangWarText('GW_CLR2'));
    this.state=this.state+1;this.timeStarted=now;break;
   }
   case WAR_STATE.thirdWave:if(this.host.attackWaveOvercome()){this.makePlayerGainInfluenceInZone(1);victorious=true;}break;
  }
  if(victorious)this.doStuffWhenPlayerVictorious();
  // The war's area: 50 units past the zone; 30 s outside it loses the war, a warning at 10 s.
  if(this.state!==WAR_STATE.notInWar&&this.zoneToFightOver){
   if(this.inside(this.zoneToFightOver,player.x,player.y,50))this.lastTimeInArea=now;
   else if(now-this.lastTimeInArea>30000){
    this.state=WAR_STATE.notInWar;this.provocation=0;this.host.releasePedsInAttackWave(true,false);this.host.releaseCarsInAttackWave();this.zoneColours(undefined);
    this.host.message(gangWarText('GW_FLEE'));
   }else if(now-this.lastTimeInArea>10000&&previous-this.lastTimeInArea<=10000)this.host.message(gangWarText('GW_WARN'));
  }
  if(this.state!==WAR_STATE.notInWar||this.host.playerOnMission()||player.z>950)this.timeTillNextAttack=Math.min(this.timeTillNextAttack,30000);
  if(this.state2!==ATTACK_STATE.none){
   const distance=Math.hypot(this.pointOfAttack.x-player.x,this.pointOfAttack.y-player.y);
   if(this.state2===ATTACK_STATE.notified){
    if(distance>=70){
     this.fightTimer-=dtMs;
     if(this.fightTimer<0){
      this.host.message(gangWarText('GW_NOSH'));this.state2=ATTACK_STATE.none;this.makeEnemyGainInfluenceInZone(this.gang1,30);
      this.zoneColours(undefined);this.timeTillNextAttack=this.calculateTimeTillNextAttack();this.host.respect(-30);
     }
    }else if(this.host.createDefendingGroup(this.gang1,this.pointOfAttack,this.difficulty)){this.fightTimer+=30000;this.state2=ATTACK_STATE.playerCame;}
   }else if(this.state2===ATTACK_STATE.playerCame){
    if(this.host.attackWaveOvercome()){
     this.host.message(gangWarText('GW_WON'));this.state2=ATTACK_STATE.none;this.strengthenPlayerInfluenceInZone(10);
     this.zoneColours(undefined);this.timeTillNextAttack=this.calculateTimeTillNextAttack();this.host.releasePedsInAttackWave(true,false);
    }else{
     this.fightTimer-=dtMs;
     if(this.fightTimer<0){
      this.host.message(gangWarText('GW_SLOW'));this.state2=ATTACK_STATE.none;
      this.makeEnemyGainInfluenceInZone(this.gang1,3*this.host.releasePedsInAttackWave(true,false));
      this.zoneColours(undefined);this.timeTillNextAttack=this.calculateTimeTillNextAttack();this.host.respect(-30);
     }
    }
   }
  }else if(!this.host.playerOnMission()&&!this.host.playerInAircraft()){
   if(this.state===WAR_STATE.notInWar)this.timeTillNextAttack-=this.host.weatherLA()?dtMs:dtMs*.6;
   if(this.timeTillNextAttack<0)this.startDefensiveGangWar();
  }
  if(this.radarBlip){
   if(this.state2===ATTACK_STATE.none||this.state2===ATTACK_STATE.playerCame){this.radarBlip=false;this.host.blip(undefined);}
   else{
    const period=this.fightTimer>120000?10:this.fightTimer>60000?9:this.fightTimer>30000?8:7;
    this.host.blip({position:{...this.pointOfAttack},gang:this.gang1,visible:!((now>>>period)%2)});
   }
  }
  if(this.state2!==ATTACK_STATE.none){
   const distance=Math.hypot(this.pointOfAttack.x-player.x,this.pointOfAttack.y-player.y);
   if(distance>=150)this.playerCloseby=false;else if(!this.playerCloseby){this.host.streamGangs();this.playerCloseby=true;}
  }
 }
 /** CTheZones::FillZonesWithGangColours / RadarMode: the contested zone (red, blinking) or the gang colours. */
 contested?:WorldZone;
 private zoneColours(zone:WorldZone|undefined){this.contested=zone;this.host.zoneColours(zone);}
 /** CRadar::DrawRadarGangOverlay's areas: every navigation zone with Ballas, Families or Vagos strength, coloured by
  * the strength-weighted gang colours at alpha 3 × the strength sum (55 to 120), the contested zone red at 160
  * pulsing on a 1024 ms sine (CTheZones::FillZonesWithGangColours, RadarMode 1 and 2). Native rectangles. */
 zoneOverlays(nowMs:number){
  const zones=this.host.zones();if(!this.active||!zones)return [];
  const out:{zone:WorldZone;colour:[number,number,number,number]}[]=[];
  for(const zone of zones.navigation){
   const info=zones.population?.[zone.zoneInfoIndex];if(!info)continue;
   const g=info.gangStrength,sum=g[GANG.ballas]+g[GANG.grove]+g[GANG.vagos];
   // RadarMode 1 needs gang strength; either mode needs a zone a war can start in.
   if(zone!==this.contested&&!sum||this.host.canStartHere&&!this.host.canStartHere(zone.zoneInfoIndex))continue;
   if(zone===this.contested){
    const a=Math.round((Math.sin((nowMs%1024)*(1024/(2*Math.PI)))+1)/2*160);
    out.push({zone,colour:[255,0,0,a]});continue;
   }
   const colour=[0,1,2].map(i=>Math.trunc((GANG_COLOURS[GANG.ballas][i]*g[GANG.ballas]+GANG_COLOURS[GANG.grove][i]*g[GANG.grove]+GANG_COLOURS[GANG.vagos][i]*g[GANG.vagos])/Math.max(1,sum))) as [number,number,number];
   // std::clamp<uint8>(gdSum * 3, 55, 120): the product is cut to a byte before the clamp.
   out.push({zone,colour:[colour[0],colour[1],colour[2],Math.max(55,Math.min(120,sum*3&255))]});
  }
  return out;
 }
 /** The zone the player stands in and its gang strengths (native eGangID order), for the dev state. */
 here(){
  const zones=this.host.zones();if(!zones)return null;
  const player=this.host.player(),zone=this.zoneAt(zones,player);if(!zone)return null;
  const info=zones.population?.[zone.zoneInfoIndex];
  return {label:zone.textLabel,infoLabel:zone.infoLabel,gangStrength:info?[...info.gangStrength]:null};
 }
 snapshot(){
  return {here:this.here(),overlays:this.zoneOverlays(this.host.nowMs()).length,contested:this.contested?.infoLabel??null,active:this.active,state:this.state,state2:this.state2,provocation:+this.provocation.toFixed(2),timeTillNextAttack:Math.round(this.timeTillNextAttack),fightTimer:Math.round(this.fightTimer),
   ferocity:this.warFerocity,difficulty:+this.difficulty.toFixed(2),gang1:this.gang1,gang2:this.gang2,zone:this.zoneToFightOver?.textLabel??null,pointOfAttack:{...this.pointOfAttack},territory:+this.territoryUnderControlPercentage.toFixed(2)};
 }
}
