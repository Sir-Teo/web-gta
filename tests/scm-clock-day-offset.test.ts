import {describe,expect,test} from 'vitest';
import {ScmClock} from '../src/engine/ScmGameState';

describe('CClock::OffsetClockByADay',()=>{
 test('a day forward carries over the month by the month table, and the weekday wraps',()=>{
  const c=new ScmClock();c.days=29;c.month=2;c.currentDay=7;
  c.offsetByADay(true);expect([c.days,c.month,c.currentDay]).toEqual([1,3,1]);
  c.days=31;c.month=12;c.offsetByADay(true);expect([c.days,c.month]).toEqual([1,1]);
 });
 test('a day back goes to the last day of the month before',()=>{
  const c=new ScmClock();c.days=1;c.month=3;c.currentDay=1;
  c.offsetByADay(false);expect([c.days,c.month,c.currentDay]).toEqual([29,2,7]);
  c.days=1;c.month=1;c.offsetByADay(false);expect([c.days,c.month]).toEqual([31,12]);
 });
});
