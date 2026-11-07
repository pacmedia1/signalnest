# SignalNest

An AI-assisted publishing platform where **no article is published without a human approval that is verified on the server**.

Static output, zero runtime dependencies, free-tier hosting, and four n8n workflows that discover topics, draft articles with Google Gemini, publish approved articles to GitHub (which deploys to Vercel), and report weekly analytics.

---

## Status at a glance

| Layer | Implementation | Status |
| --- | --- | --- |
| Website | Static HTML/CSS/JS generated from JSON content by a zero-dependency Node builder | Working, tested |
| Content model | One JSON file per article, versioned in Git | Working |
| Search | Client-side over a pre-built static index | Working, tested |
| Editorial review | `admin/` page, token-authenticated, approval verified inside the workflow | Working, tested |
| Approval gate | `approved === true` is set server-side; the build refuses anything else | Working, tested |
| Gemini drafting | Workflow 02, structured JSON output, validated before use | Working, tested with mocked responses |
| GitHub publishing | Workflow 03, single-file commit, SHA reuse, conflict reported | Working, tested with mocked responses |
| sitemap / index / categories / feed | Regenerated on every build, so a published article appears everywhere at once | Working, tested |
| Analytics | Workflow 04, GA4 + Search Console, "unavailable" never reported as zero | Code complete, **needs your Google credentials** |
| Advertising | Labelled responsive slots, generated `ads.txt`, policy enforced | Code complete, **disabled until a real publisher ID exists** |
| Email capture | Form posts only to a configured endpoint | **Needs your provider endpoint** |

Anything marked "needs your credentials" is documented rather than silently stubbed. See [Known limitations](docs/KNOWN-LIMITATIONS.md).

---

## Quick start

Node 18 or newer. There is nothing to install: no `npm install`, no build toolchain, no framework.

```bash
node scripts/build.js        # generate dist/
node scripts/dev-server.js   # preview at http://localhost:4173

node scripts/validate-content.js   # content QA gate
node scripts/build-workflows.js    # regenerate the four n8n JSON files
node scripts/test-suite.js         # 44 tests, executes the real workflow JS
node scripts/check-links.js        # crawls dist/ for broken links

npm test                           # all of the above in order
```

---

## Architecture

```
TOPIC DISCOVERY  ->  AI DRAFT  ->  VALIDATION  ->  HUMAN REVIEW  ->  APPROVAL
    (wf 01)          (wf 02)       (wf 02)         (admin/)         (wf 03)
                                                                       |
                                              GITHUB COMMIT <----------+
                                                    |
                                              VERCEL BUILD
                                                    |
                                      +-------------+-------------+
                                article page              homepage, category,
                                sitemap.xml               search index, feed
                                                    |
                                              ANALYTICS (wf 04)
```

**Why a build step exists.** Workflow 03 writes exactly one file, `content/articles/<slug>.json`. The build then derives the article page, the homepage entry, the category listing, the search index, `sitemap.xml`, `feed.xml` and `data/articles.json` from that single source. Having n8n write five files per publish is exactly the pattern that produces orphaned pages, stale sitemaps and SHA conflicts: a multi-file write can half-succeed. A single write cannot.

**Storage.** GitHub is the database: JSON files, full version history, free, already the deploy source. The honest constraints of that choice are in [docs/KNOWN-LIMITATIONS.md](docs/KNOWN-LIMITATIONS.md).

---

## Repository layout

```
signalnest/
├── content/                    the database
│   ├── articles/               one file per article; "_" prefixed files are gated fixtures
│   ├── drafts/                 drafts awaiting human review
│   ├── queue/topics.json       persistent discovery queue
│   ├── pages/                  about, contact, legal pages
│   ├── categories.json         the seven categories
│   └── analytics/              weekly reports written by workflow 04
├── templates/                  layout, home, article, category, search, page, 404, partials
├── assets/css,js,images/       design system, app JS, search JS, logos
├── admin/                      editorial review interface (noindex)
├── scripts/
│   ├── build.js                static generator
│   ├── build-workflows.js      generates the four n8n JSON files
│   ├── validate-content.js     content QA gate
│   ├── test-suite.js           44 tests incl. sandboxed workflow JS
│   ├── check-links.js          crawl for broken links, assets, anchors, alt text
│   ├── dev-server.js           local preview with cleanUrls emulation
│   └── lib/                    util, render, site helpers, workflow kit
├── n8n-workflows/              the four importable workflow files
├── static/                     files copied verbatim
├── dist/                       build output (gitignored; Vercel serves this)
├── site.config.json            site, ads, analytics and Gemini model settings
├── vercel.json                 build command, output dir, security headers
├── .env.example                every variable, no real values
└── docs/                       setup, deployment, workflows, security, testing, limitations
```

---

## Configuration

Site-level settings live in **`site.config.json`**: navigation, categories, pagination, ad slots, analytics ID, Gemini model, reading speed, minimum word count.

Secrets live in **environment variables**, never in the repo and never in browser JavaScript. Copy `.env.example`, then follow [docs/SETUP.md](docs/SETUP.md).

The Gemini model is defined once and referenced everywhere:

```json
// site.config.json
"gemini": { "model": "gemini-2.5-flash" }
```
```bash
# .env
GEMINI_MODEL=gemini-2.5-flash
```

`scripts/validate-content.js` warns if those two drift apart.

---

## Publishing rules enforced in code

1. A file in `content/articles/` is published only when `status === "published"` **and** `approved === true` **and** `approvedAt` is set.
2. Workflow 03 writes those fields itself from a verified request. A client that posts `approved: true` in the request body cannot publish anything; the value is overwritten server-side.
3. Every published article needs a title, a 40 to 320 character description, a known category, a valid slug and at least the minimum word count.
4. At least one absolute `http(s)` source URL is required.
5. All article HTML is sanitised against a whitelist: no scripts, iframes, inline event handlers or `javascript:` URLs survive.

`content/articles/_fixture-unapproved-draft.json` exists to prove rule 1. It is deliberately unapproved and excluded from every public output; the test suite asserts it never reaches a page, the sitemap or the search index.

---

## SEO implemented

Per article: unique title, meta description, canonical URL, Open Graph and Twitter metadata, `BlogPosting` JSON-LD, `BreadcrumbList` JSON-LD, visible breadcrumbs, a table of contents generated from real `h2`/`h3` headings, related-article internal links, descriptive alt text on every image, and a reading time.

Site-wide: `sitemap.xml` with real `lastmod` values, `robots.txt` blocking `/admin` and `/data/`, an RSS feed, clean URLs, and `noindex` on admin, paginated category pages after page one, and the 404 page.

No first-page ranking is promised anywhere. Rankings depend on content and competition, not markup.

---

## Documentation

- [docs/SETUP.md](docs/SETUP.md): environment variables, n8n host setup, credentials
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): GitHub, Vercel, rollback, custom domain, sitemap submission
- [docs/WORKFLOWS.md](docs/WORKFLOWS.md): exact import and activation steps for all four workflows
- [docs/SECURITY.md](docs/SECURITY.md): threat model, secrets handling, approval auth, recovery
- [docs/TESTING.md](docs/TESTING.md): what was tested, how, and what is mock-tested
- [docs/KNOWN-LIMITATIONS.md](docs/KNOWN-LIMITATIONS.md): what is not done and why
- [docs/ANALYTICS.md](docs/ANALYTICS.md): GA4 and Search Console connection
- [docs/MONETISATION.md](docs/MONETISATION.md): ad networks, `ads.txt`, policy constraints

---

## Licence

Application code is yours to use. The seed articles in `content/articles/` are original sample content written for this project and may be replaced or deleted.
