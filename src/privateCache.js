// Testable owner/generation barrier shared by metadata and media requests.
export function createPrivateCache(store) {
  let owner = null, generation = 0, barrier = Promise.resolve();
  const pending = new Map();
  const token = () => ({ owner, generation });
  const valid = ticket => ticket.owner === owner && ticket.generation === generation;
  const assert = ticket => { if (!valid(ticket)) throw new Error('Journal request superseded by a newer change.'); };
  return {
    token, valid, assert,
    async activate(next) {
      if (next === owner) { await barrier; return; }
      const previous = owner;
      owner = next; generation += 1; pending.clear();
      barrier = barrier.then(() => previous ? store.clear(previous) : undefined);
      await barrier;
    },
    async invalidate(predicate = () => false) {
      generation += 1; pending.clear();
      const user = owner;
      barrier = barrier.then(() => user ? store.evict(user, predicate) : undefined);
      await barrier;
    },
    async get(key, fetchValue, { refresh = false } = {}) {
      const ticket = token();
      if (!ticket.owner) throw new Error('Sign in before reading private journal data.');
      await barrier; assert(ticket);
      if (!refresh) {
        const value = await store.read(key);
        assert(ticket);
        if (value !== undefined) return value;
      }
      const pendingKey = `${ticket.owner}:${ticket.generation}:${key}`;
      if (pending.has(pendingKey)) return pending.get(pendingKey);
      const task = (async () => {
        const value = await fetchValue(ticket);
        assert(ticket);
        // A null/failed media response must be rejected by fetchValue, not saved.
        await store.write(key, value, () => valid(ticket));
        assert(ticket);
        return value;
      })().finally(() => pending.delete(pendingKey));
      pending.set(pendingKey, task);
      return task;
    },
    async read(key) { const ticket = token(); await barrier; assert(ticket); const value = await store.read(key); assert(ticket); return value; },
  };
}
