'use strict';
/**
 * SignalNest core utilities - zero dependencies.
 * Shared by the static builder and the n8n Code nodes (copied verbatim so
 * behaviour is identical in both runtimes).
 */

/* ------------------------------------------------------------------ *
 * HTML escaping
 * ------------------------------------------------------------------ */
const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

/* ------------------------------------------------------------------ *
 * Slugs
 * ------------------------------------------------------------------ */
function slugify(input, maxLength = 80) {
  const base = String(input || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  const trimmed = base.slice(0, maxLength).replace(/-+$/g, '');
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(trimmed) ? trimmed : '';
}

/** Strict validation used before any filename or URL is built. */
function isValidSlug(slug) {
  return typeof slug === 'string' && slug.length >= 3 && slug.length <= 80 &&
    /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
}

function uniqueSlug(desired, taken) {
  const set = taken instanceof Set ? taken : new Set(taken || []);
  let candidate = slugify(desired);
  if (!candidate) candidate = 'article';
  if (!set.has(candidate)) return candidate;
  for (let i = 2; i < 500; i += 1) {
    const next = `${candidate}-${i}`;
    if (!set.has(next)) return next;
  }
  return `${candidate}-${Date.now()}`;
}

/* ------------------------------------------------------------------ *
 * HTML sanitisation (whitelist)
 * ------------------------------------------------------------------ */
const ALLOWED_TAGS = new Set([
  'p', 'br', 'hr', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'strong', 'b',
  'em', 'i', 'u', 'blockquote', 'cite', 'code', 'pre', 'a', 'img', 'figure',
  'figcaption', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
  'dl', 'dt', 'dd', 'sup', 'sub', 'mark', 'small', 'span', 'div', 'section'
]);

// Tags removed together with their entire contents.
const DROP_CONTENT_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'noscript', 'template', 'form', 'input', 'button', 'svg', 'math', 'link', 'meta', 'base']);

const ALLOWED_ATTRS = {
  '*': new Set(['id', 'class', 'title', 'dir', 'lang']),
  a: new Set(['href', 'rel', 'target', 'hreflang']),
  img: new Set(['src', 'alt', 'width', 'height', 'loading', 'decoding']),
  th: new Set(['scope', 'colspan', 'rowspan']),
  td: new Set(['colspan', 'rowspan']),
  ol: new Set(['start', 'reversed', 'type']),
  time: new Set(['datetime'])
};

// Absolute http(s), root-relative, relative (no scheme), in-page anchor, or mailto.
const SAFE_URL = /^(https?:\/\/|\/(?!\/)|#|mailto:[^\s]+@[^\s]+$|\.{0,2}\/?[A-Za-z0-9][^\s:]*$)/i;

function isSafeUrl(url) {
  const value = String(url || '').trim();
  if (!value) return false;
  // Reject control characters and anything that hides a scheme.
  if (/[\u0000-\u001f\u007f\s]/.test(value.replace(/^[^:]*:/, ':'))) {
    if (/^https?:\/\/[^\s]+$/.test(value)) return true;
    return false;
  }
  if (/^javascript:/i.test(value) || /^data:/i.test(value) || /^vbscript:/i.test(value)) return false;
  return SAFE_URL.test(value);
}

/**
 * Sanitise article HTML.
 * @param {string} html
 * @param {{siteHost?: string}} options
 * @returns {string}
 */
function sanitizeHtml(html, options = {}) {
  let out = String(html || '');
  if (!out) return '';

  // 1. Remove comments (including conditional comments used to hide payloads).
  out = out.replace(/<!--[\s\S]*?-->/g, '');

  // 2. Remove dangerous elements together with their content.
  for (const tag of DROP_CONTENT_TAGS) {
    const paired = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, 'gi');
    out = out.replace(paired, '');
    const selfClosing = new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi');
    out = out.replace(selfClosing, '');
  }

  // 3. Walk remaining tags and filter tags + attributes.
  out = out.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g,
    (match, closing, rawTag, rawAttrs, selfClose) => {
      const tag = rawTag.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) return ''; // drop tag, keep inner text
      if (closing) return `</${tag}>`;

      const allowed = ALLOWED_ATTRS[tag] ? new Set([...ALLOWED_ATTRS['*'], ...ALLOWED_ATTRS[tag]]) : ALLOWED_ATTRS['*'];
      const kept = [];
      const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
      let m;
      while ((m = attrRe.exec(rawAttrs)) !== null) {
        const name = m[1].toLowerCase();
        const value = m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : m[5];
        if (!allowed.has(name)) continue;
        if (name.startsWith('on')) continue;
        if (name === 'href' || name === 'src') {
          if (!isSafeUrl(value)) continue;
          kept.push(`${name}="${escapeAttr(value)}"`);
          continue;
        }
        if (name === 'style') continue;
        kept.push(`${name}="${escapeAttr(value)}"`);
      }

      if (tag === 'a') {
        const hasHref = kept.some((a) => a.startsWith('href='));
        if (!hasHref) {
          // Keep anchor text but remove the unusable anchor wrapper attributes.
          return `<a${kept.length ? ' ' + kept.join(' ') : ''}>`;
        }
        const hrefMatch = kept.find((a) => a.startsWith('href='));
        const href = hrefMatch.slice(6, -1);
        if (/^https?:\/\//i.test(href)) {
          const filtered = kept.filter((a) => !a.startsWith('rel=') && !a.startsWith('target='));
          filtered.push('rel="nofollow noopener noreferrer"', 'target="_blank"');
          return `<a ${filtered.join(' ')}>`;
        }
        return `<a ${kept.join(' ')}>`;
      }

      if (tag === 'img') {
        const hasSrc = kept.some((a) => a.startsWith('src='));
        if (!hasSrc) return '';
        if (!kept.some((a) => a.startsWith('alt='))) kept.push('alt=""');
        if (!kept.some((a) => a.startsWith('loading='))) kept.push('loading="lazy"');
        if (!kept.some((a) => a.startsWith('decoding='))) kept.push('decoding="async"');
        return `<img ${kept.join(' ')}${selfClose ? ' /' : ''}>`;
      }

      return `<${tag}${kept.length ? ' ' + kept.join(' ') : ''}${selfClose ? ' /' : ''}>`;
    });

  // 4. Neutralise any residual inline event handlers or odd schemes.
  out = out.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  out = out.replace(/(href|src)\s*=\s*("|')?\s*javascript:[^"'>\s]*/gi, '$1="#"');

  return out.trim();
}

/** Strip all markup, returning plain text (used for excerpts/search). */
function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/* ------------------------------------------------------------------ *
 * Text metrics
 * ------------------------------------------------------------------ */
function wordCount(html) {
  const text = stripHtml(html);
  return text ? text.split(/\s+/).length : 0;
}

function readingTime(html, wpm = 220) {
  return Math.max(1, Math.round(wordCount(html) / wpm));
}

function excerptFrom(html, maxLength = 180) {
  const text = stripHtml(html);
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 60 ? lastSpace : maxLength).trim()}…`;
}

/* ------------------------------------------------------------------ *
 * Dates
 * ------------------------------------------------------------------ */
function toIsoDate(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
}

function formatDate(iso, locale = 'en-GB') {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

/* ------------------------------------------------------------------ *
 * Hashing (stable, dependency-free) - used for topic de-duplication
 * ------------------------------------------------------------------ */
function simpleHash(input) {
  const str = String(input || '');
  let h1 = 0xdeadbeef ^ str.length;
  let h2 = 0x41c6ce57 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(16, '0');
}

/** Normalise a title/URL into a comparison key for duplicate detection. */
function dedupeKey(title, url) {
  const norm = String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(the|a|an|and|or|of|for|to|in|on|with|how|what|why|is|are|your|you)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const urlKey = String(url || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '');
  return { titleKey: norm, urlKey };
}

/* ------------------------------------------------------------------ *
 * Base64 without Buffer (works in n8n expressions and Code nodes)
 * ------------------------------------------------------------------ */
const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function utf8Bytes(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i += 1) {
    let code = str.codePointAt(i);
    if (code > 0xffff) i += 1; // surrogate pair consumed
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
  }
  return bytes;
}

/** UTF-8 safe base64 encode. Equivalent to Buffer.from(s,'utf8').toString('base64'). */
function base64Encode(input) {
  const bytes = utf8Bytes(String(input === undefined || input === null ? '' : input));
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += B64_CHARS[b0 >> 2];
    out += B64_CHARS[((b0 & 3) << 4) | ((b1 || 0) >> 4)];
    out += b1 === undefined ? '=' : B64_CHARS[((b1 & 15) << 2) | ((b2 || 0) >> 6)];
    out += b2 === undefined ? '=' : B64_CHARS[b2 & 63];
  }
  return out;
}

function base64Decode(input) {
  const clean = String(input || '').replace(/[^A-Za-z0-9+/=]/g, '');
  let out = '';
  const bytes = [];
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = B64_CHARS.indexOf(clean[i]);
    const c1 = B64_CHARS.indexOf(clean[i + 1]);
    const c2 = B64_CHARS.indexOf(clean[i + 2]);
    const c3 = B64_CHARS.indexOf(clean[i + 3]);
    if (c0 < 0 || c1 < 0) break;
    bytes.push((c0 << 2) | (c1 >> 4));
    if (c2 >= 0) bytes.push(((c1 & 15) << 4) | (c2 >> 2));
    if (c3 >= 0) bytes.push(((c2 & 3) << 6) | c3);
  }
  for (let i = 0; i < bytes.length;) {
    const b = bytes[i];
    if (b < 0x80) { out += String.fromCharCode(b); i += 1; }
    else if (b < 0xe0) { out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f)); i += 2; }
    else if (b < 0xf0) { out += String.fromCharCode(((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)); i += 3; }
    else {
      const cp = ((b & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f);
      out += String.fromCodePoint(cp); i += 4;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * XML
 * ------------------------------------------------------------------ */
function escapeXml(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = {
  escapeHtml, escapeAttr, escapeXml,
  slugify, isValidSlug, uniqueSlug,
  sanitizeHtml, stripHtml, isSafeUrl,
  wordCount, readingTime, excerptFrom,
  toIsoDate, formatDate,
  simpleHash, dedupeKey,
  base64Encode, base64Decode
};
