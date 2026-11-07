# Security

The threat that matters here is **unauthorised publication**. Everything else is secondary, but credentials and reader-facing injection are handled too.

---

## 1. The approval guarantee

Publication requires `status: "published"` **and** `approved: true` **and** an `approvedAt` timestamp, in a file inside `content/articles/`.

Three layers, so no single mistake publishes an article:

1. **Workflow layer.** `Merge Edits And Gate` reads the draft from GitHub and derives approval fields itself. Any `approved`, `status`, `approvedAt` or `publishedAt` value in the HTTP request is discarded. A browser that posts `{"decision":"approve","approved":true}` gains nothing.
2. **Build layer.** `scripts/build.js` independently re-checks the gate on every build. A hand-edited file missing `approvedAt` is excluded and reported by filename in the build log.
3. **Validation layer.** `scripts/validate-content.js` fails the run when an article in `content/articles/` is not publishable, so an unapproved file cannot sit there unnoticed.

Files prefixed with `_` are treated as fixtures and are never publishable; the test suite asserts the current fixture never appears in any output.

## 2. Credentials

| Secret | Stored where | Reaches the browser? |
| --- | --- | --- |
| `GITHUB_TOKEN` | n8n host env | **Never** |
| `GEMINI_API_KEY` | n8n host env | Never |
| `APPROVAL_SHARED_SECRET` | n8n host env, pasted into the review page once | Yes, held in `sessionStorage` for that tab |
| Google OAuth2 | n8n credential store | Never |

The review page holds no repository credential and cannot write to GitHub directly. Its only power is to ask workflow 03 for a decision, which workflow 03 verifies and performs.

`APPROVAL_SHARED_SECRET` in `sessionStorage` is the deliberate minimum: it is not in a file, not in the repo, not in `localStorage`, and it dies with the tab. The trade-off is that anyone who learns it can approve articles, so treat it like a password, rotate it if a shared machine was used, and use a distinct value per environment.

## 3. Webhook authentication

- Constant-time comparison, so the check does not leak the secret one byte at a time through timing.
- **Fails closed.** If `APPROVAL_SHARED_SECRET` is unset, every request is refused. A misconfiguration cannot silently disable the gate.
- Request bodies over 256 KB are rejected before parsing.
- Unknown decision verbs are rejected.
- Slugs are validated against a pattern before being placed into a GitHub path, so `../` traversal is impossible.
- HTTPS is required. Never expose the n8n webhook over plain HTTP.

## 4. Known gap: no in-workflow rate limiting

n8n Code nodes cannot share state across executions, so a real fixed-window limiter would need external storage, and writing a counter file to Git on every request would spam the repo.

Rate limiting is therefore an **edge** responsibility. Apply one of these, in order of preference:

**Cloudflare (free tier) in front of the n8n host.** A rate limiting rule of `5 requests per 1 minute per IP` on `/webhook/signalnest-review/*` is enough. The webhook paths are already distinct, so the rule is easy to target.

**Cloudflare Worker, if you prefer explicit code:**

```js
export default {
  async fetch(request, env) {
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const key = 'rl:' + ip;
    const n = Number(await env.RL.get(key) || 0);
    if (n > 5) return new Response('Too many requests', { status: 429 });
    await env.RL.put(key, String(n + 1), { expirationTtl: 60 });
    return fetch(request);
  }
};
```

This is a real limitation, stated plainly rather than glossed over. Without it, the approval secret is the only barrier, which is a strong barrier but not a rate limit.

## 5. Hardening: swap env vars for credentials

`{{$env.*}}` is used so the workflow files import without credential mapping. For a hardened deployment, convert the GitHub HTTP nodes:

1. n8n, Credentials, New, **Header Auth**.
2. Name `Authorization`, value `Bearer github_pat_xxx`.
3. On each GitHub HTTP node: Authentication, Generic Credential Type, Header Auth, select the credential.
4. Remove `GITHUB_TOKEN` from the host environment.

Same pattern for Gemini using `x-goog-api-key`. This keeps the token inside n8n's encrypted credential store instead of the process environment.

## 6. Untrusted input

RSS titles, summaries and any fetched article text are **data, never instructions**. `Build Gemini Prompt` wraps all feed material in an explicit delimited block labelled as untrusted, and the system instruction states that instructions inside that block must be ignored.

Model output is also untrusted. It is validated for shape and content before it becomes a file, and every published word passes through the HTML sanitiser, which strips script tags, iframes, inline event handlers and `javascript:` URLs, and rewrites external links to `rel="nofollow noopener noreferrer"`.

The renderer escapes every interpolated value by default. Raw HTML insertion is a deliberate, marked choice available only to the article body, and that body is sanitised first.

## 7. Data protection

The site collects nothing by default. `GA4_MEASUREMENT_ID` is empty in the shipped config, so no analytics tag is emitted at all. When you enable analytics, the privacy and cookie pages already describe it, and you must handle consent for readers in jurisdictions that require it.

The newsletter form posts only to a `NEWSLETTER_ENDPOINT` you configure. Until you set one, the form tells the reader it is not connected instead of pretending to subscribe them.

## 8. Logging and audit

Every publication is an immutable Git commit with an author, a timestamp, `approvedBy`, `reviewer` and any editorial notes. `git log content/articles/` is the publication ledger, and it cannot be quietly rewritten without leaving a trace in the reflog on a shared remote.

Rejected and revised drafts are retained in `content/drafts/` with a status rather than deleted, so a decision can be reviewed after the fact.

## 9. Checklist before going live

- [ ] `APPROVAL_SHARED_SECRET` is 32+ random bytes, unique to this site
- [ ] `GITHUB_TOKEN` is fine-grained, one repo, Contents read and write only, with an expiry
- [ ] n8n is HTTPS and not publicly reachable without auth where avoidable
- [ ] Webhook CORS `Allowed Origins` is your site origin, not `*`
- [ ] Edge rate limiting applied to `/webhook/signalnest-review/*`
- [ ] Repo is private until you are ready for it to be public
- [ ] `git status` shows no `.env`, no `dist/`, no key material
- [ ] `/admin/` is `noindex` and blocked in `robots.txt`
- [ ] Unapproved fixture confirmed absent from the live site
