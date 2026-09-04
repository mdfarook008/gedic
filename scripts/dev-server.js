const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const preferredPort = Number(process.env.PORT) || 4173;
const lastPort = preferredPort + 10;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  let target = path.resolve(root, relative);

  if (!target.startsWith(root + path.sep) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
    target = path.join(root, 'index.html');
  }

  response.writeHead(200, {
    'Content-Type': types[path.extname(target)] || 'application/octet-stream',
    'Cache-Control': 'no-store'
  });
  fs.createReadStream(target).pipe(response);
});

let activePort = preferredPort;

server.on('error', error => {
  if (error.code === 'EADDRINUSE' && activePort < lastPort) {
    const occupiedPort = activePort;
    activePort += 1;
    console.warn(`Port ${occupiedPort} is already in use; trying ${activePort}…`);
    setTimeout(() => server.listen(activePort, '127.0.0.1'), 50);
    return;
  }

  console.error(`Unable to start GEDIC: ${error.message}`);
  process.exitCode = 1;
});

server.on('listening', () => {
  console.log(`GEDIC is running at http://127.0.0.1:${activePort}`);
  console.log('Press Ctrl+C to stop the server.');
});

server.listen(activePort, '127.0.0.1');
