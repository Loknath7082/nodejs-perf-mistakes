// Claims about cached(): de-dup, size cap, LRU keeps hot keys, TTL starts at completion,
// failures are not cached, and a slow old failure does not evict a newer entry.
const assert = require('node:assert/strict');
const { cached } = require('../cached');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // 1. 100 concurrent calls, same key -> 1 underlying call
  let calls = 0;
  const get1 = cached(async (k) => { calls++; await sleep(50); return k; }, 5000);
  await Promise.all(Array.from({ length: 100 }, () => get1('a')));
  console.log(`de-dup       : 100 concurrent calls -> ${calls} underlying call(s)`);
  assert.equal(calls, 1);

  // 2. size cap: after 10,000 distinct keys only the last 100 are still cached
  const get2 = cached(async (k) => k, 60000, { maxEntries: 100 });
  for (let i = 0; i < 10000; i++) await get2('k' + i);
  let calls2 = 0;
  const probe = cached(async (k) => { calls2++; return k; }, 60000, { maxEntries: 100 });
  for (let i = 0; i < 10000; i++) await probe('k' + i);
  calls2 = 0;
  for (let i = 9900; i < 10000; i++) await probe('k' + i);   // last 100 keys: should all be hits
  for (let i = 0; i < 100; i++) await probe('k' + i);        // first 100 keys: should all be evicted (misses)
  console.log(`size cap     : last 100 keys cached, first 100 keys evicted -> ${calls2} new calls for the evicted ones (cap = 100)`);
  assert.equal(calls2, 100);

  // 3. LRU: a hot key survives, a cold key is evicted
  let loads = {};
  const get3 = cached(async (k) => { loads[k] = (loads[k] || 0) + 1; return k; }, 60000, { maxEntries: 3 });
  await get3('hot'); await get3('b'); await get3('c');
  await get3('hot');            // touch hot
  await get3('d');              // evicts the least recently used = 'b'
  await get3('hot'); await get3('b');
  console.log(`LRU          : hot loaded ${loads.hot}x, b loaded ${loads.b}x (expected hot=1, b=2)`);
  assert.equal(loads.hot, 1); assert.equal(loads.b, 2);

  // 4. TTL starts at completion: 600 ms call, 400 ms TTL -> still cached right after it finishes
  let slow = 0;
  const get4 = cached(async () => { slow++; await sleep(600); return 'x'; }, 400);
  await get4('s');
  await get4('s');
  console.log(`TTL from end : slow 600 ms call, 400 ms TTL, second call right after -> ${slow} underlying call(s) (expected 1)`);
  assert.equal(slow, 1);

  // 5. failures are not cached
  let tries = 0;
  const get5 = cached(async () => { tries++; if (tries === 1) throw new Error('boom'); return 'ok'; }, 5000);
  await get5('f').catch(() => {});
  const v = await get5('f');
  console.log(`failures     : second call after a failure -> '${v}' (tries = ${tries})`);
  assert.equal(v, 'ok');

  // 6. sync throw becomes a rejection
  const get6 = cached(() => { throw new Error('sync'); }, 5000);
  await assert.rejects(get6('z'), /sync/);
  console.log('sync throw   : turned into a rejected promise, not a crash');

  // 7. a slow old failure must not delete a NEWER entry for the same key
  let kCalls = 0;
  const get7 = cached(async (key) => {
    if (key === 'k' && ++kCalls === 1) { await sleep(300); throw new Error('old failure'); }
    return key + '-fresh';
  }, 60000, { maxEntries: 1 });      // cap of 1, so asking for 'other' evicts 'k'
  const old = get7('k'); old.catch(() => {});
  await get7('other');               // evicts the pending 'k'
  await get7('k');                   // creates a NEWER entry for 'k' (kCalls = 2)
  await old.catch(() => {});         // now the old call fails, after the newer entry exists
  await get7('k');                   // must still be a cache hit
  console.log(`slow failure : 'k' underlying calls = ${kCalls} (expected 2: the old failure did not evict the newer entry)`);
  assert.equal(kCalls, 2);
  // 8. a call that never finishes is not shared forever: after pendingMs a new call is started
  let hung = 0;
  const get8 = cached(async () => { hung++; if (hung === 1) return new Promise(() => {}); return 'recovered'; }, 60000, { pendingMs: 200 });
  get8('h');                         // first call hangs forever
  await sleep(300);                  // longer than pendingMs
  const r8 = await get8('h');
  console.log(`hung call    : after pendingMs a new call was started -> '${r8}' (underlying calls = ${hung})`);
  assert.equal(r8, 'recovered');
  console.log('\nall cached() checks passed');
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
