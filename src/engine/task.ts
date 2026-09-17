/** Engine task core — clean-room port scaffold.
 *
 * Reference ladder (see docs/research/SOURCES.md):
 * - Behavior shape follows gta-reversed `CTask` / `CTaskComplex` /
 *   `CTaskSimple` hierarchy (task stack, primary vs secondary tasks,
 *   `MakeAbortable`, `CreateNextSubTask` polling) at pinned revision
 *   `0076f9017b4aeef7433957ac2bd8b6988e9df166`.
 * - No retail code is copied: names and timing constants that are still
 *   executable-calls upstream (e.g. `CTaskSimpleFight`, `CalculateNewVelocity`)
 *   stay marked `authored` at the call site.
 * - Data tables (melee.dat, pedstats.dat) come from
 *   `scripts/content/world-sources.json`, not from the executable.
 *
 * Module 0 of the full-engine rewrite. Pure logic, no Three/Rapier imports,
 * so it stays unit-testable. World classes adopt it incrementally; legacy
 * fields (`retaliate`, `flee`, `down` timers in WorldPedestrians) remain the
 * authority until each Brain task lands.
 */

/** What a task reports after its slice. Mirrors CTask return semantics. */
export type TaskStatus = 'running' | 'done' | 'failed';

/** Minimal event envelope exchanged between brains (CEventDamage etc). */
export interface BrainEvent {
  type: string;
  at: number;
  payload?: unknown;
}

/** Single task in a ped/vehicle brain stack. */
export interface Task<TCtx> {
  readonly name: string;
  /** Lower number = higher priority, mirrors abort priority upstream. */
  readonly priority?: number;
  enter?(ctx: TCtx, now: number): void;
  /** Advance by dt seconds; return done/failed to pop. */
  update(ctx: TCtx, dt: number, now: number): TaskStatus;
  exit?(ctx: TCtx, now: number): void;
  /** Whether this task may be interrupted by an event of the given type. */
  interruptibleBy?(type: string): boolean;
}

/** LIFO stack with a single primary task, matching CTaskManager layout. */
export class TaskStack<TCtx> {
  private stack: Task<TCtx>[] = [];
  private entered = new Set<Task<TCtx>>();

  get current(): Task<TCtx> | undefined {
    return this.stack[this.stack.length - 1];
  }
  get depth(): number {
    return this.stack.length;
  }
  push(task: Task<TCtx>, ctx: TCtx, now: number): void {
    this.stack.push(task);
    task.enter?.(ctx, now);
    this.entered.add(task);
  }
  pop(ctx: TCtx, now: number): Task<TCtx> | undefined {
    const task = this.stack.pop();
    if (task && this.entered.has(task)) {
      task.exit?.(ctx, now);
      this.entered.delete(task);
    }
    return task;
  }
  clear(ctx: TCtx, now: number): void {
    while (this.stack.length) this.pop(ctx, now);
  }
  /** Push, suspending the top task if it allows interruption. Blocked if not. */
  preempt(task: Task<TCtx>, ctx: TCtx, now: number, eventType: string): boolean {
    const top = this.current;
    if (top?.interruptibleBy && !top.interruptibleBy(eventType)) return false;
    this.push(task, ctx, now);
    return true;
  }
  update(ctx: TCtx, dt: number, now: number): TaskStatus {
    const task = this.current;
    if (!task) return 'done';
    const status = task.update(ctx, dt, now);
    if (status !== 'running') this.pop(ctx, now);
    return this.current ? 'running' : status;
  }
}

/** Tiny per-frame event queue; brains drain it before task updates. */
export class EventQueue {
  private events: BrainEvent[] = [];
  emit(type: string, at: number, payload?: unknown): void {
    this.events.push({ type, at, payload });
  }
  drain(): BrainEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }
  get pending(): number {
    return this.events.length;
  }
}
