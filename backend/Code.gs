/**
 * PlanetHell — servidor das fichas (Google Apps Script ligado a uma Planilha Google).
 *
 * Como instalar: veja o README.md do repositório, seção "Banco de dados".
 * Resumo: crie uma Planilha Google, abra Extensões → Apps Script, cole este arquivo,
 * rode a função `instalar` uma vez e publique como App da Web (Executar como: Eu; Acesso: Qualquer pessoa).
 *
 * Regras de segurança deste servidor
 * - Ninguém lê a planilha: só este script. As abas ficam na sua conta Google.
 * - Login por usuário + PIN de 4 dígitos gerado pelo sistema (o jogador não escolhe, então não reaproveita senha de outro lugar).
 * - 5 PINs errados bloqueiam aquele usuário por 15 minutos. Há também um freio global contra tentativa em massa.
 * - Depois do login, o navegador guarda um token de sessão (30 dias). O PIN não trafega a cada salvamento.
 * - Recuperação por nome do personagem + raça, com limite de tentativas e registro na aba "Registro".
 * - NADA É APAGADO. Não existe ação de excluir. Cada salvamento atualiza a aba "Fichas" e,
 *   de tempos em tempos, guarda uma cópia inteira na aba "Historico". Salvar por cima de uma versão
 *   mais nova é recusado (conflito), a menos que o jogador confirme.
 */

var CONFIG = {
  TENTATIVAS_PIN: 5,              // erros seguidos antes do bloqueio
  BLOQUEIO_MIN: 15,               // minutos de bloqueio
  SESSAO_DIAS: 30,
  FREIO_GLOBAL_LOGIN: 200,        // PINs errados somando todos os usuários, a cada 10 minutos
  RECUPERAR_POR_NOME_HORA: 5,     // recuperações por nome de personagem por hora
  RECUPERAR_GLOBAL_HORA: 60,
  CRIAR_POR_HORA: 40,             // contas novas por hora, somando todo mundo
  INSTANTANEO_MIN: 5,             // intervalo mínimo entre cópias automáticas no Histórico
  TAMANHO_MAX: 400000,            // caracteres de uma ficha
  PEDACO: 40000                   // uma célula aceita 50 mil caracteres; guardamos em pedaços de 40 mil
};

var ABAS = {
  Contas:    ['usuario', 'nome', 'pin', 'criado', 'ultimoAcesso', 'falhas', 'bloqueadoAte'],
  Sessoes:   ['hash', 'usuario', 'criada', 'expira'],
  Fichas:    ['usuario', 'rev', 'atualizado', 'personagem', 'raca', 'partes', 'json'],
  Historico: ['usuario', 'rev', 'quando', 'personagem', 'raca', 'partes', 'json'],
  Registro:  ['quando', 'acao', 'usuario', 'detalhe']
};

/* ------------------------------------------------------------------ entrada */

function doGet() {
  return saida_({ ok: true, app: 'PlanetHell', servidor: 'ativo' });
}

function doPost(e) {
  var pedido;
  try { pedido = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (x) { return saida_({ ok: false, erro: 'Pedido inválido.' }); }
  var trava = LockService.getScriptLock();
  try {
    trava.waitLock(20000);
    return saida_(rotear_(pedido));
  } catch (x) {
    return saida_({ ok: false, erro: 'O servidor está ocupado. Tente de novo em alguns segundos.' });
  } finally {
    try { trava.releaseLock(); } catch (y) {}
  }
}

function rotear_(p) {
  switch (p.acao) {
    case 'criar':     return criar_(p);
    case 'entrar':    return entrar_(p);
    case 'carregar':  return comSessao_(p, carregar_);
    case 'salvar':    return comSessao_(p, salvar_);
    case 'historico': return comSessao_(p, historico_);
    case 'versao':    return comSessao_(p, versao_);
    case 'sair':      return comSessao_(p, sair_);
    case 'recuperar': return recuperar_(p);
    default:          return { ok: false, erro: 'Ação desconhecida.' };
  }
}

/* Rode uma vez pelo editor do Apps Script para criar as abas. Nunca apaga nada que já exista. */
function instalar() {
  Object.keys(ABAS).forEach(function (n) { aba_(n); });
  return 'Abas prontas: ' + Object.keys(ABAS).join(', ');
}

/* ------------------------------------------------------------------ contas */

function criar_(p) {
  var usuario = normUsuario_(p.usuario);
  var nome = String(p.nome || '').trim();
  if (!/^[a-z][a-z0-9_.-]{2,23}$/.test(usuario)) return { ok: false, erro: 'Usuário: de 3 a 24 caracteres, começando com letra; só letras sem acento, números, ponto, hífen ou sublinhado.' };
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ'-]{1,30}$/.test(nome)) return { ok: false, erro: 'Nome: só o primeiro nome, sem espaços nem números.' };
  if (!freio_('criar', CONFIG.CRIAR_POR_HORA, 3600)) return { ok: false, erro: 'Muitas fichas criadas na última hora. Tente mais tarde.' };
  if (linha_('Contas', 0, usuario)) return { ok: false, erro: 'Esse usuário já existe. Escolha outro.' };
  var pin = novoPin_();
  var agora = new Date();
  aba_('Contas').appendRow([usuario, nome, "'" + pin, agora, agora, 0, '']);
  registrar_('criar', usuario, '');
  var token = novaSessao_(usuario);
  return { ok: true, usuario: usuario, nome: nome, pin: pin, token: token, rev: 0, ficha: null };
}

function entrar_(p) {
  var usuario = normUsuario_(p.usuario), pin = String(p.pin || '').trim();
  if (!freio_('errosLogin', CONFIG.FREIO_GLOBAL_LOGIN, 600, true)) return { ok: false, erro: 'Muitas tentativas no sistema agora. Espere alguns minutos.' };
  var c = linha_('Contas', 0, usuario);
  if (!c) { freio_('errosLogin', CONFIG.FREIO_GLOBAL_LOGIN, 600); return { ok: false, erro: 'Usuário ou PIN incorretos.' }; }
  var agora = new Date(), v = c.valores;
  if (v[6] && new Date(v[6]) > agora) {
    var min = Math.ceil((new Date(v[6]) - agora) / 60000);
    return { ok: false, erro: 'Muitos PINs errados. Este usuário está bloqueado por mais ' + min + ' minuto(s).' };
  }
  if (String(v[2]).replace(/^'/, '') !== pin) {
    freio_('errosLogin', CONFIG.FREIO_GLOBAL_LOGIN, 600);
    var falhas = (Number(v[5]) || 0) + 1, bloq = '';
    if (falhas >= CONFIG.TENTATIVAS_PIN) { bloq = new Date(agora.getTime() + CONFIG.BLOQUEIO_MIN * 60000); falhas = 0; registrar_('bloqueio', usuario, ''); }
    aba_('Contas').getRange(c.linha, 6, 1, 2).setValues([[falhas, bloq]]);
    var resta = CONFIG.TENTATIVAS_PIN - falhas;
    return { ok: false, erro: bloq ? 'PIN incorreto. Usuário bloqueado por ' + CONFIG.BLOQUEIO_MIN + ' minutos.' : 'Usuário ou PIN incorretos. ' + resta + ' tentativa(s) antes do bloqueio.' };
  }
  aba_('Contas').getRange(c.linha, 5, 1, 3).setValues([[agora, 0, '']]);
  var token = novaSessao_(usuario);
  var f = lerFicha_('Fichas', usuario);
  registrar_('entrar', usuario, '');
  return { ok: true, usuario: usuario, nome: v[1], token: token, rev: f ? f.rev : 0, ficha: f ? f.ficha : null };
}

function recuperar_(p) {
  var pers = norm_(p.personagem), raca = String(p.raca || '').trim();
  if (pers.length < 2 || !raca) return { ok: false, erro: 'Informe o nome do personagem e a raça.' };
  if (!freio_('recG', CONFIG.RECUPERAR_GLOBAL_HORA, 3600)) return { ok: false, erro: 'Muitas recuperações na última hora. Tente mais tarde.' };
  if (!freio_('rec:' + pers, CONFIG.RECUPERAR_POR_NOME_HORA, 3600)) return { ok: false, erro: 'Muitas tentativas para este personagem. Tente daqui a uma hora.' };
  var fichas = aba_('Fichas').getDataRange().getValues(), achados = [];
  for (var i = 1; i < fichas.length; i++) {
    if (norm_(texto_(fichas[i][3])) === pers && texto_(fichas[i][4]) === raca) {
      var c = linha_('Contas', 0, fichas[i][0]);
      if (c) achados.push({ usuario: c.valores[0], nome: c.valores[1], pin: String(c.valores[2]).replace(/^'/, '') });
    }
  }
  registrar_('recuperar', achados.map(function (a) { return a.usuario; }).join(',') || '-', pers + ' / ' + raca);
  if (!achados.length) return { ok: false, erro: 'Nenhuma ficha salva com esse personagem e essa raça. Confira a grafia do nome.' };
  return { ok: true, contas: achados };
}

/* ------------------------------------------------------------------ fichas */

function carregar_(p, usuario) {
  var f = lerFicha_('Fichas', usuario);
  return { ok: true, rev: f ? f.rev : 0, ficha: f ? f.ficha : null };
}

function salvar_(p, usuario) {
  var json = typeof p.ficha === 'string' ? p.ficha : JSON.stringify(p.ficha || null);
  if (!json || json === 'null') return { ok: false, erro: 'Ficha vazia.' };
  if (json.length > CONFIG.TAMANHO_MAX) return { ok: false, erro: 'Ficha grande demais para salvar.' };
  var ficha; try { ficha = JSON.parse(json); } catch (x) { return { ok: false, erro: 'Ficha corrompida.' }; }
  if (!ficha || typeof ficha !== 'object' || Array.isArray(ficha)) return { ok: false, erro: 'Ficha inválida.' };

  var atual = lerFicha_('Fichas', usuario);
  var revAtual = atual ? atual.rev : 0;
  if (Number(p.rev || 0) !== revAtual && !p.forcar) {
    return { ok: false, conflito: true, rev: revAtual, ficha: atual ? atual.ficha : null,
             erro: 'Esta ficha foi salva em outro aparelho depois da sua última leitura.' };
  }
  var rev = revAtual + 1, agora = new Date();
  var pers = String((ficha.id && ficha.id.personagem) || '').slice(0, 80), raca = String(ficha.raca || '').slice(0, 30);
  if (p.forcar && atual) gravarLinha_('Historico', null, [usuario, revAtual, agora, atual.personagem, atual.raca], JSON.stringify(atual.ficha)); // guarda a que ia ser sobrescrita
  gravarLinha_('Fichas', atual ? atual.linha : null, [usuario, rev, agora, pers, raca], json);

  var ultimo = ultimoInstantaneo_(usuario);
  var mudouIdentidade = !atual || atual.personagem !== pers || atual.raca !== raca;
  if (p.marco || mudouIdentidade || !ultimo || (agora - ultimo) > CONFIG.INSTANTANEO_MIN * 60000) {
    gravarLinha_('Historico', null, [usuario, rev, agora, pers, raca], json);
  }
  return { ok: true, rev: rev, quando: agora.toISOString() };
}

function historico_(p, usuario) {
  var v = aba_('Historico').getDataRange().getValues(), out = [];
  for (var i = v.length - 1; i >= 1 && out.length < 60; i--) {
    if (v[i][0] === usuario) out.push({ rev: v[i][1], quando: new Date(v[i][2]).toISOString(), personagem: texto_(v[i][3]), raca: texto_(v[i][4]) });
  }
  return { ok: true, versoes: out };
}

function versao_(p, usuario) {
  var v = aba_('Historico').getDataRange().getValues();
  for (var i = v.length - 1; i >= 1; i--) {
    if (v[i][0] === usuario && Number(v[i][1]) === Number(p.rev)) return { ok: true, rev: v[i][1], ficha: JSON.parse(juntar_(v[i])) };
  }
  return { ok: false, erro: 'Versão não encontrada.' };
}

function sair_(p, usuario) {
  var s = linha_('Sessoes', 0, hash_(p.token));
  if (s) aba_('Sessoes').getRange(s.linha, 4).setValue(new Date(new Date().getTime() - 1000));
  return { ok: true };
}

/* ------------------------------------------------------------------ sessão */

function comSessao_(p, fn) {
  var usuario = normUsuario_(p.usuario);
  var s = linha_('Sessoes', 0, hash_(p.token || ''));
  if (!s || s.valores[1] !== usuario || new Date(s.valores[3]) < new Date()) {
    return { ok: false, sessao: false, erro: 'Sessão expirada. Entre de novo com o seu PIN.' };
  }
  return fn(p, usuario);
}
function novaSessao_(usuario) {
  var token = Utilities.getUuid() + Utilities.getUuid();
  var agora = new Date();
  aba_('Sessoes').appendRow([hash_(token), usuario, agora, new Date(agora.getTime() + CONFIG.SESSAO_DIAS * 86400000)]);
  return token;
}
function hash_(s) {
  var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8);
  return b.map(function (x) { return ('0' + ((x + 256) % 256).toString(16)).slice(-2); }).join('');
}

/* ------------------------------------------------------------------ utilitários */

function novoPin_() {
  var hex = Utilities.getUuid().replace(/-/g, '');
  return ('000' + (parseInt(hex.slice(0, 8), 16) % 10000)).slice(-4);
}
function normUsuario_(u) { return String(u || '').trim().toLowerCase(); }
function norm_(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }

/* Conta eventos num intervalo. Com `soConsultar`, só diz se o limite já foi atingido. */
function freio_(chave, limite, segundos, soConsultar) {
  var cache = CacheService.getScriptCache(), k = 'freio:' + chave;
  var n = Number(cache.get(k) || 0);
  if (n >= limite) return false;
  if (!soConsultar) cache.put(k, String(n + 1), segundos);
  return true;
}

function aba_(nome) {
  var pl = SpreadsheetApp.getActiveSpreadsheet();
  var a = pl.getSheetByName(nome);
  if (!a) { a = pl.insertSheet(nome); a.appendRow(ABAS[nome]); a.setFrozenRows(1); }
  return a;
}
function linha_(aba, col, valor) {
  var v = aba_(aba).getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (String(v[i][col]) === String(valor)) return { linha: i + 1, valores: v[i] };
  return null;
}
function gravarLinha_(aba, linha, cabeca, json) {
  var partes = [];
  for (var i = 0; i < json.length; i += CONFIG.PEDACO) partes.push('~' + json.slice(i, i + CONFIG.PEDACO)); // o '~' impede a planilha de ler um pedaço como fórmula ou número
  var row = cabeca.map(function (c) { return (typeof c === 'string' && /^[=+\-@']/.test(c)) ? "'" + c : c; }).concat([partes.length], partes);
  var a = aba_(aba);
  if (linha) {
    var larg = Math.max(a.getLastColumn(), row.length);
    while (row.length < larg) row.push('');           // limpa pedaços de uma versão maior anterior
    a.getRange(linha, 1, 1, row.length).setValues([row]);
  } else a.appendRow(row);
}
function juntar_(valores) {
  var n = Number(valores[5]) || 1, s = '';
  for (var i = 0; i < n; i++) s += String(valores[6 + i] || '').replace(/^~/, '');
  return s;
}
function lerFicha_(aba, usuario) {
  var l = linha_(aba, 0, usuario); if (!l) return null;
  var v = l.valores;
  return { linha: l.linha, rev: Number(v[1]) || 0, personagem: texto_(v[3]), raca: texto_(v[4]), ficha: JSON.parse(juntar_(v)) };
}
function ultimoInstantaneo_(usuario) {
  var v = aba_('Historico').getDataRange().getValues();
  for (var i = v.length - 1; i >= 1; i--) if (v[i][0] === usuario) return new Date(v[i][2]);
  return null;
}
function texto_(v) { return String(v == null ? '' : v).replace(/^'/, ''); }
function registrar_(acao, usuario, detalhe) {
  aba_('Registro').appendRow([new Date(), acao, usuario, "'" + String(detalhe).slice(0, 200)]);
}
function saida_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
