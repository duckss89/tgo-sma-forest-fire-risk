// Bước bay Lévy (Mantegna) — dùng trong pha khám phá của TGO-SMA.
// Cổng port của levy_flight() trong pipeline gốc.

function gammaLn(x) {
  // Lanczos approximation
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - gammaLn(1 - x);
  }
  const xx = x - 1;
  let a = c[0];
  const t = xx + g + 0.5;
  for (let i = 1; i < g + 2; i += 1) a += c[i] / (xx + i);
  return 0.5 * Math.log(2 * Math.PI) + (xx + 0.5) * Math.log(t) - t + Math.log(a);
}

function gammaFn(x) {
  return Math.exp(gammaLn(x));
}

export function levyFlight(rng, nDim, beta = 1.5) {
  const num = gammaFn(1 + beta) * Math.sin((Math.PI * beta) / 2);
  const den = gammaFn((1 + beta) / 2) * beta * 2 ** ((beta - 1) / 2);
  const sigma = (num / den) ** (1 / beta);
  const out = new Array(nDim);
  for (let i = 0; i < nDim; i += 1) {
    const u = rng.gauss() * sigma;
    const v = Math.abs(rng.gauss());
    out[i] = (u / v ** (1 / beta)) * 0.1;
  }
  return out;
}
