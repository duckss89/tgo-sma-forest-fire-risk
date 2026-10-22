// Tích hợp API bên ngoài.
//  - Open-Meteo: dự báo thời tiết 7 ngày (miễn phí, không cần khóa).
//  - NASA FIRMS: điểm cháy gần thời gian thực (cần MAP_KEY miễn phí, cấu hình qua .env).
// Node >= 18 có sẵn fetch toàn cục.

import { parseCsvObjects } from '../data/csv.js';

const LAMDONG_BBOX = { west: 107.15, south: 11.2, east: 108.75, north: 12.35 };
// Trạm đại diện: Đà Lạt, Bảo Lộc, Di Linh
export const STATIONS = [
  { key: 'DaLat', name: 'Đà Lạt', lat: 11.9404, lon: 108.4583 },
  { key: 'BaoLoc', name: 'Bảo Lộc', lat: 11.5308, lon: 107.8078 },
  { key: 'DiLinh', name: 'Di Linh', lat: 11.5806, lon: 108.0706 },
];

async function fetchJson(url, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Dự báo 7 ngày cho một trạm.
export async function forecastForStation(station) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${station.lat}`
    + `&longitude=${station.lon}`
    + '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,'
    + 'relative_humidity_2m_mean,wind_speed_10m_max'
    + '&timezone=Asia%2FBangkok&forecast_days=7';
  const data = await fetchJson(url);
  const d = data.daily;
  return d.time.map((date, i) => ({
    date,
    tMax: d.temperature_2m_max[i],
    tMin: d.temperature_2m_min[i],
    precip: d.precipitation_sum[i],
    humidity: d.relative_humidity_2m_mean[i],
    windMax: d.wind_speed_10m_max[i],
  }));
}

export async function forecastAll() {
  const results = await Promise.all(
    STATIONS.map(async (s) => {
      try {
        return { station: s, days: await forecastForStation(s), ok: true };
      } catch (err) {
        return { station: s, days: [], ok: false, error: String(err.message || err) };
      }
    }),
  );
  return results;
}

// Điểm cháy NASA FIRMS gần thời gian thực (nếu có MAP_KEY).
export async function firmsRecent({ mapKey, dayRange = 7, source = 'VIIRS_SNPP_NRT' }) {
  if (!mapKey) return { available: false, points: [], reason: 'Chưa cấu hình FIRMS_MAP_KEY' };
  const { west, south, east, north } = LAMDONG_BBOX;
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${mapKey}/${source}/`
    + `${west},${south},${east},${north}/${dayRange}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const { records } = parseCsvObjects(text);
    const points = records
      .map((r) => ({
        lat: Number(r.latitude),
        lon: Number(r.longitude),
        date: r.acq_date,
        frp: Number(r.frp) || 0,
        confidence: r.confidence,
        daynight: r.daynight,
      }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
    return { available: true, points, source, dayRange };
  } catch (err) {
    return { available: false, points: [], reason: String(err.message || err) };
  } finally {
    clearTimeout(timer);
  }
}

export { LAMDONG_BBOX };
