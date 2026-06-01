import assert from 'node:assert/strict';
import test from 'node:test';
import {
  asinFromUrl,
  normalizePrice,
  parseSalesNumber,
  titleMatchesPopUp,
} from '../src/text.js';

test('titleMatchesPopUp accepts common pop up variants', () => {
  assert.equal(titleMatchesPopUp('3D Pop Up Greeting Card'), true);
  assert.equal(titleMatchesPopUp('3D pop-up card'), true);
  assert.equal(titleMatchesPopUp('Popup Birthday Card'), true);
  assert.equal(titleMatchesPopUp('10 Inch Life Sized Forever Flower Bouquet 3D Pop Up Birthday Gift Card'), true);
  assert.equal(titleMatchesPopUp('Floral Greeting Card'), false);
});

test('parseSalesNumber handles commas and plus signs', () => {
  assert.equal(parseSalesNumber('2,000+'), 2000);
  assert.equal(parseSalesNumber('近30天销量(子体): 10,000+'), 10000);
  assert.equal(parseSalesNumber('100+'), 100);
  assert.equal(parseSalesNumber(''), null);
});

test('normalizePrice returns a number or null', () => {
  assert.equal(normalizePrice('$9.99'), 9.99);
  assert.equal(normalizePrice('价格: $12.60'), 12.6);
  assert.equal(normalizePrice('not available'), null);
});

test('asinFromUrl extracts Amazon ASIN', () => {
  assert.equal(asinFromUrl('https://www.amazon.com/dp/B0D9GS9CMS'), 'B0D9GS9CMS');
  assert.equal(asinFromUrl('https://www.amazon.com/name/product/B0C45RJZ6/ref=sr_1_1'), 'B0C45RJZ6');
  assert.equal(asinFromUrl('https://www.amazon.com/no-asin'), null);
});
