import {describe,expect,test} from 'vitest';
import {CARD_STACK_SIZE,ScmCardDecks} from '../src/engine/ScmCardDecks';

const crt=(seed=1)=>{let s=seed;return ()=>{s=(s*214013+2531011)>>>0;return (s>>>16)&0x7fff;};};

describe('the script card stack (SHUFFLE_CARD_DECKS, FETCH_NEXT_CARD)',()=>{
 test('one deck holds each of the 52 cards once, and the rest of the stack none',()=>{
  const d=new ScmCardDecks();d.shuffle(1,crt());
  expect([...d.stack.slice(0,52)].sort((a,b)=>a-b)).toEqual(Array.from({length:52},(_,i)=>i+1));
  expect(d.stack.slice(52).every(c=>c===0)).toBe(true);
  // Shuffled, not in order.
  expect([...d.stack.slice(0,52)]).not.toEqual(Array.from({length:52},(_,i)=>i+1));
 });
 test('six decks fill the stack with six of each card',()=>{
  const d=new ScmCardDecks();d.shuffle(6,crt(7));
  const counts=new Map<number,number>();for(const c of d.stack)counts.set(c,(counts.get(c)??0)+1);
  expect(counts.size).toBe(52);for(const n of counts.values())expect(n).toBe(6);
 });
 test('the deal runs down the stack and starts over from its top past the last card',()=>{
  const d=new ScmCardDecks();d.shuffle(1,crt(3));
  const first=[...d.stack.slice(0,52)];
  expect(Array.from({length:52},()=>d.next())).toEqual(first);
  expect(d.next()).toBe(first[0]);
  const full=new ScmCardDecks();full.shuffle(6,crt(5));
  for(let i=0;i<CARD_STACK_SIZE;i++)full.next();
  expect(full.position).toBe(0);
 });
 test('a new shuffle deals from the top again',()=>{
  const d=new ScmCardDecks();d.shuffle(2,crt(9));d.next();d.next();
  d.shuffle(1,crt(11));expect(d.position).toBe(0);expect(d.next()).toBe(d.stack[0]);
 });
});
