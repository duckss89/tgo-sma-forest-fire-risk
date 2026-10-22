// Bộ sinh số ngẫu nhiên có hạt giống (seed) — để mọi lần chạy tái lập được.
// mulberry32: nhanh, chất lượng đủ tốt cho metaheuristic.

export function makeRng(seed = 42) {
  let a = seed >>> 0;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  let spare = null;
  // Box–Muller cho phân phối chuẩn tắc N(0,1)
  const gauss = () => {
    if (spare !== null) {
      const v = spare;
      spare = null;
      return v;
    }
    let u = 0;
    let v = 0;
    let s = 0;
    do {
      u = next() * 2 - 1;
      v = next() * 2 - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);
    const mul = Math.sqrt((-2 * Math.log(s)) / s);
    spare = v * mul;
    return u * mul;
  };

  return {
    next,
    gauss,
    // [lo, hi)
    uniform: (lo, hi) => lo + (hi - lo) * next(),
    // số nguyên [0, n)
    int: (n) => Math.floor(next() * n),
    // vector chuẩn tắc độ dài n
    gaussVec: (n) => Array.from({ length: n }, gauss),
    // k chỉ số phân biệt trong [0, n) — tương đương np.random.choice(n, k, replace=False)
    sample: (n, k) => {
      const idx = Array.from({ length: n }, (_, i) => i);
      for (let i = 0; i < k; i += 1) {
        const j = i + Math.floor(next() * (n - i));
        const tmp = idx[i];
        idx[i] = idx[j];
        idx[j] = tmp;
      }
      return idx.slice(0, k);
    },
    shuffle: (arr) => {
      for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
      }
      return arr;
    },
  };
}
