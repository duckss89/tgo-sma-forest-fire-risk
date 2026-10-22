// points: [{ fpr, tpr }], auc: number
export default function RocChart({ points, auc }) {
  if (!points || points.length === 0) return <div className="muted">Chưa có dữ liệu ROC.</div>;
  const S = 260;
  const pad = 34;
  const X = (fpr) => pad + fpr * (S - pad * 1.4);
  const Y = (tpr) => S - pad - tpr * (S - pad * 1.4);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${X(p.fpr).toFixed(1)},${Y(p.tpr).toFixed(1)}`).join(' ');
  const area = `${path} L${X(1).toFixed(1)},${Y(0).toFixed(1)} Z`;

  return (
    <svg className="chart-svg" viewBox={`0 0 ${S} ${S}`}>
      <line className="chart-axis" x1={pad} y1={S - pad} x2={S - pad * 0.4} y2={S - pad} />
      <line className="chart-axis" x1={pad} y1={S - pad} x2={pad} y2={pad * 0.4} />
      <line x1={X(0)} y1={Y(0)} x2={X(1)} y2={Y(1)} stroke="var(--line-2)" strokeDasharray="4 4" />
      <path d={area} fill="rgba(37,99,235,0.12)" />
      <path d={path} fill="none" stroke="#2563EB" strokeWidth="2" />
      <text className="chart-label" x={S / 2} y={S - 8} textAnchor="middle">Tỷ lệ dương tính giả (FPR)</text>
      <text className="chart-label" x={12} y={S / 2} textAnchor="middle" transform={`rotate(-90 12 ${S / 2})`}>
        Tỷ lệ dương tính thật (TPR)
      </text>
      <text x={S - pad} y={pad} textAnchor="end" style={{ fontWeight: 700, fontSize: 13, fill: 'var(--ink-900)' }}>
        AUC = {auc?.toFixed(4)}
      </text>
    </svg>
  );
}
