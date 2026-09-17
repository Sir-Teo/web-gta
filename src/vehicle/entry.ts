/** Vehicle entry FSM — Module 4 of the full-engine rewrite.
 *
 * Provenance: phase names follow gta-reversed `CTaskComplexEnterCarAsDriver`
 * / `CTaskComplexLeaveCar` (`approach/align/open/pullout/getIn/closeInside/
 * shuffle/seated/.../getOut/closeOutside/jumpOut/getUp`). Speed gate
 * `PLAYER_ENTER_SPEED = 0.2` mirrors `CCarEnterExit` 2D-speed units/frame
 * check; the 600 ms line-up mirrors `CTaskUtilityLineUpPedWithCar`. Pure
 * transition table — `CarEntry` keeps clip/render ownership.
 */
export type EntryPhase =
  | 'approach'
  | 'align'
  | 'open'
  | 'pullout'
  | 'getIn'
  | 'closeInside'
  | 'shuffle'
  | 'seated'
  | 'waitSlow'
  | 'getOut'
  | 'closeOutside'
  | 'jumpOut'
  | 'getUp';

export const PLAYER_ENTER_SPEED_LIMIT = 0.2;
export const LINE_UP_SECONDS = 0.6;
export const JUMP_OUT_SET_OUT = 0.07;
export const JUMP_OUT_CARRY = 0.45;

export interface EntryGuards {
  carSpeed2D: number;
  locked: boolean;
  doorBlocked: boolean;
  victimInside: boolean;
}

/** Whether a driver entry may start under native guards. */
export function canEnterCar(g: EntryGuards): 'ok' | 'too-fast' | 'locked' | 'blocked' {
  if (g.carSpeed2D > PLAYER_ENTER_SPEED_LIMIT) return 'too-fast';
  if (g.doorBlocked) return 'blocked';
  if (g.locked) return 'locked';
  return 'ok';
}

/** Next phase in the driver sequence; jacking inserts `pullout` after `open`. */
export function nextEntryPhase(phase: EntryPhase, victimInside: boolean): EntryPhase | undefined {
  switch (phase) {
    case 'approach': return 'align';
    case 'align': return 'open';
    case 'open': return victimInside ? 'pullout' : 'getIn';
    case 'pullout': return 'getIn';
    case 'getIn': return 'closeInside';
    case 'closeInside': return 'shuffle';
    case 'shuffle': return 'seated';
    case 'getOut': return 'closeOutside';
    case 'jumpOut': return 'getUp';
    default: return undefined;
  }
}

/** Exit variant: slow cars step out, fast cars jump out and roll. */
export function exitPhaseForSpeed(carSpeed2D: number): 'getOut' | 'jumpOut' {
  return carSpeed2D > PLAYER_ENTER_SPEED_LIMIT ? 'jumpOut' : 'getOut';
}
