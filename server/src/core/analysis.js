import { rocAuc, bestF1, confusionAt, rocCurve, mannWhitney } from './metrics.js';
import { friScore, normalize01 } from './fitness.js';
import { WEIGHT_CONSTRAINTS, FEATURE_META, constraintFor } from './constraints.js';
import { classify as classifyLevel, sampleRaster } from '../data/friRaster.js';

// Điểm nguy cơ chuẩn hóa [0,1] cho một tập X với bộ trọng số (có lật nếu AUC < 0.5).
export function predictRisk(X, y, weights) {
  const raw = friScore(X, weights);
  let { values } = normalize01(raw);
  let auc = rocAuc(y, values);
  if (auc < 0.5) {
    auc = 1 - auc;
    values = values.map((v) => 1 - v);
  }
  return { risk: values, auc };
}

// Đánh giá trên tập kiểm tra — tương đương evaluate_on_test().
export function evaluateOnTest(X, y, weights) {
  const { risk, auc } = predictRisk(X, y, weights);
  const { f1, threshold } = bestF1(y, risk);
  const cm = confusionAt(y, risk, threshold);
  return {
    auc,
    threshold,
    f1: cm.f1,
    accuracy: cm.accuracy,
    precision: cm.precision,
    recall: cm.recall,
    confusion: { tp: cm.tp, fp: cm.fp, fn: cm.fn, tn: cm.tn },
    roc: rocCurve(y, risk),
  };
}

// Bảng trọng số cho UI.
export function weightsTable(featureNames, weights) {
  const maxAbs = Math.max(...weights.map((w) => Math.abs(w)), 1e-9);
  return featureNames.map((name, i) => {
    const [low, high] = constraintFor(name);
    return {
      feature: name,
      label: FEATURE_META[name]?.label || name,
      group: FEATURE_META[name]?.group || 'other',
      weight: Number(weights[i].toFixed(4)),
      abs: Number(Math.abs(weights[i]).toFixed(4)),
      bar: Math.abs(weights[i]) / maxAbs,
      direction: weights[i] >= 0 ? 'up' : 'down',
      meaning: weights[i] >= 0 ? 'Tăng nguy cơ cháy' : 'Giảm nguy cơ cháy',
      constraint: [low, high],
    };
  }).sort((a, b) => b.abs - a.abs);
}

// Phân tích độ nhạy trọng số (biểu đồ tornado): nhiễu ±factor từng trọng số,
// đo thay đổi AUC trên tập kiểm tra.
export function sensitivity(X, y, featureNames, weights, factor = 0.25) {
  const base = predictRisk(X, y, weights).auc;
  const items = featureNames.map((name, i) => {
    const [low, high] = constraintFor(name);
    const clip = (v) => Math.min(high, Math.max(low, v));
    const up = weights.slice();
    up[i] = clip(weights[i] * (1 + factor));
    const down = weights.slice();
    down[i] = clip(weights[i] * (1 - factor));
    const aucUp = predictRisk(X, y, up).auc;
    const aucDown = predictRisk(X, y, down).auc;
    return {
      feature: name,
      label: FEATURE_META[name]?.label || name,
      deltaUp: Number((aucUp - base).toFixed(5)),
      deltaDown: Number((aucDown - base).toFixed(5)),
      range: Number((Math.abs(aucUp - base) + Math.abs(aucDown - base)).toFixed(5)),
    };
  });
  items.sort((a, b) => b.range - a.range);
  return { baseAuc: Number(base.toFixed(5)), factor, items };
}

// Validation theo năm với dữ liệu FIRMS (điểm cháy / không cháy của năm đó).
// raster: raster FRI của bản đồ — phân mức tại điểm cháy đúng như cách bản đồ phân loại.
export function yearlyValidation(sets, weights, raster = null, highLevel = 4, moderateLevel = 3) {
  return sets.map(({ year, X, y, rows }) => {
    const rawFri = friScore(X, weights);
    let auc = rocAuc(y, rawFri);
    const flip = auc < 0.5;
    if (flip) auc = 1 - auc;

    // điểm nguy cơ [0,1] + mức, tra từ raster bản đồ nếu có tọa độ
    const risk = new Array(y.length);
    const level = new Array(y.length);
    if (raster && rows) {
      for (let i = 0; i < y.length; i += 1) {
        const s = sampleRaster(raster, rows[i].lon, rows[i].lat);
        if (Number.isFinite(s.fri)) {
          risk[i] = flip ? 1 - s.fri : s.fri;
          level[i] = classifyLevel(risk[i]);
        } else {
          risk[i] = 0;
          level[i] = 0;
        }
      }
    } else {
      const norm = normalize01(rawFri).values;
      for (let i = 0; i < y.length; i += 1) {
        risk[i] = flip ? 1 - norm[i] : norm[i];
        level[i] = classifyLevel(risk[i]);
      }
    }

    const { threshold } = bestF1(y, risk);
    const cm = confusionAt(y, risk, threshold);
    const fireRisks = [];
    const nonFireRisks = [];
    let fireHigh = 0;
    let fireModerate = 0;
    for (let i = 0; i < y.length; i += 1) {
      if (y[i] === 1) {
        fireRisks.push(risk[i]);
        if (level[i] >= highLevel) fireHigh += 1;
        if (level[i] >= moderateLevel) fireModerate += 1;
      } else {
        nonFireRisks.push(risk[i]);
      }
    }
    const mw = mannWhitney(fireRisks, nonFireRisks);
    const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
    return {
      year,
      auc: Number(auc.toFixed(4)),
      accuracy: Number(cm.accuracy.toFixed(4)),
      precision: Number(cm.precision.toFixed(4)),
      recall: Number(cm.recall.toFixed(4)),
      f1: Number(cm.f1.toFixed(4)),
      fireCount: fireRisks.length,
      nonFireCount: nonFireRisks.length,
      fireFriMean: Number(mean(fireRisks).toFixed(4)),
      nonFireFriMean: Number(mean(nonFireRisks).toFixed(4)),
      highVeryHighPct: Number(((fireHigh / Math.max(1, fireRisks.length)) * 100).toFixed(1)),
      moderatePlusPct: Number(((fireModerate / Math.max(1, fireRisks.length)) * 100).toFixed(1)),
      mannWhitneyP: mw.p,
    };
  });
}

export { WEIGHT_CONSTRAINTS };
