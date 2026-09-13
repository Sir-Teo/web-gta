/** Render cadence never becomes simulation delta; discard hidden-tab time. */
export class FixedClock {
  readonly step = 1 / 60;
  private accumulator = 0;
  tick = 0;
  advance(elapsed: number, simulate: (dt: number) => void): number {
    this.accumulator += Math.max(0, Math.min(elapsed, 0.1));
    let steps = 0;
    while (this.accumulator + 1e-10 >= this.step && steps < 6) {
      simulate(this.step);
      this.accumulator -= this.step;
      this.tick++; steps++;
    }
    return Math.max(0, this.accumulator / this.step);
  }
  reset() { this.accumulator = 0; }
}
