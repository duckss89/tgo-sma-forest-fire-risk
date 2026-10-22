// Các độ đo phân loại — tương đương sklearn.metrics dùng trong pipeline gốc.

// AUC-ROC bằng thống kê Mann–Whitney U (xử lý hạng trung bình cho giá trị trùng).
// Tương đương roc_auc_score(y_true, scores).
export function rocAuc(yTrue, scores) {
  const n = yTrue.length;
  const idx = Array.from({ length: n }, (_, i) => i);
  idx.sort((a, b) => scores[a] - scores[b]);

  const rank = new Array(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && scores[idx[j + 1]] === scores[idx[i]]) j += 1;
    const avg = (i + j) / 2 + 1; // hạng 1-based, trung bình cho nhóm trùng
    for (let k = i; k <= j; k += 1) rank[idx[k]] = avg;
    i = j + 1;
  }

  let sumRankPos = 0;
  let nPos = 0;
  for (let t = 0; t < n; t += 1) {
    if (yTrue[t] === 1) {
      sumRankPos += rank[t];
      nPos += 1;
    }
  }
  const nNeg = n - nPos;
  if (nPos === 0 || nNeg === 0) return 0.5;
  return (sumRankPos - (nPos * (nPos + 1)) / 2) / (nPos * nNeg);
}

// F1 nhị phân (nhãn dương = 1), zero_division = 0
export function f1AtThreshold(yTrue, scores, threshold) {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  for (let i = 0; i < yTrue.length; i += 1) {
    const pred = scores[i] >= threshold ? 1 : 0;
    if (pred === 1 && yTrue[i] === 1) tp += 1;
    else if (pred === 1 && yTrue[i] === 0) fp += 1;
    else if (pred === 0 && yTrue[i] === 1) fn += 1;
  }
  const denom = 2 * tp + fp + fn;
  return denom === 0 ? 0 : (2 * tp) / denom;
}

// Quét ngưỡng 0.2..0.78 bước 0.02 (giống np.arange(0.2, 0.8, 0.02)), trả F1 lớn nhất.
// Cài đặt O(n log n): sắp xếp theo điểm số rồi quét tích lũy.
export function bestF1(yTrue, scores, lo = 0.2, hi = 0.8, step = 0.02) {
  const n = yTrue.length;
  let totalPos = 0;
  for (let i = 0; i < n; i += 1) if (yTrue[i] === 1) totalPos += 1;

  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => scores[b] - scores[a]);
  const thresholds = [];
  for (let t = lo; t < hi - 1e-9; t += step) thresholds.push(t);

  let best = 0;
  let bestT = lo;
  let ptr = 0; // số phần tử đã có score >= threshold hiện tại
  let tpCum = 0; // trong số đó, bao nhiêu là dương thật
  for (let k = thresholds.length - 1; k >= 0; k -= 1) {
    const thr = thresholds[k];
    while (ptr < n && scores[order[ptr]] >= thr) {
      if (yTrue[order[ptr]] === 1) tpCum += 1;
      ptr += 1;
    }
    const fp = ptr - tpCum;
    const fn = totalPos - tpCum;
    const denom = 2 * tpCum + fp + fn;
    const f = denom === 0 ? 0 : (2 * tpCum) / denom;
    if (f > best) {
      best = f;
      bestT = thr;
    }
  }
  return { f1: best, threshold: bestT };
}

export function confusionAt(yTrue, scores, threshold) {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;
  for (let i = 0; i < yTrue.length; i += 1) {
    const pred = scores[i] >= threshold ? 1 : 0;
    if (pred === 1 && yTrue[i] === 1) tp += 1;
    else if (pred === 1 && yTrue[i] === 0) fp += 1;
    else if (pred === 0 && yTrue[i] === 1) fn += 1;
    else tn += 1;
  }
  const acc = (tp + tn) / Math.max(1, yTrue.length);
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
  const f1 = 2 * tp + fp + fn === 0 ? 0 : (2 * tp) / (2 * tp + fp + fn);
  return { tp, fp, fn, tn, accuracy: acc, precision, recall, f1 };
}

// Đường cong ROC (danh sách điểm fpr/tpr) — cho biểu đồ.
export function rocCurve(yTrue, scores, maxPoints = 120) {
  const n = yTrue.length;
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => scores[b] - scores[a]);
  let nPos = 0;
  for (let i = 0; i < n; i += 1) if (yTrue[i] === 1) nPos += 1;
  const nNeg = n - nPos;
  const pts = [{ fpr: 0, tpr: 0 }];
  let tp = 0;
  let fp = 0;
  const stride = Math.max(1, Math.floor(n / maxPoints));
  for (let i = 0; i < n; i += 1) {
    if (yTrue[order[i]] === 1) tp += 1;
    else fp += 1;
    if (i % stride === 0 || i === n - 1) {
      pts.push({ fpr: nNeg ? fp / nNeg : 0, tpr: nPos ? tp / nPos : 0 });
    }
  }
  pts.push({ fpr: 1, tpr: 1 });
  return pts;
}

// Kiểm định Mann–Whitney U (xấp xỉ chuẩn) — so phân phối FRI ở điểm cháy vs không cháy.
export function mannWhitney(a, b) {
  const na = a.length;
  const nb = b.length;
  const all = a.map((v) => ({ v, g: 0 })).concat(b.map((v) => ({ v, g: 1 })));
  all.sort((x, y) => x.v - y.v);
  const n = all.length;
  let i = 0;
  let rankSumA = 0;
  let tieTerm = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && all[j + 1].v === all[i].v) j += 1;
    const avg = (i + j) / 2 + 1;
    const t = j - i + 1;
    if (t > 1) tieTerm += t * t * t - t;
    for (let k = i; k <= j; k += 1) if (all[k].g === 0) rankSumA += avg;
    i = j + 1;
  }
  const u1 = rankSumA - (na * (na + 1)) / 2;
  const u = Math.min(u1, na * nb - u1);
  const mu = (na * nb) / 2;
  const sigma = Math.sqrt(
    (na * nb / 12) * ((n + 1) - tieTerm / (n * (n - 1))),
  );
  if (sigma === 0) return { u, p: 1 };
  const z = (u - mu + 0.5) / sigma; // hiệu chỉnh liên tục
  const p = 2 * normalCdf(-Math.abs(z)); // hai phía
  return { u, z, p: Math.max(0, Math.min(1, p)) };
}

// Hàm phân phối tích lũy chuẩn tắc P(Z <= x) — xấp xỉ Abramowitz & Stegun 7.1.26
function normalCdf(x) {
  const b1 = 0.319381530;
  const b2 = -0.356563782;
  const b3 = 1.781477937;
  const b4 = -1.821255978;
  const b5 = 1.330274429;
  const a = Math.abs(x);
  const t = 1 / (1 + 0.2316419 * a);
  const c = 0.39894228040143268;
  const tail = c * Math.exp((-a * a) / 2) * t * (b1 + t * (b2 + t * (b3 + t * (b4 + t * b5))));
  return x >= 0 ? 1 - tail : tail;
}
