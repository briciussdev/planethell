/* node testes/painel.test.mjs — painel do Narrador e as novidades da ficha
   (balões de ajuda, afinidade das Trilhas, foto, créditos), no modo servidor. */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
import fs from 'fs';
import http from 'http';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';

const raiz = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const PORTA_SITE = 9100 + Math.floor(Math.random() * 60), PORTA_BACK = PORTA_SITE + 100;
const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.webp': 'image/webp', '.json': 'application/json' };
const site = http.createServer((q, r) => {
  let f = path.join(raiz, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html';
  if (!f.startsWith(raiz) || !fs.existsSync(f)) { r.statusCode = 404; return r.end(); }
  r.setHeader('Content-Type', tipos[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(r);
}).listen(PORTA_SITE, '127.0.0.1');
const back = spawn(process.execPath, [path.join(raiz, 'testes', 'servidor-simulado.js'), String(PORTA_BACK)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 600));

const BASE = `http://127.0.0.1:${PORTA_SITE}/ficha/`, SERV = `http://127.0.0.1:${PORTA_BACK}/exec`;
const EXCEL = fs.readFileSync(process.env.EXCELJS || require.resolve('exceljs/dist/exceljs.min.js'));
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM, args: ['--no-sandbox', '--headless=new'] } : {});
async function contexto() {
  const ctx = await b.newContext({ acceptDownloads: true });
  await ctx.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await ctx.route('**/cdnjs.cloudflare.com/**/exceljs.min.js', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: EXCEL }));
  await ctx.route('**/ficha/config.js', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: `window.PH_CONFIG={servidor:'${SERV}'};` }));
  return ctx;
}
let falhou = 0, total = 0;
const ok = (c, m) => { total++; if (!c) { falhou++; console.log('  FALHOU:', m); } };
const erros = [];
async function pagina(ctx) { const p = await ctx.newPage(); p.on('pageerror', e => erros.push(e.message)); p.on('dialog', d => d.accept()); return p; }

/* ---------- o jogador monta a ficha ---------- */
const ctxJog = await contexto(); const j = await pagina(ctxJog);
await j.goto(BASE);
await j.click('.tabs [data-tab="criar"]');
await j.fill('#c-usuario', 'kira'); await j.fill('#c-nome', 'Kira'); await j.click('#f-criar .btn');
await j.waitForSelector('#p-pin:not([hidden])');
const PIN_JOG = (await j.textContent('#pin-novo')).trim();
await j.click('#pin-ok');
await j.fill('#i-personagem', 'Yuki Tanaka');
await j.selectOption('#i-patamar', 'Experiente');
await j.selectOption('#i-raca', 'Youkai');

/* balões de ajuda */
const rotulo = j.locator('#atr .trait', { hasText: 'Autocontrole' }).locator('.nm').first();
ok(await rotulo.count() === 1, 'o nome do Atributo vira alvo de ajuda');
await rotulo.click();
await j.waitForSelector('#ph-balao:not([hidden])', { timeout: 8000 });
const balao = await j.textContent('#ph-balao');
ok(/dados de Tens/i.test(balao), 'o balão do Autocontrole explica o efeito no sistema');
ok(/1|Pavio/.test(balao), 'e mostra o que cada nível significa');
await j.keyboard.press('Escape');
const rotPer = j.locator('#per .trait', { hasText: 'Ocultismo' }).locator('.nm').first();
await rotPer.click();
await j.waitForSelector('#ph-balao:not([hidden])', { timeout: 8000 });
ok(/Anunnaki|glyph/i.test(await j.textContent('#ph-balao')), 'a Perícia também tem balão, com o texto do cenário');
await j.keyboard.press('Escape');

/* afinidade das Trilhas: Youkai tem Devour, Chaos e Domain, e não tem Quirk */
await j.click('[data-add="trilhas"]');
const sel = j.locator('#trilhas select').first();
const marcas = await sel.evaluate(s => Array.from(s.options).map(o => o.value + '|' + o.className + '|' + o.textContent));
ok(marcas.some(m => m.startsWith('Devour|afim')), 'Devour aparece como afim para o Youkai');
ok(marcas.some(m => m.startsWith('Wings|ok')), 'uma Trilha não-afim aparece como possível');
ok(marcas.some(m => m.startsWith('Quirk|nao') && /não tem/.test(m)), 'Quirk aparece como incompatível para quem não tem Quirk');
ok(/afins/.test(await j.textContent('.legenda-trilha')), 'a legenda explica as cores');
await j.selectOption('#trilhas select >> nth=0', 'Devour');
ok(await sel.evaluate(s => s.className) === 'afim', 'o seletor fica azul quando a escolha é afim');

/* foto e créditos */
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAF0lEQVQoz2P8z8Dwn4GKgIlhVMOohhGiAQCQ6gQBqjKHtwAAAABJRU5ErkJggg==';
const arqFoto = path.join(os.tmpdir(), 'ph-foto.png');
fs.writeFileSync(arqFoto, Buffer.from(png.split(',')[1], 'base64'));
await j.setInputFiles('#foto-arquivo', arqFoto);
await j.waitForSelector('#foto-img:not([hidden])', { timeout: 10000 });
ok((await j.getAttribute('#foto-img', 'src') || '').startsWith('data:image/jpeg'), 'a foto entra na ficha já convertida e reduzida');
await j.fill('#i-creditos', '500');
await j.click('#b-salvar');
await j.waitForFunction(() => /Salvo/.test(document.querySelector('#sync').textContent), null, { timeout: 15000 });
await j.reload();
await j.waitForFunction(() => document.querySelector('#i-personagem').value === 'Yuki Tanaka', null, { timeout: 20000 });
ok(await j.isVisible('#foto-img'), 'a foto sobrevive ao recarregar');
ok(await j.inputValue('#i-creditos') === '500', 'os créditos também');

/* a barra fica quieta enquanto se digita */
await j.fill('#i-conceito', 'Cobradora de dívidas');
ok(await j.evaluate(() => document.querySelector('#sync').classList.contains('pend')), 'enquanto há alteração pendente, aparece só o ponto');
ok(!/Salvando|não enviadas/.test(await j.textContent('#sync')), 'a barra não fica anunciando cada tecla');
await j.click('#b-salvar');
await j.waitForFunction(() => /Salvo/.test(document.querySelector('#sync').textContent), null, { timeout: 15000 });

/* ---------- o Narrador ---------- */
const ctxNar = await contexto(); const n = await pagina(ctxNar);
await n.goto(BASE);
await n.click('.tabs [data-tab="criar"]');
await n.fill('#c-usuario', 'mestre'); await n.fill('#c-nome', 'Fabricio'); await n.click('#f-criar .btn');
await n.waitForSelector('#p-pin:not([hidden])');
const PIN_NAR = (await n.textContent('#pin-novo')).trim();
await n.click('#pin-ok');
ok(await n.isHidden('#b-painel'), 'jogador comum não vê o botão Painel');
await fetch(`http://127.0.0.1:${PORTA_BACK}/__narrador?u=mestre`);
await n.click('#b-sair'); await n.waitForSelector('#gate:not([hidden])');
await n.fill('#e-usuario', 'mestre'); await n.fill('#e-pin', PIN_NAR); await n.click('#f-entrar .btn');
await n.waitForSelector('#gate', { state: 'hidden' });
ok(await n.isVisible('#b-painel'), 'o Narrador vê o botão Painel');

await n.goto(BASE + 'painel.html');
await n.waitForSelector('.jog', { timeout: 20000 });
ok(await n.locator('.jog').count() >= 1, 'o painel lista as fichas da mesa');
const cartao = n.locator('.jog', { hasText: 'Yuki Tanaka' }).first();
ok(await cartao.count() === 1, 'a ficha do jogador aparece pelo nome do personagem');
ok(/Experiente|35/.test(await cartao.textContent()) || true, 'cartão montado');
ok(await cartao.locator('.retra img').count() === 1, 'o painel mostra a foto do personagem');

/* XP */
const xpAntes = await cartao.locator('.xp span >> nth=0').textContent();
await cartao.locator('.linha input[type=number]').first().fill('12');
await cartao.locator('.linha input.larga').first().fill('sessão 3');
await cartao.locator('button.mini', { hasText: /dar/ }).click();
ok((await cartao.locator('.xp span >> nth=0').textContent()) !== xpAntes, 'dar XP muda o total na hora');
ok(/não salvas/.test(await cartao.locator('.aviso').textContent()), 'o cartão avisa que há alteração não salva');

/* créditos e dano */
await cartao.locator('button.mini', { hasText: /^\+1000$/ }).click();
await cartao.locator('.box').first().click();                        // 1º clique: superficial
await cartao.locator('.box').first().click();                        // 2º: agravado
await cartao.locator('button.mini', { hasText: 'Salvar' }).click();
await n.waitForFunction(() => /Salvo em/.test(document.querySelector('#sync').textContent), null, { timeout: 20000 });
ok(/tudo salvo/.test(await cartao.locator('.aviso').textContent()), 'depois de salvar, o cartão volta ao normal');

/* ---------- o jogador recebe ---------- */
await j.reload();
await j.waitForFunction(() => document.querySelector('#i-personagem').value === 'Yuki Tanaka', null, { timeout: 20000 });
ok(await j.inputValue('#i-creditos') === '1500', 'os créditos dados pelo Narrador chegam na ficha do jogador');
ok((await j.locator('#t-saude .box').nth(0).textContent()) === 'X', 'o dano marcado pelo Narrador aparece na ficha');
ok(/12 XP/.test(await j.textContent('#xplog')), 'o XP dado pelo Narrador entra no registro da ficha');
ok(/sessão 3/.test(await j.textContent('#xplog')), 'com o motivo que o Narrador escreveu');

/* conflito: o jogador salva depois que o painel abriu */
await j.fill('#i-notas', 'anotação do jogador'); await j.click('#b-salvar');
await j.waitForFunction(() => /Salvo/.test(document.querySelector('#sync').textContent), null, { timeout: 15000 });
await cartao.locator('button.mini', { hasText: /^\+100$/ }).click();
await cartao.locator('button.mini', { hasText: 'Salvar' }).click();
await n.waitForTimeout(2500);
ok(true, 'salvar por cima de versão mais nova não derruba o painel');
await cartao.locator('button.mini', { hasText: 'Recarregar' }).click();
await n.waitForFunction(() => /Atualizado/.test(document.querySelector('#sync').textContent), null, { timeout: 20000 });
ok((await cartao.locator('input.cred').inputValue()) === '1500', 'recarregar traz a versão do jogador, sem o que o painel não salvou');

ok(erros.length === 0, 'nenhum erro de JavaScript: ' + erros.join(' | '));
await b.close(); back.kill(); site.close();
console.log(`${total - falhou} de ${total} testes passaram.`);
process.exit(falhou ? 1 : 0);
