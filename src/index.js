import { collectTop100Products, ensureZipCode, loginAmazon, searchAndOpenGreetingCards } from './amazon.js';
import { launchBrowser } from './browser.js';
import { clearAmazonCart } from './cart.js';
import { loadConfig } from './config.js';
import { saveWorkbook } from './excel.js';
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
    config = loadConfig();
    releaseRunLock = await acquireRunLock(config, 'script-one');
    output = await createRunOutput(config);
    logger = createLogger(output.logPath);
    logger.info('Starting Amazon selection SOP automation', {
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
    const products = await collectTop100Products(categoryPage, config, output, logger, waitForManualVerification);
    if (!products.length) {
      throw new Error('No qualified products were collected; skip Excel export to avoid creating an empty workbook.');
    }
    await saveWorkbook(products, output.workbookPath, config);

    logger.info('Export complete', {
      workbookPath: output.workbookPath,
      productCount: products.length,
    });
    runCompleted = true;
  } catch (error) {
    if (browser?.page && output) {
      await saveFailureDebugArtifacts(browser.page, output, logger);
    }
    if (logger) {
      logger.error('Run failed', { error: error.stack || error.message });
    } else {
      console.error(`配置错误：${error.message}`);
      console.error('请复制 .env.example 为 .env，并填写 Amazon、卖家精灵和扩展路径配置。');
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

main();

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

async function waitForSellerSpriteManualSync(page, logger) {
  const waitMs = 2 * 60 * 1000;
  logger.info('Waiting for manual SellerSprite sync after Amazon login', { waitMs });
  console.log('请在浏览器里确认 Amazon 已登录，并手动完成卖家精灵同步。脚本会等待 2 分钟后继续运行。');
  await page.waitForTimeout(waitMs);
}
