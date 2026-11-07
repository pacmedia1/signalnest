#!/usr/bin/env node
'use strict';
/** Zero-dependency static preview server for dist/, emulating Vercel cleanUrls. */
const http = require('http');
const fs = require('fs');
const path = require('path');

const DIST = path.resolve(__dirname, '..', 'dist');
const PORT = parseInt(process.env.PORT || '4173', 10);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2'
};

if (!fs.existsSync(DIST)) {
  console.error('dist/ does not exist. Run: npm run build');
  process.exit(1);
}

function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  const safe = path.normalize(clean).replace(/^(\.\.[/\\])+/, '');
  const target = path.join(DIST, safe);

  if (target !== DIST && !target.startsWith(DIST + path.sep)) return null; // traversal attempt

  if (fs.existsSync(target)) {
    const stat = fs.statSync(target);
    if (stat.isDirectory()) {
      const index = path.join(target, 'index.html');
      if (fs.existsSync(index)) return index;
      return null;
    }
    return target;
  }
  // cleanUrls: /articles/slug -> /articles/slug.html
  const asHtml = `${target}.html`;
  if (fs.existsSync(asHtml)) return asHtml;
  return null;
}

const server = http.createServer((request, response) => {
  const file = resolveFile(request.url || '/');
  if (!file) {
    const notFound = path.join(DIST, '404.html');
    response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(fs.existsSync(notFound) ? fs.readFileSync(notFound) : 'Not found');
    return;
  }
  const ext = path.extname(file).toLowerCase();
  response.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=60',
    'X-Content-Type-Options': 'nosniff'
  });
  fs.createReadStream(file).pipe(response);
});

server.listen(PORT, () => {
  console.log(`SignalNest preview: http://localhost:${PORT}`);
  console.log('  /                  homepage');
  console.log('  /articles/<slug>   article page');
  console.log('  /categories/<slug> category page');
  console.log('  /search            search');
  console.log('  /admin             editorial review UI (needs the approval service)');
});
