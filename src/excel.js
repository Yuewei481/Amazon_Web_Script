import ExcelJS from 'exceljs';
import fs from 'node:fs';

export const EXCEL_COLUMNS = [
  '上架时间',
  '参考样品图',
  '月销',
  '售价',
  '标题',
  '商品ID',
  ...Array.from({ length: 17 }, (_, index) => `额外参考样品图${index + 1}`),
];

const IMAGE_COLUMN_WIDTH = 57.14285714285715;
const TEMPLATE_SHEET_NAME = '贺卡';
const TEMPLATE_HEADERS = ['上架时间', '参考样品图', '日销', '月销', '售价', '主题', '标题', '商品ID', '竞品内容图片'];

export async function buildWorkbook(products, config = {}) {
  if (config.templatePath && fs.existsSync(config.templatePath)) {
    return buildWorkbookFromTemplate(products, config.templatePath);
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Amazon Selection SOP Automation';
  const ws = workbook.addWorksheet('贺卡');

  ws.columns = EXCEL_COLUMNS.map((header) => ({
    header,
    key: header,
    width: imageColumnHeader(header) ? IMAGE_COLUMN_WIDTH : defaultWidth(header),
  }));
  ws.getRow(1).height = 68.25;
  ws.autoFilter = `A1:${columnLetter(EXCEL_COLUMNS.length)}1`;

  for (const product of products) {
    const row = ws.addRow({
      上架时间: product.listingDate || '',
      月销: product.monthlySales ?? '',
      售价: product.price ?? '',
      标题: product.title || '',
      商品ID: product.asin || '',
    });
    row.height = 300;
    row.alignment = { vertical: 'middle', wrapText: true };
    await addImages(workbook, ws, row.number, product.imagePaths || []);
  }

  styleWorksheet(ws);
  return workbook;
}

export async function saveWorkbook(products, workbookPath, config = {}) {
  const workbook = await buildWorkbook(products, config);
  await workbook.xlsx.writeFile(workbookPath);
}

export async function readExistingProductIds(workbookPath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(workbookPath);
  const ws = workbook.getWorksheet(TEMPLATE_SHEET_NAME) || workbook.worksheets[0];
  if (!ws) throw new Error(`Workbook has no worksheets: ${workbookPath}`);

  const headerMap = getHeaderMap(ws);
  const productIdColumn = headerMap.get('商品ID');
  if (!productIdColumn) {
    throw new Error(`Workbook is missing 商品ID header: ${workbookPath}`);
  }

  const ids = new Set();
  for (let rowNumber = 2; rowNumber <= ws.rowCount; rowNumber += 1) {
    const value = cellText(ws.getRow(rowNumber).getCell(productIdColumn));
    if (value) ids.add(value);
  }
  return ids;
}

export async function appendProductsToWorkbook(workbookPath, products) {
  if (!products.length) return { appended: 0 };

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(workbookPath);
  workbook.creator = workbook.creator || 'Amazon Selection SOP Automation';
  workbook.lastModifiedBy = 'Amazon Selection SOP Automation';

  const ws = workbook.getWorksheet(TEMPLATE_SHEET_NAME) || workbook.worksheets[0];
  if (!ws) throw new Error(`Workbook has no worksheets: ${workbookPath}`);

  const headerMap = getHeaderMap(ws);
  if (!headerMap.get('商品ID')) {
    throw new Error(`Workbook is missing 商品ID header: ${workbookPath}`);
  }
  const imageColumns = imageColumnsForAppend(headerMap);
  let rowNumber = nextAppendRowNumber(ws, headerMap);

  for (const product of products) {
    const row = ws.getRow(rowNumber);
    setIfColumn(row, headerMap, '上架时间', product.listingDate || '');
    setIfColumn(row, headerMap, '日销', '');
    setIfColumn(row, headerMap, '月销', product.monthlySales ?? '');
    setIfColumn(row, headerMap, '售价', product.price ?? '');
    setIfColumn(row, headerMap, '主题', product.theme || '');
    setIfColumn(row, headerMap, '标题', product.title || '');
    setIfColumn(row, headerMap, '商品ID', product.asin || '');
    row.height = 300;
    row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    await addImagesToColumns(workbook, ws, row.number, product.imagePaths || [], imageColumns);
    row.commit();
    rowNumber += 1;
  }

  await workbook.xlsx.writeFile(workbookPath);
  return { appended: products.length };
}

async function buildWorkbookFromTemplate(products, templatePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);
  workbook.creator = 'Amazon Selection SOP Automation';

  const ws = workbook.getWorksheet(TEMPLATE_SHEET_NAME) || workbook.worksheets[0];
  if (!ws) throw new Error(`Template workbook has no worksheets: ${templatePath}`);
  ws.name = TEMPLATE_SHEET_NAME;

  clearTemplateRows(ws);
  ensureTemplateHeaders(ws);
  ws.columns.forEach((column, index) => {
    column.key = ws.getCell(1, index + 1).value || `column_${index + 1}`;
  });
  ws.autoFilter = `A1:I1`;

  let rowNumber = 2;
  for (const product of products) {
    const row = ws.getRow(rowNumber);
    row.getCell(1).value = product.listingDate || '';
    row.getCell(3).value = '';
    row.getCell(4).value = product.monthlySales ?? '';
    row.getCell(5).value = product.price ?? '';
    row.getCell(6).value = product.theme || '';
    row.getCell(7).value = product.title || '';
    row.getCell(8).value = product.asin || '';
    row.height = 300;
    row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    await addImagesToColumns(workbook, ws, row.number, product.imagePaths || [], [2, ...Array.from({ length: 24 }, (_, index) => index + 9)]);
    row.commit();
    rowNumber += 1;
  }

  return workbook;
}

function clearTemplateRows(ws) {
  const lastRow = Math.max(ws.rowCount, 2);
  if (lastRow >= 2) {
    ws.spliceRows(2, lastRow - 1);
  }
}

function ensureTemplateHeaders(ws) {
  TEMPLATE_HEADERS.forEach((header, index) => {
    const cell = ws.getCell(1, index + 1);
    cell.value = header;
  });
}

function getHeaderMap(ws) {
  const map = new Map();
  ws.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const header = cellText(cell);
    if (header) map.set(header, colNumber);
  });
  return map;
}

function setIfColumn(row, headerMap, header, value) {
  const column = headerMap.get(header);
  if (column) row.getCell(column).value = value;
}

function cellText(cell) {
  const value = cell?.value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if ('text' in value) return String(value.text || '').trim();
    if ('richText' in value) return value.richText.map((part) => part.text || '').join('').trim();
    if ('result' in value) return String(value.result || '').trim();
    if ('hyperlink' in value && 'text' in value) return String(value.text || '').trim();
  }
  return String(value).trim();
}

function imageColumnsForAppend(headerMap) {
  const columns = [];
  const primaryImageColumn = headerMap.get('参考样品图');
  if (primaryImageColumn) columns.push(primaryImageColumn);

  for (const [header, column] of headerMap.entries()) {
    if (header.startsWith('额外参考样品图')) columns.push(column);
  }

  const competitorImageColumn = headerMap.get('竞品内容图片');
  if (competitorImageColumn) {
    for (let column = competitorImageColumn; column <= Math.max(competitorImageColumn + 23, 32); column += 1) {
      columns.push(column);
    }
  }

  return [...new Set(columns)].sort((a, b) => a - b);
}

function nextAppendRowNumber(ws, headerMap) {
  const productIdColumn = headerMap.get('商品ID');
  const titleColumn = headerMap.get('标题');
  const checkColumns = [productIdColumn, titleColumn].filter(Boolean);
  for (let rowNumber = ws.rowCount; rowNumber >= 2; rowNumber -= 1) {
    const row = ws.getRow(rowNumber);
    if (checkColumns.some((column) => cellText(row.getCell(column)))) return rowNumber + 1;
  }
  return 2;
}

async function addImages(workbook, ws, rowNumber, imagePaths) {
  const imageColumns = [2, ...Array.from({ length: 17 }, (_, index) => index + 7)];
  await addImagesToColumns(workbook, ws, rowNumber, imagePaths, imageColumns);
}

async function addImagesToColumns(workbook, ws, rowNumber, imagePaths, imageColumns) {
  for (let i = 0; i < Math.min(imagePaths.length, imageColumns.length); i += 1) {
    const imagePath = imagePaths[i];
    if (!fs.existsSync(imagePath)) continue;
    const imageId = workbook.addImage({
      filename: imagePath,
      extension: extensionForExcel(imagePath),
    });
    ws.addImage(imageId, {
      tl: { col: imageColumns[i] - 1, row: rowNumber - 1 },
      ext: { width: 400, height: 400 },
    });
  }
}

function styleWorksheet(ws) {
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
  ws.getColumn('A').width = 16;
  ws.getColumn('C').width = 13;
  ws.getColumn('D').width = 13;
  ws.getColumn('E').width = 13;
  ws.getColumn('F').width = 56;
  ws.getColumn('F').alignment = { vertical: 'middle', wrapText: true };
}

function imageColumnHeader(header) {
  return header === '参考样品图' || header.startsWith('额外参考样品图');
}

function defaultWidth(header) {
  if (header === '标题') return 56;
  if (header === '商品ID') return 24;
  if (header === '上架时间') return 16;
  return 13;
}

function extensionForExcel(filePath) {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.png')) return 'png';
  if (lower.endsWith('.jpeg') || lower.endsWith('.jpg')) return 'jpeg';
  return 'jpeg';
}

function columnLetter(index) {
  let n = index;
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
