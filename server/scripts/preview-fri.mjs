// Kết xuất raster FRI ra PNG để xem nhanh (kiểm tra trực quan).
//   node scripts/preview-fri.mjs [--out preview.png]
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeFriRaster, loadBands } from '../src/data/friRaster.js';
import { loadBoundary } from '../src/data/geo.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'data', 'preview_fri.png');

const paperW = [-0.0626, 0.2428, -0.5217, 0.1381, 0.05, -0.05, 0.2557, -1.0];
const r = computeFriRaster(paperW);
const { width, height, bbox } = r;
const bytes = Buffer.from(r.dataB64, 'base64'); // 0 = ngoài vùng; 1..255 = FRI (đã làm mượt hiển thị)
const data = new Float32Array(width * height);
for (let i = 0; i < data.length; i += 1) data[i] = bytes[i] === 0 ? NaN : bytes[i] / 255;

const STOPS = [
  [0, [0, 104, 55]], [0.1, [26, 152, 80]], [0.2, [102, 189, 99]], [0.3, [166, 217, 106]],
  [0.4, [217, 239, 139]], [0.5, [255, 255, 191]], [0.6, [254, 224, 139]], [0.7, [253, 174, 97]],
  [0.8, [244, 109, 67]], [0.9, [215, 48, 39]], [1, [165, 0, 38]],
];
function ramp(t) {
  const x = Math.min(1, Math.max(0, t));
  for (let i = 1; i < STOPS.length; i += 1) {
    if (x <= STOPS[i][0]) {
      const [t0, c0] = STOPS[i - 1];
      const [t1, c1] = STOPS[i];
      const f = (x - t0) / (t1 - t0);
      return [0, 1, 2].map((k) => Math.round(c0[k] + (c1[k] - c0[k]) * f));
    }
  }
  return STOPS[10][1];
}

// PNG (RGBA, không nén filter) tối giản
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data2) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data2.length);
  const tb = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([tb, data2])));
  return Buffer.concat([len, tb, data2, crc]);
}
function encodePng(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y += 1) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const rgba = Buffer.alloc(width * height * 4);
for (let i = 0; i < width * height; i += 1) {
  if (!Number.isFinite(data[i])) { rgba[i * 4 + 3] = 0; continue; }
  const [cr, cg, cb] = ramp(data[i]);
  rgba[i * 4] = cr; rgba[i * 4 + 1] = cg; rgba[i * 4 + 2] = cb; rgba[i * 4 + 3] = 255;
}
fs.writeFileSync(OUT, encodePng(width, height, rgba));
console.log(`✅ ${OUT}  ${width}x${height}  H+VH ${r.highVeryHighPct}%  bbox`, bbox);
loadBoundary();
