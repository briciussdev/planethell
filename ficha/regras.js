/* PlanetHell — motor de regras da ficha.
   Tudo aqui é função pura sobre o objeto da ficha: dá para testar no Node sem navegador.
   As regras seguem o Guia do Jogador; os números citados nos comentários são as seções. */
(function (root) {
  'use strict';
  var PH = root.PH;

  var ATR = PH.atributos.map(function (a) { return a.nome; });
  var PER = PH.pericias.map(function (p) { return p.nome; });
  var ESP_GRATIS = ['Ciências', 'Ofícios', 'Erudição', 'Informática'];          // passo 5
  var DIST_ATR = [4, 3, 3, 3, 2, 2, 2, 2, 1];                                      // passo 3
  var PERFIS = {                                                                   // passo 4
    'Faz-tudo':     { 2: 10, 1: 6 },
    'Equilibrado':  { 3: 3, 2: 5, 1: 7 },
    'Especialista': { 4: 1, 3: 4, 2: 3, 1: 4 }
  };
  var FISICOS = ['Força', 'Destreza', 'Vigor'];
  var SOCIAIS = ['Presença', 'Manipulação', 'Autocontrole'];

  function num(v) { v = parseInt(v, 10); return isNaN(v) ? 0 : v; }
  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }

  /* ---------------- ficha em branco ---------------- */
  function novaFicha() {
    var f = {
      versao: 1,
      id: { personagem: '', jogador: '', conceito: '', cronica: '', idade: '', nacao: '', patamar: '', aparencia: '' },
      raca: '', racaBase: '', afimBase: '', afimLivre: '', atrDespertar: '',
      modo: 'criacao',
      atr: {}, per: {}, esp: [],
      trilhas: [], vant: [], def: [],
      saude: [], fv: [],
      moral: 7, manchas: 0, despertar: 0, consequencias: [],
      convic: [], ambicao: '', desejo: '',
      armas: [], blindagens: [], itens: [],
      xp: { total: 0, log: [] },
      mods: { saude: 0, fv: 0, ini: 0, desl: 0 },
      historia: '', notas: ''
    };
    ATR.forEach(function (a) { f.atr[a] = 0; });
    PER.forEach(function (p) { f.per[p] = 0; });
    return f;
  }

  /* Garante que uma ficha antiga ou vinda do servidor tem todos os campos. Nunca apaga dado desconhecido. */
  function completar(f) {
    var base = novaFicha();
    f = f || {};
    Object.keys(base).forEach(function (k) {
      if (f[k] === undefined || f[k] === null) f[k] = base[k];
      else if (typeof base[k] === 'object' && !Array.isArray(base[k])) {
        Object.keys(base[k]).forEach(function (kk) { if (f[k][kk] === undefined) f[k][kk] = base[k][kk]; });
      }
    });
    return f;
  }

  /* ---------------- raça ---------------- */
  function raca(f) { return PH.racas[f.raca] || null; }
  function racaBase(f) { return f.raca === 'Cyberpunk' ? (PH.racas[f.racaBase] || null) : null; }
  function temVant(f, nome) { return f.vant.some(function (v) { return norm(v.nome) === norm(nome); }); }
  function ptsVant(f, nome) { var t = 0; f.vant.forEach(function (v) { if (norm(v.nome) === norm(nome)) t += num(v.pts); }); return t; }
  function temDef(f, nome) { return f.def.some(function (v) { return norm(v.nome) === norm(nome); }); }
  function nivelTrilha(f, nome) {
    var n = 0; f.trilhas.forEach(function (t) { if (norm(t.tipo) === norm(nome)) n = Math.max(n, num(t.nivel)); }); return n;
  }

  /* Falhas e Compulsões ativas: Trick or Treat ACRESCENTA as da raça-base (seção 3). */
  function falhas(f) {
    var r = raca(f), b = racaBase(f), out = [];
    if (r) out.push({ nome: r.falha.nome, txt: r.falha.txt, de: f.raca });
    if (b) out.push({ nome: b.falha.nome, txt: b.falha.txt, de: f.racaBase + ' (Trick or Treat)' });
    return out;
  }
  function compulsoes(f) {
    var r = raca(f), b = racaBase(f), out = [];
    if (r) out.push(Object.assign({ de: f.raca }, r.compulsao));
    if (b) out.push(Object.assign({ de: f.racaBase + ' (Trick or Treat)' }, b.compulsao));
    return out;
  }
  /* Uns na Tensão que disparam a Compulsão: 3, ou 2 com Compulsão Ampliada ou a Ascensão do Han'you. */
  function limiarCompulsao(f) {
    if (temDef(f, 'Compulsão Ampliada')) return 2;
    if (f.raca === "Han'you" && num(f.despertar) >= 5) return 2;
    return 3;
  }

  /* ---------------- Tamanho e derivados (passo 8) ---------------- */
  function tamanho(f) {
    var r = raca(f); if (!r) return 0;
    var t = r.tam;
    if (temVant(f, 'Gigante')) t += 1;
    if (temDef(f, 'Frágil')) t -= 1;
    if (f.raca === 'Lycan' && num(f.despertar) >= 5) t += 1;          // Ascensão Apex: Tamanho +1 permanente
    return t;
  }
  function rachaduras(f) { return f.consequencias.filter(function (c) { return num(c.d) === 7; }).length; }

  function derivados(f) {
    var A = f.atr, d = {};
    var tam = tamanho(f);
    d.tamanho = tam;
    d.saude = { base: num(A['Vigor']) + tam, mod: num(f.mods.saude) };
    d.saude.total = Math.max(0, d.saude.base + d.saude.mod);
    var fv = num(A['Autocontrole']) + num(A['Perseverança']);
    var extras = [];
    if (nivelTrilha(f, 'Grit') >= 1) { fv += 1; extras.push('Grit 1: +1'); }
    if (num(f.despertar) >= 1) { fv += 1; extras.push('Despertar 1: +1'); }
    var rc = rachaduras(f); if (rc) { fv -= rc; extras.push('Rachadura: −' + rc); }
    d.fv = { base: fv, mod: num(f.mods.fv), extras: extras };
    d.fv.total = Math.max(0, fv + d.fv.mod);
    d.tensao = num(A['Autocontrole']);
    var ini = num(A['Destreza']) + num(A['Autocontrole']) + ptsVant(f, 'Reflexos Rápidos');
    d.ini = { base: ini, mod: num(f.mods.ini) }; d.ini.total = ini + d.ini.mod;
    var desl = num(A['Força']) + num(A['Destreza']) + 5 + ptsVant(f, 'Ligeiro');
    d.desl = { base: desl, mod: num(f.mods.desl) }; d.desl.total = desl + d.desl.mod;
    d.blindagem = blindagem(f);
    d.limiarCompulsao = limiarCompulsao(f);
    d.moralMax = (f.raca === "Han'you" && num(f.despertar) < 5) ? 7 : 10;
    return d;
  }

  /* Blindagem (seção 8): vale a melhor fonte; Hard Wired não soma com colete; Bulwark soma. */
  var FORCA_TIPO = { leve: 1, pesada: 2, magitek: 3 };
  function blindagem(f) {
    var fontes = [];
    f.blindagens.forEach(function (b) { if (num(b.valor) > 0) fontes.push({ nome: b.nome || 'Blindagem', valor: num(b.valor), tipo: b.tipo || 'leve' }); });
    if (f.raca === 'Cyberpunk') fontes.push({ nome: 'Hard Wired', valor: 1, tipo: 'pesada' });
    if (f.raca === 'Mecha') fontes.push({ nome: 'Tosei Dō', valor: 3, tipo: 'pesada' });
    var melhor = null;
    fontes.forEach(function (x) {
      if (!melhor || x.valor > melhor.valor || (x.valor === melhor.valor && FORCA_TIPO[x.tipo] > FORCA_TIPO[melhor.tipo])) melhor = x;
    });
    var bw = nivelTrilha(f, 'Bulwark'), bonus = (bw >= 1 ? 1 : 0) + (bw >= 4 ? 2 : 0);
    var valor = (melhor ? melhor.valor : 0) + bonus;
    return { valor: valor, tipo: melhor ? melhor.tipo : (bonus ? 'pesada' : ''), fonte: melhor ? melhor.nome : '', bulwark: bonus };
  }

  /* ---------------- afinidade das Trilhas ---------------- */
  function afins(f) {
    var r = raca(f); if (!r) return { nomes: [], quirk: false, livre: false };
    var nomes = [], quirk = false, livre = false;
    r.afins.forEach(function (a) {
      var n = norm(a);
      if (n.indexOf('quirk') >= 0) quirk = true;
      else if (n === 'uma livre') { livre = true; if (f.afimLivre) nomes.push(f.afimLivre); }
      else if (n.indexOf('raca-base') >= 0) { if (f.afimBase) nomes.push(f.afimBase); }
      else nomes.push(a.replace(/^o seu /, ''));
    });
    return { nomes: nomes, quirk: quirk, livre: livre };
  }
  /* opções para as escolhas de afinidade */
  function opcoesAfimBase(f) {
    var b = racaBase(f); if (!b) return [];
    return b.afins.filter(function (x) { var n = norm(x); return n.indexOf('quirk') < 0 && n !== 'uma livre'; }).map(function (x) { return x.replace(/^o seu /, ''); })
      .concat(f.racaBase === 'Human' ? Object.keys(PH.trilhas).filter(function (t) { return ['Bond', 'Grit', 'Improvement'].indexOf(t) < 0; }) : []);
  }
  function opcoesAfimLivre() { return Object.keys(PH.trilhas).filter(function (t) { return ['Bond', 'Grit'].indexOf(t) < 0; }); }
  function capAtributo(f, nome) { return (num(f.despertar) >= 4 && f.atrDespertar === nome) ? 6 : 5; }
  function trilhaAfim(f, t) {
    var a = afins(f);
    if (t.tipo === 'Quirk') return a.quirk;
    if (a.nomes.some(function (n) { return norm(n) === norm(t.tipo); })) return true;
    return false;
  }

  /* ---------------- especializações ---------------- */
  function espGratis(f) {
    var n = 1; ESP_GRATIS.forEach(function (p) { if (num(f.per[p]) > 0) n++; });
    return n;
  }

  /* ---------------- pontos de Vantagem e Defeito (passo 7, Anexos A e B) ---------------- */
  function pontos(f) {
    var v = 0, d = 0;
    f.vant.forEach(function (x) { v += num(x.pts); });
    f.def.forEach(function (x) { d += num(x.pts); });
    var extra = Math.max(0, Math.min(d, 4) - 2);
    return { vant: v, def: d, limiteVant: 7 + extra };
  }

  function perfilPericias(f) {
    var cont = {};
    PER.forEach(function (p) { var v = num(f.per[p]); if (v > 0) cont[v] = (cont[v] || 0) + 1; });
    var achado = null;
    Object.keys(PERFIS).forEach(function (nome) {
      var alvo = PERFIS[nome], ok = true;
      var chaves = Object.keys(alvo).concat(Object.keys(cont));
      chaves.forEach(function (k) { if ((alvo[k] || 0) !== (cont[k] || 0)) ok = false; });
      if (ok) achado = nome;
    });
    var total = 0; PER.forEach(function (p) { total += num(f.per[p]); });
    return { perfil: achado, contagem: cont, total: total };
  }

  /* ---------------- verificação de regras ---------------- */
  function verificar(f) {
    var L = [];
    function item(grupo, ok, msg, nivel) { L.push({ grupo: grupo, ok: !!ok, msg: msg, nivel: ok ? 'ok' : (nivel || 'erro') }); }
    var criacao = f.modo !== 'jogo';
    var r = raca(f);

    item('Conceito', f.id.personagem.trim(), 'Nome do personagem preenchido');
    item('Conceito', f.id.conceito.trim(), 'Conceito em duas palavras', 'aviso');
    item('Raça', r, 'Raça escolhida');
    if (f.raca === 'Cyberpunk') {
      item('Raça', racaBase(f), 'Raça-base do Cyberpunk escolhida (Human, Punk ou Lycan)');
      item('Raça', f.afimBase, 'Trilha afim escolhida da raça-base', 'aviso');
    }
    if (f.raca === 'Human') item('Raça', f.afimLivre, 'Trilha afim livre do Human escolhida', 'aviso');

    var vals = ATR.map(function (a) { return num(f.atr[a]); });
    item('Atributos', vals.every(function (v) { return v >= 1; }), 'Todos os nove Atributos com pelo menos 1');
    if (criacao) {
      var ord = vals.slice().sort(function (a, b) { return b - a; });
      item('Atributos', ord.join() === DIST_ATR.join(), 'Distribuição de criação: um em 4, três em 3, quatro em 2, um em 1');
    } else item('Atributos', ATR.every(function (a) { return num(f.atr[a]) <= capAtributo(f, a); }), 'Nenhum Atributo acima de 5 (só o escolhido no Despertar 4 chega a 6)');

    var pp = perfilPericias(f);
    if (criacao) item('Perícias', pp.perfil, pp.perfil ? 'Perícias no perfil ' + pp.perfil : 'Perícias batem com um perfil: Faz-tudo, Equilibrado ou Especialista (26 pontos)');
    else item('Perícias', PER.every(function (p) { return num(f.per[p]) <= 5; }), 'Nenhuma Perícia acima de 5');

    var eg = espGratis(f), en = f.esp.filter(function (e) { return (e.nome || '').trim(); }).length;
    var espSemPericia = f.esp.filter(function (e) { return (e.nome || '').trim() && num(f.per[e.pericia]) < 1; });
    item('Especializações', espSemPericia.length === 0, 'Toda especialização está numa Perícia com pelo menos 1 ponto');
    var cobertas = ESP_GRATIS.filter(function (p) { return num(f.per[p]) > 0 && f.esp.some(function (e) { return e.pericia === p && (e.nome || '').trim(); }); }).length;
    if (criacao) {
      item('Especializações', en <= cobertas + 1, 'Gratuitas: uma em cada Perícia entre Ciências, Ofícios, Erudição e Informática, e só uma livre');
      item('Especializações', en <= eg, 'Especializações dentro do limite gratuito (' + en + ' de ' + eg + ')');
      if (en < eg) item('Especializações', false, 'Você ainda tem ' + (eg - en) + ' especialização(ões) gratuita(s) para escolher', 'aviso');
    }

    var afim = afins(f);
    if (criacao) {
      var niveis = f.trilhas.map(function (t) { return num(t.nivel); }).filter(function (n) { return n > 0; }).sort().reverse();
      item('Trilhas', niveis.join() === '2,1', 'Trilhas de criação: 2 pontos numa e 1 ponto noutra');
      var naoAfins = f.trilhas.filter(function (t) { return num(t.nivel) > 0 && !trilhaAfim(f, t); });
      item('Trilhas', naoAfins.length === 0, 'As duas Trilhas de criação são afins à raça');
    }
    if (r && r.quirk) item('Trilhas', f.trilhas.some(function (t) { return t.tipo === 'Quirk'; }), f.raca === 'Cyberpunk' ? 'Cyberpunk: a Quirk depende da história — combine com o Narrador' : 'A raça tem Quirk: crie a sua com o Narrador', 'aviso');
    var qs = f.trilhas.filter(function (t) { return t.tipo === 'Quirk'; }), quirks = qs.length;
    var seg = f.vant.filter(function (v) { return norm(v.nome) === 'segunda quirk'; });
    var trinity = f.raca === 'Punk' && num(f.despertar) >= 5;
    var maxQ = f.raca === 'Punk' ? 1 + (seg.length >= 1 ? 1 : 0) + (seg.length >= 2 && num(f.despertar) >= 2 ? 1 : 0) + (trinity && seg.length < 2 ? 1 : 0) : (r && r.quirk ? 1 : 0);
    item('Trilhas', quirks <= Math.min(maxQ, 3), 'Quantidade de Quirks permitida (' + quirks + ' de ' + Math.min(maxQ, 3) + ')');
    if (seg.length >= 2) item('Vantagens', num(f.despertar) >= 2, 'A terceira Quirk exige Despertar 2 ou mais');
    function tetoSeg(pts) { return pts >= 7 ? 5 : pts >= 5 ? 3 : pts >= 3 ? 2 : 0; }
    if (qs[1] && seg[0]) item('Trilhas', num(qs[1].nivel) <= tetoSeg(num(seg[0].pts)), 'Segunda Quirk no máximo nível ' + tetoSeg(num(seg[0].pts)) + ' (' + num(seg[0].pts) + ' pontos)');
    if (qs[2] && seg[1] && !trinity) item('Trilhas', num(qs[2].nivel) <= tetoSeg(num(seg[1].pts) / 2), 'Terceira Quirk no máximo nível ' + tetoSeg(num(seg[1].pts) / 2) + ' (' + num(seg[1].pts) + ' pontos, custo dobrado)');
    item('Trilhas', f.trilhas.every(function (t) { return num(t.nivel) <= 5; }), 'Nenhuma Trilha acima de 5');

    var pt = pontos(f);
    if (criacao) {
      item('Vantagens', pt.vant <= pt.limiteVant, 'Vantagens: ' + pt.vant + ' de ' + pt.limiteVant + ' pontos');
      if (pt.vant < pt.limiteVant) item('Vantagens', false, 'Ainda sobram ' + (pt.limiteVant - pt.vant) + ' ponto(s) de Vantagem', 'aviso');
      item('Defeitos', pt.def >= 2 && pt.def <= 4, 'Defeitos entre 2 e 4 pontos (' + pt.def + ')');
    }
    if (temVant(f, 'Segunda Quirk')) item('Vantagens', f.raca === 'Punk', 'Segunda Quirk é só para Punk');
    if (!criacao) {
      f.vant.filter(function (v) { return v.nova && !num(v.pts) && (v.nome || '').trim(); }).forEach(function (v) { item('Vantagens', false, v.nome + ': compre com experiência (Anexo D)', 'aviso'); });
      item('Vantagens', !f.vant.some(function (v) { return v.nova && norm(v.nome) === 'gigante'; }), 'Gigante só pode ser comprada na criação');
    }
    var segVista = 0;
    f.vant.forEach(function (v) {
      var c = PH.vantagens.filter(function (x) { return norm(x.nome) === norm(v.nome); })[0];
      if (c && c.opcoes) { var mult = segVista++ ? 2 : 1; if (num(v.pts) && c.opcoes.map(function (o) { return o * mult; }).indexOf(num(v.pts)) < 0) item('Vantagens', false, v.nome + ': valor precisa ser ' + c.opcoes.map(function (o) { return o * mult; }).join(', ')); return; }
      if (c && num(v.pts) && (num(v.pts) < c.min || num(v.pts) > c.max)) item('Vantagens', false, v.nome + ': valor fora da faixa (' + c.custo + ')');
    });
    f.def.forEach(function (v) {
      var c = PH.defeitos.filter(function (x) { return norm(x.nome) === norm(v.nome); })[0];
      if (c && num(v.pts) && (num(v.pts) < c.min || num(v.pts) > c.max)) item('Defeitos', false, v.nome + ': valor fora da faixa (' + c.custo + ')');
    });

    var d = derivados(f);
    item('Moralidade', num(f.moral) <= d.moralMax, f.raca === "Han'you" ? "Han'you: Moralidade no máximo 7" : 'Moralidade entre 0 e 10');
    if (criacao) {
      item('Moralidade', num(f.moral) === 7, 'Moralidade inicial 7', 'aviso');
      item('Despertar', num(f.despertar) === 0, 'Despertar inicial 0');
    }

    var cv = f.convic.filter(function (c) { return (c.txt || '').trim(); });
    item('Convicções', cv.length >= 1 && cv.length <= 3, 'De uma a três Convicções (' + cv.length + ')');
    item('Convicções', cv.every(function (c) { return (c.ancora || '').trim() || c.suspensa; }), 'Cada Convicção tem uma Âncora');
    cv.filter(function (c) { return c.suspensa; }).forEach(function () { item('Convicções', false, 'Convicção suspensa: não apaga Mancha até ganhar uma nova Âncora', 'aviso'); });
    item('Ambição e Desejo', (f.ambicao || '').trim(), 'Ambição definida', 'aviso');
    item('Ambição e Desejo', (f.desejo || '').trim(), 'Desejo da sessão definido', 'aviso');
    if (criacao) item('Experiência', f.id.patamar, 'Patamar inicial escolhido com o Narrador', 'aviso');
    var gasto = xpGasto(f);
    item('Experiência', gasto <= num(f.xp.total), 'XP gasto (' + gasto + ') não passa do ganho (' + num(f.xp.total) + ')');
    return L;
  }

  /* ---------------- experiência (Anexo D) ---------------- */
  var XP_MULT = { 'Atributo': 5, 'Perícia': 3, 'Trilha afim': 5, 'Trilha não-afim': 7, 'Vantagem': 3, 'Moralidade': 10 };
  function xpCusto(tipo, de, para, human) {
    de = num(de); para = num(para);
    if (tipo === 'Vantagem' && de === 0) return para * 3;                 // Vantagem nova: novo valor × 3
    if (tipo === 'Especialização') return 3;
    var m = XP_MULT[tipo]; if (!m || para <= de) return 0;
    var c = 0; for (var n = de + 1; n <= para; n++) c += n * m;
    if (tipo === 'Perícia' && human) c = Math.ceil(c / 2);
    return c;
  }
  function xpGasto(f) { var t = 0; f.xp.log.forEach(function (l) { t += num(l.custo); }); return t; }

  /* ---------------- dados (seções 4 e 5) ---------------- */
  function rolar(n, tensao, rnd) {
    rnd = rnd || Math.random;
    n = Math.max(0, num(n)); tensao = Math.min(Math.max(0, num(tensao)), n);
    var out = [];
    for (var i = 0; i < n; i++) {
      var t = i < tensao, v = 1 + Math.floor(rnd() * 10);
      out.push({ v: v, t: t, x: false });
      while (v === 10) { v = 1 + Math.floor(rnd() * 10); out.push({ v: v, t: t, x: true }); }  // a explosão herda a Tensão
    }
    return out;
  }
  function julgar(dados, limiar) {
    limiar = limiar || 3;
    var r = { s: 0, t1: 0, t10: 0, n1: 0, n10: 0 };
    dados.forEach(function (d) {
      if (d.v >= 6) r.s++;
      if (d.t) { if (d.v === 1) r.t1++; if (d.v === 10) r.t10++; }
      else { if (d.v === 1) r.n1++; if (d.v === 10) r.n10++; }
    });
    r.cobra = r.t1 >= limiar ? 'Compulsão' : r.t1 === 2 ? 'Colapso' : r.t1 === 1 ? 'Tensão' : r.n1 >= 2 ? 'Contratempo' : null;
    r.paga = r.t10 >= 3 ? 'Despertar' : r.t10 === 2 ? 'Sobrecarga' : r.n10 >= 2 ? 'Lampejo' : null;
    return r;
  }
  /* Quando cobra e paga saem juntos (seção 5, "Quando os dois saem juntos"). */
  function combinacao(r) {
    if (r.paga === 'Despertar' && r.cobra) return 'O Despertar devolve todo o superficial. O agravado sempre fica.';
    if (r.paga === 'Sobrecarga' && r.cobra === 'Compulsão') return 'O agravado da Compulsão fica, por mais espetacular que tenha sido o acerto.';
    if (r.paga === 'Sobrecarga' && r.cobra === 'Colapso') return 'Não se anulam: a Vontade empata, mas a consequência grave do Colapso permanece.';
    if (r.paga && r.cobra === 'Tensão') return 'Anulam-se na Força de Vontade — mas o 1 ainda piorou alguma coisa na cena.';
    return '';
  }
  var EFEITO_DEGRAU = {
    'Contratempo': 'Só narrativo: a cena fica mais difícil, a ficha não muda.',
    'Tensão': 'Complicação séria. Você pode marcar 1 superficial de Força de Vontade para reduzi-la a um detalhe.',
    'Colapso': '1 superficial de Força de Vontade e consequência grave, obrigatória. Dispara a Falha racial.',
    'Compulsão': '1 agravado de Força de Vontade, e a Compulsão da sua raça dita a próxima ação.',
    'Lampejo': 'Devolve 1 superficial de Força de Vontade, ou uma vantagem tática pequena.',
    'Sobrecarga': 'Devolve 1 superficial de Força de Vontade e dá vantagem tática na cena.',
    'Despertar': 'Sucesso absoluto. Poderes sem custo e com +3 dados até o fim da cena; recupera todo o superficial de Vontade; ao fim da cena, +1 Despertar e uma Consequência.'
  };

  /* Dano (seção 8): margem + arma; Blindagem subtrai do líquido conforme o tipo; Perfuração ignora;
     um ataque que vence sempre causa ao menos 1; superficial divide por dois antes de marcar. */
  function dano(o) {
    var margem = num(o.margem); if (margem <= 0) return null;
    var bruto = margem + num(o.arma && o.arma.dano) + (o.ataqueTotal ? 1 : 0);
    if (o.surpresa) bruto *= 2;
    var tipo = (o.arma && o.arma.tipo) || 'agr';
    var bt = o.alvoTipo || 'pesada', bv = num(o.alvoBlind);
    var cobre = bt === 'magitek' || (bt === 'pesada' && !o.divino) || (bt === 'leve' && tipo === 'sup');
    var ign = o.arma && o.arma.ignora;
    if (ign === 'naoMagitek' && bt !== 'magitek') cobre = false;       // DOMAIN 3+: só Magitek segura
    var ef = cobre ? Math.max(0, bv - num(o.arma && o.arma.perf)) : 0;
    if (ign === 'toda' || (o.arma && o.arma.perfTotal)) ef = 0;           // energia divina, glyph de expurgo, toque de Youkai
    var liquido = Math.max(bruto - ef, 1);
    var marca = tipo === 'sup' ? Math.floor(liquido / 2) : liquido;
    return { bruto: bruto, blindagem: ef, liquido: liquido, marca: marca, tipo: tipo };
  }

  /* Parada de uma rolagem do catálogo, a partir da ficha. */
  function parada(f, tipo, extra) {
    extra = extra || {};
    var partes = [], total = 0;
    function soma(rot, v) { v = num(v); partes.push(rot + ' ' + v); total += v; }
    if (tipo.remorso) { var m = num(f.moral), mc = num(f.manchas); partes.push('Moralidade ' + m, '− Manchas ' + mc); total = m - mc; }
    else if (tipo.livre) { if (extra.atr) soma(extra.atr, f.atr[extra.atr]); if (extra.per) soma(extra.per, f.per[extra.per]); }
    else if (tipo.trilha) { if (extra.atr) soma(extra.atr, f.atr[extra.atr]); if (extra.per) soma(extra.per, f.per[extra.per]); }
    else {
      if (tipo.a) soma(tipo.a, f.atr[tipo.a]);
      if (tipo.a2) soma(tipo.a2, f.atr[tipo.a2]);
      if (tipo.p) soma(tipo.p, f.per[tipo.p]);
    }
    if (tipo.bonus) { partes.push('+' + tipo.bonus + ' manobra'); total += tipo.bonus; }
    if (extra.esp) { partes.push('+1 especialização'); total += 1; }
    if (num(extra.mira)) { partes.push('+' + num(extra.mira) + ' Mira'); total += num(extra.mira); }
    (extra.bonus || []).forEach(function (b) { if (num(b.v)) { partes.push('+' + num(b.v) + ' ' + b.rot); total += num(b.v); } });
    if (num(extra.mod)) { partes.push((num(extra.mod) > 0 ? '+' : '') + num(extra.mod) + ' modificador'); total += num(extra.mod); }
    var deb = debilitado(f);
    var usaFis = tipo.fisico || (extra.atr && FISICOS.indexOf(extra.atr) >= 0);
    var usaSoc = tipo.social || tipo.mental || (extra.atr && FISICOS.indexOf(extra.atr) < 0);
    if (deb.saude && usaFis) { partes.push('−2 Debilitado (Saúde)'); total -= 2; }
    if (deb.fv && usaSoc && !tipo.remorso) { partes.push('−2 Debilitado (Vontade)'); total -= 2; }
    return { total: Math.max(0, total), partes: partes, tensao: Math.min(num(f.atr['Autocontrole']), Math.max(0, total)) };
  }

  /* ---------------- trilhas de dano ---------------- */
  function debilitado(f) {
    var d = derivados(f);
    function cheia(arr, n) { if (!n) return false; var c = 0; for (var i = 0; i < n; i++) if (num(arr[i]) > 0) c++; return c >= n; }
    return { saude: cheia(f.saude, d.saude.total), fv: cheia(f.fv, d.fv.total) };
  }

  var API = {
    ATR: ATR, PER: PER, PERFIS: PERFIS, DIST_ATR: DIST_ATR, ESP_GRATIS: ESP_GRATIS, FISICOS: FISICOS, SOCIAIS: SOCIAIS,
    novaFicha: novaFicha, completar: completar, raca: raca, racaBase: racaBase, falhas: falhas, compulsoes: compulsoes,
    tamanho: tamanho, derivados: derivados, blindagem: blindagem, afins: afins, trilhaAfim: trilhaAfim, espGratis: espGratis,
    opcoesAfimBase: opcoesAfimBase, opcoesAfimLivre: opcoesAfimLivre, capAtributo: capAtributo,
    pontos: pontos, perfilPericias: perfilPericias, verificar: verificar, xpCusto: xpCusto, xpGasto: xpGasto,
    rolar: rolar, julgar: julgar, combinacao: combinacao, EFEITO_DEGRAU: EFEITO_DEGRAU, dano: dano, parada: parada,
    debilitado: debilitado, limiarCompulsao: limiarCompulsao, nivelTrilha: nivelTrilha, temVant: temVant, norm: norm, num: num
  };
  root.PHR = API;
  if (typeof module !== 'undefined') module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
