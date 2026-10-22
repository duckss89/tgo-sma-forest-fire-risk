// ============================================================================
//  TIỀN XỬ LÝ RASTER  ->  lớp đặc trưng cho bản đồ FRI
// ----------------------------------------------------------------------------
//  Đọc 5 ảnh chỉ số Landsat (NDVI, NBR, NDWI, NBRT, LST) đã tính ở Chương 3,
//  chuẩn hóa p2–p98 (giống normalize_raster của create_fri_map_v2.py), chiếu về
//  lưới kinh/vĩ độ phủ tỉnh Lâm Đồng, ghi ra server/data/fri_bands_<year>.json.gz
//
//  GHI CHÚ KHOA HỌC: trong pipeline gốc (create_fri_map_v2.py), 3 biến khí tượng
//  (RH2M, WS2M, PRECTOTCORR) lấy trung bình theo 3 trạm rồi nội suy — gần như
//  hằng số trên toàn tỉnh, nên chỉ đóng góp một hằng số bị loại khi chuẩn hóa
//  p1–p99 FRI. Vì vậy BẢN ĐỒ FRI chỉ do 5 băng vệ tinh quyết định (đã kiểm chứng:
//  tái dựng khớp FRI_2024.tif với MAE ~ 0,0003). Trọng số T2M được gán cho LST
//  ("Thay T2M" như chú thích trong create_fri_map_v2.py).
//
//  Chạy 1 lần:
//    node scripts/build-fri-bands.mjs --indices "<...>/Code/02_processed_data/indices" --year 2024
//  Yêu cầu: npm i geotiff proj4   (đã có trong devDependencies)
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { fromFile } from 'geotiff';
import proj4 from 'proj4';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

proj4.defs('EPSG:32648', '+proj=utm +zone=48 +datum=WGS84 +units=m +no_defs');
const toUTM = proj4('EPSG:4326', 'EPSG:32648').forward;

// -------- tham số dòng lệnh (--key value) --------
const args = {};
{
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].startsWith('--')) {
      const key = a[i].slice(2);
      const val = a[i + 1] && !a[i + 1].startsWith('--') ? a[i + 1] : 'true';
      args[key] = val;
      if (val !== 'true') i += 1;
    }
  }
}
const YEAR = Number(args.year) || 2024;
const INDICES_DIR = args.indices
  || path.join(__dirname, '..', '..', '..', 'Code', '02_processed_data', 'indices');
const OUT_WIDTH = Number(args.width) || 820;
const READ_SIZE = Number(args.readSize) || 2650;

// Băng 4 (LST) nhận trọng số của T2M — khớp FEATURE_COLS [NDVI,NBR,NDWI,NBRT,T2M,...]
const SAT_BANDS = ['NDVI', 'NBR', 'NDWI', 'NBRT', 'LST'];

function percentile(sortedAsc, p) {
  const i = Math.min(sortedAsc.length - 1, Math.max(0, Math.floor(p * sortedAsc.length)));
  return sortedAsc[i];
}

function inRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i][0]; const yi = ring[i][1];
    const xj = ring[j][0]; const yj = ring[j][1];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

async function loadRaster(file) {
  const tiff = await fromFile(file);
  const img = await tiff.getImage();
  const [minX, minY, maxX, maxY] = img.getBoundingBox();
  const W = img.getWidth();
  const H = img.getHeight();
  const rw = Math.min(READ_SIZE, W);
  const rh = Math.round((rw * H) / W);
  const [data] = await img.readRasters({ width: rw, height: rh });
  const nd = img.getGDALNoData();
  const valid = [];
  for (let i = 0; i < data.length; i += 1) {
    const v = data[i];
    if (v === nd || !Number.isFinite(v) || v < -1e30 || v > 1e30) continue;
    valid.push(v);
  }
  valid.sort((a, b) => a - b);
  return {
    data,
    rw,
    rh,
    minX,
    minY,
    maxX,
    maxY,
    nodata: nd,
    p2: percentile(valid, 0.02),
    p98: percentile(valid, 0.98),
  };
}

function sampleBilinear(r, x, y) {
  const fx = ((x - r.minX) / (r.maxX - r.minX)) * r.rw - 0.5;
  const fy = ((r.maxY - y) / (r.maxY - r.minY)) * r.rh - 0.5;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  if (x0 < 0 || y0 < 0 || x0 + 1 >= r.rw || y0 + 1 >= r.rh) return NaN;
  const tx = fx - x0;
  const ty = fy - y0;
  const at = (xx, yy) => {
    const v = r.data[yy * r.rw + xx];
    if (v === r.nodata || !Number.isFinite(v) || v < -1e30 || v > 1e30) return NaN;
    return v;
  };
  const v00 = at(x0, y0);
  const v10 = at(x0 + 1, y0);
  const v01 = at(x0, y0 + 1);
  const v11 = at(x0 + 1, y0 + 1);
  if ([v00, v10, v01, v11].some(Number.isNaN)) {
    const cand = [v00, v10, v01, v11].filter(Number.isFinite);
    return cand.length ? cand[0] : NaN;
  }
  return (
    v00 * (1 - tx) * (1 - ty)
    + v10 * tx * (1 - ty)
    + v01 * (1 - tx) * ty
    + v11 * tx * ty
  );
}

async function main() {
  console.log(`[build-fri-bands] năm ${YEAR}, đọc chỉ số từ: ${INDICES_DIR}`);
  const candidates = (b) => [
    path.join(INDICES_DIR, String(YEAR), `${b}_${YEAR}.tif`),
    path.join(INDICES_DIR, `${b}_${YEAR}.tif`),
    path.join(INDICES_DIR, `${b}.tif`),
  ];
  const rasters = {};
  for (const b of SAT_BANDS) {
    const f = candidates(b).find((p) => fs.existsSync(p));
    if (!f) throw new Error(`Không thấy raster ${b} trong ${INDICES_DIR}`);
    process.stdout.write(`  đọc ${b}... `);
    rasters[b] = await loadRaster(f);
    console.log(`${rasters[b].rw}x${rasters[b].rh}  p2=${rasters[b].p2.toFixed(3)} p98=${rasters[b].p98.toFixed(3)}`);
  }

  // ranh giới -> bbox + đa giác
  const boundary = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, 'lamdong_boundary.geojson'), 'utf8'),
  );
  const rings = [];
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const feat of boundary.features) {
    const g = feat.geometry;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const poly of polys) {
      rings.push(poly[0]);
      for (const [lon, lat] of poly[0]) {
        if (lon < minLon) minLon = lon;
        if (lat < minLat) minLat = lat;
        if (lon > maxLon) maxLon = lon;
        if (lat > maxLat) maxLat = lat;
      }
    }
  }

  const midLat = (minLat + maxLat) / 2;
  const aspect = ((maxLon - minLon) * Math.cos((midLat * Math.PI) / 180)) / (maxLat - minLat);
  const width = OUT_WIDTH;
  const height = Math.round(width / aspect);
  const nCells = width * height;
  console.log(`  lưới xuất: ${width}x${height} (kinh/vĩ độ), ${nCells} ô`);

  const out = new Uint8Array(SAT_BANDS.length * nCells);
  const mask = new Uint8Array(nCells);

  for (let row = 0; row < height; row += 1) {
    const lat = maxLat - ((row + 0.5) / height) * (maxLat - minLat);
    for (let col = 0; col < width; col += 1) {
      const lon = minLon + ((col + 0.5) / width) * (maxLon - minLon);
      const idx = row * width + col;
      const inside = rings.some((rg) => inRing(lon, lat, rg));
      if (!inside) continue;
      const [ux, uy] = toUTM([lon, lat]);
      let ok = true;
      for (let b = 0; b < SAT_BANDS.length; b += 1) {
        const r = rasters[SAT_BANDS[b]];
        const v = sampleBilinear(r, ux, uy);
        if (!Number.isFinite(v)) { ok = false; break; }
        const n = Math.min(1, Math.max(0, (v - r.p2) / (r.p98 - r.p2 || 1)));
        out[b * nCells + idx] = Math.round(n * 255);
      }
      mask[idx] = ok ? 1 : 0;
    }
    if (row % 50 === 0) process.stdout.write(`\r  xử lý hàng ${row}/${height}`);
  }
  console.log('\r  xử lý xong                       ');

  const payload = {
    year: YEAR,
    generatedAt: new Date().toISOString(),
    note: 'Bản đồ FRI do 5 băng vệ tinh quyết định (khớp create_fri_map_v2.py). '
      + 'Băng 4 (LST) nhận trọng số T2M. Trọng số RH2M/WS2M/PRECTOTCORR không đổi hình bản đồ '
      + '(dữ liệu khí tượng gần hằng số theo không gian).',
    bands: SAT_BANDS,
    weightSlots: ['NDVI', 'NBR', 'NDWI', 'NBRT', 'T2M'],
    normInfo: SAT_BANDS.map((b) => ({ band: b, p2: rasters[b].p2, p98: rasters[b].p98 })),
    bbox: {
      minLon, minLat, maxLon, maxLat,
    },
    width,
    height,
    validCells: mask.reduce((s, v) => s + v, 0),
    data: Buffer.from(out).toString('base64'),
    mask: Buffer.from(mask).toString('base64'),
  };

  const outFile = path.join(DATA_DIR, `fri_bands_${YEAR}.json.gz`);
  fs.writeFileSync(outFile, zlib.gzipSync(Buffer.from(JSON.stringify(payload)), { level: 9 }));
  console.log(
    `✅ Ghi ${outFile}  (${(fs.statSync(outFile).size / 1024).toFixed(0)} KB, ${payload.validCells} ô hợp lệ)`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
