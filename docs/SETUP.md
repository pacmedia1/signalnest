# Setup

Two environments need configuration: **Vercel** (builds the site) and **n8n** (runs the automation). The review page in `admin/` needs one thing only: the n8n base URL and the approval secret, both entered by you at runtime.

Nothing here requires a paid plan. All steps use free tiers.

---

## 0. Before you start

Create these accounts if you do not have them:

| Service | Why | Free tier sufficient? |
| --- | --- | --- |
| GitHub | Repository and content storage | Yes |
| Vercel | Hosting and deploys | Yes |
| Google AI Studio | Gemini API key | Yes, with rate limits |
| n8n | Workflow runtime (self-hosted or cloud) | Self-hosted: yes. Cloud: trial then paid |
| Google Cloud | GA4 + Search Console API access | Yes |

---

## 1. Site variables (Vercel)

Only three matter at build time, and all are optional except `SITE_URL`.

| Variable | Required | Effect if empty |
| --- | --- | --- |
| `SITE_URL` | Yes | Canonicals and sitemap default to `https://signalnest.vercel.app` |
| `GA4_MEASUREMENT_ID` | No | No analytics tag is emitted at all |
| `ADSENSE_CLIENT` | No | `ads.txt` states no authorised sellers; ad slots stay off |
| `ADS_TXT_AUTH_DIRECT` | No | Standard Google `DIRECT` line is used |

`site.config.json` holds everything else: navigation, categories, pagination, ad slot layout, the Gemini model name, reading speed and minimum word count. Edit that file rather than scattering settings.

### Advertising is off by default

`site.config.json` ships with `"ads": { "enabled": false }`. With ads off, no ad container is rendered, so the site looks complete rather than broken. Once a network approves you, set `enabled: true`, add your slot IDs, and set `ADSENSE_CLIENT`.

---

## 2. n8n host variables

n8n Code and HTTP nodes read these as `$env.NAME`. Set them **on the n8n host**, not in the workflow JSON, so secrets never enter Git.

### Docker

```yaml
services:
  n8n:
    image: docker.n8n.io/n8nio/n8n
    ports: ["5678:5678"]
    environment:
      - N8N_HOST=n8n.example.com
      - WEBHOOK_URL=https://n8n.example.com/
      - GENERIC_TIMEZONE=Africa/Accra
      # --- SignalNest ---
      - SITE_URL=https://signalnest.vercel.app
      - ADMIN_ORIGIN=https://signalnest.vercel.app
      - GITHUB_TOKEN=github_pat_xxx
      - GITHUB_OWNER=your-username
      - GITHUB_REPO=signalnest
      - GITHUB_BRANCH=main
      - GEMINI_API_KEY=AIza_xxx
      - GEMINI_MODEL=gemini-2.5-flash
      - GEMINI_ENDPOINT=https://generativelanguage.googleapis.com/v1beta
      - APPROVAL_SHARED_SECRET=<64 hex chars>
      - REVIEWER_NAME=Your Name
      - MIN_ARTICLE_WORDS=700
      - MIN_TOPIC_SCORE=6
      - DRAFTS_PER_RUN=1
      - AUTO_DRAFT_TOPICS=false
      - TELEGRAM_CHAT_ID=
    volumes:
      - n8n_data:/home/node/.n8n
volumes:
  n8n_data:
```

**Important:** if you set `N8N_BLOCK_ENV_ACCESS_IN_NODE=true`, every `$env.*` expression fails. Leave it `false`, or convert the HTTP nodes to Header Auth credentials (see [SECURITY.md](SECURITY.md#hardening-swap-env-vars-for-credentials)).

### Verify env access

Open any workflow, add a temporary Code node, run `return [{ json: { ok: !!$env.GITHUB_TOKEN } }];`. Delete it afterwards. If it throws, env access is blocked on your instance and you must use credentials instead.

---

## 3. Generate the approval secret

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Put the same value in `APPROVAL_SHARED_SECRET` on n8n and paste it into the review page once. It is stored in that browser tab's `sessionStorage` only, never in a file, never in the repo.

This secret authorises editorial decisions. It is **not** the GitHub token, and the review page never receives the GitHub token.

---

## 4. GitHub token

Create a **fine-grained** personal access token scoped to one repository:

1. GitHub, Settings, Developer settings, Fine-grained tokens, Generate new token.
2. Repository access: only the SignalNest repo.
3. Permissions: **Contents: Read and write**. Nothing else. No workflows, no admin, no secrets.
4. Expiry: 90 days is a reasonable start.

The workflows need exactly four operations: read a file, write a file, list a directory, read a commit. Contents read and write covers all four.

---

## 5. Gemini

1. Get an API key from Google AI Studio.
2. Set `GEMINI_API_KEY` and keep `GEMINI_MODEL` identical to `site.config.json` → `gemini.model`.
3. `scripts/validate-content.js` warns if those two values differ.

Model names change. That is why the model is a variable in exactly one place per environment instead of being hardcoded in prompts.

---

## 6. Google Analytics and Search Console

See [ANALYTICS.md](ANALYTICS.md). Workflow 04 needs `GA4_PROPERTY_ID`, `GSC_SITE_URL`, and a Google OAuth2 credential attached to two nodes. Until then it produces a report that says "unavailable" rather than inventing numbers.

---

## 7. Review page setup

1. Open `https://<your-site>/admin/`.
2. Enter the n8n base URL, for example `https://n8n.example.com`.
3. Enter the approval secret.
4. Click Connect.

In n8n, open the webhook nodes in workflow 03 and set **Allowed Origins (CORS)** to your site origin. Without that, the browser blocks the requests.

The page is `noindex`, blocked in `robots.txt`, and excluded from the sitemap.

---

## 8. Publish the first article by hand

Before trusting the automation, prove the pipeline once manually:

1. Copy `content/drafts/retrieval-augmented-generation-explained.json` to `content/articles/`.
2. Set `status` to `"published"`, `approved` to `true`, `approvedAt` to now, `publishedAt` to now, and add your name to `approvedBy` and `reviewer`.
3. Run `node scripts/validate-content.js && node scripts/build.js && node scripts/check-links.js`.
4. Commit and push.

Vercel rebuilds, and the article appears on the homepage, its category page, search, the sitemap and the feed simultaneously. If it does not, the build log tells you exactly which field failed, and the approval gate is working.

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `$env is not defined` in a Code node | `N8N_BLOCK_ENV_ACCESS_IN_NODE=true` | Set it false, or use Header Auth credentials |
| Review page shows a CORS error | Origin not allowed on the webhook | Set Allowed Origins on webhook nodes in workflow 03 |
| Review page returns 401 | Secret mismatch | Re-paste `APPROVAL_SHARED_SECRET` |
| GitHub write returns 409 | File changed between read and write | Re-run; the workflow re-reads the SHA |
| GitHub write returns 404 | Wrong owner/repo/branch, or token lacks Contents write | Check `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH` |
| Build fails on an article | Missing required field | The error names the file and the field |
| Article page missing after publish | Build failed, or Vercel deploy failed | Check the Vercel build log |
