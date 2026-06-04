export const DEFAULT_TITLE_KEYWORDS = ['pop up', 'popup', 'pop-up'];

export function titleMatchesKeywords(title, keywords = DEFAULT_TITLE_KEYWORDS) {
  const normalizedTitle = normalizeKeywordText(title);
  const keywordList = Array.isArray(keywords) ? keywords : parseKeywordList(keywords);
  if (!keywordList.length) return true;
  return keywordList.some((keyword) => normalizedTitle.includes(normalizeKeywordText(keyword)));
}

export function titleMatchesPopUp(title) {
  return titleMatchesKeywords(title, DEFAULT_TITLE_KEYWORDS);
}

export function parseKeywordList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeKeywordText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\s-]+/g, ' ')
    .trim();
}

export function parseSalesNumber(value) {
  const text = String(value || '');
  const labeled = text.match(/(?:子体|销量)[^\d]*(\d[\d,]*)\s*\+?/);
  if (labeled) return Number.parseInt(labeled[1].replaceAll(',', ''), 10);
  const matches = Array.from(text.matchAll(/(\d[\d,]*)\s*\+?/g));
  const match = matches.at(-1);
  if (!match) return null;
  return Number.parseInt(match[1].replaceAll(',', ''), 10);
}

export function normalizePrice(value) {
  const text = String(value || '');
  const match = text.match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
  if (!match) return null;
  return Number.parseFloat(match[1]);
}

export function asinFromUrl(url) {
  const text = String(url || '');
  const match = text.match(/(?:\/dp\/|\/gp\/product\/|\/product\/)([A-Z0-9]{9,10})(?:[/?]|$)/i);
  if (match) return match[1].toUpperCase();
  const fallback = text.match(/\b(B0[A-Z0-9]{7,8})\b/i);
  return fallback ? fallback[1].toUpperCase() : null;
}
