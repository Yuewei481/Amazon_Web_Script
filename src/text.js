export function titleMatchesPopUp(title) {
  return /\bpop[\s-]?up\b/i.test(String(title || ''));
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
