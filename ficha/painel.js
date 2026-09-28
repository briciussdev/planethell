/* PlanetHell — painel do Narrador: a mesa inteira numa tela, com XP, créditos, dano e moralidade.
   Usa as mesmas ações do servidor que a ficha usa (mesa, carregar, salvar com alvo), então não há
   nada a mexer no Apps Script. Cada alteração é gravada na ficha do jogador, com cópia no histórico. */
(function () {
  'use strict';
  var R = window.PHR, ST = window.PHStore, PH = window.PH;
  var $ = function (s, e) { return (e || document).querySelector(s); };
  var num = R.num;
  var S = { sessao: null, jogadores: [] };

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k]; if (v === undefined || v === null || v === false) return;
      if (k === 'text') e.textContent = v;
      else if (k === 'on') Object.keys(v).forEach(function (ev) { e.addEventListener(ev, v[ev]); });
      else if (k === 'class') e.className = v;
      else if (k === 'value') e.value = v;
      else e.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function sync(t, cls) { var s = $('#sync'); s.textContent = t || ''; s.className = 'sync' + (cls ? ' ' + cls : ''); }
  function aviso(txt, cls) { var b = $('#saida'); b.innerHTML = ''; if (txt) b.appendChild(el('p', { class: 'msgp' + (cls ? ' ' + cls : ''), text: txt })); }
  function hoje() { var d = new Date(); return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear(); }
  function req(o, alvo) { o.usuario = S.sessao.usuario; o.token = S.sessao.token; if (alvo) o.alvo = alvo; return o; }

  /* ---------------- entrada ---------------- */
  function comecar() {
    S.sessao = ST.sessao();
    if (!S.sessao || !S.sessao.usuario || !S.sessao.token) {
      return aviso('Entre na ficha primeiro, com o seu usuário e PIN. Depois volte para esta página.', 'err');
    }
    $('#who').textContent = 'Narrador ' + (S.sessao.nome || S.sessao.usuario);
    carregarMesa();
  }

  function carregarMesa() {
    sync('Carregando a mesa…', 'warn');
    aviso('');
    ST.chamar(req({ acao: 'mesa' })).then(function (r) {
      if (r.sessao === false) return aviso('A sua sessão expirou. Entre de novo pela ficha.', 'err');
      if (!r.ok) { sync('', ''); return aviso(r.erro || 'Não deu para ler a mesa.', 'err'); }
      var lista = (r.jogadores || []).filter(function (j) { return j.rev > 0; });
      if (!lista.length) { sync('', ''); $('#cartoes').innerHTML = ''; return aviso('Ninguém salvou ficha ainda. Assim que a mesa criar os personagens, eles aparecem aqui.'); }
      S.jogadores = [];
      $('#cartoes').innerHTML = '';
      $('#resumo').textContent = lista.length + (lista.length === 1 ? ' ficha' : ' fichas');
      /* uma ficha de cada vez: o Apps Script agradece, e a tela vai enchendo na ordem */
      lista.reduce(function (p, j) {
        return p.then(function () {
          return ST.chamar(req({ acao: 'carregar' }, j.usuario)).then(function (x) {
            if (!x.ok || !x.ficha) return;
            var item = { info: j, ficha: R.completar(x.ficha), rev: num(x.rev), sujo: false, cartao: null };
            S.jogadores.push(item);
            item.cartao = cartao(item);
            $('#cartoes').appendChild(item.cartao);
          });
        });
      }, Promise.resolve()).then(function () { sync('Mesa carregada · ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), ''); });
    });
  }

  /* ---------------- um cartão por jogador ---------------- */
  function marcarSujo(item, sim) {
    item.sujo = sim;
    item.cartao.classList.toggle('sujo', sim);
    $('.aviso', item.cartao).textContent = sim ? 'alterações não salvas' : 'tudo salvo';
    $('.b-salvar', item.cartao).classList.toggle('forte', sim);
  }

  function trilha(arr, total, aoMudar) {
    var box = el('div', { class: 'track' });
    for (var i = 0; i < total; i++) (function (i) {
      var v = num(arr[i]);
      var b = el('button', { type: 'button', class: 'box' + (v ? ' s' + v : ''), text: v === 1 ? '/' : v === 2 ? 'X' : '',
        'aria-label': 'Caixa ' + (i + 1) + ': ' + (v === 1 ? 'superficial' : v === 2 ? 'agravado' : 'vazia') });
      b.addEventListener('click', function () { arr[i] = (num(arr[i]) + 1) % 3; aoMudar(); });
      box.appendChild(b);
    })(i);
    return box;
  }
  function estado(arr, n) {
    var sup = 0, agr = 0; for (var i = 0; i < n; i++) { if (num(arr[i]) === 1) sup++; if (num(arr[i]) === 2) agr++; }
    return { sup: sup, agr: agr, cheia: n > 0 && sup + agr >= n, morta: n > 0 && agr >= n };
  }
  function bolinhas(valor, max, aoSetar) {
    var box = el('span', { class: 'dots' });
    for (var i = 1; i <= max; i++) (function (i) {
      var b = el('button', { type: 'button', class: 'dot' + (i <= valor ? ' on' : ''), 'aria-label': 'valor ' + i });
      b.addEventListener('click', function () { aoSetar(valor === i ? i - 1 : i); });
      box.appendChild(b);
    })(i);
    return box;
  }
  function xpTotal(f) {
    var p = PH.patamares.filter(function (x) { return x.nome === f.id.patamar; })[0];
    return (p ? p.xp : 0) + (f.xp.ganhos || []).reduce(function (a, g) { return a + num(g.qtd); }, 0);
  }

  function cartao(item) {
    var c = el('div', { class: 'hud jog' });
    desenhar(item, c);
    return c;
  }

  function desenhar(item, c) {
    c = c || item.cartao;
    var f = item.ficha, j = item.info, d = R.derivados(f);
    var redesenhar = function () { desenhar(item); };
    var mudou = function () { marcarSujo(item, true); redesenhar(); };
    c.innerHTML = '';

    /* cabeçalho */
    var retra = el('div', { class: 'retra' }, [ f.foto ? el('img', { src: f.foto, alt: 'Retrato' }) : el('span', { text: 'sem foto' }) ]);
    var sub = [f.raca || 'sem raça', j.nome || j.usuario, '@' + j.usuario].filter(Boolean).join(' · ');
    c.appendChild(el('div', { class: 'cab' }, [
      retra,
      el('div', {}, [
        el('h3', { text: f.id.personagem || 'sem personagem' }),
        el('p', { class: 'sub', text: sub }),
        el('p', { class: 'sub', text: (f.id.conceito || '') + (j.atualizado ? ' · editada ' + new Date(j.atualizado).toLocaleString('pt-BR') : '') })
      ]),
      el('span', { class: 'aviso', text: item.sujo ? 'alterações não salvas' : 'tudo salvo' })
    ]));

    /* XP */
    var t = xpTotal(f), g = R.xpGasto(f), disp = t - g;
    var qtd = el('input', { type: 'number', value: '', placeholder: 'XP', 'aria-label': 'Quantidade de XP' });
    var nota = el('input', { type: 'text', class: 'larga', placeholder: 'motivo (opcional)', 'aria-label': 'Motivo do XP' });
    function darXP(sinal) {
      var q = num(qtd.value) * sinal;
      if (!q) return;
      if (!f.xp.ganhos) f.xp.ganhos = [];
      f.xp.ganhos.push({ data: hoje(), qtd: q, nota: (nota.value.trim() || 'Narrador') });
      qtd.value = ''; nota.value = '';
      mudou();
    }
    c.appendChild(el('div', { class: 'bloco' }, [
      el('p', { class: 'rot', text: 'Experiência' }),
      el('div', { class: 'xp' }, [
        el('span', {}, [el('b', { text: String(t) }), 'ganho']),
        el('span', {}, [el('b', { text: String(g) }), 'gasto']),
        el('span', { class: disp < 0 ? 'neg' : '' }, [el('b', { text: String(disp) }), 'disponível'])
      ]),
      el('div', { class: 'linha', style: 'margin-top:8px' }, [
        qtd, nota,
        el('button', { class: 'mini', type: 'button', text: '+ dar', on: { click: function () { darXP(1); } } }),
        el('button', { class: 'mini', type: 'button', text: '− tirar', on: { click: function () { darXP(-1); } } })
      ])
    ]));

    /* créditos */
    var cred = el('input', { type: 'number', class: 'cred', value: String(num(f.creditos)), 'aria-label': 'Créditos' });
    cred.addEventListener('change', function () { f.creditos = num(cred.value); marcarSujo(item, true); });
    function mexer(v) { f.creditos = num(f.creditos) + v; mudou(); }
    c.appendChild(el('div', { class: 'bloco' }, [
      el('p', { class: 'rot', text: 'Créditos' }),
      el('div', { class: 'linha' }, [
        cred,
        el('button', { class: 'mini', type: 'button', text: '+1000', on: { click: function () { mexer(1000); } } }),
        el('button', { class: 'mini', type: 'button', text: '+100', on: { click: function () { mexer(100); } } }),
        el('button', { class: 'mini', type: 'button', text: '−100', on: { click: function () { mexer(-100); } } }),
        el('button', { class: 'mini', type: 'button', text: '−1000', on: { click: function () { mexer(-1000); } } }),
        f.bens ? el('span', { class: 'note', text: f.bens }) : null
      ])
    ]));

    /* dano */
    var es = estado(f.saude, d.saude.total), ev = estado(f.fv, d.fv.total);
    function limpar(arr, tipo) {
      for (var i = 0; i < arr.length; i++) if (num(arr[i]) === tipo) arr[i] = 0;
      mudou();
    }
    c.appendChild(el('div', { class: 'bloco' }, [
      el('p', { class: 'rot', text: 'Saúde ' + d.saude.total + (es.morta ? ' · morte/destruição' : es.cheia ? ' · Debilitado' : '') }),
      trilha(f.saude, d.saude.total, mudou),
      el('div', { class: 'linha', style: 'margin-top:6px' }, [
        el('span', { class: 'note', text: es.sup + ' superficial · ' + es.agr + ' agravado' }),
        el('button', { class: 'mini', type: 'button', text: 'curar superficial', on: { click: function () { limpar(f.saude, 1); } } }),
        el('button', { class: 'mini', type: 'button', text: 'curar tudo', on: { click: function () { f.saude = []; mudou(); } } })
      ])
    ]));
    c.appendChild(el('div', { class: 'bloco' }, [
      el('p', { class: 'rot', text: 'Força de Vontade ' + d.fv.total + (ev.cheia ? ' · Debilitado, nenhum poder ativa' : '') }),
      trilha(f.fv, d.fv.total, mudou),
      el('div', { class: 'linha', style: 'margin-top:6px' }, [
        el('span', { class: 'note', text: ev.sup + ' superficial · ' + ev.agr + ' agravado' }),
        el('button', { class: 'mini', type: 'button', text: 'devolver 1', on: { click: function () {
          for (var i = f.fv.length - 1; i >= 0; i--) if (num(f.fv[i]) === 1) { f.fv[i] = 0; break; }
          mudou();
        } } }),
        el('button', { class: 'mini', type: 'button', text: 'restaurar tudo', on: { click: function () { f.fv = []; mudou(); } } })
      ])
    ]));

    /* moralidade, manchas, despertar */
    c.appendChild(el('div', { class: 'bloco' }, [
      el('p', { class: 'rot', text: 'Moralidade, Manchas e Despertar' }),
      el('div', { class: 'linha' }, [
        el('span', { class: 'note', text: 'Moralidade' }), el('span', { class: 'num', text: String(num(f.moral)) }),
        el('button', { class: 'mini', type: 'button', text: '−1', on: { click: function () { f.moral = Math.max(0, num(f.moral) - 1); mudou(); } } }),
        el('button', { class: 'mini', type: 'button', text: '+1', on: { click: function () { f.moral = Math.min(num(d.moralMax) || 10, num(f.moral) + 1); mudou(); } } }),
        el('span', { class: 'note', text: '· Manchas' }), el('span', { class: 'num', text: String(num(f.manchas)) }),
        el('button', { class: 'mini', type: 'button', text: '−', on: { click: function () { f.manchas = Math.max(0, num(f.manchas) - 1); mudou(); } } }),
        el('button', { class: 'mini', type: 'button', text: '+', on: { click: function () { f.manchas = num(f.manchas) + 1; mudou(); } } })
      ]),
      el('div', { class: 'linha', style: 'margin-top:6px' }, [
        el('span', { class: 'note', text: 'Despertar' }),
        bolinhas(num(f.despertar), 5, function (n) { f.despertar = n; mudou(); })
      ])
    ]));

    /* rodapé */
    c.appendChild(el('div', { class: 'rodape' }, [
      el('span', { class: 'note', text: 'v' + item.rev }),
      el('span', { class: 'linha' }, [
        el('button', { class: 'mini', type: 'button', text: 'Recarregar', on: { click: function () { recarregar(item); } } }),
        el('button', { class: 'mini b-salvar' + (item.sujo ? ' forte' : ''), type: 'button', text: 'Salvar', on: { click: function () { salvar(item); } } })
      ])
    ]));
  }

  /* ---------------- servidor ---------------- */
  function salvar(item) {
    if (!item.sujo) return sync('Nada a salvar em ' + (item.ficha.id.personagem || item.info.usuario), '');
    sync('Salvando ' + (item.ficha.id.personagem || item.info.usuario) + '…', 'warn');
    ST.chamar(req({ acao: 'salvar', rev: item.rev, ficha: item.ficha, marco: true }, item.info.usuario)).then(function (r) {
      if (r.sessao === false) return aviso('A sua sessão expirou. Entre de novo pela ficha.', 'err');
      if (r.conflito) {
        sync('', '');
        if (confirm('A ficha de ' + (item.ficha.id.personagem || item.info.usuario) + ' foi salva pelo jogador depois que você abriu esta tela.\n\nAbrir a versão dele? As suas alterações desta tela serão descartadas (nada do que ele fez se perde).')) recarregar(item);
        return;
      }
      if (!r.ok) return sync('Erro: ' + (r.erro || 'não deu para salvar'), 'err');
      item.rev = num(r.rev); marcarSujo(item, false); desenhar(item);
      sync('Salvo em ' + (item.ficha.id.personagem || item.info.usuario), '');
    });
  }
  function recarregar(item) {
    sync('Buscando…', 'warn');
    ST.chamar(req({ acao: 'carregar' }, item.info.usuario)).then(function (r) {
      if (!r.ok || !r.ficha) return sync('Não deu para recarregar', 'err');
      item.ficha = R.completar(r.ficha); item.rev = num(r.rev);
      marcarSujo(item, false); desenhar(item);
      sync('Atualizado', '');
    });
  }

  $('#b-atualizar').addEventListener('click', carregarMesa);
  window.addEventListener('beforeunload', function (e) {
    if (S.jogadores.some(function (i) { return i.sujo; })) { e.preventDefault(); e.returnValue = ''; }
  });

  window.PHPainel = { estado: S, carregarMesa: carregarMesa };
  comecar();
})();
