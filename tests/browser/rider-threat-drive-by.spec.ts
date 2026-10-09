import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** TWAR7: OG Loc rides with CJ, hates Freddy's ped type (MISSION1), and the group's decision maker hands the hate to
 * his own, which answers it with TASK_SIMPLE_GANG_DRIVEBY: he sees Freddy and leans out firing (nativeRiderThreat). */
test('a script passenger drives by at a ped it hates when its decision maker says so',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const w=(fn:string,...args:unknown[])=>page.evaluate(({fn,args})=>(window as any).__game.missionForProfiling().runtime.world[fn](...args),{fn,args});
 const at=await page.evaluate(()=>{const p=(window as any).__game.state().player.position;return {x:p.x,y:-p.z,z:p.y};});
 const made=await page.evaluate(at=>{const m=(window as any).__game.missionForProfiling(),dms=m.runtime.game.decisionMakers;
  return {car:m.vehicles.create(400,{x:at.x+3,y:at.y+8,z:at.z},0),homie:m.peds.create(8,'MALE01',{x:at.x+5,y:at.y+8,z:at.z}),
   pedDm:dms.load(2,false,false),groupDm:dms.load(0,false,true)};},at);
 await page.waitForFunction(m=>{const g=(window as any).__game.missionForProfiling();return !!g.vehicles.entity(m.car)&&!!g.peds.entity(m.homie);},made,{timeout:60000});
 // As TWAR7 sets OG Loc up: 148@ answers the hate (36) with the gang drive-by, the group's 146@ with
 // TASK_GROUP_USE_MEMBER_DECISION in a car; a TEC-9, and hate for MISSION1, set with him aboard.
 await w('addPedDecisionMakerEventResponse',made.pedDm,36,1022,{respect:0,hate:100,like:0,dislike:0},true,true);
 await w('addGroupDecisionMakerEventResponse',made.groupDm,36,1510,{respect:0,hate:100,like:0,dislike:0},true,false);
 const group=await w('getPlayerGroup',0);
 await w('setGroupDecisionMaker',group,made.groupDm);
 await w('warpPedIntoCar',1,made.car);
 await w('warpPedIntoCarAsPassenger',made.homie,made.car,0);
 await expect.poll(()=>page.evaluate(m=>!!(window as any).__game.missionForProfiling().peds.entity(m.homie)?.rider,made),{timeout:30000}).toBe(true);
 await w('setPedDecisionMaker',made.homie,made.pedDm);
 await w('givePedWeapon',made.homie,32,30000);
 await w('setGroupMember',group,made.homie);
 const threat=()=>page.evaluate(m=>{const r=(window as any).__game.missionForProfiling().peds.entity(m.homie);return {threat:!!r?.threat,driveBy:!!r?.driveBy,range:r?.threat?.range,shots:r?.driveBy?.shots??0};},made);
 // Nobody hated about yet. (The car is in the open street: one put into the kerbside fence burns.)
 await page.waitForTimeout(4000);
 expect(await threat()).toEqual({threat:false,driveBy:false,range:undefined,shots:0});
 await w('setPedRelationship',made.homie,4,24);
 // Freddy: CREATE_CHAR 24 (MISSION1), twelve units up the street.
 const freddy=await page.evaluate(at=>(window as any).__game.missionForProfiling().peds.create(24,'MALE01',{x:at.x+3,y:at.y+20,z:at.z}),at);
 await expect.poll(async()=>(await threat()).driveBy,{timeout:20000}).toBe(true);
 expect(await page.evaluate(m=>(window as any).__game.missionForProfiling().vehicles.entity(m.car).health,made)).toBe(1000);
 // Range: the TEC-9's target range against a gang type's 40 + 5.
 expect((await threat()).range).toBe(45);
 // He leans out and fires at him.
 await expect.poll(async()=>(await threat()).shots,{timeout:20000}).toBeGreaterThan(0);
 // Dead, he is no threat, and the drive-by ends.
 await w('killPed',freddy);
 await expect.poll(async()=>(await threat()).driveBy,{timeout:10000}).toBe(false);
 expect(errors).toEqual([]);
});
