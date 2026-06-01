import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export async function collectProductImages(page, productImagesDir, logger, options = {}) {
  const maxImages = options.maxImages || 18;
  const globalSeenHashes = options.globalSeenHashes || null;
  await fs.mkdir(productImagesDir, { recursive: true });
  const imageUrls = await discoverImageUrls(page, logger);
  const seen = new Set();
  const saved = [];

  for (const url of imageUrls) {
    if (saved.length >= maxImages) break;
    try {
      const buffer = await downloadImage(page, url);
      const hash = crypto.createHash('sha256').update(buffer).digest('hex');
      if (seen.has(hash)) continue;
      seen.add(hash);
      if (globalSeenHashes?.has(hash)) {
        logger.info('Skipping duplicate product image already saved in this run', { url, hash: hash.slice(0, 12) });
        continue;
      }
      const filePath = path.join(productImagesDir, `${String(saved.length + 1).padStart(2, '0')}-${hash.slice(0, 12)}.jpg`);
      await fs.writeFile(filePath, buffer);
      globalSeenHashes?.add(hash);
      saved.push(filePath);
    } catch (error) {
      logger.warn('Image download failed', { url, error: error.message });
    }
  }

  return saved;
}

export async function discoverImageUrls(page, logger) {
  const urls = [];
  const addUrl = (url) => {
    const normalized = normalizeAmazonImageUrl(url);
    if (normalized && !urls.includes(normalized)) urls.push(normalized);
  };
  const addAll = (values) => values.forEach(addUrl);

  const thumbnails = page.locator('#altImages li');
  const count = await thumbnails.count().catch(() => 0);
  const eligibleIndexes = [];

  for (let i = 0; i < count; i += 1) {
    const thumb = thumbnails.nth(i);
    if (await isProductThumbnail(thumb)) eligibleIndexes.push(i);
  }

  const selectedIndexes = eligibleIndexes.slice(0, 6);
  logger.info('Discovered product thumbnail directory', {
    thumbnailCount: eligibleIndexes.length,
    selectedCount: selectedIndexes.length,
  });

  for (const index of selectedIndexes) {
    const thumb = thumbnails.nth(index);
    addUrl(await extractThumbnailImageUrl(thumb));
    const before = (await extractVisibleImageUrls(page))[0] || '';
    await hoverProductThumbnail(page, thumb);
    await waitForMainImageToSettle(page, before);
    let visibleUrls = await extractVisibleImageUrls(page);
    if (!visibleUrls.length || (before && visibleUrls[0] === before)) {
      await clickProductThumbnail(page, thumb);
      await waitForMainImageToSettle(page, before);
      visibleUrls = await extractVisibleImageUrls(page);
    }
    addAll(visibleUrls);
  }

  logger.info('Discovered product image URLs', { count: urls.length });
  return urls;
}

async function isProductThumbnail(thumb) {
  return thumb.evaluate((node) => {
    const text = node.textContent || '';
    if (/video|videos|播放|play|\d+\+/i.test(text)) return false;
    const image = node.querySelector('img');
    const src = image?.currentSrc || image?.src || image?.getAttribute('src') || '';
    if (!/^https?:\/\/m\.media-amazon\.com\/images\/I\//i.test(src)) return false;
    if (/\/S\/sash\/|yunduo|seller|loading|spinner|play|video|transparent|grey-pixel/i.test(src)) return false;
    const rect = node.getBoundingClientRect();
    return rect.width > 20 && rect.height > 20;
  }).catch(() => false);
}

async function extractThumbnailImageUrl(thumb) {
  return thumb.evaluate((node) => {
    const image = node.querySelector('img');
    return image?.getAttribute('data-old-hires')
      || image?.currentSrc
      || image?.src
      || image?.getAttribute('src')
      || null;
  }).catch(() => null);
}

async function hoverProductThumbnail(page, thumb) {
  await thumb.scrollIntoViewIfNeeded().catch(() => {});
  await thumb.hover({ timeout: 3000 }).catch(() => {});
  await thumb.locator('button, input, .a-button-thumbnail, .a-link-normal, img').first().hover({ timeout: 3000 }).catch(() => {});
  await thumb.evaluate((node) => {
    const target = node.querySelector('button, input, .a-button-thumbnail, .a-link-normal, img') || node;
    for (const type of ['mouseover', 'mouseenter', 'mousemove']) {
      target.dispatchEvent(new MouseEvent(type, { bubbles: true }));
    }
  }).catch(() => {});
  await page.waitForTimeout(450);
}

async function clickProductThumbnail(page, thumb) {
  await thumb.locator('button, input, .a-button-thumbnail, .a-link-normal, img').first().click({ timeout: 3000 }).catch(async () => {
    await thumb.click({ timeout: 3000 }).catch(() => {});
  });
  await page.waitForTimeout(450);
}

async function waitForMainImageToSettle(page, beforeUrl) {
  await page.waitForFunction((previous) => {
    const image = document.querySelector('#landingImage, #imgTagWrapperId img, #main-image, #ivLargeImage img');
    if (!image) return false;
    const current = normalizeAmazonImageUrl(image.currentSrc || image.src || image.getAttribute('data-old-hires'));
    return Boolean(current && (!previous || current !== previous));

    function normalizeAmazonImageUrl(value) {
      if (!/^https?:\/\/m\.media-amazon\.com\/images\/I\//i.test(value || '')) return null;
      if (/\/S\/sash\//i.test(value) || /\.(svg|gif)(?:$|\?)/i.test(value)) return null;
      if (/loading|spinner|play|video|transparent|grey-pixel/i.test(value)) return null;
      return value.replace(/\._[^/.]+_\.(jpg|jpeg|png|webp)(?:\?.*)?$/i, '.$1');
    }
  }, beforeUrl, { timeout: 1500 }).catch(() => {});
  await page.waitForTimeout(450);
}

async function discoverExpandedGalleryImageUrls(page, logger) {
  const moreThumbnail = await findCollapsedImageThumbnail(page);
  if (!moreThumbnail) return [];

  logger.info('Opening collapsed Amazon image gallery');
  const urls = [];
  const addUrl = (url) => {
    const normalized = normalizeAmazonImageUrl(url);
    if (normalized && !urls.includes(normalized)) urls.push(normalized);
  };

  let isOpen = false;
  try {
    await moreThumbnail.scrollIntoViewIfNeeded().catch(() => {});
    await moreThumbnail.click({ timeout: 5000 }).catch(async () => {
      await moreThumbnail.locator('img, input, button, span').first().click({ timeout: 5000 }).catch(() => {});
    });
    await page.waitForTimeout(1500);

    isOpen = await page.locator('[role="dialog"], .a-popover-modal, #ivImagesTab')
      .filter({ hasText: /IMAGES|图片|VIDEOS|Color:/i })
      .count()
      .then((count) => count > 0)
      .catch(() => false);
    if (!isOpen) return [];

    await page.getByText(/^IMAGES$/i).click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(700);

    const thumbnailLocator = page.locator(
      [
        '[role="dialog"] img',
        '.a-popover-modal img',
        '#ivThumbs img',
        '#ivImageGallery img',
        '#ivImagesTab img',
      ].join(', ')
    );
    const thumbnailCount = Math.min(await thumbnailLocator.count().catch(() => 0), 30);

    for (let index = 0; index < thumbnailCount; index += 1) {
      const thumb = thumbnailLocator.nth(index);
      const thumbUrl = await thumb.evaluate((image) => {
        if (!isGalleryThumbnail(image)) return null;
        return image.getAttribute('data-old-hires') || image.currentSrc || image.src || null;

        function isGalleryThumbnail(candidate) {
          const src = candidate.currentSrc || candidate.src || '';
          if (!isAmazonProductImageUrl(src)) return false;

          const rect = candidate.getBoundingClientRect();
          if (rect.width < 24 || rect.height < 24 || rect.width > 190 || rect.height > 190) return false;
          if (rect.bottom <= 0 || rect.right <= 0 || rect.top >= window.innerHeight || rect.left >= window.innerWidth) return false;

          const holder = candidate.closest('li, div, button, span');
          const text = [
            candidate.alt,
            candidate.getAttribute('aria-label'),
            holder?.textContent,
            holder?.className,
            holder?.id,
          ].join(' ');
          if (/video|videos|播放|play|loading|spinner/i.test(text)) return false;

          const isKnownThumb = /thumb|image|iv/i.test(`${holder?.className || ''} ${holder?.id || ''}`);
          const isRightRail = rect.left > window.innerWidth * 0.52;
          return isKnownThumb || isRightRail;
        }

        function isAmazonProductImageUrl(value) {
          return /^https?:\/\/m\.media-amazon\.com\/images\/I\//i.test(value)
            && !/\/S\/sash\//i.test(value)
            && !/\.(svg|gif)(?:$|\?)/i.test(value)
            && !/loading|spinner|play|video|transparent|grey-pixel/i.test(value);
        }
      }).catch(() => null);
      if (!thumbUrl) continue;

      addUrl(thumbUrl);
      await thumb.scrollIntoViewIfNeeded().catch(() => {});
      await thumb.click({ timeout: 2500 }).catch(() => {});
      await page.waitForTimeout(350);
      for (const url of await extractGalleryCurrentImageUrls(page)) addUrl(url);
    }
  } finally {
    if (isOpen) await closeExpandedGallery(page);
  }

  return urls;
}

async function findCollapsedImageThumbnail(page) {
  const thumbnails = page.locator('#altImages li, #altImages [role="button"], #altImages button, #altImages span');
  const count = await thumbnails.count().catch(() => 0);
  for (let index = 0; index < count; index += 1) {
    const candidate = thumbnails.nth(index);
    const text = await candidate.innerText().catch(() => '');
    if (/^\s*\d+\+\s*$/.test(text)) return candidate;
  }
  return null;
}

async function extractGalleryCurrentImageUrls(page) {
  return page.evaluate(() => {
    const urls = [];
    const add = (value) => {
      if (!isAmazonProductImageUrl(value)) return;
      if (!urls.includes(value)) urls.push(value);
    };

    for (const image of document.querySelectorAll('[role="dialog"] img, .a-popover-modal img, #ivLargeImage img, #ivImage img, #ivImagesTab img')) {
      const rect = image.getBoundingClientRect();
      if (rect.width < 240 || rect.height < 240) continue;
      const container = image.closest('li, div, button');
      const text = [
        image.alt,
        image.getAttribute('aria-label'),
        container?.textContent,
        container?.className,
        container?.id,
      ].join(' ');
      if (/video|videos|播放|play|loading/i.test(text)) continue;
      const dynamic = image.getAttribute('data-a-dynamic-image');
      if (dynamic) {
        try {
          const parsed = JSON.parse(dynamic);
          Object.keys(parsed)
            .sort((a, b) => imageArea(parsed[b]) - imageArea(parsed[a]))
            .forEach(add);
        } catch {
          // Continue with direct image attributes below.
        }
      }
      add(image.getAttribute('data-old-hires'));
      add(image.currentSrc || image.src);
    }

    return urls;

    function imageArea(size) {
      return Number(size?.[0] || 0) * Number(size?.[1] || 0);
    }

    function isAmazonProductImageUrl(value) {
      return /^https?:\/\/m\.media-amazon\.com\/images\/I\//i.test(value || '')
        && !/\/S\/sash\//i.test(value)
        && !/\.(svg|gif)(?:$|\?)/i.test(value)
        && !/loading|spinner|play|video|transparent|grey-pixel/i.test(value);
    }
  }).catch(() => []);
}

async function closeExpandedGallery(page) {
  await page.locator(
    [
      '[role="dialog"] button[aria-label="Close"]',
      '.a-popover-modal button[aria-label="Close"]',
      '.a-popover-modal .a-button-close',
      'button[aria-label="Close"]',
      'button:has-text("×")',
    ].join(', ')
  ).first().click({ timeout: 3000 }).catch(async () => {
    await page.keyboard.press('Escape').catch(() => {});
  });
  await page.waitForTimeout(500);
}

async function extractVisibleImageUrls(page) {
  return page.evaluate(() => {
    const urls = [];
    const add = (value) => {
      const normalized = normalizeAmazonImageUrl(value);
      if (normalized && !urls.includes(normalized)) urls.push(normalized);
    };

    for (const image of document.querySelectorAll('#landingImage, #imgTagWrapperId img, #main-image, #ivLargeImage img')) {
      add(bestImageUrl(image));
    }

    return urls;

    function bestImageUrl(image) {
      const candidates = [];
      candidates.push({ url: image.currentSrc || image.src, priority: 3, area: 0 });
      candidates.push({ url: image.getAttribute('data-old-hires'), priority: 2, area: 0 });
      const dynamic = image.getAttribute('data-a-dynamic-image');
      if (dynamic) {
        try {
          const parsed = JSON.parse(dynamic);
          for (const [url, size] of Object.entries(parsed)) {
            candidates.push({ url, priority: 1, area: imageArea(size) });
          }
        } catch {
          // Some Amazon pages leave malformed escaped data here. Other sources below still work.
        }
      }
      return candidates
        .filter((candidate) => isAmazonProductImageUrl(candidate.url))
        .sort((a, b) => b.priority - a.priority || b.area - a.area)[0]?.url || null;
    }

    function imageArea(size) {
      return Number(size?.[0] || 0) * Number(size?.[1] || 0);
    }

    function isAmazonProductImageUrl(value) {
      return /^https?:\/\/m\.media-amazon\.com\/images\/I\//i.test(value || '')
        && !/\/S\/sash\//i.test(value)
        && !/\.(svg|gif)(?:$|\?)/i.test(value)
        && !/loading|spinner|play|video|transparent|grey-pixel/i.test(value);
    }

    function normalizeAmazonImageUrl(value) {
      if (!isAmazonProductImageUrl(value)) return null;
      return value.replace(/\._[^/.]+_\.(jpg|jpeg|png|webp)(?:\?.*)?$/i, '.$1');
    }
  }).catch(() => []);
}

function normalizeAmazonImageUrl(value) {
  if (!/^https?:\/\/m\.media-amazon\.com\/images\/I\//i.test(value || '')) return null;
  if (/\/S\/sash\//i.test(value) || /\.(svg|gif)(?:$|\?)/i.test(value)) return null;
  if (/loading|spinner|play|video|transparent|grey-pixel/i.test(value)) return null;
  return value.replace(/\._[^/.]+_\.(jpg|jpeg|png|webp)(?:\?.*)?$/i, '.$1');
}

async function downloadImage(page, url) {
  const response = await page.request.get(url, { timeout: 30000 });
  if (!response.ok()) {
    throw new Error(`HTTP ${response.status()}`);
  }
  return response.body();
}
