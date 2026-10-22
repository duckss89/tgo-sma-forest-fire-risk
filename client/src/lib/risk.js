export const RISK_COLORS = ['#e5e7eb', '#1a9850', '#91cf60', '#e3b23e', '#fc8d59', '#d73027'];
export const RISK_NAMES = ['—', 'Rất thấp', 'Thấp', 'Trung bình', 'Cao', 'Rất cao'];

export function riskColor(level) {
  return RISK_COLORS[level] || RISK_COLORS[0];
}
export function riskName(level) {
  return RISK_NAMES[level] || '—';
}

// Thang màu liên tục RdYlGn đảo (xanh lá = thấp, đỏ = cao) — giống bản đồ FRI của đề tài.
const FRI_STOPS = [
  [0.0, [0, 104, 55]],
  [0.1, [26, 152, 80]],
  [0.2, [102, 189, 99]],
  [0.3, [166, 217, 106]],
  [0.4, [217, 239, 139]],
  [0.5, [255, 255, 191]],
  [0.6, [254, 224, 139]],
  [0.7, [253, 174, 97]],
  [0.8, [244, 109, 67]],
  [0.9, [215, 48, 39]],
  [1.0, [165, 0, 38]],
];

// t in [0,1] -> [r,g,b]
export function friRamp(t) {
  const x = Math.min(1, Math.max(0, t));
  for (let i = 1; i < FRI_STOPS.length; i += 1) {
    if (x <= FRI_STOPS[i][0]) {
      const [t0, c0] = FRI_STOPS[i - 1];
      const [t1, c1] = FRI_STOPS[i];
      const f = (x - t0) / (t1 - t0 || 1);
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * f),
        Math.round(c0[1] + (c1[1] - c0[1]) * f),
        Math.round(c0[2] + (c1[2] - c0[2]) * f),
      ];
    }
  }
  return FRI_STOPS[FRI_STOPS.length - 1][1];
}

export function friRampCss(t) {
  const [r, g, b] = friRamp(t);
  return `rgb(${r},${g},${b})`;
}

// Chuỗi gradient CSS cho thanh màu (từ dưới lên: 0 -> 1)
export const FRI_GRADIENT = `linear-gradient(to top, ${FRI_STOPS.map(
  ([t]) => `${friRampCss(t)} ${Math.round(t * 100)}%`,
).join(', ')})`;

export function fmt(n, d = 4) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return Number(n).toFixed(d);
}

export function fmtPct(n, d = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `${Number(n).toFixed(d)}%`;
}

export function fmtSeconds(ms) {
  if (!ms) return '—';
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.round(s - m * 60)}s`;
}

export function pValue(p) {
  if (p === null || p === undefined) return '—';
  if (p < 0.001) return '< 0,001';
  return p.toFixed(4).replace('.', ',');
}
