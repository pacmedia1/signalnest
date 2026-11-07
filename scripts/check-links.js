#!/usr/bin/env node
'use strict';
/**
 * Crawls the built site and reports broken internal links, missing assets,
 * unresolved anchors and missing alt text. Zero dependencies.
 */
const fs = require('fs');
const path = require('path');

const DIST = path.resolve(__dirname, '..', 'dist');
if (!fs.existsSync(DIST)) {
  console.error('dist/ missing. Run: npm run build');
  process.exit(1);
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(DIST);
const htmlFiles = files.filter((f) => f.endsWith('.html'));
const brokenLinks = [];
const missingAssets = [];
const badAnchors = [];
const imagesWithoutAlt = [];
const external = new Set();
let checkedLinks = 0;

const anchorsByFile = new Map();
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  const ids = new Set();
  const idRe = /\sid="([^"]+)"/g;
  let m;
  while ((m = idRe.exec(html)) !== null) ids.add(m[1]);
  anchorsByFile.set(file, ids);
}

function resolveTarget(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  const target = path.join(DIST, clean);
  if (!target.startsWith(DIST)) return null;
  if (fs.existsSync(target) && fs.statSync(target).isFile()) return target;
  const asHtml = `${target}.html`;
  if (fs.existsSync(asHtml)) return asHtml;
  const asIndex = path.join(target, 'index.html');
  if (fs.existsSync(asIndex)) return asIndex;
  return null;
}

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  const rel = path.relative(DIST, file);

  const attrRe = /\s(?:href|src)="([^"]*)"/g;
  let match;
  while ((match = attrRe.exec(html)) !== null) {
    const url = match[1];
    checkedLinks += 1;
    if (!url || url.startsWith('data:') || url.startsWith('mailto:') || url.startsWith('tel:')) continue;
    if (/^https?:\/\//i.test(url)) {
      try { external.add(new URL(url).hostname); } catch (e) { /* ignore */ }
      continue;
    }
    if (url.startsWith('#')) {
      if (url.length > 1 && !(anchorsByFile.get(file) || new Set()).has(url.slice(1))) {
        badAnchors.push(`${rel} → ${url}`);
      }
      continue;
    }
    const target = resolveTarget(url);
    if (!target) {
      (/\/(assets|images)\//.test(url) ? missingAssets : brokenLinks).push(`${rel} → ${url}`);
      continue;
    }
    const hashIndex = url.indexOf('#');
    if (hashIndex !== -1) {
      const anchor = url.slice(hashIndex + 1);
      const ids = anchorsByFile.get(target);
      if (anchor && ids && !ids.has(anchor)) badAnchors.push(`${rel} → ${url}`);
    }
  }

  const imgRe = /<img\b[^>]*>/g;
  while ((match = imgRe.exec(html)) !== null) {
    if (!/\salt="[^"]*"/.test(match[0])) imagesWithoutAlt.push(`${rel}: ${match[0].slice(0, 80)}`);
  }
}

const report = (label, list, limit = 12) => {
  console.log(`\n${label}: ${list.length}`);
  list.slice(0, limit).forEach((item) => console.log(`   - ${item}`));
  if (list.length > limit) console.log(`   … and ${list.length - limit} more`);
};

console.log(`\nSignalNest link check — ${htmlFiles.length} HTML files, ${checkedLinks} link/src attributes`);
report('Broken internal links', brokenLinks);
report('Missing assets', missingAssets);
report('Broken anchors', badAnchors);
report('Images without alt text', imagesWithoutAlt);
console.log(`\nExternal hosts referenced: ${external.size}${external.size ? ` (${[...external].slice(0, 8).join(', ')})` : ''}`);

const failures = brokenLinks.length + missingAssets.length + badAnchors.length + imagesWithoutAlt.length;
if (failures) {
  console.log(`\n✗ ${failures} linking/accessibility problem(s) found.\n`);
  process.exit(1);
}
console.log('\n✓ No broken links, no missing assets, every image has alt text.\n');
