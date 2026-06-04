import path from 'node:path';
import { collectProductImages } from './images.js';
import { ensureSellerSpriteAmazonPanelLoggedIn, extractSellerSpriteProductData } from './sellerSprite.js';
import { asinFromUrl, normalizePrice, parseSalesNumber, titleMatchesKeywords } from './text.js';
import { actionDelay, sellerSpriteLoadDelay } from './timing.js';

export async function loginAmazon(page, config, logger, waitForManualVerification) {
  logger.info('Opening Amazon US');
  await setAmazonLocale(page);
  await gotoAmazonHome(page, logger);
  await dismissSellerSpriteOverlays(page, logger);
  if (await isAmazonLoggedIn(page)) {
    logger.info('Amazon already logged in');
    return;
  }

  await waitForAmazonManualLogin(page, logger);
}

async function waitForAmazonManualLogin(page, logger) {
  logger.warn('Amazon is not logged in; waiting for manual login');
  console.log('需要人工操作：请在打开的浏览器里手动登录 Amazon。脚本会自动检测登录状态，检测成功后继续运行。');
  await openAmazonSignIn(page, logger);

  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    await actionDelay(page, 3000);
    await skipPhonePrompt(page, logger);
    await dismissSellerSpriteOverlays(page, logger);
    if (await isAmazonLoggedIn(page)) {
      logger.info('Amazon login verified after manual login');
      return;
    }
    logger.info('Still waiting for manual Amazon login');
  }

  throw new Error('Amazon manual login was not detected within 10 minutes.');
}

async function waitForAmazonAuthSettle(page, logger) {
  if (!/amazon\.com\/ax\/claim/i.test(page.url())) {
    return;
  }

  logger.info('Waiting for Amazon AX auth claim page to settle', { url: page.url() });
  await Promise.race([
    page.waitForURL((url) => !/amazon\.com\/ax\/claim/i.test(url.href), { timeout: 25000 }).catch(() => null),
    page.waitForFunction(() => {
      const text = document.querySelector('#nav-link-accountList')?.textContent || '';
      return text && !/sign\s*in|登录/i.test(text);
    }, { timeout: 25000 }).catch(() => null),
  ]);
  await actionDelay(page);
}

async function waitForAmazonLoginRedirect(page, logger) {
  logger.info('Waiting for Amazon login redirect to settle', { url: page.url() });
  await Promise.race([
    page.waitForURL((url) => !/amazon\.com\/(?:ap|ax)\//i.test(url.href), { timeout: 45000 }).catch(() => null),
    page.waitForSelector('#nav-link-accountList, #nav-tools, #twotabsearchtextbox', { timeout: 45000 }).catch(() => null),
  ]);
  await waitForAmazonAuthSettle(page, logger);
  await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
  await actionDelay(page, 3000);
}

export async function ensureZipCode(page, config, logger) {
  logger.info('Ensuring Amazon ZIP code', { zip: config.amazonZip });
  await setAmazonLocale(page);
  await gotoAmazonHome(page, logger);
  await actionDelay(page);
  await dismissSellerSpriteOverlays(page, logger);
  const location = page.locator('#nav-global-location-popover-link').first();
  await location.click({ timeout: 5000 }).catch(() => {});
  await actionDelay(page);
  const zipInput = page.locator('input#GLUXZipUpdateInput, input[name="zipCode"]').first();
  if (await zipInput.count()) {
    await zipInput.fill(config.amazonZip);
    await actionDelay(page);
    await page.locator('#GLUXZipUpdate, input[aria-labelledby="GLUXZipUpdate-announce"]').first().click();
    await actionDelay(page);
    await page.keyboard.press('Escape').catch(() => {});
    await actionDelay(page);
  }
}

export async function searchAndOpenGreetingCards(page, config, logger) {
  logger.info('Searching Amazon', { query: config.searchQuery });
  await setAmazonLocale(page);
  await gotoAmazonHome(page, logger);
  await actionDelay(page);
  await dismissSellerSpriteOverlays(page, logger);
  if (!config.skipAmazonLogin && !await isAmazonLoggedIn(page)) {
    throw new Error('Amazon is not logged in. Stop before search because Amazon login is a required prerequisite.');
  }
  await page.locator('#twotabsearchtextbox').fill(config.searchQuery);
  await actionDelay(page);
  await page.keyboard.press('Enter');
  await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(async (error) => {
    logger.warn('Amazon search navigation timed out; stopping page load and continuing', {
      url: page.url(),
      error: error.message,
    });
    await page.evaluate(() => window.stop()).catch(() => {});
  });
  logger.info('Waiting for SellerSprite search-result data to load');
  await sellerSpriteLoadDelay(page);
  await dismissSellerSpriteOverlays(page, logger);
  await actionDelay(page);
  await waitForSellerSpriteManualSearchSync(page, logger);

  await dismissSellerSpriteOverlays(page, logger);
  const clickedPage = await clickSellerSpriteGreetingCardsRank(page, config, logger);
  if (clickedPage) {
    await actionDelay(clickedPage);
    await dismissSellerSpriteOverlays(clickedPage, logger);
    try {
      await verifyGreetingCardsBestSellerPage(clickedPage, config, logger);
      await closeExtraPages(clickedPage, logger);
      logger.info('Opened best sellers category by SellerSprite rank click', { categoryName: config.categoryName });
      return clickedPage;
    } catch (error) {
      logger.warn('SellerSprite Greeting Cards click did not open a verified best seller page', {
        url: clickedPage.url(),
        error: error.message,
      });
    }
  }

  for (let i = 0; i < 4; i += 1) {
    const greetingCardsRankUrl = await findSellerSpriteGreetingCardsRankUrl(page, config);
    if (greetingCardsRankUrl) {
      await gotoAmazonPageToleratingSlowLoad(page, greetingCardsRankUrl, logger, `SellerSprite ${config.categoryName} rank URL`);
      await actionDelay(page);
      await dismissSellerSpriteOverlays(page, logger);
      await verifyGreetingCardsBestSellerPage(page, config, logger);
      await closeExtraPages(page, logger);
      logger.info('Opened best sellers category', { categoryName: config.categoryName });
      return page;
    }
    await page.evaluate(() => window.scrollBy(0, 900)).catch(() => {});
    await actionDelay(page);
  }

  logger.warn('Could not find SellerSprite category link in search results; trying Amazon Best Seller category URL fallback', {
    categoryName: config.categoryName,
  });
  await openGreetingCardsBestSellerFallback(page, config, logger);
  await closeExtraPages(page, logger);
  return page;
}

async function waitForSellerSpriteManualSearchSync(page, logger) {
  const waitMs = 2 * 60 * 1000;
  logger.info('Waiting for manual SellerSprite sync after Amazon search', { waitMs });
  console.log('请在搜索结果页手动同步卖家精灵。脚本会等待 2 分钟后继续运行。');
  await page.waitForTimeout(waitMs);
}

export async function verifyGreetingCardsBestSellerPage(page, config, logger) {
  const categoryName = getCategoryName(config);
  const result = await page.evaluate(() => {
    const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const bodyText = clean(document.body?.innerText);
    const headings = Array.from(document.querySelectorAll('h1, h2'))
      .map((node) => clean(node.innerText || node.textContent))
      .filter(Boolean);
    const visibleRanks = Array.from(document.querySelectorAll('span, div'))
      .map((node) => clean(node.innerText || node.textContent))
      .filter((text) => /^#\d{1,3}$/.test(text));
    const sampleCountMatch = bodyText.match(/样本数\s*(\d+)/);

    return {
      url: location.href,
      title: document.title,
      headings,
      hasAmazonBestSellers: /Amazon Best Sellers/i.test(bodyText),
      bodyText,
      sampleCount: sampleCountMatch ? Number.parseInt(sampleCountMatch[1], 10) : null,
      visibleRankCount: new Set(visibleRanks).size,
    };
  });
  result.hasCategoryHeading = result.headings.some((heading) => {
    const pattern = new RegExp(`Best Sellers in\\s+${escapeRegExp(categoryName)}`, 'i');
    return pattern.test(heading);
  });
  delete result.bodyText;

  logger.info('Best seller page verification', { ...result, categoryName });
  if (!result.hasAmazonBestSellers || !result.hasCategoryHeading) {
    throw new Error(`Opened page is not Amazon Best Sellers in ${categoryName}: ${result.url}`);
  }

  return result;
}

async function findSellerSpriteGreetingCardsRankUrl(page, config) {
  const categoryName = getCategoryName(config);
  return page.evaluate((targetCategoryName) => {
    const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const sameCategory = (value) => clean(value).toLowerCase() === targetCategoryName.toLowerCase();
    const escapedCategory = targetCategoryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const categoryRankPattern = new RegExp(`#\\s*\\d{1,6}\\s+in\\s+${escapedCategory}`, 'i');
    const anchors = Array.from(document.querySelectorAll('a[href]'));
    const bestSellerLink = anchors.find((anchor) => {
      const text = clean(anchor.innerText || anchor.textContent);
      const href = anchor.href || '';
      return sameCategory(text) && (/\/zgbs\//i.test(href) || /Best-Sellers/i.test(href));
    });
    if (bestSellerLink) return bestSellerLink.href;

    const sellerSpriteRankLink = anchors.find((anchor) => {
      const text = clean(anchor.innerText || anchor.textContent);
      if (!sameCategory(text)) return false;
      const cardText = clean(anchor.closest('[data-component-type="s-search-result"], .sg-col-inner, .a-section')?.innerText);
      return /ASIN:|自然位|近30天销量|卖家精灵|#\s*\d{1,6}/i.test(cardText);
    });
    if (sellerSpriteRankLink) return sellerSpriteRankLink.href;

    const textBundleMatch = anchors.find((anchor) => {
      const text = clean(anchor.innerText || anchor.textContent);
      return categoryRankPattern.test(text);
    });
    return textBundleMatch?.href || null;
  }, categoryName).catch(() => null);
}

async function clickSellerSpriteGreetingCardsRank(page, config, logger) {
  const categoryName = getCategoryName(config);
  const exactCategoryPattern = new RegExp(`^${escapeRegExp(categoryName)}$`, 'i');
  const categoryRankPattern = new RegExp(`#\\s*\\d{1,6}\\s+in\\s+${escapeRegExp(categoryName)}`, 'i');
  const targets = [
    page.locator('.bsr-list-item').filter({ hasText: categoryRankPattern }).locator('a, span').filter({ hasText: exactCategoryPattern }).first(),
    page.locator('p').filter({ hasText: categoryRankPattern }).locator('a, span').filter({ hasText: exactCategoryPattern }).first(),
    page.locator('span').filter({ hasText: exactCategoryPattern }).first(),
  ];

  for (const target of targets) {
    if (!await target.count().catch(() => 0)) continue;
    const beforeUrl = page.url();
    const popupPromise = page.context().waitForEvent('page', { timeout: 12000 }).catch(() => null);
    await target.scrollIntoViewIfNeeded().catch(() => {});
    await actionDelay(page, 500);
    await Promise.allSettled([
      page.waitForURL((url) => url.href !== beforeUrl, { timeout: 12000 }),
      page.waitForLoadState('domcontentloaded', { timeout: 12000 }),
      target.click({ timeout: 5000 }),
    ]);
    const popup = await popupPromise;
    if (popup) {
      await popup.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
      await popup.bringToFront().catch(() => {});
      logger.info('Clicked SellerSprite category rank element and switched to new tab', {
        categoryName,
        beforeUrl,
        afterUrl: popup.url(),
      });
      return popup;
    }
    const changed = page.url() !== beforeUrl;
    logger.info('Clicked SellerSprite category rank element', { categoryName, changed, beforeUrl, afterUrl: page.url() });
    return page;
  }

  return null;
}

async function openGreetingCardsBestSellerFallback(page, config, logger) {
  const categoryName = getCategoryName(config);
  const candidates = [
    'https://www.amazon.com/gp/bestsellers/office-products/723463011?language=en_US',
    'https://www.amazon.com/Best-Sellers-Office-Products-Greeting-Cards/zgbs/office-products/723463011?language=en_US',
  ];

  for (const url of candidates) {
    logger.info('Opening best seller fallback URL', { url, categoryName });
    await gotoAmazonPageToleratingSlowLoad(page, url, logger, `${categoryName} best seller fallback URL`);
    await actionDelay(page);
    await dismissSellerSpriteOverlays(page, logger);
    try {
      await verifyGreetingCardsBestSellerPage(page, config, logger);
      logger.info('Opened best sellers category by fallback URL', { categoryName });
      return;
    } catch (error) {
      logger.warn('Best seller fallback URL did not verify', { url, categoryName, error: error.message });
    }
  }

  throw new Error(`Could not open Amazon Best Sellers in ${categoryName} by SellerSprite link or fallback URL`);
}

async function gotoAmazonPageToleratingSlowLoad(page, url, logger, label) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (error) {
    logger.warn(`${label} navigation timed out; stopping load and continuing with page verification`, {
      url,
      error: error.message,
    });
    await page.evaluate(() => window.stop()).catch(() => {});
  }
}

async function closeExtraPages(activePage, logger) {
  const pages = activePage.context().pages();
  let closed = 0;
  for (const candidate of pages) {
    if (candidate === activePage) continue;
    const url = candidate.url();
    if (/amazon\.com|sellersprite\.com|chrome-extension:\/\//i.test(url)) {
      await candidate.close().then(() => { closed += 1; }).catch(() => {});
    }
  }
  if (closed) logger.info('Closed extra browser tabs before collection', { closed });
}

async function clickGreetingCardsBrowseNode(page, logger) {
  const link = page.locator('#zg_browseRoot a, #zg-left-col a, a')
    .filter({ hasText: /^Greeting Cards$/i })
    .first();
  if (await link.count().catch(() => 0)) {
    logger.info('Clicking Greeting Cards browse node from Best Seller category tree');
    await link.click({ timeout: 10000 });
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
    return true;
  }
  logger.warn('Greeting Cards browse node not found on fallback page');
  return false;
}

function getCategoryName(config) {
  return String(config?.categoryName || 'Greeting Cards').trim() || 'Greeting Cards';
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function collectTop100Products(page, config, output, logger, waitForManualVerification) {
  const productUrls = await discoverTop100ProductUrls(page, logger);
  const products = [];
  let scanned = 0;
  let skipped = 0;

  for (const url of productUrls.slice(0, 100)) {
    scanned += 1;
    try {
      const product = await collectProductDetail(page, url, config, output, logger, waitForManualVerification);
      if (product) products.push(product);
      else skipped += 1;
    } catch (error) {
      if (/SellerSprite Amazon panel requires login|Browser is left open for manual inspection|STOP_AT_FIRST_POPUP_PRODUCT reached/i.test(error.message)) {
        throw error;
      }
      skipped += 1;
      logger.warn('Product skipped after error', { url, error: error.message });
    }
  }

  logger.info('Collection complete', { scanned, qualified: products.length, skipped });
  return products;
}

export async function discoverTop100ProductUrls(page, logger) {
  const urls = new Set();
  const visitedPages = new Set();

  for (let pageNumber = 1; pageNumber <= 4 && urls.size < 100; pageNumber += 1) {
    visitedPages.add(page.url());
    await collectBestSellerPageUrls(page, urls);
    logger.info('Discovered candidate URLs on best seller page', {
      pageNumber,
      totalCount: urls.size,
      url: page.url(),
    });

    if (urls.size >= 100) break;
    if (!await goToNextBestSellerPage(page, visitedPages, logger)) break;
  }

  logger.info('Discovered Top 100 candidate URLs', { count: urls.size });
  return Array.from(urls);
}

async function collectBestSellerPageUrls(page, urls) {
  for (let i = 0; i < 28 && urls.size < 100; i += 1) {
    await addVisibleBestSellerUrls(page, urls);
    await page.evaluate(() => window.scrollBy(0, Math.max(900, window.innerHeight * 0.8))).catch(() => {});
    await actionDelay(page, 1200);
  }
  await addVisibleBestSellerUrls(page, urls);
}

async function addVisibleBestSellerUrls(page, urls) {
  const found = await page.$$eval(
    [
      '[id^="p13n-asin-index"] a[href*="/dp/"]',
      '#gridItemRoot a[href*="/dp/"]',
      '.zg-grid-general-faceout a[href*="/dp/"]',
      'a[href*="zg_bs_g_723463011"][href*="/dp/"]',
    ].join(', '),
    (links) => links.map((link) => link.href).filter(Boolean)
  );
  for (const url of found) {
    const asin = asinFromUrl(url);
    if (asin) urls.add(`https://www.amazon.com/dp/${asin}`);
  }
}

async function goToNextBestSellerPage(page, visitedPages, logger) {
  const next = page.locator('ul.a-pagination li.a-last a, a[aria-label*="next" i], a[aria-label*="下一页"]').first();
  if (await next.count().catch(() => 0)) {
    const beforeUrl = page.url();
    logger.info('Opening next Amazon best seller page');
    await Promise.allSettled([
      page.waitForLoadState('domcontentloaded', { timeout: 30000 }),
      next.click({ timeout: 10000 }),
    ]);
    await actionDelay(page);
    if (page.url() !== beforeUrl && !visitedPages.has(page.url())) return true;
  }

  const nextUrl = nextBestSellerUrl(page.url(), visitedPages);
  if (!nextUrl) return false;
  logger.info('Opening next Amazon best seller page by URL fallback', { nextUrl });
  await page.goto(nextUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await actionDelay(page);
  return !visitedPages.has(page.url());
}

function nextBestSellerUrl(currentUrl, visitedPages) {
  const url = new URL(currentUrl);
  const currentPage = Number.parseInt(url.searchParams.get('pg') || '1', 10);
  if (currentPage >= 4) return null;
  url.searchParams.set('pg', String(currentPage + 1));
  url.searchParams.set('ie', 'UTF8');
  const next = url.toString();
  return visitedPages.has(next) ? null : next;
}

async function collectProductDetail(page, url, config, output, logger, waitForManualVerification) {
  const opened = await openProductDetailPage(page, url, logger);
  if (!opened) {
    logger.warn('Skipping product because detail page could not be opened after retry', { url });
    return null;
  }
  const asin = asinFromUrl(page.url()) || await page.locator('#ASIN').getAttribute('value').catch(() => null);
  if (!asin) {
    logger.warn('Skipping product without ASIN', { url });
    return null;
  }
  if (config.existingProductIds?.has?.(asin)) {
    logger.info('Skipping product because 商品ID already exists in input workbook', { asin });
    return null;
  }

  const title = await extractProductTitle(page);
  if (!titleMatchesKeywords(title, config.titleKeywords)) {
    logger.info('Skipping product because title does not match title keyword filter', {
      asin,
      title,
      titleKeywords: config.titleKeywords,
    });
    return null;
  }
  if (config.stopAtFirstPopupProduct) {
    logger.warn('Stopping at first product whose title matches title keyword filter for manual inspection', {
      asin,
      title,
      titleKeywords: config.titleKeywords,
      url: page.url(),
    });
    throw new Error('STOP_AT_FIRST_POPUP_PRODUCT reached');
  }

  logger.info('Product title matches title keyword filter; waiting for SellerSprite detail data', {
    asin,
    titleKeywords: config.titleKeywords,
    waitMs: 10000,
  });
  await actionDelay(page, 10000);
  await dismissSellerSpriteOverlays(page, logger);
  await ensureSellerSpriteAmazonPanelLoggedIn(page, page.context(), config, logger, waitForManualVerification);

  const sellerSprite = await extractSellerSpriteProductData(page, logger);
  const monthlySales = parseSalesNumber(sellerSprite.childMonthlySalesText);
  if (monthlySales === null || monthlySales < config.minChildMonthlySales) {
    logger.info('Skipping product below child monthly sales threshold', { asin, monthlySales });
    return null;
  }

  const priceText = await page.locator('.a-price .a-offscreen').first().innerText().catch(() => '');
  const productImagesDir = path.join(output.imagesDir, asin);
  await ensureProductImageAreaReady(page, asin, logger);
  const imagePaths = await collectProductImages(page, productImagesDir, logger, {
    globalSeenHashes: output.imageHashes,
  });
  if (imagePaths.length < 2) {
    logger.info('Skipping product because fewer than two product images were collected', { asin, imageCount: imagePaths.length });
    return null;
  }

  return {
    listingDate: sellerSprite.listingDate,
    monthlySales,
    price: normalizePrice(priceText),
    title,
    asin,
    imagePaths,
  };
}

async function ensureProductImageAreaReady(page, asin, logger) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
    await actionDelay(page, 1500);
    const state = await page.evaluate(() => {
      const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
      const thumbnails = Array.from(document.querySelectorAll('#altImages li')).filter((node) => {
        const text = clean(node.textContent);
        if (/video|videos|播放|play|\d+\+/i.test(text)) return false;
        const image = node.querySelector('img');
        const src = image?.currentSrc || image?.src || image?.getAttribute('src') || '';
        return /^https?:\/\/m\.media-amazon\.com\/images\/I\//i.test(src)
          && !/\/S\/sash\/|yunduo|seller|loading|spinner|play|video|transparent|grey-pixel/i.test(src);
      });
      return {
        title: clean(document.querySelector('#productTitle')?.textContent || document.title),
        hasMainImage: Boolean(document.querySelector('#landingImage, #imgTagWrapperId img')),
        thumbnailCount: thumbnails.length,
      };
    }).catch(() => ({ title: '', hasMainImage: false, thumbnailCount: 0 }));

    if (state.hasMainImage && state.thumbnailCount > 0) return true;
    logger.warn('Product image area is not ready before image collection; reopening detail page', {
      asin,
      attempt,
      ...state,
    });
    if (attempt < 3) {
      await page.goto(`https://www.amazon.com/dp/${asin}?th=1`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(async (error) => {
        logger.warn('Product image area reload did not finish cleanly', {
          asin,
          attempt,
          error: error.message,
        });
        await page.evaluate(() => window.stop()).catch(() => {});
      });
      await actionDelay(page, 5000);
    }
  }
  return false;
}

async function openProductDetailPage(page, url, logger) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      return true;
    } catch (error) {
      logger.warn('Product page load timeout; stopping load and checking partial page', {
        url,
        attempt,
        error: error.message,
      });
      await page.evaluate(() => window.stop()).catch(() => {});
      await actionDelay(page, 2000);
      if (await hasUsableProductDetailPage(page)) {
        logger.info('Using partially loaded product detail page after timeout', { url, attempt });
        return true;
      }
      if (attempt < 4) {
        await actionDelay(page, 3000);
      }
    }
  }
  return false;
}

async function hasUsableProductDetailPage(page) {
  const asin = asinFromUrl(page.url()) || await page.locator('#ASIN').getAttribute('value').catch(() => null);
  if (!asin) return false;
  const title = await extractProductTitle(page);
  return Boolean(title);
}

async function setAmazonLocale(page) {
  await page.context().addCookies([
    {
      name: 'lc-main',
      value: 'en_US',
      domain: '.amazon.com',
      path: '/',
    },
    {
      name: 'i18n-prefs',
      value: 'USD',
      domain: '.amazon.com',
      path: '/',
    },
  ]);
}

async function gotoAmazonHome(page, logger, options = {}) {
  const timeout = options.timeout ?? 60000;
  const stopOnTimeout = options.stopOnTimeout ?? false;
  try {
    await page.goto('https://www.amazon.com/?language=en_US', { waitUntil: 'domcontentloaded', timeout });
  } catch (error) {
    logger.warn('Amazon home navigation timed out; continuing with current page', {
      url: page.url(),
      error: error.message,
    });
    if (stopOnTimeout) {
      await page.evaluate(() => window.stop()).catch(() => {});
    }
    await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
  }
}

async function openAmazonSignIn(page, logger) {
  try {
    await page.goto('https://www.amazon.com/ap/signin?openid.pape.max_auth_age=0&openid.return_to=https%3A%2F%2Fwww.amazon.com%2F&openid.identity=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.assoc_handle=usflex&openid.mode=checkid_setup&language=en_US&openid.claimed_id=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.ns=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0', { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (error) {
    logger.warn('Amazon sign-in navigation timed out; continuing with current page', {
      url: page.url(),
      error: error.message,
    });
    await page.evaluate(() => window.stop()).catch(() => {});
    await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
  }
  await actionDelay(page);
}

async function fillAmazonCredentials(page, config, logger) {
  const email = page.locator('input[type="email"], input[name="email"], #ap_email').first();
  if (await email.count().catch(() => 0)) {
    logger.info('Filling Amazon email');
    await email.fill(config.amazonEmail);
    await actionDelay(page);
    await submitAmazonEmailStep(page, logger);
    await waitForAmazonPasswordStep(page, logger);
    await actionDelay(page);
  } else {
    logger.info('Amazon email field not shown; checking for password-only step', { url: page.url() });
  }

  const password = amazonPasswordLocator(page);
  if (await password.count().catch(() => 0)) {
    logger.info('Filling Amazon password');
    await password.waitFor({ state: 'visible', timeout: 30000 });
    await password.fill(config.amazonPassword);
    await actionDelay(page);
    const signInButton = page.locator('#signInSubmit, input#signInSubmit').first();
    if (await signInButton.count().catch(() => 0)) {
      await Promise.allSettled([
        page.waitForLoadState('domcontentloaded', { timeout: 30000 }),
        signInButton.click(),
      ]);
    } else {
      await page.keyboard.press('Enter');
      await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
    }
    await actionDelay(page);
  } else {
    logger.warn('Amazon password field was not found during automatic login', { url: page.url() });
  }
}

async function submitAmazonEmailStep(page, logger) {
  const yellowContinue = page.locator('#continue').first();
  if (await yellowContinue.count().catch(() => 0)) {
    logger.info('Clicking Amazon yellow Continue button');
    await Promise.allSettled([
      page.waitForLoadState('domcontentloaded', { timeout: 20000 }),
      yellowContinue.click({ timeout: 5000 }),
    ]);
    if (await amazonPasswordLocator(page).isVisible({ timeout: 3000 }).catch(() => false)) return;
  }

  const submitInput = page.locator('#continue input[type="submit"], input[aria-labelledby="continue-announce"], input#continue').first();
  if (await submitInput.count().catch(() => 0)) {
    logger.warn('Amazon yellow Continue did not advance; clicking submit input');
    await Promise.allSettled([
      page.waitForLoadState('domcontentloaded', { timeout: 12000 }),
      submitInput.click({ timeout: 5000, force: true }),
    ]);
    if (await amazonPasswordLocator(page).isVisible({ timeout: 3000 }).catch(() => false)) return;
  }

  logger.warn('Amazon Continue click did not advance; submitting login form directly');
  await page.evaluate(() => {
    const form = document.querySelector('#ap_login_form, form[name="signIn"]');
    if (form?.requestSubmit) form.requestSubmit();
    else form?.submit?.();
  }).catch(() => {});
  await page.waitForLoadState('domcontentloaded', { timeout: 12000 }).catch(() => {});
}

async function waitForAmazonPasswordStep(page, logger) {
  const password = amazonPasswordLocator(page);
  if (await password.isVisible({ timeout: 8000 }).catch(() => false)) return;
  const emailStillVisible = await page.locator('input[type="email"], input[name="email"], #ap_email, #ap_email_login').first()
    .isVisible({ timeout: 1000 })
    .catch(() => false);
  if (!emailStillVisible) return;

  logger.warn('Amazon email submit did not reveal password field; retrying submit');
  await page.keyboard.press('Enter').catch(() => {});
  await page.waitForLoadState('domcontentloaded', { timeout: 12000 }).catch(() => {});
  if (await password.isVisible({ timeout: 8000 }).catch(() => false)) return;

  const continueButton = page.locator('#continue input[type="submit"], input[aria-labelledby="continue-announce"], #continue, input#continue').first();
  if (await continueButton.count().catch(() => 0)) {
    await continueButton.click({ timeout: 5000 }).catch(() => {});
    await page.waitForLoadState('domcontentloaded', { timeout: 12000 }).catch(() => {});
  }
}

function amazonPasswordLocator(page) {
  return page.locator([
    '#ap_password:not(.aok-hidden)',
    'input[name="password"]:not(#auth-credential-autofill-hint):not(.aok-hidden)',
    'input[type="password"]:not(#auth-credential-autofill-hint):not(.aok-hidden)',
  ].join(', ')).first();
}

async function isAmazonLoggedIn(page) {
  const state = await page.evaluate(() => {
    const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const visibleText = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return '';
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return '';
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return '';
      return clean(element.textContent);
    };
    const accountLink = document.querySelector('#nav-link-accountList');
    return {
      accountText: visibleText('#nav-link-accountList'),
      navText: visibleText('#nav-tools'),
      accountHref: accountLink?.href || '',
      bodyText: clean(document.body?.innerText),
    };
  }).catch(() => ({ accountText: '', navText: '', bodyText: '' }));

  const navText = `${state.accountText} ${state.navText}`.trim();
  if (/\/ap\/signin/i.test(state.accountHref) || /Hello,\s*sign\s*in|sign\s*in|登录/i.test(navText)) {
    return false;
  }
  if (/Hello,\s*(?!sign\s*in\b)[^,\n]+/i.test(navText)) {
    return true;
  }

  const text = state.bodyText;
  if (text && /Hello,\s*sign\s*in|sign\s*in|登录/i.test(text)) return false;
  return false;
}

async function extractProductTitle(page) {
  return page.evaluate(() => {
    const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const productTitle = clean(document.querySelector('#productTitle')?.textContent);
    if (productTitle) return productTitle;

    const metaTitle = clean(document.querySelector('meta[name="title"]')?.getAttribute('content'));
    if (metaTitle) {
      return metaTitle
        .replace(/^Amazon\.com:\s*/i, '')
        .replace(/\s*:\s*[^:]+$/, '')
        .trim();
    }

    const imageAlt = clean(document.querySelector('#landingImage')?.getAttribute('alt'));
    if (imageAlt) return imageAlt;

    return clean(document.title)
      .replace(/^Amazon\.com:\s*/i, '')
      .replace(/\s*:\s*[^:]+$/, '')
      .trim();
  }).catch(() => '');
}

async function dismissSellerSpriteOverlays(page, logger) {
  const closeButton = page.locator('.el-dialog__close, .ant-modal-close, button[aria-label="Close"]').first();
  if (await closeButton.count().catch(() => 0)) {
    const bodyText = await page.locator('body').innerText({ timeout: 2000 }).catch(() => '');
    if (/温馨提示|货币显示|卖家精灵/.test(bodyText) && !/Add to cart|Buy Now|Proceed to checkout/i.test(bodyText)) {
      logger.info('Closing SellerSprite modal without restoring currency');
      await closeButton.click().catch(() => {});
      await actionDelay(page);
    }
  }
}

async function skipPhonePrompt(page, logger) {
  const skip = page.getByRole('link', { name: /not now|skip|以后|跳过/i }).first();
  if (await skip.count().catch(() => 0)) {
    logger.info('Skipping Amazon phone prompt');
    await skip.click().catch(() => {});
    await actionDelay(page);
  }
}

async function maybeHandleManualChallenge(page, waitForManualVerification, logger) {
  const text = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
  if (/captcha|enter the characters|verification|verify|enter code|one time password|otp|验证码|验证|安全验证|短信/i.test(text)) {
    await waitForManualVerification('Amazon 显示验证码、人机验证或短信验证', logger);
  }
}
