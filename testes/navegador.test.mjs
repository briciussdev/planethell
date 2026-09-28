/* Teste de ponta a ponta no navegador: cria a Nadia do guia clicando na ficha, confere cálculos e regras,
   salva, recarrega, sai, recupera o PIN, bloqueia após 5 erros, exporta .xlsx e PDF.
   Uso: node testes/navegador.test.mjs [local|servidor]   (sirva a pasta do repositório em :8787) */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
import fs from 'fs';
const MODO = process.argv[2] || 'local';
const BASE = 'http://127.0.0.1:8787/ficha/';
const SERV = 'http://127.0.0.1:8788/exec';
const EXCEL = fs.readFileSync(process.env.EXCELJS || require.resolve('exceljs/dist/exceljs.min.js'));
const TMP = (await import('os')).tmpdir();
let falhou = 0, total = 0;
const ok = (c, m) => { total++; if (!c) { falhou++; console.log('  FALHOU:', m); } };
const erros = [];

const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM, args: ['--no-sandbox', '--headless=new'] } : {});
async function contexto(opts = {}) {
  const ctx = await b.newContext({ acceptDownloads: true, ...opts });
  await ctx.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await ctx.route('**/cdnjs.cloudflare.com/**/exceljs.min.js', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: EXCEL }));
  if (MODO === 'servidor') await ctx.route('**/ficha/config.js', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: `window.PH_CONFIG={servidor:'${SERV}'};` }));
  return ctx;
}
async function pagina(ctx) { const p = await ctx.newPage(); p.on('pageerror', e => erros.push(e.message)); p.on('dialog', d => d.accept()); return p; }
const dot = (p, secao, nome, n) => p.locator(`${secao} .trait`, { hasText: nome }).first().locator('.dot').nth(n - 1).click();

const ctx = await contexto(); let p = await pagina(ctx);
await p.goto(BASE);
ok(await p.isVisible('#gate'), 'abre na tela de entrada');
ok((await p.isVisible('#aviso-local')) === (MODO === 'local'), 'aviso de modo local só no modo local');

/* ---------- criar conta ---------- */
await p.click('.tabs [data-tab="criar"]');
await p.fill('#c-usuario', 'ana_corvo'); await p.fill('#c-nome', 'Ana Silva'); await p.click('#f-criar .btn');
await p.waitForSelector('#m-criar.err'); ok(/primeiro nome/.test(await p.textContent('#m-criar')), 'recusa nome com sobrenome');
await p.fill('#c-nome', 'Ana'); await p.click('#f-criar .btn');
await p.waitForSelector('#p-pin:not([hidden])');
const PIN = (await p.textContent('#pin-novo')).trim(); ok(/^\d{4}$/.test(PIN), 'mostra um PIN de 4 dígitos: ' + PIN);
await p.click('#pin-ok');
ok(!(await p.isVisible('#gate')), 'abre a ficha');
ok(await p.inputValue('#i-jogador') === 'Ana', 'jogador vem da conta');

/* ---------- ficha em branco ---------- */
ok(await p.inputValue('#i-personagem') === '' && await p.inputValue('#i-raca') === '', 'ficha em branco, sem nada pré-preenchido');
ok(await p.locator('#atr .dot.on').count() === 0 && await p.locator('#per .dot.on').count() === 0, 'nenhuma bolinha marcada');
ok(/pendência/.test(await p.textContent('#ck-score')), 'verificação acusa pendências na ficha vazia');

/* ---------- a Nadia do guia, passo a passo ---------- */
await p.fill('#i-personagem', 'Nadia Corvo'); await p.fill('#i-conceito', 'Médica desertora'); await p.fill('#i-idade', '34');
await p.selectOption('#i-patamar', 'Experiente'); await p.selectOption('#i-nacao', 'Meca');
await p.selectOption('#i-raca', 'Cyberpunk');
ok(await p.isVisible('#w-base'), 'Cyberpunk abre o menu de raça-base');
await p.selectOption('#i-base', 'Human');
ok(await p.isVisible('#w-afimbase'), 'Cyberpunk escolhe uma Trilha afim da raça-base');
await p.selectOption('#i-afimbase', 'Bond');
const racaTxt = await p.textContent('#raca-info');
ok(/Maintenance/.test(racaTxt) && /Prey/.test(racaTxt) && /Optimization/.test(racaTxt) && /Survival/.test(racaTxt), 'Trick or Treat acrescenta Falha e Compulsão da raça-base');
ok(/Hard Wired/.test(racaTxt) && /Full Metal Soul/.test(racaTxt), 'mostra Vantagens raciais e a Ascensão');
for (const [a, n] of [['Inteligência', 4], ['Destreza', 3], ['Autocontrole', 3], ['Perseverança', 3], ['Força', 2], ['Vigor', 2], ['Raciocínio', 2], ['Manipulação', 2], ['Presença', 1]]) await dot(p, '#atr', a, n);
for (const [s, n] of [['Medicina', 4], ['Ciências', 3], ['Percepção', 3], ['Empatia', 3], ['Investigação', 3], ['Furtividade', 2], ['Condução', 2], ['Astúcia', 2], ['Armas de Fogo', 1], ['Atletismo', 1], ['Ofícios', 1], ['Erudição', 1]]) await dot(p, '#per', s, n);
ok(/Especialista/.test(await p.textContent('#per-aux')), 'reconhece o perfil Especialista');
for (const [per, nome] of [['Ciências', 'Farmacologia'], ['Ofícios', 'Implantes'], ['Erudição', 'Anatomia das raças'], ['Medicina', 'Trauma de combate']]) {
  await p.click('[data-add="esp"]'); const it = p.locator('#esp .item').last();
  await it.locator('select').selectOption(per); await it.locator('input').fill(nome); await it.locator('input').blur();
}
await p.click('[data-add="trilhas"]'); let tr = p.locator('#trilhas .item').last();
await tr.locator('select').selectOption('Improvement'); tr = p.locator('#trilhas .item').last(); await tr.locator('.dot').nth(1).click();
ok(/AFIM/.test(await p.locator('#trilhas .item').last().textContent()), 'Improvement é afim do Cyberpunk');
await p.click('[data-add="trilhas"]'); tr = p.locator('#trilhas .item').last();
await tr.locator('select').selectOption('Quirk'); tr = p.locator('#trilhas .item').last();
await tr.locator('input').first().fill('STILL'); await tr.locator('input').first().blur();
tr = p.locator('#trilhas .item').last(); await tr.locator('.dot').nth(0).click();
ok(/não sente dor/.test(await p.inputValue('#trilhas .item:last-child .lv input.efeito >> nth=0')), 'Quirk do catálogo preenche os níveis');
for (const [nome, pts] of [['Recursos', '1'], ['Contatos', '2'], ['Refúgio', '2'], ['Aliados', '2']]) {
  await p.click('[data-add="vant"]'); const it = p.locator('#vant .item').last();
  await it.locator('input').first().fill(nome); await it.locator('input').first().blur();
  await p.locator('#vant .item').last().locator('select').selectOption(pts);
}
for (const nome of ['Registro Militar', 'Segredo']) {
  await p.click('[data-add="def"]'); const it = p.locator('#def .item').last();
  await it.locator('input').first().fill(nome); await it.locator('input').first().blur();
}
ok(/7 \/ 7/.test(await p.textContent('#vant-aux')) && /^2 pts/.test(await p.textContent('#def-aux')), 'contadores de Vantagem e Defeito');
await p.click('[data-add="vant"]'); let vx = p.locator('#vant .item').last();
await vx.locator('input').first().fill('Aura de Comando'); await vx.locator('input').first().blur();
ok(/outro sistema/.test(await p.locator('#vant .item').last().textContent()), 'aceita Vantagem de outro sistema');
await p.locator('#vant .item').last().locator('.x').click();
await p.click('[data-add="convic"]'); const cv = p.locator('#convic .item').last();
await cv.locator('input').nth(0).fill('Eu não pergunto de que lado a pessoa está antes de operar.'); await cv.locator('input').nth(1).fill('Sami');
await p.fill('#i-ambicao', 'Sair do registro de desertores sem entregar ninguém'); await p.fill('#i-desejo', 'Conseguir um lote de antibióticos');

/* ---------- derivados ---------- */
const stats = await p.textContent('#stats');
for (const [k, v] of [['Tamanho', '3'], ['Saúde', '5'], ['Vontade', '6'], ['Tensão', '3'], ['Iniciativa', '6 +1d10'], ['Deslocamento', '10 m'], ['Blindagem', '1']]) {
  const t = await p.locator('#stats .stat', { hasText: k }).first().locator('.v').textContent(); ok(t.trim() === v, k + ' = ' + v + ' (veio ' + t + ')');
}
ok(await p.locator('#t-saude .box').count() === 5 && await p.locator('#t-fv .box').count() === 6, 'trilhas de dano com o número certo de caixas');
const score = await p.textContent('#ck-score'); ok(/Tudo de acordo/.test(score), 'a Nadia passa em todas as regras: ' + score);
if (!/Tudo de acordo/.test(score)) console.log(await p.locator('#ck li.erro, #ck li.aviso').allTextContents());

/* ---------- violação aparece na hora ---------- */
await dot(p, '#atr', 'Força', 3); ok(/pendência/.test(await p.textContent('#ck-score')), 'mudar um atributo acusa a distribuição');
await dot(p, '#atr', 'Força', 2);

/* ---------- dano e rolador ---------- */
await p.locator('#t-saude .box').nth(0).click(); await p.locator('#t-saude .box').nth(0).click();
ok((await p.locator('#t-saude .box').nth(0).textContent()) === 'X', 'caixa cicla até agravado');
for (let i = 0; i < 6; i++) await p.locator('#t-fv .box').nth(i).click();
ok(/NENHUM PODER/.test(await p.textContent('#st-fv')), 'Vontade cheia avisa que nenhum poder ativa');
for (let i = 0; i < 6; i++) { await p.locator('#t-fv .box').nth(i).click(); await p.locator('#t-fv .box').nth(i).click(); }
await p.selectOption('#r-cat', 'pericia'); await p.selectOption('#r-tipo', 'medicina'); await p.check('#r-esp');
ok(/= 9 dado\(s\), 3 de Tensão/.test(await p.textContent('#r-form')), 'parada de Medicina com especialização: ' + await p.textContent('#r-form'));
await p.click('#r-go'); ok(await p.locator('#r-tray .die').count() >= 9, 'rola a parada inteira');
ok(/Sucessos/.test(await p.textContent('#r-out')), 'mostra o resultado');
await p.selectOption('#r-cat', 'ataque'); await p.selectOption('#r-tipo', 'desarmado');
ok(await p.isVisible('#w-rarma') && /Hard Wired/.test(await p.textContent('#r-arma')), 'Cyberpunk tem o golpe do membro implantado');
let viuDano = false; for (let i = 0; i < 12 && !viuDano; i++) { await p.click('#r-go'); viuDano = /Dano|Fracasso|Perdeu|Empate/.test(await p.textContent('#r-out')); }
ok(viuDano, 'ataque calcula dano');

/* ---------- em jogo: gastar experiência ---------- */
await p.click('.modo [data-modo="jogo"]');
await p.click('[data-add="vant"]'); vx = p.locator('#vant .item').last();
await vx.locator('input').first().fill('Ambidestria'); await vx.locator('input').first().blur();
ok((await p.locator('#vant .item').last().locator('input').nth(1).inputValue()) === '0', 'Vantagem nova em jogo nasce com 0 pontos');
await p.selectOption('#k-tipo', 'Vantagem'); await p.selectOption('#k-alvo', { label: 'Ambidestria (0)' });
ok(await p.inputValue('#k-custo') === '9', 'Ambidestria (3 pontos) custa 9 XP: ' + await p.inputValue('#k-custo'));
await p.click('#k-comprar');
ok(/Ambidestria 0→3/.test(await p.textContent('#xplog')) && /26/.test(await p.locator('#xp-stats .stat', { hasText: 'Disponível' }).textContent()), 'compra registrada e XP descontado');
await p.selectOption('#k-tipo', 'Atributo'); await p.selectOption('#k-alvo', 'Força');
ok(await p.inputValue('#k-custo') === '15', 'Força 2→3 custa 15 XP'); await p.click('#k-comprar');
ok((await p.locator('#atr .trait', { hasText: 'Força' }).locator('.dot.on').count()) === 3, 'compra sobe a bolinha');
await p.locator('#xplog .item').last().locator('.x').click();
ok((await p.locator('#atr .trait', { hasText: 'Força' }).locator('.dot.on').count()) === 2, 'desfazer a compra devolve o valor');
await p.click('.modo [data-modo="criacao"]');
await p.locator('#vant .item').last().locator('.x').click();
await p.locator('#xplog .item').last().locator('.x').click();

/* ---------- salvar e recarregar ---------- */
await p.click('#b-salvar'); await p.waitForFunction(() => /Salvo/.test(document.querySelector('#sync').textContent), null, { timeout: 8000 });
await p.reload();
ok(!(await p.isVisible('#gate')) && await p.inputValue('#i-personagem') === 'Nadia Corvo', 'recarregar mantém a sessão e a ficha');
ok((await p.locator('#t-saude .box').nth(0).textContent()) === 'X', 'dano marcado sobrevive ao recarregar');

/* ---------- exportar ---------- */
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#b-xlsx')]);
const arq = TMP + '/' + dl.suggestedFilename(); await dl.saveAs(arq);
ok(dl.suggestedFilename() === 'PlanetHell-Nadia-Corvo.xlsx', 'nome do arquivo: ' + dl.suggestedFilename());
const ExcelJS = require(process.env.EXCELJS_NODE || 'exceljs'); const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(arq);
ok(wb.worksheets.map(w => w.name).join('|') === 'Ficha|Poderes|Vantagens e Defeitos|Equipamento|Convicções e XP|História', 'abas da planilha');
let formula = null; wb.getWorksheet('Ficha').eachRow(r => r.eachCell(c => { if (c.formula && !formula) formula = c; }));
ok(formula && formula.result === 5, 'Saúde vira fórmula na planilha (' + (formula && formula.formula) + ' = ' + (formula && formula.result) + ')');
ok(wb.getWorksheet('Ficha').getCell('A1').font.name === 'Orbitron' && wb.getWorksheet('Ficha').getCell('A1').font.color.argb === 'FF00FF00', 'planilha no visual da ficha original');
await p.emulateMedia({ media: 'print' });
await p.pdf({ path: TMP + '/PlanetHell-Nadia-Corvo.pdf', format: 'A4', printBackground: true });
ok(fs.statSync(TMP + '/PlanetHell-Nadia-Corvo.pdf').size > 20000, 'gera PDF pela folha de impressão');
await p.emulateMedia({ media: 'screen' });

/* ---------- o aparelho perdeu a cópia local (limpeza, aba anônima, espaço esgotado) ---------- */
await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('ph.copia.')).forEach(k => localStorage.removeItem(k)));
await p.reload();
await p.waitForFunction(() => document.querySelector('#i-personagem').value === 'Nadia Corvo', null, { timeout: 20000 });
ok(await p.isHidden('#modal'), 'sem a cópia local, a ficha volta do servidor sem perguntar nada');
ok(await p.evaluate(() => window.PHApp.estado.pendente) === false, 'e a ficha em branco não é tratada como alteração a enviar');
const [dl3] = await Promise.all([p.waitForEvent('download'), p.click('#b-xlsx')]);
ok(dl3.suggestedFilename() === 'PlanetHell-Nadia-Corvo.xlsx', 'e o download sai com a ficha, não em branco');

if (MODO === 'servidor') {
  /* sem cópia local E sem servidor: a tela fica em branco, e aí nada pode ser baixado em silêncio */
  await fetch('http://127.0.0.1:8788/__fora');
  await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('ph.copia.')).forEach(k => localStorage.removeItem(k)));
  await p.reload();
  await p.waitForFunction(() => /Offline|Sem conexão/.test(document.querySelector('#sync').textContent), null, { timeout: 40000 });
  ok(await p.inputValue('#i-personagem') === '', 'sem cópia e sem servidor, a ficha aparece em branco');
  await p.click('#b-xlsx'); await p.waitForSelector('#modal:not([hidden])', { timeout: 10000 });
  ok(/em branco/.test(await p.textContent('#modal h2')), 'baixar uma ficha em branco é barrado com aviso');
  await p.click('#modal .btn.ghost'); await p.waitForSelector('#modal', { state: 'hidden' });
  await p.click('#b-pdf'); await p.waitForSelector('#modal:not([hidden])', { timeout: 10000 });
  ok(/em branco/.test(await p.textContent('#modal h2')), 'vale para o PDF também');
  ok(await p.evaluate(() => window.PHApp.estado.pendente) === false, 'e o vazio nunca é enviado por cima do que está salvo');
  await fetch('http://127.0.0.1:8788/__volta');
  await p.click('#modal .btn');
  await p.waitForFunction(() => document.querySelector('#i-personagem').value === 'Nadia Corvo', null, { timeout: 30000 });
  ok(true, 'o botão "Buscar a ficha salva" traz a ficha de volta');
  const rev = await p.evaluate(() => window.PHApp.estado.rev);
  ok(rev >= 1, 'e ela volta com a revisão do servidor (v' + rev + ')');
}

/* ---------- outro aparelho (modo servidor) ---------- */
if (MODO === 'servidor') {
  const ctx2 = await contexto(); const q = await pagina(ctx2); await q.goto(BASE);
  await q.fill('#e-usuario', 'ana_corvo'); await q.fill('#e-pin', PIN); await q.click('#f-entrar .btn');
  await q.waitForSelector('#gate', { state: 'hidden' });
  ok(await q.inputValue('#i-personagem') === 'Nadia Corvo', 'outro aparelho abre a mesma ficha');
  await q.fill('#i-notas', 'escrito no celular'); await q.click('#b-salvar'); await q.waitForFunction(() => /Salvo/.test(document.querySelector('#sync').textContent));
  await p.fill('#i-historia', 'escrito no computador velho');
  await p.waitForSelector('#modal:not([hidden])', { timeout: 10000 });
  ok(/Versão mais nova/.test(await p.textContent('#modal')), 'o computador desatualizado recebe aviso de conflito, sem sobrescrever');
  await p.click('#modal .btn >> text=Abrir a mais nova');
  ok(await p.inputValue('#i-notas') === 'escrito no celular', 'abre a versão mais nova');
  // queda de conexão
  await fetch('http://127.0.0.1:8788/__fora');
  await q.fill('#i-idade', '35'); await q.waitForFunction(() => /Offline/.test(document.querySelector('#sync').textContent), null, { timeout: 40000 });
  ok(true, 'sem servidor, avisa que ficou salvo no aparelho');
  await fetch('http://127.0.0.1:8788/__volta');
  await q.evaluate(() => window.dispatchEvent(new Event('online')));
  await q.waitForFunction(() => /Salvo/.test(document.querySelector('#sync').textContent), null, { timeout: 15000 });
  ok(true, 'quando a conexão volta, envia sozinho');
  await ctx2.close();
}

/* ---------- versões ---------- */
await p.click('#b-hist'); await p.waitForSelector('#modal .vers li', { timeout: 10000 });
ok(await p.locator('#modal .vers li').count() >= 1, 'lista versões salvas');
await p.click('#modal .btn >> text=Fechar');

/* ---------- Narrador: a mesa ---------- */
await p.click('#b-sair'); await p.waitForSelector('#gate:not([hidden])');
await p.click('.tabs [data-tab="criar"]');
await p.fill('#c-usuario', 'caio'); await p.fill('#c-nome', 'Caio'); await p.click('#f-criar .btn');
await p.waitForSelector('#p-pin:not([hidden])');
const PIN_CAIO = (await p.textContent('#pin-novo')).trim();
await p.click('#pin-ok');
await p.fill('#i-personagem', 'Strauss Vide'); await p.selectOption('#i-raca', 'Punk');
await p.click('#b-salvar'); await p.waitForFunction(() => /Salvo/.test(document.querySelector('#sync').textContent), null, { timeout: 15000 });
ok(await p.isHidden('#b-mesa'), 'jogador comum não vê o botão Mesa');
await p.click('#b-sair'); await p.waitForSelector('#gate:not([hidden])');

/* no modo local o Narrador é a primeira conta do navegador (a ana); no servidor, marcamos na planilha */
if (MODO === 'servidor') ok((await (await fetch('http://127.0.0.1:8788/__narrador?u=ana_corvo')).text()) === 'ok', 'promove a ana a Narrador na planilha');
await p.fill('#e-usuario', 'ana_corvo'); await p.fill('#e-pin', PIN); await p.click('#f-entrar .btn');
await p.waitForSelector('#gate', { state: 'hidden' });
ok(await p.isVisible('#b-mesa'), 'o Narrador vê o botão Mesa');
ok(/Narrador/.test(await p.textContent('#who')), 'a barra identifica o Narrador');
await p.click('#b-mesa'); await p.waitForSelector('#modal .mesa li', { timeout: 15000 });
ok(await p.locator('#modal .mesa li').count() >= 2, 'a mesa lista as fichas dos jogadores');
const linhaCaio = p.locator('#modal .mesa li', { hasText: 'Strauss Vide' }).first();
ok(await linhaCaio.count() === 1, 'a ficha do outro jogador aparece pelo nome do personagem');
ok((await linhaCaio.locator('.pino').textContent()).trim() === PIN_CAIO, 'a mesa mostra o PIN de cada jogador');
await linhaCaio.locator('.btn').click();
await p.waitForSelector('#narrando:not([hidden])', { timeout: 15000 });
ok(/Caio/.test(await p.textContent('#narrando-txt')), 'avisa de quem é a ficha aberta');
ok(await p.inputValue('#i-personagem') === 'Strauss Vide', 'o Narrador abre a ficha do jogador');
await p.fill('#i-idade', '40');
await p.click('#b-salvar'); await p.waitForFunction(() => /Salvo/.test(document.querySelector('#sync').textContent), null, { timeout: 15000 });
await p.click('#b-voltar-minha');
await p.waitForFunction(() => document.querySelector('#i-personagem').value === 'Nadia Corvo', null, { timeout: 15000 });
ok(await p.isHidden('#narrando'), 'voltar à própria ficha fecha o aviso');
ok(await p.inputValue('#i-jogador') === 'Ana', 'e a ficha do Narrador volta intacta');
await p.click('#b-sair'); await p.waitForSelector('#gate:not([hidden])');
await p.fill('#e-usuario', 'caio'); await p.fill('#e-pin', PIN_CAIO); await p.click('#f-entrar .btn');
await p.waitForSelector('#gate', { state: 'hidden' });
ok(await p.inputValue('#i-idade') === '40', 'o jogador encontra a alteração feita pelo Narrador');
ok(await p.inputValue('#i-jogador') === 'Caio', 'e a ficha continua sendo dele');
await p.click('#b-hist'); await p.waitForSelector('#modal .vers li', { timeout: 15000 });
ok(await p.locator('#modal .vers li').count() >= 2, 'a edição do Narrador virou uma versão no histórico do jogador');
await p.click('#modal .btn >> text=Fechar');
await p.click('#b-sair'); await p.waitForSelector('#gate:not([hidden])');
await p.fill('#e-usuario', 'ana_corvo'); await p.fill('#e-pin', PIN); await p.click('#f-entrar .btn');
await p.waitForSelector('#gate', { state: 'hidden' });

/* ---------- sair, recuperar, entrar, bloquear ---------- */
await p.click('#b-sair'); await p.waitForSelector('#gate:not([hidden])');
await p.click('.tabs [data-tab="recuperar"]'); await p.fill('#r-personagem', 'nádia  CORVO'); await p.selectOption('#r-raca', 'Cyberpunk'); await p.click('#f-recuperar .btn');
await p.waitForSelector('#r-resultado .pin-show'); ok((await p.textContent('#r-resultado .pin-show')).trim() === PIN, 'recupera o PIN pelo nome do personagem e raça');
await p.click('#r-resultado .btn'); ok(await p.inputValue('#e-usuario') === 'ana_corvo', 'recuperação preenche o login');
await p.click('#f-entrar .btn'); await p.waitForSelector('#gate', { state: 'hidden' });
ok(await p.inputValue('#i-personagem') === 'Nadia Corvo', 'entra de novo e a ficha está lá');
await p.click('#b-sair'); await p.waitForSelector('#gate:not([hidden])');
const errado = PIN === '0000' ? '1111' : '0000';
for (let i = 0; i < 5; i++) { await p.fill('#e-usuario', 'ana_corvo'); await p.fill('#e-pin', errado); await p.click('#f-entrar .btn'); await p.waitForFunction(() => document.querySelector('#m-entrar').classList.contains('err')); await p.evaluate(() => document.querySelector('#m-entrar').className = 'msg'); }
await p.fill('#e-pin', PIN); await p.click('#f-entrar .btn'); await p.waitForSelector('#m-entrar.err');
ok(/bloqueado/.test(await p.textContent('#m-entrar')), 'cinco PINs errados bloqueiam, até com o PIN certo');

/* ---------- celular ---------- */
const cel = await contexto({ viewport: { width: 390, height: 844 }, isMobile: true }); const m = await pagina(cel); await m.goto(BASE);
await m.click('.tabs [data-tab="criar"]'); await m.fill('#c-usuario', 'bia'); await m.fill('#c-nome', 'Bia'); await m.click('#f-criar .btn');
await m.waitForSelector('#p-pin:not([hidden])'); await m.click('#pin-ok');
await m.selectOption('#i-raca', 'Mecha'); await m.click('[data-add="trilhas"]'); await m.click('[data-add="vant"]'); await m.click('[data-add="armas"]');
ok(await m.evaluate(() => document.documentElement.scrollWidth) <= 390, 'sem rolagem lateral no celular');
ok((await m.locator('#stats .stat', { hasText: 'Blindagem' }).locator('.v').textContent()).trim() === '3', 'Mecha: Blindagem 3 (Tosei Dō)');
await m.screenshot({ path: TMP + '/ficha-celular.png', fullPage: false });

ok(erros.length === 0, 'nenhum erro de JavaScript: ' + erros.join(' | '));
await b.close();
console.log(`[${MODO}] ${total - falhou} de ${total} testes passaram.`);
process.exit(falhou ? 1 : 0);
