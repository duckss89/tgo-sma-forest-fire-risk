import express from 'express';
import cors from 'cors';
import compression from 'compression';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import apiRouter from './routes/api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(compression()); // nén gzip (quan trọng cho raster FRI base64)
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString(), firmsConfigured: Boolean(config.firmsMapKey) });
});

app.use('/api', apiRouter);

// Phục vụ bản build của client (nếu đã `npm run build` bên web/client)
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    return res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ error: String(err.message || err) });
});

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[FRI Lâm Đồng] API chạy tại http://localhost:${config.port}`);
  if (!config.firmsMapKey) {
    // eslint-disable-next-line no-console
    console.log('  (FIRMS_MAP_KEY chưa cấu hình — dùng dữ liệu điểm cháy đóng gói sẵn)');
  }
});
