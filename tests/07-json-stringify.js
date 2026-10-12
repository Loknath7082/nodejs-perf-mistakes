// How long does JSON.stringify block the event loop, by payload size? Also: wide rows vs narrow rows.
let fjs; try { fjs = require('fast-json-stringify'); } catch { /* optional */ }

function rows(n, wide) {
  return Array.from({ length: n }, (_, i) => {
    const o = { id: i, username: 'user' + i, profile_image_url: 'https://cdn.example.com/u/' + i + '.jpg', created_at: '2026-01-01T00:00:00Z' };
    if (wide) for (let c = 0; c < 26; c++) o['column_' + c] = 'some value ' + c + ' for row ' + i;
    return o;
  });
}
function time(fn, runs = 5) {
  const t = []; let out;
  for (let i = 0; i < runs; i++) { const s = performance.now(); out = fn(); t.push(performance.now() - s); }
  t.sort((a, b) => a - b);
  return { ms: t[Math.floor(t.length / 2)], out };
}

console.log('JSON.stringify, median of 5 runs (this blocks the event loop for the whole duration)\n');
console.log('rows      shape    payload     stringify');
for (const n of [100, 1000, 10000, 100000]) {
  for (const wide of [false, true]) {
    const data = rows(n, wide);
    const { ms, out } = time(() => JSON.stringify(data), n >= 100000 ? 3 : 5);
    console.log(`${String(n).padEnd(9)} ${(wide ? 'wide-30' : 'narrow-4').padEnd(8)} ${(out.length / 1e6).toFixed(2).padStart(7)} MB  ${ms.toFixed(1).padStart(8)} ms`);
  }
}

if (fjs) {
  console.log('\nfast-json-stringify vs JSON.stringify on narrow-4 rows (same data, schema-based serializer)');
  const schema = { type: 'array', items: { type: 'object', properties: { id: { type: 'integer' }, username: { type: 'string' }, profile_image_url: { type: 'string' }, created_at: { type: 'string' } } } };
  const stringify = fjs(schema);
  for (const n of [10, 100, 1000, 10000, 100000]) {
    const data = rows(n, false);
    const a = time(() => JSON.stringify(data), 15).ms;
    const b = time(() => stringify(data), 15).ms;
    console.log(`${String(n).padEnd(8)} rows: JSON.stringify ${a.toFixed(3).padStart(9)} ms | fast-json-stringify ${b.toFixed(3).padStart(9)} ms`);
  }
}
