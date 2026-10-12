const { spawnSync } = require('node:child_process');
const fs = require('node:fs'); const path = require('node:path');
console.log(`Node ${process.version} on ${process.platform}/${process.arch}\n`);
for (const f of fs.readdirSync(__dirname).filter((n) => /^\d\d-.*\.js$/.test(n)).sort()) {
  console.log(`\n=== ${f} ===`);
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  if (r.status !== 0) console.log(`(exit code ${r.status})`);
}
