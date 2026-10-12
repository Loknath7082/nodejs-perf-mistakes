// Claim: caching only the parsed VALUE after await lets every concurrent caller read the file
// (cache stampede). Caching the PROMISE reads it once.
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const file = path.join(os.tmpdir(), 'flags-test.json');
let reads = 0;
const realReadFile = fs.readFile;
fs.readFile = async (...args) => { reads++; return realReadFile(...args); };

let valueCache = null;
async function loadValueOnly() {
  if (valueCache) return valueCache;
  valueCache = JSON.parse(await fs.readFile(file, 'utf8')); // cache is set only AFTER the await
  return valueCache;
}

let promiseCache = null;
function loadPromise() {
  if (!promiseCache) {
    const p = fs.readFile(file, 'utf8').then(JSON.parse).catch((e) => { if (promiseCache === p) promiseCache = null; throw e; });
    promiseCache = p;
  }
  return promiseCache;
}

(async () => {
  await fs.writeFile(file, JSON.stringify({ newCheckout: true }));
  reads = 0; await Promise.all(Array.from({ length: 100 }, loadValueOnly));
  console.log(`value-only cache : 100 concurrent callers -> ${reads} file reads`);
  reads = 0; await Promise.all(Array.from({ length: 100 }, loadPromise));
  console.log(`promise cache    : 100 concurrent callers -> ${reads} file read(s)`);
})();
