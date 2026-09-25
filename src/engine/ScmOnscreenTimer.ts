/** COnscreenTimer (OnscreenTimer.cpp), with COnscreenTimerEntry and COnscreenCounterEntry: the mission clock and the
 * four counters CUserDisplay::OnscnTimer holds. Each entry names a script global by its byte offset in ScriptSpace
 * (the commands pass the variable itself, not its value), and reads or writes that variable directly. */

/** eTimerDirection. */
export const TIMER_INCREASE = 0, TIMER_DECREASE = 1;
/** eOnscreenCounter: a number, a bar, or a number over a number. */
export const COUNTER_SIMPLE = 0, COUNTER_LINE = 1, COUNTER_DOUBLE = 2;
import { HUD_COLOUR_LIGHT_BLUE, HUD_COLOUR_RED } from '../ui/nativeHudColours';
export { HUD_COLOUR_LIGHT_BLUE };

export interface OnscreenClock { varId: number; textKey: string; enabled: boolean; direction: number; beepCountdownSecs: number; displayed: string }
export interface OnscreenCounter { varId: number; maxVarValue: number; textKey: string; type: number; enabled: boolean; flashWhenFirstDisplayed: boolean; colourId: number; displayed: string }

const clockInit = (): OnscreenClock => ({ varId: 0, textKey: '', enabled: false, direction: TIMER_DECREASE, beepCountdownSecs: 12, displayed: '' });
const counterInit = (): OnscreenCounter => ({ varId: 0, maxVarValue: 0, textKey: '', type: COUNTER_SIMPLE, enabled: false, flashWhenFirstDisplayed: false, colourId: HUD_COLOUR_RED, displayed: '' });
/** m_szDescriptionTextKey is ten bytes, copied with strncpy_s. */
const key = (gxt?: string) => (gxt ?? '').slice(0, 9);

export class ScmOnscreenTimer {
  clock = clockInit();
  readonly counters = [counterInit(), counterInit(), counterInit(), counterInit()];
  /** m_bDisplay, set by ProcessForDisplay when anything is to be drawn. */
  display = false;
  /** m_bPaused (FREEZE_ONSCREEN_TIMER). */
  paused = false;
  /** COnscreenTimer::Init (0x44CBC0). */
  init() { this.clock = clockInit(); this.counters.forEach((_, i) => { this.counters[i] = counterInit(); }); this.paused = false; }
  /** AddClock (0x44CD50): only while no clock is running. */
  addClock(varId: number, gxt: string | undefined, direction: number) {
    if (this.clock.varId !== 0) return;
    this.clock.varId = varId; this.clock.direction = direction; this.clock.textKey = key(gxt);
  }
  /** ClearClock (0x44CE60): only the clock on that variable. The beep countdown is kept. */
  clearClock(varId: number) {
    if (this.clock.varId !== varId) return;
    this.clock.varId = 0; this.clock.textKey = ''; this.clock.enabled = false; this.clock.direction = TIMER_DECREASE;
  }
  /** SetClockBeepCountdownSecs (0x44CEE0). */
  setClockBeepCountdownSecs(varId: number, seconds: number) { if (this.clock.varId === varId) this.clock.beepCountdownSecs = seconds >>> 0; }
  /** AddCounter (0x44CDA0): into its slot if that slot is free, light blue and flashing when first displayed. */
  addCounter(varId: number, type: number, gxt: string | undefined, index: number) {
    const counter = this.counters[index];
    if (!counter || counter.varId !== 0) return;
    counter.varId = varId; counter.textKey = key(gxt); counter.maxVarValue = 0; counter.type = type;
    counter.flashWhenFirstDisplayed = true; counter.colourId = HUD_COLOUR_LIGHT_BLUE;
  }
  /** ClearCounter (0x44CE80) and COnscreenCounterEntry::Clear: every slot on that variable. */
  clearCounter(varId: number) {
    for (const counter of this.counters) if (counter.varId === varId) { counter.varId = 0; counter.maxVarValue = 0; counter.type = COUNTER_SIMPLE; counter.enabled = false; counter.textKey = ''; }
  }
  /** SetCounterFlashWhenFirstDisplayed (0x44CEB0). */
  setCounterFlashWhenFirstDisplayed(varId: number, flash: boolean) { for (const counter of this.counters) if (counter.varId === varId) counter.flashWhenFirstDisplayed = flash; }
  /** COnscreenTimer::Process (0x44CD30) and COnscreenTimerEntry::Process (0x44CB10), once a game frame from
   * CUserDisplay::Process. The clock variable moves by the frame's whole milliseconds; a countdown under its beep
   * seconds reports AE_FRONTEND_TIMER_COUNT unless the widescreen borders are up, and one that runs out ends at 0 and
   * frees the clock. */
  process(globals: DataView, timeStepMs: number, widescreen: boolean, beep: () => void) {
    if (this.paused) return;
    const clock = this.clock;
    if (clock.varId === 0 || clock.varId + 4 > globals.byteLength) return;
    const delta = Math.trunc(timeStepMs) >>> 0;
    let value = globals.getInt32(clock.varId, true);
    if (clock.direction === TIMER_INCREASE) { globals.setInt32(clock.varId, (value + delta) | 0, true); return; }
    // int32 -= uint32 wraps the same way in the original.
    value = (value - delta) | 0;
    globals.setInt32(clock.varId, value, true);
    if (value >= 0) {
      if (Math.trunc(value / 1000) < clock.beepCountdownSecs && !widescreen) beep();
    } else {
      globals.setInt32(clock.varId, 0, true);
      clock.varId = 0; clock.textKey = ''; clock.enabled = false;
    }
  }
  /** COnscreenTimer::ProcessForDisplay (0x44CC20) with ProcessForDisplayClock (0x44CA40) and ProcessForDisplayCounter
   * (0x44CA90), when the HUD wants to draw: the clock as "%02d:%02d" of minutes (mod 100) and seconds, a counter as
   * "%d" (clamped at 0) or "%d / %d". */
  processForDisplay(globals: DataView) {
    this.display = false; this.clock.enabled = false;
    const read = (varId: number) => varId + 4 <= globals.byteLength ? globals.getInt32(varId, true) : 0;
    const pad = (n: number) => String(n).padStart(2, '0');
    if (this.clock.varId !== 0) {
      const time = read(this.clock.varId), ms = Math.trunc(time / 1000);
      this.clock.displayed = `${pad(Math.trunc(ms / 60) % 100)}:${pad(ms % 60)}`;
      this.clock.enabled = true; this.display = true;
    }
    for (const counter of this.counters) {
      counter.enabled = false;
      if (counter.varId === 0) continue;
      const raw = read(counter.varId), shown = Math.max(0, raw);
      counter.displayed = counter.type === COUNTER_DOUBLE ? `${shown} / ${raw}` : String(shown);
      counter.enabled = true; this.display = true;
    }
  }
}
