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
