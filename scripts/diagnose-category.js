import fs from 'node:fs/promises';
import path from 'node:path';
import { ensureZipCode, loginAmazon, searchAndOpenGreetingCards, verifyGreetingCardsBestSellerPage } from '../src/amazon.js';
import { launchBrowser } from '../src/browser.js';
import { loadConfig } from '../src/config.js';
import { waitForManualVerification } from '../src/manualCheck.js';
import { loginSellerSprite } from '../src/sellerSprite.js';

const config = loadConfig();
const outDir = path.resolve('outputs/category-diagnose');
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
  logger.info('Running required prerequisites before category diagnosis');
  await loginAmazon(browser.page, config, logger, waitForManualVerification);
  await ensureZipCode(browser.page, config, logger);
  await loginSellerSprite(browser.context, config, logger, waitForManualVerification);
  await searchAndOpenGreetingCards(browser.page, config, logger);
  await browser.page.waitForTimeout(5000);

  const screenshotPath = path.join(outDir, 'greeting-cards-top100.png');
  const htmlPath = path.join(outDir, 'greeting-cards-top100.html');
  await browser.page.screenshot({ path: screenshotPath, fullPage: true });
  const html = await browser.page.locator('body').evaluate((body) => body.ownerDocument.documentElement.outerHTML);
  await fs.writeFile(htmlPath, html);

  const result = {
    ...(await verifyGreetingCardsBestSellerPage(browser.page, logger)),
    ...(await browser.page.evaluate(() => {
    const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const bodyText = clean(document.body?.innerText);
    const headings = Array.from(document.querySelectorAll('h1, h2'))
      .map((node) => clean(node.innerText || node.textContent))
      .filter(Boolean);
    const rankTexts = Array.from(document.querySelectorAll('span, div'))
      .map((node) => clean(node.innerText || node.textContent))
      .filter((text) => /^#\d{1,3}$/.test(text));
    const dpLinks = Array.from(document.querySelectorAll('a[href*="/dp/"], a[href*="/gp/product/"]'))
      .map((link) => link.href)
      .filter(Boolean);

    return {
      url: location.href,
      title: document.title,
      headings: headings.slice(0, 10),
      hasBestSellersGreetingCards: /Best Sellers in Greeting Cards/i.test(bodyText),
      hasAmazonBestSellers: /Amazon Best Sellers/i.test(bodyText),
      visibleRanks: Array.from(new Set(rankTexts)).slice(0, 120),
      dpLinkCount: new Set(dpLinks).size,
      bodySample: bodyText.slice(0, 1000),
    };
    })),
  };

  console.log(JSON.stringify({
    ...result,
    screenshotPath,
    htmlPath,
  }, null, 2));
} catch (error) {
  const screenshotPath = path.join(outDir, 'failure.png');
  const htmlPath = path.join(outDir, 'failure.html');
  await browser.page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
  const html = await browser.page.locator('body')
    .evaluate((body) => body.ownerDocument.documentElement.outerHTML)
    .catch(() => '');
  if (html) await fs.writeFile(htmlPath, html);
  logger.error('Category diagnosis failed', { error: error.stack || error.message, screenshotPath, htmlPath });
  process.exitCode = 1;
} finally {
  await browser.context.close().catch(() => {});
}
