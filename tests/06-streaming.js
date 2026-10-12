// Claims about pipe() vs pipeline() and about client disconnects.
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pipeline } = require('node:stream/promises');

const big = path.join(os.tmpdir(), 'five-mb.bin');
fs.writeFileSync(big, Buffer.alloc(5 * 1024 * 1024, 1));

// Part A: pipe() with a missing file, run in a child process so a crash does not kill this test
const child = spawnSync(process.execPath, ['-e', `
  const http = require('http'); const fs = require('fs');
  const s = http.createServer((req, res) => fs.createReadStream('./does-not-exist.zip').pipe(res));
  s.listen(0, () => { fetch('http://127.0.0.1:' + s.address().port).catch(() => {}); });
  setTimeout(() => { console.log('server still alive after 1.5 s'); process.exit(0); }, 1500);
`], { encoding: 'utf8' });
const crashed = child.status !== 0;
console.log(`pipe() + missing file : process ${crashed ? 'CRASHED' : 'survived'} (exit ${child.status})`);
if (crashed) console.log('  stderr first line: ' + (child.stderr.split('\n').find((l) => l.includes('ENOENT')) || child.stderr.split('\n')[0]));

// Part B: pipeline() version
let disconnectCode = null;
const server = http.createServer(async (req, res) => {
  const target = req.url === '/missing' ? './does-not-exist.zip' : big;
  try {
    await fs.promises.stat(target);
    res.setHeader('Content-Type', 'application/octet-stream');
    await pipeline(fs.createReadStream(target), res);
  } catch (err) {
    if (res.headersSent) { disconnectCode = err.code; return; }
    if (err.code === 'ENOENT') { res.statusCode = 404; return res.end('not found'); }
    res.statusCode = 500; res.end('error');
  }
});

server.listen(0, async () => {
  const base = `http://127.0.0.1:${server.address().port}`;
  const miss = await fetch(base + '/missing');
  console.log(`pipeline() + missing   : HTTP ${miss.status}`);

  const full = await fetch(base + '/big');
  const buf = await full.arrayBuffer();
  console.log(`pipeline() + 5 MB file : HTTP ${full.status}, received ${buf.byteLength} bytes`);

  // client disconnect mid-download
  const ac = new AbortController();
  const r = await fetch(base + '/big', { signal: ac.signal });
  const reader = r.body.getReader();
  await reader.read();
  ac.abort();
  await new Promise((res) => setTimeout(res, 300));
  console.log(`client disconnect      : pipeline() rejected with ${disconnectCode}`);
  server.close();
});
