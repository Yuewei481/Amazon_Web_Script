import fs from 'node:fs/promises';
import path from 'node:path';
import { collectProductImages } from '../src/images.js';
import { ensureSellerSpriteAmazonPanelLoggedIn, extractSellerSpriteProductData, loginSellerSprite } from '../src/sellerSprite.js';
import { launchBrowser } from '../src/browser.js';
import { loadConfig } from '../src/config.js';
import { waitForManualVerification } from '../src/manualCheck.js';
import { parseSalesNumber, titleMatchesPopUp } from '../src/text.js';

const config = loadConfig();
const asin = process.argv[2] || 'B0CHRFTJ82';
const outDir = path.resolve('outputs/product-diagnose', asin);
await fs.mkdir(outDir, { recursive: true });

const logger = {
  info(message, data = {}) {
    console.log(`[INFO] ${message} ${JSON.stringify(data)}`);
  },
  warn(message, data = {}) {
    console.warn(`[WARN] ${message} ${JSON.stringify(data)}`);
  },
  error(message, data = {}) {
    console.error(`[ERROR] ${message} ${JSON.stringify(data)}`);
  },
};

const browser = await launchBrowser(config, logger);

try {
  await loginSellerSprite(browser.context, config, logger, waitForManualVerification);
  const page = browser.page;
  await page.goto(`https://www.amazon.com/dp/${asin}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  logger.info('Waiting after opening product detail page', { waitMs: 10000, url: page.url() });
  await page.waitForTimeout(10000);
  await ensureSellerSpriteAmazonPanelLoggedIn(page, browser.context, config, logger, waitForManualVerification);

  const title = await page.locator('#productTitle').innerText({ timeout: 10000 }).catch(() => '');
  const sellerSprite = await extractSellerSpriteProductData(page, logger);
  const imagePaths = await collectProductImages(page, path.join(outDir, 'images'), logger);
  await page.screenshot({ path: path.join(outDir, 'page.png'), fullPage: true }).catch(() => {});
  const html = await page.locator('body').evaluate((body) => body.ownerDocument.documentElement.outerHTML).catch(() => '');
  if (html) await fs.writeFile(path.join(outDir, 'page.html'), html);

  console.log(JSON.stringify({
    outDir,
    url: page.url(),
    title,
    popUpMatch: titleMatchesPopUp(title),
    childMonthlySalesText: sellerSprite.childMonthlySalesText,
    childMonthlySales: parseSalesNumber(sellerSprite.childMonthlySalesText),
    listingDate: sellerSprite.listingDate,
    imageCount: imagePaths.length,
  }, null, 2));
} finally {
  await browser.context.close().catch(() => {});
}
