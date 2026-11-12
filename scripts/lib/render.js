'use strict';
/**
 * Minimal mustache-style template engine (zero dependencies).
 * Supports: {{escaped}}, {{{raw}}}, {{#if}}/{{else}}/{{/if}},
 *           {{#unless}}/{{/unless}}, {{#each}}/{{/each}}, {{> partial}}
 * Missing variables render as empty strings and are reported by strict mode.
 */
const { escapeHtml } = require('./util');

const TOKEN_RE = /\{\{\{([\s\S]+?)\}\}\}|\{\{([\s\S]+?)\}\}/g;

function resolve(path, ctx, root) {
  const expr = String(path).trim();
  if (!expr) return undefined;
  if (expr === '.' || expr === 'this') {
    if (ctx && typeof ctx === 'object') {
      if ('this' in ctx) return ctx['this'];
      if ('.' in ctx) return ctx['.'];
    }
    return ctx;
  }
  const segments = expr.split('.');
  let current = ctx;
  for (let i = 0; i < segments.length; i += 1) {
    const key = segments[i].trim();
    if (key === 'this' || key === '.') {
      if (current && typeof current === 'object') {
        if ('this' in current) current = current['this'];
        else if ('.' in current) current = current['.'];
      }
      continue;
    }
    if (current === null || current === undefined) break;
    if (typeof current !== 'object') { current = undefined; break; }
    if (!(key in current)) {
      // Fall back to the root context for global values.
      if (root && typeof root === 'object' && key in root && i === 0) { current = root[key]; continue; }
      current = undefined;
      break;
    }
    current = current[key];
  }
  return current;
}

function tokenize(source) {
  const tokens = [];
  let lastIndex = 0;
  let match;
  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(source)) !== null) {
    if (match.index > lastIndex) tokens.push({ type: 'text', value: source.slice(lastIndex, match.index) });
    if (match[1] !== undefined) {
      tokens.push({ type: 'raw', value: match[1].trim() });
    } else {
      const inner = match[2].trim();
      if (inner.startsWith('#each ')) tokens.push({ type: 'each', value: inner.slice(6).trim() });
      else if (inner.startsWith('#if ')) tokens.push({ type: 'if', value: inner.slice(4).trim() });
      else if (inner.startsWith('#unless ')) tokens.push({ type: 'unless', value: inner.slice(8).trim() });
      else if (inner === 'else') tokens.push({ type: 'else' });
      else if (inner.startsWith('/')) tokens.push({ type: 'close', value: inner.slice(1).trim() });
      else if (inner.startsWith('>')) tokens.push({ type: 'partial', value: inner.slice(1).trim() });
      else tokens.push({ type: 'var', value: inner });
    }
    lastIndex = TOKEN_RE.lastIndex;
  }
  if (lastIndex < source.length) tokens.push({ type: 'text', value: source.slice(lastIndex) });
  return tokens;
}

function parse(tokens) {
  const root = { children: [] };
  const stack = [root];
  for (const token of tokens) {
    const parent = stack[stack.length - 1];
    if (token.type === 'if' || token.type === 'each' || token.type === 'unless') {
      const node = { type: token.type, expr: token.value, children: [], otherwise: [] };
      parent.children.push(node);
      stack.push(node);
    } else if (token.type === 'else') {
      // Switch collection target to `otherwise` of the nearest block.
      const node = stack[stack.length - 1];
      if (node.children && node.type === 'if') {
        node.inElse = true;
        stack.push({ type: 'elseTarget', children: node.otherwise, parent: node, isElse: true });
      }
    } else if (token.type === 'close') {
      // Pop until the matching block (handles elseTarget frames).
      while (stack.length > 1) {
        const popped = stack.pop();
        if (popped.type === 'if' || popped.type === 'each' || popped.type === 'unless') break;
      }
    } else {
      parent.children.push(token);
    }
  }
  return root.children;
}

function renderNodes(nodes, ctx, root, partials, missing) {
  let out = '';
  for (const node of nodes) {
    if (node.type === 'text') { out += node.value; continue; }
    if (node.type === 'elseTarget') { continue; }
    if (node.type === 'var' || node.type === 'raw') {
      const value = resolve(node.value, ctx, root);
      if (value === undefined && missing) missing.add(node.value);
      const str = value === undefined || value === null ? '' : value;
      out += node.type === 'raw' ? String(str) : escapeHtml(str);
      continue;
    }
    if (node.type === 'partial') {
      const partialSource = partials[node.value];
      if (partialSource === undefined) {
        if (missing) missing.add(`partial:${node.value}`);
        continue;
      }
      out += render(partialSource, ctx, partials, { root, missing });
      continue;
    }
    if (node.type === 'if') {
      const value = resolve(node.expr, ctx, root);
      const truthy = Array.isArray(value) ? value.length > 0 : Boolean(value);
      out += renderNodes(truthy ? node.children : node.otherwise, ctx, root, partials, missing);
      continue;
    }
    if (node.type === 'unless') {
      const value = resolve(node.expr, ctx, root);
      const truthy = Array.isArray(value) ? value.length > 0 : Boolean(value);
      out += truthy ? '' : renderNodes(node.children, ctx, root, partials, missing);
      continue;
    }
    if (node.type === 'each') {
      const list = resolve(node.expr, ctx, root);
      if (Array.isArray(list)) {
        list.forEach((item, index) => {
          const isObj = item !== null && typeof item === 'object';
          const val = isObj ? (item.text || item.label || item.claim || item.note || item.value || item) : item;
          const scoped = isObj
            ? Object.assign(Object.create(null), ctx && typeof ctx === 'object' ? ctx : {}, item, {
                this: val,
                '.': val,
                '@index': index,
                '@first': index === 0,
                '@last': index === list.length - 1
              })
            : Object.assign(Object.create(null), ctx && typeof ctx === 'object' ? ctx : {}, {
                this: item,
                '.': item,
                text: item,
                '@index': index,
                '@first': index === 0,
                '@last': index === list.length - 1
              });
          out += renderNodes(node.children, scoped, root, partials, missing);
        });
      }
      out += renderNodes(node.otherwise, ctx, root, partials, missing);
      continue;
    }
  }
  return out;
}

function render(source, ctx = {}, partials = {}, options = {}) {
  const ast = parse(tokenize(String(source || '')));
  const missing = options.missing || null;
  return renderNodes(ast, ctx, options.root || ctx, partials, missing);
}

module.exports = { render, parse, tokenize };
