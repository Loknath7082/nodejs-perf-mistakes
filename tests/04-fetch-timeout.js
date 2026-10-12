// Claim: clearing the timer as soon as fetch() resolves leaves the body unprotected.
// Server sends headers + the first bytes immediately, then stalls the rest of the body for 3 s.
const http = require('node:http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.write('start-of-body ');
  setTimeout(() => res.end('end-of-body'), 3000);
});

async function leaky(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const res = await fetch(url, { signal: controller.signal });
  clearTimeout(timer); // <- the trap
  return res.text();
}
async function builtin(url, ms) {
  const res = await fetch(url, { signal: AbortSignal.timeout(ms) });
  return res.text();
}
async function manualFixed(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try { const res = await fetch(url, { signal: controller.signal }); return await res.text(); }
  finally { clearTimeout(timer); }
}

async function run(name, fn, url) {
  const t = performance.now();
  try { await fn(url, 1000); console.log(`${name.padEnd(28)} finished  after ${((performance.now() - t) / 1000).toFixed(2)} s (no timeout applied)`); }
  catch (e) { console.log(`${name.padEnd(28)} aborted   after ${((performance.now() - t) / 1000).toFixed(2)} s (${e.name})`); }
}

server.listen(0, async () => {
  const url = `http://127.0.0.1:${server.address().port}/`;
  await run('manual, timer cleared early', leaky, url);
  await run('AbortSignal.timeout(1000)', builtin, url);
  await run('manual, cleared in finally', manualFixed, url);
  server.close();
});
