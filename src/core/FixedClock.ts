/** Render cadence never becomes simulation delta; discard hidden-tab time. */
export class FixedClock {
  readonly step = 1 / 60;
  private accumulator = 0;
  tick = 0;
  /** `maxElapsed`: the most a frame may advance the simulation (s); a slower frame plays in slow motion instead of
   * catching up. */
  constructor(public maxElapsed = 0.1) {}
  advance(elapsed: number, simulate: (dt: number) => void): number {
    this.accumulator += Math.max(0, Math.min(elapsed, this.maxElapsed));
    const maxSteps = Math.ceil(this.maxElapsed / this.step - 1e-9);
    let steps = 0;
    while (this.accumulator + 1e-10 >= this.step && steps < maxSteps) {
      simulate(this.step);
      this.accumulator -= this.step;
      this.tick++; steps++;
    }
    // A whole step or more left over is only possible after a step threw out of a frame (its time was added and never
    // stepped), piling up for as long as the throwing lasted. It is dropped rather than carried: carried, it would be
    // returned as an interpolation fraction over one for frames afterwards, and the renderers refuse one.
    if (this.accumulator + 1e-10 >= this.step) this.accumulator = 0;
    return Math.max(0, this.accumulator / this.step);
  }
  reset() { this.accumulator = 0; }
}
/** CTimer::Update holds ms_fTimeStep to 3 frames at 50 a second: a frame the device drew slower than that plays the
 * world slower rather than stepping it further. A phone that falls behind with six 60 Hz steps a frame (the browser's
 * default 0.1 s) takes longer over each frame, which takes more steps: in a car, whose steps and drawing cost more than
 * on foot, it fell to a few frames a second. */
export const NATIVE_MAX_FRAME_SECONDS = 3 / 50;
