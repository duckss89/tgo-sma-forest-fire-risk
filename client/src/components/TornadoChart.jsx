// data: { baseAuc, factor, items: [{ label, deltaUp, deltaDown, range }] }
export default function TornadoChart({ data }) {
  if (!data || !data.items?.length) return <div className="muted">Chưa có dữ liệu độ nhạy.</div>;
  const items = data.items;
  const maxAbs = Math.max(...items.flatMap((d) => [Math.abs(d.deltaUp), Math.abs(d.deltaDown)]), 1e-5);
  const rowH = 30;
  const W = 480;
  const H = items.length * rowH + 36;
  const cx = 210;
  const half = 150;
  const X = (v) => cx + (v / maxAbs) * half;

  return (
    <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`}>
      <line x1={cx} y1={6} x2={cx} y2={H - 24} stroke="var(--line-2)" />
      {items.map((d, i) => {
        const y = 10 + i * rowH;
        const xUp = X(d.deltaUp);
        const xDown = X(d.deltaDown);
        return (
          <g key={d.label}>
            <text x={cx - half - 8} y={y + rowH / 2} textAnchor="end" className="chart-label" style={{ fontSize: 11 }}>
              {d.label}
            </text>
            <rect
              x={Math.min(cx, xUp)} y={y + 3} width={Math.abs(xUp - cx)} height={rowH / 2 - 4}
              fill="#2563EB" opacity="0.85"
            />
            <rect
              x={Math.min(cx, xDown)} y={y + rowH / 2 + 1} width={Math.abs(xDown - cx)} height={rowH / 2 - 4}
              fill="#94A3B8"
            />
          </g>
        );
      })}
      <text x={cx - half} y={H - 8} className="chart-label">−{maxAbs.toFixed(4)} ΔAUC</text>
      <text x={cx + half} y={H - 8} textAnchor="end" className="chart-label">+{maxAbs.toFixed(4)} ΔAUC</text>
      <text x={cx} y={H - 8} textAnchor="middle" className="chart-label">
        gốc {data.baseAuc?.toFixed(4)} · ±{Math.round(data.factor * 100)}% trọng số
      </text>
    </svg>
  );
}
