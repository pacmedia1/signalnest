# Analytics and Search Console

Two different things, often confused: **GA4** measures what happens on your site; **Search Console** measures how Google sees it. Workflow 04 uses both, and reports honestly when either is missing.

---

## 1. GA4 measurement (reader behaviour)

1. Create a GA4 property, then a Web data stream for your domain.
2. Copy the **`G-` measurement ID**.
3. Set `GA4_MEASUREMENT_ID` in Vercel.
4. Redeploy.

With the variable empty, no tag is emitted at all, so the site ships clean until you decide otherwise.

The tag is loaded `async` and the `gtag` bootstrap is a single inline block, so it does not block rendering. Nothing else on the page waits for it.

## 2. GA4 reporting (workflow 04)

The report needs the **numeric property ID** (for example `123456789`), not the `G-` ID.

1. Google Cloud Console, create or select a project.
2. Enable **Google Analytics Data API** and **Google Search Console API**.
3. Configure the OAuth consent screen as External, add yourself as a test user while unverified.
4. Create OAuth client credentials, type Web application.
5. In n8n, Credentials, New, **Google OAuth2 API**, add the client id and secret, and complete the consent flow.
6. Scopes: `https://www.googleapis.com/auth/analytics.readonly` and `https://www.googleapis.com/auth/webmasters.readonly`.
7. Attach that credential to **`GA4 Run Report`** and **`GSC Search Analytics`** in workflow 04.
8. Set `GA4_PROPERTY_ID`, `GSC_SITE_URL`, and `GOOGLE_OAUTH_CONFIGURED=true` on the n8n host.

`GSC_SITE_URL` must match the property exactly as it appears in Search Console: either `https://signalnest.vercel.app/` (with trailing slash) or `sc-domain:signalnest.vercel.app`.

## 3. What the weekly report contains

Traffic: sessions, total users, pageviews and trend where available. Search: clicks, impressions, average position and CTR. Content: top pages and top categories, ranked from real rows. Opportunities and recommended actions, derived from the numbers that actually returned.

## 4. Unavailable is not zero

Every metric carries an availability flag. A failed API call, a missing property, or a metric Google did not return becomes **unavailable with a reason**, never `0`. A zero and an unavailable metric look identical in a chart and lead to opposite decisions; conflating them is how people conclude their traffic collapsed when in fact the query failed.

The report also states plainly what it could not read, so you never mistake a partial report for a complete one.

**Nothing in workflow 04 is estimated, extrapolated or generated.** If the data is not there, it says so.

## 5. Indexing

1. Verify the property in Search Console.
2. Submit `https://<your-site>/sitemap.xml`.
3. Use URL Inspection on the homepage and your best article; request indexing for those only.
4. Watch **Pages** for exclusions. A `noindex` on `/admin`, `/data/` and paginated categories is intentional.

Do not resubmit constantly, do not buy indexing services, and expect days to weeks. Indexing is not a lever you can pull harder by repeating the request.

## 6. What to actually watch

| Metric | Where | Why it matters |
| --- | --- | --- |
| Articles indexed vs published | Search Console, Pages | A gap means a technical or quality problem |
| Impressions trend | Search Console, Performance | The leading indicator; clicks follow |
| CTR by position band | Performance, filtered | Low CTR at good position means weak titles |
| Entrances per article | GA4, Landing page | Tells you which articles earn their place |
| Referrals | GA4, Acquisition | Social and community traffic quality |

Traffic from a single article rarely survives a Google update. A spread of articles answering related questions is what holds.
