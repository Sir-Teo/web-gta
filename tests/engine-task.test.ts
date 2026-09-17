import { expect, test } from 'vitest';
import { TaskStack, EventQueue, type Task } from '../src/engine/task';

test('task stack runs, pops on done, preempts interruptible top', () => {
  interface Ctx { log: string[] }
  const ctx: Ctx = { log: [] };
  const stack = new TaskStack<Ctx>();
  const wander: Task<Ctx> = {
    name: 'wander',
    update: () => 'running',
  };
  const hit: Task<Ctx> = {
    name: 'hit',
    update: (c) => { c.log.push('hit'); return 'done'; },
  };
  stack.push(wander, ctx, 0);
  expect(stack.depth).toBe(1);
  expect(stack.preempt(hit, ctx, 0, 'EVENT_DAMAGE')).toBe(true);
  expect(stack.depth).toBe(2);
  expect(stack.update(ctx, 1 / 60, 0)).toBe('running');
  expect(ctx.log).toEqual(['hit']);
  expect(stack.current?.name).toBe('wander');
});

test('non-interruptible task blocks preemption', () => {
  interface Ctx { v: number }
  const ctx: Ctx = { v: 0 };
  const stack = new TaskStack<Ctx>();
  stack.push({ name: 'entry', interruptibleBy: () => false, update: () => 'running' }, ctx, 0);
  const ok = stack.preempt({ name: 'flee', update: () => 'done' }, ctx, 0, 'EVENT_GUNSHOT');
  expect(ok).toBe(false);
  expect(stack.current?.name).toBe('entry');
});

test('event queue drains in order', () => {
  const q = new EventQueue();
  q.emit('EVENT_DAMAGE', 1);
  q.emit('EVENT_GUNSHOT', 2);
  expect(q.pending).toBe(2);
  const out = q.drain();
  expect(out.map((e) => e.type)).toEqual(['EVENT_DAMAGE', 'EVENT_GUNSHOT']);
  expect(q.pending).toBe(0);
});
