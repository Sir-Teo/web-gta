import {expect,test} from 'vitest';
import {GangWars,GANG,WAR_STATE,ATTACK_STATE,GANG_WAR_TEXT,attackWaveComposition,attackWaveWeapon,type GangWarHost} from '../src/simulation/GangWars';
import type {WorldZones,WorldZone} from '../src/assets/worldZones';
const zone=(infoLabel:string,i:number,min:[number,number],max:[number,number]):WorldZone=>({infoLabel,textLabel:infoLabel,type:0,min:[min[0],min[1],-100],max:[max[0],max[1],500],level:0,line:0,source:'t',zoneInfoIndex:i});
function world(){
 // Ganton (Families, holds the Grove Street home), Idlewood (Ballas, adjoining), a far Vagos zone, the home zone and
 // Jefferson (Families, adjoining Idlewood).
 // worldZoneAt needs the SAN_AND fallback first, as the shipped zone table has it.
 const navigation=[zone('SAN_AND',5,[-3000,-3000],[3000,3000]),zone('GAN',0,[2400,-1750],[2600,-1600]),zone('IWD',1,[2000,-1750],[2400,-1600]),zone('LMEX',2,[1000,-2000],[1200,-1800]),zone('HOME',3,[2480,-1680],[2520,-1650]),zone('JEF',4,[2000,-1600],[2400,-1500])];
 const population=[{popType:0,gangStrength:[0,60,0,0,0,0,0,0,0,0],dealerStrength:0,races:15,noCops:false},{popType:0,gangStrength:[70,0,0,0,0,0,0,0,0,0],dealerStrength:0,races:15,noCops:false},
  {popType:0,gangStrength:[0,0,50,0,0,0,0,0,0,0],dealerStrength:0,races:15,noCops:false},{popType:0,gangStrength:[0,40,0,0,0,0,0,0,0,0],dealerStrength:0,races:15,noCops:false},{popType:0,gangStrength:[0,30,0,0,0,0,0,0,0,0],dealerStrength:0,races:15,noCops:false},{popType:0,gangStrength:Array(10).fill(0),dealerStrength:0,races:15,noCops:false}];
 const zones:WorldZones={navigation,map:[],infoLabels:['GAN','IWD','LMEX','HOME','JEF','SAN_AND'],population};
 return zones;
}
function host(zones:WorldZones){
 const log:string[]=[];let now=0;const state={player:{x:2200,y:-1700,z:10},now:()=>now,advance:(ms:number)=>{now+=ms;},overcome:false,waveOk:true,defendersOk:true,released:0,respect:0,log,
  blip:undefined as unknown,gangWar:false,streets:false};
 const h:GangWarHost={nowMs:()=>now,player:()=>state.player,playerOnMission:()=>false,playerInAircraft:()=>false,weatherLA:()=>true,zones:()=>zones,
  createAttackWave:(f,w)=>{log.push(`wave:${f}:${w}`);return state.waveOk;},createDefendingGroup:(g,p,d)=>{log.push(`defend:${g}:${d.toFixed(2)}`);return state.defendersOk;},
  attackWaveOvercome:()=>state.overcome,releasePedsInAttackWave:(e,r)=>{log.push(`release:${e}:${r}`);return state.released;},releaseCarsInAttackWave:()=>{},
  tellGangMembersTo:w=>{state.gangWar=!w;},clearTheStreets:()=>{state.streets=true;},message:t=>log.push(`msg:${t}`),help:t=>log.push(`help:${t}`),respect:d=>{state.respect+=d;},
  blip:b=>{state.blip=b;},zoneColours:()=>{},streamGangs:()=>{},random:()=>.5};
 return {h,state};
}
const run=(g:GangWars,s:{advance:(ms:number)=>void},ms:number,step=100)=>{for(let t=0;t<ms;t+=step){s.advance(step);g.update(step);}};
test('three Ballas kills on foot provoke an offensive war in the player\'s zone; the waves take the turf for the Families',()=>{
 const zones=world(),{h,state}=host(zones),g=new GangWars(h);g.updateTerritoryUnderControlPercentage();
 expect(g.territoryUnderControlPercentage).toBeCloseTo(.6,5);
 g.addKillToProvocation(GANG.grove);g.addKillToProvocation(GANG.ballas);g.addKillToProvocation(GANG.vagos);
 expect(g.provocation).toBe(2);g.update(20);expect(g.state).toBe(WAR_STATE.notInWar);
 g.addKillToProvocation(GANG.ballas);g.update(20);
 expect(g.state).toBe(WAR_STATE.preFirstWave);expect(g.gang1).toBe(GANG.ballas);expect(g.zoneToFightOver?.infoLabel).toBe('IWD');
 expect(state.gangWar).toBe(true);expect(state.streets).toBe(true);expect(state.log).toContain(`msg:${GANG_WAR_TEXT.GW_PROV}`);
 // The zone's strength sum over 15, capped at 2 (the reference's override from the territory share is dead code).
 expect(g.warFerocity).toBe(2);expect(g.dontCreateCivilians()).toBe(true);
 // Ten seconds before the first wave; the second and third follow each cleared wave, each 10 s later.
 run(g,state,9000);expect(state.log.filter(l=>l.startsWith('wave:')).length).toBe(0);
 run(g,state,1200);expect(g.state).toBe(WAR_STATE.firstWave);expect(state.log).toContain('wave:2:0');
 state.overcome=true;run(g,state,200);
 expect(g.state).toBe(WAR_STATE.preSecondWave);expect(zones.population![1].gangStrength[GANG.ballas]).toBe(49);expect(zones.population![1].gangStrength[GANG.grove]).toBe(21);
 state.overcome=false;run(g,state,10200);expect(g.state).toBe(WAR_STATE.secondWave);expect(state.log).toContain('wave:3:1');
 state.overcome=true;run(g,state,200);expect(g.state).toBe(WAR_STATE.preThirdWave);expect(zones.population![1].gangStrength[GANG.ballas]).toBe(34);
 state.overcome=false;run(g,state,10200);expect(g.state).toBe(WAR_STATE.thirdWave);
 state.overcome=true;run(g,state,200);
 expect(g.state).toBe(WAR_STATE.notInWar);expect(zones.population![1].gangStrength[GANG.ballas]).toBe(0);expect(zones.population![1].gangStrength[GANG.grove]).toBe(70);
 expect(state.respect).toBe(45);expect(state.gangWar).toBe(false);expect(state.log).toContain(`msg:${GANG_WAR_TEXT.GW_YRS}`);
 // The defensive timer, capped at 30 s through the war, drops by 240 s on victory: the enemy tries a counter-attack at
 // once (a zone is picked, or the timer is rolled afresh when the drawn enemy zone has no Families neighbour).
 expect(g.state2===ATTACK_STATE.notified||g.timeTillNextAttack>600000).toBe(true);
});
test('leaving the war zone for 30 s loses the war after a warning at 10 s',()=>{
 const zones=world(),{h,state}=host(zones),g=new GangWars(h);
 g.provocation=3;g.update(20);expect(g.state).toBe(WAR_STATE.preFirstWave);
 run(g,state,10200);expect(g.state).toBe(WAR_STATE.firstWave);
 state.player={x:1000,y:-1000,z:10};
 run(g,state,10500);expect(state.log).toContain(`msg:${GANG_WAR_TEXT.GW_WARN}`);expect(g.state).toBe(WAR_STATE.firstWave);
 run(g,state,20000);expect(g.state).toBe(WAR_STATE.notInWar);expect(state.log).toContain(`msg:${GANG_WAR_TEXT.GW_FLEE}`);expect(state.log).toContain('release:true:false');
});
test('a defensive war picks a Families zone by enemy turf, times out with lost strength and respect, or is won on the spot',()=>{
 const zones=world(),{h,state}=host(zones),g=new GangWars(h);g.updateTerritoryUnderControlPercentage();
 state.player={x:3000,y:-1000,z:10};
 g.timeTillNextAttack=100;run(g,state,200);
 // Ganton holds the Grove Street home and is never attacked; Jefferson beside Idlewood is.
 expect(g.state2).toBe(ATTACK_STATE.notified);expect(g.zoneToFightOver?.infoLabel).toBe('JEF');expect(g.gang1).toBe(GANG.ballas);
 expect(state.log).toContain(`help:${GANG_WAR_TEXT.GW_ATK}`);expect(state.blip).toMatchObject({gang:GANG.ballas});
 const far=Math.hypot(2200-3000,-1550+1000);expect(Math.abs(g.fightTimer-(far*200+240000))).toBeLessThan(300);
 // Never showing up: the gang gains 30 in the zone, respect drops 30.
 run(g,state,far*200+241000,1000);
 expect(g.state2).toBe(ATTACK_STATE.none);expect(zones.population![4].gangStrength[GANG.ballas]).toBe(30);expect(state.respect).toBe(-30);expect(state.log).toContain(`msg:${GANG_WAR_TEXT.GW_NOSH}`);
 // Next time the player comes: the defenders stand, the fight timer gains 30 s, beating them adds 10 to the Families.
 g.timeTillNextAttack=100;run(g,state,200);expect(g.state2).toBe(ATTACK_STATE.notified);
 state.player={x:2200,y:-1550,z:10};const before=g.fightTimer;run(g,state,200);
 expect(g.state2).toBe(ATTACK_STATE.playerCame);expect(g.fightTimer).toBeGreaterThan(before+29000);expect(state.log.some(l=>l.startsWith('defend:0:'))).toBe(true);
 state.overcome=true;run(g,state,200);
 expect(g.state2).toBe(ATTACK_STATE.none);expect(zones.population![4].gangStrength[GANG.grove]).toBe(40);expect(state.log).toContain(`msg:${GANG_WAR_TEXT.GW_WON}`);
});
test('the radar overlay colours each gang zone by its strength-weighted gang colours and pulses the contested zone red',()=>{
 const zones=world(),{h,state}=host(zones),g=new GangWars(h);
 const before=g.zoneOverlays(0);
 expect(before.map(o=>o.zone.infoLabel).sort()).toEqual(['GAN','HOME','IWD','JEF','LMEX']);
 expect(before.find(o=>o.zone.infoLabel==='GAN')?.colour).toEqual([70,200,0,120]);
 expect(before.find(o=>o.zone.infoLabel==='IWD')?.colour).toEqual([200,0,200,120]);
 expect(before.find(o=>o.zone.infoLabel==='JEF')?.colour).toEqual([70,200,0,90]);
 g.provocation=3;g.update(20);
 const during=g.zoneOverlays(256);
 const iwd=during.find(o=>o.zone.infoLabel==='IWD')!;
 expect(iwd.colour.slice(0,3)).toEqual([255,0,0]);expect(iwd.colour[3]).toBeGreaterThan(0);expect(iwd.colour[3]).toBeLessThanOrEqual(160);
 expect(g.zoneOverlays(768).find(o=>o.zone.infoLabel==='IWD')!.colour[3]).not.toBe(iwd.colour[3]);
 g.active=false;expect(g.zoneOverlays(0)).toEqual([]);
 void state;
});

test('a war starts only where CanPlayerStartAGangWarHere allows, and takeovers and losses count their stats',()=>{
 const zones=world(),{h,state}=host(zones),stats:string[]=[];
 let allowed:(i:number)=>boolean=i=>i===4;h.canStartHere=i=>allowed(i);h.territoryStat=(kind,value)=>stats.push(`${kind}:${value}`);
 const g=new GangWars(h);
 // Idlewood (info 1) is not the script's zone: provocation just resets.
 for(let i=0;i<3;i++)g.addKillToProvocation(GANG.ballas);g.update(20);
 expect(g.state).toBe(WAR_STATE.notInWar);expect(g.provocation).toBe(0);
 // Nor is it drawn on the radar.
 expect(g.zoneOverlays(0).map(o=>o.zone.infoLabel)).toEqual(['JEF']);
 allowed=()=>true;for(let i=0;i<3;i++)g.addKillToProvocation(GANG.ballas);g.update(20);
 expect(g.state).toBe(WAR_STATE.preFirstWave);
 // Taking half the Ballas strength leaves them ahead; all of it hands the zone over.
 g.makePlayerGainInfluenceInZone(.3);expect(stats).toEqual([]);
 g.makePlayerGainInfluenceInZone(1);expect(stats).toEqual(['taken:1']);
 g.makeEnemyGainInfluenceInZone(GANG.ballas,200);expect(stats).toEqual(['taken:1','lost:1']);
 g.updateTerritoryUnderControlPercentage();expect(stats.at(-1)).toMatch(/^held:/);
 void state;
});

test('a training mission holds the defensive attack\'s countdown',()=>{
 const zones=world(),{h,state}=host(zones);let training=true;h.trainingMission=()=>training;
 const g=new GangWars(h);g.timeTillNextAttack=100;run(g,state,200);
 expect(g.timeTillNextAttack).toBe(100);expect(g.state2).toBe(ATTACK_STATE.none);
 training=false;run(g,state,200);expect(g.state2).toBe(ATTACK_STATE.notified);
});
// CHud::DrawAreaName: with gang wars active the zone name takes FillZonesWithGangColours' strength-weighted colour of
// the zone the player stands in, when every channel is non-zero; otherwise (or with wars off) the light blue.
test('the zone name colour is the gang colour of the zone under the player while wars are active',()=>{
 const zones=world();const {h,state}=host(zones);const g=new GangWars(h);
 // Ganton, Families only: (70, 200, 0) has a zero channel, so no tint.
 state.player={x:2500,y:-1700,z:10};expect(g.zoneNameColour()).toBeUndefined();
 // Idlewood, Ballas only: (200, 0, 200) has a zero channel too, so the original keeps the light blue there as well.
 state.player={x:2200,y:-1700,z:10};expect(g.zoneNameColour()).toBeUndefined();
 // A shared zone weights the colours by strength: Jefferson set half Families, half Ballas.
 zones.population![4].gangStrength[GANG.ballas]=30;state.player={x:2200,y:-1550,z:10};
 expect(g.zoneNameColour()).toEqual([135,100,100]);
 g.active=false;expect(g.zoneNameColour()).toBeUndefined();
});

test('an attack wave is made as iOS makes it: its size, its two weapons and its aim by ferocity and difficulty',()=>{
 // (Difficulty × 0.3 + 0.7) × (f + 3), accuracy Difficulty × 25 + 70, 120 health, 5000 rounds.
 expect(attackWaveComposition(0,0,false)).toEqual({count:2,a:22,b:5,accuracy:70,health:120,ammo:5000});
 expect(attackWaveComposition(3,1,false)).toMatchObject({count:6,a:30,b:29,accuracy:95});
 expect(attackWaveComposition(2,.5,false)).toMatchObject({count:4,a:29,b:28,accuracy:82});
 // Ferocity 5: ten of them, the AK-47 or the Desert Eagle.
 expect(attackWaveComposition(5,0,false)).toMatchObject({count:10,a:30,b:24});
 // The training mission (CRASH4): two, with a bat, then a pistol, then Tec-9s.
 expect(attackWaveComposition(0,.2,true)).toMatchObject({count:2,a:5,b:5});
 expect(attackWaveComposition(1,.2,true)).toMatchObject({count:2,a:22,b:22});
 expect(attackWaveComposition(2,.2,true)).toMatchObject({count:2,a:32,b:32});
 // B when random × 1.6 − 0.3 is over Difficulty.
 expect(attackWaveWeapon({a:22,b:5},.3,.5)).toBe(5);
 expect(attackWaveWeapon({a:22,b:5},0,0)).toBe(22);
 expect(attackWaveWeapon({a:22,b:5},1,.99)).toBe(5);
});
