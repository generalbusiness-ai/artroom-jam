// Serves the repository on http://127.0.0.1:8080 so the page can load the same
// modules as the clip. TypeScript files are served as JavaScript with their
// types stripped by Node; nothing is built or written to disk.
//   node scripts/serve-page.ts        then open http://127.0.0.1:8080/page/

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { extname, join, normalize, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const port = Number(process.env.PORT ?? 8080);
const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.ts': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/') {
      res.writeHead(302, { location: '/page/' });
      res.end();
      return;
    }
    let path = normalize(join(root, decodeURIComponent(url.pathname)));
    if (path !== root && !path.startsWith(root + sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (url.pathname.endsWith('/')) path = join(path, 'index.html');
    let body: string | Buffer = await readFile(path);
    if (extname(path) === '.ts') body = stripTypeScriptTypes(body.toString('utf8'));
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch (error) {
    res.writeHead(error instanceof URIError || error instanceof TypeError ? 400 : 404);
    res.end(error instanceof URIError || error instanceof TypeError ? 'bad request' : 'not found');
  }
});
server.listen(port, '127.0.0.1', () => {
  const address = server.address();
  console.log(`http://127.0.0.1:${typeof address === 'object' && address ? address.port : port}/page/`);
});
