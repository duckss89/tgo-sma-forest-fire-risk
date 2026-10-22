import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsvObjects } from './csv.js';
import { loadRawDataset } from './dataset.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');

let cache = null;
let studyCache = null;

// Điểm cháy NASA FIRMS đã gộp (2023–2025) — bản đóng gói kèm hệ thống.
export function loadFirePoints() {
  if (cache) return cache;
  const text = fs.readFileSync(path.join(DATA_DIR, 'firms_lamdong_2023_2025.csv'), 'utf8');
  const { records } = parseCsvObjects(text);
  cache = records
    .map((r) => ({
      lat: Number(r.latitude),
      lon: Number(r.longitude),
      date: r.acq_date,
      year: r.acq_date ? Number(r.acq_date.slice(0, 4)) : null,
      frp: Number(r.frp) || 0,
      brightness: Number(r.brightness) || 0,
      confidence: r.confidence,
      daynight: r.daynight,
    }))
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon));
  return cache;
}

export function firePointsForYear(year) {
  const all = loadFirePoints();
  if (!year || year === 'all') return all;
  return all.filter((r) => r.year === Number(year));
}

// Các điểm cháy thực tế dùng trong nghiên cứu: điểm fire=1 của tập huấn luyện
// (NASA FIRMS 2023–2025, đã lọc trong vùng nghiên cứu, có đủ đặc trưng).
export function studyFirePoints() {
  if (studyCache) return studyCache;
  const { rows } = loadRawDataset();
  studyCache = rows
    .filter((r) => r.fire === 1)
    .map((r) => ({
      lat: r.lat, lon: r.lon, date: r.date, year: r.year,
    }));
  return studyCache;
}

export { DATA_DIR };
