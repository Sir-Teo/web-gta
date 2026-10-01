import {expect,test} from 'vitest';
import {ScmGarages,GARAGE_DOOR_CLOSED,GARAGE_DOOR_OPEN,GARAGE_DOOR_CLOSING,GARAGE_DOOR_OPENING,GARAGE_DOOR_WAITING_PLAYER_TO_EXIT,GARAGE_DOOR_CLOSED_DROPPED_CAR,GARAGE_TYPE} from '../src/engine/ScmGarages';

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
const sprayWorld=(o:Partial<{inside:boolean;sprayable:boolean;outside:boolean;money:number;wanted:number;repaired:boolean;recoloured:boolean;coin:boolean}>={})=>{
 const log:{messages:string[];paid:number;held:boolean[];cleared:number;resprays:number}={messages:[],paid:0,held:[],cleared:0,resprays:0};
 const state={inside:true,sprayable:true,outside:false,money:500,wanted:2,repaired:true,recoloured:true,coin:true,...o};
 const world={nowMs:0,state,log,
  playerCarParkedInside:()=>state.inside,playerCarSprayable:()=>state.sprayable,playerOutside:()=>state.outside,
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
 // TIME_TO_RESPRAY: shut for two seconds.
 runFrames(g,world,99);expect(spray.doorState).toBe(GARAGE_DOOR_CLOSED);
 runFrames(g,world,2);expect(spray.doorState).toBe(GARAGE_DOOR_OPENING);
 expect(world.log).toMatchObject({resprays:1,cleared:1,paid:100,messages:['GA_2'],held:[true,false]});
 expect(spray.usedRespray).toBe(true);expect(g.hasResprayHappened('SPRLAE')).toBe(true);expect(g.hasResprayHappened('sprlae')).toBe(false);
 frames=0;while(spray.doorState===GARAGE_DOOR_OPENING&&frames<1000){runFrames(g,world,1);frames++;}
 // Up again, the garage waits for him to drive out before it will take a car again.
 expect(spray.doorState).toBe(GARAGE_DOOR_WAITING_PLAYER_TO_EXIT);runFrames(g,world,10);expect(spray.doorState).toBe(GARAGE_DOOR_WAITING_PLAYER_TO_EXIT);
 world.state.inside=false;world.state.outside=true;runFrames(g,world,1);expect(spray.doorState).toBe(GARAGE_DOOR_OPEN);
});

test('the lines: GA_XX for a repair alone, a free respray complimentary, and a paint job alone free with one of two lines',()=>{
 const repairOnly=sprayGarage(),a=sprayWorld({wanted:0});repairOnly.respray=a;runFrames(repairOnly,a,400);
 expect(a.log).toMatchObject({paid:100,messages:['GA_XX']});
 const free=sprayGarage(),b=sprayWorld();free.respray=b;free.freeResprays=true;runFrames(free,b,400);
 expect(b.log).toMatchObject({paid:0,cleared:1,messages:['GA_16']});
 const paint=sprayGarage(),c=sprayWorld({wanted:0,repaired:false,coin:true});paint.respray=c;runFrames(paint,c,400);
 expect(c.log).toMatchObject({paid:0,messages:['GA_15']});
 const garageFree=sprayGarage(),d=sprayWorld();garageFree.respray=d;garageFree.setResprayFree('sprlae',true);runFrames(garageFree,d,400);
 expect(d.log.paid).toBe(0);
});

test('short of $100 it is GA_3, and a car it will not touch GA_1: the door stays up and waits for him to leave',()=>{
 for(const [o,line] of [[{money:99},'GA_3'],[{sprayable:false},'GA_1']] as const){
  const g=sprayGarage(),world=sprayWorld(o);g.respray=world;runFrames(g,world,5);
  expect(world.log.messages).toEqual([line]);expect(world.log.held).toEqual([]);
  expect(g.garages[0].doorState).toBe(GARAGE_DOOR_WAITING_PLAYER_TO_EXIT);expect(g.garages[0].doorPosition).toBe(1);
 }
});

test('SET_NO_RESPRAYS shuts every Pay \'n\' Spray and keeps it shut; lifted, the doors come back up',()=>{
 const g=sprayGarage(),world=sprayWorld({inside:false,outside:true}),spray=g.garages[0];g.respray=world;
 g.noResprays=true;g.allRespraysCloseOrOpen(true);runFrames(g,world,300);
 expect([spray.doorState,spray.doorPosition]).toEqual([GARAGE_DOOR_CLOSED,0]);expect(world.log.resprays).toBe(0);
 g.noResprays=false;g.allRespraysCloseOrOpen(false);runFrames(g,world,300);
 expect([spray.doorState,spray.doorPosition]).toEqual([GARAGE_DOOR_OPEN,1]);
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
