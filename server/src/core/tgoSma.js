// ============================================================================
//  TGO-SMA HYBRID  —  lõi thuật toán của hệ thống
//  Cổng port của TGO_SMA_Hybrid_Scientific (metaheuristic_comparison_v8.py)
//
//  Mỗi vòng lặp gồm: pha TGO (Tree Growth Optimization) -> pha SMA (Slime Mould
//  Algorithm) -> tìm kiếm cục bộ định kỳ -> khởi động lại khi trì trệ.
//  Kết thúc: tinh chỉnh (hill climbing + pattern search + coordinate descent).
// ============================================================================

import { makeRng } from './random.js';
import {
  clipWeights,
  initWeightVector,
  initPopulationOBL,
} from './constraints.js';
import { calculateFitness } from './fitness.js';
import { EliteArchive } from './eliteArchive.js';
import { levyFlight } from './levy.js';
import {
  hillClimbing,
  patternSearch,
  coordinateDescent,
} from './localSearch.js';

const sleep0 = () => new Promise((resolve) => setImmediate(resolve));

function argsortDesc(values) {
  return values
    .map((v, i) => i)
    .sort((a, b) => values[b] - values[a]);
}

function argsortAsc(values) {
  return values
    .map((v, i) => i)
    .sort((a, b) => values[a] - values[b]);
}

const addVec = (a, b) => a.map((v, i) => v + b[i]);
const subVec = (a, b) => a.map((v, i) => v - b[i]);
const scaleVec = (a, s) => a.map((v) => v * s);

export async function optimizeTGOSMA(options) {
  const {
    X,
    y,
    featureNames,
    popSize = 50,
    maxIter = 120,
    seed = 42,
    localSearchEvery = 5,
    stagnationLimit = 15,
    onProgress = null,
    onLog = null,
  } = options;

  const rng = makeRng(seed);
  const n = featureNames.length;
  const started = Date.now();

  const evalFitness = (w) => calculateFitness(X, y, w);
  const fitnessOnly = (w) => evalFitness(w).fitness;

  const elite = new EliteArchive(15);

  // --- khởi tạo quần thể (Opposition-Based Learning) ---
  let pop = initPopulationOBL(rng, popSize, featureNames);
  let fitness = pop.map(fitnessOnly);

  let bestIdx = argsortDesc(fitness)[0];
  let bestWeights = pop[bestIdx].slice();
  let bestFitness = fitness[bestIdx];
  let bestEval = evalFitness(bestWeights);
  let bestAuc = bestEval.auc;
  let bestF1 = bestEval.f1;
  elite.add(bestWeights, bestFitness, bestAuc, bestF1);

  const convergence = [];
  let stagnation = 0;
  let prevBest = bestFitness;

  const commitIfBetter = (w, ev) => {
    if (ev.fitness > bestFitness) {
      bestWeights = w.slice();
      bestFitness = ev.fitness;
      bestAuc = ev.auc;
      bestF1 = ev.f1;
      elite.add(bestWeights, bestFitness, bestAuc, bestF1);
    }
  };

  for (let t = 0; t < maxIter; t += 1) {
    // ================= PHA TGO =================
    let sorted = argsortDesc(fitness);
    const N1 = Math.max(1, Math.floor(popSize * 0.1));
    const N2 = Math.max(1, Math.floor(popSize * 0.3));
    const N3 = Math.max(1, Math.floor(popSize * 0.3));
    let newPop = pop.map((p) => p.slice());

    for (let rank = 0; rank < popSize; rank += 1) {
      const idx = sorted[rank];
      if (rank < N1) {
        // cây khỏe nhất: nhiễu nhỏ tại chỗ
        newPop[idx] = clipWeights(
          addVec(pop[idx], scaleVec(rng.gaussVec(n), 0.05)),
          featureNames,
        );
      } else if (rank < N1 + N2) {
        // nhóm giữa: kéo về nghiệm tốt nhất
        const r = rng.uniform(0.3, 0.7);
        newPop[idx] = clipWeights(
          addVec(pop[idx], scaleVec(subVec(bestWeights, pop[idx]), r)),
          featureNames,
        );
      } else if (rank < N1 + N2 + N3) {
        // nhóm sau: vi phân kép trong nhóm dẫn đầu
        const [j, k] = rng.sample(N1 + N2, 2);
        const r1 = rng.uniform(0.2, 0.5);
        const r2 = rng.uniform(0.2, 0.5);
        const term1 = scaleVec(subVec(pop[sorted[j]], pop[idx]), r1);
        const term2 = scaleVec(subVec(pop[sorted[k]], pop[sorted[j]]), r2);
        newPop[idx] = clipWeights(
          addVec(addVec(pop[idx], term1), term2),
          featureNames,
        );
      } else {
        // đuôi quần thể: tái sinh từ kho tinh hoa / Lévy
        if (rng.next() < 0.3 && elite.all().length >= 2) {
          const child = elite.crossover(rng, featureNames);
          newPop[idx] = child
            ? clipWeights(addVec(child, scaleVec(rng.gaussVec(n), 0.1)), featureNames)
            : initWeightVector(rng, featureNames);
        } else if (rng.next() < 0.5) {
          const e = elite.getRandom(rng);
          newPop[idx] = e
            ? clipWeights(addVec(e.w, scaleVec(rng.gaussVec(n), 0.2)), featureNames)
            : clipWeights(addVec(bestWeights, scaleVec(rng.gaussVec(n), 0.3)), featureNames);
        } else {
          newPop[idx] = clipWeights(
            addVec(pop[idx], levyFlight(rng, n)),
            featureNames,
          );
        }
      }
    }

    pop = newPop;
    for (let i = 0; i < popSize; i += 1) {
      const ev = evalFitness(pop[i]);
      fitness[i] = ev.fitness;
      commitIfBetter(pop[i], ev);
    }

    // ================= PHA SMA =================
    sorted = argsortDesc(fitness);
    const bestFit = fitness[sorted[0]];
    const worstFit = fitness[sorted[popSize - 1]] + 1e-10;
    const a = Math.atanh(1 - (t + 1) / maxIter);
    newPop = pop.map((p) => p.slice());
    const rankOf = new Array(popSize);
    for (let pos = 0; pos < popSize; pos += 1) rankOf[sorted[pos]] = pos;
    const half = Math.floor(popSize / 2);

    for (let i = 0; i < popSize; i += 1) {
      if (i === sorted[0]) continue; // giữ nguyên nghiệm tốt nhất
      const rank = rankOf[i];
      const denom = bestFit - worstFit;
      const ratio = Math.abs(denom) < 1e-12 ? 0 : (bestFit - fitness[i]) / denom;
      const logTerm = Math.log10(Math.max(0, ratio) + 1);
      const W = rank < half
        ? 1 + rng.next() * logTerm
        : 1 - rng.next() * logTerm;
      const p = Math.tanh(Math.abs(fitness[i] - bestFit));

      if (rng.next() < p) {
        const vb = a * (2 * rng.next() - 1);
        const [j, k] = rng.sample(popSize, 2);
        const oscill = subVec(scaleVec(pop[j], W), pop[k]);
        newPop[i] = clipWeights(
          addVec(bestWeights, scaleVec(oscill, vb)),
          featureNames,
        );
      } else {
        const r = rng.uniform(0.1, 0.3);
        newPop[i] = clipWeights(
          addVec(pop[i], scaleVec(subVec(bestWeights, pop[i]), r)),
          featureNames,
        );
      }
    }

    pop = newPop;
    for (let i = 0; i < popSize; i += 1) {
      const ev = evalFitness(pop[i]);
      fitness[i] = ev.fitness;
      commitIfBetter(pop[i], ev);
    }

    // ================= TÌM KIẾM CỤC BỘ (mỗi 5 vòng) =================
    if ((t + 1) % localSearchEvery === 0) {
      const top = argsortAsc(fitness).slice(-3);
      for (const idx of top) {
        const res = hillClimbing(rng, pop[idx], evalFitness, featureNames, 20, 0.1);
        if (res.fitness > fitness[idx]) {
          pop[idx] = res.w;
          fitness[idx] = res.fitness;
          commitIfBetter(res.w, res);
          elite.add(res.w, res.fitness, res.auc, res.f1);
        }
      }
    }

    // ================= KHỞI ĐỘNG LẠI KHI TRÌ TRỆ =================
    if (bestFitness <= prevBest) {
      stagnation += 1;
    } else {
      stagnation = 0;
      prevBest = bestFitness;
    }

    if (stagnation >= stagnationLimit) {
      const worstHalf = argsortAsc(fitness).slice(0, half);
      for (const idx of worstHalf) {
        if (elite.all().length >= 2 && rng.next() < 0.4) {
          const child = elite.crossover(rng, featureNames);
          pop[idx] = child
            ? clipWeights(addVec(child, scaleVec(rng.gaussVec(n), 0.15)), featureNames)
            : initWeightVector(rng, featureNames);
        } else {
          pop[idx] = initWeightVector(rng, featureNames);
        }
      }
      for (let i = 0; i < popSize; i += 1) fitness[i] = fitnessOnly(pop[i]);
      stagnation = 0;
      if (onLog) onLog(`Vòng ${t + 1}: khởi động lại nửa quần thể (trì trệ ${stagnationLimit} vòng)`);
    }

    convergence.push({ iter: t + 1, fitness: bestFitness, auc: bestAuc });
    if (onProgress) {
      onProgress({
        iter: t + 1,
        maxIter,
        bestFitness,
        bestAuc,
        bestF1,
      });
    }
    if (onLog && ((t + 1) % 10 === 0 || t === 0)) {
      onLog(`Vòng ${t + 1}/${maxIter} — fitness ${bestFitness.toFixed(6)}, AUC ${bestAuc.toFixed(4)}`);
    }
    await sleep0();
  }

  // ================= TINH CHỈNH CUỐI =================
  if (onLog) onLog('Tinh chỉnh nghiệm cuối (hill climbing + pattern search + coordinate descent)...');
  for (const item of elite.all().slice(0, 5)) {
    const hc = hillClimbing(rng, item.w, evalFitness, featureNames, 25, 0.12);
    if (hc.fitness > bestFitness) {
      bestWeights = hc.w.slice();
      bestFitness = hc.fitness;
      bestAuc = hc.auc;
      bestF1 = hc.f1;
    }
    const ps = patternSearch(hc.w, evalFitness, featureNames, 0.1, 0.005);
    if (ps.fitness > bestFitness) {
      bestWeights = ps.w.slice();
      bestFitness = ps.fitness;
      bestAuc = ps.auc;
      bestF1 = ps.f1;
    }
    await sleep0();
  }
  const cd = coordinateDescent(bestWeights, evalFitness, featureNames, 20);
  bestWeights = cd.w.slice();
  bestFitness = cd.fitness;
  bestAuc = cd.auc;
  bestF1 = cd.f1;

  return {
    bestWeights,
    bestFitness,
    bestAuc,
    bestF1,
    convergence,
    iterations: maxIter,
    elapsedMs: Date.now() - started,
    elite: elite.all().map((e) => ({ weights: e.w, fitness: e.fitness, auc: e.auc, f1: e.f1 })),
  };
}
