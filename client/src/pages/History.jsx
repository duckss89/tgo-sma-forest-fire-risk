import { useEffect, useState } from 'react';
import Stepper from '../components/Stepper.jsx';
import { api } from '../lib/api.js';
import { useApp } from '../state/AppContext.jsx';
import { fmt, fmtSeconds } from '../lib/risk.js';

export default function History() {
  const { jobId, job } = useApp();
  const [rows, setRows] = useState([]);
  const [saved, setSaved] = useState(false);
  const [compare, setCompare] = useState([]);

  const load = () => api.history().then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  const canSave = job?.status === 'done' && job?.result && !saved;

  const save = async () => {
    await api.saveHistory(jobId);
    setSaved(true);
    load();
  };

  const toggle = (id) => setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id].slice(-2)));
  const [a, b] = compare.map((id) => rows.find((r) => r.id === id)).filter(Boolean);

  return (
    <>
      <Stepper current={job?.result ? 3 : 1} />
      <div className="wrap">
        <div className="step-header step-header__row">
          <div>
            <p className="step-header__eyebrow">Lịch sử</p>
            <h2 className="step-header__title">Lịch sử các lần chạy</h2>
            <p className="step-header__desc">Lưu lại và đối chiếu các lần chạy TGO-SMA khác nhau.</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {canSave && <button type="button" className="btn btn-primary btn-sm" onClick={save}>Lưu lần chạy hiện tại</button>}
            {rows.length > 0 && (
              <button type="button" className="btn btn-danger btn-sm" onClick={async () => { await api.clearHistory(); load(); }}>
                Xóa lịch sử
              </button>
            )}
          </div>
        </div>

        {rows.length === 0 && <div className="banner info" style={{ marginTop: 16 }}>Chưa có lần chạy nào được lưu.</div>}

        {rows.length > 0 && (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card__body" style={{ overflowX: 'auto' }}>
              <table className="tbl" style={{ minWidth: 720 }}>
                <thead>
                  <tr>
                    <th>So sánh</th><th>Thời điểm</th><th>Tham số</th><th>AUC (test)</th>
                    <th>F1 (test)</th><th>Fitness</th><th>Thời gian</th><th>Ghi chú</th><th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td><input type="checkbox" checked={compare.includes(r.id)} onChange={() => toggle(r.id)} /></td>
                      <td className="mono">{new Date(r.savedAt).toLocaleString('vi-VN')}</td>
                      <td className="mono muted">pop {r.params.popSize} · iter {r.params.maxIter} · ×{r.params.numRuns}</td>
                      <td className="mono">{fmt(r.testAuc, 4)}</td>
                      <td className="mono">{fmt(r.testF1, 4)}</td>
                      <td className="mono">{fmt(r.fitness, 4)}</td>
                      <td className="mono">{fmtSeconds(r.elapsedMs)}</td>
                      <td>{r.note || '—'}</td>
                      <td>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={async () => { await api.deleteHistory(r.id); load(); }}>Xóa</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {a && b && (
          <div className="card" style={{ margin: '22px 0 60px' }}>
            <div className="card__head"><div className="card__title">So sánh trọng số: A vs B</div></div>
            <div className="card__body" style={{ overflowX: 'auto' }}>
              <table className="tbl" style={{ minWidth: 460 }}>
                <thead>
                  <tr><th>Biến</th><th>A ({new Date(a.savedAt).toLocaleDateString('vi-VN')})</th><th>B ({new Date(b.savedAt).toLocaleDateString('vi-VN')})</th><th>Chênh lệch</th></tr>
                </thead>
                <tbody>
                  {a.weights.map((w, i) => {
                    const wb = b.weights[i]?.weight ?? 0;
                    return (
                      <tr key={w.feature}>
                        <td><b>{w.feature}</b></td>
                        <td className="mono">{fmt(w.weight, 4)}</td>
                        <td className="mono">{fmt(wb, 4)}</td>
                        <td className="mono">{(wb - w.weight >= 0 ? '+' : '')}{fmt(wb - w.weight, 4)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
