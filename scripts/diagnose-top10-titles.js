import { launchBrowser } from '../src/browser.js';
import { loadConfig } from '../src/config.js';
import { verifyGreetingCardsBestSellerPage } from '../src/amazon.js';
import { asinFromUrl, titleMatchesPopUp } from '../src/text.js';

const config = loadConfig();

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
  const page = browser.page;
  await page.goto('https://www.amazon.com/gp/bestsellers/office-products/723463011?language=en_US', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForTimeout(8000);
  await verifyGreetingCardsBestSellerPage(page, logger);

  const items = await page.evaluate(() => {
    const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    let roots = Array.from(document.querySelectorAll('[id^="p13n-asin-index"]'));
    if (!roots.length) {
      roots = Array.from(document.querySelectorAll('#gridItemRoot')).filter((root) => root.querySelector('a[href*="/dp/"]'));
    }
    return roots.slice(0, 10).map((root, index) => {
      const rankText = clean(root.querySelector('.zg-bdg-text, span[class*="zg-bdg-text"]')?.textContent) || `#${index + 1}`;
      const titleNode =
        root.querySelector('._cDEzb_p13n-sc-css-line-clamp-3_g3dy1') ||
        root.querySelector('._cDEzb_p13n-sc-css-line-clamp-4_2q2cc') ||
        root.querySelector('a[href*="/dp/"] div') ||
        root.querySelector('img[alt]');
      const img = root.querySelector('img[alt]');
      const link = root.querySelector('a[href*="/dp/"]');
      return {
        rank: rankText,
        title: clean(titleNode?.innerText || titleNode?.textContent || img?.getAttribute('alt') || ''),
        href: link?.href || '',
      };
    }).filter((item) => item.title || item.href);
  });

  console.log(JSON.stringify(items.map((item) => ({
    rank: item.rank,
    asin: asinFromUrl(item.href),
    title: item.title,
    popUpMatch: titleMatchesPopUp(item.title),
  })), null, 2));
} finally {
  await browser.context.close().catch(() => {});
}
