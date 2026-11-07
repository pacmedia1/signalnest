# Testing report

Run everything with `npm test`. Last full run: **44 passed, 0 failed**, plus a link crawl of 997 attributes with 0 problems.

The suite is not a smoke test. It extracts the JavaScript out of the generated n8n Code nodes and executes it in a sandbox with mocked `$input`, `$()` and `$env`, and with `Buffer` deliberately **absent**, which proves the workflow code has no hidden Node dependency that would break in the n8n sandbox.

---

## How to reproduce

```bash
node scripts/build.js            # generate dist/
node scripts/validate-content.js # content QA
node scripts/build-workflows.js  # regenerate + validate workflow graphs
node scripts/test-suite.js       # 44 tests
node scripts/check-links.js      # crawl dist/
```

`npm test` chains all five.

---

## 1. Library units

| Test | What it proves |
| --- | --- |
| Sanitizer strips scripts, handlers, `javascript:` URLs | Article HTML from a model cannot execute in a reader's browser |
| Sanitizer keeps safe markup, forces link `rel` | Sanitising does not destroy legitimate formatting; external links cannot pass referrer or `window.opener` |
| Slugify produces clean unique slugs | URLs stay ASCII, lowercase and bounded |
| Pure-JS base64 matches Node Buffer | The workflow's encoder is byte-identical for multi-byte text |
| Template engine escapes and handles blocks | No unescaped interpolation, no leaked template syntax |

## 2. Workflow 01, discovery

| Test | What it proves |
| --- | --- |
| Normalises, scores and filters feed items | Real RSS shapes are handled, low-value items dropped, categories assigned |
| Drops items with non-`http` links | A feed cannot inject a `javascript:` or relative link into the queue |
| De-duplicates against the persistent file | De-dupe survives a restart because it reads the committed queue, not memory |
| Creates the file when it does not exist | First run on an empty repo is not a failure |

## 3. Workflow 02, generation

| Test | What it proves |
| --- | --- |
| Valid Gemini JSON is accepted and slugged | The happy path works end to end |
| Malformed model output is rejected | Prose instead of JSON is stopped at validation, not passed downstream |
| Missing sources or short body block the draft | Quality floor is enforced before anything reaches a human |
| 429 and 5xx flagged retryable | Transient failures are distinguishable from permanent ones |
| Safety-blocked empty response rejected | A censored or truncated response is not treated as success |
| Duplicate slug renamed, not overwritten | A slug collision cannot destroy an existing article |

## 4. Workflow 03, approval and publishing

The security-critical section.

| Test | What it proves |
| --- | --- |
| No token, wrong token rejected | The webhook is not open |
| Refuses everything when the secret is unset | Fails closed on misconfiguration, never open |
| Correct token accepted, body parsed | The normal path works |
| Oversized payload rejected | 256 KB cap stops a memory-abuse payload |
| Invalid decision verb rejected | Only approve, save, revise and reject exist |
| Gate returns 404 for a missing draft | A forged slug cannot create an article |
| **Refuses approval when the client sets `approved` itself** | The core guarantee: a browser cannot self-approve |
| Refuses a draft with no sources | No unsourced article publishes |
| Refuses a body below the word minimum | Thin content is blocked |
| Refuses an unknown category | No orphaned or invisible articles |
| Approves a valid draft, stamps approval server-side | The legitimate path works |
| `save` never publishes | Editing is not publishing |
| `reject` records without publishing | The editorial record survives |
| Publish reuses existing SHA and original date | Republishing does not conflict or reset the publication date |
| 409 conflict reported clearly | Failure is surfaced, not silently retried into a duplicate or a lost edit |
| Draft list assembled from base64 contents | The review page receives real drafts |

## 5. Workflow 04, analytics

| Test | What it proves |
| --- | --- |
| Unavailable reported as unavailable, never zero | No fabricated data reaches the report |
| Real GA4 rows summed and ranked | The happy path aggregates correctly |
| Report labels unavailable sections explicitly | A reader cannot mistake a gap for a zero |

## 6. Built site output

| Test | What it proves |
| --- | --- |
| Expected pages exist | Build is not silently partial |
| Every published article has a page, sitemap entry and index entry | The "orphaned article" bug cannot recur |
| Homepage and category pages link to published articles | Internal discoverability is real |
| Unapproved drafts absent from every output | The gate holds at the build layer too, not only in the workflow |
| Canonical, OG, JSON-LD, breadcrumbs present | SEO metadata is emitted, not merely intended |
| `robots.txt` blocks admin and data, points at sitemap | Admin is not indexable |
| `ads.txt` contains no fabricated publisher id | No invented monetisation identity |
| Sitemap is well-formed XML | It parses |
| Admin page is noindex and free of secrets | No credential in client-side code |

## Link crawl

`scripts/check-links.js` parses every generated HTML file, resolving hrefs and srcs against the real routing rules, then reports broken internal links, missing assets, broken in-page anchors and images without alt text. Last run: **21 HTML files, 997 attributes, 0 broken, 0 missing, 0 broken anchors, 0 missing alt**.

## Content QA

`scripts/validate-content.js` enforces schema, slug-to-filename match, gate consistency, source URL validity, metadata lengths and category membership. It fails the run on blocking errors and warns on advisory issues such as a title that will truncate in search results.

---

## What is mock-tested rather than live-tested

Be precise about this. No live credential was available, so these paths were verified against mocked HTTP responses and real sandboxed execution, not against the real services:

- **Gemini generation.** Request shape, JSON parsing, schema validation and failure handling are all executed. An actual generation call has not been made.
- **GitHub writes.** Payload construction, base64 encoding, SHA reuse and 409 handling are executed. No real commit has been made by the workflow.
- **Vercel deployment check.** The verification logic runs against mocked responses. No real deploy was polled.
- **GA4 and Search Console.** Normalisation, aggregation and the unavailable path are executed. No real Google API call has been made.
- **Telegram messages.** Not sent.

Every one of these requires only credentials, not code changes, to become live. [What was tested](TESTING.md#what-is-mock-tested-rather-than-live-tested) is the honest boundary.
