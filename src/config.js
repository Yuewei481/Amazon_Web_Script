import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();

const REQUIRED = [
  'SELLER_SPRITE_USERNAME',
  'SELLER_SPRITE_PASSWORD',
  'SELLER_SPRITE_EXTENSION_PATH',
];

export function validateConfigObject(env, options = {}) {
  const checkExtensionPath = options.checkExtensionPath ?? true;
  const skipAmazonLogin = parseBoolean(env.SKIP_AMAZON_LOGIN);
  const missing = REQUIRED.filter((key) => !String(env[key] || '').trim());
  if (missing.length) {
    throw new Error(`Missing required config: ${missing.join(', ')}`);
  }

  const minSales = Number.parseInt(env.MIN_CHILD_MONTHLY_SALES || '1000', 10);
  if (!Number.isFinite(minSales) || minSales < 0) {
    throw new Error('MIN_CHILD_MONTHLY_SALES must be a non-negative integer');
  }

  const amazonLoginAttempts = Number.parseInt(env.AMAZON_LOGIN_ATTEMPTS || '2', 10);
  if (!Number.isFinite(amazonLoginAttempts) || amazonLoginAttempts < 1) {
    throw new Error('AMAZON_LOGIN_ATTEMPTS must be a positive integer');
  }

  const extensionPath = path.resolve(String(env.SELLER_SPRITE_EXTENSION_PATH).trim());
  if (checkExtensionPath) {
    if (!fs.existsSync(extensionPath)) {
      throw new Error(`SELLER_SPRITE_EXTENSION_PATH does not exist: ${extensionPath}`);
    }
    if (!fs.statSync(extensionPath).isDirectory()) {
      throw new Error(`SELLER_SPRITE_EXTENSION_PATH must be an unpacked extension directory: ${extensionPath}`);
    }
    const manifestPath = path.join(extensionPath, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`SellerSprite extension directory must contain manifest.json: ${manifestPath}`);
    }
  }

  return {
    amazonEmail: String(env.AMAZON_EMAIL || '').trim(),
    amazonPassword: env.AMAZON_PASSWORD || '',
    sellerSpriteUsername: env.SELLER_SPRITE_USERNAME.trim(),
    sellerSpritePassword: env.SELLER_SPRITE_PASSWORD,
    sellerSpriteExtensionPath: extensionPath,
    searchQuery: env.SEARCH_QUERY || 'pop up greeting card',
    categoryName: env.CATEGORY_NAME || 'Greeting Cards',
    minChildMonthlySales: minSales,
    amazonCountry: env.AMAZON_COUNTRY || 'US',
    amazonZip: env.AMAZON_ZIP || '10001',
    outputRoot: env.OUTPUT_ROOT || 'outputs',
    templatePath: defaultTemplatePath(),
    userDataDir: env.USER_DATA_DIR || 'browser-profile',
    amazonLoginAttempts,
    headless: String(env.HEADLESS || 'false').toLowerCase() === 'true',
    keepBrowserOnError: String(env.KEEP_BROWSER_ON_ERROR || 'false').toLowerCase() === 'true',
    stopOnSellerSpritePanelLoginRequired: String(env.STOP_ON_SELLERSPRITE_PANEL_LOGIN || 'false').toLowerCase() === 'true',
    stopAtFirstPopupProduct: String(env.STOP_AT_FIRST_POPUP_PRODUCT || 'false').toLowerCase() === 'true',
    skipAmazonLogin,
    skipCartCleanup: parseBoolean(env.SKIP_CART_CLEANUP),
  };
}

export function loadConfig() {
  return validateConfigObject(process.env);
}

function defaultTemplatePath() {
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const bundledTemplatePath = path.join(projectRoot, 'templates', '选品表格-模板.xlsx');
  return fs.existsSync(bundledTemplatePath) ? bundledTemplatePath : null;
}

function parseBoolean(value) {
  return ['1', 'true', 'yes', 'y'].includes(String(value || '').trim().toLowerCase());
}
