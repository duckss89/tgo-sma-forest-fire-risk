import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Nạp .env thủ công (không cần thư viện) nếu có.
import fs from 'node:fs';

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

export const config = {
  port: Number(process.env.PORT) || 4000,
  firmsMapKey: process.env.FIRMS_MAP_KEY || '',
  rootDir: path.join(__dirname, '..'),
  historyFile: path.join(__dirname, '..', 'data', 'history.json'),
  // Chặn trên cho tham số người dùng nhập (bảo vệ tài nguyên máy chủ)
  limits: {
    popSize: { min: 10, max: 150, default: 50 },
    maxIter: { min: 20, max: 400, default: 150 },
    numRuns: { min: 1, max: 30, default: 1 },
  },
};
