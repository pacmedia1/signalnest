'use strict';
const fs = require('fs');
const path = require('path');

const originalPath = 'C:/Users/TOSHIBA/.gemini/antigravity/brain/5be6915f-2722-4840-88f4-8f2c5870e581/.user_uploaded/media_1794292609397_e039185b.json';
const original = JSON.parse(fs.readFileSync(originalPath, 'utf8'));

// 1. Update Ask Which Categories
const askNode = original.nodes.find(n => n.name === 'Ask Which Categories');
if (askNode) {
  askNode.parameters.message = 'Hi! Which categories should I write articles for? Tap the button, then enter one or more of:\n• technology-ai\n• business\n• education\n• digital-skills\n• software-tutorials\n• lifestyle\n• internet-trends\n(or "all"). Any other text is used as a custom topic.';
}

// 2. Update Parse Command & Pick Category
const parseNode = original.nodes.find(n => n.name === 'Parse Command & Pick Category');
if (parseNode) {
  parseNode.parameters.jsCode = `var chatId = '7785938669';
var text = String(($input.first().json.data || {}).text || '').trim();

// Feeds mapped directly to SignalNest 7 official categories
var cats = {
  'technology-ai': 'https://feeds.bbci.co.uk/news/technology/rss.xml',
  'business': 'https://feeds.bbci.co.uk/news/business/rss.xml',
  'education': 'https://feeds.bbci.co.uk/news/education/rss.xml',
  'digital-skills': 'https://feeds.bbci.co.uk/news/technology/rss.xml',
  'software-tutorials': 'https://feeds.arstechnica.com/arstechnica/index',
  'lifestyle': 'https://feeds.bbci.co.uk/news/health/rss.xml',
  'internet-trends': 'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml'
};

var lower = text.toLowerCase();
var picked = [];

if (lower.indexOf('all') !== -1) {
  picked = Object.keys(cats);
} else {
  if (lower.indexOf('tech') !== -1 || lower.indexOf('ai') !== -1 || lower.indexOf('technology') !== -1) picked.push('technology-ai');
  if (lower.indexOf('business') !== -1 || lower.indexOf('finance') !== -1 || lower.indexOf('money') !== -1) picked.push('business');
  if (lower.indexOf('education') !== -1 || lower.indexOf('career') !== -1 || lower.indexOf('study') !== -1 || lower.indexOf('school') !== -1) picked.push('education');
  if (lower.indexOf('digital-skills') !== -1 || lower.indexOf('digital skills') !== -1 || lower.indexOf('skills') !== -1) picked.push('digital-skills');
  if (lower.indexOf('software') !== -1 || lower.indexOf('tutorial') !== -1 || lower.indexOf('code') !== -1 || lower.indexOf('dev') !== -1) picked.push('software-tutorials');
  if (lower.indexOf('lifestyle') !== -1 || lower.indexOf('health') !== -1 || lower.indexOf('wellness') !== -1 || lower.indexOf('sleep') !== -1) picked.push('lifestyle');
  if (lower.indexOf('internet') !== -1 || lower.indexOf('trend') !== -1 || lower.indexOf('social') !== -1 || lower.indexOf('game') !== -1 || lower.indexOf('gaming') !== -1) picked.push('internet-trends');
}

picked = picked.filter(function(v, i, a) { return a.indexOf(v) === i; });

if (picked.length === 0) {
  // Custom topic entered or empty: allow Gemini dynamic category classification
  return [{ json: { chatId: chatId, targetCategory: 'auto', feedUrl: cats['technology-ai'], customTopic: text } }];
}

return picked.map(function (c) {
  return { json: { chatId: chatId, targetCategory: c, feedUrl: cats[c], customTopic: '' } };
});`;
}

// 3. Update Prepare Article Prompt
const promptNode = original.nodes.find(n => n.name === 'Prepare Article Prompt');
if (promptNode) {
  promptNode.parameters.jsCode = `var item = $input.first().json;
var routeData = $('Category Loop').first().json || {};
var customTopic = String(routeData.customTopic || '').trim();

var title = customTopic || String(item.title || 'Latest Emerging Development').trim();
var link = customTopic ? 'https://signalnestnews.vercel.app' : String(item.link || 'https://www.bbc.co.uk/news').trim();
var snippet = customTopic ? ('In-depth analysis and comprehensive educational breakdown of ' + customTopic) : String(item.contentSnippet || item.content || item.description || '').replace(/<[^>]*>/g, '').trim().slice(0, 400);

/* Extract real web news image from feed */
var realWebImage = '';
if (item['media:thumbnail']) {
  if (typeof item['media:thumbnail'] === 'string') realWebImage = item['media:thumbnail'];
  else if (item['media:thumbnail'].$ && item['media:thumbnail'].$.url) realWebImage = item['media:thumbnail'].$.url;
  else if (item['media:thumbnail'].url) realWebImage = item['media:thumbnail'].url;
}
if (!realWebImage && item.enclosure && item.enclosure.url) realWebImage = item.enclosure.url;
if (!realWebImage && item['media:content']) {
  if (item['media:content'].$ && item['media:content'].$.url) realWebImage = item['media:content'].$.url;
  else if (item['media:content'].url) realWebImage = item['media:content'].url;
}
if (!realWebImage) {
  var imgMatch = String(item.content || item.description || '').match(/<img[^>]+src=["'](https?:\\/\\/[^"']+)["']/i);
  if (imgMatch && imgMatch[1]) realWebImage = imgMatch[1];
}

if (realWebImage && realWebImage.indexOf('ichef.bbci.co.uk') !== -1) {
  realWebImage = realWebImage.replace(/\\/standard\\/\\d+\\//, '/standard/976/');
}

var sourceDomain = 'News Coverage';
try { sourceDomain = new URL(link).hostname.replace(/^www\\./, ''); } catch (e) {}

var categoryInstruction = '';
var targetCat = routeData.targetCategory || 'auto';
if (targetCat !== 'auto' && ['technology-ai', 'business', 'education', 'digital-skills', 'software-tutorials', 'lifestyle', 'internet-trends'].indexOf(targetCat) !== -1) {
  categoryInstruction = '3. Category: Must be strictly "' + targetCat + '".';
} else {
  categoryInstruction = '3. Category: Must be classified into the single best matching category from this exact list: ["technology-ai", "business", "education", "digital-skills", "software-tutorials", "lifestyle", "internet-trends"]. Pick the one that accurately matches the subject matter.';
}

/* Ultra High-Traffic SEO Prompt for Gemini */
var prompt = 'You are a master SEO journalist and web publisher for SignalNest. Write a comprehensive, high-traffic, SEO-dominant educational guide (900-1200 words) based on this news story:\\n\\n' +
'Title: ' + title + '\\n' +
'Summary: ' + snippet + '\\n' +
'Source URL: ' + link + '\\n\\n' +
'SEO & CONTENT GUIDELINES (Strict):\\n' +
'1. Title: Under 65 characters, high search volume query, includes primary keyword near front.\\n' +
'2. Description: 140-155 characters meta description with compelling search hook.\\n' +
categoryInstruction + '\\n' +
'4. Tags: 5-6 high search volume long-tail keywords.\\n' +
'5. Body HTML:\\n' +
'   - Opening Lead: 40-50 words directly answering the core query (optimized for Google Featured Snippets and AI Overviews).\\n' +
'   - Informative <h2> and <h3> subheadings covering mechanics, causes, analysis, and future outlook.\\n' +
'   - A structured bullet list or summary breakdown of key takeaways.\\n' +
'   - A dedicated <h2>Frequently Asked Questions</h2> section with 3-4 common questions using <h3> and <p>.\\n' +
'   - Word count: 850 to 1250 words of authoritative, engaging prose.\\n\\n' +
'Respond ONLY with valid JSON in this exact structure (no markdown fences, no extra text):\\n' +
'{\\n' +
'  "title": "Clear SEO Title (under 65 chars)",\\n' +
'  "excerpt": "2 sentence engaging summary",\\n' +
'  "description": "140-155 char meta description",\\n' +
'  "category": "' + (targetCat !== 'auto' ? targetCat : 'technology-ai') + '",\\n' +
'  "tags": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],\\n' +
'  "content": "<p class=\\"lead\\">Direct answer lead...</p><h2>...</h2><p>...</p><h2>Frequently Asked Questions</h2><h3>...</h3><p>...</p>",\\n' +
'  "sources": [{"title": "' + sourceDomain + ' News Report", "url": "' + link + '"}]\\n' +
'}';

return [{ json: { originalTitle: title, originalLink: link, realWebImage: realWebImage, sourceDomain: sourceDomain, prompt: prompt } }];`;
}

// 4. Update Format Article & Build JSON
const formatNode = original.nodes.find(n => n.name === 'Format Article & Build JSON');
if (formatNode) {
  formatNode.parameters.jsCode = `var rawText = '';
try {
  rawText = $input.first().json.candidates[0].content.parts[0].text;
} catch (e) {
  throw new Error('Gemini API response did not contain candidates: ' + JSON.stringify($input.first().json));
}

var cleaned = rawText.replace(/^\\s*\`\`\`(?:json)?/i, '').replace(/\`\`\`\\s*$/, '').trim();
var article = JSON.parse(cleaned);

/* Safe Slug Generation - guarantees no trailing hyphens */
var slug = (article.title || 'article')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .slice(0, 70)
  .replace(/^-+|-+$/g, '');
if (!slug || slug.length < 3) slug = 'article-' + Date.now();

var words = String(article.content || '').replace(/<[^>]*>/g, ' ').split(/\\s+/).filter(Boolean).length;
var readingTime = Math.max(1, Math.round(words / 225));
var now = new Date().toISOString();

/* Hybrid Image Selection: Real Web News Photo (if present) OR Real AI Generation */
var prepData = $('Prepare Article Prompt').first().json || {};
var realWebImage = String(prepData.realWebImage || '').trim();
var sourceDomain = String(prepData.sourceDomain || 'Web News');
var cleanHeadline = String(article.title || '').replace(/['"]/g, '').trim();

var heroImageUrl = '';
var heroImageAlt = '';
var heroImageCaption = '';
var imageSourceType = '';

if (realWebImage && realWebImage.startsWith('http')) {
  heroImageUrl = realWebImage;
  heroImageAlt = cleanHeadline + ' - Authentic news press photo via ' + sourceDomain;
  heroImageCaption = 'Authentic editorial press photography via ' + sourceDomain + ' news reporting.';
  imageSourceType = 'Authentic Web Press Photo';
} else {
  var imgPrompt = encodeURIComponent('editorial photography of ' + cleanHeadline + ', photorealistic, modern journalistic style, cinematic lighting, 8k, high quality editorial publication');
  heroImageUrl = 'https://image.pollinations.ai/prompt/' + imgPrompt + '?width=1200&height=675&nologo=true';
  heroImageAlt = 'AI-generated editorial photography: ' + cleanHeadline;
  heroImageCaption = 'AI Generated: Visual editorial overview of ' + cleanHeadline;
  imageSourceType = 'Photorealistic AI Art';
}

/* Supporting Visual Breakdowns inside article body */
var sup1Prompt = encodeURIComponent('detailed diagrammatic and architectural view of ' + cleanHeadline + ', clean modern technical editorial style, photorealistic, 8k');
var sup1Url = 'https://image.pollinations.ai/prompt/' + sup1Prompt + '?width=1200&height=750&nologo=true';

var sup2Prompt = encodeURIComponent('practical real world execution and workplace synthesis of ' + cleanHeadline + ', modern office environment, cinematic lighting, photorealistic 8k');
var sup2Url = 'https://image.pollinations.ai/prompt/' + sup2Prompt + '?width=1200&height=750&nologo=true';

/* Valid Category Resolution across all 7 official categories */
var validCats = ['technology-ai', 'business', 'education', 'digital-skills', 'software-tutorials', 'lifestyle', 'internet-trends'];
var routeData = $('Category Loop').first().json || {};
var targetCategory = routeData.targetCategory;

var category = 'technology-ai';
if (targetCategory && targetCategory !== 'auto' && validCats.indexOf(targetCategory) !== -1) {
  category = targetCategory;
} else if (article.category && validCats.indexOf(article.category) !== -1) {
  category = article.category;
} else {
  var fullText = (cleanHeadline + ' ' + (article.description || '') + ' ' + (article.excerpt || '')).toLowerCase();
  if (fullText.indexOf('business') !== -1 || fullText.indexOf('finance') !== -1 || fullText.indexOf('market') !== -1 || fullText.indexOf('economy') !== -1) category = 'business';
  else if (fullText.indexOf('education') !== -1 || fullText.indexOf('career') !== -1 || fullText.indexOf('degree') !== -1 || fullText.indexOf('study') !== -1) category = 'education';
  else if (fullText.indexOf('lifestyle') !== -1 || fullText.indexOf('health') !== -1 || fullText.indexOf('wellness') !== -1 || fullText.indexOf('food') !== -1 || fullText.indexOf('sleep') !== -1) category = 'lifestyle';
  else if (fullText.indexOf('tutorial') !== -1 || fullText.indexOf('software') !== -1 || fullText.indexOf('how to') !== -1) category = 'software-tutorials';
  else if (fullText.indexOf('skill') !== -1 || fullText.indexOf('freelance') !== -1 || fullText.indexOf('remote') !== -1) category = 'digital-skills';
  else if (fullText.indexOf('trend') !== -1 || fullText.indexOf('social') !== -1 || fullText.indexOf('game') !== -1 || fullText.indexOf('gaming') !== -1 || fullText.indexOf('viral') !== -1) category = 'internet-trends';
  else category = 'technology-ai';
}

/* Ensure Description is always present and >= 45 chars */
var description = String(article.description || article.excerpt || article.title || '').trim();
if (description.length < 45) {
  description = description + ' - Discover in-depth analysis, key takeaways, and expert reporting on SignalNest.';
}
description = description.slice(0, 160);

var articlePayload = {
  slug: slug,
  title: String(article.title || '').slice(0, 90),
  excerpt: article.excerpt || description,
  description: description,
  content: article.content,
  category: category,
  tags: Array.isArray(article.tags) && article.tags.length ? article.tags : ['news', 'guide', 'insights', category],
  image: heroImageUrl,
  imageAlt: heroImageAlt,
  heroImage: heroImageUrl,
  heroImageAlt: heroImageAlt,
  heroImageCaption: heroImageCaption,
  supportingImage1: sup1Url,
  supportingImage1Alt: 'Methodology breakdown: ' + cleanHeadline,
  supportingImage1Caption: 'Architectural analysis and key operational metrics.',
  supportingImage2: sup2Url,
  supportingImage2Alt: 'Practical implementation: ' + cleanHeadline,
  supportingImage2Caption: 'Synthesis and real-world execution framework.',
  sources: article.sources || [{ title: sourceDomain + ' News', url: prepData.originalLink }],
  verification: ['Verify primary facts and figures against official corporate filings and regulatory documentation.'],
  readingTime: readingTime,
  wordCount: words,
  publishedAt: now,
  approvedAt: now,
  approvedBy: 'Christian Agbodzi',
  reviewer: 'Christian Agbodzi',
  approved: true,
  status: 'published',
  visuallyComplete: true,
  visualIdentity: {
    provider: imageSourceType.indexOf('Press') !== -1 ? 'news-source-photo' : 'pollinations-flux-ai',
    style: 'photorealistic-editorial',
    generatedAt: now
  }
};

var jsonString = JSON.stringify(articlePayload, null, 2);
var b64Content = Buffer.from(jsonString).toString('base64');
var targetChatId = routeData.chatId || '7785938669';

return [{
  json: {
    slug: slug,
    title: articlePayload.title,
    category: category,
    excerpt: String(articlePayload.excerpt || ''),
    readingTime: readingTime,
    wordCount: words,
    imageUrl: heroImageUrl,
    imageSourceType: imageSourceType,
    chatId: targetChatId,
    base64Content: b64Content,
    url: 'https://signalnestnews.vercel.app/articles/' + slug
  }
}];`;
}

// 5. Add Deploy Hook node and Wait node
const triggerDeployNode = {
  parameters: {
    method: 'POST',
    url: 'https://api.vercel.com/v1/integrations/deploy/prj_2ywx6A9xMAkIRfpVa8tgi0Udla0x/7Mhx2a8LVf',
    options: {}
  },
  id: 'e81c1256-42d4-4f27-a068-154df65eef89',
  name: 'Trigger Vercel Deploy',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: [2000, 160]
};

const waitNode = {
  parameters: {
    amount: 25,
    unit: 'seconds'
  },
  id: 'c71a399f-7649-4eb5-8e3d-24da066de947',
  name: 'Wait for Vercel Build',
  type: 'n8n-nodes-base.wait',
  typeVersion: 1.1,
  position: [2224, 160],
  webhookId: 'b9e9b28f-7c15-4fa0-863a-8610ebefbfec'
};

// Update position of Send Telegram Alert
const alertNode = original.nodes.find(n => n.name === 'Send Telegram Alert');
if (alertNode) {
  alertNode.position = [2448, 160];
}

// Add the new nodes if not already present
original.nodes = original.nodes.filter(n => n.name !== 'Trigger Vercel Deploy' && n.name !== 'Wait for Vercel Build');
original.nodes.push(triggerDeployNode);
original.nodes.push(waitNode);

// 6. Rewire connections:
// Commit to GitHub (Auto-Deploy) -> Trigger Vercel Deploy -> Wait for Vercel Build -> Send Telegram Alert -> Category Loop
original.connections['Commit to GitHub (Auto-Deploy)'] = {
  main: [[{ node: 'Trigger Vercel Deploy', type: 'main', index: 0 }]]
};
original.connections['Trigger Vercel Deploy'] = {
  main: [[{ node: 'Wait for Vercel Build', type: 'main', index: 0 }]]
};
original.connections['Wait for Vercel Build'] = {
  main: [[{ node: 'Send Telegram Alert', type: 'main', index: 0 }]]
};
original.connections['Send Telegram Alert'] = {
  main: [[{ node: 'Category Loop', type: 'main', index: 0 }]]
};

const outPath = 'c:/Users/TOSHIBA/Desktop/signalnest/SignalNest_-_Autopilot_with_Telegram_Bot_Trigger.json';
fs.writeFileSync(outPath, JSON.stringify(original, null, 2), 'utf8');
console.log('Successfully generated:', outPath);

