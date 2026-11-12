# SignalNest — International Search Engine & Analytics Setup Guide

> **Site URL**: https://signalnestnews.vercel.app  
> **Platform**: Vercel (Edge Network) + Node.js Static Generator  
> **Target Markets**: Ghana, United States, United Kingdom, Canada, Australia, India  
> **Primary Language**: English (`en-US`, `lang="en"`, `og:locale en_US`)

---

## 1. Google Search Console (GSC)

### Step 1: Add Property & Verify Ownership
1. Open [Google Search Console](https://search.google.com/search-console).
2. Click **Add property** in the top-left dropdown.
3. Select **URL prefix** and enter:
   ```text
   https://signalnestnews.vercel.app
   ```
4. Choose the **HTML tag** verification method.
5. Google will provide a meta tag:
   ```html
   <meta name="google-site-verification" content="YOUR_VERIFICATION_TOKEN_HERE">
   ```
6. Copy only the `content` attribute value (`YOUR_VERIFICATION_TOKEN_HERE`).
7. **Configure in Vercel**:
   - Go to [Vercel Dashboard](https://vercel.com) → Your SignalNest Project → **Settings** → **Environment Variables**.
   - Add new variable:
     - **Key**: `GOOGLE_SITE_VERIFICATION`
     - **Value**: `YOUR_VERIFICATION_TOKEN_HERE`
     - **Environments**: Production, Preview, Development
   - Redeploy the latest commit in Vercel (or push a commit to trigger a build).
   - Alternatively, you can edit `site.config.json` directly:
     ```json
     "googleSiteVerification": "YOUR_VERIFICATION_TOKEN_HERE"
     ```
8. In Search Console, click **Verify**. You should see "Ownership verified".

### Step 2: Submit XML Sitemap
1. In Search Console navigation, click **Sitemaps** (under Indexing).
2. In the "Add a new sitemap" input, enter:
   ```text
   sitemap.xml
   ```
3. Click **Submit**.
4. Confirm the status changes to **Success** (with type "Sitemap" and all URLs discovered).
5. The sitemap is automatically generated at build time at:
   `https://signalnestnews.vercel.app/sitemap.xml`

### Step 3: URL Inspection & Indexing Request
1. Enter your homepage URL `https://signalnestnews.vercel.app` into the top search bar (**URL Inspection**).
2. Click **Test Live URL** to confirm Googlebot can fetch and render without errors.
3. Click **Request Indexing**.
4. Repeat for high-priority cornerstone articles:
   - `https://signalnestnews.vercel.app/articles/ai-books-scandal-tamil-nadu-library-audit-explained`
   - `https://signalnestnews.vercel.app/articles/cybertruck-production-ends-tesla-s-pivot-to-cybercabs`
   - `https://signalnestnews.vercel.app/about`

### Step 4: Monitor International Performance
1. Under **Performance** → **Search results**:
   - Track **Total clicks**, **Total impressions**, **Average CTR**, and **Average position**.
2. Click the **Countries** tab to monitor ranking and visibility across your target geographic markets:
   - 🇬🇭 **Ghana**
   - 🇺🇸 **United States**
   - 🇬🇧 **United Kingdom**
   - 🇨🇦 **Canada**
   - 🇦🇺 **Australia**
   - 🇮🇳 **India**
3. Review **Queries** to discover high-intent keywords sending impressions.

---

## 2. Bing Webmaster Tools

### Step 1: Add Site & Verify
1. Open [Bing Webmaster Tools](https://www.bing.com/webmasters).
2. Sign in with your Microsoft account (or import directly from Google Search Console with one click).
3. If adding manually, enter `https://signalnestnews.vercel.app`.
4. Choose **HTML Meta Tag** verification.
5. Copy the code from the meta tag:
   ```html
   <meta name="msvalidate.01" content="YOUR_BING_CODE_HERE">
   ```
6. Add to Vercel Environment Variables:
   - **Key**: `BING_SITE_VERIFICATION` (or `MSVALIDATE`)
   - **Value**: `YOUR_BING_CODE_HERE`
   - Alternatively, update `site.config.json` → `"msvalidate": "YOUR_BING_CODE_HERE"`.
7. Click **Verify** in Bing Webmaster Tools.

### Step 2: Submit Sitemap
1. Navigate to **Sitemaps** in the left menu.
2. Click **Submit sitemap**.
3. Enter:
   ```text
   https://signalnestnews.vercel.app/sitemap.xml
   ```
4. Click **Submit**.

---

## 3. Google Analytics 4 (GA4)

### Step 1: Create GA4 Property
1. Go to [Google Analytics](https://analytics.google.com).
2. Admin → **Create Property** → Name: `SignalNest`.
3. Set reporting time zone and currency.
4. Set up a **Web** stream:
   - **Website URL**: `https://signalnestnews.vercel.app`
   - **Stream name**: `SignalNest Production`
5. Note your **Measurement ID** (format: `G-XXXXXXXXXX`).

### Step 2: Configure in Vercel
1. In Vercel Project Settings → **Environment Variables**, add:
   - **Key**: `GA4_MEASUREMENT_ID`
   - **Value**: `G-XXXXXXXXXX`
2. Or set directly in `site.config.json`:
   ```json
   "analytics": {
     "ga4MeasurementId": "G-XXXXXXXXXX"
   }
   ```

### Step 3: Privacy & Cookie Consent Compliance
- GA4 script is integrated into `templates/layout.html` with:
  - `anonymize_ip: true`
  - Deferred loading
  - Conditional firing gated by user cookie consent
- If the visitor clicks "Essential Only" on the cookie banner, analytics cookies are withheld in compliance with GDPR, PECR, and California privacy standards.

---

## 4. Environment Variables Reference

All credentials and verification codes are handled via environment variables with zero hardcoding:

| Variable Name | Purpose | Where to Set |
|---|---|---|
| `GOOGLE_SITE_VERIFICATION` | Google Search Console HTML verification | Vercel Environment Variables |
| `BING_SITE_VERIFICATION` | Bing Webmaster Tools meta tag verification | Vercel Environment Variables |
| `GA4_MEASUREMENT_ID` | Google Analytics 4 tracking ID (`G-XXXXXXXXXX`) | Vercel Environment Variables |
| `GEMINI_API_KEY` | Google Gemini API for AI drafts in n8n | n8n / Vercel Environment Variables |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token for review notifications | n8n Environment Variables |
| `TELEGRAM_CHAT_ID` | Telegram chat ID for Christian Agbodzi | n8n Environment Variables |
| `WEBHOOK_SECRET` | Publishing approval webhook signature verification | n8n / Vercel Environment Variables |
| `GITHUB_TOKEN` | GitHub PAT for writing published JSON files | n8n Credentials |

---

## 5. Rich Results & Schema Validation Checklist

Verify structured data on production URLs using Google's official testing tools:

1. **Rich Results Test**:
   - URL: https://search.google.com/test/rich-results
   - Test an article URL: `https://signalnestnews.vercel.app/articles/ai-books-scandal-tamil-nadu-library-audit-explained`
   - **Expected schema**:
     - `NewsArticle` (valid headline, image, datePublished, author Person, publisher Organization)
     - `BreadcrumbList` (Home > Category > Article)

2. **Schema Markup Validator**:
   - URL: https://validator.schema.org
   - Test homepage: should contain `WebSite` with `SearchAction` + `Organization` with Christian Agbodzi founder profile.

3. **PageSpeed Insights**:
   - URL: https://pagespeed.web.dev/analysis?url=https%3A%2F%2Fsignalnestnews.vercel.app
   - Expected Core Web Vitals:
     - **LCP**: < 2.5s (high-priority hero image with preload)
     - **CLS**: < 0.1 (explicit width/height and layout containment)
     - **INP**: < 200ms (zero-dependency static JS, deferred search)
