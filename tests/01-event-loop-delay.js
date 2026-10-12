// Claim: monitorEventLoopDelay() values are in nanoseconds AND include the sampling resolution.
// Part A: idle process. Part B: one deliberate 300 ms block inside a 10 s window.
const { monitorEventLoopDelay } = require('node:perf_hooks');

const RESOLUTION_MS = 20;
const toMs = (ns) => ns / 1e6;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const burn = (ms) => { const end = Date.now() + ms; while (Date.now() < end); };

async function window(label, ms, blockAtMs) {
  const h = monitorEventLoopDelay({ resolution: RESOLUTION_MS });
  h.enable();
  if (blockAtMs) setTimeout(() => burn(300), blockAtMs);
  await sleep(ms);
  h.disable();
  console.log(`\n[${label}] raw values straight from the histogram (nanoseconds):`);
  console.log(`  p99 = ${h.percentile(99)}   max = ${h.max}   mean = ${Math.round(h.mean)}`);
  console.log(`[${label}] converted: p99 = ${toMs(h.percentile(99)).toFixed(1)} ms, max = ${toMs(h.max).toFixed(1)} ms`);
  console.log(`[${label}] minus resolution: p99 ~ ${Math.max(0, toMs(h.percentile(99)) - RESOLUTION_MS).toFixed(1)} ms, max ~ ${Math.max(0, toMs(h.max) - RESOLUTION_MS).toFixed(1)} ms`);
  console.log(`[${label}] samples recorded: ${h.count}`);
}

(async () => {
  await window('A idle, 5 s window', 5000);
  await window('B 300 ms block, 10 s window', 10000, 3000);
})();
