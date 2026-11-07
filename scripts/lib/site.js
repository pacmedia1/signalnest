'use strict';
/** Shared page-building helpers used by the builder. */
const fs = require('fs');
const path = require('path');
const { escapeHtml, escapeAttr, escapeXml, sanitizeHtml, stripHtml, readingTime, formatDate, toIsoDate } = require('./util');

const ROOT = path.resolve(__dirname, '..', '..');

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Cannot read JSON ${file}: ${error.message}`);
  }
}

function readJsonDir(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => ({ file: path.join(dir, name), data: readJson(path.join(dir, name)) }));
}

/* ---------------- colour helpers for category tints ---------------- */
function hexToRgba(hex, alpha) {
  const value = String(hex || '').replace('#', '');
  if (value.length !== 6) return `rgba(242,140,40,${alpha})`;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ---------------- deterministic branded cover (no external assets) ---------------- */
function makeCoverSvg(title, accent, categoryName) {
  const safeTitle = String(title || 'SignalNest').replace(/[<>&]/g, '');
  const words = safeTitle.split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length > 26) { lines.push(line.trim()); line = word; }
    else line = `${line} ${word}`;
    if (lines.length === 3) break;
  }
  if (line.trim() && lines.length < 3) lines.push(line.trim());
  const tspans = lines.slice(0, 3).map((text, index) =>
    `<tspan x="64" dy="${index === 0 ? 0 : 46}">${escapeXml(text)}</tspan>`).join('');
  const y = 300 - (lines.length - 1) * 23;
  const safeAccent = accent || '#F28C28';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" width="1200" height="675" role="img" aria-label="${escapeAttr(safeTitle)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#171717"/><stop offset="0.6" stop-color="#231d18"/><stop offset="1" stop-color="#2c1a0e"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.85" cy="0.15" r="0.75">
      <stop offset="0" stop-color="#FF9F43" stop-opacity="0.45"/><stop offset="0.6" stop-color="#F28C28" stop-opacity="0.18"/><stop offset="1" stop-color="#171717" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="og" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#F28C28"/><stop offset="1" stop-color="#FF9F43"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="675" fill="url(#bg)"/>
  <rect width="1200" height="675" fill="url(#glow)"/>
  <g opacity="0.12" stroke="#FF9F43" stroke-width="1">
    ${Array.from({ length: 14 }, (_, i) => `<line x1="${i * 90}" y1="0" x2="${i * 90 + 100}" y2="675"/>`).join('')}
  </g>
  <!-- Glass card container inside cover -->
  <rect x="40" y="40" width="1120" height="595" rx="20" fill="rgba(255,255,255,0.04)" stroke="rgba(242,140,40,0.22)" stroke-width="1.5"/>
  <text x="74" y="106" fill="url(#og)" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="24" font-weight="800" letter-spacing="5">SIGNALNEST</text>
  <rect x="74" y="126" width="160" height="28" rx="6" fill="rgba(242,140,40,0.18)" stroke="rgba(242,140,40,0.3)" stroke-width="1"/>
  <text x="86" y="145" fill="#FF9F43" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="13" font-weight="700" letter-spacing="2">${escapeXml(String(categoryName || 'EDITORIAL').toUpperCase())}</text>
  <text x="74" y="${y + 20}" fill="#ffffff" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="42" font-weight="700">${tspans}</text>
  <circle cx="1060" cy="540" r="54" fill="none" stroke="#F28C28" stroke-width="5" opacity="0.7"/>
  <circle cx="1060" cy="540" r="22" fill="url(#og)"/>
</svg>`;
}

function makeCoverDataUri(title, accent, categoryName) {
  const svg = makeCoverSvg(title, accent, categoryName);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/* ---------------- table of contents ---------------- */
function buildToc(html) {
  const headings = [];
  let counter = 0;
  const withIds = html.replace(/<h([23])([^>]*)>([\s\S]*?)<\/h\1>/gi, (match, level, attrs, inner) => {
    const text = stripHtml(inner);
    if (!text) return match;
    counter += 1;
    const existing = /id="([^"]+)"/.exec(attrs);
    const id = existing ? existing[1] : `section-${counter}`;
    headings.push({ level: Number(level), id, text });
    if (existing) return match;
    return `<h${level}${attrs} id="${id}">${inner}</h${level}>`;
  });
  return { html: withIds, headings };
}

function renderTocList(headings, className) {
  if (!headings.length) return '';
  const items = headings.map((h) =>
    `<li class="toc__item toc__item--h${h.level}"><a href="#${escapeAttr(h.id)}">${escapeHtml(h.text)}</a></li>`).join('');
  return `<nav class="${className}" aria-label="Table of contents"><p class="toc__title">On this page</p><ol>${items}</ol></nav>`;
}

/* ---------------- advertisement slots ---------------- */
function renderAdSlot(position, config) {
  const ads = config.ads || {};
  if (!ads.enabled) return '';
  const labels = { header: 'Advertisement', inArticle: 'Advertisement', sidebar: 'Advertisement', footer: 'Advertisement' };
  const client = (ads.adsense && ads.adsense.client) || process.env.ADSENSE_CLIENT || '';
  const slotId = ads.adsense && ads.adsense.slots ? ads.adsense.slots[position] || '' : '';
  const adsterraKey = (ads.adsterra && ads.adsterra.key) || process.env.ADSTERRA_KEY || '';
  const placement = ads.adsterra && ads.adsterra.placements ? ads.adsterra.placements[position] || '' : '';
  const admobPub = (ads.admob && ads.admob.publisherId) || process.env.ADMOB_PUB_ID || '';
  const admobSlot = ads.admob && ads.admob.slots ? ads.admob.slots[position] || '' : '';

  const network = (ads.placements && ads.placements[position]) || ads.primaryNetwork || 'adsense';

  let inner = '';
  if (network === 'adsense' && client && slotId) {
    inner = `<ins class="adsbygoogle" style="display:block" data-ad-client="${escapeAttr(client)}" data-ad-slot="${escapeAttr(slotId)}" data-ad-format="auto" data-full-width-responsive="true"></ins>
<script>(adsbygoogle=window.adsbygoogle||[]).push({});</script>`;
  } else if (network === 'adsterra' && adsterraKey && placement) {
    inner = `<div id="adsterra-${escapeAttr(position)}" data-key="${escapeAttr(adsterraKey)}" data-placement="${escapeAttr(placement)}"></div>
<script src="https://pl${escapeAttr(adsterraKey)}.effectivecpmnetwork.com/${escapeAttr(placement)}/invoke.js" async></script>`;
  } else if (network === 'admob' && admobPub) {
    inner = `<ins class="adsbygoogle" style="display:inline-block;width:100%;min-height:50px" data-ad-client="${escapeAttr(admobPub)}" ${admobSlot ? `data-ad-slot="${escapeAttr(admobSlot)}"` : ''} data-ad-format="auto" data-full-width-responsive="true"></ins>
<script>(adsbygoogle=window.adsbygoogle||[]).push({});</script>`;
  } else if (network === 'adsense' && client) {
    inner = '<span>Google AdSense Auto-Ads active</span>';
  } else {
    inner = '<span>Reserved advertising space. Configure ad network credentials in owner dashboard to activate.</span>';
  }

  const modifier = position === 'inArticle' ? 'in-article' : position;
  const isEmpty = inner.includes('Reserved') || inner.includes('Auto-Ads');
  return `<aside class="ad-slot ad-slot--${modifier}${isEmpty ? ' ad-slot--empty' : ''}" aria-label="${labels[position] || 'Advertisement'}" data-ad-position="${escapeAttr(position)}">
<style>.ad-slot--${modifier}{contain:layout;}</style>
<span class="ad-slot__label">${labels[position] || 'Advertisement'}</span>
<div class="ad-slot__inner">${inner}</div>
</aside>`;
}

/* ---------------- pagination ---------------- */
function renderPagination(current, totalPages, basePath) {
  if (totalPages <= 1) return '';
  const hrefFor = (page) => (page === 1 ? basePath : `${basePath}/page/${page}`);
  const parts = [];
  parts.push(current > 1
    ? `<a href="${escapeAttr(hrefFor(current - 1))}" rel="prev">← Previous</a>`
    : '<span class="is-disabled">← Previous</span>');
  const windowSize = 2;
  for (let page = 1; page <= totalPages; page += 1) {
    const inWindow = page === 1 || page === totalPages || Math.abs(page - current) <= windowSize;
    if (!inWindow) {
      if (parts[parts.length - 1] !== '<span class="is-disabled">…</span>') parts.push('<span class="is-disabled">…</span>');
      continue;
    }
    parts.push(page === current
      ? `<span aria-current="page">${page}</span>`
      : `<a href="${escapeAttr(hrefFor(page))}">${page}</a>`);
  }
  parts.push(current < totalPages
    ? `<a href="${escapeAttr(hrefFor(current + 1))}" rel="next">Next →</a>`
    : '<span class="is-disabled">Next →</span>');
  return `<nav class="pagination" aria-label="Pagination">${parts.join('')}</nav>`;
}

/* ---------------- JSON-LD ---------------- */
function scriptJsonLd(data) {
  if (!data) return '';
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return `<script type="application/ld+json">${json}</script>`;
}

module.exports = {
  ROOT, readJson, readJsonDir, hexToRgba,
  makeCoverSvg, makeCoverDataUri,
  buildToc, renderTocList, renderAdSlot, renderPagination, scriptJsonLd,
  sanitizeHtml, stripHtml, readingTime, formatDate, toIsoDate, escapeHtml, escapeAttr, escapeXml
};
