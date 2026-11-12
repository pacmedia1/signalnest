#!/usr/bin/env node
'use strict';
/**
 * Content QA gate. Run before committing content, and in CI.
 * Exit code 1 = blocking problem. Warnings do not block.
 */
const fs = require('fs');
const path = require('path');
const { isValidSlug, slugify, stripHtml, sanitizeHtml } = require('./lib/util');

const ROOT = path.resolve(__dirname, '..');
const errors = [];
const warnings = [];

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { errors.push(`${path.relative(ROOT, file)}: unreadable JSON — ${error.message}`); return null; }
}

const config = readJson(path.join(ROOT, 'site.config.json')) || {};
const categories = readJson(path.join(ROOT, 'content', 'categories.json')) || [];
const categorySlugs = new Set(categories.map((c) => c.slug));

/* ---- categories ---- */
if (!categories.length) errors.push('content/categories.json is empty.');
const seenCategory = new Set();
categories.forEach((category) => {
  if (!isValidSlug(category.slug)) errors.push(`Category slug is invalid: "${category.slug}"`);
  if (seenCategory.has(category.slug)) errors.push(`Duplicate category slug: ${category.slug}`);
  seenCategory.add(category.slug);
  ['name', 'description', 'accent'].forEach((field) => {
    if (!category[field]) errors.push(`Category ${category.slug} is missing "${field}"`);
  });
});

/* ---- nav / footer references ---- */
(Array.isArray(config.nav) ? config.nav : []).forEach((item) => {
  const match = /^\/categories\/(.+)$/.exec(item.href || '');
  if (match && !categorySlugs.has(match[1])) errors.push(`Nav links to unknown category: ${match[1]}`);
});

/* ---- content quality heuristics ---- */
const BANNED_PHRASES = [
  'as an ai language model',
  'as an ai,',
  'in conclusion',
  'in today\'s fast-paced world',
  'unlock the power',
  'dive into the world',
  'it is important to note that',
  'lorem ipsum',
  'todo:',
  'tbd',
  'insert image here'
];

const PLACEHOLDER_PATTERNS = [/\bxxx\b/i, /\bexample\.com\/placeholder/i, /\bfixme\b/i];

function checkArticleShape(record, file, { requirePublished }) {
  const label = path.relative(ROOT, file);
  const isGateOpen = record.status === 'published' && record.approved === true;

  if (!isValidSlug(record.slug || '')) errors.push(`${label}: invalid slug "${record.slug}"`);
  if (record.slug && path.basename(file, '.json').replace(/^_draft-/, '') !== record.slug) {
    warnings.push(`${label}: filename does not match slug "${record.slug}"`);
  }
  if (record.category && !categorySlugs.has(record.category)) errors.push(`${label}: unknown category "${record.category}"`);

  if (requirePublished) {
    if (!isGateOpen) {
      errors.push(`${label}: file sits in content/articles but is not publishable (status "${record.status}", approved ${record.approved}). Move it to content/drafts.`);
    }
    ['approvedBy', 'approvedAt', 'publishedAt'].forEach((field) => {
      if (!record[field]) errors.push(`${label}: published article is missing "${field}"`);
    });
  }

  if (isGateOpen) {
    const title = String(record.title || '');
    const description = String(record.description || '');
    if (title.length < 10 || title.length > 120) errors.push(`${label}: title length ${title.length} is outside 10–120`);
    if (title.length > 70) warnings.push(`${label}: title is ${title.length} characters; search results truncate around 60–70`);
    if (description.length < 40 || description.length > 320) errors.push(`${label}: description length ${description.length} is outside 40–320`);
    if (description.length < 120 || description.length > 165) warnings.push(`${label}: description is ${description.length} characters; 120–160 renders best`);

    const clean = sanitizeHtml(record.content || '');
    const removed = String(record.content || '').length - clean.length;
    if (removed > String(record.content || '').length * 0.45) {
      errors.push(`${label}: the sanitiser would strip ${removed} characters. Remove disallowed markup from the source draft.`);
    }

    const words = stripHtml(clean).split(/\s+/).filter(Boolean).length;
    if (words < (config.build && config.build.minWords ? config.build.minWords : 700)) {
      errors.push(`${label}: ${words} words is below the editorial minimum`);
    }

    const sources = Array.isArray(record.sources) ? record.sources : [];
    if (!sources.length) errors.push(`${label}: published article has no sources`);
    sources.forEach((source, index) => {
      if (!/^https?:\/\//i.test(String(source.url || ''))) errors.push(`${label}: source ${index + 1} has no absolute http(s) URL`);
    });

    const lowerContent = stripHtml(clean).toLowerCase();
    BANNED_PHRASES.forEach((phrase) => {
      if (lowerContent.indexOf(phrase) !== -1) warnings.push(`${label}: contains the phrase "${phrase}" — review for filler`);
    });
    PLACEHOLDER_PATTERNS.forEach((pattern) => {
      if (pattern.test(clean)) warnings.push(`${label}: possible placeholder text matching ${pattern}`);
    });

    if (!Array.isArray(record.verification) || !record.verification.length) {
      warnings.push(`${label}: no verification items recorded. Statistics, prices and legal claims should be listed for human checking.`);
    }
    if (record.image && !record.imageAlt) {
      warnings.push(`${label}: article has an image but is missing "imageAlt" for accessibility and image SEO`);
    }
    if (!Array.isArray(record.keywords) || !record.keywords.length) {
      warnings.push(`${label}: article has no "keywords" array for metadata/search indexing`);
    }
    const headings = (clean.match(/<h2[\s>]/gi) || []).length;
    if (headings < 2) warnings.push(`${label}: only ${headings} H2 heading(s). Add structure for scanning and for the table of contents.`);
  }
}

/* ---- articles ---- */
const articlesDir = path.join(ROOT, 'content', 'articles');
if (fs.existsSync(articlesDir)) {
  const files = fs.readdirSync(articlesDir).filter((f) => f.endsWith('.json'));
  const slugs = new Map();
  const titles = new Map();
  files.forEach((name) => {
    const file = path.join(articlesDir, name);
    const record = readJson(file);
    if (!record) return;
    // Files prefixed with "_" are deliberately gated fixtures: they exist to prove the
    // build refuses anything without recorded human approval. They are reported, not failed.
    const isFixture = name.startsWith('_');
    if (isFixture) {
      if (record.status === 'published' && record.approved === true) {
        errors.push(`${name}: a fixture is marked approved. Fixtures must never be publishable.`);
      } else {
        warnings.push(`${name}: fixture held by the approval gate (expected — never published).`);
      }
      return;
    }
    checkArticleShape(record, file, { requirePublished: true });
    if (record.slug) {
      if (slugs.has(record.slug)) errors.push(`Duplicate slug "${record.slug}" in ${name} and ${slugs.get(record.slug)}`);
      slugs.set(record.slug, name);
    }
    if (record.title) {
      const normTitle = record.title.trim().toLowerCase();
      if (titles.has(normTitle)) errors.push(`Duplicate title "${record.title}" in ${name} and ${titles.get(normTitle)}`);
      titles.set(normTitle, name);
    }
  });
  if (!files.length) warnings.push('content/articles is empty — the site will build with an empty homepage.');
}

/* ---- drafts ---- */
const draftsDir = path.join(ROOT, 'content', 'drafts');
if (fs.existsSync(draftsDir)) {
  fs.readdirSync(draftsDir).filter((f) => f.endsWith('.json')).forEach((name) => {
    const file = path.join(draftsDir, name);
    const record = readJson(file);
    if (!record) return;
    const label = path.relative(ROOT, file);
    if (record.approved === true && record.status !== 'published') {
      errors.push(`${label}: approved is true but status is "${record.status}". This is contradictory and must be resolved by an editor.`);
    }
    if (record.status === 'published') {
      warnings.push(`${label}: draft is marked published. Move it to content/articles or reset its status.`);
    }
    if (!isValidSlug(record.slug || '')) errors.push(`${label}: invalid slug`);
  });
}

/* ---- queue ---- */
const queueFile = path.join(ROOT, 'content', 'queue', 'topics.json');
if (fs.existsSync(queueFile)) {
  const queue = readJson(queueFile);
  if (queue) {
    if (!Array.isArray(queue.topics)) errors.push('content/queue/topics.json must contain a "topics" array');
    else {
      const ids = new Set();
      queue.topics.forEach((topic, index) => {
        if (!topic.id) errors.push(`topics.json entry ${index} has no id`);
        if (ids.has(topic.id)) errors.push(`topics.json duplicate id "${topic.id}"`);
        ids.add(topic.id);
        if (!topic.sourceUrl || !/^https?:\/\//i.test(topic.sourceUrl)) errors.push(`topics.json "${topic.title}" has no absolute source URL`);
        if (topic.category && !categorySlugs.has(topic.category)) errors.push(`topics.json "${topic.title}" uses unknown category "${topic.category}"`);
      });
    }
  }
}

/* ---- pages ---- */
const pagesDir = path.join(ROOT, 'content', 'pages');
if (fs.existsSync(pagesDir)) {
  const paths = new Set();
  fs.readdirSync(pagesDir).filter((f) => f.endsWith('.json')).forEach((name) => {
    const page = readJson(path.join(pagesDir, name));
    if (!page) return;
    if (!page.path) errors.push(`content/pages/${name}: missing "path"`);
    if (paths.has(page.path)) errors.push(`content/pages/${name}: duplicate path "${page.path}"`);
    paths.add(page.path);
    if (!page.heading) errors.push(`content/pages/${name}: missing "heading"`);
    if (!page.description || page.description.length < 30) warnings.push(`content/pages/${name}: description is short`);
  });
  ['about', 'contact', 'legal/privacy', 'legal/terms', 'legal/editorial-policy'].forEach((required) => {
    if (!paths.has(required)) errors.push(`Required page is missing: ${required}`);
  });
}

/* ---- configuration coherence ---- */
const envExample = fs.existsSync(path.join(ROOT, '.env.example')) ? fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8') : '';
if (config.gemini && config.gemini.model && envExample && envExample.indexOf(config.gemini.model) === -1) {
  warnings.push(`site.config.json gemini.model (${config.gemini.model}) is not the value shown in .env.example`);
}
if (config.ads && config.ads.enabled && !(config.ads.adsense && config.ads.adsense.client) && !(config.ads.adsterra && config.ads.adsterra.key)) {
  errors.push('Ads are enabled but no network publisher id is configured. Disable ads or add a real id.');
}
if (config.ads && config.ads.adsense && config.ads.adsense.client && !/^ca-pub-\d{16}$/.test(config.ads.adsense.client)) {
  errors.push('ads.adsense.client is set but is not a valid ca-pub-XXXXXXXXXXXXXXXX value.');
}
if (config.analytics && config.analytics.ga4MeasurementId && !/^G-[A-Z0-9]{6,}$/.test(config.analytics.ga4MeasurementId)) {
  errors.push('analytics.ga4MeasurementId is set but is not a valid G-XXXXXXX value.');
}

/* ---- report ---- */
console.log('\nSignalNest content validation');
console.log('─'.repeat(58));
console.log(`  Categories : ${categories.length}`);
console.log(`  Articles   : ${fs.existsSync(articlesDir) ? fs.readdirSync(articlesDir).filter((f) => f.endsWith('.json')).length : 0}`);
console.log(`  Drafts     : ${fs.existsSync(draftsDir) ? fs.readdirSync(draftsDir).filter((f) => f.endsWith('.json')).length : 0}`);
console.log('─'.repeat(58));
if (warnings.length) {
  console.log(`\n  Warnings (${warnings.length}):`);
  warnings.forEach((w) => console.log(`   ! ${w}`));
}
if (errors.length) {
  console.log(`\n  Errors (${errors.length}):`);
  errors.forEach((e) => console.log(`   x ${e}`));
  console.log('\n  ✗ Content validation failed.\n');
  process.exit(1);
}
console.log(`\n  ✓ Content validation passed${warnings.length ? ` with ${warnings.length} warning(s)` : ''}.\n`);
