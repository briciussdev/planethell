/* node testes/servidor.test.js — roda o Code.gs do Apps Script no Node, com a planilha simulada em memória. */
const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
let falhou = 0, total = 0;
function ok(c, msg) { total++; if (!c) { falhou++; console.log('  FALHOU:', msg); } }

function mundo() {
  const abas = {}; let relogio = Date.parse('2026-09-21T12:00:00Z'); const cache = {};
  function Aba(nome) {
    const linhas = [];
    return {
      nome, linhas,
      appendRow(r) { linhas.push(r.slice()); },
      setFrozenRows() {},
      getLastColumn() { return Math.max(0, ...linhas.map(l => l.length)); },
      getDataRange() { const w = this.getLastColumn(); return { getValues: () => linhas.map(l => { const c = l.slice(); while (c.length < w) c.push(''); return c.map(v => v instanceof Date ? new Date(v) : v); }) }; },
      getRange(r, c, nr = 1, nc = 1) {
        return {
          setValues(vals) { for (let i = 0; i < nr; i++) { const l = linhas[r - 1 + i]; for (let j = 0; j < nc; j++) l[c - 1 + j] = vals[i][j]; } },
          setValue(v) { linhas[r - 1][c - 1] = v; }
        };
      }
    };
  }
  const ctx = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: n => abas[n] || null, insertSheet: n => (abas[n] = Aba(n)) }) },
    CacheService: { getScriptCache: () => ({ get: k => (cache[k] && cache[k].ate > relogio ? cache[k].v : null), put: (k, v, s) => { cache[k] = { v, ate: relogio + s * 1000 }; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: { getUuid: () => crypto.randomUUID(), DigestAlgorithm: { SHA_256: 1 }, Charset: { UTF_8: 1 },
      computeDigest: (_, s) => Array.from(crypto.createHash('sha256').update(s, 'utf8').digest()).map(b => b > 127 ? b - 256 : b) },
    ContentService: { MimeType: { JSON: 1 }, createTextOutput: s => ({ setMimeType() { return this; }, texto: s }) },
    Date: class extends Date { constructor(...a) { if (a.length) super(...a); else super(relogio); } static now() { return relogio; } },
    JSON, Math, String, Number, Array, Object, parseInt
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(__dirname + '/../backend/Code.gs', 'utf8'), ctx);
  const chamar = p => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(p) } }).texto);
  return { chamar, abas, ctx, avancar: min => { relogio += min * 60000; } };
}

const W = mundo(), C = W.chamar;
ok(W.ctx.instalar().includes('Contas'), 'instalar cria as abas');
// criar
let r = C({ acao: 'criar', usuario: 'Ana_01', nome: 'Ana' });
ok(r.ok && /^\d{4}$/.test(r.pin) && r.token && r.usuario === 'ana_01', 'cria conta, gera PIN de 4 dígitos e sessão');
const pin = r.pin, token = r.token;
ok(!C({ acao: 'criar', usuario: 'ana_01', nome: 'Ana' }).ok, 'usuário repetido é recusado');
ok(!C({ acao: 'criar', usuario: 'x', nome: 'Ana' }).ok, 'usuário curto demais é recusado');
ok(!C({ acao: 'criar', usuario: 'bruno', nome: 'Bruno Silva' }).ok, 'nome com sobrenome é recusado (basta o nome)');
ok(!C({ acao: 'criar', usuario: 'bruno', nome: '<script>' }).ok, 'nome com símbolos é recusado');
ok(!C({ acao: 'criar', usuario: '0012', nome: 'Zé' }).ok, 'usuário só de números é recusado (a planilha comeria os zeros)');
ok(C({ acao: 'criar', usuario: 'bruno', nome: 'Bruno' }).ok, 'segunda conta');
// salvar e carregar
const ficha = { id: { personagem: 'Nadia Corvo' }, raca: 'Cyberpunk', atr: { 'Força': 2 } };
r = C({ acao: 'salvar', usuario: 'ana_01', token, ficha, rev: 0 });
ok(r.ok && r.rev === 1, 'salva a primeira versão');
ok(!C({ acao: 'salvar', usuario: 'ana_01', token: 'falso', ficha, rev: 1 }).ok, 'token falso não salva');
ok(C({ acao: 'salvar', usuario: 'bruno', token, ficha, rev: 0 }).sessao === false, 'token de um usuário não serve para outro');
r = C({ acao: 'carregar', usuario: 'ana_01', token });
ok(r.ok && r.rev === 1 && r.ficha.id.personagem === 'Nadia Corvo', 'carrega o que salvou');
// conflito entre aparelhos
ok(C({ acao: 'salvar', usuario: 'ana_01', token, ficha: { ...ficha, notas: 'celular' }, rev: 1 }).rev === 2, 'celular salva rev 2');
r = C({ acao: 'salvar', usuario: 'ana_01', token, ficha: { ...ficha, notas: 'pc antigo' }, rev: 1 });
ok(!r.ok && r.conflito && r.rev === 2 && r.ficha.notas === 'celular', 'computador com versão velha recebe conflito, nada é sobrescrito');
r = C({ acao: 'salvar', usuario: 'ana_01', token, ficha: { ...ficha, notas: 'pc antigo' }, rev: 1, forcar: true });
ok(r.ok && r.rev === 3, 'sobrescrever só com confirmação');
const hist = C({ acao: 'historico', usuario: 'ana_01', token });
ok(hist.ok && hist.versoes.some(v => v.rev === 2), 'a versão sobrescrita ficou no histórico');
ok(C({ acao: 'versao', usuario: 'ana_01', token, rev: 2 }).ficha.notas === 'celular', 'dá para abrir a versão antiga');
// ficha grande: vários pedaços
const grande = { id: { personagem: 'Nadia Corvo' }, raca: 'Cyberpunk', historia: 'x'.repeat(130000) };
ok(C({ acao: 'salvar', usuario: 'ana_01', token, ficha: grande, rev: 3 }).ok, 'salva ficha com 130 mil caracteres');
ok(C({ acao: 'carregar', usuario: 'ana_01', token }).ficha.historia.length === 130000, 'ficha grande volta inteira');
ok(C({ acao: 'salvar', usuario: 'ana_01', token, ficha: { ...ficha }, rev: 4 }).ok, 'volta a ficar pequena');
ok(!('historia' in C({ acao: 'carregar', usuario: 'ana_01', token }).ficha), 'pedaços velhos não contaminam a ficha menor');
ok(!C({ acao: 'salvar', usuario: 'ana_01', token, ficha: { h: 'y'.repeat(500000) }, rev: 5 }).ok, 'recusa ficha acima do limite');
ok(!C({ acao: 'salvar', usuario: 'ana_01', token, ficha: '[1,2]', rev: 5 }).ok, 'recusa conteúdo que não é ficha');
// login
r = C({ acao: 'entrar', usuario: 'ANA_01', pin });
ok(r.ok && r.ficha && r.ficha.id.personagem === 'Nadia Corvo' && r.nome === 'Ana', 'entra com usuário (sem diferenciar maiúsculas) e PIN');
const errado = pin === '0000' ? '1111' : '0000';
for (let i = 0; i < 4; i++) ok(!C({ acao: 'entrar', usuario: 'ana_01', pin: errado }).ok, 'PIN errado ' + (i + 1));
r = C({ acao: 'entrar', usuario: 'ana_01', pin: errado }); ok(!r.ok && /bloqueado/.test(r.erro), 'quinto erro bloqueia');
r = C({ acao: 'entrar', usuario: 'ana_01', pin }); ok(!r.ok && /bloqueado/.test(r.erro), 'nem o PIN certo entra durante o bloqueio');
W.avancar(16);
ok(C({ acao: 'entrar', usuario: 'ana_01', pin }).ok, 'depois de 15 minutos entra de novo');
ok(!C({ acao: 'entrar', usuario: 'ninguem', pin: '1234' }).ok, 'usuário inexistente não entra');
// recuperação por personagem + raça
r = C({ acao: 'recuperar', personagem: '  nádia   CORVO ', raca: 'Cyberpunk' });
ok(r.ok && r.contas.length === 1 && r.contas[0].pin === pin && r.contas[0].usuario === 'ana_01', 'recupera usuário e PIN (ignora acento, espaço e maiúscula)');
ok(!C({ acao: 'recuperar', personagem: 'Nadia Corvo', raca: 'Punk' }).ok, 'raça errada não recupera');
for (let i = 0; i < 4; i++) C({ acao: 'recuperar', personagem: 'Nadia Corvo', raca: 'Cyberpunk' });
ok(!C({ acao: 'recuperar', personagem: 'Nadia Corvo', raca: 'Cyberpunk' }).ok, 'limite de recuperações por hora');
ok(W.abas.Registro.linhas.some(l => l[1] === 'recuperar'), 'recuperação fica registrada para o Narrador');
// sessão expira e sair
W.avancar(60 * 24 * 31);
ok(C({ acao: 'carregar', usuario: 'ana_01', token }).sessao === false, 'sessão expira em 30 dias');
r = C({ acao: 'entrar', usuario: 'ana_01', pin }); const t2 = r.token;
ok(C({ acao: 'sair', usuario: 'ana_01', token: t2 }).ok && C({ acao: 'carregar', usuario: 'ana_01', token: t2 }).sessao === false, 'sair encerra a sessão');
// nada é apagado
ok(!/deleteRow|deleteSheet|clearContents|clear\(/.test(fs.readFileSync(__dirname + '/../backend/Code.gs', 'utf8')), 'o servidor não tem nenhuma operação de apagar');
ok(C({ acao: 'apagar', usuario: 'ana_01' }).ok === false, 'ação de apagar não existe');
const antes = W.abas.Historico.linhas.length;
r = C({ acao: 'entrar', usuario: 'ana_01', pin }); const t3 = r.token;
C({ acao: 'salvar', usuario: 'ana_01', token: t3, ficha: { ...ficha, n: 1 }, rev: r.rev });
C({ acao: 'salvar', usuario: 'ana_01', token: t3, ficha: { ...ficha, n: 2 }, rev: r.rev + 1 });
ok(W.abas.Historico.linhas.length === antes + 1, 'salvamentos seguidos geram uma cópia a cada 5 minutos, não a cada tecla');
W.avancar(6); C({ acao: 'salvar', usuario: 'ana_01', token: t3, ficha: { ...ficha, n: 3 }, rev: r.rev + 2 });
ok(W.abas.Historico.linhas.length === antes + 2, 'depois de 5 minutos, nova cópia');
C({ acao: 'salvar', usuario: 'ana_01', token: t3, ficha: { ...ficha, n: 4 }, rev: r.rev + 3, marco: true });
ok(W.abas.Historico.linhas.length === antes + 3, 'salvamento manual sempre guarda cópia');
ok(!W.abas.Sessoes.linhas.slice(1).some(l => l[0].length !== 64), 'sessões guardam só o hash do token');
// injeção de fórmula na planilha do Narrador
r = C({ acao: 'entrar', usuario: 'bruno', pin: W.abas.Contas.linhas[2][2].replace(/^'/, '') });
C({ acao: 'salvar', usuario: 'bruno', token: r.token, ficha: { id: { personagem: '=IMPORTXML("http://x")' }, raca: 'Punk', t: '=1+1', u: '-5' }, rev: 0 });
const lin = W.abas.Fichas.linhas.find(l => l[0] === 'bruno');
ok(String(lin[3]).startsWith("'=") && lin.slice(6).every(c => c === '' || String(c).startsWith('~')), 'nomes e pedaços nunca viram fórmula na planilha');
ok(C({ acao: 'carregar', usuario: 'bruno', token: r.token }).ficha.id.personagem === '=IMPORTXML("http://x")', 'e a ficha volta idêntica');
ok(C({ acao: 'recuperar', personagem: '=IMPORTXML("http://x")', raca: 'Punk' }).ok, 'recuperação funciona com nome começando por =');
console.log((total - falhou) + ' de ' + total + ' testes passaram.');
process.exit(falhou ? 1 : 0);
