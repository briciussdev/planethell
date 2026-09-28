/* node testes/resgate.test.mjs — testa a página de resgate: monta uma ficha em modo local, depois troca o site para modo servidor
   (como vai acontecer de verdade) e confere que a página ainda acha e baixa a ficha antiga. */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
import fs from 'fs';
import http from 'http';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';

const raiz = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const PORTA_SITE = 8900 + Math.floor(Math.random() * 60), PORTA_BACK = PORTA_SITE + 100;
const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.webp': 'image/webp', '.json': 'application/json' };
const site = http.createServer((q, r) => {
  let f = path.join(raiz, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html';
  if (!f.startsWith(raiz) || !fs.existsSync(f)) { r.statusCode = 404; return r.end(); }
  r.setHeader('Content-Type', tipos[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(r);
}).listen(PORTA_SITE, '127.0.0.1');
const back = spawn(process.execPath, [path.join(raiz, 'testes', 'servidor-simulado.js'), String(PORTA_BACK)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 600));

const BASE = `http://127.0.0.1:${PORTA_SITE}/ficha/`, SERV = `http://127.0.0.1:${PORTA_BACK}/exec`;
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM, args: ['--no-sandbox', '--headless=new'] } : {});
const ctx = await b.newContext({ acceptDownloads: true });
await ctx.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
let modoServidor = false;
await ctx.route('**/ficha/config.js', r => r.fulfill({ status: 200, contentType: 'application/javascript',
  body: modoServidor ? `window.PH_CONFIG={servidor:'${SERV}'};` : 'window.PH_CONFIG={servidor:""};' }));
const p = await ctx.newPage();
p.on('pageerror', e => console.log('ERRO JS:', e.message));
p.on('dialog', d => d.accept());

let falhou = 0, total = 0;
const ok = (c, m) => { total++; if (!c) { falhou++; console.log('  FALHOU:', m); } };

/* 1) modo local, como está hoje no ar */
await p.goto(BASE);
await p.click('.tabs [data-tab="criar"]');
await p.fill('#c-usuario', 'lucia'); await p.fill('#c-nome', 'Lu'); await p.click('#f-criar .btn');
await p.waitForSelector('#p-pin:not([hidden])'); await p.click('#pin-ok');
await p.fill('#i-personagem', 'Yuki Tanaka'); await p.selectOption('#i-raca', 'Youkai'); await p.fill('#i-conceito', 'Cobradora de dívidas');
await p.click('#b-salvar');
await p.waitForFunction(() => /Salvo/.test(document.querySelector('#sync').textContent), null, { timeout: 15000 });
ok(true, 'ficha montada no modo local');

/* 2) o Narrador liga a planilha: config.js passa a apontar para o servidor */
modoServidor = true;
await p.goto(BASE + 'resgate.html');
await p.waitForSelector('.achados li', { timeout: 15000 });
ok(await p.locator('.achados li').count() >= 1, 'a página de resgate acha a ficha antiga mesmo depois da troca');
ok(/Yuki Tanaka/.test(await p.textContent('.achados li .pers')), 'mostra o nome do personagem');
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('.achados li .btn')]);
const arq = path.join(os.tmpdir(), 'PlanetHell-resgatada.json');
await dl.saveAs(arq);
ok(dl.suggestedFilename() === 'PlanetHell-Yuki-Tanaka.json', 'nome do arquivo: ' + dl.suggestedFilename());
const dados = JSON.parse(fs.readFileSync(arq, 'utf8'));
ok(dados.ficha && dados.ficha.id.personagem === 'Yuki Tanaka' && dados.ficha.raca === 'Youkai' && dados.ficha.id.conceito === 'Cobradora de dívidas', 'o arquivo tem a ficha inteira');

/* 3) e o arquivo volta para dentro da ficha nova, agora no modo servidor */
await p.goto(BASE);
await p.waitForSelector('#gate:not([hidden])', { timeout: 15000 });
await p.click('.tabs [data-tab="criar"]');
await p.fill('#c-usuario', 'lucia2'); await p.fill('#c-nome', 'Lu'); await p.click('#f-criar .btn');
await p.waitForSelector('#p-pin:not([hidden])'); await p.click('#pin-ok');
await p.click('#b-json'); await p.waitForSelector('#modal:not([hidden])');
await p.setInputFiles('#arquivo', arq);
await p.waitForFunction(() => document.querySelector('#i-personagem').value === 'Yuki Tanaka', null, { timeout: 15000 });
ok(await p.inputValue('#i-raca') === 'Youkai' && await p.inputValue('#i-conceito') === 'Cobradora de dívidas', 'a ficha resgatada entra inteira na conta nova');
await p.waitForFunction(() => /Salvo/.test(document.querySelector('#sync').textContent), null, { timeout: 20000 });
await p.reload();
await p.waitForFunction(() => document.querySelector('#i-personagem').value === 'Yuki Tanaka', null, { timeout: 20000 });
ok(true, 'e fica salva no servidor: sobrevive ao recarregar');

/* 4) navegador sem nada guardado: a página avisa em vez de ficar em silêncio */
const limpo = await b.newContext();
const q = await limpo.newPage();
await q.goto(BASE + 'resgate.html');
await q.waitForSelector('.aviso', { timeout: 15000 });
ok(/Nenhuma ficha encontrada/.test(await q.textContent('.aviso')), 'navegador sem fichas recebe aviso claro');

await b.close(); back.kill(); site.close();
console.log(`${total - falhou} de ${total} testes passaram.`);
process.exit(falhou ? 1 : 0);
