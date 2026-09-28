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
