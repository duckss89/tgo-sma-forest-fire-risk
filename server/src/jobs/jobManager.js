import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { optimizeTGOSMA } from '../core/tgoSma.js';
import { prepareTraining, yearlyValidationSet, availableYears } from '../data/dataset.js';
import {
  evaluateOnTest,
  weightsTable,
  sensitivity,
  yearlyValidation,
} from '../core/analysis.js';
import { computeFriRaster } from '../data/friRaster.js';

const jobs = new Map();
const jobRasters = new Map(); // jobId -> kết quả computeFriRaster (chứa base64 lớn + typed array)
const emitter = new EventEmitter();
emitter.setMaxListeners(0);

const clamp = (v, lo, hi, dflt) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(hi, Math.max(lo, Math.round(n)));
};

export function createJob(rawParams, limits) {
  const params = {
    popSize: clamp(rawParams.popSize, limits.popSize.min, limits.popSize.max, limits.popSize.default),
    maxIter: clamp(rawParams.maxIter, limits.maxIter.min, limits.maxIter.max, limits.maxIter.default),
    numRuns: clamp(rawParams.numRuns, limits.numRuns.min, limits.numRuns.max, limits.numRuns.default),
    seed: clamp(rawParams.seed ?? 42, 0, 2 ** 31 - 1, 42),
    note: (rawParams.note || '').toString().slice(0, 200),
  };

  const id = randomUUID();
  const job = {
    id,
    params,
    status: 'running',
    createdAt: new Date().toISOString(),
    progress: { run: 0, iter: 0, maxIter: params.maxIter, bestFitness: 0, bestAuc: 0, pct: 0 },
    log: [],
    runs: [],
    result: null,
    error: null,
  };
  jobs.set(id, job);
  runJob(job).catch((err) => {
    job.status = 'error';
    job.error = String(err && err.stack ? err.stack : err);
    emit(job, 'error');
  });
  return job;
}

function emit(job, type) {
  emitter.emit(job.id, { type, job: publicJob(job) });
}

function pushLog(job, text) {
  job.log.push({ t: new Date().toISOString(), text });
  if (job.log.length > 400) job.log.shift();
  emit(job, 'log');
}

async function runJob(job) {
  const { popSize, maxIter, numRuns, seed } = job.params;

  pushLog(job, `Chuẩn bị dữ liệu huấn luyện (seed ${seed})...`);
  const data = prepareTraining({ seed });
  pushLog(
    job,
    `Dữ liệu: ${data.counts.total} điểm — huấn luyện ${data.counts.train}, kiểm tra ${data.counts.test}, `
      + `cân bằng ${data.counts.balancedTrain}, dùng ${data.counts.fitnessRows} dòng cho fitness.`,
  );

  let best = null;
  for (let run = 0; run < numRuns; run += 1) {
    pushLog(job, `— Lần chạy ${run + 1}/${numRuns} —`);
    const runSeed = seed + run;
    // eslint-disable-next-line no-await-in-loop
    const out = await optimizeTGOSMA({
      X: data.Xtrain,
      y: data.ytrain,
      featureNames: data.featureNames,
      popSize,
      maxIter,
      seed: runSeed,
      onProgress: (p) => {
        job.progress = {
          run: run + 1,
          iter: p.iter,
          maxIter: p.maxIter,
          bestFitness: Number(p.bestFitness.toFixed(6)),
          bestAuc: Number(p.bestAuc.toFixed(4)),
          pct: Math.round(((run + p.iter / p.maxIter) / numRuns) * 100),
        };
        emit(job, 'progress');
      },
      onLog: (text) => pushLog(job, text),
    });

    const testEval = evaluateOnTest(data.Xtest, data.ytest, out.bestWeights);
    const runInfo = {
      run: run + 1,
      seed: runSeed,
      trainFitness: Number(out.bestFitness.toFixed(6)),
      trainAuc: Number(out.bestAuc.toFixed(4)),
      trainF1: Number(out.bestF1.toFixed(4)),
      testAuc: Number(testEval.auc.toFixed(4)),
      testF1: Number(testEval.f1.toFixed(4)),
      testRecall: Number(testEval.recall.toFixed(4)),
      elapsedMs: out.elapsedMs,
      weights: out.bestWeights.map((w) => Number(w.toFixed(6))),
    };
    job.runs.push(runInfo);
    pushLog(
      job,
      `Lần ${run + 1}: fitness ${runInfo.trainFitness}, AUC(test) ${runInfo.testAuc}, `
        + `F1(test) ${runInfo.testF1}, ${(out.elapsedMs / 1000).toFixed(1)}s`,
    );

    if (!best || out.bestFitness > best.out.bestFitness) {
      best = { out, testEval, runSeed };
    }
    emit(job, 'run');
  }

  pushLog(job, 'Tổng hợp kết quả & dựng bản đồ FRI...');

  const { out, testEval } = best;
  const years = availableYears();
  const valSets = years.map((yr) => {
    const s = yearlyValidationSet(data.scaler, yr);
    return { year: yr, X: s.X, y: s.y, rows: s.rows };
  });

  const raster = computeFriRaster(out.bestWeights);
  jobRasters.set(job.id, raster);
  // job.result chỉ giữ phần nhẹ (metadata); ảnh raster lấy qua /api/map/fri
  const friMap = {
    year: raster.year,
    width: raster.width,
    height: raster.height,
    bbox: raster.bbox,
    p1: Number(raster.p1.toFixed(4)),
    p99: Number(raster.p99.toFixed(4)),
    note: raster.note,
    distribution: raster.distribution,
    highVeryHighPct: raster.highVeryHighPct,
  };

  const aucs = job.runs.map((r) => r.testAuc);
  const f1s = job.runs.map((r) => r.testF1);
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const std = (a) => {
    const m = mean(a);
    return Math.sqrt(mean(a.map((v) => (v - m) ** 2)));
  };

  job.result = {
    params: job.params,
    dataCounts: data.counts,
    bestRunSeed: best.runSeed,
    weights: out.bestWeights.map((w, i) => ({ feature: data.featureNames[i], weight: out.bestWeights[i] })),
    weightsVector: out.bestWeights,
    weightsTable: weightsTable(data.featureNames, out.bestWeights),
    convergence: out.convergence,
    training: {
      fitness: Number(out.bestFitness.toFixed(6)),
      auc: Number(out.bestAuc.toFixed(4)),
      f1: Number(out.bestF1.toFixed(4)),
      iterations: out.iterations,
      elapsedMs: out.elapsedMs,
    },
    test: testEval,
    runsSummary: {
      n: job.runs.length,
      aucMean: Number(mean(aucs).toFixed(4)),
      aucStd: Number(std(aucs).toFixed(4)),
      aucMax: Number(Math.max(...aucs).toFixed(4)),
      f1Mean: Number(mean(f1s).toFixed(4)),
      f1Max: Number(Math.max(...f1s).toFixed(4)),
    },
    sensitivity: sensitivity(data.Xtest, data.ytest, data.featureNames, out.bestWeights),
    yearlyValidation: yearlyValidation(valSets, out.bestWeights, raster),
    friMap,
    friClassPct: raster.distribution,
    finishedAt: new Date().toISOString(),
  };
  job.status = 'done';
  job.progress.pct = 100;
  pushLog(job, `Hoàn tất — AUC(test) tốt nhất ${testEval.auc.toFixed(4)}.`);
  emit(job, 'done');
}

export function getJob(id) {
  return jobs.get(id) || null;
}

export function getJobRaster(id) {
  return jobRasters.get(id) || null;
}

export function publicJob(job) {
  if (!job) return null;
  return {
    id: job.id,
    params: job.params,
    status: job.status,
    createdAt: job.createdAt,
    progress: job.progress,
    log: job.log,
    runs: job.runs,
    result: job.result,
    error: job.error,
  };
}

export function subscribe(id, listener) {
  emitter.on(id, listener);
  return () => emitter.off(id, listener);
}

export function listJobs() {
  return [...jobs.values()].map(publicJob);
}
