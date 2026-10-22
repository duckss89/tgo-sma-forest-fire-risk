import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');

let boundaryCache = null;

// Trả về { geojson, polygons: [[ [lon,lat], ... ] ...] (vòng ngoài), bbox: {minLon,minLat,maxLon,maxLat} }
export function loadBoundary() {
  if (boundaryCache) return boundaryCache;
  const geojson = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, 'lamdong_boundary.geojson'), 'utf8'),
  );
  const polygons = [];
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;

  const pushRing = (ring) => {
    polygons.push(ring);
    for (const [lon, lat] of ring) {
      if (lon < minLon) minLon = lon;
      if (lat < minLat) minLat = lat;
      if (lon > maxLon) maxLon = lon;
      if (lat > maxLat) maxLat = lat;
    }
  };

  for (const feat of geojson.features || []) {
    const g = feat.geometry;
    if (!g) continue;
    if (g.type === 'Polygon') {
      pushRing(g.coordinates[0]);
    } else if (g.type === 'MultiPolygon') {
      for (const poly of g.coordinates) pushRing(poly[0]);
    }
  }

  boundaryCache = {
    geojson,
    polygons,
    bbox: { minLon, minLat, maxLon, maxLat },
  };
  return boundaryCache;
}

// Ray casting cho 1 vòng
function inRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect = yi > lat !== yj > lat
      && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function pointInBoundary(lon, lat, polygons) {
  for (const ring of polygons) {
    if (inRing(lon, lat, ring)) return true;
  }
  return false;
}

export { DATA_DIR };
