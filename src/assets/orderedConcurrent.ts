/** Overlap I/O while consuming results in source order. The window also bounds
 * decoded results waiting for scene memory/geometry validation. */
export async function* orderedConcurrent<T, R>(items: Iterable<T>, load: (item: T) => Promise<R>, concurrency = 4): AsyncGenerator<R> {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16) throw new Error('Invalid loading concurrency.');
  const iterator = items[Symbol.iterator]();
  type Result = {ok: true; value: R} | {ok: false; error: unknown};
  const pending: Promise<Result>[] = [];
  const enqueue = () => {
    const next = iterator.next();
    if (next.done) return;
    pending.push(Promise.resolve().then(() => load(next.value)).then(value => ({ok: true as const, value}), error => ({ok: false as const, error})));
  };
  for (let i = 0; i < concurrency; i++) enqueue();
  try {
    while (pending.length) {
      const result = await pending.shift()!;
      if (!result.ok) throw result.error;
      yield result.value;
      enqueue();
    }
  } finally {
    // Settle started work on an invalid asset or an early consumer exit.
    await Promise.all(pending);
    iterator.return?.();
  }
}
