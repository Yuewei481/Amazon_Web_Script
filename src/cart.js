import { actionDelay } from './timing.js';

export async function clearAmazonCart(browser, logger) {
  logger.info('Starting Amazon cart cleanup');
  let page;
  browser?.cartProtection?.setAllowCartCleanup(true);
  try {
    page = await cartCleanupPage(browser);
    if (!page) {
      logger.warn('Amazon cart cleanup skipped because no browser page is available');
      return;
    }
    await openCartCleanupPage(page);
    await page.evaluate(() => window.localStorage?.setItem('__amazon_cart_cleanup', '1')).catch(() => {});
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await actionDelay(page);

    let deleted = 0;
    let previousSignature = '';
    for (let round = 1; round <= 120; round += 1) {
      await revealCartItems(page);
      const signature = await cartSignature(page);
      const deleteButton = await firstVisibleDeleteButton(page);
      if (!deleteButton) break;
      await deleteButton.scrollIntoViewIfNeeded().catch(() => {});
      await Promise.allSettled([
        page.waitForLoadState('domcontentloaded', { timeout: 20000 }),
        deleteButton.click({ timeout: 5000 }),
      ]);
      deleted += 1;
      await actionDelay(page);
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      const nextSignature = await cartSignature(page);
      if (signature && nextSignature === signature && previousSignature === signature) {
        logger.warn('Amazon cart cleanup stopped because cart page did not change after delete attempts', {
          round,
          signature,
        });
        break;
      }
      previousSignature = signature;
    }

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await actionDelay(page, 2000);
    const remaining = await visibleCartItemCount(page);
    const navCartCount = await readNavCartCount(page);
    logger.info('Amazon cart cleanup complete', { deleted, remaining, navCartCount });
  } catch (error) {
    logger.warn('Amazon cart cleanup failed', { error: error.message });
  } finally {
    await page?.evaluate(() => window.localStorage?.removeItem('__amazon_cart_cleanup')).catch(() => {});
    browser?.cartProtection?.setAllowCartCleanup(false);
  }
}

async function cartCleanupPage(browser) {
  if (browser?.page && !browser.page.isClosed()) return browser.page;
  const existing = browser?.context?.pages().find((page) => !page.isClosed());
  if (existing) return existing;
  return browser?.context?.newPage?.() || null;
}

async function openCartCleanupPage(page) {
  await page.goto('https://www.amazon.com/gp/cart/view.html?language=en_US', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
}

async function firstVisibleDeleteButton(page) {
  const selectors = [
    'input[name^="submit.delete"]',
    'input[value="Delete"]',
    'input[data-action="delete"]',
    'input[data-feature-id="delete"]',
    'input[aria-label*="Delete" i]',
    'input[aria-label*="Remove" i]',
    'button[aria-label*="Delete" i]',
    'button[aria-label*="Remove" i]',
    'span[data-action="delete"] input',
    '[data-action="delete"] input',
    '[data-action="delete"] button',
    '[data-feature-id="delete"] input',
    '[data-feature-id="delete"] button',
    '[data-csa-c-action="delete"] input',
    '[data-csa-c-action="delete"] button',
    'a[aria-label*="Delete" i]',
    'a[aria-label*="Remove" i]',
  ];

  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index);
      if (await candidate.isVisible().catch(() => false)) return candidate;
    }
  }

  return null;
}

async function revealCartItems(page) {
  await page.evaluate(async () => {
    for (let i = 0; i < 6; i += 1) {
      window.scrollBy(0, Math.max(700, window.innerHeight * 0.75));
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    window.scrollTo(0, 0);
  }).catch(() => {});
}

async function visibleCartItemCount(page) {
  return page.evaluate(() => {
    const visible = (element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const selectors = [
      '[data-name="Active Items"] [data-asin]',
      '[data-name="Active Items"] .sc-list-item',
      '#sc-active-cart [data-asin]',
      '#sc-active-cart .sc-list-item',
      '.sc-list-item[data-asin]',
    ];
    const items = new Set();
    for (const selector of selectors) {
      for (const element of document.querySelectorAll(selector)) {
        const asin = element.getAttribute('data-asin');
        const key = asin || element.id || element.textContent;
        if (key && visible(element)) items.add(key);
      }
    }
    return items.size;
  }).catch(() => null);
}

async function readNavCartCount(page) {
  const text = await page.locator('#nav-cart-count, #sc-subtotal-label-activecart')
    .first()
    .innerText({ timeout: 2000 })
    .catch(() => '');
  const match = String(text || '').match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : null;
}

async function cartSignature(page) {
  return page.evaluate(() => {
    const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const activeCart = document.querySelector('#sc-active-cart, [data-name="Active Items"]') || document.body;
    return clean(activeCart.innerText).slice(0, 2000);
  }).catch(() => '');
}
