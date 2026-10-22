import { clipWeights, constraintFor } from './constraints.js';

// Tìm kiếm cục bộ — cổng port của lớp LocalSearch trong pipeline gốc.
// fitnessFn(w) -> { fitness, auc, f1 }

export function hillClimbing(rng, weights, fitnessFn, featureNames, nNeighbors = 25, stepSize = 0.1) {
  let bestW = weights.slice();
  let best = fitnessFn(bestW);
  for (let k = 0; k < nNeighbors; k += 1) {
    const neighbor = clipWeights(
      bestW.map((v) => v + rng.gauss() * stepSize),
      featureNames,
    );
    const r = fitnessFn(neighbor);
    if (r.fitness > best.fitness) {
      bestW = neighbor;
      best = r;
    }
  }
  return { w: bestW, ...best };
}

export function patternSearch(weights, fitnessFn, featureNames, stepSize = 0.15, minStep = 0.005) {
  let bestW = weights.slice();
  let best = fitnessFn(bestW);
  let step = stepSize;
  while (step > minStep) {
    let improved = false;
    for (let i = 0; i < weights.length && !improved; i += 1) {
      for (const dir of [1, -1]) {
        const trial = bestW.slice();
        trial[i] += dir * step;
        const clipped = clipWeights(trial, featureNames);
        const r = fitnessFn(clipped);
        if (r.fitness > best.fitness) {
          bestW = clipped;
          best = r;
          improved = true;
          break;
        }
      }
    }
    if (!improved) step *= 0.5;
  }
  return { w: bestW, ...best };
}

export function coordinateDescent(weights, fitnessFn, featureNames, nSteps = 20) {
  let bestW = weights.slice();
  let best = fitnessFn(bestW);
  for (let i = 0; i < featureNames.length; i += 1) {
    const [low, high] = constraintFor(featureNames[i]);
    const count = nSteps * 2 + 1;
    for (let s = 0; s < count; s += 1) {
      const val = low + ((high - low) * s) / (count - 1);
      if (Math.abs(val) < 0.05) continue;
      const trial = bestW.slice();
      trial[i] = val;
      const r = fitnessFn(trial);
      if (r.fitness > best.fitness) {
        bestW = trial;
        best = r;
      }
    }
  }
  return { w: bestW, ...best };
}
