'use strict';
/**
 * Builders for n8n workflow JSON. Keeps the four workflow files structurally
 * consistent and re-generatable instead of hand-edited.
 */
const crypto = require('crypto');

let nodeCounter = 0;
function nextId() {
  nodeCounter += 1;
  return crypto.createHash('sha1').update(`signalnest-node-${nodeCounter}`).digest('hex').slice(0, 36);
}

function node(name, type, typeVersion, parameters, position, extra) {
  return Object.assign({
    parameters: parameters || {},
    id: nextId(),
    name,
    type,
    typeVersion,
    position: position || [0, 0]
  }, extra || {});
}

/* Shorthand constructors ------------------------------------------------- */
const triggers = {
  schedule(name, every, pos) {
    return node(name, 'n8n-nodes-base.scheduleTrigger', 1.2, {
      rule: { interval: [Object.assign({ field: 'cronExpression' }, { expression: every })] }
    }, pos);
  },
  scheduleCron(name, cron, pos) {
    return node(name, 'n8n-nodes-base.scheduleTrigger', 1.2, {
      rule: { interval: [{ field: 'cronExpression', expression: cron }] }
    }, pos);
  },
  manual(name, pos) {
    return node(name, 'n8n-nodes-base.manualTrigger', 1, {}, pos);
  },
  webhook(name, path, method, pos, options) {
    return node(name, 'n8n-nodes-base.webhook', 2, Object.assign({
      path,
      httpMethod: method,
      responseMode: 'responseNode',
      options: { rawBody: false }
    }, options || {}), pos);
  }
};

const actions = {
  code(name, jsCode, pos) {
    return node(name, 'n8n-nodes-base.code', 2, { jsCode, mode: 'runOnceForAllItems' }, pos);
  },
  http(name, config, pos) {
    const params = {
      method: config.method || 'GET',
      url: config.url,
      authentication: config.authentication || 'none',
      options: Object.assign({
        timeout: config.timeout || 30000,
        response: { response: { fullResponse: config.fullResponse !== false, neverError: config.neverError !== false } }
      }, config.options || {})
    };
    if (config.authentication === 'predefinedCredentialType') {
      params.nodeCredentialType = config.nodeCredentialType;
    }
    if (config.authentication === 'genericCredentialType') {
      params.genericAuthType = config.genericAuthType;
    }
    if (config.sendHeaders) {
      params.sendHeaders = true;
      params.headerParameters = { parameters: config.headers || [] };
    }
    if (config.body !== undefined) {
      params.sendBody = true;
      params.specifyBody = 'json';
      params.jsonBody = config.body;
    }
    return node(name, 'n8n-nodes-base.httpRequest', 4.2, params, pos, config.onError ? { onError: config.onError } : undefined);
  },
  ifNode(name, conditions, pos) {
    return node(name, 'n8n-nodes-base.if', 2.2, {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: conditions.map((c, index) => ({
          id: `cond-${index + 1}`,
          leftValue: c.left,
          rightValue: c.right === undefined ? '' : c.right,
          operator: { type: c.type || 'boolean', operation: c.operation || 'true', singleValue: c.singleValue !== false }
        })),
        combinator: 'and'
      },
      options: {}
    }, pos);
  },
  noOp(name, pos) {
    return node(name, 'n8n-nodes-base.noOp', 1, {}, pos);
  },
  respond(name, bodyExpression, statusCode, pos) {
    return node(name, 'n8n-nodes-base.respondToWebhook', 1.1, {
      respondWith: 'json',
      responseBody: bodyExpression,
      options: { responseCode: statusCode || 200 }
    }, pos);
  },
  telegram(name, textExpression, pos) {
    return node(name, 'n8n-nodes-base.telegram', 1.2, {
      chatId: '={{ $env.TELEGRAM_CHAT_ID }}',
      text: textExpression,
      additionalFields: { parse_mode: 'HTML', disable_web_page_preview: true }
    }, pos, { onError: 'continueRegularOutput' });
  },
  wait(name, seconds, pos) {
    return node(name, 'n8n-nodes-base.wait', 1.1, { amount: seconds, unit: 'seconds' }, pos, { webhookId: crypto.randomUUID() });
  }
};

function connections(map) {
  const out = {};
  Object.keys(map).forEach((from) => {
    const targets = map[from];
    out[from] = {
      main: Array.isArray(targets[0])
        ? targets
        : [targets.map((to) => ({ node: to, type: 'main', index: 0 }))]
    };
  });
  return out;
}

/* --------------------------------------------------------------------- *
 * Shared JS embedded inside Code nodes.
 * Written to be plain ES2020 with no Node-only APIs except Buffer-free
 * base64, so it runs in the n8n Code sandbox and in a normal Node test.
 * --------------------------------------------------------------------- */
const B64_SNIPPET = `
/* UTF-8 safe base64 (no Buffer / btoa dependency). */
function base64Encode(input) {
  var CH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var str = String(input === undefined || input === null ? '' : input);
  var bytes = [];
  for (var i = 0; i < str.length; i++) {
    var code = str.codePointAt(i);
    if (code > 0xffff) i++;
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
  }
  var out = '';
  for (var j = 0; j < bytes.length; j += 3) {
    var b0 = bytes[j], b1 = bytes[j + 1], b2 = bytes[j + 2];
    out += CH[b0 >> 2];
    out += CH[((b0 & 3) << 4) | ((b1 || 0) >> 4)];
    out += b1 === undefined ? '=' : CH[((b1 & 15) << 2) | ((b2 || 0) >> 6)];
    out += b2 === undefined ? '=' : CH[b2 & 63];
  }
  return out;
}

function base64Decode(input) {
  var CH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var clean = String(input || '').replace(/[^A-Za-z0-9+/=]/g, '');
  var bytes = [];
  for (var i = 0; i < clean.length; i += 4) {
    var c0 = CH.indexOf(clean[i]), c1 = CH.indexOf(clean[i + 1]);
    var c2 = CH.indexOf(clean[i + 2]), c3 = CH.indexOf(clean[i + 3]);
    if (c0 < 0 || c1 < 0) break;
    bytes.push((c0 << 2) | (c1 >> 4));
    if (c2 >= 0) bytes.push(((c1 & 15) << 4) | (c2 >> 2));
    if (c3 >= 0) bytes.push(((c2 & 3) << 6) | c3);
  }
  var out = '';
  for (var k = 0; k < bytes.length;) {
    var b = bytes[k];
    if (b < 0x80) { out += String.fromCharCode(b); k += 1; }
    else if (b < 0xe0) { out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[k + 1] & 0x3f)); k += 2; }
    else if (b < 0xf0) { out += String.fromCharCode(((b & 0x0f) << 12) | ((bytes[k + 1] & 0x3f) << 6) | (bytes[k + 2] & 0x3f)); k += 3; }
    else { var cp = ((b & 0x07) << 18) | ((bytes[k + 1] & 0x3f) << 12) | ((bytes[k + 2] & 0x3f) << 6) | (bytes[k + 3] & 0x3f); out += String.fromCodePoint(cp); k += 4; }
  }
  return out;
}
`;

const SLUG_SNIPPET = `
function slugify(input, maxLength) {
  var base = String(input || '')
    .normalize('NFKD').replace(/[\\u0300-\\u036f]/g, '')
    .toLowerCase().replace(/['\u2019"]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
  var trimmed = base.slice(0, maxLength || 80).replace(/-+$/g, '');
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(trimmed) ? trimmed : '';
}
function isValidSlug(slug) {
  return typeof slug === 'string' && slug.length >= 3 && slug.length <= 80 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
}
function stripTags(html) {
  return String(html || '').replace(/<[^>]*>/g, ' ').replace(/\\s+/g, ' ').trim();
}
`;

const GITHUB_HEADERS = [
  { name: 'Authorization', value: '=Bearer {{ $env.GITHUB_TOKEN }}' },
  { name: 'Accept', value: 'application/vnd.github+json' },
  { name: 'X-GitHub-Api-Version', value: '2022-11-28' },
  { name: 'User-Agent', value: 'SignalNest-Automation' }
];

function githubContentsUrl(filePath) {
  return `=https://api.github.com/repos/{{ $env.GITHUB_OWNER }}/{{ $env.GITHUB_REPO }}/contents/${filePath}?ref={{ $env.GITHUB_BRANCH }}`;
}

module.exports = {
  node, nextId, triggers, actions, connections,
  B64_SNIPPET, SLUG_SNIPPET, GITHUB_HEADERS, githubContentsUrl
};
