/** The iOS port's audio session is AVAudioSessionCategoryAmbient (set at launch beside AudioSessionInitialize, and again
 * as each interruption ends): the ring/silent switch mutes the game and other audio may play under it. WebKit maps Web
 * Audio to that category by default; navigator.audioSession (Safari 16.4 and later) names it, so it stays so. */
export function useAmbientAudioSession(nav: { audioSession?: { type: string } }) {
  try { if (!nav.audioSession) return false; nav.audioSession.type = 'ambient'; return true; } catch { return false; }
}

/** What a phone's browser takes as a gesture that may start sound: a lifted finger, a click, a key. */
const GESTURES = ['touchend', 'pointerup', 'mousedown', 'keydown'] as const;
type Context = { readonly state: string; addEventListener(type: 'statechange', listener: () => void): void; removeEventListener(type: 'statechange', listener: () => void): void };

/** The port's interruption listener lets go of the OpenAL context when an interruption begins and, when it ends, sets
 * the category, reactivates the session and makes the context current again: the sound comes back by itself. A phone's
 * browser suspends the context for a call, Siri, an alarm or another app's audio and does not always start it again,
 * nor lets a page do so outside a gesture: while the game wants sound and the context is not running, the next touch or
 * key resumes it. */
export function resumeAfterInterruption(context: Context, wanted: () => boolean, resume: () => void, target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>) {
  let armed = false;
  const gesture = () => { disarm(); if (wanted() && context.state !== 'running' && context.state !== 'closed') resume(); };
  const arm = () => { if (armed) return; armed = true; for (const type of GESTURES) target.addEventListener(type, gesture, { capture: true, passive: true }); };
  const disarm = () => { if (!armed) return; armed = false; for (const type of GESTURES) target.removeEventListener(type, gesture, { capture: true }); };
  /** Arms the next gesture when the context is held up while the game wants sound, and lets go once it runs. */
  const check = () => { if (context.state === 'running' || context.state === 'closed' || !wanted()) disarm(); else arm(); };
  context.addEventListener('statechange', check);
  return { check, get armed() { return armed; }, dispose() { disarm(); context.removeEventListener('statechange', check); } };
}
