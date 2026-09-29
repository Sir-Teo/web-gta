import {expect,test,vi} from 'vitest';
import {stallGuard} from '../src/assets/staticWorldArchive';
test('a world download is abandoned once it receives nothing for the stall time, and progress keeps it alive',()=>{
 vi.useFakeTimers();
 try{
  const guard=stallGuard(undefined,1000);
  vi.advanceTimersByTime(900);guard.alive();vi.advanceTimersByTime(900);expect(guard.signal.aborted).toBe(false);
  vi.advanceTimersByTime(200);expect(guard.signal.aborted).toBe(true);expect(String(guard.signal.reason)).toMatch(/stalled/);
  const caller=new AbortController(),linked=stallGuard(caller.signal,1000);caller.abort(new Error('left'));expect(linked.signal.aborted).toBe(true);
  const finished=stallGuard(undefined,1000);finished.done();vi.advanceTimersByTime(5000);expect(finished.signal.aborted).toBe(false);
 }finally{vi.useRealTimers();}
});
