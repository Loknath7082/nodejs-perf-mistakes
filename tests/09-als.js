// AsyncLocalStorage: two concurrent requests each see their own request id.
const http = require('node:http');
const { AsyncLocalStorage } = require('node:async_hooks');
const crypto = require('node:crypto');
const als = new AsyncLocalStorage();
const logs = [];
const log = (m) => logs.push(`[${als.getStore()?.requestId}] ${m}`);

const server = http.createServer((req, res) => {
  const incoming = req.headers['x-request-id'];
  const requestId = typeof incoming === 'string' && /^[\w.-]{1,64}$/.test(incoming) ? incoming : crypto.randomUUID();
  als.run({ requestId }, async () => {
    log('start'); await new Promise((r) => setTimeout(r, 20 + Math.random() * 30)); log('end'); res.end(requestId);
  });
});
server.listen(0, async () => {
  const port = server.address().port;
  const hit = (id) => fetch(`http://127.0.0.1:${port}/`, { headers: { 'x-request-id': id } }).then((r) => r.text());
  await Promise.all([hit('req-A'), hit('req-B'), hit('bad id with spaces\tand tab')]);
  console.log(logs.sort().join('\n'));
  server.close();
});
