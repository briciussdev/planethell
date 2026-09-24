/* PlanetHell — a ficha no navegador. Depende de dados.js, rolagens.js, regras.js, armazem.js e exportar.js. */
(function () {
  'use strict';
  var PH = window.PH, R = window.PHR, ST = window.PHStore, ROL = window.PH_ROLAGENS;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var num = R.num;

  /* ---------------- estado ---------------- */
  var S = { sessao: null, ficha: null, rev: 0, pendente: false, timer: null, enviando: false, retry: null, ultimo: null };
  var F = function () { return S.ficha; };

  /* ---------------- utilidades de DOM (nenhum texto do jogador passa por innerHTML) ---------------- */
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k]; if (v === undefined || v === null || v === false) return;
      if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;                 // só para textos do guia, já escapados
      else if (k === 'on') Object.keys(v).forEach(function (ev) { e.addEventListener(ev, v[ev]); });
      else if (k === 'class') e.className = v;
      else if (k === 'value') e.value = v;
      else if (k === 'checked') e.checked = !!v;
      else e.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  /* textos do guia: **negrito** e *itálico*, depois de escapar */
  function md(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>'); }
  function opts(sel, lista, vazio) {
    sel.innerHTML = '';
    if (vazio !== undefined) sel.appendChild(el('option', { value: '', text: vazio }));
    lista.forEach(function (o) { var v = typeof o === 'object' ? o.v : o, t = typeof o === 'object' ? o.t : o; sel.appendChild(el('option', { value: v, text: t })); });
  }
  function getP(obj, path) { return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj); }
  function setP(obj, path, v) { var ks = path.split('.'), last = ks.pop(); var o = ks.reduce(function (o, k) { return o[k]; }, obj); o[last] = v; }
  function field(label, input, cls) { var id = input.id || ('c' + Math.random().toString(36).slice(2, 9)); input.id = id; return el('div', { class: 'f' + (cls ? ' ' + cls : '') }, [el('label', { for: id, text: label }), input]); }
  function hoje() { var d = new Date(); return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear(); }

  /* ---------------- bolinhas ---------------- */
  function dots(valor, max, onSet, opt) {
    opt = opt || {};
    var box = el('span', { class: 'dots', role: 'group' });
    for (var i = 1; i <= max; i++) (function (i) {
      var b = el('button', { type: 'button', class: 'dot' + (i <= valor ? ' on' : '') + (opt.cap && i > opt.cap ? ' cap' : ''), 'aria-label': (opt.rot || 'valor') + ' ' + i, 'aria-pressed': i <= valor ? 'true' : 'false' });
      b.addEventListener('click', function () { var novo = (valor === i) ? i - 1 : i; if (opt.min !== undefined) novo = Math.max(opt.min, novo); onSet(novo); });
      box.appendChild(b);
    })(i);
    return box;
  }

  /* ============================================================ ENTRADA ============================================================ */
  function mostrarPainel(qual) {
    $$('.tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === qual); });
    $$('[data-painel]').forEach(function (p) { p.hidden = p.dataset.painel !== qual; });
    $('#p-pin').hidden = true;
  }
  function msg(id, texto, tipo) { var m = $(id); m.textContent = texto || ''; m.className = 'msg' + (tipo ? ' ' + tipo : ''); }
  function travar(form, sim) { $$('button,input,select', form).forEach(function (x) { x.disabled = sim; }); }

  function iniciarEntrada() {
    $$('.tabs button').forEach(function (b) { b.addEventListener('click', function () { mostrarPainel(b.dataset.tab); }); });
    opts($('#r-raca'), Object.keys(PH.racas), 'Escolha a raça');
    if (ST.modo === 'local') $('#aviso-local').hidden = false;

    $('#f-entrar').addEventListener('submit', function (e) {
      e.preventDefault(); var fm = e.target; travar(fm, true); msg('#m-entrar', 'Entrando…');
      ST.chamar({ acao: 'entrar', usuario: $('#e-usuario').value, pin: $('#e-pin').value }).then(function (r) {
        travar(fm, false);
        if (!r.ok) return msg('#m-entrar', r.erro, 'err');
        msg('#m-entrar', ''); $('#e-pin').value = '';
        abrir({ usuario: r.usuario, nome: r.nome, token: r.token }, r);
      });
    });
    $('#f-criar').addEventListener('submit', function (e) {
      e.preventDefault(); var fm = e.target; travar(fm, true); msg('#m-criar', 'Criando…');
      ST.chamar({ acao: 'criar', usuario: $('#c-usuario').value, nome: $('#c-nome').value }).then(function (r) {
        travar(fm, false);
        if (!r.ok) return msg('#m-criar', r.erro, 'err');
        msg('#m-criar', '');
        $('#f-criar').hidden = true; $('#p-pin').hidden = false;
        $('#pin-novo').textContent = r.pin; $('#pin-usuario').textContent = r.usuario;
        $('#pin-ok').onclick = function () { abrir({ usuario: r.usuario, nome: r.nome, token: r.token }, { rev: 0, ficha: null }, true); };
      });
    });
    $('#f-recuperar').addEventListener('submit', function (e) {
      e.preventDefault(); var fm = e.target, out = $('#r-resultado'); out.innerHTML = ''; travar(fm, true); msg('#m-recuperar', 'Procurando…');
      ST.chamar({ acao: 'recuperar', personagem: $('#r-personagem').value, raca: $('#r-raca').value }).then(function (r) {
        travar(fm, false);
        if (!r.ok) return msg('#m-recuperar', r.erro, 'err');
        msg('#m-recuperar', r.contas.length > 1 ? 'Há mais de uma ficha com esse nome e raça:' : 'Achamos a sua ficha:', 'ok');
        r.contas.forEach(function (c) {
          out.appendChild(el('div', { class: 'card', style: 'margin-top:8px' }, [
            el('div', {}, ['Usuário: ', el('b', { text: c.usuario }), ' (', c.nome, ')']),
            el('div', { class: 'pin-show', text: c.pin }),
            el('button', { class: 'btn small', type: 'button', text: 'Entrar com este PIN', on: { click: function () { mostrarPainel('entrar'); $('#e-usuario').value = c.usuario; $('#e-pin').value = c.pin; } } })
          ]));
        });
      });
    });
  }

  /* ============================================================ ABRIR / SALVAR ============================================================ */
  function abrir(sessao, doServidor, nova) {
    S.sessao = sessao; ST.guardarSessao(sessao);
    var copia = ST.copia(sessao.usuario);
    var ficha, rev;
    if (doServidor) {
      rev = num(doServidor.rev);
      if (copia && copia.pendente && num(copia.rev) === rev && copia.ficha) { ficha = copia.ficha; S.pendente = true; }   // edições feitas offline ainda não enviadas
      else { ficha = doServidor.ficha || R.novaFicha(); S.pendente = !doServidor.ficha; }
    } else if (copia && copia.ficha) { ficha = copia.ficha; rev = num(copia.rev); S.pendente = !!copia.pendente; }
    else { ficha = R.novaFicha(); rev = 0; S.pendente = true; }
    S.ficha = R.completar(ficha); S.rev = rev;
    S.ficha.id.jogador = sessao.nome || S.ficha.id.jogador;
    $('#gate').hidden = true;
    $('#who').innerHTML = ''; $('#who').appendChild(el('span', {}, ['Jogador ', el('b', { text: sessao.nome || sessao.usuario }), ' · ', sessao.usuario]));
    renderTudo();
    guardarCopia();
    if (!doServidor) sincronizarAoAbrir();
    else if (S.pendente) agendar(800);
    else sync('Salvo', '');
  }

  function sincronizarAoAbrir() {
    sync('Conferindo o servidor…', '');
    ST.chamar({ acao: 'carregar', usuario: S.sessao.usuario, token: S.sessao.token }).then(function (r) {
      if (r.sessao === false) return pedirLogin(r.erro);
      if (!r.ok) return sync(r.rede ? 'Offline — salvo no aparelho' : r.erro, 'warn');
      if (num(r.rev) === S.rev) { if (S.pendente) agendar(300); else sync('Salvo', ''); return; }
      if (num(r.rev) > S.rev && !S.pendente) { S.ficha = R.completar(r.ficha || R.novaFicha()); S.ficha.id.jogador = S.sessao.nome; S.rev = num(r.rev); guardarCopia(); renderTudo(); sync('Atualizada do servidor', ''); return; }
      conflito({ rev: r.rev, ficha: r.ficha });
    });
  }

  function guardarCopia() { ST.guardarCopia(S.sessao.usuario, { ficha: S.ficha, rev: S.rev, pendente: S.pendente, quando: Date.now() }); }
  function sync(t, cls) { var s = $('#sync'); s.textContent = t; s.className = 'sync' + (cls ? ' ' + cls : ''); }
  function agendar(ms) { clearTimeout(S.timer); S.timer = setTimeout(function () { enviar(false); }, ms == null ? 2500 : ms); }

  function mudou() {
    S.pendente = true; guardarCopia(); recalcular();
    sync(ST.modo === 'servidor' ? 'Alterações não enviadas…' : 'Salvando…', 'warn');
    agendar();
  }

  function enviar(marco) {
    if (!S.sessao) return Promise.resolve();
    if (S.enviando) { agendar(1200); return Promise.resolve(); }
    S.enviando = true; clearTimeout(S.retry);
    var enviada = JSON.stringify(S.ficha);
    sync('Salvando…', 'warn');
    return ST.chamar({ acao: 'salvar', usuario: S.sessao.usuario, token: S.sessao.token, rev: S.rev, ficha: JSON.parse(enviada), marco: !!marco }).then(function (r) {
      S.enviando = false;
      if (r.ok) {
        S.rev = r.rev;
        if (JSON.stringify(S.ficha) === enviada) S.pendente = false; else agendar(800);
        guardarCopia(); S.ultimo = new Date();
        sync((marco ? 'Salvo com cópia · ' : 'Salvo · ') + S.ultimo.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), '');
      } else if (r.conflito) conflito(r);
      else if (r.sessao === false) pedirLogin(r.erro);
      else { sync(r.rede ? 'Offline — salvo no aparelho' : ('Erro: ' + r.erro), r.rede ? 'warn' : 'err'); if (r.rede) S.retry = setTimeout(function () { enviar(false); }, 30000); }
      return r;
    });
  }

  function conflito(r) {
    modal([
      el('h2', { text: 'Versão mais nova em outro lugar' }),
      el('p', { class: 'note', text: 'Esta ficha foi salva em outro aparelho (ou outra aba) depois que você a abriu aqui. Nada foi perdido: as duas versões ficam no histórico. Qual você quer manter aberta?' }),
      el('div', { class: 'acts' }, [
        el('button', { class: 'btn', type: 'button', text: 'Abrir a mais nova', on: { click: function () { fecharModal(); S.ficha = R.completar(r.ficha || R.novaFicha()); S.ficha.id.jogador = S.sessao.nome; S.rev = num(r.rev); S.pendente = false; guardarCopia(); renderTudo(); sync('Versão mais nova aberta', ''); } } }),
        el('button', { class: 'btn ghost', type: 'button', text: 'Manter a deste aparelho', on: { click: function () {
          fecharModal();
          ST.chamar({ acao: 'salvar', usuario: S.sessao.usuario, token: S.sessao.token, rev: S.rev, ficha: S.ficha, forcar: true, marco: true }).then(function (x) {
            if (x.ok) { S.rev = x.rev; S.pendente = false; guardarCopia(); sync('Salvo · a outra versão foi para o histórico', ''); } else sync('Erro: ' + x.erro, 'err');
          });
        } } })
      ])
    ]);
  }

  function pedirLogin(texto) {
    sync('Sessão expirada', 'err');
    guardarCopia();                       // o que foi digitado continua guardado no aparelho
    $('#gate').hidden = false; mostrarPainel('entrar');
    $('#e-usuario').value = S.sessao ? S.sessao.usuario : '';
    msg('#m-entrar', (texto || 'Entre de novo.') + ' O que você editou está guardado e será enviado.', 'err');
  }

  function sair() {
    var fim = function () {
      if (S.sessao) ST.chamar({ acao: 'sair', usuario: S.sessao.usuario, token: S.sessao.token });
      ST.esquecerSessao(); S.sessao = null; S.ficha = null;
      $('#gate').hidden = false; mostrarPainel('entrar'); msg('#m-entrar', 'Você saiu. A ficha está salva.', 'ok');
    };
    if (S.pendente) enviar(true).then(function (r) { if (r && r.ok) fim(); else if (confirm('A última alteração ainda não chegou ao servidor. Ela continua guardada neste aparelho. Sair mesmo assim?')) fim(); });
    else fim();
  }

  /* ---------------- modal ---------------- */
  function modal(kids) { var b = $('#modal-box'); b.innerHTML = ''; kids.forEach(function (k) { b.appendChild(k); }); $('#modal').hidden = false; }
  function fecharModal() { $('#modal').hidden = true; }
  $('#modal').addEventListener('click', function (e) { if (e.target.id === 'modal') fecharModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('#modal').hidden) fecharModal(); });

  /* ============================================================ LIGAÇÕES SIMPLES ============================================================ */
  function ligarCampos() {
    $$('[data-b]').forEach(function (inp) {
      var ev = inp.tagName === 'SELECT' ? 'change' : 'input';
      inp.addEventListener(ev, function () {
        setP(F(), inp.dataset.b, inp.value);
        if (inp.dataset.b === 'raca' || inp.dataset.b === 'racaBase') {
          if (inp.dataset.b === 'raca' && inp.value !== 'Cyberpunk') F().racaBase = '';
          if (F().raca !== 'Cyberpunk' || R.opcoesAfimBase(F()).indexOf(F().afimBase) < 0) F().afimBase = '';
          if (F().raca !== 'Human') F().afimLivre = '';
          renderTudo();
        }
        if (inp.dataset.b === 'afimBase' || inp.dataset.b === 'afimLivre' || inp.dataset.b === 'atrDespertar') { renderTrilhas(); renderAtr(); }
        mudou();
      });
    });
  }
  function preencherCampos() { $$('[data-b]').forEach(function (inp) { var v = getP(F(), inp.dataset.b); inp.value = v == null ? '' : v; }); }

  /* ============================================================ RENDER ============================================================ */
  function renderTudo() {
    opts($('#i-afimbase'), R.opcoesAfimBase(F()), 'Escolha uma');
    opts($('#i-afimlivre'), R.opcoesAfimLivre(), 'Escolha uma');
    opts($('#i-atrdesp'), R.ATR, 'Escolha');
    preencherCampos();
    $('#w-base').hidden = F().raca !== 'Cyberpunk';
    $('#w-afimbase').hidden = !(F().raca === 'Cyberpunk' && F().racaBase);
    $('#w-afimlivre').hidden = F().raca !== 'Human';
    $('#w-atrdesp').hidden = num(F().despertar) < 4;
    renderAtr(); renderPer(); renderEsp(); renderTrilhas(); renderVD('vant'); renderVD('def');
    renderConvic(); renderArmas(); renderBlind(); renderItens(); renderCons(); renderMoral(); renderDesp();
    renderXPlog(); prepararCompra(); prepararRolador();
    $$('.modo button').forEach(function (b) { b.classList.toggle('on', b.dataset.modo === (F().modo || 'criacao')); });
    recalcular();
  }

  /* partes que só dependem de números: redesenhadas a cada mudança sem roubar o foco de ninguém */
  function recalcular() {
    var f = F(); if (!f) return;
    var d = R.derivados(f);
    f.xp.total = xpTotal();
    renderRacaInfo(d); renderStats(d); renderTracks(d); renderMoralInfo(d); renderDespInfo();
    renderContadores(d); renderCheck(); renderXPstats(); atualizarRolador();
  }

  /* ---------------- raça ---------------- */
  function renderRacaInfo(d) {
    var f = F(), r = R.raca(f), box = $('#raca-info'); box.innerHTML = '';
    $('#raca-aux').textContent = r ? 'Tamanho ' + d.tamanho + ' · ' + r.vida : '';
    if (!r) { box.appendChild(el('p', { class: 'note', text: 'Escolha a raça para ver Tamanho, Trilhas afins, Falha, Compulsão e Vantagens raciais.' })); return; }
    var af = R.afins(f);
    var kv = el('dl', { class: 'kv' }, [
      el('dt', { text: 'Tamanho' }), el('dd', { text: String(d.tamanho) + (d.tamanho !== r.tam ? ' (base ' + r.tam + ', ajustado por Vantagem/Defeito)' : '') }),
      el('dt', { text: 'Longevidade' }), el('dd', { text: r.vida }),
      el('dt', { text: 'Trilhas afins' }), el('dd', {}, r.afins.map(function (a) { return el('span', { class: 'tag', text: a }); }).concat(af.nomes.length && f.raca === 'Cyberpunk' && R.racaBase(f) ? [el('span', { class: 'note', text: ' da raça-base: ' + R.racaBase(f).afins.join(', ') })] : [])),
      el('dt', { text: 'Quirk' }), el('dd', { text: r.quirk ? 'Sim — criada com o Narrador (seção 9)' : 'Não' })
    ]);
    box.appendChild(kv);
    var cols = el('div', { class: 'cols2' });
    var esq = el('div', { class: 'list' }), dir = el('div', { class: 'list' });
    R.falhas(f).forEach(function (x) {
      var det = PH.detalhe[x.nome];
      esq.appendChild(el('div', { class: 'card falha' }, [el('div', { class: 'ttl', text: 'Falha · ' + x.nome }), el('div', { html: md(x.txt) }), el('div', { class: 'note', text: 'de ' + x.de })]
        .concat(det ? [el('details', {}, [el('summary', { text: 'Em detalhe' }), el('div', { html: md(det) })])] : [])));
    });
    R.compulsoes(f).forEach(function (c) {
      esq.appendChild(el('div', { class: 'card comp' }, [el('div', { class: 'ttl', text: 'Compulsão · ' + c.nome }),
        el('div', { html: '<b>Impulso:</b> ' + md(c.impulso || '') }), el('div', { html: '<b>Em combate:</b> ' + md(c.combate || '') }), el('div', { html: '<b>Fora de combate:</b> ' + md(c.fora || '') }),
        el('div', { class: 'note', text: 'Dispara com ' + d.limiarCompulsao + ' uns nos dados de Tensão. Dita a sua próxima ação; recusar custa 1 superficial de Vontade e −2 dados, turno a turno.' })]));
    });
    r.vantagens.forEach(function (v) {
      var det = PH.detalhe[v.nome];
      dir.appendChild(el('div', { class: 'card vant' }, [el('div', { class: 'ttl', text: 'Vantagem racial · ' + v.nome }), el('div', { html: md(v.txt) })]
        .concat(det ? [el('details', {}, [el('summary', { text: 'Em detalhe' }), el('div', { html: md(det) })])] : [])));
    });
    if (r.ascensao) dir.appendChild(el('div', { class: 'card asc' }, [el('div', { class: 'ttl', text: 'Ascensão (Despertar 5) · ' + r.ascensao.nome }),
      el('div', { html: '<b>Ganha:</b> ' + md(r.ascensao.ganha) }), el('div', { html: '<b>Vem junto:</b> ' + md(r.ascensao.preco) })]));
    cols.appendChild(esq); cols.appendChild(dir); box.appendChild(cols);
  }

  /* ---------------- atributos e perícias ---------------- */
  var GR_ATR = [['Físicos', 'Físico'], ['Sociais', 'Social'], ['Mentais', 'Mental']];
  function renderAtr() {
    var box = $('#atr'); box.innerHTML = '';
    GR_ATR.forEach(function (g) {
      var col = el('div', {}, [el('p', { class: 'grpt', text: g[0] })]);
      PH.atributos.filter(function (a) { return a.grupo === g[1]; }).forEach(function (a) {
        var v = num(F().atr[a.nome]);
        col.appendChild(el('div', { class: 'trait' + (v ? '' : ' zero') }, [el('span', { class: 'n' }, [a.nome, el('small', { text: a.cat })]),
          dots(v, R.capAtributo(F(), a.nome), function (n) { F().atr[a.nome] = n; renderAtr(); mudou(); }, { rot: a.nome, cap: 5 })]));
      });
      box.appendChild(col);
    });
  }
  var GR_PER = [['Físicas', 'Física'], ['Sociais', 'Social'], ['Mentais', 'Mental']];
  function renderPer() {
    var box = $('#per'); box.innerHTML = '';
    GR_PER.forEach(function (g) {
      var col = el('div', {}, [el('p', { class: 'grpt', text: g[0] })]);
      PH.pericias.filter(function (p) { return p.grupo === g[1]; }).forEach(function (p) {
        var v = num(F().per[p.nome]);
        var esp = F().esp.filter(function (e) { return e.pericia === p.nome && (e.nome || '').trim(); }).map(function (e) { return e.nome; });
        col.appendChild(el('div', { class: 'trait' + (v ? '' : ' zero') }, [el('span', { class: 'n' }, [p.nome].concat(esp.length ? [el('small', { text: '(' + esp.join(', ') + ')' })] : [])),
          dots(v, 5, function (n) { F().per[p.nome] = n; renderPer(); renderEspSelects(); mudou(); }, { rot: p.nome })]));
      });
      box.appendChild(col);
    });
  }
  function renderEsp() {
    var box = $('#esp'); box.innerHTML = '';
    F().esp.forEach(function (e, i) {
      var sel = el('select', {}); opts(sel, R.PER, 'Perícia'); sel.value = e.pericia || '';
      sel.addEventListener('change', function () { e.pericia = sel.value; renderPer(); mudou(); });
      var nome = el('input', { value: e.nome || '', placeholder: 'ex.: Trauma de combate' });
      nome.addEventListener('input', function () { e.nome = nome.value; mudou(); });
      nome.addEventListener('change', renderPer);
      box.appendChild(el('div', { class: 'item' }, [el('div', { class: 'top' }, [field('Perícia', sel), field('Especialização', nome), rem('esp', i)])]));
    });
  }
  function renderEspSelects() { /* nada a refazer: os selects listam todas as perícias */ }

  /* ---------------- derivados ---------------- */
  function stat(k, v, s, modKey) {
    var kids = [el('div', { class: 'k', text: k }), el('div', { class: 'v', text: v }), el('div', { class: 's', text: s || '' })];
    if (modKey) {
      var m = el('input', { type: 'number', value: num(F().mods[modKey]) || '', placeholder: '±', 'aria-label': 'Ajuste manual de ' + k, title: 'Ajuste manual (Trilhas, efeitos temporários, decisões do Narrador)' });
      m.addEventListener('change', function () { F().mods[modKey] = num(m.value); mudou(); });
      kids.push(m);
    }
    return el('div', { class: 'stat' }, kids);
  }
  function renderStats(d) {
    var box = $('#stats'); box.innerHTML = '';
    var f = F(), b = d.blindagem;
    box.appendChild(stat('Tamanho', d.tamanho || '—', f.raca ? 'pela raça' : 'escolha a raça'));
    box.appendChild(stat('Saúde', d.saude.total || '—', 'Vigor ' + num(f.atr['Vigor']) + ' + Tamanho ' + d.tamanho, 'saude'));
    box.appendChild(stat('Vontade', d.fv.total || '—', ['Autocontrole + Perseverança'].concat(d.fv.extras).join(' · '), 'fv'));
    box.appendChild(stat('Tensão', d.tensao || '—', 'dados = Autocontrole'));
    box.appendChild(stat('Iniciativa', d.ini.total ? d.ini.total + ' +1d10' : '—', 'Destreza + Autocontrole', 'ini'));
    box.appendChild(stat('Deslocamento', d.desl.total > 5 ? d.desl.total + ' m' : '—', 'Força + Destreza + 5', 'desl'));
    box.appendChild(stat('Blindagem', String(b.valor || 0), b.valor ? (b.tipo === 'magitek' ? 'Magitek' : b.tipo) + ' · ' + (b.fonte || '') + (b.bulwark ? ' + Bulwark ' + b.bulwark : '') : 'nenhuma'));
  }
  function track(id, arr, n, onChange) {
    var box = $(id); box.innerHTML = '';
    for (var i = 0; i < n; i++) (function (i) {
      var v = num(arr[i]);
      var b = el('button', { type: 'button', class: 'box' + (v ? ' s' + v : ''), text: v === 1 ? '/' : v === 2 ? 'X' : '', 'aria-label': 'Caixa ' + (i + 1) + ': ' + (v === 1 ? 'superficial' : v === 2 ? 'agravado' : 'vazia') });
      b.addEventListener('click', function () { arr[i] = (num(arr[i]) + 1) % 3; onChange(); });
      box.appendChild(b);
    })(i);
  }
  function estadoTrilha(arr, n) {
    var sup = 0, agr = 0; for (var i = 0; i < n; i++) { if (num(arr[i]) === 1) sup++; if (num(arr[i]) === 2) agr++; }
    return { sup: sup, agr: agr, cheia: n > 0 && sup + agr >= n, morta: n > 0 && agr >= n };
  }
  function renderTracks(d) {
    var f = F();
    track('#t-saude', f.saude, d.saude.total, mudou); track('#t-fv', f.fv, d.fv.total, mudou);
    var s = estadoTrilha(f.saude, d.saude.total), v = estadoTrilha(f.fv, d.fv.total);
    var ss = $('#st-saude'), sv = $('#st-fv');
    ss.className = 'status' + (s.morta ? ' err' : s.cheia ? ' warn' : '');
    ss.textContent = s.morta ? (f.raca === 'Mecha' ? 'Trilha cheia de agravado: destruição.' : 'Trilha cheia de agravado: morte ou destruição.')
      : s.cheia ? 'Debilitado: −2 dados em todas as paradas físicas. Cada ponto novo converte um superficial em agravado.'
      : (s.sup + s.agr ? s.sup + ' superficial, ' + s.agr + ' agravado' : '');
    sv.className = 'status' + (v.morta ? ' err' : v.cheia ? ' err' : '');
    sv.textContent = v.morta ? 'O personagem quebra e sai de cena.'
      : v.cheia ? 'Debilitado: −2 em sociais e mentais, e NENHUM PODER PODE SER ATIVADO.'
      : (v.sup + v.agr ? v.sup + ' superficial, ' + v.agr + ' agravado' : '');
  }

  /* ---------------- moralidade e despertar ---------------- */
  function renderMoral() {
    var f = F(), box = $('#d-moral'), d = R.derivados(f);
    box.replaceWith(el('span', { class: 'dots', id: 'd-moral' }, [dots(num(f.moral), 10, function (n) { f.moral = Math.min(n, d.moralMax); renderMoral(); mudou(); }, { rot: 'Moralidade', cap: d.moralMax, min: 0 })]));
  }
  function renderMoralInfo(d) {
    var f = F(), m = num(f.moral);
    var e = PH.moralidade.filter(function (x) { var p = x.faixa.split(/ a /).map(Number); return p.length > 1 ? m >= p[0] && m <= p[1] : m === p[0]; })[0];
    $('#moral-estado').textContent = e ? e.estado + (e.efeito && e.efeito !== '—' ? ' · ' + e.efeito : '') : '';
    $('#o-manchas').textContent = num(f.manchas);
    $('#moral-nota').textContent = 'Teste de Remorso no fim da sessão, se houver Manchas: parada ' + Math.max(0, m - num(f.manchas)) + ' (Moralidade − Manchas).' + (f.raca === "Han'you" && d.moralMax === 7 ? " Han'you: nunca acima de 7." : '');
  }
  function renderDesp() {
    var f = F();
    $('#d-desp').replaceWith(el('span', { class: 'dots', id: 'd-desp' }, [dots(num(f.despertar), 5, function (n) { f.despertar = n; $('#w-atrdesp').hidden = n < 4; renderDesp(); renderAtr(); renderMoral(); mudou(); }, { rot: 'Despertar', min: 0 })]));
  }
  function renderDespInfo() {
    var f = F(), n = num(f.despertar), box = $('#desp-info'); box.innerHTML = '';
    if (!n) { box.textContent = 'Começa em 0. Não se compra com experiência: só se conquista com três ou mais 10 nos dados de Tensão.'; return; }
    PH.despertar.filter(function (x) { return x.nivel <= n; }).forEach(function (x) { box.appendChild(el('div', { html: '<b>' + x.nivel + ':</b> ' + md(x.txt) })); });
    var r = R.raca(f); if (n >= 5 && r && r.ascensao) box.appendChild(el('div', { html: '<b>Ascensão — ' + esc(r.ascensao.nome) + '.</b> ' + md(r.ascensao.ganha) }));
  }
  function renderCons() {
    var box = $('#cons'); box.innerHTML = '';
    F().consequencias.forEach(function (c, i) {
      var sel = el('select', {}); opts(sel, PH.consequencias.map(function (x) { return { v: x.d, t: x.d + ' · ' + x.txt.replace(/\*\*/g, '').split('.')[0] }; }), 'Consequência'); sel.value = c.d || '';
      sel.addEventListener('change', function () { c.d = num(sel.value); renderCons(); mudou(); });
      var nota = el('input', { value: c.nota || '', placeholder: 'O que aconteceu' }); nota.addEventListener('input', function () { c.nota = nota.value; mudou(); });
      var info = PH.consequencias.filter(function (x) { return x.d === num(c.d); })[0];
      box.appendChild(el('div', { class: 'item' }, [el('div', { class: 'top' }, [field('d10', sel), field('Detalhe', nota), rem('consequencias', i)]), info ? el('div', { class: 'desc', html: md(info.txt) }) : null]));
    });
  }

  /* ---------------- trilhas ---------------- */
  var TIPOS_TRILHA = Object.keys(PH.trilhas);
  function renderTrilhas() {
    var box = $('#trilhas'); box.innerHTML = '';
    F().trilhas.forEach(function (t, i) {
      if (!t.niveis || t.niveis.length !== 5) t.niveis = [0, 1, 2, 3, 4].map(function (k) { return (t.niveis && t.niveis[k]) || { nome: '', efeito: '' }; });
      var tipo = el('select', {}); opts(tipo, TIPOS_TRILHA.map(function (x) { return { v: x, t: x }; }).concat([{ v: 'Quirk', t: 'Quirk (poder único)' }, { v: 'Outra', t: 'Outra' }]), 'Trilha');
      tipo.value = t.tipo || '';
      tipo.addEventListener('change', function () { t.tipo = tipo.value; renderTrilhas(); mudou(); });
      var nome = el('input', { value: t.nome || '', placeholder: t.tipo === 'Quirk' ? 'Nome da Quirk (ex.: STILL)' : 'Apelido (opcional)', list: t.tipo === 'Quirk' ? 'dl-quirks' : null });
      nome.addEventListener('input', function () { t.nome = nome.value; mudou(); });
      nome.addEventListener('change', function () {
        var q = PH.quirks.filter(function (x) { return x.nome.toLowerCase() === nome.value.trim().toLowerCase(); })[0];
        if (q && t.tipo === 'Quirk' && t.niveis.every(function (l) { return !l.efeito; })) { t.niveis = q.niveis.map(function (e) { return { nome: '', efeito: e }; }); renderTrilhas(); mudou(); }
      });
      var afim = t.tipo ? R.trilhaAfim(F(), t) : null;
      var badge = el('span', { class: 'badge ' + (afim ? 'ok' : t.tipo ? 'no' : ''), text: afim ? 'AFIM · ×5' : t.tipo ? 'NÃO AFIM · ×7' : '—' });
      var niv = el('div', { class: 'f sm' }, [el('span', { class: 'lbl', text: 'Nível' }), dots(num(t.nivel), 5, function (n) { t.nivel = n; renderTrilhas(); mudou(); }, { rot: 'Nível', min: 0 })]);
      var lv = el('div', { class: 'levels' });
      var custos = ['grátis', '1 superficial', '1 superficial', '2 superficiais', '1 agravado · 1×/cena'];
      for (var k = 0; k < 5; k++) (function (k) {
        var on = num(t.nivel) > k, fixo = PH.trilhas[t.tipo];
        var linha = el('div', { class: 'lv' + (on ? ' on' : '') }, [el('span', { class: 'ln', text: 'N' + (k + 1) })]);
        if (fixo) linha.appendChild(el('span', { class: 'fixed', html: md(fixo.niveis[k]) }));
        else {
          var n2 = el('input', { value: t.niveis[k].nome || '', placeholder: 'Nome do poder', 'aria-label': 'Nome do nível ' + (k + 1) });
          n2.addEventListener('input', function () { t.niveis[k].nome = n2.value; mudou(); });
          var e2 = el('input', { class: 'efeito', value: t.niveis[k].efeito || '', placeholder: (PH.moldeQuirk[k] || 'Efeito').replace(/\*+/g, ''), 'aria-label': 'Efeito do nível ' + (k + 1) });
          e2.addEventListener('input', function () { t.niveis[k].efeito = e2.value; mudou(); });
          linha.appendChild(n2); linha.appendChild(e2);
        }
        linha.appendChild(el('span', { class: 'cost', text: custos[k] }));
        lv.appendChild(linha);
      })(k);
      box.appendChild(el('div', { class: 'item' }, [el('div', { class: 'top' }, [field('Trilha', tipo), field(t.tipo === 'Quirk' ? 'Nome' : 'Apelido', nome), niv, badge, rem('trilhas', i)]), lv]));
    });
  }

  /* ---------------- vantagens e defeitos ---------------- */
  function segundaDupla(v) { var l = F().vant, i = l.indexOf(v); return R.norm(v.nome) === 'segunda quirk' && l.slice(0, i).some(function (x) { return R.norm(x.nome) === 'segunda quirk'; }); }
  function catalogo(kind) { return kind === 'vant' ? PH.vantagens : PH.defeitos; }
  function renderVD(kind) {
    var box = $('#' + kind); box.innerHTML = '';
    F()[kind].forEach(function (v, i) {
      var cat = catalogo(kind).filter(function (x) { return R.norm(x.nome) === R.norm(v.nome); })[0];
      var nome = el('input', { value: v.nome || '', list: 'dl-' + kind, placeholder: kind === 'vant' ? 'Escolha ou escreva' : 'Escolha ou escreva' });
      nome.addEventListener('input', function () { v.nome = nome.value; mudou(); });
      nome.addEventListener('change', function () {
        var c = catalogo(kind).filter(function (x) { return R.norm(x.nome) === R.norm(nome.value); })[0];
        if (c) { v.nome = c.nome; if (!v.nova && (!v.pts || num(v.pts) < c.min || num(v.pts) > c.max)) v.pts = c.opcoes ? c.opcoes[0] * (segundaDupla(v) ? 2 : 1) : c.min; }
        renderVD(kind); mudou();
      });
      var pts;
      if (v.nova) pts = el('input', { value: num(v.pts) ? v.pts : '0', readonly: true, title: 'Comprada em jogo: suba pela seção Experiência' });
      else if (cat && cat.opcoes) { pts = el('select', {}); opts(pts, cat.opcoes.map(function (o) { return String(o * (segundaDupla(v) ? 2 : 1)); })); }
      else if (cat && cat.min === cat.max) pts = el('input', { value: cat.min, readonly: true });
      else if (cat) { pts = el('select', {}); var o = []; for (var n = cat.min; n <= cat.max; n++) o.push(String(n)); opts(pts, o); }
      else pts = el('input', { type: 'number', min: 1, max: 10, placeholder: 'pts' });
      if (!v.nova) pts.value = v.pts || (cat ? (cat.opcoes ? cat.opcoes[0] : cat.min) : '');
      if (cat && !v.pts && !v.nova) v.pts = cat.opcoes ? cat.opcoes[0] * (segundaDupla(v) ? 2 : 1) : cat.min;
      pts.addEventListener('change', function () { v.pts = num(pts.value); mudou(); });
      var nota = el('input', { value: v.nota || '', placeholder: 'Detalhe: quem, onde, qual' }); nota.addEventListener('input', function () { v.nota = nota.value; mudou(); });
      var kids = [el('div', { class: 'top' }, [field(kind === 'vant' ? 'Vantagem' : 'Defeito', nome), field('Pontos', pts, 'sm pts'), rem(kind, i)]), field('Detalhe', nota)];
      if (v.nova) kids.push(el('div', { class: 'desc', text: num(v.pts) ? 'Comprada com experiência.' : 'Vantagem nova em jogo: compre na seção Experiência (novo valor × 3).' }));
      if (cat && segundaDupla(v)) kids.push(el('div', { class: 'desc', text: 'Terceira Quirk: custa o dobro e exige Despertar 2 ou mais.' }));
      if (cat) kids.push(el('div', { class: 'desc', html: '<b>' + esc(cat.custo) + ' pt.</b> ' + md(cat.txt) }));
      else if ((v.nome || '').trim()) {
        var desc = el('input', { value: v.desc || '', placeholder: 'Efeito, como combinado com o Narrador' }); desc.addEventListener('input', function () { v.desc = desc.value; mudou(); });
        kids.push(el('div', { class: 'desc', text: kind === 'vant' ? 'Vantagem de outro sistema de RPG — combine a pertinência e o valor com o Narrador.' : 'Defeito de outro sistema de RPG — combine a pertinência e o valor com o Narrador.' }));
        kids.push(field('Efeito', desc));
      }
      box.appendChild(el('div', { class: 'item ' + (kind === 'vant' ? 'vt' : 'df') }, kids));
    });
  }

  /* ---------------- convicções e equipamento ---------------- */
  function linhaSimples(lista, i, campos, kind) {
    var obj = F()[lista][i];
    var top = el('div', { class: 'top' }, campos.map(function (c) {
      var inp;
      if (c.opts) { inp = el('select', {}); opts(inp, c.opts); inp.value = obj[c.k] || c.opts[0].v; if (obj[c.k] === undefined) obj[c.k] = inp.value; inp.addEventListener('change', function () { obj[c.k] = inp.value; mudou(); }); }
      else { inp = el('input', { value: obj[c.k] == null ? '' : obj[c.k], type: c.n ? 'number' : null, placeholder: c.ph || '' }); inp.addEventListener('input', function () { obj[c.k] = c.n ? num(inp.value) : inp.value; mudou(); }); }
      return field(c.l, inp, c.sm ? 'sm' : '');
    }).concat([rem(lista, i)]));
    return el('div', { class: 'item' }, [top]);
  }
  function renderConvic() {
    var box = $('#convic'); box.innerHTML = '';
    F().convic.forEach(function (c, i) {
      var it = linhaSimples('convic', i, [{ k: 'txt', l: 'Convicção', ph: '"Ninguém que eu levo numa missão morre sozinho."' }, { k: 'ancora', l: 'Âncora (pessoa viva)', ph: 'Nome' }]);
      var ck = el('input', { type: 'checkbox', checked: c.suspensa }); ck.addEventListener('change', function () { c.suspensa = ck.checked; mudou(); });
      it.appendChild(el('label', { class: 'chk' }, [ck, 'Suspensa — a Âncora morreu; não apaga Mancha até ganhar outra']));
      box.appendChild(it);
    });
    $('[data-add="convic"]').hidden = F().convic.length >= 3;
  }
  function renderArmas() {
    var box = $('#armas'); box.innerHTML = '';
    F().armas.forEach(function (a, i) {
      box.appendChild(linhaSimples('armas', i, [{ k: 'nome', l: 'Arma', ph: 'Rifle' }, { k: 'dano', l: 'Dano +', n: 1, sm: 1 },
        { k: 'tipo', l: 'Tipo', opts: [{ v: 'agr', t: 'agravado' }, { v: 'sup', t: 'superficial' }] }, { k: 'perf', l: 'Perfuração', n: 1, sm: 1 },
        { k: 'ignora', l: 'Ignora Blindagem', opts: [{ v: '', t: 'não' }, { v: 'naoMagitek', t: 'a não-Magitek (DOMAIN 3+)' }, { v: 'toda', t: 'toda (divina, expurgo)' }] }, { k: 'nota', l: 'Notas', ph: 'Munição, alcance…' }]));
    });
  }
  function renderBlind() {
    var box = $('#blindagens'); box.innerHTML = '';
    F().blindagens.forEach(function (a, i) {
      box.appendChild(linhaSimples('blindagens', i, [{ k: 'nome', l: 'Peça', ph: 'Kevlar-9' }, { k: 'valor', l: 'Valor', n: 1, sm: 1 },
        { k: 'tipo', l: 'Tipo', opts: [{ v: 'leve', t: 'leve (só superficial)' }, { v: 'pesada', t: 'pesada (superficial e agravado físico)' }, { v: 'magitek', t: 'Magitek (qualquer dano)' }] }]));
    });
  }
  function renderItens() {
    var box = $('#itens'); box.innerHTML = '';
    F().itens.forEach(function (a, i) { box.appendChild(linhaSimples('itens', i, [{ k: 'nome', l: 'Item' }, { k: 'nota', l: 'Notas' }])); });
  }

  function rem(lista, i) {
    return el('button', { type: 'button', class: 'x', text: '×', 'aria-label': 'Remover', title: 'Remover', on: { click: function () {
      var arr = F()[lista], item = arr[i];
      var vazio = !item || Object.keys(item).every(function (k) { var v = item[k]; return v === '' || v == null || v === 0 || (Array.isArray(v) && v.every(function (x) { return !x || !x.nome && !x.efeito; })); });
      if (!vazio && !confirm('Remover esta linha? (Ela continua nas versões anteriores da ficha.)')) return;
      arr.splice(i, 1); renderTudo(); mudou();
    } } });
  }
  var NOVOS = {
    esp: function () { return { pericia: '', nome: '' }; }, trilhas: function () { return { tipo: '', nome: '', nivel: 0, niveis: [] }; },
    vant: function () { return F().modo === 'jogo' ? { nome: '', pts: 0, nota: '', nova: true } : { nome: '', pts: 0, nota: '' }; }, def: function () { return { nome: '', pts: 0, nota: '' }; },
    convic: function () { return { txt: '', ancora: '' }; }, armas: function () { return { nome: '', dano: 0, tipo: 'agr', perf: 0, nota: '' }; },
    blindagens: function () { return { nome: '', valor: 0, tipo: 'pesada' }; }, itens: function () { return { nome: '', nota: '' }; },
    cons: function () { return { d: 0, nota: '' }; }
  };
  $$('[data-add]').forEach(function (b) {
    b.addEventListener('click', function () {
      var k = b.dataset.add, lista = k === 'cons' ? 'consequencias' : k;
      F()[lista].push(NOVOS[k]()); renderTudo(); mudou();
      var ult = $$('#' + (k === 'cons' ? 'cons' : k) + ' .item').pop(); if (ult) { var inp = $('input,select', ult); if (inp) inp.focus(); }
    });
  });

  /* ---------------- contadores ---------------- */
  function renderContadores(d) {
    var f = F(), pt = R.pontos(f), criacao = f.modo !== 'jogo';
    var va = $('#vant-aux'); va.textContent = pt.vant + ' / ' + pt.limiteVant + ' pts'; va.className = 'aux pool' + (criacao && pt.vant > pt.limiteVant ? ' over' : criacao && pt.vant < pt.limiteVant ? ' under' : '');
    var da = $('#def-aux'); da.textContent = pt.def + ' pts (2 a 4)'; da.className = 'aux pool' + (criacao && (pt.def < 2 || pt.def > 4) ? ' over' : '');
    var vals = R.ATR.map(function (a) { return num(f.atr[a]); });
    $('#atr-aux').textContent = 'total ' + vals.reduce(function (a, b) { return a + b; }, 0) + ' / 22';
    var pp = R.perfilPericias(f);
    $('#per-aux').textContent = (pp.perfil ? 'perfil ' + pp.perfil + ' · ' : '') + pp.total + ' / 26 pontos';
    $('#esp-aux').textContent = '· ' + f.esp.filter(function (e) { return (e.nome || '').trim(); }).length + ' de ' + R.espGratis(f) + ' gratuitas';
    var niv = f.trilhas.reduce(function (a, t) { return a + num(t.nivel); }, 0);
    $('#tr-aux').textContent = criacao ? niv + ' / 3 pontos na criação (2 + 1, afins)' : '';
  }

  /* ---------------- verificação ---------------- */
  function renderCheck() {
    var L = R.verificar(F()), box = $('#ck'); box.innerHTML = '';
    var erros = L.filter(function (i) { return i.nivel === 'erro'; }).length, av = L.filter(function (i) { return i.nivel === 'aviso'; }).length;
    $('#ck-score').textContent = erros ? erros + ' pendência(s) de regra' + (av ? ', ' + av + ' aviso(s)' : '') : av ? 'Regras ok · ' + av + ' aviso(s)' : 'Tudo de acordo com o guia ✓';
    var g = '';
    L.forEach(function (i) {
      if (i.grupo !== g) { g = i.grupo; box.appendChild(el('li', { class: 'g', text: g })); }
      box.appendChild(el('li', { class: i.nivel, text: i.msg }));
    });
  }
  $$('.modo button').forEach(function (b) { b.addEventListener('click', function () {
    if (b.dataset.modo === 'jogo' && F().modo !== 'jogo' && R.verificar(F()).some(function (i) { return i.nivel === 'erro'; }) &&
        !confirm('A criação ainda tem pendências de regra. Passar para "Em jogo" mesmo assim? (Os limites de criação deixam de ser cobrados.)')) return;
    F().modo = b.dataset.modo; renderTudo(); mudou();
  }); });

  /* ============================================================ EXPERIÊNCIA ============================================================ */
  function xpTotal() {
    var f = F(), p = PH.patamares.filter(function (x) { return x.nome === f.id.patamar; })[0];
    return (p ? p.xp : 0) + (f.xp.ganhos || []).reduce(function (a, g) { return a + num(g.qtd); }, 0);
  }
  function renderXPstats() {
    var f = F(), t = xpTotal(), g = R.xpGasto(f), box = $('#xp-stats'); box.innerHTML = '';
    box.appendChild(stat('Ganho', t, 'patamar + sessões'));
    box.appendChild(stat('Gasto', g, 'compras registradas'));
    box.appendChild(stat('Disponível', t - g, t - g < 0 ? 'negativo!' : ''));
    $('#xp-aux').textContent = f.raca === 'Human' ? 'Human: Perícias pela metade' : '';
    atualizarCompra();
  }
  function renderXPlog() {
    var f = F(), box = $('#xplog'); box.innerHTML = '';
    if (!f.xp.ganhos) f.xp.ganhos = [];
    var L = f.xp.ganhos.map(function (g, i) { return { t: 'g', i: i, data: g.data, txt: '+' + num(g.qtd) + ' XP · ' + (g.nota || 'sem motivo') }; })
      .concat(f.xp.log.map(function (l, i) { return { t: 'c', i: i, data: l.data, txt: '−' + num(l.custo) + ' XP · ' + l.o }; }));
    if (!L.length) { box.appendChild(el('p', { class: 'note', text: 'Nada registrado ainda.' })); return; }
    L.forEach(function (x) {
      box.appendChild(el('div', { class: 'item' }, [el('div', { class: 'top' }, [el('span', { style: 'flex:1', text: (x.data || '') + ' · ' + x.txt }),
        el('button', { type: 'button', class: 'x', text: '×', title: x.t === 'c' ? 'Desfazer a compra' : 'Remover', on: { click: function () {
          if (x.t === 'g') { if (!confirm('Remover este ganho de XP?')) return; f.xp.ganhos.splice(x.i, 1); }
          else { var l = f.xp.log[x.i]; if (!confirm('Desfazer "' + l.o + '"? O valor volta ao anterior.')) return; desfazerCompra(l); f.xp.log.splice(x.i, 1); }
          renderTudo(); mudou();
        } } })])]));
    });
  }
  var TIPOS_COMPRA = ['Atributo', 'Perícia', 'Especialização', 'Trilha', 'Vantagem', 'Moralidade'];
  function prepararCompra() {
    var t = $('#k-tipo'); if (!t.options.length) { opts(t, TIPOS_COMPRA); t.addEventListener('change', prepararCompra); $('#k-alvo').addEventListener('change', atualizarCompra); $('#k-comprar').addEventListener('click', comprar); }
    var f = F(), a = $('#k-alvo'), tipo = t.value;
    if (tipo === 'Atributo') opts(a, R.ATR);
    else if (tipo === 'Perícia' || tipo === 'Especialização') opts(a, R.PER);
    else if (tipo === 'Trilha') opts(a, f.trilhas.map(function (x, i) { return { v: i, t: (x.tipo === 'Quirk' ? 'Quirk ' + (x.nome || '') : x.tipo || 'Trilha') + ' (' + num(x.nivel) + ')' }; }));
    else if (tipo === 'Vantagem') opts(a, f.vant.map(function (x, i) { return { v: i, t: (x.nome || 'Vantagem') + ' (' + num(x.pts) + ')' }; }));
    else opts(a, [{ v: 'moral', t: 'Moralidade (' + num(f.moral) + ')' }]);
    atualizarCompra();
  }
  function compraAtual() {
    var f = F(), tipo = $('#k-tipo').value, alvo = $('#k-alvo').value, human = f.raca === 'Human';
    if (alvo === '' || alvo == null) return null;
    if (tipo === 'Atributo') return { tipo: tipo, rot: alvo, de: num(f.atr[alvo]), max: R.capAtributo(f, alvo), calc: 'Atributo' };
    if (tipo === 'Perícia') return { tipo: tipo, rot: alvo, de: num(f.per[alvo]), max: 5, calc: 'Perícia', human: human };
    if (tipo === 'Especialização') return { tipo: tipo, rot: alvo, de: 0, max: 1, calc: 'Especialização', exige: num(f.per[alvo]) > 0 };
    if (tipo === 'Trilha') { var t = f.trilhas[num(alvo)]; if (!t) return null; var af = R.trilhaAfim(f, t); return { tipo: tipo, rot: t.tipo === 'Quirk' ? 'Quirk ' + (t.nome || '') : t.tipo, de: num(t.nivel), max: 5, calc: af ? 'Trilha afim' : 'Trilha não-afim', idx: num(alvo) }; }
    if (tipo === 'Vantagem') {
      var v = f.vant[num(alvo)]; if (!v) return null;
      var c = PH.vantagens.filter(function (x) { return R.norm(x.nome) === R.norm(v.nome); })[0], de = num(v.pts), para, custo;
      if (c && c.opcoes) { var mult = f.vant.slice(0, num(alvo)).some(function (x) { return R.norm(x.nome) === 'segunda quirk'; }) ? 2 : 1; var op = c.opcoes.map(function (o) { return o * mult; }); para = op.filter(function (o) { return o > de; })[0]; custo = para ? para * 3 : 0; }
      else if (c && c.min === c.max) { para = de ? null : c.min; custo = para ? para * 3 : 0; }
      else { para = de + 1; custo = R.xpCusto('Vantagem', de, para); }
      if (c && R.norm(c.nome) === 'gigante' && de === 0) para = null;
      return { tipo: tipo, rot: v.nome, de: de, para: para, max: para ? 99 : de, calc: 'Vantagem', idx: num(alvo), custo: custo };
    }
    return { tipo: 'Moralidade', rot: 'Moralidade', de: num(f.moral), max: R.derivados(f).moralMax, calc: 'Moralidade' };
  }
  function atualizarCompra() {
    var c = compraAtual(), f = F(), nota = $('#k-nota'), bt = $('#k-comprar');
    if (!c) { $('#k-custo').value = ''; bt.disabled = true; nota.textContent = ''; return; }
    var para = c.para != null ? c.para : c.de + 1, custo = c.custo != null ? c.custo : R.xpCusto(c.calc, c.de, para, c.human), disp = xpTotal() - R.xpGasto(f);
    $('#k-custo').value = c.de >= c.max ? '—' : custo;
    var motivo = f.modo !== 'jogo' ? 'Na criação, use as bolinhas. Passe para "Em jogo" na verificação para gastar XP.'
      : (c.de >= c.max || !para) ? (c.tipo === 'Vantagem' && /gigante/i.test(c.rot) ? 'Gigante só na criação.' : 'Já está no máximo.') : c.exige === false ? 'Precisa ter pelo menos 1 ponto na Perícia.' : custo > disp ? 'XP insuficiente (' + disp + ' disponível).' : '';
    bt.disabled = !!motivo;
    nota.textContent = motivo || (c.tipo === 'Especialização' ? 'Especialização nova em ' + c.rot + ': 3 XP.' : c.rot + ': de ' + c.de + ' para ' + para + ' (' + c.calc + (c.human ? ', Human paga metade' : '') + ').' + (c.tipo === 'Moralidade' ? ' No máximo 1 ponto por arco.' : ''));
  }
  function comprar() {
    var c = compraAtual(); if (!c) return; var f = F(), para = c.para != null ? c.para : c.de + 1, custo = c.custo != null ? c.custo : R.xpCusto(c.calc, c.de, para, c.human);
    var reg = { data: hoje(), o: c.tipo === 'Especialização' ? 'Especialização em ' + c.rot : c.rot + ' ' + c.de + '→' + para, custo: custo, tipo: c.tipo, alvo: c.idx != null ? c.idx : c.rot, de: c.de };
    if (c.tipo === 'Atributo') f.atr[c.rot] = c.de + 1;
    else if (c.tipo === 'Perícia') f.per[c.rot] = c.de + 1;
    else if (c.tipo === 'Especialização') f.esp.push({ pericia: c.rot, nome: '' });
    else if (c.tipo === 'Trilha') f.trilhas[c.idx].nivel = c.de + 1;
    else if (c.tipo === 'Vantagem') f.vant[c.idx].pts = para;
    else f.moral = c.de + 1;
    f.xp.log.push(reg); renderTudo(); mudou();
  }
  function desfazerCompra(l) {
    var f = F();
    if (l.tipo === 'Atributo') f.atr[l.alvo] = l.de;
    else if (l.tipo === 'Perícia') f.per[l.alvo] = l.de;
    else if (l.tipo === 'Trilha' && f.trilhas[l.alvo]) f.trilhas[l.alvo].nivel = l.de;
    else if (l.tipo === 'Vantagem' && f.vant[l.alvo]) f.vant[l.alvo].pts = l.de;
    else if (l.tipo === 'Moralidade') f.moral = l.de;
  }
  $('#g-add').addEventListener('click', function () {
    var q = num($('#g-qtd').value); if (q <= 0) return;
    if (!F().xp.ganhos) F().xp.ganhos = [];
    F().xp.ganhos.push({ data: hoje(), qtd: q, nota: $('#g-nota').value.trim() }); $('#g-qtd').value = ''; $('#g-nota').value = '';
    renderTudo(); mudou();
  });
  $$('[data-c]').forEach(function (b) { b.addEventListener('click', function () { var k = b.dataset.c; F()[k] = Math.max(0, Math.min(10, num(F()[k]) + num(b.dataset.d))); mudou(); }); });

  /* ============================================================ ROLADOR ============================================================ */
  var MANOBRAS = [{ v: '', t: 'Nenhuma' }, { v: 'total', t: 'Ataque total (+1 dano; −1 dado nas defesas)' }, { v: 'mira1', t: 'Mira, 1 turno (+1 dado)' }, { v: 'mira2', t: 'Mira, 2 turnos (+2)' }, { v: 'mira3', t: 'Mira, 3 turnos (+3)' },
    { v: 'alvo', t: 'Alvo específico (−2 sucessos)' }, { v: 'surpresa', t: 'Surpresa (dif. 1, sem defesa, dano ×2)' }];
  var rolReady = false;
  function tipoAtual() { var c = ROL[$('#r-cat').value]; return c ? c.tipos[$('#r-tipo').value] : null; }
  function prepararRolador() {
    if (!rolReady) {
      opts($('#r-cat'), Object.keys(ROL).map(function (k) { return { v: k, t: ROL[k].rot }; }));
      $('#r-cat').addEventListener('change', function () { popularTipos(); atualizarRolador(); });
      $('#r-tipo').addEventListener('change', atualizarRolador);
      ['#r-atr', '#r-per', '#r-arma', '#r-man', '#r-mod', '#r-dif', '#r-esp', '#r-blind', '#r-btipo'].forEach(function (s) { $(s).addEventListener('change', atualizarRolador); $(s).addEventListener('input', atualizarRolador); });
      opts($('#r-atr'), R.ATR); opts($('#r-per'), [{ v: '', t: '— sem perícia —' }].concat(R.PER.map(function (p) { return { v: p, t: p }; })));
      opts($('#r-man'), MANOBRAS);
      $('#r-go').addEventListener('click', rolarAgora);
      popularTipos(); rolReady = true;
    }
    var armas = [{ v: 'desarmado', t: 'Desarmado (+0, superficial)' }];
    if (F().raca === 'Cyberpunk') armas.push({ v: 'hardwired', t: 'Membro implantado (Hard Wired: agravado)' });
    if (F().raca === 'Youkai') { armas.push({ v: 'badbone', t: 'Bad to the Bone (desarmado agravado, +2 dados)' }); armas.push({ v: 'toque', t: 'Toque de Youkai (ignora toda Blindagem)' }); }
    F().armas.forEach(function (a, i) { if ((a.nome || '').trim()) armas.push({ v: 'a' + i, t: a.nome + ' (+' + num(a.dano) + (a.tipo === 'sup' ? ', superficial' : '') + (num(a.perf) ? ', Perf. ' + num(a.perf) : '') + (a.ignora ? ', ignora blindagem' : '') + ')' }); });
    var sel = $('#r-arma'), antes = sel.value; opts(sel, armas); sel.value = armas.some(function (a) { return a.v === antes; }) ? antes : (armas[armas.length - 1].v);
  }
  function popularTipos() { var c = ROL[$('#r-cat').value]; opts($('#r-tipo'), Object.keys(c.tipos).map(function (k) { return { v: k, t: c.tipos[k].n }; })); }
  function armaEscolhida() {
    var v = $('#r-arma').value;
    if (v === 'desarmado') return { nome: 'desarmado', dano: 0, tipo: 'sup' };
    if (v === 'hardwired') return { nome: 'membro implantado', dano: 0, tipo: 'agr' };
    if (v === 'badbone') return { nome: 'Bad to the Bone', dano: 0, tipo: 'agr', dados: 2 };
    if (v === 'toque') return { nome: 'toque de Youkai', dano: 0, tipo: 'agr', ignora: 'toda' };
    var a = F().armas[num(v.slice(1))]; return a ? { nome: a.nome, dano: num(a.dano), tipo: a.tipo || 'agr', perf: num(a.perf), ignora: a.ignora || '' } : { dano: 0, tipo: 'agr' };
  }
  function extras(t) {
    var man = $('#r-man').value;
    var arma = !$('#w-rarma').hidden ? armaEscolhida() : null;
    return { atr: (t.livre || t.trilha) ? $('#r-atr').value : null, per: (t.livre || t.trilha) ? $('#r-per').value : null, esp: $('#r-esp').checked,
      mod: num($('#r-mod').value), mira: t.dano && /^mira/.test(man) ? num(man.slice(4)) : 0,
      bonus: arma && arma.dados ? [{ rot: arma.nome, v: arma.dados }] : [] };
  }
  function atualizarRolador() {
    if (!rolReady || !F()) return;
    var t = tipoAtual(); if (!t) return;
    var ataque = $('#r-cat').value === 'ataque', contra = !!t.contra, disputa = ataque || $('#r-cat').value === 'defesa';
    $('#w-ratr').hidden = $('#w-rper').hidden = !(t.livre || t.trilha);
    $('#w-rarma').hidden = !(t.dano || contra) || !!t.trilha;
    if (t.arma === 'desarmado' && $('#r-arma').value.charAt(0) === 'a' && !$('#w-rarma').dataset.touched) $('#r-arma').value = 'desarmado';
    $('#w-rman').hidden = !ataque || !!t.trilha;
    $('#w-rblind').hidden = !(t.dano || contra);
    $('#l-dif').textContent = t.remorso ? 'Dificuldade (1 basta)' : t.iniciativa ? 'Dificuldade' : disputa ? 'Sucessos do oponente' : 'Dificuldade';
    $('#r-dif').disabled = !!t.remorso || !!t.iniciativa || $('#r-man').value === 'surpresa' && ataque;
    $('#r-desc').innerHTML = md(t.d);
    if (t.iniciativa) { var d = R.derivados(F()); $('#r-form').textContent = 'Destreza ' + num(F().atr['Destreza']) + ' + Autocontrole ' + num(F().atr['Autocontrole']) + (d.ini.total !== num(F().atr['Destreza']) + num(F().atr['Autocontrole']) ? ' + ajustes' : '') + ' = ' + d.ini.total + ' + 1d10'; return; }
    var p = R.parada(F(), t, extras(t));
    $('#r-form').textContent = p.partes.join(' + ').replace(/\+ −/g, '− ').replace(/\+ \+/g, '+ ') + ' = ' + p.total + ' dado(s), ' + p.tensao + ' de Tensão';
  }
  $('#r-arma').addEventListener('change', function () { $('#w-rarma').dataset.touched = '1'; });

  function linha(k, v, cls) { return el('div', { class: 'l' }, [el('span', { class: 'k', text: k }), el('span', { class: 'v' + (cls ? ' ' + cls : ''), text: v })]); }
  function botaoAplicar(rot, fn) { return el('button', { type: 'button', class: 'btn small ghost', text: rot, on: { click: function () { fn(); this.disabled = true; recalcular(); mudou(); } } }); }
  function marcarFV(tipo, qtd) {
    var f = F(), n = R.derivados(f).fv.total;
    for (var q = 0; q < qtd; q++) {
      var i = -1; for (var k = 0; k < n; k++) if (!num(f.fv[k])) { i = k; break; }
      if (i >= 0) f.fv[i] = tipo;
      else { for (k = 0; k < n; k++) if (num(f.fv[k]) === 1) { f.fv[k] = 2; break; } }   // trilha cheia: converte superficial em agravado
    }
    renderTracks(R.derivados(f));
  }
  function recuperarFV(qtd) {
    var f = F(), n = R.derivados(f).fv.total, feitos = 0;
    for (var k = n - 1; k >= 0 && (qtd === 'todos' || feitos < qtd); k--) if (num(f.fv[k]) === 1) { f.fv[k] = 0; feitos++; }
    renderTracks(R.derivados(f));
  }

  function rolarAgora() {
    var t = tipoAtual(), f = F(); if (!t) return;
    var tray = $('#r-tray'), out = $('#r-out'); tray.innerHTML = ''; out.innerHTML = '';
    if (t.iniciativa) {
      var d10 = 1 + Math.floor(Math.random() * 10), base = R.derivados(f).ini.total;
      tray.appendChild(el('span', { class: 'die ok', text: String(d10) }));
      out.appendChild(linha('Iniciativa', base + ' + ' + d10 + ' = ' + (base + d10)));
      out.appendChild(el('p', { class: 'note', html: md(t.d) })); return;
    }
    var ataque = $('#r-cat').value === 'ataque', man = ataque ? $('#r-man').value : '';
    if (t.trilha && R.debilitado(f).fv) { out.appendChild(el('div', { class: 'txt bad', text: 'A sua Força de Vontade está cheia de dano: nenhum poder pode ser ativado.' })); return; }
    if (t.remorso && f.def.some(function (d) { return R.norm(d.nome) === 'consciencia pesada'; })) {
      out.appendChild(el('div', { class: 'txt bad', text: 'Consciência Pesada: você não faz o Teste de Remorso. Toda Mancha não perdoada custa Moralidade direto.' }));
      out.appendChild(el('div', { class: 'row' }, [botaoAplicar('Aplicar: Moralidade −' + num(f.manchas) + ' e apagar Manchas', function () { f.moral = Math.max(0, num(f.moral) - num(f.manchas)); f.manchas = 0; renderMoral(); })]));
      return;
    }
    var p = R.parada(f, t, extras(t));
    if (t.remorso && p.total <= 0) {
      out.appendChild(linha('Parada', '0 dados', 'err'));
      out.appendChild(el('div', { class: 'txt bad', text: 'Moralidade menos Manchas chegou a zero: não há dados para rolar. É fracasso total — ' + t.ftot }));
      out.appendChild(el('div', { class: 'row' }, [botaoAplicar('Aplicar: Moralidade −1 e apagar Manchas', function () { f.moral = Math.max(0, num(f.moral) - 1); f.manchas = 0; renderMoral(); })]));
      return;
    }
    var dados = R.rolar(p.total, p.tensao), r = R.julgar(dados, R.limiarCompulsao(f));
    dados.forEach(function (d) { tray.appendChild(el('span', { class: 'die' + (d.t ? ' t' : '') + (d.v >= 6 ? ' ok' : '') + (d.v === 1 ? ' one' : '') + (d.v === 10 ? ' ten' : '') + (d.x ? ' x' : ''), text: String(d.v), title: (d.t ? 'Tensão' : 'normal') + (d.x ? ' · explosão' : '') })); });

    var disputa = ataque || $('#r-cat').value === 'defesa';
    var dif = t.remorso ? 1 : (man === 'surpresa' ? 1 : num($('#r-dif').value));
    var suc = r.s - (man === 'alvo' ? 2 : 0);
    var desp = r.paga === 'Despertar', ftot = r.s === 0 && !desp;
    out.appendChild(linha('Parada', p.total + ' dados (' + p.tensao + ' de Tensão)'));
    out.appendChild(linha('Sucessos', r.s + (man === 'alvo' ? ' − 2 (alvo específico) = ' + suc : '') + (disputa && man !== 'surpresa' ? ' contra ' + dif : ' · dificuldade ' + dif)));
    var margem = suc - dif, res;
    if (desp) res = 'Sucesso absoluto (Despertar)';
    else if (ftot) res = 'Fracasso total';
    else if (disputa && margem === 0 && man !== 'surpresa') res = 'Empate';
    else res = margem >= 0 && (suc >= dif) ? (disputa ? 'Venceu por ' + margem : 'Sucesso · margem ' + margem) : (disputa ? 'Perdeu por ' + (-margem) : 'Falhou por ' + (-margem));
    out.appendChild(linha('Resultado', res, desp ? '' : (ftot || margem < 0) ? 'err' : margem === 0 && disputa ? 'warn' : ''));

    /* dano */
    var mostra = (ataque && t.dano && !t.trilha) || (t.contra && (margem > 0 || desp) && !ftot);
    if (mostra && !ftot) {
      var arma = armaEscolhida(), empate = disputa && margem === 0 && man !== 'surpresa' && !desp;
      if (empate) { out.appendChild(el('p', { class: 'txt', text: 'Empate em combate: cada um acerta o outro com margem 1, e esse dano é superficial. Você também leva 1 + a arma do oponente, como superficial.' })); arma = Object.assign({}, arma, { tipo: 'sup' }); }
      var mg = empate ? 1 : desp ? Math.max(margem, 1) : margem;
      var dn = R.dano({ margem: mg, arma: arma, alvoBlind: num($('#r-blind').value), alvoTipo: $('#r-btipo').value, ataqueTotal: man === 'total', surpresa: man === 'surpresa' });
      if (dn) {
        var ld = linha(t.contra ? 'Contra-ataque' : empate ? 'Dano no empate' : 'Dano', dn.marca + ' ' + (dn.tipo === 'sup' ? 'superficial' : 'agravado') + ' a marcar no alvo');
        ld.appendChild(el('span', { class: 'note', style: 'flex-basis:100%', text: 'margem ' + mg + ' + arma ' + num(arma.dano) + (man === 'total' ? ' + 1 (ataque total)' : '') + (man === 'surpresa' ? ', dobrado pela surpresa' : '') + ' = ' + dn.bruto +
          (dn.blindagem ? ' − blindagem ' + dn.blindagem : '') + (dn.liquido > dn.bruto - dn.blindagem ? ' → mínimo de 1' : '') + (dn.tipo === 'sup' ? ' → superficial divide por dois' : '') }));
        out.appendChild(ld);
      }
    }
    if (t.n === 'Agarrão' && margem > 0) out.appendChild(el('p', { class: 'note', text: 'Venceu o agarrão: sem dano, o alvo está imobilizado.' }));
    if (man === 'total') out.appendChild(el('p', { class: 'note', text: 'Ataque total: até o seu próximo turno você rola 1 dado a menos em qualquer defesa.' }));

    /* escada */
    [r.cobra, r.paga].forEach(function (g) { if (g) out.appendChild(linha(g, R.EFEITO_DEGRAU[g], g === r.cobra ? 'warn' : '')); });
    var comb = R.combinacao(r); if (comb) out.appendChild(el('p', { class: 'note', text: comb }));
    if (!r.cobra && !r.paga) out.appendChild(linha('Escada', 'nada nos extremos'));

    /* o que acontece na cena */
    if (desp && t.dez) out.appendChild(el('div', { class: 'txt', html: '<b>Despertar:</b> ' + md(t.dez) }));
    if (r.cobra === 'Colapso' && t.col) out.appendChild(el('div', { class: 'txt bad', html: '<b>Colapso:</b> ' + md(t.col) }));
    if (r.cobra === 'Colapso') R.falhas(f).forEach(function (x) { out.appendChild(el('div', { class: 'txt bad', html: '<b>Falha racial — ' + esc(x.nome) + ':</b> ' + md(x.txt) })); });
    var rejeicao = (r.cobra === 'Colapso' || r.cobra === 'Compulsão') && f.def.some(function (d) { return R.norm(d.nome) === 'rejeicao'; });
    if (rejeicao) out.appendChild(el('div', { class: 'txt bad', text: 'Rejeição: todo Colapso causa também 1 agravado de Saúde.' }));
    if (t.remorso && f.def.some(function (d) { return R.norm(d.nome) === 'compromisso'; })) out.appendChild(el('p', { class: 'note', text: 'Compromisso: a Mancha que veio da Convicção do seu Compromisso não entra neste teste — ela custa Moralidade direto.' }));
    if (r.cobra === 'Compulsão') R.compulsoes(f).forEach(function (c) { out.appendChild(el('div', { class: 'txt bad', html: '<b>Compulsão — ' + esc(c.nome) + ':</b> ' + md(c.impulso || '') + '. <b>Em combate:</b> ' + md(c.combate || '') + ' <b>Fora:</b> ' + md(c.fora || '') })); });
    if (ftot && t.ftot) out.appendChild(el('div', { class: 'txt bad', html: '<b>Fracasso total:</b> ' + md(t.ftot) + ' O Narrador é obrigado a dar uma consequência.' }));

    /* aplicar na ficha */
    var bts = [];
    if (r.cobra === 'Tensão' && r.paga !== 'Lampejo' && r.paga !== 'Sobrecarga' && !desp) bts.push(botaoAplicar('Abafar a Tensão (1 superficial de Vontade)', function () { marcarFV(1, 1); }));
    if (r.cobra === 'Colapso' && r.paga !== 'Sobrecarga' && !desp) bts.push(botaoAplicar('Marcar 1 superficial de Vontade', function () { marcarFV(1, 1); }));
    if (r.cobra === 'Compulsão') bts.push(botaoAplicar('Marcar 1 agravado de Vontade', function () { marcarFV(2, 1); }));
    if (rejeicao) bts.push(botaoAplicar('Marcar 1 agravado de Saúde (Rejeição)', function () { var n = R.derivados(f).saude.total; for (var k = 0; k < n; k++) if (!num(f.saude[k])) { f.saude[k] = 2; return; } for (k = 0; k < n; k++) if (num(f.saude[k]) === 1) { f.saude[k] = 2; return; } }));
    if ((r.paga === 'Lampejo' || r.paga === 'Sobrecarga') && (!r.cobra || r.cobra === 'Contratempo')) bts.push(botaoAplicar('Recuperar 1 superficial de Vontade', function () { recuperarFV(1); }));
    if (desp) { bts.push(botaoAplicar('Recuperar todo o superficial de Vontade', function () { recuperarFV('todos'); })); bts.push(botaoAplicar('Fim da cena: +1 Despertar', function () { f.despertar = Math.min(5, num(f.despertar) + 1); f.consequencias.push({ d: 0, nota: '' }); renderDesp(); renderCons(); renderAtr(); })); }
    if (t.remorso) bts.push(botaoAplicar(ftot ? 'Aplicar: Moralidade −1 e apagar Manchas' : 'Aplicar: apagar Manchas', function () { if (ftot) f.moral = Math.max(0, num(f.moral) - 1); f.manchas = 0; renderMoral(); }));
    if (bts.length) out.appendChild(el('div', { class: 'row' }, bts));
  }

  /* ============================================================ BARRA ============================================================ */
  $('#b-sair').addEventListener('click', sair);
  $('#b-salvar').addEventListener('click', function () { enviar(true); });
  $('#b-pdf').addEventListener('click', function () { window.PHExport.pdf(F()); });
  $('#b-xlsx').addEventListener('click', function () {
    var b = this; b.disabled = true; sync('Gerando planilha…', 'warn');
    window.PHExport.xlsx(F()).then(function () { sync('Planilha gerada', ''); }).catch(function (e) { sync('Erro ao gerar planilha: ' + e.message, 'err'); }).then(function () { b.disabled = false; });
  });
  $('#b-json').addEventListener('click', function () {
    modal([el('h2', { text: 'Arquivo da ficha' }),
      el('p', { class: 'note', text: 'Um arquivo .json é uma cópia completa da ficha: serve de backup e para levar a ficha para outro aparelho no modo local.' }),
      el('div', { class: 'acts' }, [
        el('button', { class: 'btn', type: 'button', text: 'Baixar .json', on: { click: function () { window.PHExport.json(F()); } } }),
        el('button', { class: 'btn ghost', type: 'button', text: 'Carregar .json', on: { click: function () { $('#arquivo').click(); } } }),
        el('button', { class: 'btn ghost', type: 'button', text: 'Fechar', on: { click: fecharModal } })])]);
  });
  $('#arquivo').addEventListener('change', function () {
    var file = this.files[0]; if (!file) return; var rd = new FileReader();
    rd.onload = function () {
      try {
        var o = JSON.parse(rd.result); var ficha = o && o.ficha ? o.ficha : o;
        if (!ficha || typeof ficha !== 'object' || !ficha.atr) throw new Error('não é uma ficha PlanetHell');
        if (!confirm('Substituir a ficha aberta pela do arquivo? A atual continua nas versões anteriores.')) return;
        S.ficha = R.completar(ficha); S.ficha.id.jogador = S.sessao.nome; fecharModal(); renderTudo(); mudou(); enviar(true);
      } catch (e) { alert('Arquivo inválido: ' + e.message); }
    };
    rd.readAsText(file); this.value = '';
  });
  $('#b-hist').addEventListener('click', function () {
    modal([el('h2', { text: 'Versões salvas' }), el('p', { class: 'note', text: 'Carregando…' })]);
    enviar(true).then(function () {
      return ST.chamar({ acao: 'historico', usuario: S.sessao.usuario, token: S.sessao.token });
    }).then(function (r) {
      if (!r.ok) { modal([el('h2', { text: 'Versões salvas' }), el('p', { class: 'note', text: r.erro })]); return; }
      var ul = el('ul', { class: 'vers' });
      r.versoes.forEach(function (v) {
        ul.appendChild(el('li', {}, [el('span', { text: new Date(v.quando).toLocaleString('pt-BR') + ' · ' + (v.personagem || 'sem nome') + ' · v' + v.rev }),
          el('button', { class: 'btn small ghost', type: 'button', text: 'Restaurar', on: { click: function () {
            if (!confirm('Abrir esta versão? A ficha atual também fica guardada no histórico.')) return;
            ST.chamar({ acao: 'versao', usuario: S.sessao.usuario, token: S.sessao.token, rev: v.rev }).then(function (x) {
              if (!x.ok) return alert(x.erro);
              S.ficha = R.completar(x.ficha); S.ficha.id.jogador = S.sessao.nome; fecharModal(); renderTudo(); mudou(); enviar(true);
            });
          } } })]));
      });
      modal([el('h2', { text: 'Versões salvas' }), el('p', { class: 'note', text: 'Uma cópia a cada 5 minutos de edição, e sempre que você clica em Salvar. Nada é apagado.' }), r.versoes.length ? ul : el('p', { class: 'note', text: 'Nenhuma versão ainda.' }),
        el('div', { class: 'acts' }, [el('button', { class: 'btn ghost', type: 'button', text: 'Fechar', on: { click: fecharModal } })])]);
    });
  });

  window.addEventListener('online', function () { if (S.pendente) enviar(false); });
  window.addEventListener('beforeunload', function (e) {
    if (!S.sessao || !S.pendente) return;
    guardarCopia();
    if (ST.modo === 'servidor' && navigator.sendBeacon) {
      try { navigator.sendBeacon(window.PH_CONFIG.servidor, new Blob([JSON.stringify({ acao: 'salvar', usuario: S.sessao.usuario, token: S.sessao.token, rev: S.rev, ficha: S.ficha })], { type: 'text/plain' })); } catch (x) {}
    }
  });

  /* ============================================================ INÍCIO ============================================================ */
  function datalists() {
    function dl(id, nomes) { var d = el('datalist', { id: id }); nomes.forEach(function (n) { d.appendChild(el('option', { value: n })); }); document.body.appendChild(d); }
    dl('dl-vant', PH.vantagens.map(function (v) { return v.nome; }));
    dl('dl-def', PH.defeitos.map(function (v) { return v.nome; }));
    dl('dl-quirks', PH.quirks.map(function (q) { return q.nome; }));
  }
  function iniciar() {
    datalists();
    opts($('#i-nacao'), PH.nacoes.concat(['Sem nação', 'Outra']), '—');
    opts($('#i-patamar'), PH.patamares.map(function (p) { return { v: p.nome, t: p.nome + ' (' + p.xp + ' XP)' }; }), 'Pergunte ao Narrador');
    opts($('#i-raca'), Object.keys(PH.racas), 'Escolha a raça');
    opts($('#i-base'), ['Human', 'Punk', 'Lycan'], 'Escolha');
    ligarCampos(); iniciarEntrada();
    var s = ST.sessao();
    if (s && s.usuario && s.token) abrir(s, null);
    else { $('#gate').hidden = false; }
  }
  window.PHApp = { estado: S, abrir: abrir, enviar: enviar, recalcular: recalcular };
  iniciar();
})();
