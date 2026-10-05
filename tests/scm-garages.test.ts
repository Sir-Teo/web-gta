import {expect,test} from 'vitest';
import {ScmGarages,GARAGE_DOOR_CLOSED,GARAGE_DOOR_OPEN,GARAGE_DOOR_CLOSING,GARAGE_DOOR_OPENING,GARAGE_DOOR_WAITING_PLAYER_TO_EXIT,GARAGE_DOOR_CLOSED_DROPPED_CAR,GARAGE_TYPE,hideOutSlot,readStoredCar,STORED_CAR,type StoredCar} from '../src/engine/ScmGarages';

const garages=()=>{const g=new ScmGarages();g.load([{name:'spray1',type:GARAGE_TYPE.paynspray},{name:'touch',type:GARAGE_TYPE.closesOnTouch},{name:'misn',type:1}]);return g;};

test('open and closed are the settled states: a moving door is neither (CGarage::IsOpen / IsClosed)',()=>{
 const g=garages(),m=g.garages[2];
 for(const [state,open,closed] of [[GARAGE_DOOR_CLOSED,false,true],[GARAGE_DOOR_OPEN,true,false],[GARAGE_DOOR_OPENING,false,false],[GARAGE_DOOR_CLOSING,false,false],[GARAGE_DOOR_WAITING_PLAYER_TO_EXIT,true,false]] as const){
  m.doorState=state;expect([g.isOpen('MISN'),g.isClosed('MISN')]).toEqual([open,closed]);
 }
});

test('OPEN and CLOSE only move a door that is not already heading that way',()=>{
 const g=garages(),m=g.garages[2];
 m.doorState=GARAGE_DOOR_OPEN;g.open('misn');expect(m.doorState).toBe(GARAGE_DOOR_OPEN);
 m.doorState=GARAGE_DOOR_CLOSED_DROPPED_CAR;g.open('misn');expect(m.doorState).toBe(GARAGE_DOOR_OPENING);
 g.close('misn');expect(m.doorState).toBe(GARAGE_DOOR_CLOSING);
 m.doorState=GARAGE_DOOR_CLOSED;g.close('misn');expect(m.doorState).toBe(GARAGE_DOOR_CLOSED);
});

test('activation opens a close-on-touch garage left unshut, and a type change opens shops and shuts the rest',()=>{
 const g=garages(),touch=g.garages[1];
 touch.inactive=true;touch.doorState=GARAGE_DOOR_CLOSING;g.activate('touch');
 expect([touch.inactive,touch.doorState]).toEqual([false,GARAGE_DOOR_OPENING]);
 const m=g.garages[2];
 g.changeType('misn',GARAGE_TYPE.paynspray);expect([m.doorState,m.doorPosition]).toEqual([GARAGE_DOOR_OPEN,1]);
 g.changeType('misn',19);expect([m.doorState,m.doorPosition]).toEqual([GARAGE_DOOR_CLOSED,0]);
 m.doorState=GARAGE_DOOR_OPENING;g.changeType('misn',GARAGE_TYPE.burglary);expect(m.doorState).toBe(GARAGE_DOOR_OPENING);
});

test('a new target car shuts a garage that dropped its last one, and SET_NO_RESPRAYS moves every Pay \'n\' Spray door',()=>{
 const g=garages(),m=g.garages[2];
 m.doorState=GARAGE_DOOR_CLOSED_DROPPED_CAR;g.setTargetCar('misn',42);expect([m.targetCar,m.doorState]).toEqual([42,GARAGE_DOOR_CLOSED]);
 g.allRespraysCloseOrOpen(true);expect(g.garages[0].doorState).toBe(GARAGE_DOOR_OPEN);expect(m.doorState).toBe(GARAGE_DOOR_CLOSED);
 g.allRespraysCloseOrOpen(false);expect(g.garages[0].doorState).toBe(GARAGE_DOOR_CLOSED);
});

test('an opened or closed door travels to its settled state over the frames (CGarage::Update), which IS_GARAGE_OPEN/CLOSED wait on',()=>{
 const g=garages();g.open('misn');expect(g.isOpen('misn')).toBe(false);
 let frames=0;while(!g.isOpen('misn')&&frames<1000){g.update(20);frames++;}
 expect(g.isOpen('misn')).toBe(true);expect(g.garages[2].doorPosition).toBe(1);expect(frames).toBeGreaterThan(10);expect(frames).toBeLessThan(200);
 g.close('misn');expect(g.isClosed('misn')).toBe(false);g.update(20);expect(g.garages[2].doorPosition).toBeLessThan(1);
 frames=0;while(!g.isClosed('misn')&&frames<1000){g.update(20);frames++;}
 expect(g.isClosed('misn')).toBe(true);expect(g.garages[2].doorPosition).toBe(0);
 // A settled door is left alone.
 g.update(20);expect(g.garages[2].doorState).toBe(GARAGE_DOOR_CLOSED);
});
test('a point inside a safehouse garage is within a hideout; other garages and points outside are not',()=>{
 const g=new ScmGarages();
 // Ganton's garage (type 16): the corner, a point along the door front, the far corner and top.
 g.load([{name:'gant',type:16,corner:[2500,-1690,12],front:[2510,-1690],far:[2500,-1680,16],flags:0},{name:'spray',type:GARAGE_TYPE.paynspray,corner:[100,100,0],front:[110,100],far:[100,110,5],flags:0},{name:'bare',type:16}]);
 expect(g.isPointWithinHideOut([2505,-1685,13])).toBe(true);
 expect(g.isPointWithinHideOut([2505,-1685,17])).toBe(false);
 expect(g.isPointWithinHideOut([2511,-1685,13])).toBe(false);
 expect(g.isPointWithinHideOut([105,105,1])).toBe(false);
 expect(ScmGarages.pointInside(g.garages[2],[0,0,0])).toBe(false);
});
test('the garage message restarts for a new tag, holds a repeat for 500 ms and then restarts 500 ms back (CGarages::TriggerMessage / PrintMessages)',async()=>{
 const {ScmGarageMessage}=await import('../src/engine/ScmGarages');
 const m=new ScmGarageMessage();
 m.trigger('TAG_ONE',1,5000,50,1000);expect(m.current(1000)).toEqual({id:'TAG_ONE',number:1,number2:50});expect(m.end).toBe(6000);
 // A repeat inside the first 500 ms is ignored: the counts stay.
 m.trigger('TAG_ONE',2,5000,50,1400);expect(m.current(1400)).toEqual({id:'TAG_ONE',number:1,number2:50});
 // After that it restarts 500 ms back, so it ends 4.5 s from now with the new counts.
 m.trigger('TAG_ONE',2,5000,50,2000);expect(m.start).toBe(1500);expect(m.end).toBe(6500);expect(m.current(2000)!.number).toBe(2);
 // A different tag restarts at once.
 m.trigger('TAG_ALL',-1,5000,-1,2100);expect(m.start).toBe(2100);expect(m.end).toBe(7100);
 // The tag is dropped by the draw that finds its time over, and stays set until then.
 expect(m.showing).toBe(true);expect(m.current(7099)).toBeTruthy();expect(m.current(7100)).toBeUndefined();expect(m.showing).toBe(false);
 // A finished message triggered again restarts.
 m.trigger('TAG_ALL',-1,5000,-1,9000);expect(m.start).toBe(9000);
});
test('the help box is blocked while a garage message shows (CHud::SetHelpMessage)',async()=>{
 const {ScmGameState}=await import('../src/engine/ScmGameState');
 const g=new ScmGameState();expect(g.help.blocked!()).toBe(false);
 g.garageMessage.trigger('OY_ONE',3,5000,50,0);expect(g.help.blocked!()).toBe(true);
 g.garageMessage.current(5000);expect(g.help.blocked!()).toBe(false);
});

// CGarage::Update's PAYNSPRAY case (AUTHORED from re3's respray case; see ScmGarages).
const sprayWorld=(o:Partial<{inside:boolean;refusal:'bmx'|'unsprayable'|undefined;outside:boolean;money:number;wanted:number;repaired:boolean;recoloured:boolean;coin:boolean}>={})=>{
 const log:{messages:string[];paid:number;held:boolean[];cleared:number;resprays:number;sounds:number[]}={messages:[],paid:0,held:[],cleared:0,resprays:0,sounds:[]};
 const state={inside:true,refusal:undefined as 'bmx'|'unsprayable'|undefined,outside:false,money:500,wanted:2,repaired:true,recoloured:true,coin:true,...o};
 const stats=new Map<number,number>([[176,7],[177,30]]);
 const world={nowMs:0,state,log,stats:{get:(id:number)=>stats.get(id)??0,increment:(id:number,by:number)=>stats.set(id,(stats.get(id)??0)+by),set:(id:number,value:number)=>stats.set(id,value),map:stats},
  sound:(event:number)=>{log.sounds.push(event);},
  playerCarParkedInside:()=>state.inside,playerCarRefusal:()=>state.refusal,playerOutside:()=>state.outside,
  money:()=>state.money,wantedLevel:()=>state.wanted,
  respray:()=>{log.resprays++;return {repaired:state.repaired,recoloured:state.recoloured};},
  pay:(n:number)=>{log.paid+=n;state.money-=n;},clearWanted:()=>{log.cleared++;state.wanted=0;},
  holdPlayer:(on:boolean)=>{log.held.push(on);},message:(id:string)=>{log.messages.push(id);},coin:()=>state.coin};
 return world;
};
const sprayGarage=()=>{const g=new ScmGarages();g.load([{name:'sprLAe',type:GARAGE_TYPE.paynspray,corner:[2056.6,-1835.9,12.5443],front:[2071.3,-1835.9],far:[2056.6,-1826.97,18.5443],flags:1}]);return g;};
const runFrames=(g:ScmGarages,world:{nowMs:number},frames:number)=>{for(let i=0;i<frames;i++){world.nowMs+=20;g.update(20);}};

test('a Pay \'n\' Spray stands open with its door up, as re3\'s AddOne leaves it; other garages start shut',()=>{
 const g=new ScmGarages();g.load([{name:'spray',type:GARAGE_TYPE.paynspray},{name:'bomb',type:GARAGE_TYPE.bombshopTimed},{name:'misn',type:1}]);
 expect(g.garages.map(x=>[x.doorState,x.doorPosition])).toEqual([[GARAGE_DOOR_OPEN,1],[GARAGE_DOOR_OPEN,1],[GARAGE_DOOR_CLOSED,0]]);
});

test('a wanted car parked inside: the door shuts on the player, two seconds later the car is done, $100 taken, GA_2, and the door opens',()=>{
 const g=sprayGarage(),world=sprayWorld(),spray=g.garages[0];g.respray=world;
 g.update(20);expect(spray.doorState).toBe(GARAGE_DOOR_CLOSING);expect(world.log.held).toEqual([true]);
 let frames=0;while(spray.doorState===GARAGE_DOOR_CLOSING&&frames<1000){runFrames(g,world,1);frames++;}
 expect(spray.doorState).toBe(GARAGE_DOOR_CLOSED);expect(spray.doorPosition).toBe(0);expect(world.log.resprays).toBe(0);
 // Down: AE_FRONTEND_CAR_RESPRAY, and the kills since the last checkpoint moved to the legitimate ones.
 expect(world.log.sounds).toEqual([16]);expect([world.stats.map.get(176),world.stats.map.get(177)]).toEqual([0,37]);
 // Shut for two seconds.
 runFrames(g,world,99);expect(spray.doorState).toBe(GARAGE_DOOR_CLOSED);
 runFrames(g,world,2);expect(spray.doorState).toBe(GARAGE_DOOR_OPENING);
 expect(world.log).toMatchObject({resprays:1,cleared:1,paid:100,messages:['GA_2'],held:[true]});
 expect(world.stats.map.get(16)).toBe(100);
 expect(spray.usedRespray).toBe(true);expect(g.hasResprayHappened('SPRLAE')).toBe(true);expect(g.hasResprayHappened('sprlae')).toBe(false);
 // His controls come back once the door is halfway up.
 while(spray.doorPosition<=.5)runFrames(g,world,1);
 expect(world.log.held.at(-1)).toBe(false);
 frames=0;while(spray.doorState===GARAGE_DOOR_OPENING&&frames<1000){runFrames(g,world,1);frames++;}
 // Up again, the garage waits for him to drive out before it will take a car again.
 expect(spray.doorState).toBe(GARAGE_DOOR_WAITING_PLAYER_TO_EXIT);runFrames(g,world,10);expect(spray.doorState).toBe(GARAGE_DOOR_WAITING_PLAYER_TO_EXIT);
 world.state.inside=false;world.state.outside=true;runFrames(g,world,1);expect(spray.doorState).toBe(GARAGE_DOOR_OPEN);
});

test('the lines: GA_XX for a repair alone; free everywhere, only new paint has a line; GA_22 where it is always free',()=>{
 const repairOnly=sprayGarage(),a=sprayWorld({wanted:0});repairOnly.respray=a;runFrames(repairOnly,a,400);
 expect(a.log).toMatchObject({paid:100,messages:['GA_XX']});
 // SET_FREE_RESPRAYS: nothing taken; the wanted level goes and the new paint gets one of its two lines.
 const free=sprayGarage(),b=sprayWorld({coin:false});free.respray=b;free.freeResprays=true;runFrames(free,b,400);
 expect(b.log).toMatchObject({paid:0,cleared:1,messages:['GA_16']});
 const freeSame=sprayGarage(),b2=sprayWorld({recoloured:false});freeSame.respray=b2;freeSame.freeResprays=true;runFrames(freeSame,b2,400);
 expect(b2.log).toMatchObject({paid:0,cleared:1,messages:[]});
 const paint=sprayGarage(),c=sprayWorld({wanted:0,repaired:false,coin:true});paint.respray=c;runFrames(paint,c,400);
 expect(c.log).toMatchObject({paid:0,messages:['GA_15']});
 // SET_GARAGE_RESPRAY_FREE (m_bRespraysAlwaysFree): GA_22, nothing taken.
 const garageFree=sprayGarage(),d=sprayWorld();garageFree.respray=d;garageFree.setResprayFree('sprlae',true);runFrames(garageFree,d,400);
 expect(d.log).toMatchObject({paid:0,messages:['GA_22']});
});

test('short of $100 it is GA_3 (CAR_NO_CASH), a car it will not touch GA_1 and a BMX GA_1B (CAR_IS_HOT): the door stays up and waits',()=>{
 for(const [o,line,sound] of [[{money:99},'GA_3',14],[{refusal:'unsprayable'},'GA_1',15],[{refusal:'bmx'},'GA_1B',15]] as const){
  const g=sprayGarage(),world=sprayWorld(o);g.respray=world;runFrames(g,world,5);
  expect(world.log.messages).toEqual([line]);expect(world.log.sounds).toEqual([sound]);expect(world.log.held).toEqual([]);
  expect(g.garages[0].doorState).toBe(GARAGE_DOOR_WAITING_PLAYER_TO_EXIT);expect(g.garages[0].doorPosition).toBe(1);
 }
 // A garage free only for itself still wants the $100 before it will shut (the money test reads the global flag).
 const g=sprayGarage(),world=sprayWorld({money:50});g.respray=world;g.setResprayFree('sprlae',true);runFrames(g,world,5);
 expect(world.log.messages).toEqual(['GA_3']);
});

test('SET_NO_RESPRAYS marks every Pay \'n\' Spray shut and it does nothing; lifted, they are open again (the doors are not moved)',()=>{
 const g=sprayGarage(),world=sprayWorld(),spray=g.garages[0];g.respray=world;
 // The handler (iOS 0x100206704): NoResprays on, and AllRespraysCloseOrOpen(false), which only sets the state.
 g.noResprays=true;g.allRespraysCloseOrOpen(false);runFrames(g,world,300);
 expect([spray.doorState,spray.doorPosition]).toEqual([GARAGE_DOOR_CLOSED,1]);expect(world.log.resprays).toBe(0);
 g.noResprays=false;g.allRespraysCloseOrOpen(true);runFrames(g,world,2);
 expect(spray.doorState).not.toBe(GARAGE_DOOR_CLOSED);
});

test('the door\'s pose: a turning door rises by half its height less a tenth and lies flat (BuildRotatedDoorMatrix), a plain one slides up its height',async()=>{
 const {garageDoorPose,garageCentre,garageDoorHeight}=await import('../src/engine/ScmGarages');
 const home={x:10,y:20,z:30};
 const shut=garageDoorPose(home,0,4,true,0);
 expect(shut.position).toEqual(home);expect(shut.up.z).toBeCloseTo(1,9);expect(shut.right.x).toBeCloseTo(1,9);
 const open=garageDoorPose(home,0,4,true,1);
 expect(open.position.z).toBeCloseTo(31.9,9);
 // A quarter turn about the forward axis: up lies along the old right, right points down.
 expect([open.up.x,open.up.y,open.up.z].map(v=>+v.toFixed(9)+0)).toEqual([1,0,0]);
 expect([open.right.x,open.right.y,open.right.z].map(v=>+v.toFixed(9)+0)).toEqual([0,0,-1]);
 expect(open.forward).toEqual({x:-0,y:1,z:0});
 const slid=garageDoorPose(home,Math.PI/2,4,false,.5);
 expect(slid.position.z).toBe(32);expect(slid.forward.x).toBeCloseTo(-1,9);
 expect(garageDoorHeight({min:{z:-2},max:{z:2.5}})).toBeCloseTo(4.4,9);
 const g=sprayGarage();expect(garageCentre(g.garages[0])).toEqual({x:2063.95,y:expect.closeTo(-1831.435,6)});
});

test('IsCarSprayable: not police, not the BMX class, not a bus, coach, trailer, fire truck or ambulance; and the box tests by sphere',async()=>{
 const {isCarSprayable}=await import('../src/engine/ScmGarages');
 expect([596,523,432,481,431,437,407,416].map(isCarSprayable)).toEqual(Array(8).fill(false));
 expect([400,410,522,462].map(isCarSprayable)).toEqual(Array(4).fill(true));
 const spray=sprayGarage().garages[0];
 expect(ScmGarages.sphereInside(spray,[2064,-1831,14],1)).toBe(true);
 expect(ScmGarages.sphereInside(spray,[2057,-1831,14],1)).toBe(false);
 expect(ScmGarages.sphereTouching(spray,[2056,-1831,14],1)).toBe(true);
 expect(ScmGarages.sphereTouching(spray,[2054,-1831,14],1)).toBe(false);
});

test('the slides report to the garage door audio: opening each step, opened once, and likewise down; hangars slower (SlideDoorOpen/Closed, iOS)',()=>{
 const g=new ScmGarages();g.load([{name:'misn',type:1},{name:'hangar',type:44}]);
 const heard:string[]=[];g.onDoorSound=(garage,event)=>heard.push(`${garage.name} ${event}`);
 g.open('misn');let frames=0;while(!g.isOpen('misn')&&frames<1000){g.update(20);frames++;}
 // 0.011 a step: the 91st step reaches the top.
 expect(frames).toBe(91);
 expect(heard.filter(h=>h==='misn 159')).toHaveLength(90);expect(heard.at(-1)).toBe('misn 160');
 heard.length=0;g.close('misn');frames=0;while(!g.isClosed('misn')&&frames<1000){g.update(20);frames++;}
 expect(frames).toBe(77);expect(heard.filter(h=>h==='misn 161')).toHaveLength(76);expect(heard.at(-1)).toBe('misn 162');
 // The AT-400 hangar's door goes a tenth as fast.
 g.open('hangar');for(let i=0;i<91;i++)g.update(20);expect(g.garages[1].doorPosition).toBeCloseTo(.1001,3);
});

test("a safehouse garage's door (CGarage::Update's hideout case, iOS): up for CJ near it, down once he is away, kept shut in interiors",()=>{
 const g=new ScmGarages();
 g.load([{name:'cjsafe',type:16,corner:[2502.31,-1699.36,12.4323],front:[2508.61,-1699.36],far:[2502.31,-1691.01,16.5666],flags:1}]);
 const garage=g.garages[0];expect(garage.doorState).toBe(GARAGE_DOOR_CLOSED);
 // The box spans x 2502.31 to 2508.61 and y -1699.36 to -1691.01: CJ stands south of it.
 const at={x:2505,y:-1699.36-5,z:13,vehicle:undefined as 'vehicle'|'bmx'|undefined,outside:true,inside:0,blocking:false};
 const log={stored:0,restored:[] as number[]};
 const car=(model:number):StoredCar=>({model,position:[2505,-1695,13],forward:[0,100,0],colours:[1,1,0,0],flags:0,nitroBoosts:0});
 g.hideouts={playerCentre:()=>[at.x,at.y,at.z],playerVehicle:()=>at.vehicle,playerOutside:()=>at.outside,carsInside:()=>at.inside,carBlockingDoor:()=>at.blocking,
  removeCarsInside:()=>{log.stored++;return [car(400)];},restoreCar:stored=>{log.restored.push(stored.model);return true;}};
 const run=(n:number)=>{for(let i=0;i<n;i++)g.update(20);};
 // On foot 5 units off: shut; 3 off: it starts up (it keeps no cars yet).
 run(3);expect(garage.doorState).toBe(GARAGE_DOOR_CLOSED);
 at.y=-1699.36-3;run(1);expect(garage.doorState).toBe(GARAGE_DOOR_OPENING);expect(log.restored).toEqual([]);
 run(200);expect(garage.doorState).toBe(GARAGE_DOOR_OPEN);expect(garage.doorPosition).toBe(1);
 // On foot within 4 it stays up; past 4 it starts down, and once down keeps the cars inside.
 at.y=-1699.36-3.9;run(3);expect(garage.doorState).toBe(GARAGE_DOOR_OPEN);
 at.y=-1699.36-5;run(1);expect(garage.doorState).toBe(GARAGE_DOOR_CLOSING);
 run(200);expect([garage.doorState,garage.doorPosition,log.stored,g.storedCount(garage)]).toEqual([GARAGE_DOOR_CLOSED,0,1,1]);
 // In a car (not a BMX) it opens from 10 units and stays up to 15, the kept car put back first; on foot past 4 it
 // starts down.
 at.vehicle='vehicle';at.y=-1699.36-9;run(1);expect(garage.doorState).toBe(GARAGE_DOOR_OPENING);
 expect([log.restored,g.storedCount(garage)]).toEqual([[400],0]);run(200);
 at.y=-1699.36-14;run(3);expect(garage.doorState).toBe(GARAGE_DOOR_OPEN);
 at.y=-1699.36-16;run(1);expect(garage.doorState).toBe(GARAGE_DOOR_CLOSING);
 at.y=-1699.36-2;run(1);run(200);at.vehicle=undefined;at.y=-1699.36-5;run(1);expect(garage.doorState).toBe(GARAGE_DOOR_CLOSING);
 // While he is not wholly outside, a closing door goes back up.
 at.outside=false;run(1);expect(garage.doorState).toBe(GARAGE_DOOR_OPENING);run(200);at.outside=true;
 // A car in the doorway holds it up until he is over 70 units away.
 at.vehicle=undefined;at.blocking=true;at.y=-1699.36-30;run(2);expect(garage.doorState).toBe(GARAGE_DOOR_OPEN);
 at.y=-1699.36-71;run(1);expect(garage.doorState).toBe(GARAGE_DOOR_CLOSING);run(200);at.blocking=false;
 // A BMX counts as on foot; in an interior (above 950) the shut door stays shut.
 at.vehicle='bmx';at.y=-1699.36-8;run(2);expect(garage.doorState).toBe(GARAGE_DOOR_CLOSED);
 at.vehicle=undefined;at.y=-1699.36-2;at.z=1000;run(2);expect(garage.doorState).toBe(GARAGE_DOOR_CLOSED);
 // Full (two cars for type 16) with him in a car outside it: it starts down.
 at.z=13;run(1);run(200);at.vehicle='vehicle';at.inside=2;at.y=-1699.36-2;run(1);expect(garage.doorState).toBe(GARAGE_DOOR_CLOSING);
});
test('the hangar (type 44) opens without stored cars and keeps none; an inactive shut hideout is left alone',()=>{
 const g=new ScmGarages();
 g.load([{name:'hangar',type:44,corner:[0,0,0],front:[10,0],far:[0,10,5],flags:0},{name:'safe',type:17,corner:[100,0,0],front:[110,0],far:[100,10,5],flags:0}]);
 const at={x:5,y:-2,z:1};const log={stored:0,restored:0};
 g.storedCars[hideOutSlot(44)][0]={model:400,position:[5,5,1],forward:[0,100,0],colours:[0,0,0,0],flags:0,nitroBoosts:0};
 g.hideouts={playerCentre:()=>[at.x,at.y,at.z],playerVehicle:()=>undefined,playerOutside:()=>true,carsInside:()=>0,carBlockingDoor:()=>false,
  removeCarsInside:()=>{log.stored++;return [];},restoreCar:()=>{log.restored++;return true;}};
 g.update(20);expect(g.garages[0].doorState).toBe(GARAGE_DOOR_OPENING);expect(log.restored).toBe(0);
 for(let i=0;i<1000;i++)g.update(20);at.x=500;for(let i=0;i<2000;i++)g.update(20);
 expect(g.garages[0].doorState).toBe(GARAGE_DOOR_CLOSED);expect(log.stored).toBe(0);
 g.deactivate('safe');at.x=105;g.update(20);expect(g.garages[1].doorState).toBe(GARAGE_DOOR_CLOSED);
 g.activate('safe');g.update(20);expect(g.garages[1].doorState).toBe(GARAGE_DOOR_OPENING);
});
test("a hideout keeps up to four cars in its type's slot (CStoredCar): kept on the door's close, put back before it opens, a full one shut to a car",()=>{
 // aCarsInSafeHouse's slots: the safehouses and impound lots each their own, the rest slot 0.
 expect([16,17,18,24,32,33,35,39,42,45].map(hideOutSlot)).toEqual([0,1,2,3,11,12,14,15,18,19]);
 expect([19,36,44].map(hideOutSlot)).toEqual([0,0,0]);
 const g=new ScmGarages();
 g.load([{name:'cjsafe',type:16,corner:[2502.31,-1699.36,12.4323],front:[2508.61,-1699.36],far:[2502.31,-1691.01,16.5666],flags:1}]);
 const garage=g.garages[0];
 const car=(model:number):StoredCar=>({model,position:[2505,-1695,13],forward:[0,100,0],colours:[1,1,0,0],flags:STORED_CAR.bulletProof,nitroBoosts:0});
 const at={y:-1699.36-3,vehicle:'vehicle' as 'vehicle'|undefined,given:[car(400),car(401),car(402),car(403),car(404)],ready:false};
 const asked:number[]=[],helps:string[]=[],clock={now:20000,nearDoor:false};
 g.hideouts={playerCentre:()=>[2505,at.y,13],playerVehicle:()=>at.vehicle,playerOutside:()=>true,carsInside:()=>0,carBlockingDoor:()=>false,
  removeCarsInside:(_g,max)=>{asked.push(max);return at.given.slice(0,max);},restoreCar:()=>at.ready,
  playerNearDoor:(_g,distance)=>{expect(distance).toBe(5);return clock.nearDoor;},help:key=>helps.push(key),get nowMs(){return clock.now;}};
 const run=(n:number)=>{for(let i=0;i<n;i++)g.update(20);};
 run(1);run(200);expect(garage.doorState).toBe(GARAGE_DOOR_OPEN);
 // Driven off and shut: the world is asked for four, and four are kept.
 at.y=-1699.36-20;run(1);run(200);expect(garage.doorState).toBe(GARAGE_DOOR_CLOSED);
 expect(asked).toEqual([4]);expect(g.storedCars[0].map(c=>c?.model)).toEqual([400,401,402,403]);
 // Back in a car: a type 16 garage holds two, so with four kept it stays shut; within 5 of a door it says so (GA_21),
 // again only after 18 s.
 at.y=-1699.36-3;run(5);expect(garage.doorState).toBe(GARAGE_DOOR_CLOSED);expect(helps).toEqual([]);
 clock.nearDoor=true;run(1);expect(helps).toEqual(['GA_21']);
 clock.now+=18000;run(1);expect(helps).toHaveLength(1);clock.now+=1;run(1);expect(helps).toEqual(['GA_21','GA_21']);
 expect(garage.doorState).toBe(GARAGE_DOOR_CLOSED);
 // On foot it opens once the cars stand again; until they do it waits shut.
 at.vehicle=undefined;run(5);expect(garage.doorState).toBe(GARAGE_DOOR_CLOSED);expect(g.storedCount(garage)).toBe(4);
 at.ready=true;run(1);expect(garage.doorState).toBe(GARAGE_DOOR_OPENING);expect(g.storedCount(garage)).toBe(0);
 // Shut on nothing: the slot is cleared.
 at.given=[];at.y=-1699.36-20;run(1);run(200);expect(g.storedCars[0]).toEqual([null,null,null,null]);
});
test('a stored car from a save is checked whole',()=>{
 const car={model:400,position:[1,2,3],forward:[0,100,0],colours:[1,2,3,4],flags:129,nitroBoosts:5};
 expect(readStoredCar(car)).toEqual(car);expect(readStoredCar(JSON.parse(JSON.stringify(car)))).not.toBe(car);
 for(const bad of [null,1,{...car,model:0},{...car,position:[1,2]},{...car,forward:[0,1.5,0]},{...car,colours:[1,2,3]},{...car,flags:'x'}])expect(readStoredCar(bad)).toBeUndefined();
});
test('before a save every safehouse garage not shut is shut on the spot, its cars kept and its doorway cleared (CloseHideOutGaragesBeforeSave, iOS)',()=>{
 const g=new ScmGarages();
 g.load([{name:'cjsafe',type:16,corner:[2502.31,-1699.36,12.4323],front:[2508.61,-1699.36],far:[2502.31,-1691.01,16.5666],flags:1},{name:'hangar',type:44,corner:[0,0,0],front:[10,0],far:[0,10,5],flags:0},{name:'safe2',type:17,corner:[100,0,0],front:[110,0],far:[100,10,5],flags:0}]);
 const log:string[]=[];
 g.hideouts={playerCentre:()=>[0,0,0],playerVehicle:()=>undefined,playerOutside:()=>true,carsInside:()=>0,carBlockingDoor:()=>false,
  removeCarsInside:(garage,max)=>{log.push(`store ${garage.name} ${max}`);return [{model:400,position:[2505,-1695,13],forward:[0,100,0],colours:[1,1,0,0],flags:0,nitroBoosts:0}];},
  removeCarBlockingDoor:garage=>{log.push(`doorway ${garage.name}`);}};
 const [safe,hangar]=g.garages;
 safe.doorState=GARAGE_DOOR_OPENING;safe.doorPosition=.4;hangar.doorState=GARAGE_DOOR_OPEN;hangar.doorPosition=1;
 g.closeHideOutGaragesBeforeSave();
 // The half-open safehouse shuts and keeps its car; the hangar (not a safehouse) and the shut one are left.
 expect([safe.doorState,safe.doorPosition]).toEqual([GARAGE_DOOR_CLOSED,0]);expect(g.storedCount(safe)).toBe(1);
 expect([hangar.doorState,hangar.doorPosition]).toEqual([GARAGE_DOOR_OPEN,1]);
 expect(log).toEqual(['store cjsafe 4','doorway cjsafe']);
});
