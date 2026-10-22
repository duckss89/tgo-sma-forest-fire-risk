import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const YEAR = 2024;

export const RISK_CLASSES = [
  { id: 1, name: 'Rất thấp', nameEn: 'Very Low', range: [0.0, 0.2], color: '#1a9850' },
  { id: 2, name: 'Thấp', nameEn: 'Low', range: [0.2, 0.4], color: '#91cf60' },
  { id: 3, name: 'Trung bình', nameEn: 'Moderate', range: [0.4, 0.6], color: '#fee08b' },
  { id: 4, name: 'Cao', nameEn: 'High', range: [0.6, 0.8], color: '#fc8d59' },
  { id: 5, name: 'Rất cao', nameEn: 'Very High', range: [0.8, 1.0], color: '#d73027' },
];

// Phân 5 mức — ngưỡng cố định 0,2 / 0,4 / 0,6 / 0,8 (giống pipeline gốc)
export function classify(fri) {
  if (!Number.isFinite(fri)) return 0;
  if (fri < 0.2) return 1;
  if (fri < 0.4) return 2;
  if (fri < 0.6) return 3;
  if (fri < 0.8) return 4;
  return 5;
}

let bandsCache = null;

// Nạp lớp đặc trưng 8 băng (đã tiền xử lý từ raster Landsat 30 m + khí tượng).
export function loadBands() {
  if (bandsCache) return bandsCache;
  const file = path.join(DATA_DIR, `fri_bands_${YEAR}.json.gz`);
  if (!fs.existsSync(file)) {
    throw new Error(
      `Thiếu ${path.basename(file)}. Chạy: npm run build:bands -- --indices "<đường dẫn>/Code/02_processed_data/indices" --year ${YEAR}`,
    );
  }
  const payload = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8'));
  const nCells = payload.width * payload.height;
  const flat = Buffer.from(payload.data, 'base64'); // nBands * nCells
  const mask = new Uint8Array(Buffer.from(payload.mask, 'base64'));
  const bands = [];
  for (let b = 0; b < payload.bands.length; b += 1) {
    const arr = new Float32Array(nCells);
    for (let i = 0; i < nCells; i += 1) arr[i] = flat[b * nCells + i] / 255;
    bands.push(arr);
  }
  bandsCache = {
    year: payload.year,
    bands, // [NDVI, NBR, NDWI, NBRT, LST]  (băng 4 = LST -> nhận trọng số T2M)
    bandNames: payload.bands,
    mask,
    width: payload.width,
    height: payload.height,
    bbox: payload.bbox,
    nCells,
    validCells: payload.validCells,
    note: payload.note,
  };
  return bandsCache;
}

function percentile(sortedAsc, p) {
  const i = Math.min(sortedAsc.length - 1, Math.max(0, Math.floor(p * sortedAsc.length)));
  return sortedAsc[i];
}

// Tính raster FRI từ bộ trọng số của thuật toán — đúng phương pháp Chương 4:
//   FRI(pixel) = Σ_{k∈{NDVI,NBR,NDWI,NBRT,LST}}  weight[k] · band_chuẩn_hóa_k(pixel)
//   -> chuẩn hóa toàn ảnh theo p1–p99 (như create_fri_map_v2.py) -> [0,1]
// weights: [NDVI, NBR, NDWI, NBRT, T2M, RH2M, WS2M, PRECTOTCORR]
//   -> dùng 5 phần tử đầu; weight[4] (T2M) gán cho băng LST.
//   -> weight[5..7] (RH2M/WS2M/PRECTOTCORR) không đổi hình bản đồ: dữ liệu khí tượng
//      lấy trung bình 3 trạm nên gần hằng số theo không gian (chỉ là offset, bị loại
//      khi chuẩn hóa p1–p99). Chúng vẫn ảnh hưởng tới MÔ HÌNH (AUC, kiểm chứng).
export function computeFriRaster(weights) {
  const {
    bands, mask, width, height, bbox, nCells, note,
  } = loadBands();
  const w = [weights[0], weights[1], weights[2], weights[3], weights[4]]; // NDVI,NBR,NDWI,NBRT,LST(<-T2M)

  const raw = new Float32Array(nCells);
  for (let i = 0; i < nCells; i += 1) {
    if (!mask[i]) { raw[i] = NaN; continue; }
    let s = 0;
    for (let b = 0; b < bands.length; b += 1) s += w[b] * bands[b][i];
    raw[i] = s;
  }

  // p1–p99 + phân loại: tính trên FRI THÔ (khớp create_fri_map_v2.py -> ~38%)
  const valid = [];
  for (let i = 0; i < nCells; i += 1) if (mask[i]) valid.push(raw[i]);
  valid.sort((a, b) => a - b);
  const p1 = percentile(valid, 0.01);
  const p99 = percentile(valid, 0.99);
  const span = p99 - p1 || 1;
  const norm = (x) => Math.min(1, Math.max(0, (x - p1) / span));

  const fri = new Float32Array(nCells);
  const distribution = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < nCells; i += 1) {
    if (!mask[i]) { fri[i] = NaN; continue; }
    const v = norm(raw[i]);
    fri[i] = v;
    distribution[classify(v)] += 1;
  }
  const total = valid.length || 1;

  // Ảnh hiển thị: làm mượt nhẹ FRI (trung bình 3x3, 1 lượt) để bớt nhiễu hạt tiêu
  // do hạ mẫu 30 m; KHÔNG ảnh hưởng số liệu phân loại ở trên.
  const disp = fri.slice();
  for (let r = 1; r < height - 1; r += 1) {
    for (let c = 1; c < width - 1; c += 1) {
      const i = r * width + c;
      if (!mask[i]) continue;
      let acc = 0;
      let k = 0;
      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          const j = i + dr * width + dc;
          if (mask[j]) { acc += fri[j]; k += 1; }
        }
      }
      disp[i] = acc / k;
    }
  }
  // mã hóa 1 byte: 0 = ngoài vùng; 1..255 = FRI
  const friU8 = new Uint8Array(nCells);
  for (let i = 0; i < nCells; i += 1) {
    if (mask[i]) friU8[i] = Math.max(1, Math.round(disp[i] * 255));
  }

  return {
    // phần dùng nội bộ (không serialize)
    friArray: fri,
    maskArray: mask,
    // phần trả về client
    year: YEAR,
    width,
    height,
    bbox,
    p1,
    p99,
    note,
    dataB64: Buffer.from(friU8).toString('base64'),
    distribution: RISK_CLASSES.map((rc) => ({
      ...rc,
      pixels: distribution[rc.id],
      percent: Number(((distribution[rc.id] / total) * 100).toFixed(2)),
    })),
    highVeryHighPct: Number((((distribution[4] + distribution[5]) / total) * 100).toFixed(2)),
  };
}

// Tra FRI + mức tại một toạ độ (ô gần nhất nếu ô đó nằm ngoài dữ liệu).
export function sampleRaster(raster, lon, lat) {
  const {
    width, height, bbox, friArray, maskArray,
  } = raster;
  let c = Math.floor(((lon - bbox.minLon) / (bbox.maxLon - bbox.minLon)) * width);
  let r = Math.floor(((bbox.maxLat - lat) / (bbox.maxLat - bbox.minLat)) * height);
  c = Math.min(width - 1, Math.max(0, c));
  r = Math.min(height - 1, Math.max(0, r));
  for (let rad = 0; rad <= 12; rad += 1) {
    for (let dr = -rad; dr <= rad; dr += 1) {
      for (let dc = -rad; dc <= rad; dc += 1) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue;
        const rr = r + dr;
        const cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= height || cc >= width) continue;
        const idx = rr * width + cc;
        if (maskArray[idx]) return { fri: friArray[idx], level: classify(friArray[idx]) };
      }
    }
  }
  return { fri: NaN, level: 0 };
}
