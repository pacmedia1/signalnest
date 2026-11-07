# Deployment

Target: GitHub for source and content, Vercel for hosting. Both free tiers are enough for a new publication.

---

## 1. Create the repository

```bash
cd signalnest
git init
git add .
git commit -m "SignalNest: initial platform"
git branch -M main
git remote add origin https://github.com/<owner>/signalnest.git
git push -u origin main
```

`.gitignore` already excludes `dist/`, `.env`, and `node_modules/`. Check `git status` before your first push: you should see no `dist/`, no `.env`, and no `node_modules/`.

`content/` **is** committed. It is the database and its history is the audit trail.

---

## 2. Import into Vercel

1. vercel.com, Add New, Project, import the repository.
2. Framework preset: **Other**. `vercel.json` overrides the important parts anyway.
3. Root directory: the repository root if `signalnest/` is the repo root; otherwise set it to `signalnest`.
4. Add environment variables from [SETUP.md](SETUP.md#1-site-variables-vercel): `SITE_URL`, optionally `GA4_MEASUREMENT_ID`, optionally `ADSENSE_CLIENT`.
5. Deploy.

`vercel.json` pins the things that would otherwise vary by preset:

```json
{
  "framework": null,
  "buildCommand": "node scripts/build.js",
  "outputDirectory": "dist",
  "cleanUrls": true,
  "trailingSlash": false
}
```

Because `buildCommand` is explicit, the preset choice cannot break the deploy, and because there are no dependencies, `npm install` is a no-op. First builds typically finish in a few seconds.

### Verify the deploy

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://your-app.vercel.app/
curl -s -o /dev/null -w "%{http_code}\n" https://your-app.vercel.app/sitemap.xml
curl -s https://your-app.vercel.app/robots.txt
```

All three should return `200` and the sitemap should list your published articles.

---

## 3. Automatic deploys

Every push to `main` triggers a build. Workflow 03 commits to `main` through the GitHub API, which therefore triggers a deploy with no extra wiring.

Each published article appears in the article page, homepage, category page, search index, sitemap and feed in the same build, because they are all derived from one file.

### Confirming a deploy

Workflow 03 waits about 75 seconds after committing, then requests the new article URL and reports whether it returned 200. If your build is unusually slow, that check reports a warning while the article still goes live. The authoritative source is the Vercel deployments list.

---

## 4. Custom domain (later)

1. Vercel, Project, Settings, Domains, Add.
2. Add the DNS records Vercel shows you.
3. Update `SITE_URL` in Vercel **and** on the n8n host, then redeploy. Canonicals, the sitemap and `og:url` all derive from it.
4. In Search Console, add the new property and submit the new sitemap. Keep the old one until the redirect settles.

Do not buy a domain until the free subdomain site is live, indexed and producing traffic. Nothing in this project requires one.

---

## 5. Sitemap submission

1. Search Console, add your property, verify by DNS or by the HTML tag method.
2. Sitemaps, submit `https://<your-site>/sitemap.xml`.
3. Request indexing for the homepage and your two strongest articles only. Repeatedly requesting indexing for everything looks like manipulation.
4. Expect indexing to take days to weeks. There is no legitimate way to force it faster.

---

## 6. Rollback

Three options, in order of preference:

1. **Vercel instant rollback.** Deployments, pick the last good one, Promote. Immediate, no Git change.
2. **Revert the commit.** `git revert <sha>` on the content file and push. This reverts content and rebuilds cleanly.
3. **Revert a whole deploy.** Vercel keeps previous builds; you can promote any of them.

Content is plain JSON in Git, so recovering a single article is `git log -- content/articles/<slug>.json` followed by `git checkout <sha> -- <path>`.

---

## 7. Backup and recovery

- **Content:** GitHub is the backup. Clone the repo elsewhere; every change is a commit.
- **Secrets:** stored in Vercel and on the n8n host, not in Git. Keep one copy in a password manager. Losing `APPROVAL_SHARED_SECRET` means re-entering it in the review page; it does not lose data.
- **Drafts:** `content/drafts/` is committed, so rejected and pending drafts survive a lost n8n instance.
- **Analytics reports:** written to `content/analytics/`, so the weekly history is versioned too.

**Recovery drill.** Set your repo to private, delete the local `dist/`, and redeploy from scratch. If the site comes back identical, your recovery path works. Do this once, while it is still cheap to discover a problem.

---

## 8. Deployment checklist

- [ ] Repo pushed, no `.env` and no `dist/` in Git
- [ ] Vercel project connected, build uses `node scripts/build.js`, output `dist`
- [ ] `SITE_URL` set in Vercel
- [ ] Homepage, article, category, search, 404 all return 200
- [ ] `robots.txt` blocks `/admin` and `/data/`
- [ ] `sitemap.xml` lists published articles only
- [ ] `/admin/` returns 200 but carries `noindex` and is not in the sitemap
- [ ] An unapproved file in `content/articles/` does not appear on the site
- [ ] n8n env vars set, `$env` access verified
- [ ] Workflow 03 CORS origin set to the site origin
- [ ] One article published end-to-end through the review page
- [ ] Sitemap submitted to Search Console
