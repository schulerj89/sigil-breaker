/* global console, process, URL */

import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

const distRoot = resolve('dist');
const basePath = '/sigil-breaker/';
const port = Number.parseInt(process.env.PORT ?? '4173', 10);
const host = process.env.HOST ?? '127.0.0.1';

if (!existsSync(join(distRoot, 'index.html'))) {
  throw new Error('Missing dist/index.html. Run npm run build before starting the Pages preview server.');
}

const server = createServer((request, response) => {
  const requestUrl = new URL(request.url ?? '/', `http://${host}:${port}`);
  const pathname = decodeURIComponent(requestUrl.pathname);

  if (pathname === '/sigil-breaker') {
    response.writeHead(308, { Location: basePath });
    response.end();
    return;
  }

  if (!pathname.startsWith(basePath)) {
    sendText(response, 404, 'Not found');
    return;
  }

  const relativePath = pathname.slice(basePath.length);
  const candidate = resolve(distRoot, relativePath || 'index.html');
  const filePath = getServableFile(candidate);

  if (!filePath) {
    sendFile(response, join(distRoot, 'index.html'));
    return;
  }

  sendFile(response, filePath);
});

server.listen(port, host, () => {
  console.log(`Pages preview serving ${distRoot} at http://${host}:${port}${basePath}`);
});

function getServableFile(candidate) {
  const normalized = normalize(candidate);
  if (!normalized.startsWith(distRoot + sep) && normalized !== distRoot) {
    return null;
  }

  if (!existsSync(normalized)) {
    return null;
  }

  const stats = statSync(normalized);
  if (stats.isDirectory()) {
    const indexPath = join(normalized, 'index.html');
    return existsSync(indexPath) ? indexPath : null;
  }

  return stats.isFile() ? normalized : null;
}

function sendFile(response, filePath) {
  response.writeHead(200, {
    'Content-Type': contentTypeFor(filePath),
    'Cache-Control': 'no-store',
  });
  createReadStream(filePath).pipe(response);
}

function sendText(response, status, text) {
  response.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(text);
}

function contentTypeFor(filePath) {
  switch (extname(filePath)) {
    case '.css':
      return 'text/css; charset=utf-8';
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.glb':
      return 'model/gltf-binary';
    case '.png':
      return 'image/png';
    case '.svg':
      return 'image/svg+xml';
    case '.txt':
      return 'text/plain; charset=utf-8';
    default:
      return 'application/octet-stream';
  }
}
