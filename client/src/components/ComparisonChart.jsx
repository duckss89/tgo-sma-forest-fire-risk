import { fmt } from '../lib/risk.js';

// rows: [{ algorithm, aucMean, aucStd, aucMax, isHybrid }], live: { label, aucMean, aucMax }
export default function ComparisonChart({ rows, live }) {
  const all = [...(rows || [])];
  if (live) all.push({ ...live, isLive: true });
  if (all.length === 0) return null;

  const lo = Math.min(...all.map((r) => r.aucMean - (r.aucStd || 0))) - 0.005;
  const hi = Math.max(...all.map((r) => r.aucMax ?? r.aucMean)) + 0.005;
  const span = hi - lo || 1;
  const barW = (v) => `${((v - lo) / span) * 100}%`;

  const sorted = all.sort((a, b) => (b.aucMax ?? b.aucMean) - (a.aucMax ?? a.aucMean));

  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>Thuật toán</th>
          <th style={{ width: '46%' }}>AUC (trung bình → cực đại)</th>
          <th>Trung bình ± SD</th>
          <th>Cực đại</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((r) => (
          <tr key={r.algorithm || r.label}>
            <td>
              <b>{r.algorithm || r.label}</b>
              {r.isHybrid && <span className="chip" style={{ marginLeft: 8 }}>đề xuất</span>}
              {r.isLive && <span className="chip" style={{ marginLeft: 8, background: 'var(--blue-100)', color: 'var(--blue-accent)' }}>lần chạy này</span>}
            </td>
            <td>
              <div style={{ position: 'relative', height: 18, background: 'var(--parchment-50)', borderRadius: 99 }}>
                <div
                  style={{
                    position: 'absolute', left: barW(r.aucMean), width: 3, top: -3, bottom: -3,
                    background: r.isLive ? '#1D4ED8' : r.isHybrid ? '#2563EB' : 'var(--ink-300)',
                  }}
                />
                {r.aucMax != null && (
                  <div
                    style={{
                      position: 'absolute', left: 0, width: barW(r.aucMax), top: 0, bottom: 0,
                      background: r.isLive ? 'rgba(29,78,216,.18)' : r.isHybrid ? 'rgba(37,99,235,.15)' : 'rgba(148,163,184,.18)',
                      borderRadius: 99,
                    }}
                  />
                )}
              </div>
            </td>
            <td className="mono">{fmt(r.aucMean)}{r.aucStd != null ? ` ± ${fmt(r.aucStd)}` : ''}</td>
            <td className="mono">{r.aucMax != null ? fmt(r.aucMax) : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
