import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = join(__dirname, '..');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.map': 'application/json',
};

async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = req.url ?? '/';
  let filePath: string;

  if (url.startsWith('/dist/')) {
    filePath = join(projectRoot, url);
  } else {
    const page = url === '/' ? '/index.html' : url;
    filePath = join(__dirname, 'fixtures', page);
  }

  const ext = extname(filePath);
  const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';

  try {
    const data = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found: ' + url);
  }
}

const PORT = 3000;
const server = createServer((req, res) => { handler(req, res); });

server.listen(PORT, () => {
  console.log(`E2E fixture server running at http://localhost:${PORT}`);
});
