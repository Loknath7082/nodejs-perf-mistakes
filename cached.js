// A small in-process cache: TTL counted from COMPLETION, in-flight de-duplication,
// LRU eviction with a size cap, failures never cached, and a limit on how long a
// pending (in-flight) call may be shared (pendingMs), so a call that never finishes
// cannot sit in the cache forever. Set pendingMs ABOVE the timeout of fn itself.
function cached(fn, ttlMs, { maxEntries = 1000, pendingMs = 30_000 } = {}) {
  const store = new Map(); // insertion order = least recently used first

  return (key) => {
    const now = Date.now();
    const hit = store.get(key);
    if (hit && hit.expires > now) {           // pending entries expire after pendingMs
      store.delete(key); store.set(key, hit); // touch: move to most-recently-used
      return hit.promise;
    }

    const entry = { promise: null, expires: now + pendingMs };
    // new Promise(...) also turns a synchronous throw from fn into a rejection
    entry.promise = new Promise((resolve) => resolve(fn(key))).then((value) => {
      entry.expires = Date.now() + ttlMs;     // the TTL starts when the call finishes
      return value;
    });

    store.delete(key);
    store.set(key, entry);
    if (store.size > maxEntries) store.delete(store.keys().next().value); // evict least recently used

    // never cache failures, and never delete a newer entry for the same key
    entry.promise.catch(() => { if (store.get(key) === entry) store.delete(key); });
    return entry.promise;
  };
}

module.exports = { cached };
