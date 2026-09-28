/* PlanetHell — onde as fichas moram.
   Mesmo contrato para os dois modos:
   - servidor: Google Apps Script (backend/Code.gs), configurado em config.js
   - local: localStorage deste navegador, com as mesmas regras (PIN, bloqueio, histórico, conflito)
   Em qualquer modo, a última versão também fica guardada no aparelho, e o que não chegou
   ao servidor fica marcado como pendente até conseguir enviar. */
(function (root) {
  'use strict';
  var URL_SERVIDOR = ((root.PH_CONFIG && root.PH_CONFIG.servidor) || '').trim();
  var MODO = URL_SERVIDOR ? 'servidor' : 'local';

  /* ---------- armazenamento do navegador, à prova de falha ---------- */
  var memoria = {};
  function ler(k) { try { var v = localStorage.getItem(k); return v == null ? (k in memoria ? memoria[k] : null) : JSON.parse(v); } catch (e) { return k in memoria ? memoria[k] : null; } }
  function gravar(k, v) { memoria[k] = v; try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function uid() {
    var a = new Uint8Array(16);
    (root.crypto || {}).getRandomValues ? root.crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = Math.random() * 256 | 0; });
    return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  function pin4() { var a = new Uint16Array(1); (root.crypto && root.crypto.getRandomValues) ? root.crypto.getRandomValues(a) : (a[0] = Math.random() * 65535); return ('000' + (a[0] % 10000)).slice(-4); }

  /* ---------- servidor local (mesmas regras do Code.gs) ---------- */
  var LC = 'ph.local.contas', LF = 'ph.local.ficha.', LH = 'ph.local.hist.', LS = 'ph.local.sessoes';
  function local(p) {
    var contas = ler(LC) || {}, agora = Date.now();
    var u = String(p.usuario || '').trim().toLowerCase();
    function sessaoOk() { var s = (ler(LS) || {})[p.token]; return s && s.usuario === u && s.expira > agora; }
    function novaSessao(us) { var ss = ler(LS) || {}, t = uid(); ss[t] = { usuario: us, expira: agora + 30 * 86400000 }; gravar(LS, ss); return t; }
    switch (p.acao) {
      case 'criar':
        if (!/^[a-z][a-z0-9_.-]{2,23}$/.test(u)) return { ok: false, erro: 'Usuário: de 3 a 24 caracteres, começando com letra; só letras sem acento, números, ponto, hífen ou sublinhado.' };
        if (!/^[A-Za-zÀ-ÖØ-öø-ÿ'-]{1,30}$/.test(String(p.nome || '').trim())) return { ok: false, erro: 'Nome: só o primeiro nome, sem espaços nem números.' };
        if (contas[u]) return { ok: false, erro: 'Esse usuário já existe neste aparelho. Escolha outro.' };
        /* No modo local não há planilha para marcar quem é o Narrador, então vale uma regra simples:
           a primeira ficha criada neste navegador é a dele. */
        var papelNovo = Object.keys(contas).length === 0 ? 'narrador' : '';
        var pin = pin4(); contas[u] = { nome: String(p.nome).trim(), pin: pin, falhas: 0, bloq: 0, papel: papelNovo }; gravar(LC, contas);
        return { ok: true, usuario: u, nome: contas[u].nome, pin: pin, token: novaSessao(u), rev: 0, ficha: null, papel: papelNovo };
      case 'entrar':
        var c = contas[u];
        if (!c) return { ok: false, erro: 'Usuário ou PIN incorretos.' };
        if (c.bloq > agora) return { ok: false, erro: 'Muitos PINs errados. Este usuário está bloqueado por mais ' + Math.ceil((c.bloq - agora) / 60000) + ' minuto(s).' };
        if (String(p.pin) !== c.pin) {
          c.falhas++; var b = c.falhas >= 5; if (b) { c.bloq = agora + 15 * 60000; c.falhas = 0; } gravar(LC, contas);
          return { ok: false, erro: b ? 'PIN incorreto. Usuário bloqueado por 15 minutos.' : 'Usuário ou PIN incorretos. ' + (5 - c.falhas) + ' tentativa(s) antes do bloqueio.' };
        }
        c.falhas = 0; gravar(LC, contas);
        var f = ler(LF + u);
        return { ok: true, usuario: u, nome: c.nome, token: novaSessao(u), rev: f ? f.rev : 0, ficha: f ? f.ficha : null, papel: c.papel || '' };
      case 'recuperar':
        var alvo = norm(p.personagem), achados = [];
        Object.keys(contas).forEach(function (us) { var fx = ler(LF + us); if (fx && fx.ficha && norm(fx.ficha.id && fx.ficha.id.personagem) === alvo && fx.ficha.raca === p.raca) achados.push({ usuario: us, nome: contas[us].nome, pin: contas[us].pin }); });
        return achados.length ? { ok: true, contas: achados } : { ok: false, erro: 'Nenhuma ficha salva com esse personagem e essa raça. Confira a grafia do nome.' };
    }
    if (!sessaoOk()) return { ok: false, sessao: false, erro: 'Sessão expirada. Entre de novo com o seu PIN.' };

    /* Mesmo desenho do servidor: o Narrador pode apontar a ação para a ficha de outro jogador. */
    var narrador = (contas[u] || {}).papel === 'narrador';
    var pedido = String(p.alvo || '').trim().toLowerCase(), narrando = false;
    if (pedido && pedido !== u) {
      if (!narrador) return { ok: false, erro: 'Só o Narrador pode abrir a ficha de outro jogador.' };
      if (!contas[pedido]) return { ok: false, erro: 'Não existe jogador com esse usuário.' };
      u = pedido; narrando = true;
    }
    if (p.acao === 'mesa') {
      if (!narrador) return { ok: false, erro: 'Esta área é do Narrador.' };
      return { ok: true, jogadores: Object.keys(contas).map(function (us) {
        var fx = ler(LF + us) || {};
        return { usuario: us, nome: contas[us].nome, pin: contas[us].pin, papel: contas[us].papel || '',
                 criado: '', ultimoAcesso: '', bloqueado: (contas[us].bloq || 0) > agora,
                 personagem: fx.personagem || '', raca: fx.raca || '', rev: fx.rev || 0,
                 atualizado: (ler(LH + us) || []).slice(-1).map(function (h) { return h.quando; })[0] || '' };
      }) };
    }

    var atual = ler(LF + u), hist = ler(LH + u) || [];
    switch (p.acao) {
      case 'carregar': return { ok: true, rev: atual ? atual.rev : 0, ficha: atual ? atual.ficha : null, alvo: narrando ? u : '' };
      case 'salvar':
        var rv = atual ? atual.rev : 0;
        if (Number(p.rev || 0) !== rv && !p.forcar) return { ok: false, conflito: true, rev: rv, ficha: atual && atual.ficha, erro: 'Esta ficha foi salva em outra aba depois da sua última leitura.' };
        if (p.forcar && atual) hist.push({ rev: rv, quando: new Date(agora).toISOString(), personagem: atual.personagem, raca: atual.raca, ficha: atual.ficha });
        var nf = { rev: rv + 1, ficha: p.ficha, personagem: (p.ficha.id && p.ficha.id.personagem) || '', raca: p.ficha.raca || '' };
        gravar(LF + u, nf);
        var ult = hist.length ? Date.parse(hist[hist.length - 1].quando) : 0;
        if (narrando || p.marco || !atual || atual.personagem !== nf.personagem || atual.raca !== nf.raca || agora - ult > 5 * 60000) {
          hist.push({ rev: nf.rev, quando: new Date(agora).toISOString(), personagem: nf.personagem, raca: nf.raca, ficha: p.ficha });
        }
        if (hist.length > 60) hist = hist.slice(-60);           // o navegador tem pouco espaço; no servidor não há corte
        gravar(LH + u, hist);
        return { ok: true, rev: nf.rev, alvo: narrando ? u : '' };
      case 'historico': return { ok: true, versoes: hist.slice().reverse().map(function (h) { return { rev: h.rev, quando: h.quando, personagem: h.personagem, raca: h.raca }; }) };
      case 'versao': var h = hist.filter(function (x) { return x.rev === Number(p.rev); }).pop(); return h ? { ok: true, rev: h.rev, ficha: h.ficha } : { ok: false, erro: 'Versão não encontrada.' };
      case 'sair': var ss = ler(LS) || {}; delete ss[p.token]; gravar(LS, ss); return { ok: true };
    }
    return { ok: false, erro: 'Ação desconhecida.' };
  }

  /* ---------- servidor remoto ---------- */
  function remoto(p) {
    var ctrl = root.AbortController ? new AbortController() : null;
    var t = setTimeout(function () { if (ctrl) ctrl.abort(); }, 25000);
    return fetch(URL_SERVIDOR, { method: 'POST', redirect: 'follow', body: JSON.stringify(p),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, signal: ctrl ? ctrl.signal : undefined })  // text/plain evita a checagem prévia de CORS
      .then(function (r) { clearTimeout(t); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .catch(function (e) { clearTimeout(t); return { ok: false, rede: true, erro: 'Sem conexão com o servidor. A ficha continua salva neste aparelho e será enviada quando a conexão voltar.' }; });
  }

  function chamar(p) { return MODO === 'servidor' ? remoto(p) : Promise.resolve(local(p)); }

  /* ---------- sessão e cópia no aparelho ---------- */
  var KS = 'ph.sessao', KC = 'ph.copia.';
  var API = {
    modo: MODO,
    chamar: chamar,
    sessao: function () { return ler(KS); },
    guardarSessao: function (s) { gravar(KS, s); },
    esquecerSessao: function () { try { localStorage.removeItem(KS); } catch (e) {} delete memoria[KS]; },
    copia: function (u) { return ler(KC + u); },
    guardarCopia: function (u, c) { gravar(KC + u, c); }
  };
  root.PHStore = API;
})(window);
