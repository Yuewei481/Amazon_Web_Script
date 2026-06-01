import fs from 'node:fs/promises';
import path from 'node:path';

export function safeSlug(value) {
  return String(value || 'run')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'run';
}

export function timestampForFolder(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

export async function createRunOutput(config) {
  const slug = safeSlug(config.searchQuery);
  const timestamp = timestampForFolder();
  const runDir = path.resolve(config.outputRoot, `${slug}-${timestamp}`);
  const imagesDir = path.join(runDir, 'images');
  await fs.mkdir(imagesDir, { recursive: true });
  return {
    runDir,
    imagesDir,
    imageHashes: new Set(),
    logPath: path.join(runDir, 'run.log'),
    workbookPath: path.join(runDir, `选品表格-${slug}-${timestamp.slice(0, 10)}.xlsx`),
  };
}
