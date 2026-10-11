import {expect,test} from 'vitest';
import {CREDIT_LINES,CREDITS_LENGTH,CREDITS_MS_PER_UNIT,CREDITS_SCREEN_HEIGHT,ScmCredits} from '../src/engine/ScmCredits';
import {CREDITS,CREDITS_IOS_TEXT} from '../src/assets/creditsTable';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {scmOpcode} from '../src/engine/scmOpcodes';

test('the iOS roll: the PC lines with War Drum Studios after CRED545, laid out as PrintCreditText steps them',()=>{
 expect(CREDIT_LINES).toHaveLength(616);
 expect(CREDITS.filter(e=>typeof e==='number')).toHaveLength(116);
 const at=(key:string)=>CREDIT_LINES.findIndex(l=>l.key===key);
 // CRED000 (a heading) at 0, a big space (37), CRED001 22 below that: a 1.1 line steps 22, where the PC's steps 20.
 expect(CREDIT_LINES.slice(0,3).map(l=>[l.key,l.position,l.heading])).toEqual([['CRED000',0,true],['CRED001',59,true],['CRED002',81,false]]);
 // A 0.78 line steps 15 (0.78 × 20 = 15.6, truncated with the position).
 const small=CREDIT_LINES.findIndex((l,i)=>l.scale===.78&&CREDIT_LINES[i+1]?.scale===.78&&typeof CREDITS[CREDITS.indexOf(CREDITS.find(e=>Array.isArray(e)&&e[0]===l.key)!)+1]!=='number');
 expect(CREDIT_LINES[small+1].position-CREDIT_LINES[small].position).toBe(15);
 expect(at('CREWD0')).toBeGreaterThan(at('CRED545'));expect(at('CREWD0')).toBeLessThan(at('CRED600'));
 expect(CREDITS_IOS_TEXT.CREWD0).toBe('WAR DRUM STUDIOS');
 expect(CREDIT_LINES.at(-1)!.key).toBe('CRED716');
});

test('the credits go until the roll\'s end is 10 above the top of the screen, a unit every 23 ms',()=>{
 const credits=new ScmCredits();expect(credits.finished).toBe(true);
 credits.start(1000);expect(credits.finished).toBe(false);
 const end=1000+(CREDITS_LENGTH+CREDITS_SCREEN_HEIGHT+10)*CREDITS_MS_PER_UNIT;
 expect(credits.render(1000)).toBe(0);
 credits.render(end-CREDITS_MS_PER_UNIT);expect(credits.finished).toBe(false);
 credits.render(end+CREDITS_MS_PER_UNIT);expect(credits.finished).toBe(true);
 // About seven minutes, as the roll runs over the ending's music.
 expect((end-1000)/60000).toBeGreaterThan(6);expect((end-1000)/60000).toBeLessThan(8);
 credits.start(0);credits.stop();expect(credits.finished).toBe(true);
});

test('START_CREDITS, ARE_CREDITS_FINISHED and STOP_CREDITS run on the game state',()=>{
 const game=new ScmGameState(),bytes:number[]=[];
 const op=(name:string)=>{const o=scmOpcode(name);bytes.push(o&0xff,o>>8&0xff);};
 op('START_CREDITS');op('ARE_CREDITS_FINISHED');op('TERMINATE_THIS_SCRIPT');
 const space=new Uint8Array(64);space.set(bytes,0);
 const host:ScmThreadHost={startScript(){},game,world:{fade(){}} as unknown as ScmWorldCommands};
 const thread=new ScmThread(space,0,0,undefined,host);
 thread.run(5000);
 expect(game.credits.going).toBe(true);expect(game.credits.startMs).toBe(5000);expect(thread.condition).toBe(false);
});
