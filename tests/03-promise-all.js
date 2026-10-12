// Claim: three independent 200 ms calls take ~600 ms in sequence and ~200 ms with Promise.all.
const call = (name) => new Promise((r) => setTimeout(() => r(name), 200));
(async () => {
  let t = performance.now();
  await call('user'); await call('orders'); await call('prefs');
  console.log(`sequential : ${(performance.now() - t).toFixed(0)} ms`);
  t = performance.now();
  await Promise.all([call('user'), call('orders'), call('prefs')]);
  console.log(`Promise.all: ${(performance.now() - t).toFixed(0)} ms`);
})();
