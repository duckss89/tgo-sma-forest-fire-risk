import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsvObjects } from './csv.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');

// Số liệu so sánh tĩnh từ đề tài gốc (metaheuristic_comparison_v8).
// Dùng để đối chiếu với lần chạy TGO-SMA trực tiếp trên web.
export function referenceComparison() {
  const summary = parseCsvObjects(
    fs.readFileSync(path.join(DATA_DIR, 'baseline_summary.csv'), 'utf8'),
  ).records.map((r) => ({
    algorithm: r.Algorithm,
    aucMean: Number(r.AUC_mean),
    aucStd: Number(r.AUC_std),
    aucMax: Number(r.AUC_max),
    f1Mean: Number(r['F1-Score_mean']),
    f1Max: Number(r['F1-Score_max']),
    timeMean: Number(r.Time_mean),
    isHybrid: /hybrid/i.test(r.Algorithm),
  }));

  const detailed = parseCsvObjects(
    fs.readFileSync(path.join(DATA_DIR, 'baseline_detailed.csv'), 'utf8'),
  ).records.map((r) => ({
    algorithm: r.Algorithm,
    run: Number(r.Run),
    auc: Number(r.AUC),
    f1: Number(r['F1-Score']),
    recall: Number(r.Recall),
  }));

  const weights = parseCsvObjects(
    fs.readFileSync(path.join(DATA_DIR, 'reference_weights.csv'), 'utf8'),
  ).records.map((r) => ({
    feature: r.Feature,
    weight: Number(r.Weight),
    constraint: [Number(r.Constraint_Low), Number(r.Constraint_High)],
  }));

  return { summary, detailed, weights, source: 'metaheuristic_comparison_v8 (đề tài gốc)' };
}
