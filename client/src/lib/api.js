const BASE = '/api';

async function req(pathname, options = {}) {
  const res = await fetch(BASE + pathname, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j.error || msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  meta: () => req('/meta'),
  reference: () => req('/reference'),

  startOptimize: (params) => req('/optimize', { method: 'POST', body: JSON.stringify(params) }),
  getJob: (id) => req(`/optimize/${id}`),
  streamUrl: (id) => `${BASE}/optimize/${id}/stream`,

  boundary: () => req('/map/boundary'),
  fires: (year, source) => req(`/map/fires?year=${year || 'all'}${source ? `&source=${source}` : ''}`),
  friRaster: (jobId) => req(`/map/fri${jobId ? `?jobId=${jobId}` : ''}`),

  forecast: (jobId) => req(`/weather/forecast${jobId ? `?jobId=${jobId}` : ''}`),
  firmsRecent: (days) => req(`/firms/recent${days ? `?days=${days}` : ''}`),

  uploadFires: (csvText) => req('/upload/fires', { method: 'POST', headers: { 'Content-Type': 'text/csv' }, body: csvText }),
  uploadMeteo: (csvText) => req('/upload/meteo', { method: 'POST', headers: { 'Content-Type': 'text/csv' }, body: csvText }),
  uploadStatus: () => req('/upload/status'),

  history: () => req('/history'),
  saveHistory: (jobId) => req('/history', { method: 'POST', body: JSON.stringify({ jobId }) }),
  deleteHistory: (id) => req(`/history/${id}`, { method: 'DELETE' }),
  clearHistory: () => req('/history', { method: 'DELETE' }),
};
