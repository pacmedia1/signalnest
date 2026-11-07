#!/usr/bin/env node
'use strict';
/**
 * SignalNest static builder.
 * Source of truth: content (all JSON)   Output: dist/
 * Zero dependencies. Deterministic: same input -> identical output.
 *
 * A single approved article file produces, automatically:
 *   - its own static HTML page
 *   - an entry on the homepage
 *   - an entry on its category page(s)
 *   - an entry in the search index
 *   - an entry in sitemap.xml and feed.xml
 *   - internal links from related articles
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const {
  ROOT, readJson, readJsonDir, hexToRgba, makeCoverSvg,
  buildToc, renderTocList, renderAdSlot, renderPagination, scriptJsonLd,
  sanitizeHtml, stripHtml, readingTime, formatDate, toIsoDate, escapeHtml, escapeAttr, escapeXml
} = require('./lib/site');
const { isValidSlug, slugify } = require('./lib/util');
const { render } = require('./lib/render');

const STRICT = process.argv.includes('--strict');
const DIST = path.join(ROOT, 'dist');
const SITE = readJson(path.join(ROOT, 'site.config.json'));
const CATEGORIES = readJson(path.join(ROOT, 'content', 'categories.json'));
const CATEGORY_BY_SLUG = new Map(CATEGORIES.map((c) => [c.slug, c]));

const errors = [];
const warnings = [];
const stats = { published: 0, hidden: 0, pages: 0, files: 0, skipped: [] };

/* ------------------------------------------------------------------ *
 * 1. Load templates
 * ------------------------------------------------------------------ */
function loadTemplates() {
  const dir = path.join(ROOT, 'templates');
  const templates = {};
  fs.readdirSync(dir).filter((f) => f.endsWith('.html')).forEach((file) => {
    templates[file.replace(/\.html$/, '')] = fs.readFileSync(path.join(dir, file), 'utf8');
  });
  const partialDir = path.join(dir, 'partials');
  const partials = {};
  if (fs.existsSync(partialDir)) {
    fs.readdirSync(partialDir).filter((f) => f.endsWith('.html')).forEach((file) => {
      partials[file.replace(/\.html$/, '')] = fs.readFileSync(path.join(partialDir, file), 'utf8');
    });
  }
  return { templates, partials };
}

/* ------------------------------------------------------------------ *
 * 2. Normalise + validate articles
 * ------------------------------------------------------------------ */
function isPublishable(record, file) {
  const problems = [];
  if (!record || typeof record !== 'object') problems.push('record is not an object');
  else {
    if (record.status !== 'published') problems.push(`status is "${record.status}" (needs "published")`);
    if (record.approved !== true) problems.push('approved is not true (human approval required)');
    if (!record.approvedAt) problems.push('approvedAt is missing');
    const slug = record.slug || '';
    if (!isValidSlug(slug)) problems.push(`invalid slug "${slug}"`);
    if (!record.title || String(record.title).length < 10) problems.push('title too short');
    if (!record.description || String(record.description).length < 40) problems.push('description too short (needs 40+ chars)');
    if (!record.category || !CATEGORY_BY_SLUG.has(record.category)) problems.push(`unknown category "${record.category}"`);
    if (!record.publishedAt || !toIsoDate(record.publishedAt)) problems.push('publishedAt missing or invalid');
    if (!record.content || stripHtml(record.content).length < 200) problems.push('content missing or too short');
  }
  return { ok: problems.length === 0, problems, file };
}

function normaliseArticle(record, file) {
  const category = CATEGORY_BY_SLUG.get(record.category);
  const sanitized = sanitizeHtml(record.content, { siteHost: SITE.url });
  if (sanitized.length < String(record.content).length * 0.55) {
    warnings.push(`${record.slug}: sanitizer removed a large share of the draft HTML (${record.content.length} -> ${sanitized.length} chars). Check the draft for disallowed markup.`);
  }
  const toc = buildToc(sanitized);
  const words = stripHtml(sanitized).split(/\s+/).filter(Boolean).length;
  if (words < (SITE.build.minWords || 700)) {
    warnings.push(`${record.slug}: ${words} words is below the ${SITE.build.minWords}-word editorial minimum.`);
  }
  const sources = Array.isArray(record.sources) ? record.sources.filter((s) => s && s.url && /^https?:\/\//i.test(s.url)) : [];
  if (!sources.length) warnings.push(`${record.slug}: no valid source URLs. Published articles should cite at least one source for factual claims.`);

  const publishedIso = toIsoDate(record.publishedAt);
  const updatedIso = record.updatedAt ? toIsoDate(record.updatedAt) : '';

  return {
    raw: record,
    file,
    slug: record.slug,
    title: record.title,
    description: record.description,
    category,
    categorySlug: category.slug,
    categoryName: category.name,
    categoryAccent: category.accent,
    categoryTint: hexToRgba(category.accent, 0.12),
    author: record.author || SITE.author.name,
    reviewer: record.reviewer || record.approvedBy || SITE.author.name,
    tags: Array.isArray(record.tags) ? record.tags : [],
    keywords: Array.isArray(record.keywords) ? record.keywords : [],
    publishedIso,
    publishedLabel: formatDate(publishedIso, SITE.locale === 'en' ? 'en-GB' : SITE.locale),
    updatedIso,
    updatedLabel: updatedIso ? formatDate(updatedIso) : '',
    reviewedLabel: formatDate(record.approvedAt || publishedIso),
    readingTime: readingTime(sanitized, SITE.build.readingWordsPerMinute),
    wordCount: words,
    excerpt: record.excerpt || record.description,
    image: record.heroImage || '',
    imageAlt: record.heroImageAlt || `${record.title} (cover image)`,
    imageCaption: record.heroImageCaption || '',
    supportingImage1: record.supportingImage1 || '',
    supportingImage1Alt: record.supportingImage1Alt || (record.supportingImage1 ? `${record.title} (diagram)` : ''),
    supportingImage1Caption: record.supportingImage1Caption || '',
    supportingImage2: record.supportingImage2 || '',
    supportingImage2Alt: record.supportingImage2Alt || (record.supportingImage2 ? `${record.title} (synthesis)` : ''),
    supportingImage2Caption: record.supportingImage2Caption || '',
    images: Array.isArray(record.images) ? record.images : [],
    content: toc.html,
    tocHtml: renderTocList(toc.headings, 'toc'),
    tocSidebar: renderTocList(toc.headings.slice(0, 8), 'toc'),
    headings: toc.headings,
    sources: sources.map((s) => ({
      title: s.title || s.url,
      url: s.url,
      publisher: s.publisher || '',
      accessedLabel: s.accessedAt ? formatDate(toIsoDate(s.accessedAt)) : ''
    })),
    verification: Array.isArray(record.verification)
      ? record.verification.filter(Boolean).map((v) => escapeHtml(typeof v === 'string' ? v : (v.text || '')))
      : [],
    featured: record.featured === true
  };
}

/* ------------------------------------------------------------------ *
 * 3. Load content
 * ------------------------------------------------------------------ */
const { templates, partials } = loadTemplates();

const articleFiles = readJsonDir(path.join(ROOT, 'content', 'articles'));
const allArticles = [];
const seenSlugs = new Map();

for (const entry of articleFiles) {
  const gate = isPublishable(entry.data, entry.file);
  if (!gate.ok) {
    stats.hidden += 1;
    if (entry.data && entry.data.status === 'published') {
      errors.push(`${path.basename(entry.file)}: published but not publishable -> ${gate.problems.join('; ')}`);
    }
    stats.skipped.push({ file: path.basename(entry.file), reasons: gate.problems });
    continue;
  }
  if (seenSlugs.has(entry.data.slug)) {
    errors.push(`Duplicate slug "${entry.data.slug}" in ${path.basename(entry.file)} and ${path.basename(seenSlugs.get(entry.data.slug))}. Skipping the duplicate.`);
    stats.hidden += 1;
    continue;
  }
  seenSlugs.set(entry.data.slug, entry.file);
  allArticles.push(normaliseArticle(entry.data, entry.file));
}

allArticles.sort((a, b) => new Date(b.publishedIso) - new Date(a.publishedIso));
stats.published = allArticles.length;

const PAGES = readJsonDir(path.join(ROOT, 'content', 'pages')).map((entry) => entry.data);

/* ------------------------------------------------------------------ *
 * 4. Shared render context
 * ------------------------------------------------------------------ */
const AD_SLOTS = {
  header: renderAdSlot('header', SITE),
  inArticle: renderAdSlot('inArticle', SITE),
  sidebar: renderAdSlot('sidebar', SITE),
  footer: renderAdSlot('footer', SITE)
};

const SITE_CTX = {
  siteName: SITE.siteName,
  tagline: SITE.tagline,
  description: SITE.description,
  url: SITE.url,
  locale: SITE.locale,
  language: SITE.language,
  twitterHandle: SITE.twitterHandle || '',
  brandFirst: SITE.siteName.slice(0, 6),
  brandSecond: SITE.siteName.slice(6),
  author: SITE.author
};

const FOOTER_CATEGORIES = CATEGORIES.map((c) => ({ slug: c.slug, name: c.name }));

function cardModel(article) {
  return {
    slug: article.slug,
    title: article.title,
    excerpt: article.excerpt,
    image: article.image,
    imageAlt: article.imageAlt,
    categorySlug: article.categorySlug,
    categoryName: article.categoryName,
    categoryAccent: article.categoryAccent,
    categoryTint: article.categoryTint,
    publishedIso: article.publishedIso,
    publishedLabel: article.publishedLabel,
    readingTime: article.readingTime,
    author: article.author
  };
}

function withLayout(pageCtx, contentHtml) {
  const ctx = {
    site: SITE_CTX,
    page: pageCtx,
    content: contentHtml,
    nav: SITE.nav.map((item) => ({
      label: item.label,
      href: item.href,
      isActive: pageCtx.activePath ? item.href === pageCtx.activePath : false
    })),
    footerLinks: SITE.footerLinks,
    footerCategories: FOOTER_CATEGORIES,
    year: new Date().getUTCFullYear(),
    ga4Id: (SITE.analytics && SITE.analytics.ga4MeasurementId) || '',
    adsenseClient: (SITE.ads && SITE.ads.enabled && SITE.ads.adsense && SITE.ads.adsense.client) || (SITE.ads && SITE.ads.enabled && process.env.ADSENSE_CLIENT) || '',
    adsterraHeaderScript: (SITE.ads && SITE.ads.enabled && SITE.ads.adsterra && SITE.ads.adsterra.headerScript) || '',
    headerAd: AD_SLOTS.header,
    footerAd: AD_SLOTS.footer
  };
  return render(templates.layout, ctx, partials);
}

function pageMeta(overrides) {
  return Object.assign({
    title: SITE.siteName,
    description: SITE.description,
    canonical: SITE.url + '/',
    robots: 'index, follow, max-image-preview:large',
    ogType: 'website',
    ogImage: SITE.url + (SITE.defaultOgImage || '/assets/images/og-default.svg'),
    ogImageAlt: `${SITE.siteName} — ${SITE.tagline}`,
    ogTitle: '',
    jsonLd: '',
    bodyClass: '',
    extraScripts: '',
    activePath: '',
    noIndexFeed: false,
    articlePublishedTime: '',
    articleModifiedTime: '',
    articleSection: ''
  }, overrides);
}

/* ------------------------------------------------------------------ *
 * 5. Write helpers
 * ------------------------------------------------------------------ */
function write(relativePath, contents) {
  const target = path.join(DIST, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
  stats.files += 1;
}

function copyDir(from, to, filter) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (filter && !filter(source, entry)) continue;
    if (entry.isDirectory()) copyDir(source, target, filter);
    else { fs.copyFileSync(source, target); stats.files += 1; }
  }
}

/* ------------------------------------------------------------------ *
 * 6. Build
 * ------------------------------------------------------------------ */
function emptyDist() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });
}

/* ---- 6a. Article pages ---- */
function buildArticlePages() {
  for (const article of allArticles) {
    let image = article.image;
    if (!image) {
      const coverRel = `assets/images/covers/${article.slug}.svg`;
      write(coverRel, makeCoverSvg(article.title, article.categoryAccent, article.categoryName));
      image = `/${coverRel}`;
    }
    article.image = image;

    const related = allArticles
      .filter((candidate) => candidate.slug !== article.slug)
      .map((candidate) => {
        let score = 0;
        if (candidate.categorySlug === article.categorySlug) score += 3;
        const sharedTags = candidate.tags.filter((tag) => article.tags.includes(tag)).length;
        score += sharedTags * 2;
        const targetWords = new Set(`${article.title} ${article.keywords.join(' ')}`.toLowerCase().split(/\W+/).filter((w) => w.length > 4));
        const candidateWords = `${candidate.title} ${candidate.keywords.join(' ')}`.toLowerCase().split(/\W+/);
        score += candidateWords.filter((w) => targetWords.has(w)).length * 0.5;
        return { candidate, score };
      })
      .sort((a, b) => (b.score - a.score) || (new Date(b.candidate.publishedIso) - new Date(a.candidate.publishedIso)))
      .slice(0, SITE.build.maxRelated || 3)
      .map((entry) => cardModel(entry.candidate));

    const canonical = `${SITE.url}/articles/${article.slug}`;
    const encodedUrl = encodeURIComponent(canonical);
    const encodedTitle = encodeURIComponent(article.title);

    const jsonLd = [
      {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
        headline: article.title.slice(0, 110),
        description: article.description,
        image: [article.image.startsWith('http') ? article.image : SITE.url + article.image],
        datePublished: article.publishedIso,
        dateModified: article.updatedIso || article.publishedIso,
        articleSection: article.categoryName,
        keywords: article.keywords.join(', ') || article.tags.join(', '),
        wordCount: article.wordCount,
        inLanguage: SITE.language,
        author: { '@type': 'Organization', name: article.author, url: SITE.url + '/about' },
        publisher: {
          '@type': 'Organization',
          name: SITE.siteName,
          logo: { '@type': 'ImageObject', url: SITE.url + (SITE.publisherLogo || '/assets/images/logo.svg') }
        },
        isAccessibleForFree: true
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE.url + '/' },
          { '@type': 'ListItem', position: 2, name: article.categoryName, item: `${SITE.url}/categories/${article.categorySlug}` },
          { '@type': 'ListItem', position: 3, name: article.title }
        ]
      }
    ].map(scriptJsonLd).join('\n');

    const articleCtx = {
      article: Object.assign({}, article, { description: article.description }),
      related,
      share: {
        x: `https://x.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
        linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
        whatsapp: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`
      },
      breadcrumbs: [
        { label: 'Home', href: '/' },
        { label: article.categoryName, href: `/categories/${article.categorySlug}` },
        { label: article.title.length > 52 ? `${article.title.slice(0, 52)}…` : article.title }
      ],
      ads: {
        inArticleTop: renderAdSlot('inArticle', SITE),
        inArticleBottom: renderAdSlot('inArticle', SITE),
        sidebar: AD_SLOTS.sidebar,
        footer: AD_SLOTS.footer
      }
    };

    const bodyHtml = render(templates.article, articleCtx, partials);
    const html = withLayout(pageMeta({
      title: `${article.title} | ${SITE.siteName}`,
      description: article.description,
      canonical,
      ogType: 'article',
      ogTitle: article.title,
      ogImage: article.image.startsWith('http') ? article.image : SITE.url + article.image,
      ogImageAlt: article.imageAlt,
      jsonLd,
      bodyClass: 'page-article',
      activePath: `/categories/${article.categorySlug}`,
      articlePublishedTime: article.publishedIso,
      articleModifiedTime: article.updatedIso || article.publishedIso,
      articleSection: article.categoryName
    }), bodyHtml);

    write(`articles/${article.slug}.html`, html);
    stats.pages += 1;
  }
}

/* ---- 6b. Homepage ---- */
function buildHome() {
  const featured = allArticles.find((a) => a.featured) || allArticles[0] || null;
  const secondary = allArticles.filter((a) => !featured || a.slug !== featured.slug).slice(0, 3).map(cardModel);
  const latest = allArticles.slice(0, SITE.homepage.latestCount || 6).map(cardModel);
  const trending = allArticles.slice(0, SITE.homepage.trendingCount || 5).map(cardModel);

  const counts = new Map();
  allArticles.forEach((a) => counts.set(a.categorySlug, (counts.get(a.categorySlug) || 0) + 1));
  const categories = CATEGORIES.map((c) => ({
    slug: c.slug,
    name: c.name,
    accent: c.accent,
    image: c.image || '',
    shortDescription: c.description.length > 92 ? `${c.description.slice(0, 90)}…` : c.description,
    count: counts.get(c.slug) || 0,
    countLabel: (counts.get(c.slug) || 0) === 1 ? 'article' : 'articles'
  }));

  const homeJsonLd = scriptJsonLd({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE.siteName,
    url: SITE.url,
    description: SITE.description,
    inLanguage: SITE.language,
    publisher: { '@type': 'Organization', name: SITE.siteName, url: SITE.url },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${SITE.url}/search?q={search_term_string}` },
      'query-input': 'required name=search_term_string'
    }
  });

  const html = withLayout(pageMeta({
    title: `${SITE.siteName} — ${SITE.tagline}`,
    description: SITE.description,
    canonical: `${SITE.url}/`,
    ogTitle: `${SITE.siteName} — ${SITE.tagline}`,
    jsonLd: homeJsonLd + (allArticles.length ? scriptJsonLd({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: allArticles.slice(0, 10).map((a, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: `${SITE.url}/articles/${a.slug}`
      }))
    }) : ''),
    activePath: '/'
  }), render(templates.home, {
    site: SITE_CTX,
    featured: featured ? cardModel(featured) : null,
    secondary,
    latest,
    trending,
    categories,
    ads: AD_SLOTS,
    searchEnabled: true
  }, partials));

  write('index.html', html);
  stats.pages += 1;
}

/* ---- 6c. Category pages ---- */
function buildCategoryPages() {
  const perPage = SITE.pagination.perPage || 9;
  for (const category of CATEGORIES) {
    const articles = allArticles.filter((a) => a.categorySlug === category.slug);
    const totalPages = Math.max(1, Math.ceil(articles.length / perPage));

    for (let page = 1; page <= totalPages; page += 1) {
      const slice = articles.slice((page - 1) * perPage, page * perPage).map(cardModel);
      const basePath = `/categories/${category.slug}`;
      const canonical = page === 1 ? `${SITE.url}${basePath}` : `${SITE.url}${basePath}/page/${page}`;
      const pageLabel = page === 1 ? '' : ` — Page ${page}`;

      const jsonLd = [
        scriptJsonLd({
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: `${category.name}${pageLabel}`,
          description: category.description,
          url: canonical,
          isPartOf: { '@type': 'WebSite', name: SITE.siteName, url: SITE.url }
        }),
        scriptJsonLd({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: SITE.url + '/' },
            { '@type': 'ListItem', position: 2, name: category.name, item: `${SITE.url}${basePath}` }
          ]
        })
      ].join('\n');

      const html = withLayout(pageMeta({
        title: `${category.name}${pageLabel} | ${SITE.siteName}`,
        description: `${category.description} Browse ${articles.length} reviewed ${articles.length === 1 ? 'article' : 'articles'} in ${category.name}.`,
        canonical,
        ogTitle: `${category.name} — ${SITE.siteName}`,
        jsonLd,
        bodyClass: 'page-category',
        activePath: basePath,
        // Paginated category pages after the first are indexed but canonicalised to page 1
        robots: page === 1 ? 'index, follow, max-image-preview:large' : 'noindex, follow'
      }), render(templates.category, {
        site: SITE_CTX,
        category: Object.assign({}, category, { tint: hexToRgba(category.accent, 0.12) }),
        articles: slice,
        articleCountLabel: articles.length === 1 ? 'article' : 'articles',
        pagination: renderPagination(page, totalPages, basePath),
        ads: AD_SLOTS
      }, partials));

      const relPath = page === 1 ? `categories/${category.slug}.html` : `categories/${category.slug}/page/${page}.html`;
      write(relPath, html);
      stats.pages += 1;
    }
  }
}

/* ---- 6d. Search page ---- */
function buildSearchPage() {
  const html = withLayout(pageMeta({
    title: `Search | ${SITE.siteName}`,
    description: `Search every published ${SITE.siteName} article by title, description, category or full text.`,
    canonical: `${SITE.url}/search`,
    jsonLd: scriptJsonLd({
      '@context': 'https://schema.org',
      '@type': 'SearchResultsPage',
      name: `Search ${SITE.siteName}`,
      url: `${SITE.url}/search`
    }),
    bodyClass: 'page-search',
    extraScripts: '<script src="/assets/js/search.js" defer></script>'
  }), render(templates.search, { site: SITE_CTX, ads: AD_SLOTS }, partials));
  write('search.html', html);
  stats.pages += 1;
}

/* ---- 6e. Static / legal pages ---- */
function buildStaticPages() {
  for (const page of PAGES) {
    if (!page || !page.path) { warnings.push('A page in content/pages has no "path" and was skipped.'); continue; }
    const cleanPath = String(page.path).replace(/^\/+|\/+$/g, '');
    if (!cleanPath || cleanPath.includes('..')) { errors.push(`Unsafe page path "${page.path}"`); continue; }
    const canonical = `${SITE.url}/${cleanPath}`;
    const html = withLayout(pageMeta({
      title: `${page.title || page.heading} | ${SITE.siteName}`,
      description: page.description || SITE.description,
      canonical,
      ogTitle: page.title || page.heading,
      jsonLd: scriptJsonLd({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: page.title || page.heading,
        url: canonical,
        description: page.description || SITE.description,
        isPartOf: { '@type': 'WebSite', name: SITE.siteName, url: SITE.url }
      }),
      bodyClass: 'page-static'
    }), render(templates.page, {
      site: SITE_CTX,
      page: {
        heading: page.heading || page.title,
        body: sanitizeHtml(page.body || ''),
        updatedLabel: page.updatedAt ? formatDate(toIsoDate(page.updatedAt)) : ''
      }
    }, partials));
    write(`${cleanPath}.html`, html);
    stats.pages += 1;
  }
}

/* ---- 6f. Feeds, sitemap, robots, data ---- */
function buildFeedsAndData() {
  /* articles.json - the central machine-readable index */
  const index = {
    generatedAt: new Date().toISOString(),
    site: { name: SITE.siteName, url: SITE.url, language: SITE.language },
    count: allArticles.length,
    categories: CATEGORIES.map((c) => ({
      slug: c.slug,
      name: c.name,
      count: allArticles.filter((a) => a.categorySlug === c.slug).length
    })),
    articles: allArticles.map((a) => ({
      slug: a.slug,
      title: a.title,
      description: a.description,
      category: a.categorySlug,
      categoryName: a.categoryName,
      tags: a.tags,
      keywords: a.keywords,
      author: a.author,
      reviewer: a.reviewer,
      publishedAt: a.publishedIso,
      updatedAt: a.updatedIso || null,
      url: `${SITE.url}/articles/${a.slug}`,
      path: `/articles/${a.slug}`,
      image: a.image,
      imageAlt: a.imageAlt,
      readingTime: a.readingTime,
      wordCount: a.wordCount,
      sources: a.sources,
      featured: a.featured
    }))
  };
  write('data/articles.json', JSON.stringify(index, null, 2));

  /* search-index.json */
  const searchIndex = {
    generatedAt: index.generatedAt,
    items: allArticles.map((a) => ({
      slug: a.slug,
      title: a.title,
      description: a.description,
      categoryName: a.categoryName,
      categorySlug: a.categorySlug,
      publishedLabel: a.publishedLabel,
      readingTime: a.readingTime,
      tags: a.tags,
      body: stripHtml(a.content).slice(0, 2500)
    }))
  };
  write('data/search-index.json', JSON.stringify(searchIndex));

  /* sitemap.xml */
  const urls = [
    { loc: SITE.url + '/', lastmod: allArticles[0] ? allArticles[0].publishedIso : new Date().toISOString(), priority: '1.0', changefreq: 'daily' },
    { loc: `${SITE.url}/search`, lastmod: new Date().toISOString(), priority: '0.3', changefreq: 'monthly' }
  ];
  CATEGORIES.forEach((c) => {
    const newest = allArticles.find((a) => a.categorySlug === c.slug);
    urls.push({
      loc: `${SITE.url}/categories/${c.slug}`,
      lastmod: newest ? newest.publishedIso : new Date().toISOString(),
      priority: '0.7',
      changefreq: 'weekly'
    });
  });
  allArticles.forEach((a) => {
    urls.push({
      loc: `${SITE.url}/articles/${a.slug}`,
      lastmod: a.updatedIso || a.publishedIso,
      priority: '0.9',
      changefreq: 'monthly'
    });
  });
  PAGES.forEach((p) => {
    const cleanPath = String(p.path || '').replace(/^\/+|\/+$/g, '');
    if (!cleanPath) return;
    urls.push({
      loc: `${SITE.url}/${cleanPath}`,
      lastmod: p.updatedAt ? toIsoDate(p.updatedAt) : new Date().toISOString(),
      priority: '0.4',
      changefreq: 'yearly'
    });
  });

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <lastmod>${escapeXml(u.lastmod)}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;
  write('sitemap.xml', sitemap);

  /* robots.txt */
  const robots = `# ${SITE.siteName}
User-agent: *
Allow: /
Disallow: /admin
Disallow: /admin/
Disallow: /data/
Disallow: /404

# Drafts, review screens and internal endpoints are never public.
User-agent: *
Crawl-delay: 1

Sitemap: ${SITE.url}/sitemap.xml
`;
  write('robots.txt', robots);

  /* ads.txt - only real authorised sellers. Never invent publisher IDs. */
  const adsenseClient = (SITE.ads && SITE.ads.adsense && SITE.ads.adsense.client) || process.env.ADSENSE_CLIENT || '';
  const admobPub = (SITE.ads && SITE.ads.admob && SITE.ads.admob.publisherId) || process.env.ADMOB_PUB_ID || '';
  const directSellers = (process.env.ADS_TXT_AUTH_DIRECT || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const adsLines = [];
  adsLines.push(`# ads.txt for ${SITE.siteName}`);
  adsLines.push('# Authorised digital sellers only. Do not add records you cannot verify.');
  if (/^ca-pub-\d{16}$/.test(adsenseClient)) {
    adsLines.push(`google.com, ${adsenseClient.replace('ca-', '')}, DIRECT, f08c47fec0942fa0`);
  } else if (/^pub-\d{16}$/.test(admobPub)) {
    adsLines.push(`google.com, ${admobPub}, DIRECT, f08c47fec0942fa0`);
  } else {
    adsLines.push('# No Google AdSense/AdMob publisher ID is configured, so no google.com record is written.');
  }
  if (SITE.ads && SITE.ads.adsterra && Array.isArray(SITE.ads.adsterra.adsTxtLines)) {
    adsLines.push(...SITE.ads.adsterra.adsTxtLines);
  }
  if (directSellers.length) adsLines.push(...directSellers);
  else adsLines.push('# No additional direct sellers configured.');
  write('ads.txt', `${adsLines.join('\n')}\n`);

  /* app-ads.txt - for Google AdMob app / PWA verification */
  const appAdsLines = [];
  appAdsLines.push(`# app-ads.txt for ${SITE.siteName} (Google AdMob / App Verification)`);
  if (/^ca-pub-\d{16}$/.test(adsenseClient)) {
    appAdsLines.push(`google.com, ${adsenseClient.replace('ca-', '')}, DIRECT, f08c47fec0942fa0`);
  } else if (/^pub-\d{16}$/.test(admobPub)) {
    appAdsLines.push(`google.com, ${admobPub}, DIRECT, f08c47fec0942fa0`);
  } else {
    appAdsLines.push('# No Google AdMob publisher ID configured.');
  }
  if (directSellers.length) appAdsLines.push(...directSellers);
  write('app-ads.txt', `${appAdsLines.join('\n')}\n`);

  /* feed.xml */
  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE.siteName)}</title>
    <link>${escapeXml(SITE.url)}/</link>
    <description>${escapeXml(SITE.description)}</description>
    <language>${escapeXml(SITE.language)}</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(SITE.url)}/feed.xml" rel="self" type="application/rss+xml"/>
${allArticles.slice(0, 20).map((a) => `    <item>
      <title>${escapeXml(a.title)}</title>
      <link>${escapeXml(`${SITE.url}/articles/${a.slug}`)}</link>
      <guid isPermaLink="true">${escapeXml(`${SITE.url}/articles/${a.slug}`)}</guid>
      <pubDate>${new Date(a.publishedIso).toUTCString()}</pubDate>
      <category>${escapeXml(a.categoryName)}</category>
      <description>${escapeXml(a.description)}</description>
    </item>`).join('\n')}
  </channel>
</rss>
`;
  write('feed.xml', feed);
}

/* ---- 6g. 404, assets, admin ---- */
function buildMisc() {
  write('404.html', withLayout(pageMeta({
    title: `Page not found | ${SITE.siteName}`,
    description: 'That page does not exist on SignalNest.',
    canonical: `${SITE.url}/404`,
    robots: 'noindex, follow'
  }), render(templates['404'], { site: SITE_CTX }, partials)));
  stats.pages += 1;

  copyDir(path.join(ROOT, 'assets'), path.join(DIST, 'assets'));
  copyDir(path.join(ROOT, 'admin'), path.join(DIST, 'admin'));
}

/* ------------------------------------------------------------------ *
 * 7. Report
 * ------------------------------------------------------------------ */
function report() {
  const lines = [];
  lines.push('');
  lines.push('============================================================');
  lines.push(`  SignalNest build — ${new Date().toISOString()}`);
  lines.push('============================================================');
  lines.push(`  Published articles : ${stats.published}`);
  lines.push(`  Hidden (not approved/gated) : ${stats.hidden}`);
  lines.push(`  Pages generated    : ${stats.pages}`);
  lines.push(`  Files written      : ${stats.files}`);
  lines.push(`  Output directory   : ${path.relative(ROOT, DIST)}/`);
  if (stats.skipped.length) {
    lines.push('');
    lines.push('  Not published (missing gate criteria):');
    stats.skipped.forEach((s) => lines.push(`   - ${s.file}: ${s.reasons.join('; ')}`));
  }
  if (warnings.length) {
    lines.push('');
    lines.push('  Warnings:');
    warnings.forEach((w) => lines.push(`   ! ${w}`));
  }
  if (errors.length) {
    lines.push('');
    lines.push('  ERRORS:');
    errors.forEach((e) => lines.push(`   x ${e}`));
  }
  lines.push('============================================================');
  console.log(lines.join('\n'));
}

/* ------------------------------------------------------------------ *
 * main
 * ------------------------------------------------------------------ */
function main() {
  emptyDist();
  buildArticlePages();
  buildHome();
  buildCategoryPages();
  buildSearchPage();
  buildStaticPages();
  buildFeedsAndData();
  buildMisc();
  report();
  if (errors.length && STRICT) {
    console.error(`\nBuild failed in strict mode with ${errors.length} error(s).`);
    process.exit(1);
  }
}

main();
