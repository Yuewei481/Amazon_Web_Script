import fs from 'node:fs';
import path from 'node:path';
import { collectTop100Products, ensureZipCode, loginAmazon, searchAndOpenGreetingCards } from './amazon.js';
import { launchBrowser } from './browser.js';
import { clearAmazonCart } from './cart.js';
import { loadConfig } from './config.js';
import { appendProductsToWorkbook, readExistingProductIds } from './excel.js';
import { createLogger } from './logger.js';
import { waitForManualVerification } from './manualCheck.js';
import { createRunOutput } from './output.js';
import { acquireRunLock } from './runLock.js';
import { loginSellerSprite } from './sellerSprite.js';

async function main() {
  let config;
  let output;
  let logger;
  let browser;
  let releaseRunLock;
  let runCompleted = false;

  try {
    const inputWorkbookPath = parseInputWorkbookPath(process.argv.slice(2));
    const existingProductIds = await readExistingProductIds(inputWorkbookPath);

    config = {
      ...loadConfig(),
      existingProductIds,
    };
    releaseRunLock = await acquireRunLock(config, 'append-new');
    output = await createRunOutput(config);
    logger = createLogger(output.logPath);
    logger.info('Starting append-new-products automation', {
      inputWorkbookPath,
      existingProductCount: existingProductIds.size,
      searchQuery: config.searchQuery,
      minChildMonthlySales: config.minChildMonthlySales,
      outputDir: output.runDir,
    });

    browser = await launchBrowser(config, logger);
    logger.info('Prerequisite complete: SellerSprite extension is loaded');
    if (config.skipAmazonLogin) {
      logger.warn('Skipping Amazon login and ZIP code steps because SKIP_AMAZON_LOGIN=true');
    } else {
      await loginAmazon(browser.page, config, logger, waitForManualVerification);
      logger.info('Prerequisite complete: Amazon login step has run');
      await ensureZipCode(browser.page, config, logger);
      logger.info('Prerequisite complete: Amazon ZIP code step has run');
      await waitForSellerSpriteManualSync(browser.page, logger);
    }
    await loginSellerSprite(browser.context, config, logger, waitForManualVerification);
    logger.info('Prerequisite complete: SellerSprite login step has run');

    const categoryPage = await searchAndOpenGreetingCards(browser.page, config, logger);
    const newProducts = await collectTop100Products(categoryPage, config, output, logger, waitForManualVerification);
    const result = await appendProductsToWorkbook(inputWorkbookPath, newProducts);

    logger.info('Append complete', {
      workbookPath: inputWorkbookPath,
      appended: result.appended,
    });
    runCompleted = true;
  } catch (error) {
    if (browser?.page && output) {
      await saveFailureDebugArtifacts(browser.page, output, logger);
    }
    if (logger) {
      logger.error('Append run failed', { error: error.stack || error.message });
    } else {
      console.error(`运行错误：${error.message}`);
      console.error('用法：npm run append-new -- --input /path/to/已有选品表格.xlsx');
    }
    process.exitCode = 1;
  } finally {
    if (runCompleted && !config?.skipCartCleanup) {
      await clearAmazonCart(browser, logger);
    } else if (runCompleted) {
      logger?.warn?.('Skipping Amazon cart cleanup because SKIP_CART_CLEANUP=true');
    }
    if (config?.keepBrowserOnError && process.exitCode) {
      logger?.warn?.('Keeping browser open because KEEP_BROWSER_ON_ERROR=true');
    } else {
      await browser?.context?.close().catch(() => {});
    }
    await releaseRunLock?.();
    logger?.close?.();
  }
}

function parseInputWorkbookPath(args) {
  const inputIndex = args.findIndex((arg) => arg === '--input' || arg === '-i');
  const value = inputIndex >= 0 ? args[inputIndex + 1] : args[0];
  if (!value) {
    throw new Error('Missing input workbook path. Use --input /path/to/已有选品表格.xlsx');
  }
  const workbookPath = path.resolve(value);
  if (!fs.existsSync(workbookPath)) {
    throw new Error(`Input workbook does not exist: ${workbookPath}`);
  }
  if (!/\.xlsx$/i.test(workbookPath)) {
    throw new Error(`Input workbook must be an .xlsx file: ${workbookPath}`);
  }
  return workbookPath;
}

async function saveFailureDebugArtifacts(page, output, logger) {
  try {
    const screenshotPath = `${output.runDir}/failure-page.png`;
    const htmlPath = `${output.runDir}/failure-page.html`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await page.locator('body').evaluate((body) => body.ownerDocument.documentElement.outerHTML)
      .then((html) => import('node:fs/promises').then((fs) => fs.writeFile(htmlPath, html)));
    logger?.warn?.('Saved failure debug artifacts', { screenshotPath, htmlPath });
  } catch (debugError) {
    logger?.warn?.('Could not save failure debug artifacts', { error: debugError.message });
  }
}

main();

async function waitForSellerSpriteManualSync(page, logger) {
  const waitMs = 2 * 60 * 1000;
  logger.info('Waiting for manual SellerSprite sync after Amazon login', { waitMs });
  console.log('请在浏览器里确认 Amazon 已登录，并手动完成卖家精灵同步。脚本会等待 2 分钟后继续运行。');
  await page.waitForTimeout(waitMs);
}
