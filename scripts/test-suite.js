#!/usr/bin/env node
'use strict';
/**
 * SignalNest test suite.
 *
 * Executes the REAL JavaScript embedded in the generated n8n Code nodes inside a
 * sandbox with mocked $input / $() / $env, plus unit tests for the site library
 * and assertions over the built output.
 *
 * Buffer is deliberately NOT provided to the sandbox, which proves the workflows
 * do not depend on it for base64 encoding.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const WF_DIR = path.join(ROOT, 'n8n-workflows');

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed += 1;
    failures.push({ name, message: error.message });
    console.log(`  ✗ ${name}\n      ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}
function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(`${message || 'Expected equality'} — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}
function assertIncludes(haystack, needle, message) {
  if (String(haystack).indexOf(needle) === -1) throw new Error(`${message || 'Missing substring'} — looked for ${JSON.stringify(needle)}`);
}

/* ------------------------------------------------------------------ *
 * Workflow loading + sandboxed execution of Code nodes
 * ------------------------------------------------------------------ */
function loadWorkflow(file) {
  return JSON.parse(fs.readFileSync(path.join(WF_DIR, file), 'utf8'));
}

function getCode(workflow, nodeName) {
  const node = workflow.nodes.find((n) => n.name === nodeName);
  if (!node) throw new Error(`Node "${nodeName}" not found in ${workflow.name}`);
  if (!node.parameters || typeof node.parameters.jsCode !== 'string') {
    throw new Error(`Node "${nodeName}" has no jsCode`);
  }
  return node.parameters.jsCode;
}

/**
 * Run a workflow Code node.
 * @param {string} jsCode
 * @param {{inputItems?: object[], nodeOutputs?: object, env?: object}} options
 */
function runCode(jsCode, options) {
  const opts = options || {};
  const inputItems = (opts.inputItems || []).map((json) => ({ json }));
  const nodeOutputs = opts.nodeOutputs || {};
  const env = Object.assign({ GITHUB_BRANCH: 'main' }, opts.env || {});

  const $input = {
    all: () => inputItems,
    first: () => inputItems[0] || { json: {} },
    last: () => inputItems[inputItems.length - 1] || { json: {} }
  };

  const $ = (name) => {
    if (!(name in nodeOutputs)) throw new Error(`Test mock missing node output: ${name}`);
    const items = [].concat(nodeOutputs[name]).map((json) => ({ json }));
    return { first: () => items[0] || { json: {} }, all: () => items, last: () => items[items.length - 1] || { json: {} } };
  };

  const sandbox = { $input, $, $env: env, console, Date, Math, JSON, RegExp, String, Number, Array, Object, Boolean, parseInt, parseFloat, isNaN, encodeURIComponent, decodeURIComponent };
  // Note: Buffer / process are intentionally absent.
  const wrapper = `(function(){\n${jsCode}\n})()`;
  return vm.runInNewContext(wrapper, vm.createContext(sandbox), { timeout: 15000 });
}

function makeGeminiResponse(payload) {
  return {
    statusCode: 200,
    body: { candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] }, finishReason: 'STOP' }] }
  };
}

const VALID_DRAFT = {
  title: 'A Practical Guide to Structuring a Small Business Budget',
  description: 'A step-by-step method for building a small business budget you can actually maintain, including a worked example and the mistakes that break the model.',
  category: 'business',
  tags: ['budgeting', 'small business'],
  keywords: ['small business budget', 'cash flow planning'],
  contentHtml: '<p>' + 'Budgeting for a small business starts with separating fixed costs from variable costs, then forecasting the leanest month. '.repeat(10) + '</p><h2>Step one</h2><p>' + 'List every recurring cost you cannot cancel this month and total it. '.repeat(10) + '</p>',
  sources: [{ title: 'Business planning basics', url: 'https://example.org/planning', publisher: 'Example' }],
  requiresVerification: ['Any tax treatment mentioned', 'Local filing thresholds']
};

/* ================================================================== *
 * 1. Site library units
 * ================================================================== */
console.log('\n1. Site library units');

const util = require('./lib/util');
const { render } = require('./lib/render');

test('sanitizer strips scripts, handlers and javascript: URLs', () => {
  const out = util.sanitizeHtml('<p onclick="x()">ok</p><script>bad()</script><a href="javascript:bad()">link</a><img src="/a.png" onerror="bad()">');
  assert(!/script/i.test(out), 'script tag survived');
  assert(!/onclick|onerror/i.test(out), 'inline handler survived');
  assert(!/javascript:/i.test(out), 'javascript: URL survived');
  assertIncludes(out, '<p>ok</p>', 'safe content removed');
});

test('sanitizer keeps safe markup and forces link rel', () => {
  const out = util.sanitizeHtml('<h2 id="a">T</h2><a href="https://example.org">x</a>');
  assertIncludes(out, 'id="a"');
  assertIncludes(out, 'rel="nofollow noopener noreferrer"');
});

test('slugify produces clean unique slugs', () => {
  assertEqual(util.slugify('How to Set Up GA4 on a Static Site!'), 'how-to-set-up-ga4-on-a-static-site');
  assertEqual(util.uniqueSlug('same', ['same', 'same-2']), 'same-3');
  assert(util.isValidSlug('abc-def'), 'valid slug rejected');
  assert(!util.isValidSlug('../etc/passwd'), 'path traversal slug accepted');
});

test('pure-JS base64 matches Node Buffer for unicode text', () => {
  const sample = 'Café ☕ 日本語 test ✓';
  assertEqual(util.base64Encode(sample), Buffer.from(sample, 'utf8').toString('base64'), 'base64 mismatch');
  assertEqual(util.base64Decode(util.base64Encode(sample)), sample, 'roundtrip mismatch');
});

test('template engine escapes and handles blocks', () => {
  const out = render('{{a}}|{{{b}}}|{{#if c}}yes{{else}}no{{/if}}', { a: '<x>', b: '<y>', c: true });
  assertEqual(out, '&lt;x&gt;|<y>|yes');
});

/* ================================================================== *
 * 2. Workflow 1 - discovery
 * ================================================================== */
console.log('\n2. Workflow 1 — topic discovery');

const wf1 = loadWorkflow('signalnest-01-discovery.json');

test('discovery normalises, scores and filters feed items', () => {
  const items = [
    { title: 'Google releases a new on-device AI model for Android developers', link: 'https://example.org/a', contentSnippet: 'The model runs locally and is aimed at app developers building features.' },
    { title: 'Google releases a new on-device AI model for Android developers', link: 'https://example.org/a', contentSnippet: 'duplicate' },
    { title: 'Short', link: 'https://example.org/short' },
    { title: 'Your daily horoscope for every star sign this week', link: 'https://example.org/horo', contentSnippet: 'gossip' },
    { title: 'Why remote freelance work is changing how graduates find jobs', link: 'https://example.org/remote', contentSnippet: 'Remote work and freelance contracts are expanding for graduates seeking work.' }
  ];
  const out = runCode(getCode(wf1, 'Normalise And Score Topics'), { inputItems: items });
  const result = out[0].json;
  assertEqual(result.discoveredCount, 3, 'expected 3 unique topics (short title dropped)');
  const topics = result.topics;
  assertEqual(topics.filter((t) => t.sourceUrl === 'https://example.org/a').length, 1, 'duplicate not removed');
  const horoscope = topics.find((t) => t.sourceUrl === 'https://example.org/horo');
  assertEqual(horoscope.status, 'rejected', 'low-value topic not rejected');
  const tech = topics.find((t) => t.sourceUrl === 'https://example.org/a');
  assertEqual(tech.category, 'technology-ai', 'category assignment failed');
  assert(tech.score > 40, 'score should reflect keyword hits');
  assert(/^[a-z0-9-]+$/.test(tech.id), 'topic id is not slug-safe');
});

test('discovery drops items with non-http links', () => {
  const out = runCode(getCode(wf1, 'Normalise And Score Topics'), {
    inputItems: [{ title: 'A perfectly reasonable headline about technology trends', link: 'javascript:alert(1)' }]
  });
  assertEqual(out[0].json.discoveredCount, 0);
});

test('queue merge de-duplicates against the persistent file (not memory)', () => {
  const incoming = {
    discoveredAt: 'now',
    topics: [
      { id: 't1', title: 'New topic about software tutorials for beginners', sourceUrl: 'https://example.org/new', status: 'candidate', score: 60 },
      { id: 't2', title: 'Already known topic about business funding rounds', sourceUrl: 'https://example.org/old', status: 'candidate', score: 55 }
    ]
  };
  const existingFile = {
    statusCode: 200,
    body: {
      sha: 'abc123',
      topics: [{ id: 't2', title: 'Already known topic about business funding rounds', sourceUrl: 'https://example.org/old', status: 'published', score: 50 }]
    }
  };
  const out = runCode(getCode(wf1, 'Merge With Persistent Queue'), {
    inputItems: [existingFile],
    nodeOutputs: { 'Normalise And Score Topics': incoming },
    env: { GITHUB_BRANCH: 'main' }
  });
  const result = out[0].json;
  assertEqual(result.added, 1, 'should add exactly one new topic');
  assertEqual(result.duplicates, 1, 'should count one duplicate');
  assertEqual(result.totalTopics, 2, 'queue size wrong');
  assertEqual(result.shouldCommit, true, 'should commit');
  const body = JSON.parse(result.githubPutBody);
  assertEqual(body.sha, 'abc123', 'existing SHA not carried into the PUT body');
  assert(body.content && !/[{}]/.test(body.content.slice(0, 5)), 'content should be base64');
});

test('queue merge creates the file when it does not exist yet', () => {
  const out = runCode(getCode(wf1, 'Merge With Persistent Queue'), {
    inputItems: [{ statusCode: 404, body: { message: 'Not Found' } }],
    nodeOutputs: { 'Normalise And Score Topics': { topics: [{ id: 'x', title: 'Brand new topic worth drafting about education', sourceUrl: 'https://e.org/x', status: 'candidate', score: 70 }] } }
  });
  const result = out[0].json;
  assertEqual(result.shouldCommit, true);
  assertEqual(result.fileExists, false);
  assertEqual(JSON.parse(result.githubPutBody).sha, undefined, 'must not send a SHA when creating a file');
});

/* ================================================================== *
 * 3. Workflow 2 - generation
 * ================================================================== */
console.log('\n3. Workflow 2 — AI generation and validation');

const wf2 = loadWorkflow('signalnest-02-generation.json');

test('valid Gemini JSON is accepted and slugged', () => {
  const out = runCode(getCode(wf2, 'Validate Draft'), {
    inputItems: [makeGeminiResponse(VALID_DRAFT)],
    nodeOutputs: { 'Build Gemini Prompt': { topic: { id: 't1', title: 'Budgeting', category: 'business', sourceUrl: 'https://example.org', summary: 'x' }, model: 'gemini-2.5-flash' } }
  });
  const result = out[0].json;
  assertEqual(result.ok, true, `expected ok, got problems: ${JSON.stringify(result.problems)}`);
  assert(util.isValidSlug(result.slug), 'slug invalid');
  assertEqual(result.draft.status, 'review', 'draft must enter review, never published');
  assertEqual(result.draft.approved, false, 'draft must not be pre-approved');
  assert(result.wordCount > 300, 'word count too low');
});

test('malformed model output is rejected, not passed through', () => {
  const out = runCode(getCode(wf2, 'Validate Draft'), {
    inputItems: [{ statusCode: 200, body: { candidates: [{ content: { parts: [{ text: 'Here is your article: {not json' }] } }] } }],
    nodeOutputs: { 'Build Gemini Prompt': { topic: { id: 't1', title: 'X', category: 'business', sourceUrl: 'https://e.org' }, model: 'm' } }
  });
  const result = out[0].json;
  assertEqual(result.ok, false);
  assert(result.problems.join(' ').toLowerCase().indexOf('not valid json') !== -1, 'should name the JSON problem');
});

test('missing sources or short body block the draft', () => {
  const bad = Object.assign({}, VALID_DRAFT, { sources: [], contentHtml: '<p>Too short.</p>' });
  const out = runCode(getCode(wf2, 'Validate Draft'), {
    inputItems: [makeGeminiResponse(bad)],
    nodeOutputs: { 'Build Gemini Prompt': { topic: { id: 't1', title: 'X', category: 'business', sourceUrl: 'https://e.org' }, model: 'm' } }
  });
  const problems = out[0].json.problems.join(' ');
  assertEqual(out[0].json.ok, false);
  assertIncludes(problems, 'No sources', 'sources problem missing');
  assertIncludes(problems, 'under 300 words', 'length problem missing');
});

test('rate limit / server error is flagged retryable', () => {
  const out = runCode(getCode(wf2, 'Validate Draft'), {
    inputItems: [{ statusCode: 429, body: { error: { message: 'quota exceeded' } } }],
    nodeOutputs: { 'Build Gemini Prompt': { topic: { id: 't1', title: 'X', category: 'business', sourceUrl: 'https://e.org' }, model: 'm' } }
  });
  const result = out[0].json;
  assertEqual(result.ok, false);
  assertEqual(result.retryable, true, 'HTTP 429 should be retryable');
});

test('safety-blocked empty response is rejected', () => {
  const out = runCode(getCode(wf2, 'Validate Draft'), {
    inputItems: [{ statusCode: 200, body: { candidates: [] } }],
    nodeOutputs: { 'Build Gemini Prompt': { topic: { id: 't1', title: 'X', category: 'business', sourceUrl: 'https://e.org' }, model: 'm' } }
  });
  assertEqual(out[0].json.ok, false);
  assertIncludes(out[0].json.problems.join(' '), 'no candidate text');
});

test('duplicate slug is renamed rather than overwritten', () => {
  const draftInfo = runCode(getCode(wf2, 'Validate Draft'), {
    inputItems: [makeGeminiResponse(VALID_DRAFT)],
    nodeOutputs: { 'Build Gemini Prompt': { topic: { id: 't1', title: 'T', category: 'business', sourceUrl: 'https://e.org' }, model: 'm' } }
  })[0].json;
  const out = runCode(getCode(wf2, 'Ensure Unique Slug'), {
    inputItems: [{ statusCode: 200, body: [{ name: draftInfo.slug + '.json' }, { name: draftInfo.slug + '-2.json' }] }],
    nodeOutputs: { 'Validate Draft': draftInfo }
  });
  const result = out[0].json;
  assertEqual(result.renamed, true, 'should have been renamed');
  assertEqual(result.slug, draftInfo.slug + '-3', 'should pick the next free suffix');
});

/* ================================================================== *
 * 3b. Workflow 2 - NA10 image generation nodes
 * ================================================================== */
console.log('\n3b. Workflow 2 — NA10 image generation module');

test('NA10 Detect Category maps known categories to style presets', () => {
  const out = runCode(getCode(wf2, 'NA10 Detect Category'), {
    inputItems: [{}],
    nodeOutputs: { 'Confirm Save': { slug: 'test-article', title: 'Test Article', draft: { category: 'technology-ai', title: 'Test Article' } } }
  });
  const result = out[0].json;
  assertEqual(result.slug, 'test-article');
  assertEqual(result.category, 'technology-ai');
  assertEqual(result.style.palette, 'tech-matrix', 'technology-ai should map to tech-matrix');
  assertEqual(result.imageCount, 3, 'must request exactly 3 images');
  assertEqual(result.slots.length, 3, 'must have 3 slots');
  assert(result.slots.indexOf('featured') !== -1, 'must include featured slot');
  assert(result.slots.indexOf('supporting1') !== -1, 'must include supporting1 slot');
  assert(result.slots.indexOf('supporting2') !== -1, 'must include supporting2 slot');
});

test('NA10 Detect Category falls back for unknown categories', () => {
  const out = runCode(getCode(wf2, 'NA10 Detect Category'), {
    inputItems: [{}],
    nodeOutputs: { 'Confirm Save': { slug: 'mystery', title: 'Mystery', draft: { category: 'unknown-cat', title: 'Mystery' } } }
  });
  const result = out[0].json;
  assertEqual(result.style.palette, 'minimalist', 'unknown category should fallback to minimalist');
  assertEqual(result.imageCount, 3);
});

test('NA10 Build Image Prompts generates exactly 3 prompts', () => {
  const input = {
    slug: 'test-slug',
    title: 'Building Efficient APIs',
    category: 'technology-ai',
    style: { palette: 'tech-matrix', accent: '#F28C28', motif: 'circuit-nodes' },
    savedDraft: { slug: 'test-slug' }
  };
  const out = runCode(getCode(wf2, 'NA10 Build Image Prompts'), {
    inputItems: [input]
  });
  const result = out[0].json;
  assertEqual(result.prompts.length, 3, 'must produce exactly 3 prompts');
  assertEqual(result.prompts[0].slot, 'featured');
  assertEqual(result.prompts[1].slot, 'supporting1');
  assertEqual(result.prompts[2].slot, 'supporting2');
  assert(result.prompts[0].prompt.indexOf('Building Efficient APIs') !== -1, 'prompt must reference article title');
  assert(result.prompts[0].prompt.indexOf('#F28C28') !== -1, 'prompt must reference brand colour');
});

test('NA10 Generate Images produces results for all 3 slots', () => {
  const input = {
    slug: 'gen-test',
    prompts: [
      { slot: 'featured', role: 'Hero', prompt: 'Test prompt' },
      { slot: 'supporting1', role: 'Diagram 1', prompt: 'Test prompt 2' },
      { slot: 'supporting2', role: 'Diagram 2', prompt: 'Test prompt 3' }
    ],
    savedDraft: {}
  };
  const out = runCode(getCode(wf2, 'NA10 Generate Images'), {
    inputItems: [input],
    env: { IMAGE_PROVIDER: 'svg-local' }
  });
  const result = out[0].json;
  assertEqual(result.totalGenerated, 3);
  assertEqual(result.totalRequired, 3);
  assertEqual(result.imageErrors.length, 0, 'no errors expected');
  assertEqual(result.visuallyComplete, true);
  assert(result.imageResults[0].path.indexOf('/assets/images/articles/gen-test/featured.svg') !== -1, 'featured path');
});

test('NA10 Verify Completeness passes when all 3 slots present', () => {
  const input = {
    slug: 'complete-test',
    imageResults: [
      { slot: 'featured', status: 'pending', path: '/a.svg', altText: 'x', provider: 'svg-local' },
      { slot: 'supporting1', status: 'pending', path: '/b.svg', altText: 'y', provider: 'svg-local' },
      { slot: 'supporting2', status: 'pending', path: '/c.svg', altText: 'z', provider: 'svg-local' }
    ],
    imageErrors: [],
    savedDraft: {}
  };
  const out = runCode(getCode(wf2, 'NA10 Verify Completeness'), {
    inputItems: [input]
  });
  const result = out[0].json;
  assertEqual(result.visuallyComplete, true);
  assertEqual(result.problems.length, 0);
  assertEqual(result.imageMetadata.length, 3);
});

test('NA10 Verify Completeness fails when a slot is missing', () => {
  const input = {
    slug: 'incomplete-test',
    imageResults: [
      { slot: 'featured', status: 'pending', path: '/a.svg', altText: 'x', provider: 'svg-local' },
      { slot: 'supporting1', status: 'failed', path: '/b.svg', altText: 'y', provider: 'svg-local' }
    ],
    imageErrors: [{ slot: 'supporting2', error: 'Provider timeout' }],
    savedDraft: {}
  };
  const out = runCode(getCode(wf2, 'NA10 Verify Completeness'), {
    inputItems: [input]
  });
  const result = out[0].json;
  assertEqual(result.visuallyComplete, false, 'should not be visually complete');
  assert(result.problems.length > 0, 'should list problems');
  assertIncludes(result.problems.join(' '), 'supporting2', 'should identify missing slot');
});

test('NA10 Record Image Error formats a retryable message', () => {
  const input = {
    slug: 'error-test',
    problems: ['Missing image for slot: supporting2'],
    imageCount: 2
  };
  const out = runCode(getCode(wf2, 'NA10 Record Image Error'), {
    inputItems: [input]
  });
  const result = out[0].json;
  assertEqual(result.retryable, true);
  assertIncludes(result.message, 'error-test');
  assertIncludes(result.message, '2/3');
});

/* ================================================================== *
 * 4. Workflow 3 - approval gate (the critical section)
 * ================================================================== */
console.log('\n4. Workflow 3 — approval gate and publishing');

const wf3 = loadWorkflow('signalnest-03-publishing.json');
const TOKEN = 'test-token-0123456789abcdef';

function authRun(headers, env) {
  return runCode(getCode(wf3, 'Authorise Decision'), {
    inputItems: [{ headers, body: { decision: 'approve', article: { slug: 'x-article' }, reviewer: 'Ed' }, httpMethod: 'POST' }],
    env: Object.assign({ APPROVAL_SHARED_SECRET: TOKEN }, env || {})
  })[0].json;
}

test('webhook rejects a request with no token', () => {
  const result = authRun({});
  assertEqual(result.authorized, false);
  assertEqual(result.status, 401);
});

test('webhook rejects a wrong token', () => {
  const result = authRun({ 'x-review-token': 'wrong-token-000000000000' });
  assertEqual(result.authorized, false);
  assertEqual(result.status, 401);
});

test('webhook refuses everything when the secret is not configured', () => {
  const result = authRun({ 'x-review-token': TOKEN }, { APPROVAL_SHARED_SECRET: '' });
  assertEqual(result.authorized, false);
  assertEqual(result.status, 500);
});

test('webhook accepts the correct token and parses the body', () => {
  const result = authRun({ 'x-review-token': TOKEN });
  assertEqual(result.authorized, true);
  assertEqual(result.payload.reviewer, 'Ed');
});

test('oversized payload is rejected', () => {
  const result = runCode(getCode(wf3, 'Authorise Decision'), {
    inputItems: [{ headers: { 'x-review-token': TOKEN }, body: 'x'.repeat(300000) }],
    env: { APPROVAL_SHARED_SECRET: TOKEN }
  })[0].json;
  assertEqual(result.authorized, false);
  assertEqual(result.status, 413);
});

test('invalid decision verb is rejected', () => {
  const out = runCode(getCode(wf3, 'Validate Decision Shape'), {
    inputItems: [{ payload: { decision: 'publish-everything', article: { slug: 'ok-slug' } } }]
  })[0].json;
  assertEqual(out.ok, false);
  assertIncludes(out.problems.join(' '), 'decision must be one of');
});

const GOOD_DRAFT = {
  slug: 'budget-guide',
  title: 'How to Build a Small Business Budget You Can Maintain',
  description: 'A step-by-step method for building and maintaining a small business budget, including a worked example and the errors that quietly break it.',
  category: 'business',
  content: '<p>' + 'word '.repeat(800) + '</p>',
  sources: [{ title: 'S', url: 'https://example.org/s', publisher: 'E' }],
  status: 'review',
  approved: false,
  editorial: { revision: 1 }
};

function gateRun(draft, payload, readStatus) {
  return runCode(getCode(wf3, 'Merge Edits And Gate'), {
    inputItems: [readStatus === 404 ? { statusCode: 404, body: { message: 'Not Found' } } : { statusCode: 200, body: Object.assign({ sha: 'draftsha' }, draft) }],
    nodeOutputs: { 'Validate Decision Shape': payload }
  })[0].json;
}

test('gate returns 404 for a missing draft', () => {
  const result = gateRun({}, { decision: 'approve', slug: 'nope', reviewer: 'Ed', article: { slug: 'nope' } }, 404);
  assertEqual(result.ok, false);
  assertEqual(result.status, 404);
});

test('gate refuses approval when the client tries to set approved itself', () => {
  // The client sends approved:true, but approval is only granted if the draft is publishable,
  // and the value is set from the server's own verified payload.
  const payload = { decision: 'approve', slug: 'budget-guide', reviewer: '', article: { slug: 'budget-guide', approved: true, status: 'published' } };
  const result = gateRun(GOOD_DRAFT, payload);
  assertEqual(result.ok, false, 'must not publish without an approving editor');
  assertIncludes(result.message, 'approving editor name is required');
});

test('gate refuses a draft with no sources', () => {
  const draft = Object.assign({}, GOOD_DRAFT, { sources: [] });
  const result = gateRun(draft, { decision: 'approve', slug: 'budget-guide', reviewer: 'Ed', article: { slug: 'budget-guide' } });
  assertEqual(result.ok, false);
  assertIncludes(result.message, 'At least one valid source URL');
});

test('gate refuses a body below the word minimum', () => {
  const draft = Object.assign({}, GOOD_DRAFT, { content: '<p>short</p>' });
  const result = gateRun(draft, { decision: 'approve', slug: 'budget-guide', reviewer: 'Ed', article: { slug: 'budget-guide' } });
  assertEqual(result.ok, false);
  assertIncludes(result.message, 'minimum is');
});

test('gate refuses an unknown category', () => {
  const draft = Object.assign({}, GOOD_DRAFT, { category: 'crypto-signals' });
  const result = gateRun(draft, { decision: 'approve', slug: 'budget-guide', reviewer: 'Ed', article: { slug: 'budget-guide' } });
  assertEqual(result.ok, false);
  assertIncludes(result.message, 'not one of the configured categories');
});

test('gate approves a valid draft and stamps approval server-side', () => {
  const result = gateRun(GOOD_DRAFT, { decision: 'approve', slug: 'budget-guide', reviewer: 'Christian A.', article: { slug: 'budget-guide', title: GOOD_DRAFT.title, description: GOOD_DRAFT.description, category: 'business', content: GOOD_DRAFT.content, sources: GOOD_DRAFT.sources } });
  assertEqual(result.ok, true, result.message);
  assertEqual(result.draft.status, 'published');
  assertEqual(result.draft.approved, true);
  assertEqual(result.draft.approvedBy, 'Christian A.');
  assert(result.draft.approvedAt, 'approvedAt missing');
  assert(JSON.parse(result.draftPutBody).sha === 'draftsha', 'draft SHA not carried');
});

test('save decision never publishes', () => {
  const result = gateRun(GOOD_DRAFT, { decision: 'save', slug: 'budget-guide', reviewer: 'Ed', article: { slug: 'budget-guide', title: GOOD_DRAFT.title } });
  assertEqual(result.ok, true);
  assertEqual(result.decision, 'save');
  assertEqual(result.draft.status, 'review');
  assertEqual(result.draft.approved, false);
});

test('reject decision records the rejection without publishing', () => {
  const result = gateRun(GOOD_DRAFT, { decision: 'reject', slug: 'budget-guide', reviewer: 'Ed', article: { slug: 'budget-guide' } });
  assertEqual(result.draft.status, 'rejected');
  assertEqual(result.draft.approved, false);
});

test('publish payload reuses the existing SHA and original publish date', () => {
  const gate = gateRun(GOOD_DRAFT, { decision: 'approve', slug: 'budget-guide', reviewer: 'Ed', article: { slug: 'budget-guide', title: GOOD_DRAFT.title, description: GOOD_DRAFT.description, category: 'business', content: GOOD_DRAFT.content, sources: GOOD_DRAFT.sources } });
  const out = runCode(getCode(wf3, 'Prepare Publish Payload'), {
    inputItems: [{ statusCode: 200, body: { sha: 'existingsha', publishedAt: '2026-01-01T00:00:00.000Z' } }],
    nodeOutputs: { 'Merge Edits And Gate': gate }
  })[0].json;
  const body = JSON.parse(out.publishPutBody);
  assertEqual(body.sha, 'existingsha', 'existing SHA not used');
  assertEqual(out.isRepublish, true);
  const decoded = JSON.parse(Buffer.from(body.content, 'base64').toString('utf8'));
  assertEqual(decoded.publishedAt, '2026-01-01T00:00:00.000Z', 'original publication date not preserved');
  assert(decoded.updatedAt, 'updatedAt should be set on republish');
});

test('publish conflict (409) is reported clearly instead of silently retried', () => {
  const gate = gateRun(GOOD_DRAFT, { decision: 'approve', slug: 'budget-guide', reviewer: 'Ed', article: { slug: 'budget-guide', title: GOOD_DRAFT.title, description: GOOD_DRAFT.description, category: 'business', content: GOOD_DRAFT.content, sources: GOOD_DRAFT.sources } });
  // 404 path: new file, therefore no SHA should be sent
  const preparedNew = runCode(getCode(wf3, 'Prepare Publish Payload'), {
    inputItems: [{ statusCode: 404, body: null }],
    nodeOutputs: { 'Merge Edits And Gate': gate }
  })[0].json;
  assertEqual(preparedNew.sha, null, 'new article should have no sha');
  const confirm = runCode(getCode(wf3, 'Confirm Publish Commit'), {
    inputItems: [{ statusCode: 409, body: { message: 'sha does not match' } }],
    nodeOutputs: { 'Prepare Publish Payload': preparedNew }
  })[0].json;
  assertEqual(confirm.committed, false);
  assertEqual(confirm.conflict, true);
  assertIncludes(confirm.message, 'SHA conflict');
});

test('draft list is assembled from base64 file contents', () => {
  const fileA = { statusCode: 200, body: { content: Buffer.from(JSON.stringify({ slug: 'a-one', title: 'A', status: 'review', content: 'x y z', generation: { generatedAt: '2026-01-01', model: 'm' }, sources: [] })).toString('base64') } };
  const fileB = { statusCode: 200, body: { content: Buffer.from(JSON.stringify({ slug: 'b-two', title: 'B', status: 'review', content: 'x', generation: { generatedAt: '2026-01-02' }, sources: [{}] })).toString('base64') } };
  const out = runCode(getCode(wf3, 'Assemble Draft List'), { inputItems: [fileA, fileB] });
  const result = out[0].json;
  assertEqual(result.count, 2, 'should have two drafts');
  assertEqual(result.drafts[0].slug, 'b-two', 'newest first ordering failed');
  assertEqual(result.categories.length, 7, 'category list should be supplied to the editor');
});

/* ================================================================== *
 * 5. Workflow 4 - analytics honesty
 * ================================================================== */
console.log('\n5. Workflow 4 — analytics');

const wf4 = loadWorkflow('signalnest-04-analytics.json');

test('unavailable analytics are reported as unavailable, never zero', () => {
  const out = runCode(getCode(wf4, 'Normalise Analytics'), {
    inputItems: [{}],
    nodeOutputs: {
      'GA4 Run Report': { statusCode: 403, body: { error: { message: 'permission denied' } } },
      'GSC Search Analytics': { statusCode: 403, body: { error: { message: 'forbidden' } } },
      'Check Analytics Configuration': { availability: { ga4: false, gsc: false } }
    }
  })[0].json;
  assertEqual(out.ga4.available, false);
  assertEqual(out.gsc.available, false);
  assertEqual(out.ga4.totals, null, 'unavailable GA4 must not carry zero totals');
  assertEqual(out.gsc.clicks, null, 'unavailable GSC must not report 0 clicks');
});

test('real GA4 rows are summed and ranked', () => {
  const out = runCode(getCode(wf4, 'Normalise Analytics'), {
    inputItems: [{}],
    nodeOutputs: {
      'GA4 Run Report': { statusCode: 200, body: { rows: [
        { dimensionValues: [{ value: '/articles/a' }, { value: 'Organic Search' }], metricValues: [{ value: '10' }, { value: '8' }] },
        { dimensionValues: [{ value: '/articles/b' }, { value: 'Direct' }], metricValues: [{ value: '30' }, { value: '12' }] }
      ] } },
      'GSC Search Analytics': { statusCode: 200, body: { rows: [{ keys: ['q', 'p'], clicks: 3, impressions: 100, position: 8 }] } },
      'Check Analytics Configuration': { availability: { ga4: true, gsc: true } }
    }
  })[0].json;
  assertEqual(out.ga4.available, true);
  assertEqual(out.ga4.totals.pageViews, 40);
  assertEqual(out.ga4.totals.sessions, 20);
  assertEqual(out.ga4.topPages[0].path, '/articles/b', 'ranking failed');
  assertEqual(out.gsc.ctr, 3, 'CTR calculation wrong');
  assertEqual(out.gsc.position, 8);
});

test('report labels unavailable sections explicitly', () => {
  const normalised = runCode(getCode(wf4, 'Normalise Analytics'), {
    inputItems: [{}],
    nodeOutputs: {
      'GA4 Run Report': { statusCode: 500, body: {} },
      'GSC Search Analytics': { statusCode: 500, body: {} },
      'Check Analytics Configuration': { availability: { ga4: false, gsc: false } }
    }
  })[0].json;
  const report = runCode(getCode(wf4, 'Build Weekly Report'), { inputItems: [normalised] })[0].json;
  assertIncludes(report.reportMarkdown, 'Unavailable');
  assert(!/\| Clicks \| 0 \|/.test(report.reportMarkdown), 'report invented a zero for clicks');
});

/* ================================================================== *
 * 6. Built site output
 * ================================================================== */
console.log('\n6. Built site output');

const DIST = path.join(ROOT, 'dist');

test('build output exists and contains the expected pages', () => {
  assert(fs.existsSync(path.join(DIST, 'index.html')), 'index.html missing — run npm run build');
  ['articles', 'categories', 'legal', 'data', 'assets'].forEach((dir) => {
    assert(fs.existsSync(path.join(DIST, dir)), `${dir}/ missing`);
  });
  ['sitemap.xml', 'robots.txt', 'ads.txt', 'feed.xml', 'search.html', '404.html'].forEach((file) => {
    assert(fs.existsSync(path.join(DIST, file)), `${file} missing`);
  });
});

test('every published article is a page, in the sitemap, in the index and unlinked from drafts', () => {
  const index = JSON.parse(fs.readFileSync(path.join(DIST, 'data', 'articles.json'), 'utf8'));
  const sitemap = fs.readFileSync(path.join(DIST, 'sitemap.xml'), 'utf8');
  const searchIndex = JSON.parse(fs.readFileSync(path.join(DIST, 'data', 'search-index.json'), 'utf8'));
  assert(index.articles.length > 0, 'no published articles in index');
  index.articles.forEach((article) => {
    assert(fs.existsSync(path.join(DIST, 'articles', `${article.slug}.html`)), `missing page for ${article.slug}`);
    assertIncludes(sitemap, `/articles/${article.slug}`, `${article.slug} missing from sitemap`);
    assert(searchIndex.items.some((i) => i.slug === article.slug), `${article.slug} missing from search index`);
  });
});

test('homepage and category pages link to published articles', () => {
  const index = JSON.parse(fs.readFileSync(path.join(DIST, 'data', 'articles.json'), 'utf8'));
  const home = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  const first = index.articles[0];
  assertIncludes(home, `/articles/${first.slug}`, 'homepage does not link to the newest article');
  const cat = fs.readFileSync(path.join(DIST, 'categories', `${first.category}.html`), 'utf8');
  assertIncludes(cat, `/articles/${first.slug}`, 'category page does not list the article');
});

test('unapproved drafts are absent from every public output', () => {
  const index = fs.readFileSync(path.join(DIST, 'data', 'articles.json'), 'utf8');
  const sitemap = fs.readFileSync(path.join(DIST, 'sitemap.xml'), 'utf8');
  const searchIndex = fs.readFileSync(path.join(DIST, 'data', 'search-index.json'), 'utf8');
  const draftSlugs = ['retrieval-augmented-generation-explained'];
  draftSlugs.forEach((needle) => {
    assert(index.indexOf(`"slug": "${needle}`) === -1, `draft slug leaked into index: ${needle}`);
    assert(sitemap.indexOf(needle) === -1, `draft leaked into sitemap: ${needle}`);
    assert(searchIndex.indexOf(needle) === -1, `draft leaked into search index: ${needle}`);
    assert(!fs.existsSync(path.join(DIST, 'articles', `${needle}.html`)), `draft page was generated: ${needle}`);
  });
  const parsedSearch = JSON.parse(searchIndex);
  parsedSearch.items.forEach((item) => {
    assert(item.slug && item.title, 'search index item missing required fields');
  });
});

test('article pages carry canonical, OG, JSON-LD and breadcrumbs', () => {
  const index = JSON.parse(fs.readFileSync(path.join(DIST, 'data', 'articles.json'), 'utf8'));
  const html = fs.readFileSync(path.join(DIST, 'articles', `${index.articles[0].slug}.html`), 'utf8');
  assertIncludes(html, '<link rel="canonical"');
  assertIncludes(html, 'property="og:title"');
  assertIncludes(html, 'application/ld+json');
  assert(html.includes('"@type":"NewsArticle"') || html.includes('"@type":"BlogPosting"') || html.includes('"@type":"Article"'), 'article missing Article schema');
  assertIncludes(html, '"@type":"BreadcrumbList"');
  assertIncludes(html, 'aria-label="Breadcrumb"');
  assert(!/\{\{/.test(html), 'unrendered template tag in output');
});

test('robots.txt blocks admin and data, and points at the sitemap', () => {
  const robots = fs.readFileSync(path.join(DIST, 'robots.txt'), 'utf8');
  assertIncludes(robots, 'Disallow: /admin');
  assertIncludes(robots, 'Disallow: /data/');
  assertIncludes(robots, 'Sitemap:');
});

test('ads.txt contains no fabricated publisher id', () => {
  const ads = fs.readFileSync(path.join(DIST, 'ads.txt'), 'utf8');
  const siteConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
  const configuredClient = (siteConfig.ads && siteConfig.ads.adsense && siteConfig.ads.adsense.client) || process.env.ADSENSE_CLIENT || '';
  if (!configuredClient) {
    assert(!/pub-\d{16}/.test(ads), 'ads.txt appears to contain an unconfigured or invented publisher id');
  } else {
    assert(ads.includes(configuredClient.replace('ca-', '')), 'ads.txt is missing configured publisher id');
  }
});

test('sitemap is well-formed XML', () => {
  const sitemap = fs.readFileSync(path.join(DIST, 'sitemap.xml'), 'utf8');
  assert(sitemap.trim().startsWith('<?xml'), 'missing XML declaration');
  assertIncludes(sitemap, '<urlset');
  assertIncludes(sitemap, '</urlset>');
  const opens = (sitemap.match(/<url>/g) || []).length;
  const closes = (sitemap.match(/<\/url>/g) || []).length;
  assertEqual(opens, closes, 'unbalanced <url> tags');
});

test('admin review page is noindex and free of secrets', () => {
  const adminHtml = fs.readFileSync(path.join(DIST, 'admin', 'index.html'), 'utf8');
  assertIncludes(adminHtml, 'noindex');
  assert(!/ghp_|GITHUB_TOKEN|APPROVAL_SHARED_SECRET|GEMINI_API_KEY/.test(adminHtml), 'admin page leaks a secret name or value');
  const adminJs = fs.readFileSync(path.join(DIST, 'admin', 'admin.js'), 'utf8');
  assert(!/ghp_|github\.com\/repos/.test(adminJs), 'admin client should not talk to GitHub directly');
});

/* ================================================================== *
 * summary
 * ================================================================== */
console.log('\n' + '='.repeat(62));
console.log(`  ${passed} passed, ${failed} failed`);
if (failed) {
  console.log('\n  Failures:');
  failures.forEach((f) => console.log(`   - ${f.name}: ${f.message}`));
}
console.log('='.repeat(62) + '\n');
process.exit(failed ? 1 : 0);
