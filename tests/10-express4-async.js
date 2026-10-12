// Bonus 2: in Express 4, a rejected promise from an async handler is NOT passed to the error handler.
// On modern Node, an unhandled rejection also terminates the process by default.
const { spawn } = require('node:child_process');
const path = require('node:path');

const serverCode = `
  const express = require('express');
  const app = express();
  app.get('/boom', async (req, res) => { throw new Error('async failure'); });
  app.use((err, req, res, next) => { res.status(500).send('handled by error middleware'); });
  const s = app.listen(0, () => console.log('PORT ' + s.address().port));
`;

const child = spawn(process.execPath, ['-e', serverCode], { cwd: path.join(__dirname, '..') });
let out = '', err = '';
child.stdout.on('data', (d) => { out += d; });
child.stderr.on('data', (d) => { err += d; });
let exited = null;
child.on('exit', (code) => { exited = code; });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  for (let i = 0; i < 50 && !out.includes('PORT'); i++) await wait(100);
  const port = out.match(/PORT (\d+)/)?.[1];
  if (!port) { console.log('server did not start:', err); return process.exit(1); }
  const started = performance.now();
  let result;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/boom`, { signal: AbortSignal.timeout(2000) });
    result = `HTTP ${r.status}`;
  } catch (e) { result = `no response (${e.name})`; }
  await wait(300);
  console.log(`Express 4 + async handler that throws -> client saw: ${result} after ${((performance.now() - started) / 1000).toFixed(1)} s`);
  console.log(`server process: ${exited === null ? 'still running (request just hangs)' : 'EXITED with code ' + exited}`);
  if (exited !== null) console.log('stderr: ' + (err.split('\n').find((l) => l.includes('async failure')) || err.split('\n')[0]));
  child.kill();
})();
