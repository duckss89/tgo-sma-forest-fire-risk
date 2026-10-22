import express from 'express';
import { config } from '../config.js';
import {
  createJob, getJob, getJobRaster, publicJob, subscribe, listJobs,
} from '../jobs/jobManager.js';
import { loadBoundary } from '../data/geo.js';
import { firePointsForYear, studyFirePoints } from '../data/fires.js';
import { availableYears } from '../data/dataset.js';
import { computeFriRaster, RISK_CLASSES } from '../data/friRaster.js';
import { referenceComparison } from '../data/reference.js';
import { forecastAll, firmsRecent } from '../services/external.js';
import { forecastRisk } from '../core/forecastRisk.js';
import {
  listHistory, addHistory, removeHistory, clearHistory,
} from '../data/history.js';
import { parseCsvObjects } from '../data/csv.js';
import { FEATURE_META, FEATURE_COLS } from '../core/constraints.js';

const router = express.Router();

// Kho tải lên tạm (demo 1 người dùng)
const uploads = { fires: null, meteo: null };

function refWeightsVector() {
  const ref = referenceComparison().weights;
  const map = Object.fromEntries(ref.map((r) => [r.feature, r.weight]));
  return FEATURE_COLS.map((f) => map[f] ?? 0);
}

// -------- META / cấu hình --------
router.get('/meta', (req, res) => {
  res.json({
    limits: config.limits,
    features: FEATURE_COLS.map((f) => ({ key: f, ...FEATURE_META[f] })),
    riskClasses: RISK_CLASSES,
    years: availableYears(),
    firmsConfigured: Boolean(config.firmsMapKey),
  });
});

// -------- THAM CHIẾU (số liệu đề tài gốc) --------
router.get('/reference', (req, res) => {
  res.json(referenceComparison());
});

// -------- TỐI ƯU HÓA --------
router.post('/optimize', (req, res) => {
  const job = createJob(req.body || {}, config.limits);
  res.status(201).json(publicJob(job));
});

router.get('/optimize/:id', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Không tìm thấy phiên chạy' });
  return res.json(publicJob(job));
});

// Server-Sent Events: tiến trình theo thời gian thực
router.get('/optimize/:id/stream', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).end();

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(`data: ${JSON.stringify({ type: 'snapshot', job: publicJob(job) })}\n\n`);

  const unsub = subscribe(job.id, (payload) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
    if (payload.type === 'done' || payload.type === 'error') res.end();
  });
  const ping = setInterval(() => res.write(': ping\n\n'), 20000);

  req.on('close', () => {
    clearInterval(ping);
    unsub();
  });
  return undefined;
});

router.get('/jobs', (req, res) => res.json(listJobs()));

// -------- BẢN ĐỒ --------
router.get('/map/boundary', (req, res) => {
  res.json(loadBoundary().geojson);
});

router.get('/map/fires', (req, res) => {
  const { year, source } = req.query;
  if (source === 'upload' && uploads.fires) {
    return res.json({ source: 'upload', points: uploads.fires });
  }
  if (year && year !== 'all') {
    return res.json({ source: 'bundled', points: firePointsForYear(year) });
  }
  // mặc định: các điểm cháy dùng trong nghiên cứu (fire=1 trong tập huấn luyện)
  const pts = studyFirePoints();
  return res.json({ source: 'study', count: pts.length, points: pts });
});

// Raster FRI theo bộ trọng số. jobId -> dùng raster đã tính của lần chạy đó
// (chứa base64 ảnh + mặt nạ); không có jobId -> tính theo trọng số tham chiếu.
router.get('/map/fri', (req, res) => {
  const { jobId } = req.query;
  let raster = null;
  let origin = 'reference';
  if (jobId) {
    raster = getJobRaster(jobId);
    if (raster) origin = 'job';
  }
  if (!raster) raster = computeFriRaster(refWeightsVector());
  res.json({
    origin,
    year: raster.year,
    width: raster.width,
    height: raster.height,
    bbox: raster.bbox,
    p1: raster.p1,
    p99: raster.p99,
    note: raster.note,
    data: raster.dataB64,
    distribution: raster.distribution,
    highVeryHighPct: raster.highVeryHighPct,
  });
});

// -------- DỰ BÁO / API NGOÀI --------
router.get('/weather/forecast', async (req, res) => {
  const { jobId } = req.query;
  let weights = refWeightsVector();
  if (jobId) {
    const job = getJob(jobId);
    if (job?.result?.weightsVector) weights = job.result.weightsVector;
  }
  try {
    const stations = await forecastAll();
    const withRisk = stations.map((s) => ({
      station: s.station,
      ok: s.ok,
      error: s.error,
      days: s.ok ? forecastRisk(weights, s.days) : [],
    }));
    res.json({ stations: withRisk });
  } catch (err) {
    res.status(502).json({ error: String(err.message || err) });
  }
});

router.get('/firms/recent', async (req, res) => {
  const out = await firmsRecent({
    mapKey: config.firmsMapKey,
    dayRange: Math.min(10, Number(req.query.days) || 7),
  });
  res.json(out);
});

// -------- TẢI LÊN --------
// Nhận CSV thô (text/csv hoặc text/plain)
router.post('/upload/fires', express.text({ type: '*/*', limit: '20mb' }), (req, res) => {
  try {
    const { records } = parseCsvObjects(req.body || '');
    const pts = records
      .map((r) => ({
        lat: Number(r.latitude ?? r.lat),
        lon: Number(r.longitude ?? r.lon ?? r.lng),
        date: r.acq_date || r.date || null,
        frp: Number(r.frp) || 0,
      }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
    if (pts.length === 0) {
      return res.status(400).json({ ok: false, error: 'Không đọc được cột latitude/longitude' });
    }
    uploads.fires = pts;
    return res.json({ ok: true, count: pts.length });
  } catch (err) {
    return res.status(400).json({ ok: false, error: String(err.message || err) });
  }
});

router.post('/upload/meteo', express.text({ type: '*/*', limit: '20mb' }), (req, res) => {
  try {
    const { header, records } = parseCsvObjects(req.body || '');
    const need = ['T2M', 'RH2M', 'WS2M', 'PRECTOTCORR'];
    const found = need.filter((c) => header.includes(c));
    if (found.length < 2) {
      return res.status(400).json({
        ok: false,
        error: `CSV khí tượng cần các cột: ${need.join(', ')} (tìm thấy: ${found.join(', ') || 'không có'})`,
      });
    }
    const stats = {};
    for (const c of found) {
      const vals = records.map((r) => Number(r[c])).filter(Number.isFinite);
      stats[c] = {
        n: vals.length,
        min: Math.min(...vals),
        max: Math.max(...vals),
        mean: Number((vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2)),
      };
    }
    uploads.meteo = { rows: records.length, columns: found, stats };
    return res.json({ ok: true, ...uploads.meteo });
  } catch (err) {
    return res.status(400).json({ ok: false, error: String(err.message || err) });
  }
});

router.get('/upload/status', (req, res) => {
  res.json({
    fires: uploads.fires ? { count: uploads.fires.length } : null,
    meteo: uploads.meteo,
  });
});

// -------- LỊCH SỬ --------
router.get('/history', (req, res) => res.json(listHistory()));

router.post('/history', (req, res) => {
  const { jobId } = req.body || {};
  const job = getJob(jobId);
  if (!job || !job.result) {
    return res.status(400).json({ error: 'Phiên chạy chưa hoàn tất' });
  }
  const r = job.result;
  const record = addHistory({
    note: job.params.note,
    params: job.params,
    trainingAuc: r.training.auc,
    testAuc: r.test.auc,
    testF1: r.test.f1,
    fitness: r.training.fitness,
    elapsedMs: r.training.elapsedMs,
    weights: r.weights,
    runsSummary: r.runsSummary,
    yearlyValidation: r.yearlyValidation,
    convergenceTail: r.convergence.slice(-1)[0] || null,
  });
  return res.status(201).json(record);
});

router.delete('/history/:id', (req, res) => {
  removeHistory(req.params.id);
  res.json({ ok: true });
});

router.delete('/history', (req, res) => {
  clearHistory();
  res.json({ ok: true });
});

export default router;
