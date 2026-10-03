import {expect,test} from 'vitest';
import {resumeAfterInterruption,useAmbientAudioSession} from '../src/audio/audioSession';

test('the audio session is the port\'s Ambient where the browser names it',()=>{
 const nav={audioSession:{type:'auto'}};expect(useAmbientAudioSession(nav)).toBe(true);expect(nav.audioSession.type).toBe('ambient');
 expect(useAmbientAudioSession({})).toBe(false);
 const locked={audioSession:Object.defineProperty({},'type',{get:()=>'auto',set:()=>{throw new TypeError('read-only');}}) as {type:string}};
 expect(useAmbientAudioSession(locked)).toBe(false);
});

/** A context whose state the test sets, as the browser would, with its statechange. */
class FakeContext extends EventTarget {
 state='running';
 to(state:string){this.state=state;this.dispatchEvent(new Event('statechange'));}
}
test('a context a call suspends mid-game starts again at the next touch, and not while paused',()=>{
 const context=new FakeContext(),page=new EventTarget(),resumed:string[]=[];let playing=true;
 const recovery=resumeAfterInterruption(context,()=>playing,()=>{resumed.push(context.state);context.to('running');},page);
 // A call: the browser holds the context; the sound comes back with the next lifted finger, once.
 context.to('interrupted');expect(recovery.armed).toBe(true);
 page.dispatchEvent(new Event('touchend'));expect(resumed).toEqual(['interrupted']);expect(recovery.armed).toBe(false);
 page.dispatchEvent(new Event('touchend'));expect(resumed).toHaveLength(1);
 // The interruption over, the browser started it again itself: nothing waits on a touch.
 context.to('suspended');expect(recovery.armed).toBe(true);context.to('running');expect(recovery.armed).toBe(false);
 page.dispatchEvent(new Event('keydown'));expect(resumed).toHaveLength(1);
 // The game's own pause suspends it: no touch resumes it.
 playing=false;context.to('suspended');expect(recovery.armed).toBe(false);page.dispatchEvent(new Event('pointerup'));expect(resumed).toHaveLength(1);
 // Play again where the resume is held back (no gesture behind it): the next key starts it.
 playing=true;recovery.check();expect(recovery.armed).toBe(true);page.dispatchEvent(new Event('keydown'));expect(resumed).toEqual(['interrupted','suspended']);
 // Paused after arming, the gesture does nothing; disposed, nothing listens.
 context.to('suspended');playing=false;page.dispatchEvent(new Event('mousedown'));expect(resumed).toHaveLength(2);
 playing=true;context.to('interrupted');recovery.dispose();page.dispatchEvent(new Event('touchend'));expect(resumed).toHaveLength(2);
 context.to('suspended');expect(recovery.armed).toBe(false);
});
