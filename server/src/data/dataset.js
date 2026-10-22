import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsvObjects } from './csv.js';
import { makeRng } from '../core/random.js';
import { FEATURE_COLS } from '../core/constraints.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const TARGET_COL = 'fire';

let cache = null;

// Đọc training_data_ffrm.csv -> mảng bản ghi { lon, lat, year, date, features:[8], fire }
export function loadRawDataset() {
  if (cache) return cache;
  const text = fs.readFileSync(path.join(DATA_DIR, 'training_data_ffrm.csv'), 'utf8');
  const { header, records } = parseCsvObjects(text);
  const missing = FEATURE_COLS.filter((c) => !header.includes(c));
  if (missing.length) throw new Error(`Thiếu cột đặc trưng trong CSV: ${missing.join(', ')}`);

  const rows = [];
  for (const rec of records) {
    const features = FEATURE_COLS.map((c) => Number(rec[c]));
    if (features.some((v) => !Number.isFinite(v))) continue;
    const fire = Number(rec[TARGET_COL]);
    if (fire !== 0 && fire !== 1) continue;
    rows.push({
      lon: Number(rec.longitude),
      lat: Number(rec.latitude),
      year: Number(rec.year),
      date: rec.acq_date,
      features,
      fire,
    });
  }
  cache = { featureNames: FEATURE_COLS.slice(), rows };
  return cache;
}

// MinMaxScaler theo cột, fit trên tập cho trước
export function fitMinMaxScaler(matrix) {
  const d = matrix[0].length;
  const min = new Array(d).fill(Infinity);
  const max = new Array(d).fill(-Infinity);
  for (const row of matrix) {
    for (let j = 0; j < d; j += 1) {
      if (row[j] < min[j]) min[j] = row[j];
      if (row[j] > max[j]) max[j] = row[j];
    }
  }
  const span = min.map((m, j) => (max[j] - m) || 1);
  return {
    min,
    max,
    transform: (row) => row.map((v, j) => (v - min[j]) / span[j]),
    transformAll: (rows) => rows.map((row) => row.map((v, j) => (v - min[j]) / span[j])),
  };
}

// Chia tầng (stratified) theo nhãn, có hạt giống
function stratifiedSplit(rows, testSize, seed) {
  const rng = makeRng(seed);
  const byClass = { 0: [], 1: [] };
  rows.forEach((r, i) => byClass[r.fire].push(i));
  const trainIdx = [];
  const testIdx = [];
  for (const cls of [0, 1]) {
    const idx = rng.shuffle(byClass[cls].slice());
    const nTest = Math.round(idx.length * testSize);
    testIdx.push(...idx.slice(0, nTest));
    trainIdx.push(...idx.slice(nTest));
  }
  return {
    train: rng.shuffle(trainIdx),
    test: rng.shuffle(testIdx),
  };
}

// Cân bằng lớp bằng oversampling lớp thiểu số (giống balance_data trong pipeline gốc)
function balance(rows, seed) {
  const rng = makeRng(seed + 777);
  const fire = rows.filter((r) => r.fire === 1);
  const noFire = rows.filter((r) => r.fire === 0);
  const target = Math.floor((fire.length + noFire.length) / 2);
  const out = [];
  for (let i = 0; i < target; i += 1) out.push(fire[rng.int(fire.length)]);
  const noIdx = rng.shuffle(noFire.map((_, i) => i)).slice(0, Math.min(target, noFire.length));
  for (const i of noIdx) out.push(noFire[i]);
  return rng.shuffle(out);
}

// Chuẩn bị dữ liệu huấn luyện + kiểm tra cho một lần chạy tối ưu hóa.
export function prepareTraining({ testSize = 0.3, seed = 42, maxFitnessRows = 4000 } = {}) {
  const { featureNames, rows } = loadRawDataset();
  const { train, test } = stratifiedSplit(rows, testSize, seed);

  const trainRows = train.map((i) => rows[i]);
  const testRows = test.map((i) => rows[i]);
  const balTrain = balance(trainRows, seed);

  const scaler = fitMinMaxScaler(balTrain.map((r) => r.features));

  // Giới hạn số dòng dùng cho hàm fitness (giữ tỉ lệ lớp) để chạy web đủ nhanh
  let fitRows = balTrain;
  if (balTrain.length > maxFitnessRows) {
    const rng = makeRng(seed + 999);
    fitRows = rng.shuffle(balTrain.slice()).slice(0, maxFitnessRows);
  }

  return {
    featureNames,
    scaler,
    Xtrain: scaler.transformAll(fitRows.map((r) => r.features)),
    ytrain: fitRows.map((r) => r.fire),
    Xtest: scaler.transformAll(testRows.map((r) => r.features)),
    ytest: testRows.map((r) => r.fire),
    testRows,
    counts: {
      total: rows.length,
      train: trainRows.length,
      test: testRows.length,
      balancedTrain: balTrain.length,
      fitnessRows: fitRows.length,
      fire: rows.filter((r) => r.fire === 1).length,
      nonFire: rows.filter((r) => r.fire === 0).length,
    },
  };
}

// Dữ liệu cho validation theo năm: toàn bộ điểm của năm đó, đã scale bằng scaler.
export function yearlyValidationSet(scaler, year) {
  const { rows } = loadRawDataset();
  const sel = rows.filter((r) => r.year === year);
  return {
    year,
    X: scaler.transformAll(sel.map((r) => r.features)),
    y: sel.map((r) => r.fire),
    rows: sel,
  };
}

export function availableYears() {
  const { rows } = loadRawDataset();
  return [...new Set(rows.map((r) => r.year))].filter((y) => Number.isFinite(y)).sort();
}

// Toàn bộ đặc trưng thô (mọi điểm) — để dựng phân phối FRI tham chiếu.
export function fullFeatureMatrix() {
  return loadRawDataset().rows.map((r) => r.features);
}

export { DATA_DIR };
