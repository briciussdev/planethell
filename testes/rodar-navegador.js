/* Sobe o site (porta 8787) e o servidor simulado (8788) e roda o teste de navegador nos dois modos.
   npm test   — ou —   node testes/rodar-navegador.js */
const { spawn } = require('child_process'), http = require('http'), fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.webp': 'image/webp', '.json': 'application/json' };
const site = http.createServer((q, r) => {
  let f = path.join(raiz, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html';
  if (!f.startsWith(raiz) || !fs.existsSync(f)) { r.statusCode = 404; return r.end(); }
  r.setHeader('Content-Type', tipos[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(r);
}).listen(8787, '127.0.0.1');
const back = spawn(process.execPath, [path.join(__dirname, 'servidor-simulado.js'), '8788'], { stdio: 'ignore' });
function rodar(modo) { return new Promise(ok => spawn(process.execPath, [path.join(__dirname, 'navegador.test.mjs'), modo], { stdio: 'inherit' }).on('exit', ok)); }
setTimeout(async () => {
  const a = await rodar('local'), b = await rodar('servidor');
  back.kill(); site.close(); process.exit(a || b ? 1 : 0);
}, 600);
