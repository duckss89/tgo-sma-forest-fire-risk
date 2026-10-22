import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Stepper from '../components/Stepper.jsx';
import { api } from '../lib/api.js';
import { useApp } from '../state/AppContext.jsx';
import { fmt, fmtSeconds } from '../lib/risk.js';

const DEFAULTS = { popSize: 50, maxIter: 120, numRuns: 1, seed: 42, note: '' };

export default function Config() {
  const navigate = useNavigate();
  const { meta, setJobId, setJob } = useApp();
  const [form, setForm] = useState(DEFAULTS);
  const [running, setRunning] = useState(false);
  const [job, setLocalJob] = useState(null);
  const [error, setError] = useState(null);
  const esRef = useRef(null);
  const logRef = useRef(null);

  const limits = meta?.limits || {
    popSize: { min: 10, max: 120 }, maxIter: { min: 20, max: 300 }, numRuns: { min: 1, max: 10 },
  };

  useEffect(() => () => esRef.current?.close(), []);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [job?.log?.length]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const start = async () => {
    setError(null);
    setRunning(true);
    setLocalJob(null);
    try {
      const created = await api.startOptimize({
        popSize: Number(form.popSize),
        maxIter: Number(form.maxIter),
        numRuns: Number(form.numRuns),
        seed: Number(form.seed),
        note: form.note,
      });
      setJobId(created.id);
      setLocalJob(created);

      const es = new EventSource(api.streamUrl(created.id));
      esRef.current = es;
      es.onmessage = (evt) => {
        const payload = JSON.parse(evt.data);
        if (payload.job) setLocalJob(payload.job);
        if (payload.type === 'done' || payload.job?.status === 'done') {
          es.close();
          setRunning(false);
          setJob(payload.job);
        }
        if (payload.type === 'error' || payload.job?.status === 'error') {
          es.close();
          setRunning(false);
          setError(payload.job?.error || 'Lỗi khi chạy tối ưu hóa');
        }
      };
      es.onerror = () => {
        es.close();
        setRunning(false);
        // fallback: poll
        api.getJob(created.id).then((j) => {
          setLocalJob(j);
          if (j.status === 'done') setJob(j);
        }).catch(() => setError('Mất kết nối luồng tiến trình'));
      };
    } catch (err) {
      setRunning(false);
      setError(String(err.message));
    }
  };

  const pct = job?.progress?.pct || 0;
  const done = job?.status === 'done';

  return (
    <>
      <Stepper current={2} />
      <div className="wrap">
        <div className="step-header">
          <p className="step-header__eyebrow">Bước 2</p>
          <h2 className="step-header__title">Cấu hình và chạy thuật toán</h2>
          <p className="step-header__desc">
            Thiết lập tham số cho TGO&#8209;SMA Hybrid. Lõi thuật toán chạy trực tiếp trên máy chủ;
            tiến trình cập nhật theo thời gian thực.
          </p>
        </div>

        <div className="grid-2" style={{ padding: '20px 0 60px', gridTemplateColumns: '0.9fr 1.1fr' }}>
          <div className="card">
            <div className="card__head">
              <div className="card__title">Tham số</div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm(DEFAULTS)} disabled={running}>
                Đặt lại mặc định
              </button>
            </div>
            <div className="card__body">
              <Field
                label="Kích thước quần thể" desc={`Số cá thể mỗi vòng lặp (${limits.popSize.min}–${limits.popSize.max})`}
                value={form.popSize} min={limits.popSize.min} max={limits.popSize.max}
                onChange={(v) => set('popSize', v)} disabled={running}
              />
              <Field
                label="Số vòng lặp tối đa" desc={`Số thế hệ TGO+SMA (${limits.maxIter.min}–${limits.maxIter.max})`}
                value={form.maxIter} min={limits.maxIter.min} max={limits.maxIter.max}
                onChange={(v) => set('maxIter', v)} disabled={running}
              />
              <Field
                label="Số lần chạy độc lập" desc={`Lấy nghiệm tốt nhất qua các lần chạy (${limits.numRuns.min}–${limits.numRuns.max})`}
                value={form.numRuns} min={limits.numRuns.min} max={limits.numRuns.max}
                onChange={(v) => set('numRuns', v)} disabled={running}
              />
              <Field
                label="Hạt giống ngẫu nhiên (seed)" desc="Cùng seed → cùng kết quả (tái lập được)"
                value={form.seed} min={0} max={999999}
                onChange={(v) => set('seed', v)} disabled={running}
              />
              <div className="field">
                <label htmlFor="note">Ghi chú (tùy chọn)</label>
                <input id="note" type="text" value={form.note} maxLength={200}
                  onChange={(e) => set('note', e.target.value)} disabled={running}
                  placeholder="VD: thử pop=80, iter=150"
                />
              </div>
              <div style={{ marginTop: 8 }}>
                {!running && !done && (
                  <button type="button" className="btn btn-primary" onClick={start} style={{ width: '100%' }}>
                    Bắt đầu chạy tối ưu hóa
                  </button>
                )}
                {running && <div className="banner info">Đang chạy… có thể mất từ vài chục giây đến vài phút.</div>}
                {done && (
                  <button type="button" className="btn btn-primary" style={{ width: '100%' }} onClick={() => navigate('/results')}>
                    Xem kết quả →
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card__head"><div className="card__title">Tiến trình</div></div>
            <div className="card__body">
              {!job && <p className="muted">Chưa chạy. Thiết lập tham số bên trái rồi nhấn &laquo;Bắt đầu&raquo;.</p>}
              {job && (
                <>
                  <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
                  <div className="progress-stats">
                    <div>
                      <div className="progress-stat__label">Vòng lặp</div>
                      <div className="progress-stat__value">{job.progress?.iter || 0}/{job.progress?.maxIter || form.maxIter}</div>
                    </div>
                    <div>
                      <div className="progress-stat__label">Fitness tốt nhất</div>
                      <div className="progress-stat__value">{fmt(job.progress?.bestFitness, 5)}</div>
                    </div>
                    <div>
                      <div className="progress-stat__label">AUC tốt nhất</div>
                      <div className="progress-stat__value">{fmt(job.progress?.bestAuc, 4)}</div>
                    </div>
                  </div>
                  {job.params?.numRuns > 1 && (
                    <p className="card__hint" style={{ marginTop: 8 }}>Lần chạy {job.progress?.run || 0}/{job.params.numRuns}</p>
                  )}
                  <div className="run-log" ref={logRef}>
                    {(job.log || []).map((l, i) => <div key={i}>{l.text}</div>)}
                  </div>
                  {done && job.result && (
                    <div className="stat-row" style={{ marginTop: 14 }}>
                      <div className="stat"><div className="stat__label">AUC (test)</div><div className="stat__value">{fmt(job.result.test.auc, 4)}</div></div>
                      <div className="stat"><div className="stat__label">F1 (test)</div><div className="stat__value">{fmt(job.result.test.f1, 4)}</div></div>
                      <div className="stat"><div className="stat__label">Fitness</div><div className="stat__value">{fmt(job.result.training.fitness, 4)}</div></div>
                      <div className="stat"><div className="stat__label">Thời gian</div><div className="stat__value">{fmtSeconds(job.result.training.elapsedMs)}</div></div>
                    </div>
                  )}
                </>
              )}
              {error && <div className="banner warn" style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>{error}</div>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Field({ label, desc, value, min, max, onChange, disabled }) {
  return (
    <div className="field">
      <div className="field__label-row">
        <label>{label}</label>
        <span className="field__default">{min}–{max}</span>
      </div>
      <input
        type="number" value={value} min={min} max={max} disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="field__desc">{desc}</div>
    </div>
  );
}
