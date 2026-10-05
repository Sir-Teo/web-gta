import {expect,test} from 'vitest';
import {BOMB,activateBomb,bombDriverEntered,detonateStickyBomb,stepBombTimer} from '../src/vehicle/nativeCarBomb';
// CVehicle's bomb, as gta-reversed has ActivateBomb, ProcessDelayedExplosion, the ignition trigger and UseDetonator.
test('arming: a timed bomb starts 7 s, an ignition bomb waits for a driver, nothing else arms',()=>{
 const timed={bombOnBoard:BOMB.timed,bombTimerMs:0};expect(activateBomb(timed)).toBe(true);expect(timed).toEqual({bombOnBoard:BOMB.timedActivated,bombTimerMs:7000});
 // Pressed again: already armed, no second GA_12.
 expect(activateBomb(timed)).toBe(false);expect(timed.bombTimerMs).toBe(7000);
 const ignition={bombOnBoard:BOMB.ignition,bombTimerMs:0};expect(activateBomb(ignition)).toBe(true);expect(ignition).toEqual({bombOnBoard:BOMB.ignitionActivated,bombTimerMs:0});
 for(const state of [BOMB.none,BOMB.sticky,BOMB.ignitionActivated]){const car={bombOnBoard:state,bombTimerMs:0};expect(activateBomb(car)).toBe(false);expect(car.bombOnBoard).toBe(state);}
});
test('the timer runs 16 ms a 50 Hz frame (the step cut to whole ms), so 7 s take 438 frames',()=>{
 const car={bombOnBoard:BOMB.timedActivated,bombTimerMs:7000};let frames=0;
 while(!stepBombTimer(car,1))frames++;
 expect(frames+1).toBe(438);expect(car.bombTimerMs).toBe(0);
 // Run out, it stays out and says so once.
 expect(stepBombTimer(car,1)).toBe(false);
 // At 60 frames a second each step is 13 ms.
 const sixty={bombOnBoard:BOMB.timedActivated,bombTimerMs:26};expect(stepBombTimer(sixty,50/60)).toBe(false);expect(sixty.bombTimerMs).toBe(13);
});
test('a driver getting into an armed ignition bomb sets it off in a second; the detonator takes sticky bombs only',()=>{
 const armed={bombOnBoard:BOMB.ignitionActivated,bombTimerMs:0};expect(bombDriverEntered(armed)).toBe(true);expect(armed.bombTimerMs).toBe(1000);
 const unarmed={bombOnBoard:BOMB.ignition,bombTimerMs:0};expect(bombDriverEntered(unarmed)).toBe(false);expect(unarmed.bombTimerMs).toBe(0);
 const sticky={bombOnBoard:BOMB.sticky,bombTimerMs:0};expect(detonateStickyBomb(sticky)).toBe(true);expect(sticky).toEqual({bombOnBoard:BOMB.none,bombTimerMs:500});
 const timed={bombOnBoard:BOMB.timed,bombTimerMs:0};expect(detonateStickyBomb(timed)).toBe(false);expect(timed.bombOnBoard).toBe(BOMB.timed);
});
