import fs from 'node:fs/promises';
import path from 'node:path';

const STALE_LOCK_MS = 12 * 60 * 60 * 1000;

export async function acquireRunLock(config, name = 'amazon-web-script') {
  const lockDir = path.resolve(config.userDataDir || 'browser-profile');
  await fs.mkdir(lockDir, { recursive: true });
  const lockPath = path.join(lockDir, '.run.lock');
  const lockContent = JSON.stringify({
    name,
    pid: process.pid,
    startedAt: new Date().toISOString(),
  }, null, 2);

  try {
    const handle = await fs.open(lockPath, 'wx');
    await handle.writeFile(lockContent);
    await handle.close();
    return createReleaseLock(lockPath);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }

  const existing = await readExistingLock(lockPath);
  if (existing?.startedAt && Date.now() - Date.parse(existing.startedAt) > STALE_LOCK_MS) {
    await fs.rm(lockPath, { force: true });
    return acquireRunLock(config, name);
  }

  const detail = existing?.startedAt ? ` started at ${existing.startedAt}` : '';
  throw new Error(`Another Amazon Web Script run is already active${detail}. Close the other terminal or delete ${lockPath} if the old run has already stopped.`);
}

function createReleaseLock(lockPath) {
  let released = false;
  return async function releaseRunLock() {
    if (released) return;
    released = true;
    await fs.rm(lockPath, { force: true }).catch(() => {});
  };
}

async function readExistingLock(lockPath) {
  try {
    return JSON.parse(await fs.readFile(lockPath, 'utf8'));
  } catch {
    return null;
  }
}
