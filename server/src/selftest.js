// Kiểm tra nhanh lõi thuật toán (không cần express). Chạy: node src/selftest.js
import { prepareTraining, yearlyValidationSet, availableYears } from './data/dataset.js';
import { optimizeTGOSMA } from './core/tgoSma.js';
import { evaluateOnTest, weightsTable, sensitivity, yearlyValidation } from './core/analysis.js';
import { computeFriRaster } from './data/friRaster.js';
import { referenceComparison } from './data/reference.js';

const t0 = Date.now();
console.log('1) prepareTraining...');
const data = prepareTraining({ seed: 42 });
console.log('   counts:', data.counts);

console.log('2) optimizeTGOSMA (pop=20, iter=20)...');
const out = await optimizeTGOSMA({
  X: data.Xtrain,
  y: data.ytrain,
  featureNames: data.featureNames,
  popSize: 20,
  maxIter: 20,
  seed: 42,
  onLog: (m) => console.log('   [log]', m),
});
console.log('   bestFitness', out.bestFitness.toFixed(6), 'auc', out.bestAuc.toFixed(4), 'f1', out.bestF1.toFixed(4));
console.log('   weights', out.bestWeights.map((w) => w.toFixed(3)));

console.log('3) evaluateOnTest...');
const te = evaluateOnTest(data.Xtest, data.ytest, out.bestWeights);
console.log('   test AUC', te.auc.toFixed(4), 'F1', te.f1.toFixed(4), 'confusion', te.confusion);

console.log('4) weightsTable / sensitivity...');
console.log('   ', weightsTable(data.featureNames, out.bestWeights).map((r) => `${r.feature}:${r.weight}`).join(' '));
const sens = sensitivity(data.Xtest, data.ytest, data.featureNames, out.bestWeights);
console.log('   sensitivity base', sens.baseAuc, 'top', sens.items[0]);

console.log('5) computeFriRaster (raster Landsat thật)...');
const raster = computeFriRaster(out.bestWeights);
console.log('   ', raster.width, 'x', raster.height, 'p1', raster.p1.toFixed(4), 'p99', raster.p99.toFixed(4));
console.log('   distribution', raster.distribution.map((d) => `${d.nameEn} ${d.percent}%`).join(', '));
console.log('   High+VeryHigh diện tích:', raster.highVeryHighPct, '%   (báo cáo mục 4.3 ~ 38%)');

console.log('6) yearlyValidation...');
const years = availableYears();
const sets = years.map((yr) => {
  const s = yearlyValidationSet(data.scaler, yr);
  return { year: yr, X: s.X, y: s.y, rows: s.rows };
});
console.table(yearlyValidation(sets, out.bestWeights, raster));

console.log('7) referenceComparison...');
console.log('   ', referenceComparison().summary.map((s) => `${s.algorithm} ${s.aucMax}`).join(' | '));

console.log(`\nOK — tổng ${(Date.now() - t0) / 1000}s`);
