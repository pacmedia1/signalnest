'use strict';
/**
 * Updates all articles in content/articles/ to use real AI-generated images
 * matching each article's topic, ensuring 100% photorealistic editorial AI generation.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ARTICLES_DIR = path.join(ROOT, 'content', 'articles');

const REAL_AI_IMAGES = {
  'add-google-analytics-4-to-a-static-site': {
    hero: '/assets/images/articles/add-google-analytics-4-to-a-static-site/featured.jpg',
    heroAlt: 'AI-generated editorial photography: Google Analytics 4 live telemetry dashboard on modern workstation',
    heroCaption: 'AI Generated: Modern web telemetry and real-time event analytics dashboard.',
    sup1: 'https://image.pollinations.ai/prompt/diagram%20of%20lightweight%20JavaScript%20telemetry%20pipeline%20photorealistic%20modern%20engineering%20workspace?width=1200&height=750&nologo=true',
    sup1Alt: 'AI-generated editorial photography: Developer workstation showing script loading performance metrics',
    sup1Caption: 'AI Generated: Asynchronous script loading breakdown and payload budget verification.',
    sup2: 'https://image.pollinations.ai/prompt/perfect%20100%20PageSpeed%20performance%20audit%20score%20on%20laptop%20screen%20in%20bright%20office%20photorealistic?width=1200&height=750&nologo=true',
    sup2Alt: 'AI-generated editorial photography: Perfect PageSpeed performance audit results on laptop screen',
    sup2Caption: 'AI Generated: Maintaining 100 PageSpeed scores while streaming event telemetry.'
  },

  'digital-minimalism-daily-focus-routine': {
    hero: '/assets/images/articles/digital-minimalism-daily-focus-routine/featured.jpg',
    heroAlt: 'AI-generated editorial photography: Minimalist morning workstation with natural light and notebook',
    heroCaption: 'AI Generated: Cultivating deep work through distraction-free digital environments.',
    sup1: 'https://image.pollinations.ai/prompt/analog%20time%20blocking%20schedule%20planner%20photorealistic%20morning%20sunlight?width=1200&height=750&nologo=true',
    sup1Alt: 'AI-generated editorial photography: Analog time-blocking schedule for deep work focus',
    sup1Caption: 'AI Generated: Designing unshakeable 90-minute distraction-free focus blocks.',
    sup2: 'https://image.pollinations.ai/prompt/peaceful%20Scandinavian%20home%20office%20wooden%20desk%20plants%20photorealistic?width=1200&height=750&nologo=true',
    sup2Alt: 'AI-generated editorial photography: Mindful focused work in a quiet Scandinavian workspace',
    sup2Caption: 'AI Generated: Protecting deep focus as a non-negotiable professional discipline.'
  },

  'elon-musk-appears-to-signal-the-end-of-the-road-for-cybertruck': {
    hero: 'https://image.pollinations.ai/prompt/editorial%20photography%20of%20Tesla%20Cybertruck%20parked%20next%20to%20golden%20autonomous%20Tesla%20Cybercab%20at%20sunset%20on%20highway%208k%20photorealistic?width=1200&height=675&nologo=true',
    heroAlt: 'AI-generated editorial photography: Tesla Cybertruck alongside autonomous Cybercab robotaxi at sunset',
    heroCaption: 'AI Generated: Tesla fleet transition from stainless-steel Cybertruck to driverless Cybercab.',
    sup1: 'https://image.pollinations.ai/prompt/advanced%20robotic%20gigafactory%20assembly%20line%20building%20autonomous%20electric%20vehicles%20photorealistic%208k?width=1200&height=750&nologo=true',
    sup1Alt: 'AI-generated editorial photography: Advanced robotic manufacturing line for autonomous passenger vehicles',
    sup1Caption: 'AI Generated: Unboxed manufacturing architecture powering next-generation robotaxis.',
    sup2: 'https://image.pollinations.ai/prompt/autonomous%20passenger%20robotaxi%20interior%20without%20steering%20wheel%20panoramic%20glass%20roof%20photorealistic%208k?width=1200&height=750&nologo=true',
    sup2Alt: 'AI-generated editorial photography: Driverless autonomous vehicle interior overlooking city skyline',
    sup2Caption: 'AI Generated: The economic reality of dedicated robotaxi transportation networks.'
  },

  'retrieval-augmented-generation-architecture': {
    hero: 'https://image.pollinations.ai/prompt/editorial%20photography%20of%20high-tech%20AI%20vector%20embeddings%20and%20neural%20network%20visualization%20in%20enterprise%20data%20center%20photorealistic%208k?width=1200&height=675&nologo=true',
    heroAlt: 'AI-generated editorial photography: 3D vector embeddings and neural network in modern data center',
    heroCaption: 'AI Generated: Vector search mechanics and high-dimensional semantic retrieval.',
    sup1: 'https://image.pollinations.ai/prompt/holographic%20vector%20database%20similarity%20clusters%20in%20server%20room%20photorealistic%208k?width=1200&height=750&nologo=true',
    sup1Alt: 'AI-generated editorial photography: Vector database similarity search and semantic embedding clusters',
    sup1Caption: 'AI Generated: Approximate Nearest Neighbor (ANN) search inside vector databases.',
    sup2: 'https://image.pollinations.ai/prompt/software%20engineers%20designing%20enterprise%20RAG%20AI%20pipeline%20on%20illuminated%20interactive%20display%20photorealistic%208k?width=1200&height=750&nologo=true',
    sup2Alt: 'AI-generated editorial photography: Enterprise software architects designing RAG production pipeline',
    sup2Caption: 'AI Generated: Grounded retrieval pipelines preventing hallucination in mission-critical applications.'
  },

  'small-business-cash-flow-forecast': {
    hero: 'https://image.pollinations.ai/prompt/editorial%20photography%20of%20small%20business%20founder%20analyzing%2013-week%20cash%20flow%20forecast%20spreadsheets%20on%20laptop%20in%20bright%20modern%20office%20photorealistic%208k?width=1200&height=675&nologo=true',
    heroAlt: 'AI-generated editorial photography: Business founder reviewing cash flow forecast on laptop',
    heroCaption: 'AI Generated: Liquidity forecasting and operational expense modeling in action.',
    sup1: 'https://image.pollinations.ai/prompt/financial%20statements%20balance%20sheet%20and%20sleek%20modern%20calculator%20on%20mahogany%20desk%20photorealistic%208k?width=1200&height=750&nologo=true',
    sup1Alt: 'AI-generated editorial photography: Financial planning calculations and liquidity forecast documents',
    sup1Caption: 'AI Generated: Weekly collections, operational expenses, and debt service timing.',
    sup2: 'https://image.pollinations.ai/prompt/executive%20leadership%20team%20reviewing%20quarterly%20revenue%20runway%20in%20glass%20conference%20room%20photorealistic%208k?width=1200&height=750&nologo=true',
    sup2Alt: 'AI-generated editorial photography: Business leadership reviewing liquidity runway metrics in conference room',
    sup2Caption: 'AI Generated: Scenario modeling against receivables delays and liquidity contingencies.'
  },

  'study-plan-that-survives-a-busy-week': {
    hero: 'https://image.pollinations.ai/prompt/editorial%20photography%20of%20organized%20study%20desk%20for%20busy%20professionals%20digital%20tablet%20with%20calendar%20timeblocks%20warm%20desk%20lamp%20photorealistic%208k?width=1200&height=675&nologo=true',
    heroAlt: 'AI-generated editorial photography: Structured evening study desk with tablet timeblocks and books',
    heroCaption: 'AI Generated: Designing sustainable learning habits for demanding professional schedules.',
    sup1: 'https://image.pollinations.ai/prompt/weekly%20habit%20tracking%20journal%20and%20review%20dashboard%20on%20tablet%20screen%20warm%20wood%20desk%20photorealistic%208k?width=1200&height=750&nologo=true',
    sup1Alt: 'AI-generated editorial photography: Habit tracking metrics and progress dashboard for weekly study goals',
    sup1Caption: 'AI Generated: Weekly retrospectives to adjust study targets before burnout occurs.',
    sup2: 'https://image.pollinations.ai/prompt/professional%20engaged%20in%20deep%20focused%20technical%20study%20in%20serene%20library%20photorealistic%208k?width=1200&height=750&nologo=true',
    sup2Alt: 'AI-generated editorial photography: Professional student engaged in focused technical study session',
    sup2Caption: 'AI Generated: Spaced repetition and active recall applied across compressed schedules.'
  },

  'tesla-s-bold-pivot-elon-musk-signals-cybertruck-s-end-for-a-driverless-cybe': {
    hero: 'https://image.pollinations.ai/prompt/photorealistic%20editorial%20photography%20of%20autonomous%20Tesla%20Cybercab%20fleet%20with%20butterfly%20doors%20open%20in%20futuristic%20showroom%208k%20automotive%20showcase?width=1200&height=675&nologo=true',
    heroAlt: 'AI-generated editorial photography: Autonomous Tesla Cybercab fleet in futuristic showroom',
    heroCaption: 'AI Generated: Tesla driverless Cybercab robotaxi platform.',
    sup1: 'https://image.pollinations.ai/prompt/autonomous%20vehicle%20computer%20vision%20neural%20network%20tracking%20highway%20photorealistic%208k?width=1200&height=750&nologo=true',
    sup1Alt: 'AI-generated editorial photography: Autonomous vehicle computer vision neural network tracking roadway',
    sup1Caption: 'AI Generated: End-to-end neural network driving eliminating manual vehicle controls.',
    sup2: 'https://image.pollinations.ai/prompt/driverless%20electric%20taxis%20gliding%20through%20modern%20smart%20city%20boulevard%20at%20dusk%20photorealistic%208k?width=1200&height=750&nologo=true',
    sup2Alt: 'AI-generated editorial photography: Autonomous driverless vehicles navigating modern urban boulevard at dusk',
    sup2Caption: 'AI Generated: The societal shift toward low-cost point-to-point autonomous mobility.'
  },

  'what-an-xml-sitemap-actually-does': {
    hero: 'https://image.pollinations.ai/prompt/editorial%20photography%20of%20digital%20search%20engine%20crawler%20visualizing%20hierarchical%20website%20sitemap%20nodes%20glowing%20fiber%20optic%20pathways%20photorealistic%208k?width=1200&height=675&nologo=true',
    heroAlt: 'AI-generated editorial photography: Web crawler mapping hierarchical XML sitemap protocol',
    heroCaption: 'AI Generated: How search bots consume and process structured XML URL inventories.',
    sup1: 'https://image.pollinations.ai/prompt/server%20rack%20telemetry%20logs%20showing%20search%20bot%20200%20OK%20crawl%20statuses%20photorealistic%208k?width=1200&height=750&nologo=true',
    sup1Alt: 'AI-generated editorial photography: Server access logs showing search crawler discovery and response times',
    sup1Caption: 'AI Generated: Aligning server response latency with search engine indexing budgets.',
    sup2: 'https://image.pollinations.ai/prompt/SEO%20architect%20evaluating%20technical%20indexing%20coverage%20and%20crawl%20budgets%20on%20dual%20monitors%20photorealistic%208k?width=1200&height=750&nologo=true',
    sup2Alt: 'AI-generated editorial photography: SEO architect evaluating crawl coverage and canonical link structures',
    sup2Caption: 'AI Generated: Resolving orphan pages and canonical conflicts at production scale.'
  }
};

let updated = 0;
for (const [slug, spec] of Object.entries(REAL_AI_IMAGES)) {
  const filePath = path.join(ARTICLES_DIR, `${slug}.json`);
  if (!fs.existsSync(filePath)) continue;

  const article = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  article.image = spec.hero;
  article.imageAlt = spec.heroAlt;
  article.heroImage = spec.hero;
  article.heroImageAlt = spec.heroAlt;
  article.heroImageCaption = spec.heroCaption;

  article.supportingImage1 = spec.sup1;
  article.supportingImage1Alt = spec.sup1Alt;
  article.supportingImage1Caption = spec.sup1Caption;

  article.supportingImage2 = spec.sup2;
  article.supportingImage2Alt = spec.sup2Alt;
  article.supportingImage2Caption = spec.sup2Caption;

  article.visuallyComplete = true;
  article.visualIdentity = {
    provider: 'pollinations-flux-ai',
    style: 'photorealistic-editorial',
    accent: '#F28C28',
    secondaryAccent: '#FF9F43',
    generatedAt: new Date().toISOString()
  };

  fs.writeFileSync(filePath, JSON.stringify(article, null, 2) + '\n', 'utf8');
  console.log(`✓ Updated [${slug}] with real AI-generated images.`);
  updated++;
}

console.log(`\nSuccessfully updated ${updated} articles to 100% real AI-generated images.\n`);

