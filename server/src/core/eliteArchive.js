import { clipWeights, constraintFor } from './constraints.js';

// Kho lưu nghiệm tinh hoa — cổng port của EliteArchive trong pipeline gốc.
export class EliteArchive {
  constructor(maxSize = 15) {
    this.maxSize = maxSize;
    this.items = []; // { w, fitness, auc, f1 }
  }

  add(w, fitness, auc, f1) {
    for (const it of this.items) {
      if (allClose(it.w, w, 0.01)) return;
    }
    this.items.push({ w: w.slice(), fitness, auc, f1 });
    this.items.sort((a, b) => b.fitness - a.fitness);
    if (this.items.length > this.maxSize) this.items.length = this.maxSize;
  }

  getRandom(rng) {
    if (this.items.length === 0) return null;
    return this.items[rng.int(this.items.length)];
  }

  // Lai ghép BLX-alpha giữa 2 phần tử ngẫu nhiên trong kho
  crossover(rng, featureNames) {
    if (this.items.length < 2) return null;
    const [i, j] = rng.sample(this.items.length, 2);
    const p1 = this.items[i].w;
    const p2 = this.items[j].w;
    const alpha = 0.3;
    const child = new Array(p1.length);
    for (let k = 0; k < p1.length; k += 1) {
      const dist = Math.abs(p1[k] - p2[k]);
      const [low, high] = constraintFor(featureNames[k]);
      const lo = Math.max(low, Math.min(p1[k], p2[k]) - alpha * dist);
      const hi = Math.min(high, Math.max(p1[k], p2[k]) + alpha * dist);
      child[k] = hi > lo ? rng.uniform(lo, hi) : lo;
    }
    return clipWeights(child, featureNames);
  }

  all() {
    return this.items;
  }
}

function allClose(a, b, atol) {
  for (let i = 0; i < a.length; i += 1) {
    if (Math.abs(a[i] - b[i]) > atol) return false;
  }
  return true;
}
