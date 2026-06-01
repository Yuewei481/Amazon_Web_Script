import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { collectProductImages } from '../src/images.js';

test('collectProductImages skips images already saved in the same run', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'image-dedupe-'));
  const sharedBuffer = Buffer.from('same image bytes');
  const thumb = {
    evaluate: async () => true,
    scrollIntoViewIfNeeded: async () => {},
    hover: async () => {},
    click: async () => {},
    locator: () => ({
      first: () => ({
        hover: async () => {},
        click: async () => {},
      }),
    }),
  };
  const page = {
    request: {
      get: async () => ({
        ok: () => true,
        body: async () => sharedBuffer,
      }),
    },
    locator: () => ({
      count: async () => 1,
      nth: () => thumb,
    }),
    evaluate: async () => ['https://m.media-amazon.com/images/I/example.jpg'],
    waitForFunction: async () => {},
    waitForTimeout: async () => {},
  };
  const logger = {
    info: () => {},
    warn: () => {},
  };
  const globalSeenHashes = new Set();

  const first = await collectProductImages(page, path.join(tempDir, 'first'), logger, { globalSeenHashes });
  const second = await collectProductImages(page, path.join(tempDir, 'second'), logger, { globalSeenHashes });

  assert.equal(first.length, 1);
  assert.equal(second.length, 0);
});
