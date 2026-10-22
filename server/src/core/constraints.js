// Ràng buộc khoa học cho trọng số FRI — dựa trên ý nghĩa vật lý của từng biến.
// Cổng port trực tiếp từ metaheuristic_comparison_v8.py

export const FEATURE_COLS = [
  'NDVI', 'NBR', 'NDWI', 'NBRT', 'T2M', 'RH2M', 'WS2M', 'PRECTOTCORR',
];

// Nhãn hiển thị + đơn vị (cho UI)
export const FEATURE_META = {
  NDVI: { label: 'NDVI', group: 'satellite', desc: 'Chỉ số thực vật' },
  NBR: { label: 'NBR', group: 'satellite', desc: 'Chỉ số vùng cháy' },
  NDWI: { label: 'NDWI', group: 'satellite', desc: 'Chỉ số nước' },
  NBRT: { label: 'NBRT', group: 'satellite', desc: 'Chỉ số cháy nhiệt' },
  T2M: { label: 'Nhiệt độ (T2M)', group: 'weather', desc: 'Nhiệt độ không khí 2m' },
  RH2M: { label: 'Độ ẩm (RH2M)', group: 'weather', desc: 'Độ ẩm tương đối 2m' },
  WS2M: { label: 'Tốc độ gió (WS2M)', group: 'weather', desc: 'Tốc độ gió 2m' },
  PRECTOTCORR: { label: 'Lượng mưa (PRECTOTCORR)', group: 'weather', desc: 'Lượng mưa hiệu chỉnh' },
};

// [low, high] cho từng biến
export const WEIGHT_CONSTRAINTS = {
  NDVI: [-1.0, 0.0], //   thực vật xanh tốt -> giảm nguy cơ
  NBR: [0.0, 1.0], //     vùng đã/đang cháy, khô -> tăng nguy cơ
  NDWI: [-1.0, 0.0], //   nhiều nước -> giảm nguy cơ
  NBRT: [0.0, 1.0], //    cháy nhiệt -> tăng nguy cơ
  T2M: [0.0, 1.0], //     nhiệt độ cao -> tăng nguy cơ
  RH2M: [-1.0, 0.0], //   độ ẩm cao -> giảm nguy cơ
  WS2M: [-1.0, 1.0], //   gió: không rõ chiều
  PRECTOTCORR: [-1.0, 0.0], // mưa nhiều -> giảm nguy cơ
};

const MIN_ABS = 0.05;

export function constraintFor(feature) {
  return WEIGHT_CONSTRAINTS[feature] || [-1.0, 1.0];
}

// Cắt vector trọng số về khoảng hợp lệ + ép |w| >= 0.05 (không loại biến nào)
export function clipWeights(weights, featureNames) {
  const out = weights.slice();
  for (let i = 0; i < featureNames.length; i += 1) {
    const [low, high] = constraintFor(featureNames[i]);
    let v = Math.min(high, Math.max(low, out[i]));
    if (Math.abs(v) < MIN_ABS) {
      if (low >= 0) v = MIN_ABS;
      else if (high <= 0) v = -MIN_ABS;
      else v = v >= 0 ? MIN_ABS : -MIN_ABS;
    }
    out[i] = v;
  }
  return out;
}

// Khởi tạo 1 vector trọng số ngẫu nhiên trong khoảng hợp lệ (tránh 0)
export function initWeightVector(rng, featureNames) {
  const w = new Array(featureNames.length);
  for (let i = 0; i < featureNames.length; i += 1) {
    const [low, high] = constraintFor(featureNames[i]);
    if (low >= 0) {
      w[i] = rng.uniform(Math.max(MIN_ABS, low), high);
    } else if (high <= 0) {
      w[i] = rng.uniform(low, Math.min(-MIN_ABS, high));
    } else if (rng.next() < 0.5) {
      w[i] = rng.uniform(low, -MIN_ABS);
    } else {
      w[i] = rng.uniform(MIN_ABS, high);
    }
  }
  return w;
}

export function initPopulation(rng, popSize, featureNames) {
  return Array.from({ length: popSize }, () => initWeightVector(rng, featureNames));
}

// Khởi tạo có Opposition-Based Learning: nửa quần thể ngẫu nhiên + đối nghịch của chúng
export function initPopulationOBL(rng, popSize, featureNames) {
  const pop = [];
  const half = Math.floor(popSize / 2);
  for (let k = 0; k < half; k += 1) {
    const w = initWeightVector(rng, featureNames);
    const opp = w.map((wi, i) => {
      const [low, high] = constraintFor(featureNames[i]);
      return low + high - wi;
    });
    pop.push(w);
    pop.push(clipWeights(opp, featureNames));
  }
  while (pop.length < popSize) pop.push(initWeightVector(rng, featureNames));
  return pop.slice(0, popSize);
}
