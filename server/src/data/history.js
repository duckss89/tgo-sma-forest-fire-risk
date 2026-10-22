import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { config } from '../config.js';

function readAll() {
  try {
    return JSON.parse(fs.readFileSync(config.historyFile, 'utf8'));
  } catch {
    return [];
  }
}

function writeAll(list) {
  fs.writeFileSync(config.historyFile, JSON.stringify(list, null, 2), 'utf8');
}

export function listHistory() {
  return readAll().sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
}

export function addHistory(entry) {
  const list = readAll();
  const record = {
    id: randomUUID(),
    savedAt: new Date().toISOString(),
    ...entry,
  };
  list.push(record);
  if (list.length > 100) list.shift();
  writeAll(list);
  return record;
}

export function removeHistory(id) {
  const list = readAll().filter((r) => r.id !== id);
  writeAll(list);
  return list;
}

export function clearHistory() {
  writeAll([]);
}
