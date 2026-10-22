import { useState } from 'react';

// data: [{ iter, fitness, auc }]
export default function ConvergenceChart({ data, metric = 'fitness' }) {
  const [hover, setHover] = useState(null);
  if (!data || data.length === 0) return <div className="muted">Chưa có dữ liệu hội tụ.</div>;

  const W = 480;
  const H = 240;
  const padL = 52;
  const padR = 14;
  const padT = 12;
  const padB = 30;
  const xs = data.map((d) => d.iter);
  const ys = data.map((d) => d[metric]);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const ySpan = yMax - yMin || 1;

  const xOf = (i) => padL + ((i - xMin) / (xMax - xMin || 1)) * (W - padL - padR);
  const yOf = (v) => H - padB - ((v - yMin) / ySpan) * (H - padT - padB);

  const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xOf(d.iter).toFixed(1)},${yOf(d[metric]).toFixed(1)}`).join(' ');
  const ticks = 4;

  return (
    <div style={{ position: 'relative' }}>
      <svg
        className="chart-svg"
        viewBox={`0 0 ${W} ${H}`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * W;
          const frac = Math.min(1, Math.max(0, (x - padL) / (W - padL - padR)));
          const idx = Math.round(frac * (data.length - 1));
          setHover(data[idx] ? { ...data[idx], px: xOf(data[idx].iter), py: yOf(data[idx][metric]) } : null);
        }}
      >
        {Array.from({ length: ticks + 1 }).map((_, i) => {
          const v = yMin + (ySpan * i) / ticks;
          const y = yOf(v);
          return (
            <g key={i}>
              <line className="chart-grid" x1={padL} x2={W - padR} y1={y} y2={y} />
              <text className="chart-label" x={padL - 8} y={y + 3} textAnchor="end">{v.toFixed(4)}</text>
            </g>
          );
        })}
        <line className="chart-axis" x1={padL} x2={W - padR} y1={H - padB} y2={H - padB} />
        <path d={path} fill="none" stroke="#2563EB" strokeWidth="2" />
        {hover && <circle cx={hover.px} cy={hover.py} r="4" fill="#1D4ED8" />}
        <text className="chart-label" x={(W) / 2} y={H - 6} textAnchor="middle">Vòng lặp</text>
      </svg>
      {hover && (
        <div
          className="map-panel"
          style={{
            position: 'absolute', left: `${(hover.px / W) * 100}%`, top: 0,
            transform: 'translate(-50%,-100%)', pointerEvents: 'none', whiteSpace: 'nowrap',
          }}
        >
          Vòng {hover.iter} · {metric === 'auc' ? 'AUC' : 'fitness'} <b>{hover[metric].toFixed(5)}</b>
        </div>
      )}
    </div>
  );
}
