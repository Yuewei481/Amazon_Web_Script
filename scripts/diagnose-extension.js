import { chromium } from 'playwright';
import { loadConfig } from '../src/config.js';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const config = loadConfig();
const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'seller-sprite-diagnose-'));
const outDir = path.resolve('outputs/extension-diagnose');
await fs.mkdir(outDir, { recursive: true });

const context = await chromium.launchPersistentContext(userDataDir, {
  channel: 'chromium',
  headless: false,
  viewport: { width: 1440, height: 1000 },
  args: [
    `--disable-extensions-except=${config.sellerSpriteExtensionPath}`,
    `--load-extension=${config.sellerSpriteExtensionPath}`,
  ],
});

const page = context.pages()[0] || await context.newPage();
await page.goto('chrome://extensions/');
await page.waitForTimeout(3000);
await page.screenshot({ path: path.join(outDir, 'chrome-extensions.png'), fullPage: true });

const amazon = await context.newPage();
await amazon.goto('https://www.amazon.com/s?k=pop+up+greeting+card', { waitUntil: 'domcontentloaded' });
await amazon.waitForTimeout(8000);
await amazon.screenshot({ path: path.join(outDir, 'amazon-search.png'), fullPage: true });

console.log(JSON.stringify({
  userDataDir,
  outDir,
  serviceWorkers: context.serviceWorkers().map((worker) => worker.url()),
  pages: context.pages().map((p) => p.url()),
}, null, 2));

await context.close();
