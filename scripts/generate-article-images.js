#!/usr/bin/env node
'use strict';
/**
 * SignalNest NA10 Article Image Generation CLI
 * 
 * Generates and attaches 3 original, visually relevant images for an article:
 *   1. Featured hero image
 *   2. Supporting image 1 (methodology / structural breakdown)
 *   3. Supporting image 2 (synthesis / practical execution)
 * 
 * Run: node scripts/generate-article-images.js [slug]
 */

const fs = require('fs');
const path = require('path');
const { processArticleImages, STYLES } = require('./lib/image-generator');

const ROOT = path.resolve(__dirname, '..');
const ARTICLES_DIR = path.join(ROOT, 'content', 'articles');

function run() {
  const targetSlug = process.argv[2];
  const files = fs.readdirSync(ARTICLES_DIR).filter((f) => f.endsWith('.json') && !f.startsWith('_'));
  
  let processed = 0;
  console.log('\n============================================================');
  console.log('  SignalNest NA10 — AI Image Generation Pipeline');
  console.log('============================================================\n');

  for (const file of files) {
    const filePath = path.join(ARTICLES_DIR, file);
    const article = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    if (targetSlug && article.slug !== targetSlug) continue;

    console.log(`Processing article: [${article.category}] ${article.title}`);
    console.log(`  Slug: ${article.slug}`);

    const result = processArticleImages(article, {
      provider: 'editorial-svg',
      style: 'abstract-editorial'
    });

    if (result.ok) {
      fs.writeFileSync(filePath, JSON.stringify(result.article, null, 2) + '\n', 'utf8');
      console.log(`  ✓ 3 original images generated & attached:`);
      result.images.forEach((img) => {
        console.log(`     - [${img.type}] ${img.url} (${img.sizeBytes} bytes)`);
      });
      console.log(`  ✓ Verification passed: Visually Complete\n`);
      processed++;
    }
  }

  console.log(`Successfully completed NA10 image generation for ${processed} article(s).\n`);
}

if (require.main === module) {
  run();
}

module.exports = { run };

