/**
 * Strict HTML and Attribute escaping for untrusted database/user content.
 * Prevents Stored and Reflected XSS when rendering dynamic data in the portal.
 */

export function escapeHtml(input: unknown): string {
  if (input === null || input === undefined) return '';
  const str = String(input);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizeUrl(input: unknown): string {
  if (input === null || input === undefined) return '#';
  const str = String(input).trim();
  // Disallow javascript:, data:, vbscript:, etc.
  if (/^(?:https?:|mailto:|tel:|\/|#)/i.test(str)) {
    return escapeHtml(str);
  }
  return '#';
}

