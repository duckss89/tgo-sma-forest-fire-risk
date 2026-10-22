import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { friRamp, riskName } from '../lib/risk.js';

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function boundaryRings(boundary) {
  const rings = [];
  for (const feat of boundary?.features || []) {
    const g = feat.geometry;
    if (!g) continue;
    if (g.type === 'Polygon') g.coordinates.forEach((r) => rings.push(r));
    else if (g.type === 'MultiPolygon') g.coordinates.forEach((poly) => poly.forEach((r) => rings.push(r)));
  }
  return rings;
}

// Dựng ảnh FRI từ raster: tô màu liên tục -> nội suy mượt -> cắt theo hình tỉnh.
// Mã hóa: byte 0 = ngoài vùng; 1..255 = FRI.
function renderFriImage(raster, boundary) {
  const {
    width, height, bbox,
  } = raster;
  const data = b64ToBytes(raster.data);
  const n = width * height;

  // giá trị FRI dạng số + giãn nở 2 lớp vào ô rỗng sát mép (cho mượt, sẽ cắt lại)
  const F = new Float32Array(n);
  const M = new Uint8Array(n);
  for (let i = 0; i < n; i += 1) { F[i] = data[i] / 255; M[i] = data[i] > 0 ? 1 : 0; }
  for (let pass = 0; pass < 2; pass += 1) {
    const nf = F.slice();
    const nm = M.slice();
    for (let r = 0; r < height; r += 1) {
      for (let c = 0; c < width; c += 1) {
        const i = r * width + c;
        if (M[i]) continue;
        let s = 0;
        let k = 0;
        for (let dr = -1; dr <= 1; dr += 1) {
          for (let dc = -1; dc <= 1; dc += 1) {
            const rr = r + dr;
            const cc = c + dc;
            if (rr < 0 || cc < 0 || rr >= height || cc >= width) continue;
            const j = rr * width + cc;
            if (M[j]) { s += F[j]; k += 1; }
          }
        }
        if (k) { nf[i] = s / k; nm[i] = 1; }
      }
    }
    F.set(nf);
    M.set(nm);
  }

  const small = document.createElement('canvas');
  small.width = width;
  small.height = height;
  const sctx = small.getContext('2d');
  const img = sctx.createImageData(width, height);
  for (let i = 0; i < n; i += 1) {
    if (!M[i]) { img.data[i * 4 + 3] = 0; continue; }
    const [rr, gg, bb] = friRamp(F[i]);
    img.data[i * 4] = rr;
    img.data[i * 4 + 1] = gg;
    img.data[i * 4 + 2] = bb;
    img.data[i * 4 + 3] = 255;
  }
  sctx.putImageData(img, 0, 0);

  const SCALE = 3;
  const W = width * SCALE;
  const H = height * SCALE;
  const big = document.createElement('canvas');
  big.width = W;
  big.height = H;
  const bctx = big.getContext('2d');
  bctx.imageSmoothingEnabled = true;
  bctx.imageSmoothingQuality = 'high';

  const toX = (lon) => ((lon - bbox.minLon) / (bbox.maxLon - bbox.minLon)) * W;
  const toY = (lat) => ((bbox.maxLat - lat) / (bbox.maxLat - bbox.minLat)) * H;
  const rings = boundaryRings(boundary);
  if (rings.length) {
    const path = new Path2D();
    for (const ring of rings) {
      ring.forEach(([lon, lat], i) => {
        const x = toX(lon);
        const y = toY(lat);
        if (i === 0) path.moveTo(x, y);
        else path.lineTo(x, y);
      });
      path.closePath();
    }
    bctx.save();
    bctx.clip(path);
    bctx.drawImage(small, 0, 0, width, height, 0, 0, W, H);
    bctx.restore();
  } else {
    bctx.drawImage(small, 0, 0, width, height, 0, 0, W, H);
  }
  return big.toDataURL();
}

export default function RiskMap({
  boundary, friRaster, fires, layers,
}) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const refs = useRef({
    base: null, boundary: null, grid: null, fires: null,
  });

  useEffect(() => {
    if (mapRef.current || !elRef.current) return undefined;
    const map = L.map(elRef.current, { preferCanvas: true, zoomControl: true }).setView([11.75, 108.0], 8);
    refs.current.base = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 18,
    });
    mapRef.current = map;

    map.on('click', (e) => {
      const g = refs.current.rasterData;
      if (!g || !refs.current.layers?.risk) return;
      const c = Math.floor(((e.latlng.lng - g.bbox.minLon) / (g.bbox.maxLon - g.bbox.minLon)) * g.width);
      const r = Math.floor(((g.bbox.maxLat - e.latlng.lat) / (g.bbox.maxLat - g.bbox.minLat)) * g.height);
      if (c < 0 || r < 0 || c >= g.width || r >= g.height) return;
      const i = r * g.width + c;
      if (!g._data) g._data = b64ToBytes(g.data);
      if (!g._data[i]) return;
      const fri = g._data[i] / 255;
      const lvl = fri < 0.2 ? 1 : fri < 0.4 ? 2 : fri < 0.6 ? 3 : fri < 0.8 ? 4 : 5;
      L.popup()
        .setLatLng(e.latlng)
        .setContent(`<b>FRI ${fri.toFixed(3)}</b><br/>Mức: ${riskName(lvl)}`)
        .openOn(mapRef.current);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    refs.current.layers = layers;
  }, [layers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const base = refs.current.base;
    if (layers.base) base.addTo(map);
    else map.removeLayer(base);
  }, [layers.base]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !boundary) return;
    if (refs.current.boundary) map.removeLayer(refs.current.boundary);
    const layer = L.geoJSON(boundary, {
      style: {
        color: '#0F2A52', weight: 2, fill: false, opacity: 0.9,
      },
    }).addTo(map);
    refs.current.boundary = layer;
    try {
      const b = layer.getBounds();
      map.fitBounds(b, { padding: [20, 20] });
      map.setMaxBounds(b.pad(0.3));
      map.setMinZoom(Math.max(7, map.getZoom() - 1));
    } catch { /* ignore */ }
  }, [boundary]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (refs.current.grid) {
      map.removeLayer(refs.current.grid);
      refs.current.grid = null;
    }
    if (!friRaster || !layers.risk) return;
    refs.current.rasterData = friRaster;
    const { bbox } = friRaster;
    const bounds = [[bbox.minLat, bbox.minLon], [bbox.maxLat, bbox.maxLon]];
    const overlay = L.imageOverlay(renderFriImage(friRaster, boundary), bounds, {
      opacity: 0.88,
      interactive: false,
      className: 'fri-grid-overlay',
    }).addTo(map);
    refs.current.grid = overlay;
  }, [friRaster, boundary, layers.risk]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (refs.current.fires) {
      map.removeLayer(refs.current.fires);
      refs.current.fires = null;
    }
    if (!fires || !fires.length || !layers.fire) return;
    const cluster = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 45,
      showCoverageOnHover: false,
    });
    for (const f of fires) {
      cluster.addLayer(
        L.circleMarker([f.lat, f.lon], {
          radius: 4, color: '#7f1d1d', weight: 1, fillColor: '#ef4444', fillOpacity: 0.85,
        }).bindTooltip(`Điểm cháy${f.date ? ` · ${f.date}` : ''}`),
      );
    }
    map.addLayer(cluster);
    refs.current.fires = cluster;
  }, [fires, layers.fire]);

  return <div ref={elRef} style={{ height: '100%', width: '100%' }} />;
}
