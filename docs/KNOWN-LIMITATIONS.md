# Known limitations

Written to be read before you deploy, not after something breaks. Each item states the limitation, the consequence, and the way out.

---

## 1. No visual browser verification was performed

The site was verified structurally: valid HTML, 997 link and asset attributes with zero breaks, canonical and JSON-LD present, responsive breakpoints defined, every image carrying alt text. It was **not** rendered in a real browser during construction, because this environment has no headless browser and no public URL to test.

**Consequence:** a layout defect at an unverified breakpoint would not have been caught.
**Way out:** open the Vercel preview on a real phone before announcing the site. This is the first thing to check after deploy.

## 2. GitHub is the database, and it has no transactions

Two simultaneous writers can conflict. A `PUT` with a stale SHA returns 409.

**Consequence:** the workflow surfaces a 409 and asks you to retry rather than silently overwriting. A single editor is completely safe; two editors on the same article within seconds are not.
**Way out:** fine for one editor, which is the design intent. If you add a second reviewer, move drafts to Supabase (Postgres, free tier) and keep published articles in Git. The draft layer is the only one that needs concurrent writes.

## 3. No in-workflow rate limiting

Explained fully in [SECURITY.md](SECURITY.md#4-known-gap-no-in-workflow-rate-limiting). n8n Code nodes cannot share state between executions.

**Consequence:** the approval secret is the only barrier against repeated attempts.
**Way out:** apply a rate limit rule at Cloudflare in front of the n8n host. Five requests per minute per IP is sufficient.

## 4. The approval secret is shared, not per-user

There is one editorial token. There are no individual accounts, no roles, and no way to tell two editors apart.

**Consequence:** the audit trail shows who approved in the `approvedBy` field, but that field is typed by the reviewer, not proven by authentication.
**Way out:** acceptable for a single-operator publication. For a team, put the review page behind Vercel password protection or Cloudflare Access, and add per-user auth before granting access to anyone you would not give the GitHub token.

## 5. Search is client-side over a static index

`data/search-index.json` is loaded once and filtered in the browser.

**Consequence:** fast and free with no backend, but the whole index downloads, so it grows linearly with article count. Comfortable to roughly 1,500 to 2,000 articles; past that, initial load suffers.
**Way out:** at that scale, add Pagefind (static, free) or a hosted search service. The index format is a plain array, so swapping the consumer is contained.

## 6. A build step is required

Node 18+ runs `scripts/build.js` on Vercel. There are zero dependencies, so nothing is installed and nothing can drift, but it is still a build.

**Why it is necessary:** the alternative is having n8n write five files per publication (page, index, sitemap, category, feed). That multi-write pattern is exactly what produces orphaned articles, stale sitemaps and SHA conflicts, because a multi-file write can half-succeed. One write cannot.

**Way out if you must avoid a build:** set `outputDirectory` to `.` and commit `dist/` as the site root. You then lose automatic consistency and must accept the risk the build was built to remove.

## 7. Analytics requires Google Cloud setup

Workflow 04 needs the Analytics Data API and Search Console API enabled, an OAuth2 credential with the right scopes, a numeric GA4 property id, and a verified Search Console property. That is real setup work, not a key paste.

**Consequence:** until it is done, workflow 04 produces a report that says "unavailable". That is the intended, honest behaviour.
**Way out:** [ANALYTICS.md](ANALYTICS.md) lists every step.

## 8. Advertising is not approved and not enabled

No publisher ID exists, so no ad network has approved this site. `ads.txt` states that there are no authorised sellers, and ad slots are switched off.

**Consequence:** there is no revenue until you apply and are approved. Approval requires real traffic and original content; it cannot be shortcut.
**Way out:** [MONETISATION.md](MONETISATION.md). Do not set `ads.enabled` to `true` or paste an ID you do not own.

## 9. Newsletter capture is not connected

The form has no provider. With `NEWSLETTER_ENDPOINT` empty, it tells the reader it is not connected rather than faking success.

**Way out:** set the endpoint to your provider's form action. MailerLite, Buttondown and ConvertKit all accept a plain HTML form POST.

## 10. Images are generated, not sourced

Every article gets a deterministic on-brand SVG cover generated at build time. There is no photography, no image generation model and no stock library.

**Consequence:** covers are clean and consistent, but they are not editorial photography.
**Way out:** commit real images to `assets/images/articles/` and set `heroImage` in the article JSON. The template uses that path when present.

## 11. One language, English

No i18n layer, no `hreflang`, no translated routes. Adding them later means a locale segment in the routing and one extra field per article.

## 12. Editorial quality is a human responsibility

The workflow validates shape, length, category and source count. It cannot verify that a claim is true. A well-formed article with a wrong statistic passes every automated check.

**Consequence:** the human approval step is load-bearing, not ceremonial.
**Way out:** `verification` in each draft lists the specific claims that need checking, and the editorial policy page states the standard publicly. Read it before approving.

## 13. Not tested against live third-party APIs

Gemini, GitHub, Vercel and Google APIs were exercised against mocked responses. No live credential existed during construction.

**Consequence:** the first real call to each service is the first real call to each service. Request shape and error handling are tested; service-side quirks are not.
**Way out:** the workflow-by-workflow test order in [WORKFLOWS.md](WORKFLOWS.md#testing-a-workflow-without-credentials) shakes out each service one at a time, with the least destructive first.
