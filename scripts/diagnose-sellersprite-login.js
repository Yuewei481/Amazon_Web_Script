import { chromium } from 'playwright';
import { loadConfig } from '../src/config.js';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const config = loadConfig();
const outDir = path.resolve('outputs/sellersprite-login-diagnose');
await fs.mkdir(outDir, { recursive: true });
const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'seller-sprite-login-'));

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
await page.goto('https://www.sellersprite.com/cn/w/user/login', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await page.locator('#form_signin_passW input[name="email"]').fill(config.sellerSpriteUsername);
await page.waitForTimeout(2000);
await page.locator('#form_signin_passW input[type="password"]').fill(config.sellerSpritePassword);
await page.waitForTimeout(2000);
await Promise.allSettled([
  page.waitForNavigation({ timeout: 15000 }),
  page.locator('#form_signin_passW button[type="submit"], #form_signin_passW .login-btn').click(),
]);
await page.waitForTimeout(5000);

await page.screenshot({ path: path.join(outDir, 'after-login.png'), fullPage: true });
const bodyText = await page.locator('body').innerText().catch(() => '');
await fs.writeFile(path.join(outDir, 'after-login.txt'), bodyText);
console.log(JSON.stringify({
  url: page.url(),
  title: await page.title().catch(() => ''),
  bodySample: bodyText.slice(0, 1000),
}, null, 2));

await context.close();
