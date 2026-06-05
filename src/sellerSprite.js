import { makeBrowserFullscreen } from './browser.js';
import { actionDelay } from './timing.js';

const CHILD_MONTHLY_SALES_WAIT_MS = 30000;
const CHILD_MONTHLY_SALES_MAX_REFRESHES = 2;

export async function loginSellerSprite(context, config, logger, waitForManualVerification) {
  logger.info('Opening SellerSprite website login');
  const page = await context.newPage();
  await page.goto('https://www.sellersprite.com/cn/w/user/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await actionDelay(page);

  if (await isSellerSpriteLoggedIn(page)) {
    logger.info('SellerSprite already logged in', { url: page.url() });
    await page.close().catch(() => {});
    return;
  }

  const emailInput = await firstVisibleLocator(page, '#form_signin_passW input[name="email"], input[name="email"], input[type="email"]');
  const passwordInput = await firstVisibleLocator(page, '#form_signin_passW input[type="password"], input[type="password"]');
  if (!emailInput || !passwordInput) {
    const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
    logger.warn('SellerSprite login form not found; waiting for manual handling', {
      url: page.url(),
      bodySample: bodyText.slice(0, 300),
    });
    await waitForManualVerification('卖家精灵登录页未显示账号密码表单，可能已弹出验证码、安全校验或页面加载异常。请在浏览器中处理完成', logger);
    if (!await isSellerSpriteLoggedIn(page)) {
      await saveSellerSpriteLoginDebug(page, logger);
      throw new Error('SellerSprite login could not be verified after manual handling.');
    }
    logger.info('SellerSprite login verified after manual handling');
    await page.close().catch(() => {});
    return;
  }

  logger.info('Attempting SellerSprite website login');
  await emailInput.fill(config.sellerSpriteUsername);
  await actionDelay(page);
  await passwordInput.fill(config.sellerSpritePassword);
  await actionDelay(page);
  await Promise.allSettled([
    page.waitForLoadState('domcontentloaded', { timeout: 15000 }),
    clickFirstVisible(page, '#form_signin_passW button[type="submit"], #form_signin_passW .login-btn, button[type="submit"], .login-btn'),
  ]);
  await actionDelay(page);
  await maybeConfirmForceLogin(page, logger);

  const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
  const stillLogin = /卖家精灵用户登录|立即登录|验证码登录/.test(bodyText) && await page.locator('#form_signin_passW input[type="password"]').count().catch(() => 0);
  if (stillLogin) {
    logger.warn('SellerSprite login did not complete automatically');
    await waitForManualVerification('卖家精灵登录页可能需要验证码、安全校验或强制登录确认', logger);
    if (!await isSellerSpriteLoggedIn(page)) {
      await saveSellerSpriteLoginDebug(page, logger);
      throw new Error('SellerSprite login could not be verified after manual handling.');
    }
  }

  logger.info('SellerSprite login step complete');
  await page.close().catch(() => {});
}

async function firstVisibleLocator(page, selector) {
  const locator = page.locator(selector);
  const count = await locator.count().catch(() => 0);
  for (let i = 0; i < count; i += 1) {
    const candidate = locator.nth(i);
    if (await candidate.isVisible().catch(() => false)) return candidate;
  }
  return null;
}

async function clickFirstVisible(page, selector) {
  const locator = await firstVisibleLocator(page, selector);
  if (!locator) return;
  await locator.click({ timeout: 10000 });
}

export async function ensureSellerSpriteAmazonPanelLoggedIn(page, context, config, logger, waitForManualVerification) {
  const initialState = await getSellerSpritePanelState(page);
  if (!initialState.needsLogin) {
    return;
  }

  logger.warn('SellerSprite Amazon panel is not logged in; attempting to refresh login state', { url: page.url() });
  await makeBrowserFullscreen(page, logger);
  await actionDelay(page, 1000);
  const loginLink = await sellerSpriteAmazonLoginLink(page, initialState);
  const popupPromise = context.waitForEvent('page', { timeout: 10000 }).catch(() => null);
  if (loginLink && await loginLink.count().catch(() => 0)) {
    await loginLink.click({ timeout: 5000 }).catch(() => {});
  }
  await actionDelay(page, 3000);
  await clickSellerSpriteSyncInfoButton(page, logger);
  const popup = await popupPromise;
  if (popup) {
    await popup.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
    logger.info('SellerSprite login click opened a page', { url: popup.url() });
  }

  await loginSellerSprite(context, config, logger, waitForManualVerification);
  if (popup && !popup.isClosed()) {
    await popup.bringToFront().catch(() => {});
    await popup.reload({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await actionDelay(popup);
    await clickSellerSpriteSyncInfoButton(popup, logger);
    await actionDelay(popup);
  }
  await page.bringToFront().catch(() => {});
  await clickSellerSpriteSyncInfoButton(page, logger);
  await popup?.close().catch(() => {});

  logger.info('Reloading product page after SellerSprite login refresh');
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await actionDelay(page, 10000);
  await clickSellerSpriteSyncInfoButton(page, logger);
  await actionDelay(page, 10000);

  const refreshedState = await getSellerSpritePanelState(page);
  if (refreshedState.needsLogin) {
    if (config.stopOnSellerSpritePanelLoginRequired) {
      throw new Error('SellerSprite Amazon panel requires login or shows masked data after login sync. Browser is left open for manual inspection.');
    }
    await waitForManualVerification('卖家精灵 Amazon 面板登录同步后仍显示未登录或数据遮蔽，请在浏览器里手动处理', logger);
  }
}

async function sellerSpriteAmazonLoginLink(page, state) {
  if (state.hasLoginPrompt) {
    const inlineLogin = page.getByText(/^立即登录$/).first();
    if (await inlineLogin.count().catch(() => 0)) return inlineLogin;

    const promptLogin = page.locator('text=立即登录').first();
    if (await promptLogin.count().catch(() => 0)) return promptLogin;
  }

  if (state.hasLoginIcon) return page.locator('.seller-spriteLogin').first();
  return page.getByText(/立即登录|log in|sign in/i).first();
}

async function getSellerSpritePanelState(page) {
  const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
  const hasLoginPrompt = /插件需要登录才能使用|立即登录|needs? to log in|sign in to use/i.test(bodyText);
  const looksMasked = /近30天销量\s*\(父体\)\s*\*{2,}|近30天销量\s*\(子体\)\s*\*{2,}|Listing销售额\s*\*{2,}/.test(bodyText);
  const hasLoginIcon = hasLoginPrompt &&
    await page.locator('.seller-spriteLogin').count().then((count) => count > 0).catch(() => false);
  return {
    bodyText,
    hasLoginIcon,
    hasLoginPrompt,
    looksMasked,
    needsLogin: hasLoginPrompt || looksMasked,
  };
}

async function clickSellerSpriteSyncInfoButton(page, logger) {
  const syncButtonPattern = /同步网页端账号|同步网页端帐户|同步网页端账户|同步网页端客户|同步信息|同步账号|同步帐户|同步登录|sync/i;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const clicked = await clickVisibleByTextInPageOrFrames(page, syncButtonPattern);
    if (clicked) {
      logger.info('Clicked SellerSprite sync info button', { attempt });
      await actionDelay(page, 5000);
      return true;
    }
    await actionDelay(page, 1000);
  }
  logger.info('SellerSprite sync info button was not visible');
  return false;
}

async function clickVisibleByTextInPageOrFrames(page, pattern) {
  const targets = [
    page.getByRole('button', { name: pattern }).first(),
    page.getByRole('link', { name: pattern }).first(),
    page.getByText(pattern).first(),
  ];

  for (const target of targets) {
    if (await clickIfVisible(target)) return true;
  }

  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    const frameTargets = [
      frame.getByRole('button', { name: pattern }).first(),
      frame.getByRole('link', { name: pattern }).first(),
      frame.getByText(pattern).first(),
    ];
    for (const target of frameTargets) {
      if (await clickIfVisible(target)) return true;
    }
  }

  return false;
}

async function clickIfVisible(locator) {
  if (!await locator.count().catch(() => 0)) return false;
  if (!await locator.isVisible().catch(() => false)) return false;
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  await locator.click({ timeout: 5000 }).catch(() => {});
  return true;
}

export async function extractSellerSpriteProductData(page, logger) {
  let bodyText = '';
  let childSalesMatch = null;
  let listingDateMatch = null;
  const maxRefreshes = CHILD_MONTHLY_SALES_MAX_REFRESHES;

  for (let refreshCount = 0; refreshCount <= maxRefreshes; refreshCount += 1) {
    const deadline = Date.now() + CHILD_MONTHLY_SALES_WAIT_MS;
    while (Date.now() < deadline) {
      bodyText = await page.locator('body').innerText({ timeout: 10000 }).catch(() => '');
      childSalesMatch = findChildMonthlySales(bodyText, logger);
      listingDateMatch = bodyText.match(/上架时间\s*[:：]?\s*(\d{4}-\d{2}-\d{2})/);
      if (childSalesMatch) break;
      if (Date.now() < deadline) {
        await actionDelay(page, Math.min(5000, Math.max(1000, deadline - Date.now())));
      }
    }
    if (childSalesMatch) break;
    if (refreshCount < maxRefreshes) {
      logger.info('SellerSprite child monthly sales not visible after 30 seconds; refreshing product page', {
        refreshCount: refreshCount + 1,
        maxRefreshes,
      });
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(async (error) => {
        logger.warn('Product page reload while waiting for SellerSprite data did not finish cleanly', {
          error: error.message,
        });
        await page.evaluate(() => window.stop()).catch(() => {});
      });
      await actionDelay(page, 3000);
    }
  }

  if (!childSalesMatch) {
    logger.warn('SellerSprite child monthly sales not found', {
      url: page.url(),
      hasSellerSpriteText: /卖家精灵|全部流量词|自然搜索词|上架时间/.test(bodyText),
      bodySample: bodyText.slice(0, 500),
    });
  }

  return {
    childMonthlySalesText: childSalesMatch?.[1] || null,
    listingDate: listingDateMatch?.[1] || '',
  };
}

function findChildMonthlySales(bodyText, logger) {
  let childSalesMatch = bodyText.match(/近30天销量\s*\(子体\)\s*[:：]?\s*([\d,]+\+?)/);
  if (!childSalesMatch && /变体数\s*[:：]?\s*1\b/.test(bodyText)) {
    childSalesMatch = bodyText.match(/近30天销量\s*\(父体\)\s*[:：]?\s*([\d,]+\+?)/);
    if (childSalesMatch) {
      logger.info('Using parent monthly sales as child monthly sales because variation count is 1', {
        value: childSalesMatch[1],
      });
    }
  }
  return childSalesMatch;
}

async function maybeConfirmForceLogin(page, logger) {
  const confirm = page.getByRole('button', { name: /强制登录|确定|confirm/i }).first();
  const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
  if (/强制登录|超过最大在线人数|有人在登录/.test(bodyText) && await confirm.count().catch(() => 0)) {
    logger.info('Confirming SellerSprite force login prompt');
    await confirm.click().catch(() => {});
    await actionDelay(page);
  }
}

async function isSellerSpriteLoggedIn(page) {
  await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
  await actionDelay(page, 1000);
  const url = page.url();
  const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
  if (/\/v2\/welcome|\/v2\//i.test(url) && !/卖家精灵用户登录|立即登录/.test(bodyText)) {
    return true;
  }
  return /标准会员|会员中心|退出登录|Beartale01/i.test(bodyText) && !/卖家精灵用户登录/.test(bodyText);
}

async function saveSellerSpriteLoginDebug(page, logger) {
  const screenshotPath = 'outputs/sellersprite-login-failure.png';
  const htmlPath = 'outputs/sellersprite-login-failure.html';
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
  const html = await page.locator('body')
    .evaluate((body) => body.ownerDocument.documentElement.outerHTML)
    .catch(() => '');
  if (html) {
    const fs = await import('node:fs/promises');
    await fs.mkdir('outputs', { recursive: true });
    await fs.writeFile(htmlPath, html);
  }
  logger.warn('Saved SellerSprite login debug artifacts', { screenshotPath, htmlPath, url: page.url() });
}
