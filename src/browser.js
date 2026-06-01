import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

export async function launchBrowser(config, logger) {
  const userDataDir = path.resolve(config.userDataDir);
  await fs.mkdir(userDataDir, { recursive: true });
  await clearChromiumSessionRestoreFiles(userDataDir, logger);
  logger.info('Launching Chromium with dedicated profile', { userDataDir });
  const cartProtectionState = { allowCartCleanup: false };

  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: config.headless,
    viewport: null,
    args: [
      '--start-fullscreen',
      '--start-maximized',
      '--window-position=0,0',
      '--window-size=2048,1152',
      `--disable-extensions-except=${config.sellerSpriteExtensionPath}`,
      `--load-extension=${config.sellerSpriteExtensionPath}`,
    ],
  });

  await installAmazonCartProtection(context, logger, cartProtectionState);
  await installAmazonPageCartGuards(context, logger);
  await closeRestoredPages(context, logger);
  const page = await context.newPage();
  await makeBrowserFullscreen(page, logger);
  const sellerSpriteExtensionId = await waitForSellerSpriteExtension(context, logger);
  return {
    context,
    page,
    userDataDir,
    sellerSpriteExtensionId,
    cartProtection: {
      setAllowCartCleanup(value) {
        cartProtectionState.allowCartCleanup = Boolean(value);
      },
    },
  };
}

export async function makeBrowserFullscreen(page, logger) {
  try {
    const session = await page.context().newCDPSession(page);
    const { windowId } = await session.send('Browser.getWindowForTarget');
    await session.send('Browser.setWindowBounds', {
      windowId,
      bounds: { windowState: 'fullscreen' },
    });
    logger?.info?.('Browser window set to fullscreen');
  } catch (error) {
    logger?.warn?.('Could not set browser fullscreen via CDP; using viewport fallback', { error: error.message });
    await page.setViewportSize({ width: 2048, height: 1152 }).catch(() => {});
  }
}

async function clearChromiumSessionRestoreFiles(userDataDir, logger) {
  const candidates = [
    path.join(userDataDir, 'Default', 'Sessions'),
    path.join(userDataDir, 'Default', 'Session Storage'),
    path.join(userDataDir, 'Default', 'Current Session'),
    path.join(userDataDir, 'Default', 'Current Tabs'),
    path.join(userDataDir, 'Default', 'Last Session'),
    path.join(userDataDir, 'Default', 'Last Tabs'),
  ];

  let removed = 0;
  for (const target of candidates) {
    try {
      await fs.rm(target, { recursive: true, force: true });
      removed += 1;
    } catch {
      // Best-effort cleanup only. Cookies and login data are not stored here.
    }
  }
  logger.info('Cleared Chromium session restore files before launch', { removed });
}

async function closeRestoredPages(context, logger) {
  let closed = 0;
  for (const page of context.pages()) {
    await page.close().then(() => { closed += 1; }).catch(() => {});
  }
  if (closed) logger.info('Closed restored browser pages before starting automation', { closed });
}

async function waitForSellerSpriteExtension(context, logger) {
  for (let i = 0; i < 20; i += 1) {
    const worker = context.serviceWorkers().find((serviceWorker) =>
      serviceWorker.url().startsWith('chrome-extension://')
    );
    if (worker) {
      const extensionId = new URL(worker.url()).host;
      logger.info('SellerSprite extension loaded', { extensionId, serviceWorker: worker.url() });
      return extensionId;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error('SellerSprite extension did not load. Check SELLER_SPRITE_EXTENSION_PATH and manifest.json.');
}

async function installAmazonCartProtection(context, logger, state) {
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = request.url();
    const parsed = new URL(url);
    const path = parsed.pathname;
    const method = request.method();
    const isAmazon = /amazon\.com/i.test(url);
    const isAuth = /amazon\.com\/(?:ap|ax)\//i.test(url);
    const isCartOrCheckout = /\/cart(?:\/|$)|\/gp\/cart|\/cart\/ajax|\/checkout/i.test(path);
    const isAddOrBuy = /add-to-cart|handle-buy-box|submit\.add-to-cart|buy-now/i.test(path);
    if (
      isAmazon &&
      !isAuth &&
      (isAddOrBuy || (isCartOrCheckout && !state.allowCartCleanup))
    ) {
      logger.error('Blocked Amazon cart or checkout request', { url, method });
      await route.abort();
      return;
    }
    await route.continue();
  });
  logger.info('Amazon cart and checkout protection enabled');
}

async function installAmazonPageCartGuards(context, logger) {
  await context.addInitScript(() => {
    const dangerousText = /add to cart|buy now|加入购物车|加入产品库|立即购买|proceed to checkout|checkout/i;
    const alwaysDangerousSelector = [
      '#add-to-cart-button',
      '#buy-now-button',
      '[name="submit.add-to-cart"]',
      '[name="submit.buy-now"]',
      '[aria-label*="Add to cart" i]',
      '[aria-label*="Buy Now" i]',
      'form[action*="checkout"]',
      'input[name="quantity"]',
      'select[name="quantity"]',
      '#quantity',
    ].join(',');
    const cartFormSelector = 'form[action*="cart"]';
    const isCartCleanupAllowed = () => window.localStorage?.getItem('__amazon_cart_cleanup') === '1';
    const isAmazonAuthPage = () => /amazon\.com\/(?:ap|ax)\//i.test(window.location.href);
    const dangerousSelector = () => isCartCleanupAllowed()
      ? alwaysDangerousSelector
      : `${alwaysDangerousSelector},${cartFormSelector}`;

    const isDangerousTarget = (target) => {
      const element = target?.closest?.('button, input, a, [role="button"], form');
      if (!element) return false;
      if (element.matches?.(dangerousSelector())) return true;
      return dangerousText.test(element.innerText || element.value || element.getAttribute?.('aria-label') || '');
    };

    document.addEventListener('click', (event) => {
      if (isDangerousTarget(event.target)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);

    document.addEventListener('submit', (event) => {
      if (isAmazonAuthPage()) return;
      const action = event.target?.getAttribute?.('action') || '';
      const text = event.target?.innerText || '';
      if (/cart|checkout|buy/i.test(action) || dangerousText.test(text)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);

    const disableDangerousControls = () => {
      if (isAmazonAuthPage()) return;
      for (const element of document.querySelectorAll(dangerousSelector())) {
        element.setAttribute('disabled', 'true');
        element.setAttribute('aria-disabled', 'true');
        element.style.pointerEvents = 'none';
      }
    };
    disableDangerousControls();
    new MutationObserver(disableDangerousControls).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  });
  logger.info('Amazon page-level cart and checkout guards enabled');
}
