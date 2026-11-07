# Monetisation

Goal: revenue from legitimate advertising and affiliate arrangements, on a site whose content stays readable. Nothing here fabricates approval, traffic or clicks.

---

## 1. Current state

| Element | State |
| --- | --- |
| Ad slots in templates | Implemented, labelled, responsive, disabled |
| `ads.txt` | Generated. Currently states that no sellers are authorised |
| Privacy, cookie, terms, editorial policy, affiliate disclosure pages | Written and published |
| Ad network account | **None. Not applied, not approved** |
| Affiliate programme | **None connected** |

**No publisher ID is present anywhere in this repository.** The build refuses to emit one unless you supply `ADSENSE_CLIENT` yourself, and the test suite asserts `ads.txt` contains no invented publisher id.

## 2. Turning ads on

1. Get approved by a network. This requires real content and real traffic; there is no legitimate shortcut.
2. Put your slot IDs in `site.config.json` under `ads.slots`.
3. Set `ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX` in Vercel. Use your own ID.
4. Set `"enabled": true` in `site.config.json`.
5. Redeploy and confirm `ads.txt` now contains your `pub-` line.

Until every one of those is true, the site renders without ad containers, which is why it looks finished rather than broken.

## 3. Placement policy

Slots exist at four positions: below the article header, mid-article, sidebar, and above the footer.

Rules enforced in the templates:

- Every unit is inside a container labelled **Advertisement**.
- No unit sits above the article title or inside the first paragraph.
- Ads are visually separated from editorial content and never styled to resemble it.
- Sidebar ads collapse below the article on mobile rather than pushing content down.
- No interstitials, no pop-unders, no auto-playing video, no sticky overlay that obscures text.

These are not only policy requirements. Layouts that interrupt reading reduce return visits, which reduces the traffic the ads were meant to monetise.

## 4. Network notes

**Google AdSense.** The default. Requires original content, working navigation, and the legal pages you already have. Approval is not guaranteed and can be refused for thin or mass-produced content, which is exactly why this platform enforces a human editorial gate.

**Adsterra and similar networks.** Generally easier to join, lower rates, more aggressive ad formats. If you use one, choose formats that do not cover the text. A banner that hides the article costs more in lost readers than it earns.

**Google AdMob is not applicable.** AdMob serves mobile **applications**, not websites. Sites use AdSense or another web network, or a mediation layer. If any guide tells you to put AdMob on a website, it is wrong.

**Affiliate programmes.** Disclose them. The affiliate disclosure page is already published and linked in the footer. Add a disclosure line to any article containing affiliate links, and add `rel="sponsored"` to those links.

## 5. What not to do

- Do not click your own ads, or ask anyone to.
- Do not buy traffic, use bots, or join paid-to-click schemes. Invalid traffic gets accounts terminated with earnings withheld, and the appeal rarely succeeds.
- Do not place ads on pages with no content, or on the 404 page.
- Do not paste a publisher ID you do not own.
- Do not describe an account as approved until it is approved.
- Do not let an ad network's script load before the article text renders.

## 6. Realistic expectations

A new site with a dozen articles and no domain history earns close to nothing, whatever the network. Revenue follows indexed pages, which follows useful content and time. The honest sequence is: publish consistently, get indexed, learn what people search for, write more of that, and only then optimise ad placement.

Any projection that promises a specific monthly figure before the site has traffic is a guess dressed as a forecast. This document does not make one.

## 7. Measurement

Once GA4 is connected, judge monetisation by **revenue per thousand sessions** and **return visitor rate**, not by raw impressions. A layout that lifts impressions while lowering return visits is a net loss, and it takes months to show up, which is why the placement rules above are conservative by default.
