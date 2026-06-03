import assert from 'node:assert/strict';
import test from 'node:test';
import { validateConfigObject } from '../src/config.js';

test('validateConfigObject accepts complete config', () => {
  const config = validateConfigObject({
    AMAZON_EMAIL: 'buyer@example.com',
    AMAZON_PASSWORD: 'secret',
    SELLER_SPRITE_USERNAME: 'sprite@example.com',
    SELLER_SPRITE_PASSWORD: 'secret',
    SELLER_SPRITE_EXTENSION_PATH: '/tmp/ext',
    SEARCH_QUERY: 'pop up greeting card',
    CATEGORY_NAME: 'Greeting Cards',
    MIN_CHILD_MONTHLY_SALES: '1000',
    AMAZON_COUNTRY: 'US',
    AMAZON_ZIP: '10001',
    OUTPUT_ROOT: 'outputs',
    HEADLESS: 'false',
  }, { checkExtensionPath: false });

  assert.equal(config.searchQuery, 'pop up greeting card');
  assert.equal(config.categoryName, 'Greeting Cards');
  assert.equal(config.minChildMonthlySales, 1000);
  assert.equal(config.amazonZip, '10001');
  assert.equal(config.headless, false);
  assert.match(config.templatePath || '', /templates/);
});

test('validateConfigObject rejects missing required values', () => {
  assert.throws(() => validateConfigObject({}, { checkExtensionPath: false }), /SELLER_SPRITE_USERNAME/);
});

test('validateConfigObject allows missing Amazon credentials for manual login', () => {
  const config = validateConfigObject({
    SELLER_SPRITE_USERNAME: 'sprite@example.com',
    SELLER_SPRITE_PASSWORD: 'secret',
    SELLER_SPRITE_EXTENSION_PATH: '/tmp/ext',
  }, { checkExtensionPath: false });

  assert.equal(config.amazonEmail, '');
  assert.equal(config.amazonPassword, '');
  assert.equal(config.skipAmazonLogin, false);
  assert.equal(config.categoryName, 'Greeting Cards');
});

test('validateConfigObject allows missing Amazon credentials when Amazon login is skipped', () => {
  const config = validateConfigObject({
    SELLER_SPRITE_USERNAME: 'sprite@example.com',
    SELLER_SPRITE_PASSWORD: 'secret',
    SELLER_SPRITE_EXTENSION_PATH: '/tmp/ext',
    SKIP_AMAZON_LOGIN: 'true',
    SKIP_CART_CLEANUP: 'true',
  }, { checkExtensionPath: false });

  assert.equal(config.skipAmazonLogin, true);
  assert.equal(config.skipCartCleanup, true);
  assert.equal(config.amazonEmail, '');
});

test('validateConfigObject rejects invalid sales threshold', () => {
  assert.throws(() => validateConfigObject({
    AMAZON_EMAIL: 'buyer@example.com',
    AMAZON_PASSWORD: 'secret',
    SELLER_SPRITE_USERNAME: 'sprite@example.com',
    SELLER_SPRITE_PASSWORD: 'secret',
    SELLER_SPRITE_EXTENSION_PATH: '/tmp/ext',
    MIN_CHILD_MONTHLY_SALES: 'abc',
  }, { checkExtensionPath: false }), /MIN_CHILD_MONTHLY_SALES/);
});
