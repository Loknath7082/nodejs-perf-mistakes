// Mistake 1: a synchronous call inside a handler delays EVERY request, not just its own.
// The server runs in a CHILD process so the load generator is not blocked together with it.
const http = require('node:http');
const { spawn } = require('node:child_process');

const serverCode = `
  const http = require('node:http'); const crypto = require('node:crypto');
  http.createServer((req, res) => {
    if (req.url === '/slow-sync') { crypto.pbkdf2Sync('password', 'salt', 400000, 64, 'sha512'); return res.end('done'); }
    if (req.url === '/slow-async') return crypto.pbkdf2('password', 'salt', 400000, 64, 'sha512', () => res.end('done'));
    res.end('ok');
  }).listen(0, function () { console.log('PORT ' + this.address().port); });
`;

const child = spawn(process.execPath, ['-e', serverCode]);
const agent = new http.Agent({ keepAlive: true, maxSockets: 100 });
const get = (port, path) => new Promise((resolve) => {
  const t = performance.now();
  http.get({ port, path, agent }, (r) => { r.resume(); r.on('end', () => resolve(performance.now() - t)); });
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function scenario(port, slowPath) {
  const alone = await get(port, slowPath);                 // slow call by itself
  const slow = get(port, slowPath);                        // start it again...
  await wait(20);                                          // ...let it begin
  const fast = [];
  for (let i = 0; i < 20; i++) { fast.push(get(port, '/fast')); await wait(5); }
  await slow;
  const lat = (await Promise.all(fast)).sort((a, b) => a - b);
  return { alone, p50: lat[10], max: lat[19] };
}

let buf = '';
child.stdout.on('data', async (d) => {
  buf += d; const m = buf.match(/PORT (\d+)/); if (!m) return; child.stdout.removeAllListeners('data');
  const port = Number(m[1]);
  await get(port, '/fast'); await get(port, '/fast');      // warm up
  const a = await scenario(port, '/slow-sync');
  console.log(`pbkdf2Sync : the slow call takes ${a.alone.toFixed(0)} ms alone. /fast requests sent while it runs: median ${a.p50.toFixed(0)} ms, worst ${a.max.toFixed(0)} ms`);
  const b = await scenario(port, '/slow-async');
  console.log(`pbkdf2     : the slow call takes ${b.alone.toFixed(0)} ms alone. /fast requests sent while it runs: median ${b.p50.toFixed(1)} ms, worst ${b.max.toFixed(1)} ms`);
  agent.destroy(); child.kill();
});
