import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Stepper from '../components/Stepper.jsx';
import RiskMap from '../components/RiskMap.jsx';
import ConvergenceChart from '../components/ConvergenceChart.jsx';
import RocChart from '../components/RocChart.jsx';
import ConfusionMatrix from '../components/ConfusionMatrix.jsx';
import WeightsTable from '../components/WeightsTable.jsx';
import TornadoChart from '../components/TornadoChart.jsx';
import ComparisonChart from '../components/ComparisonChart.jsx';
import ForecastStrip from '../components/ForecastStrip.jsx';
import { api } from '../lib/api.js';
import { useApp } from '../state/AppContext.jsx';
import {
  fmt, fmtPct, fmtSeconds, pValue, FRI_GRADIENT,
} from '../lib/risk.js';

function downloadCsv(name, rows) {
  const csv = rows.map((r) => r.map((c) => (typeof c === 'string' && c.includes(',') ? `"${c}"` : c)).join(',')).join('\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function Results() {
  const navigate = useNavigate();
  const { jobId, job: ctxJob } = useApp();
  const [job, setJob] = useState(ctxJob?.result ? ctxJob : null);
  const [reference, setReference] = useState(null);
  const [boundary, setBoundary] = useState(null);
  const [friRaster, setFriRaster] = useState(null);
  const [fires, setFires] = useState([]);
  const [forecast, setForecast] = useState(null);
  const [convMetric, setConvMetric] = useState('fitness');
  const [layers, setLayers] = useState({ base: false, risk: true, fire: false });
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!jobId) return;
    api.getJob(jobId).then((j) => {
      if (j.status === 'done') setJob(j);
      else setErr('Phiên chạy chưa hoàn tất.');
    }).catch((e) => setErr(String(e.message)));
    api.reference().then(setReference).catch(() => {});
    api.boundary().then(setBoundary).catch(() => {});
    api.friRaster(jobId).then(setFriRaster).catch(() => {});
    api.forecast(jobId).then(setForecast).catch(() => {});
    api.fires('all').then((r) => setFires(r.points || [])).catch(() => {});
  }, [jobId]);

  const result = job?.result;

  // Đối chiếu với kết quả TGO-SMA đã công bố (Bảng 4.1: AUC ≈ 0,8335)
  const gain = useMemo(() => {
    if (!result || !reference) return null;
    const hybrid = reference.summary.find((s) => s.isHybrid);
    const target = hybrid ? hybrid.aucMax : 0.8335;
    return {
      target,
      liveAuc: result.runsSummary.aucMax,
      deltaPct: ((result.runsSummary.aucMax - target) / target) * 100,
    };
  }, [result, reference]);

  if (!jobId) {
    return (
      <>
        <Stepper current={3} />
        <div className="wrap" style={{ padding: '60px 0' }}>
          <div className="banner info">Chưa có kết quả. Hãy chạy tối ưu hóa ở bước 2.</div>
          <button type="button" className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/config')}>
            → Đến bước cấu hình
          </button>
        </div>
      </>
    );
  }

  if (err && !result) {
    return (
      <>
        <Stepper current={3} />
        <div className="wrap" style={{ padding: '60px 0' }}><div className="banner warn">{err}</div></div>
      </>
    );
  }

  if (!result) {
    return (
      <>
        <Stepper current={3} />
        <div className="wrap" style={{ padding: '60px 0' }}><span className="spinner" /> Đang tải kết quả…</div>
      </>
    );
  }

  const exportWeights = () => downloadCsv(
    'trong_so_toi_uu.csv',
    [['Feature', 'Weight', 'Constraint_Low', 'Constraint_High', 'Direction'],
      ...result.weightsTable.map((w) => [w.feature, w.weight, w.constraint[0], w.constraint[1], w.direction])],
  );
  const exportValidation = () => downloadCsv(
    'validation_theo_nam.csv',
    [['Year', 'AUC', 'Accuracy', 'Precision', 'Recall', 'F1', 'FireFRI_Mean', 'NonFireFRI_Mean', 'HighVeryHigh_Pct', 'MannWhitney_P'],
      ...result.yearlyValidation.map((v) => [
        v.year, v.auc, v.accuracy, v.precision, v.recall, v.f1,
        v.fireFriMean, v.nonFireFriMean, v.highVeryHighPct, v.mannWhitneyP,
      ])],
  );

  return (
    <>
      <Stepper current={3} />
      <div className="wrap">
        <div className="step-header step-header__row">
          <div>
            <p className="step-header__eyebrow">Bước 3</p>
            <h2 className="step-header__title">Kết quả — TGO-SMA Hybrid</h2>
            <p className="step-header__desc">
              {job.params.note ? `Ghi chú: ${job.params.note} · ` : ''}
              pop {job.params.popSize} · iter {job.params.maxIter} · {job.params.numRuns} lần chạy ·
              {' '}{fmtSeconds(result.training.elapsedMs)}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={exportWeights}>Xuất trọng số (CSV)</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={exportValidation}>Xuất validation (CSV)</button>
            <button type="button" className="btn btn-dark btn-sm" onClick={() => window.print()}>In / PDF</button>
          </div>
        </div>

        <div className="stat-row" style={{ margin: '8px 0 22px' }}>
          <div className="stat"><div className="stat__label">AUC (test) tốt nhất</div><div className="stat__value">{fmt(result.runsSummary.aucMax, 4)}</div></div>
          <div className="stat"><div className="stat__label">AUC trung bình ± SD</div><div className="stat__value" style={{ fontSize: 15 }}>{fmt(result.runsSummary.aucMean, 4)} ± {fmt(result.runsSummary.aucStd, 4)}</div></div>
          <div className="stat"><div className="stat__label">F1 (test)</div><div className="stat__value">{fmt(result.test.f1, 4)}</div></div>
          <div className="stat"><div className="stat__label">Fitness huấn luyện</div><div className="stat__value">{fmt(result.training.fitness, 4)}</div></div>
        </div>

        {gain && (
          <div className="banner info" style={{ marginBottom: 22 }}>
            Kết quả TGO-SMA đã công bố (Bảng 4.1): AUC ≈ {fmt(gain.target, 4)}.
            {' '}Lần chạy này đạt {fmt(gain.liveAuc, 4)} ({gain.deltaPct >= 0 ? '+' : ''}{gain.deltaPct.toFixed(2)}%).
            {' '}<span className="muted">
              Chênh lệch nhỏ do bộ sinh ngẫu nhiên của JavaScript khác NumPy; tăng số lần chạy để ổn định.
            </span>
          </div>
        )}

        {/* MAP */}
        <div className="card" style={{ marginBottom: 22 }}>
          <div className="card__head">
            <div className="card__title">Bản đồ chỉ số nguy cơ cháy (FRI) — Lâm Đồng</div>
            <div className="card__hint">TGO-SMA Hybrid · {job.params.note || `pop ${job.params.popSize} · iter ${job.params.maxIter}`}</div>
          </div>
          <div className="card__body">
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div className="map-stage" style={{ flex: 1, minWidth: 300, height: 600 }}>
                <RiskMap boundary={boundary} friRaster={friRaster} fires={fires} layers={layers} />
              </div>
              <div style={{ width: 210, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="map-panel">
                  <h4>Fire Risk Index</h4>
                  <div className="fri-colorbar">
                    <div className="fri-colorbar__bar" style={{ background: FRI_GRADIENT, flex: 1 }} />
                    <div className="fri-colorbar__ticks">
                      <span>1,0 — rất cao</span>
                      <span>0,8</span>
                      <span>0,6</span>
                      <span>0,4</span>
                      <span>0,2</span>
                      <span>0,0 — rất thấp</span>
                    </div>
                  </div>
                </div>
                <div className="map-panel">
                  <h4>Phân bố diện tích</h4>
                  {(friRaster?.distribution || []).map((d) => (
                    <div key={d.id} className="legend-row">
                      <span className="legend-swatch" style={{ background: d.color }} />
                      <span>{d.name}</span>
                      <span className="muted mono" style={{ marginLeft: 'auto' }}>{d.percent}%</span>
                    </div>
                  ))}
                  {friRaster && (
                    <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600 }}>
                      Cao + Rất cao: {fmtPct(friRaster.highVeryHighPct)}
                      <div className="muted" style={{ fontWeight: 400 }}>báo cáo mục 4.3: ~38%</div>
                    </div>
                  )}
                </div>
                <div className="map-panel">
                  <h4>Lớp hiển thị</h4>
                  <label className="layer-row">
                    <input
                      type="checkbox"
                      checked={layers.fire}
                      onChange={(e) => setLayers((s) => ({ ...s, fire: e.target.checked }))}
                    />
                    <span>Điểm cháy FIRMS ({fires.length.toLocaleString('vi-VN')})</span>
                  </label>
                  <label className="layer-row">
                    <input
                      type="checkbox"
                      checked={layers.base}
                      onChange={(e) => setLayers((s) => ({ ...s, base: e.target.checked }))}
                    />
                    <span>Nền địa lý (OSM)</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CONVERGENCE */}
        <div className="card" style={{ marginBottom: 22 }}>
          <div className="card__head">
            <div className="card__title">Đường cong hội tụ</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {['fitness', 'auc'].map((m) => (
                <button key={m} type="button" className={`btn btn-sm ${convMetric === m ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setConvMetric(m)}>
                  {m === 'fitness' ? 'Fitness' : 'AUC'}
                </button>
              ))}
            </div>
          </div>
          <div className="card__body">
            <ConvergenceChart data={result.convergence} metric={convMetric} />
          </div>
        </div>

        {/* VALIDATION: confusion + ROC */}
        <div className="results-secondary" style={{ marginBottom: 22 }}>
          <div className="card">
            <div className="card__head"><div className="card__title">Ma trận nhầm lẫn (tập kiểm tra)</div></div>
            <div className="card__body"><ConfusionMatrix test={result.test} /></div>
          </div>
          <div className="card">
            <div className="card__head"><div className="card__title">Đường cong ROC</div></div>
            <div className="card__body"><RocChart points={result.test.roc} auc={result.test.auc} /></div>
          </div>
        </div>

        {/* WEIGHTS + TORNADO */}
        <div className="results-secondary" style={{ marginBottom: 22 }}>
          <div className="card">
            <div className="card__head">
              <div className="card__title">Trọng số tối ưu</div>
              <div className="card__hint">FRI = Σ(wᵢ · xᵢ)</div>
            </div>
            <div className="card__body"><WeightsTable rows={result.weightsTable} /></div>
          </div>
          <div className="card">
            <div className="card__head">
              <div className="card__title">Phân tích độ nhạy (tornado)</div>
              <div className="card__hint">Thay đổi AUC khi nhiễu ±25% mỗi trọng số</div>
            </div>
            <div className="card__body"><TornadoChart data={result.sensitivity} /></div>
          </div>
        </div>

        {/* COMPARISON */}
        {reference && (
          <div className="card" style={{ marginBottom: 22 }}>
            <div className="card__head">
              <div className="card__title">So sánh với các thuật toán baseline</div>
              <div className="card__hint">{reference.source}</div>
            </div>
            <div className="card__body">
              <ComparisonChart
                rows={reference.summary}
                live={{
                  label: 'TGO-SMA (lần chạy web)',
                  aucMean: result.runsSummary.aucMean,
                  aucStd: result.runsSummary.aucStd,
                  aucMax: result.runsSummary.aucMax,
                }}
              />
            </div>
          </div>
        )}

        {/* YEARLY VALIDATION */}
        <div className="card" style={{ marginBottom: 22 }}>
          <div className="card__head">
            <div className="card__title">Kiểm chứng với điểm cháy FIRMS theo năm</div>
          </div>
          <div className="card__body" style={{ overflowX: 'auto' }}>
            <table className="tbl" style={{ minWidth: 640 }}>
              <thead>
                <tr>
                  <th>Năm</th><th>AUC</th><th>FRI cháy (TB)</th><th>FRI không cháy (TB)</th>
                  <th>% điểm cháy ở mức Cao+</th><th>Mann–Whitney p</th>
                </tr>
              </thead>
              <tbody>
                {result.yearlyValidation.map((v) => (
                  <tr key={v.year}>
                    <td><b>{v.year}</b></td>
                    <td className="mono">{fmt(v.auc, 4)}</td>
                    <td className="mono">{fmt(v.fireFriMean, 3)}</td>
                    <td className="mono">{fmt(v.nonFireFriMean, 3)}</td>
                    <td className="mono">{fmtPct(v.highVeryHighPct)}</td>
                    <td className="mono">{pValue(v.mannWhitneyP)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FORECAST */}
        <div className="card" style={{ marginBottom: 60 }}>
          <div className="card__head">
            <div className="card__title">Cảnh báo thời tiết cháy rừng — 7 ngày (Open-Meteo)</div>
            <div className="card__hint">Chỉ số thời tiết rút gọn (nhiệt độ · độ ẩm · mưa · gió), không phải mô hình FRI</div>
          </div>
          <div className="card__body stack">
            {!forecast && <span className="muted">Đang tải dự báo…</span>}
            {forecast?.stations?.map((s) => <ForecastStrip key={s.station.key} station={s} />)}
          </div>
        </div>
      </div>
    </>
  );
}
