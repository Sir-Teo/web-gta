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
