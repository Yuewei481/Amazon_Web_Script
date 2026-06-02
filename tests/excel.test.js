import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { appendProductsToWorkbook, buildWorkbook, EXCEL_COLUMNS, readExistingProductIds } from '../src/excel.js';

test('EXCEL_COLUMNS excludes 日销 and 主题, and keeps 商品ID', () => {
  assert.equal(EXCEL_COLUMNS.includes('日销'), false);
  assert.equal(EXCEL_COLUMNS.includes('主题'), false);
  assert.equal(EXCEL_COLUMNS.includes('商品ID'), true);
  assert.deepEqual(EXCEL_COLUMNS.slice(0, 6), ['上架时间', '参考样品图', '月销', '售价', '标题', '商品ID']);
});

test('buildWorkbook creates 贺卡 worksheet with expected headers', async () => {
  const workbook = await buildWorkbook([
    {
      listingDate: '2024-07-24',
      monthlySales: 2000,
      price: 9.99,
      title: 'Pop Up Greeting Card',
      asin: 'B0D9GS9CMS',
      imagePaths: [],
    },
  ]);
  const ws = workbook.getWorksheet('贺卡');
  assert.ok(ws);
  assert.equal(ws.getCell('A1').value, '上架时间');
  assert.equal(ws.getCell('F2').value, 'B0D9GS9CMS');
});

test('buildWorkbook can use bundled template shape without 日销 or 主题', async () => {
  const templatePath = path.resolve('templates/选品表格-模板.xlsx');
  if (!fs.existsSync(templatePath)) return;
  const workbook = await buildWorkbook([
    {
      listingDate: '2024-07-24',
      monthlySales: 2000,
      price: 9.99,
      title: 'Pop Up Greeting Card',
      asin: 'B0D9GS9CMS',
      imagePaths: [],
    },
  ], { templatePath });
  const ws = workbook.getWorksheet('贺卡');
  if (ws) {
    assert.equal(ws.getCell('A1').value, '上架时间');
    assert.equal(ws.getCell('C1').value, '月销');
    assert.equal(ws.getCell('F1').value, '商品ID');
    assert.equal(ws.getCell('G1').value, '竞品内容图片');
    assert.equal(ws.getCell('C2').value, 2000);
    assert.equal(ws.getCell('E2').value, 'Pop Up Greeting Card');
    assert.equal(ws.getCell('F2').value, 'B0D9GS9CMS');
  }
});

test('appendProductsToWorkbook appends new rows in place and reads existing 商品ID', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'amazon-selection-append-'));
  const workbookPath = path.join(dir, '选品表格.xlsx');
  const workbook = await buildWorkbook([
    {
      listingDate: '2024-07-24',
      monthlySales: 2000,
      price: 9.99,
      title: 'Existing Pop Up Greeting Card',
      asin: 'B0EXISTING1',
      imagePaths: [],
    },
  ]);
  await workbook.xlsx.writeFile(workbookPath);

  const existingIds = await readExistingProductIds(workbookPath);
  assert.equal(existingIds.has('B0EXISTING1'), true);

  const result = await appendProductsToWorkbook(workbookPath, [
    {
      listingDate: '2026-06-01',
      monthlySales: 4000,
      price: 12.99,
      title: 'New Pop Up Greeting Card',
      asin: 'B0NEW00001',
      imagePaths: [],
    },
  ]);
  assert.equal(result.appended, 1);

  const updated = await buildWorkbook([]);
  await updated.xlsx.readFile(workbookPath);
  const ws = updated.getWorksheet('贺卡');
  assert.equal(ws.getCell('F2').value, 'B0EXISTING1');
  assert.equal(ws.getCell('F3').value, 'B0NEW00001');
});
