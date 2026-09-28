/* PlanetHell — exportar a ficha: planilha .xlsx (abre no Excel e no Google Sheets), PDF (impressão) e .json. */
(function () {
  'use strict';
  var R = window.PHR, PH = window.PH;
  var num = function (v) { v = parseInt(v, 10); return isNaN(v) ? 0 : v; };
  function nomeArquivo(f, ext) {
    var n = (f.id.personagem || 'ficha').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'ficha';
    return 'PlanetHell-' + n + '.' + ext;
  }
  function baixar(blob, nome) {
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = nome; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }
  function limpo(s) { return String(s == null ? '' : s).replace(/\*\*?/g, ''); }

  /* ---------------- .json ---------------- */
  function json(f) { baixar(new Blob([JSON.stringify({ app: 'PlanetHell', versao: 1, exportado: new Date().toISOString(), ficha: f }, null, 1)], { type: 'application/json' }), nomeArquivo(f, 'json')); }

  /* ---------------- PDF: a própria ficha com folha de impressão ---------------- */
  function pdf(f) {
    var titulo = document.title, abertos = [];
    document.querySelectorAll('details').forEach(function (d) { if (!d.open) { d.open = true; abertos.push(d); } });
    document.title = nomeArquivo(f, 'pdf').replace(/\.pdf$/, '');     // vira o nome sugerido do arquivo
    document.querySelectorAll('textarea').forEach(function (t) { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; });
    var fim = function () { document.title = titulo; abertos.forEach(function (d) { d.open = false; }); window.removeEventListener('afterprint', fim); };
    window.addEventListener('afterprint', fim);
    setTimeout(function () { window.print(); }, 50);
  }

  /* ---------------- .xlsx no visual da ficha original ---------------- */
  var VERDE = 'FF00FF00', CINZA = 'FF242424', PRETO = 'FF000000', VERDE2 = 'FF339966';
  var FONTE = 'Orbitron';
  function estilo(c, o) {
    o = o || {};
    c.font = { name: o.leitura ? 'Arial' : FONTE, size: o.size || 10, bold: !!o.bold, color: { argb: o.cor || VERDE } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: o.fundo || PRETO } };
    c.alignment = { vertical: 'middle', horizontal: o.h || 'left', wrapText: !!o.wrap };
    c.border = { top: { style: 'thin', color: { argb: o.borda || VERDE2 } }, left: { style: 'thin', color: { argb: o.borda || VERDE2 } }, bottom: { style: 'thin', color: { argb: o.borda || VERDE2 } }, right: { style: 'thin', color: { argb: o.borda || VERDE2 } } };
  }
  function pintarFundo(ws, linhas, colunas) {
    for (var r = 1; r <= linhas; r++) for (var c = 1; c <= colunas; c++) {
      var cel = ws.getCell(r, c); if (!cel.fill || cel.fill.fgColor === undefined) cel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRETO } };
    }
  }
  function novaAba(wb, nome, larguras) {
    var ws = wb.addWorksheet(nome, { views: [{ showGridLines: false }], properties: { tabColor: { argb: VERDE } } });
    ws.columns = larguras.map(function (w) { return { width: w }; });
    return ws;
  }
  function titulo(ws, r, texto, cols) {
    ws.mergeCells(r, 1, r, cols); var c = ws.getCell(r, 1); c.value = texto; estilo(c, { size: 12, bold: true, fundo: CINZA });
    ws.getRow(r).height = 20; return r + 1;
  }
  function rot(ws, r, c, texto) { var x = ws.getCell(r, c); x.value = texto; estilo(x, { size: 10, bold: true, fundo: CINZA }); return x; }
  function val(ws, r, c, v, o) { var x = ws.getCell(r, c); x.value = v; estilo(x, Object.assign({ size: 10 }, o || {})); return x; }
  function trilhaTxt(arr, n) { var s = ''; for (var i = 0; i < n; i++) s += num(arr[i]) === 2 ? '[X]' : num(arr[i]) === 1 ? '[/]' : '[ ]'; return s; }

  function xlsx(f) {
    if (!window.ExcelJS) return Promise.reject(new Error('a biblioteca de planilhas não carregou (sem internet?)'));
    var wb = new window.ExcelJS.Workbook(); wb.creator = 'PlanetHell'; wb.created = new Date();
    var d = R.derivados(f), r, i;

    /* ---- aba 1: Ficha ---- */
    var ws = novaAba(wb, 'Ficha', [20, 16, 20, 16, 20, 16]);
    ws.mergeCells('A1:F1'); var t = ws.getCell('A1'); t.value = 'PlanetHell: 2663'; estilo(t, { size: 28, h: 'center', borda: PRETO }); ws.getRow(1).height = 42;
    ws.mergeCells('A2:F2'); var t2 = ws.getCell('A2'); t2.value = 'Ficha de Personagem'; estilo(t2, { size: 10, h: 'center', borda: PRETO });
    r = 4;
    [['Nome:', f.id.personagem, 'Conceito:', f.id.conceito, 'Crônica:', f.id.cronica],
     ['Jogador:', f.id.jogador, 'Raça:', f.raca + (f.racaBase ? ' (base ' + f.racaBase + ')' : ''), 'Idade:', f.id.idade],
     ['Nação:', f.id.nacao, 'Patamar:', f.id.patamar, 'Aparência:', f.id.aparencia]].forEach(function (lin) {
      for (var k = 0; k < 6; k += 2) { rot(ws, r, k + 1, lin[k]); val(ws, r, k + 2, lin[k + 1] || '', { wrap: true }); }
      r++;
    });
    /* o retrato, quando existe, entra flutuando à direita do cabeçalho */
    if (f.foto && /^data:image\/(jpeg|jpg|png);base64,/.test(f.foto)) {
      try {
        var idImg = wb.addImage({ base64: f.foto, extension: /png/.test(f.foto.slice(0, 20)) ? 'png' : 'jpeg' });
        ws.addImage(idImg, { tl: { col: 5.05, row: 0.15 }, ext: { width: 96, height: 128 } });
      } catch (e) { /* uma planilha sem foto é melhor do que nenhuma planilha */ }
    }
    r++;
    r = titulo(ws, r, 'Atributos', 6);
    var cel = {};                                           // endereço de cada atributo, para as fórmulas
    [['Físicos', 'Físico'], ['Sociais', 'Social'], ['Mentais', 'Mental']].forEach(function (g, gi) {
      rot(ws, r, gi * 2 + 1, g[0]); ws.mergeCells(r, gi * 2 + 1, r, gi * 2 + 2);
    });
    r++;
    for (i = 0; i < 3; i++) {
      [['Físico'], ['Social'], ['Mental']].forEach(function (g, gi) {
        var a = PH.atributos.filter(function (x) { return x.grupo === g[0]; })[i];
        rot(ws, r, gi * 2 + 1, a.nome + ':'); val(ws, r, gi * 2 + 2, num(f.atr[a.nome]), { size: 12, h: 'center' });
        cel[a.nome] = ws.getCell(r, gi * 2 + 2).address;
      });
      r++;
    }
    r++;
    r = titulo(ws, r, 'Derivados (as fórmulas recalculam se você mudar um Atributo)', 6);
    var ext = d.fv.base - num(f.atr['Autocontrole']) - num(f.atr['Perseverança']);
    var derivs = [
      ['Tamanho:', d.tamanho, null],
      ['Saúde:', d.saude.total, cel['Vigor'] + '+' + d.tamanho + (d.saude.mod ? '+' + d.saude.mod : '')],
      ['Força de Vontade:', d.fv.total, cel['Autocontrole'] + '+' + cel['Perseverança'] + (ext ? (ext > 0 ? '+' : '') + ext : '') + (d.fv.mod ? '+' + d.fv.mod : '')],
      ['Dados de Tensão:', d.tensao, cel['Autocontrole']],
      ['Iniciativa (+1d10):', d.ini.total, cel['Destreza'] + '+' + cel['Autocontrole'] + (d.ini.total - num(f.atr['Destreza']) - num(f.atr['Autocontrole']) ? '+' + (d.ini.total - num(f.atr['Destreza']) - num(f.atr['Autocontrole'])) : '')],
      ['Deslocamento (m):', d.desl.total, cel['Força'] + '+' + cel['Destreza'] + '+' + (d.desl.total - num(f.atr['Força']) - num(f.atr['Destreza']))],
      ['Blindagem:', d.blindagem.valor + (d.blindagem.tipo ? ' ' + d.blindagem.tipo : ''), null],
      ['Moralidade:', num(f.moral), null], ['Manchas:', num(f.manchas), null], ['Despertar:', num(f.despertar), null]
    ];
    for (i = 0; i < derivs.length; i += 3) {
      for (var k = 0; k < 3 && i + k < derivs.length; k++) {
        var x = derivs[i + k]; rot(ws, r, k * 2 + 1, x[0]);
        var c = ws.getCell(r, k * 2 + 2); c.value = x[2] ? { formula: x[2], result: x[1] } : x[1]; estilo(c, { size: 12, h: 'center', bold: true });
      }
      r++;
    }
    if (f.consequencias.length) { rot(ws, r, 1, 'Consequências:'); ws.mergeCells(r, 2, r, 6); val(ws, r, 2, f.consequencias.map(function (c) { var x = PH.consequencias.filter(function (k) { return k.d === num(c.d); })[0]; return (x ? limpo(x.txt).split('.')[0] : '?') + (c.nota ? ' (' + c.nota + ')' : ''); }).join(' · '), { leitura: true, wrap: true }); r++; }
    if (num(f.despertar) >= 4 && f.atrDespertar) { rot(ws, r, 1, 'Despertar 4:'); ws.mergeCells(r, 2, r, 6); val(ws, r, 2, f.atrDespertar + ' pode passar de 5', { leitura: true }); r++; }
    rot(ws, r, 1, 'Saúde:'); ws.mergeCells(r, 2, r, 6); val(ws, r, 2, trilhaTxt(f.saude, d.saude.total) + '   [/] superficial  [X] agravado', { leitura: true }); r++;
    rot(ws, r, 1, 'Vontade:'); ws.mergeCells(r, 2, r, 6); val(ws, r, 2, trilhaTxt(f.fv, d.fv.total), { leitura: true }); r += 2;

    r = titulo(ws, r, 'Perícias', 6);
    [['Físicas', 'Física'], ['Sociais', 'Social'], ['Mentais', 'Mental']].forEach(function (g, gi) { rot(ws, r, gi * 2 + 1, g[0]); ws.mergeCells(r, gi * 2 + 1, r, gi * 2 + 2); });
    r++;
    for (i = 0; i < 9; i++) {
      [['Física'], ['Social'], ['Mental']].forEach(function (g, gi) {
        var p = PH.pericias.filter(function (x) { return x.grupo === g[0]; })[i];
        var esp = f.esp.filter(function (e) { return e.pericia === p.nome && (e.nome || '').trim(); }).map(function (e) { return e.nome; });
        rot(ws, r, gi * 2 + 1, p.nome + (esp.length ? ' (' + esp.join(', ') + ')' : '') + ':'); val(ws, r, gi * 2 + 2, num(f.per[p.nome]), { size: 12, h: 'center' });
      });
      r++;
    }
    r++;
    r = titulo(ws, r, 'Raça — ' + (f.raca || 'não escolhida'), 6);
    R.falhas(f).forEach(function (x) { rot(ws, r, 1, 'Falha:'); ws.mergeCells(r, 2, r, 6); val(ws, r, 2, x.nome + ' — ' + limpo(x.txt), { wrap: true, leitura: true }); ws.getRow(r).height = 30; r++; });
    R.compulsoes(f).forEach(function (x) { rot(ws, r, 1, 'Compulsão:'); ws.mergeCells(r, 2, r, 6); val(ws, r, 2, x.nome + ' — ' + limpo(x.impulso) + '. Em combate: ' + limpo(x.combate), { wrap: true, leitura: true }); ws.getRow(r).height = 30; r++; });
    var rc = R.raca(f); if (rc) rc.vantagens.forEach(function (v) { rot(ws, r, 1, 'Vantagem racial:'); ws.mergeCells(r, 2, r, 6); val(ws, r, 2, v.nome + ' — ' + limpo(v.txt), { wrap: true, leitura: true }); ws.getRow(r).height = 30; r++; });
    pintarFundo(ws, r + 2, 6);

    /* ---- aba 2: Poderes ---- */
    var wp = novaAba(wb, 'Poderes', [26, 8, 40, 40, 40, 40, 40]);
    r = titulo(wp, 1, 'Trilhas de Poder', 7);
    ['Trilha', 'Nível', 'Nível 1 (grátis)', 'Nível 2 (1 sup.)', 'Nível 3 (1 sup.)', 'Nível 4 (2 sup.)', 'Nível 5 (1 agr., 1×/cena)'].forEach(function (h, k) { rot(wp, r, k + 1, h); });
    r++;
    f.trilhas.forEach(function (tr) {
      val(wp, r, 1, (tr.tipo === 'Quirk' ? 'Quirk · ' : '') + (tr.tipo === 'Quirk' ? tr.nome : tr.tipo) + (tr.tipo !== 'Quirk' && tr.nome ? ' (' + tr.nome + ')' : ''), { bold: true });
      val(wp, r, 2, num(tr.nivel), { h: 'center', size: 12 });
      for (var k = 0; k < 5; k++) {
        var fix = PH.trilhas[tr.tipo], lv = (tr.niveis || [])[k] || {};
        val(wp, r, k + 3, fix ? limpo(fix.niveis[k]) : ((lv.nome ? lv.nome + ': ' : '') + (lv.efeito || '')), { wrap: true, leitura: true, cor: num(tr.nivel) > k ? VERDE : VERDE2 });
      }
      wp.getRow(r).height = 48; r++;
    });
    pintarFundo(wp, r + 2, 7);

    /* ---- aba 3: Vantagens e Defeitos ---- */
    var wv = novaAba(wb, 'Vantagens e Defeitos', [28, 8, 30, 60]);
    [['Vantagens', f.vant, PH.vantagens, 'FF00E5FF'], ['Defeitos', f.def, PH.defeitos, 'FFFF6A1A']].forEach(function (bloco, bi) {
      r = titulo(wv, bi ? r + 1 : 1, bloco[0], 4);
      ['Nome', 'Pontos', 'Detalhe', 'Efeito'].forEach(function (h, k) { rot(wv, r, k + 1, h); });
      var ini = ++r;
      bloco[1].forEach(function (v) {
        var cat = bloco[2].filter(function (x) { return R.norm(x.nome) === R.norm(v.nome); })[0];
        val(wv, r, 1, v.nome || '', { bold: true, cor: bloco[3] }); val(wv, r, 2, num(v.pts), { h: 'center', cor: bloco[3], size: 12 });
        val(wv, r, 3, v.nota || '', { wrap: true, leitura: true }); val(wv, r, 4, cat ? limpo(cat.txt) : (v.desc ? v.desc + ' (outro sistema)' : ''), { wrap: true, leitura: true });
        wv.getRow(r).height = 36; r++;
      });
      rot(wv, r, 1, 'Total');
      var tc = wv.getCell(r, 2); tc.value = { formula: 'SUM(B' + ini + ':B' + Math.max(ini, r - 1) + ')', result: bloco[1].reduce(function (a, v) { return a + num(v.pts); }, 0) }; estilo(tc, { h: 'center', bold: true, cor: bloco[3], size: 12 });
      r++;
    });
    pintarFundo(wv, r + 2, 4);

    /* ---- aba 4: Equipamento ---- */
    var we = novaAba(wb, 'Equipamento', [28, 10, 14, 12, 50]);
    r = titulo(we, 1, 'Recursos', 5);
    rot(we, r, 1, 'Créditos'); val(we, r, 2, num(f.creditos), { h: 'center' });
    rot(we, r, 3, 'Bens e favores'); we.mergeCells(r, 4, r, 5); val(we, r, 4, f.bens || '', { leitura: true, wrap: true }); r += 2;
    r = titulo(we, r, 'Armas', 5);
    ['Arma', 'Dano', 'Tipo', 'Perfuração', 'Notas'].forEach(function (h, k) { rot(we, r, k + 1, h); }); r++;
    f.armas.forEach(function (a) { val(we, r, 1, a.nome || ''); val(we, r, 2, '+' + num(a.dano), { h: 'center' }); val(we, r, 3, a.tipo === 'sup' ? 'superficial' : 'agravado'); val(we, r, 4, num(a.perf), { h: 'center' }); val(we, r, 5, a.nota || '', { leitura: true, wrap: true }); r++; });
    r = titulo(we, r + 1, 'Blindagem', 5);
    ['Peça', 'Valor', 'Tipo'].forEach(function (h, k) { rot(we, r, k + 1, h); }); r++;
    f.blindagens.forEach(function (a) { val(we, r, 1, a.nome || ''); val(we, r, 2, num(a.valor), { h: 'center' }); val(we, r, 3, a.tipo || ''); r++; });
    r = titulo(we, r + 1, 'Outros itens', 5);
    f.itens.forEach(function (a) { val(we, r, 1, a.nome || ''); we.mergeCells(r, 2, r, 5); val(we, r, 2, a.nota || '', { leitura: true, wrap: true }); r++; });
    pintarFundo(we, r + 2, 5);

    /* ---- aba 5: Convicções e Experiência ---- */
    var wc = novaAba(wb, 'Convicções e XP', [14, 50, 30, 12]);
    r = titulo(wc, 1, 'Convicções e Âncoras', 4);
    f.convic.forEach(function (c, k) { rot(wc, r, 1, 'Convicção ' + (k + 1)); wc.mergeCells(r, 2, r, 3); val(wc, r, 2, c.txt || '', { wrap: true, leitura: true }); val(wc, r, 4, (c.ancora || '') + (c.suspensa ? ' (suspensa)' : '')); wc.getRow(r).height = 30; r++; });
    rot(wc, r, 1, 'Ambição'); wc.mergeCells(r, 2, r, 4); val(wc, r, 2, f.ambicao || '', { leitura: true, wrap: true }); r++;
    rot(wc, r, 1, 'Desejo'); wc.mergeCells(r, 2, r, 4); val(wc, r, 2, f.desejo || '', { leitura: true, wrap: true }); r += 2;
    r = titulo(wc, r, 'Experiência', 4);
    ['Data', 'Registro', '', 'XP'].forEach(function (h, k) { rot(wc, r, k + 1, h); }); r++;
    var ini2 = r, pat = PH.patamares.filter(function (p) { return p.nome === f.id.patamar; })[0];
    if (pat) { val(wc, r, 1, ''); val(wc, r, 2, 'Patamar inicial: ' + pat.nome, { leitura: true }); val(wc, r, 3, ''); val(wc, r, 4, pat.xp, { h: 'center' }); r++; }
    (f.xp.ganhos || []).forEach(function (g) { val(wc, r, 1, g.data || ''); val(wc, r, 2, g.nota || 'Ganho', { leitura: true }); val(wc, r, 3, ''); val(wc, r, 4, num(g.qtd), { h: 'center' }); r++; });
    f.xp.log.forEach(function (l) { val(wc, r, 1, l.data || ''); val(wc, r, 2, l.o, { leitura: true }); val(wc, r, 3, ''); val(wc, r, 4, -num(l.custo), { h: 'center', cor: 'FFFFB000' }); r++; });
    rot(wc, r, 3, 'Disponível');
    var tot = (pat ? pat.xp : 0) + (f.xp.ganhos || []).reduce(function (a, g) { return a + num(g.qtd); }, 0) - R.xpGasto(f);
    var xc = wc.getCell(r, 4); xc.value = { formula: 'SUM(D' + ini2 + ':D' + Math.max(ini2, r - 1) + ')', result: tot }; estilo(xc, { h: 'center', bold: true, size: 12 });
    pintarFundo(wc, r + 2, 4);

    /* ---- aba 6: História ---- */
    var wh = novaAba(wb, 'História', [100]);
    r = titulo(wh, 1, 'História', 1); val(wh, r, 1, f.historia || '', { leitura: true, wrap: true }); wh.getRow(r).height = 300;
    r = titulo(wh, r + 2, 'Notas da crônica', 1); val(wh, r, 1, f.notas || '', { leitura: true, wrap: true }); wh.getRow(r).height = 300;

    return wb.xlsx.writeBuffer().then(function (buf) {
      baixar(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nomeArquivo(f, 'xlsx'));
      return buf;
    });
  }

  window.PHExport = { xlsx: xlsx, pdf: pdf, json: json, nomeArquivo: nomeArquivo };
})();
