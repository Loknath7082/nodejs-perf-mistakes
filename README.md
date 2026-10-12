# Tests behind "Why Your Node.js API Is Slow in Production: 10 Mistakes That Pass Code Review"

Every snippet marked **Tested** in the article is backed by a script in `tests/`.

## Run it

```bash
npm install
npm run test:all        # runs everything (about 1 minute)
node tests/04-fetch-timeout.js   # or one at a time
```

Requires Node.js 22 or newer. No database needed.

## What each script checks

| Script | Article section | What it checks |
|---|---|---|
| `01-event-loop-delay.js` | Measure first | `monitorEventLoopDelay()` raw values are nanoseconds and include the sampling resolution. p99 vs max with one 300 ms block in a 10 s window |
| `02-cache-stampede.js` | Mistake 7 | value-only cache vs promise cache, 100 concurrent callers |
| `03-promise-all.js` | Mistake 4 | three 200 ms calls, sequential vs `Promise.all` |
| `04-fetch-timeout.js` | Mistake 8 | timer cleared early vs `AbortSignal.timeout` vs manual timer cleared in `finally` |
| `05-cached.js` | Mistake 7 | `cached()` (see `cached.js`): de-dup, size cap, LRU, TTL from completion, failures not cached, hung calls (`pendingMs`) |
| `06-streaming.js` | Mistake 9 | `pipe()` vs `pipeline()` with a missing file, 5 MB stream, client disconnect |
| `07-json-stringify.js` | Mistakes 3 and 10 | `JSON.stringify` time by payload size and row width, and `fast-json-stringify` vs `JSON.stringify` |
| `08-event-loop-blocking.js` | Mistake 1 | latency of an unrelated `/fast` route while `pbkdf2Sync` vs `pbkdf2` runs |
| `09-als.js` | Bonus 1 | `AsyncLocalStorage` keeps request ids apart, and `x-request-id` validation |
| `10-express4-async.js` | Bonus 2 | Express 4 + async handler that throws |

## What is NOT tested here

- PostgreSQL and MongoDB snippets (N+1, indexes, pools, transactions) are illustrative. They need a real database.
- The AsyncLocalStorage overhead percentages come from Platformatic's published benchmark, not from these scripts.
- The Postgres memory-per-connection figures come from the sources linked in the article.

## Machine used for the numbers in the article

- Node.js v22.22.2, Linux x64
- Intel Xeon @ 2.10 GHz, 1 vCPU (a container). Absolute numbers will differ on your machine; the shape of the results should not.
- Each script was run once for the article; scripts 07 and 08 use the median of several runs.
