/* PlanetHell — balões de ajuda dos Atributos e Perícias.
   Depende de glossario.js. Usado pela ficha e pela landing page: leva o próprio estilo junto,
   para funcionar igual nos dois lugares. Passar o mouse mostra; no celular, um toque. */
(function (root) {
  'use strict';
  var G = root.PH_GLOSS || { atributos: {}, pericias: {} };
  var balao = null, alvoAtual = null, timer = null, fixado = false, atual = null;

  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }

  /* índice por nome sem acento, para casar "Astucia" com "Astúcia" */
  var INDICE = {};
  ['atributos', 'pericias'].forEach(function (tipo) {
    Object.keys(G[tipo] || {}).forEach(function (nome) { INDICE[norm(nome)] = { tipo: tipo, nome: nome }; });
  });

  function estilo() {
    if (document.getElementById('ph-ajuda-css')) return;
    var s = document.createElement('style');
    s.id = 'ph-ajuda-css';
    s.textContent = [
      '.ajuda{border-bottom:1px dotted currentColor;cursor:help}',
      '.ajuda:focus-visible{outline:2px solid #00ff00;outline-offset:2px}',
      '#ph-balao{position:fixed;z-index:200;max-width:330px;width:max-content;background:#050805;color:#d3dcd3;',
      '  border:1px solid rgba(0,255,0,.45);box-shadow:0 10px 40px rgba(0,0,0,.75);padding:12px 14px;',
      '  font-family:Arial,Helvetica,sans-serif;font-size:13.5px;line-height:1.5;pointer-events:none}',
      '#ph-balao[hidden]{display:none}',
      '#ph-balao .t{font-family:"Orbitron",Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:.06em;color:#00ff00;text-transform:uppercase}',
      '#ph-balao .g{font-family:"Orbitron",Arial,sans-serif;font-size:9.5px;letter-spacing:.18em;color:#339966;text-transform:uppercase;margin:2px 0 8px}',
      '#ph-balao p{margin:0 0 8px}',
      '#ph-balao .onde{color:#8fa38f;font-size:12.5px;border-top:1px solid rgba(0,255,0,.18);padding-top:7px;margin:8px 0 0}',
      '#ph-balao ol{margin:8px 0 0;padding:0;list-style:none;display:grid;gap:3px}',
      '#ph-balao ol li{display:grid;grid-template-columns:18px 1fr;gap:8px;font-size:12.5px;color:#c9d4c9}',
      '#ph-balao ol li b{font-family:"Orbitron",Arial,sans-serif;color:#00ff00;font-size:11px}',
      '@media (max-width:560px){#ph-balao{max-width:calc(100vw - 24px)}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { if (k === 'text') e.textContent = attrs[k]; else if (k === 'class') e.className = attrs[k]; else e.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }

  function conteudo(tipo, nome) {
    var d = (G[tipo] || {})[nome]; if (!d) return null;
    var kids = [el('div', { class: 't', text: nome }), el('div', { class: 'g', text: d.grupo || '' }), el('p', { text: d.resumo })];
    if (d.niveis && d.niveis.length) {
      var ol = el('ol', {});
      d.niveis.forEach(function (txt, i) { ol.appendChild(el('li', {}, [el('b', { text: String(i + 1) }), el('span', { text: txt })])); });
      kids.push(ol);
    }
    if (d.exemplo) kids.push(el('p', { class: 'onde', text: d.exemplo }));
    if (d.onde) kids.push(el('p', { class: 'onde', text: d.onde }));
    return kids;
  }

  function mostrar(alvo, tipo, nome) {
    estilo();
    var kids = conteudo(tipo, nome); if (!kids) return;
    if (!balao) { balao = el('div', { id: 'ph-balao', role: 'tooltip' }); document.body.appendChild(balao); }
    balao.innerHTML = ''; kids.forEach(function (k) { balao.appendChild(k); });
    balao.hidden = false;
    balao.style.left = '-9999px'; balao.style.top = '0px';      // mede fora da tela antes de posicionar
    alvoAtual = alvo; atual = { tipo: tipo, nome: nome };

    var r = alvo.getBoundingClientRect(), b = balao.getBoundingClientRect();
    var margem = 10;
    var x = Math.min(Math.max(margem, r.left), window.innerWidth - b.width - margem);
    var y = r.bottom + 8;
    if (y + b.height > window.innerHeight - margem) y = Math.max(margem, r.top - b.height - 8);
    balao.style.left = Math.round(x) + 'px';
    balao.style.top = Math.round(y) + 'px';
  }
  function esconder() { if (balao) balao.hidden = true; alvoAtual = null; fixado = false; clearTimeout(timer); }

  /* Liga um elemento a um verbete. `nome` opcional: por padrão usa o texto do próprio elemento. */
  function ligar(elemento, nome, tipo) {
    if (elemento.classList.contains('ajuda')) return true;      // nunca ligar duas vezes o mesmo elemento
    var chave = INDICE[norm(nome || elemento.textContent)];
    if (!chave) return false;
    if (tipo && chave.tipo !== tipo) return false;
    elemento.classList.add('ajuda');
    elemento.setAttribute('tabindex', '0');
    elemento.setAttribute('aria-label', chave.nome + ': ' + (G[chave.tipo][chave.nome].resumo || ''));
    elemento.addEventListener('mouseenter', function () { clearTimeout(timer); timer = setTimeout(function () { mostrar(elemento, chave.tipo, chave.nome); }, 120); });
    elemento.addEventListener('mouseleave', function () { clearTimeout(timer); if (!fixado && alvoAtual === elemento) esconder(); });
    elemento.addEventListener('focus', function () { mostrar(elemento, chave.tipo, chave.nome); });
    elemento.addEventListener('blur', function () { if (!fixado) esconder(); });
    /* No clique (e no toque) o balão fica preso até clicarem fora, no próprio termo ou no Esc. */
    elemento.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (fixado && alvoAtual === elemento) { esconder(); return; }
      clearTimeout(timer); mostrar(elemento, chave.tipo, chave.nome); fixado = true;
    });
    return true;
  }

  /* Varre uma área e liga tudo o que for nome exato de Atributo ou Perícia.
     Só mexe em elementos-folha (sem filhos), para não bagunçar texto corrido. */
  function marcar(raiz, seletor) {
    var alvos = (raiz || document).querySelectorAll(seletor || 'td:first-child, th, .lbl, .nome-pericia');
    Array.prototype.forEach.call(alvos, function (e) {
      if (e.classList.contains('ajuda') || e.querySelector('*')) return;
      ligar(e);
    });
  }

  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') esconder(); });
  document.addEventListener('click', function (e) { if (fixado && !(e.target.closest && e.target.closest('.ajuda'))) esconder(); });
  /* rolar a página reposiciona o balão presente em vez de fechá-lo — clicar no termo às vezes
     já provoca uma rolagem, e fechar aí seria fechar o que a pessoa acabou de abrir. */
  function acompanhar() {
    if (!balao || balao.hidden || !alvoAtual || !atual) return;
    if (fixado) mostrar(alvoAtual, atual.tipo, atual.nome); else esconder();
  }
  window.addEventListener('scroll', acompanhar, true);
  window.addEventListener('resize', acompanhar);

  root.PHAjuda = { ligar: ligar, marcar: marcar, esconder: esconder, indice: INDICE };
})(window);
