type Motion = { x: number; z: number };
/** Integrates a linear velocity blend over each tick, including its completion boundary. */
export class MotionTransition {
  private elapsed: number;
  private from: Motion = {x:0,z:0};
  private velocity: Motion = {x:0,z:0};
  constructor(private duration: number) {
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('Motion transition duration must be positive.');
    this.elapsed = duration;
  }
  begin() { this.from = {...this.velocity}; this.elapsed = 0; }
  reset() { this.velocity = this.from = {x:0,z:0}; this.elapsed = this.duration; }
  advance(target: Motion, dt: number): Motion {
    if (!Number.isFinite(dt) || dt <= 0 || !Number.isFinite(target.x) || !Number.isFinite(target.z)) throw new Error('Motion transition requires finite displacement and positive time.');
    if (this.elapsed >= this.duration) { this.velocity = {x:target.x/dt,z:target.z/dt}; return {...target}; }
    const integral = (t: number) => t < this.duration ? t*t/(2*this.duration) : t-this.duration/2;
    const end = this.elapsed+dt;
    const weight = Math.max(0,Math.min(1,(integral(end)-integral(this.elapsed))/dt));
    const endWeight = Math.min(1,end/this.duration);
    const result = {x:this.from.x*dt*(1-weight)+target.x*weight,z:this.from.z*dt*(1-weight)+target.z*weight};
    this.velocity = {x:this.from.x*(1-endWeight)+target.x/dt*endWeight,z:this.from.z*(1-endWeight)+target.z/dt*endWeight};
    this.elapsed = Math.min(end,this.duration);
    return result;
  }
}
