import { rocAuc, bestF1 } from './metrics.js';

// Cổng port của calculate_fitness() trong metaheuristic_comparison_v8.py
//   fitness = AUC * (0.5 + 0.5 * bestF1) * diversity
// X: mảng 2 chiều [n][d] đã chuẩn hóa [0,1]; y: mảng nhãn 0/1; weights: vector d.

export function friScore(X, weights) {
  const n = X.length;
  const d = weights.length;
  const fri = new Array(n);
  for (let i = 0; i < n; i += 1) {
    const row = X[i];
    let s = 0;
    for (let j = 0; j < d; j += 1) s += row[j] * weights[j];
    fri[i] = s;
  }
  return fri;
}

export function normalize01(arr) {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < arr.length; i += 1) {
    if (arr[i] < min) min = arr[i];
    if (arr[i] > max) max = arr[i];
  }
  const span = max - min;
  return { values: arr.map((v) => (span < 1e-10 ? 0.5 : (v - min) / span)), span };
}

export function diversityBonus(weights) {
  let sum = 0;
  const abs = weights.map((w) => Math.abs(w));
  for (let i = 0; i < abs.length; i += 1) sum += abs[i];
  if (sum <= 0) return 0.95;
  let entropy = 0;
  for (let i = 0; i < abs.length; i += 1) {
    const p = abs[i] / sum;
    entropy -= p * Math.log(p + 1e-10);
  }
  return 0.95 + 0.05 * (entropy / Math.log(weights.length));
}

export function calculateFitness(X, y, weights) {
  const fri = friScore(X, weights);
  const { values: friNorm0, span } = normalize01(fri);
  if (span < 1e-10) return { fitness: 0, auc: 0.5, f1: 0 };

  let auc = rocAuc(y, friNorm0);
  let friNorm = friNorm0;
  if (auc < 0.5) {
    auc = 1 - auc;
    friNorm = friNorm0.map((v) => 1 - v);
  }
  const { f1 } = bestF1(y, friNorm);
  const diversity = diversityBonus(weights);
  return { fitness: auc * (0.5 + 0.5 * f1) * diversity, auc, f1 };
}
