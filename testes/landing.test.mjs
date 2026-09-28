/* node testes/landing.test.mjs — a landing page: guia inteiro, rolador e balões de ajuda. */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
import fs from 'fs';
import http from 'http';
import path from 'path';

const raiz = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const PORTA = 9300 + Math.floor(Math.random() * 60);
const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.webp': 'image/webp' };
const site = http.createServer((q, r) => {
  let f = path.join(raiz, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html';
  if (!f.startsWith(raiz) || !fs.existsSync(f)) { r.statusCode = 404; return r.end(); }
  r.setHeader('Content-Type', tipos[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(r);
}).listen(PORTA, '127.0.0.1');

let falhou = 0, total = 0;
const ok = (c, m) => { total++; if (!c) { falhou++; console.log('  FALHOU:', m); } };
const erros = [];
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM, args: ['--no-sandbox', '--headless=new'] } : {});
const p = await b.newPage();
p.on('pageerror', e => erros.push(e.message));
await p.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await p.goto(`http://127.0.0.1:${PORTA}/`);
await p.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });

ok(await p.locator('#prose h2').count() >= 16, 'o guia inteiro está na página');
ok(await p.locator('a[href="ficha/"]').count() >= 1, 'a landing aponta para a ficha');
ok(await p.locator('.ajuda').count() >= 25, 'os nomes de Atributos e Perícias viram alvo de ajuda: ' + await p.locator('.ajuda').count());

const alvo = p.locator('#prose .ajuda', { hasText: 'Autocontrole' }).first();
await alvo.scrollIntoViewIfNeeded(); await p.waitForTimeout(250);
await alvo.click();
await p.waitForSelector('#ph-balao:not([hidden])', { timeout: 8000 });
const txt = await p.textContent('#ph-balao');
ok(/Tens/i.test(txt), 'o balão do Autocontrole fala dos dados de Tensão');
ok(/Pavio|Gelo/.test(txt), 'e lista o que cada nível significa');
await alvo.click();
await p.waitForTimeout(300);
ok(await p.evaluate(() => document.getElementById('ph-balao').hidden), 'clicar de novo fecha o balão');

const per = p.locator('#prose .ajuda', { hasText: 'Ofícios' }).first();
await per.scrollIntoViewIfNeeded(); await p.waitForTimeout(250);
await per.click();
await p.waitForSelector('#ph-balao:not([hidden])', { timeout: 8000 });
ok(/implante|Mecha/i.test(await p.textContent('#ph-balao')), 'a Perícia explica o que cobre no cenário');

/* o rolador da landing continua funcionando */
await p.locator('#r-go').scrollIntoViewIfNeeded();
await p.click('#r-go');
await p.waitForTimeout(300);
ok(await p.locator('#r-tray .die').count() >= 1, 'o rolador da landing rola os dados');

/* celular */
const cel = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
const m = await cel.newPage();
await m.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await m.goto(`http://127.0.0.1:${PORTA}/`);
const folga = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok(folga <= 2, 'sem rolagem lateral no celular (folga de ' + folga + 'px)');

ok(erros.length === 0, 'nenhum erro de JavaScript: ' + erros.join(' | '));
await b.close(); site.close();
console.log(`${total - falhou} de ${total} testes passaram.`);
process.exit(falhou ? 1 : 0);
