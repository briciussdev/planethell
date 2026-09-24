/* node testes/regras.test.js — testa o motor de regras contra o guia. */
global.window = global; require('../ficha/dados.js'); require('../ficha/rolagens.js');
const R = require('../ficha/regras.js'); const nadia = require('./nadia.js');
let falhou = 0, total = 0;
function ok(c, msg) { total++; if (!c) { falhou++; console.log('  FALHOU:', msg); } }
function eq(a, b, msg) { ok(JSON.stringify(a) === JSON.stringify(b), msg + ' — esperado ' + JSON.stringify(b) + ', veio ' + JSON.stringify(a)); }

// 1. ficha em branco
const b = R.novaFicha();
eq(R.ATR.length, 9, 'nove atributos'); eq(R.PER.length, 27, 'vinte e sete perícias');
ok(R.ATR.every(a => b.atr[a] === 0) && R.PER.every(p => b.per[p] === 0), 'ficha nasce em branco');
ok(b.id.personagem === '' && b.raca === '' && b.trilhas.length === 0 && b.vant.length === 0, 'nada pré-preenchido');
ok(R.verificar(b).some(i => !i.ok), 'ficha em branco não passa na verificação');

// 2. Nadia, exemplo do guia
const f = nadia(R);
const d = R.derivados(f);
eq(d.tamanho, 3, 'Tamanho do Cyberpunk'); eq(d.saude.total, 5, 'Saúde = Vigor 2 + Tamanho 3');
eq(d.fv.total, 6, 'Força de Vontade = 3 + 3'); eq(d.tensao, 3, 'Tensão = Autocontrole');
eq(d.ini.total, 6, 'Iniciativa = Des + Auto'); eq(d.desl.total, 10, 'Deslocamento = For + Des + 5');
eq([d.blindagem.valor, d.blindagem.tipo], [1, 'pesada'], 'Hard Wired: Blindagem pesada 1');
eq(R.espGratis(f), 4, 'especializações gratuitas da Nadia');
eq(R.perfilPericias(f).perfil, 'Especialista', 'perfil de perícias');
eq(R.perfilPericias(f).total, 26, 'perfis valem 26 pontos');
eq(R.pontos(f), { vant: 7, def: 2, limiteVant: 7 }, 'pontos de vantagem e defeito');
eq(R.falhas(f).map(x => x.nome), ['Maintenance', 'Prey'], 'Trick or Treat acrescenta a Falha da raça-base');
eq(R.compulsoes(f).map(x => x.chave), ['Optimization', 'Survival'], 'Trick or Treat acrescenta a Compulsão');
const erros = R.verificar(f).filter(i => !i.ok);
eq(erros.map(e => e.msg), [], 'Nadia passa em todas as regras de criação');

// 3. violações detectadas
const g = nadia(R); g.atr['Força'] = 3; ok(R.verificar(g).some(i => !i.ok && i.grupo === 'Atributos'), 'distribuição errada de atributos');
const h = nadia(R); h.per['Briga'] = 1; ok(R.verificar(h).some(i => !i.ok && i.grupo === 'Perícias'), 'perícias fora dos perfis');
const k = nadia(R); k.vant.push({ nome: 'Gigante', pts: 4 }); ok(R.verificar(k).some(i => !i.ok && i.grupo === 'Vantagens'), 'vantagens acima do limite');
eq(R.derivados(k).tamanho, 4, 'Gigante +1 Tamanho'); eq(R.derivados(k).saude.total, 6, 'Gigante +1 Saúde');
const m = nadia(R); m.def.push({ nome: 'Frágil', pts: 2 }); eq(R.pontos(m).limiteVant, 9, 'defeitos extras dão até +2 de vantagem');
eq(R.derivados(m).saude.total, 4, 'Frágil −1 Saúde');
const n = nadia(R); n.trilhas[0].tipo = 'Wings'; ok(R.verificar(n).some(i => !i.ok && i.grupo === 'Trilhas'), 'trilha não afim na criação');
const o = nadia(R); o.convic[0].ancora = ''; ok(R.verificar(o).some(i => !i.ok && i.grupo === 'Convicções'), 'convicção sem âncora');
const p = nadia(R); p.esp.push({ pericia: 'Briga', nome: 'Boxe' }); ok(R.verificar(p).some(i => !i.ok && i.grupo === 'Especializações'), 'especialização sem perícia e acima do limite');
const q = nadia(R); q.raca = 'Punk'; q.racaBase = ''; q.vant.push({ nome: 'Segunda Quirk', pts: 3 });
ok(!R.verificar(q).some(i => !i.ok && /só para Punk/.test(i.msg)), 'Segunda Quirk vale para Punk');
q.raca = 'Human'; ok(R.verificar(q).some(i => !i.ok && /só para Punk/.test(i.msg)), 'Segunda Quirk barrada fora do Punk');
const hy = nadia(R); hy.raca = "Han'you"; hy.racaBase = ''; hy.moral = 8; ok(R.verificar(hy).some(i => !i.ok && i.grupo === 'Moralidade'), "Han'you não passa de 7");

// 4. raças: tamanhos fixos e afinidades
const tams = { Human: 3, Punk: 3, Cyberpunk: 3, Android: 3, Lycan: 3, Mecha: 5, Other: 4, Anunnaki: 4, Nefilin: 4, Youkai: 4, "Han'you": 3 };
Object.keys(tams).forEach(rc => { const x = R.novaFicha(); x.raca = rc; eq(R.tamanho(x), tams[rc], 'Tamanho ' + rc); });
const mc = R.novaFicha(); mc.raca = 'Mecha'; eq(R.blindagem(mc).valor, 3, 'Mecha: Tosei Dō, Blindagem base 3');
const cy = nadia(R); cy.blindagens.push({ nome: 'Colete', valor: 2, tipo: 'pesada' }); eq(R.blindagem(cy).valor, 2, 'Hard Wired não soma com colete: vale o maior');
const bw = nadia(R); bw.trilhas.push({ tipo: 'Bulwark', nivel: 4 }); eq(R.blindagem(bw).valor, 4, 'Bulwark 1 e 4 somam +3');
const an = R.novaFicha(); an.raca = 'Anunnaki'; eq(R.afins(an).nomes, ['Miracle', 'Domain', 'Omniscience'], 'afins do Anunnaki');
eq(R.afins(f).nomes.concat(R.afins(f).quirk ? ['Quirk'] : []), ['Improvement', 'Bond', 'Quirk'], 'Cyberpunk: a Quirk, Improvement e UMA da raça-base, a escolhida');
const sem = nadia(R); sem.afimBase = ''; ok(R.verificar(sem).some(i => !i.ok && /raça-base/.test(i.msg)), 'pede a escolha da Trilha da raça-base');
const hu = R.novaFicha(); hu.raca = 'Human';
ok(!R.trilhaAfim(hu, { tipo: 'Wings' }), 'Human: sem escolher, Wings não é afim');
hu.afimLivre = 'Wings'; ok(R.trilhaAfim(hu, { tipo: 'Wings' }) && !R.trilhaAfim(hu, { tipo: 'Chaos' }), 'Human: só a Trilha livre escolhida vira afim');
// Despertar 4: um Atributo só
const d4 = nadia(R); d4.modo = 'jogo'; d4.despertar = 4; d4.atrDespertar = 'Força';
eq([R.capAtributo(d4, 'Força'), R.capAtributo(d4, 'Vigor')], [6, 5], 'Despertar 4 libera 6 só no Atributo escolhido');
d4.atr['Vigor'] = 6; ok(R.verificar(d4).some(i => !i.ok && i.grupo === 'Atributos'), 'outro Atributo em 6 é recusado');
// Apex
const ly = R.novaFicha(); ly.raca = 'Lycan'; ly.despertar = 5; eq(R.tamanho(ly), 4, 'Lycan Apex: Tamanho +1');
// armas que ignoram blindagem
eq(R.dano({ margem: 1, arma: { dano: 2, tipo: 'agr', ignora: 'toda' }, alvoBlind: 5, alvoTipo: 'magitek' }).marca, 3, 'energia divina ignora até Magitek');
eq(R.dano({ margem: 1, arma: { dano: 2, tipo: 'agr', ignora: 'naoMagitek' }, alvoBlind: 3, alvoTipo: 'pesada' }).marca, 3, 'DOMAIN 3 ignora blindagem pesada');
eq(R.dano({ margem: 1, arma: { dano: 2, tipo: 'agr', ignora: 'naoMagitek' }, alvoBlind: 2, alvoTipo: 'magitek' }).marca, 1, 'DOMAIN 3 para na Magitek');
// segunda e terceira Quirk
const pk = R.novaFicha(); pk.raca = 'Punk'; pk.modo = 'jogo';
pk.trilhas = [{ tipo: 'Quirk', nome: 'A', nivel: 3 }, { tipo: 'Quirk', nome: 'B', nivel: 3 }];
pk.vant = [{ nome: 'Segunda Quirk', pts: 3 }];
ok(R.verificar(pk).some(i => !i.ok && /Segunda Quirk no máximo nível 2/.test(i.msg)), 'Segunda Quirk de 3 pontos para no nível 2');
pk.vant[0].pts = 5; ok(!R.verificar(pk).some(i => !i.ok && /Segunda Quirk no máximo/.test(i.msg)), '5 pontos liberam o nível 3');
pk.trilhas.push({ tipo: 'Quirk', nome: 'C', nivel: 1 }); pk.vant.push({ nome: 'Segunda Quirk', pts: 6 });
ok(R.verificar(pk).some(i => !i.ok && /Despertar 2/.test(i.msg)), 'terceira Quirk exige Despertar 2');
pk.despertar = 2; ok(!R.verificar(pk).some(i => !i.ok && /(Despertar 2|Quantidade de Quirks|valor precisa)/.test(i.msg)), 'com Despertar 2 e custo dobrado, a terceira vale');
pk.vant[1].pts = 3; ok(R.verificar(pk).some(i => !i.ok && /valor precisa ser 6, 10, 14/.test(i.msg)), 'terceira Quirk custa o dobro');
// especializações: uma em cada perícia qualificada
const es = nadia(R); es.esp = [{ pericia: 'Medicina', nome: 'a' }, { pericia: 'Medicina', nome: 'b' }];
ok(R.verificar(es).some(i => !i.ok && /uma em cada/.test(i.msg)), 'duas livres na mesma perícia não valem');
// vantagem nova custa novo valor × 3
eq(R.xpCusto('Vantagem', 0, 3), 9, 'Vantagem nova de 3 pontos custa 9 XP');
const jg = nadia(R); jg.modo = 'jogo'; jg.vant.push({ nome: 'Gigante', pts: 4, nova: true });
ok(R.verificar(jg).some(i => !i.ok && /Gigante só/.test(i.msg)), 'Gigante não se compra em jogo');
const su = nadia(R); su.convic[0].ancora = ''; su.convic[0].suspensa = true;
ok(!R.verificar(su).some(i => i.nivel === 'erro' && i.grupo === 'Convicções'), 'Convicção suspensa não exige Âncora');

// 5. XP (Anexo D)
eq(R.xpCusto('Atributo', 3, 4), 20, 'Atributo 3→4'); eq(R.xpCusto('Atributo', 2, 5), 60, 'Atributo 2→5');
eq(R.xpCusto('Perícia', 2, 3), 9, 'Perícia 2→3'); eq(R.xpCusto('Trilha afim', 1, 2), 10, 'Trilha afim 1→2');
eq(R.xpCusto('Trilha afim', 1, 5), 70, 'Trilha afim 1→5'); eq(R.xpCusto('Trilha não-afim', 1, 2), 14, 'não-afim ×7');
eq(R.xpCusto('Especialização'), 3, 'Especialização'); eq(R.xpCusto('Moralidade', 3, 7), 220, 'Moralidade 3→7 = 220');
eq(R.xpCusto('Perícia', 2, 3, true), 5, 'Human paga metade em Perícias');

// 6. dados: explosão herda Tensão, escada, combinações
const seq = [9, 4, 10, 8, 2, 7, 1].map(v => (v - 1) / 10 + 0.001); let ix = 0;
const dados = R.rolar(6, 3, () => seq[ix++]);
eq(dados.map(x => [x.v, x.t, x.x]), [[9, true, false], [4, true, false], [10, true, false], [8, true, true], [2, false, false], [7, false, false], [1, false, false]], 'rolagem do Bartlett, explosão de Tensão continua Tensão');
const j = R.julgar(dados); eq([j.s, j.cobra, j.paga], [4, null, null], 'Bartlett: 4 sucessos, nada na escada');
function J(t, n, lim) { const ds = t.map(v => ({ v, t: true })).concat(n.map(v => ({ v, t: false }))); return R.julgar(ds, lim); }
eq(J([1], [1]).cobra, 'Tensão', 'um 1 na Tensão'); eq(J([], [1, 1]).cobra, 'Contratempo', 'dois 1 normais');
eq(J([1, 1], []).cobra, 'Colapso', 'dois 1 na Tensão'); eq(J([1, 1, 1], []).cobra, 'Compulsão', 'três 1 na Tensão');
eq(J([1, 1], [], 2).cobra, 'Compulsão', 'Compulsão Ampliada dispara com dois');
eq(J([], [10, 10]).paga, 'Lampejo', 'dois 10 normais'); eq(J([10, 10], []).paga, 'Sobrecarga', 'dois 10 na Tensão');
eq(J([10, 10, 10], []).paga, 'Despertar', 'três 10 na Tensão');
ok(/Anulam-se/.test(R.combinacao(J([10, 10, 1], []))), 'Sobrecarga + Tensão anulam');
ok(/permanece/.test(R.combinacao(J([10, 10, 1, 1], []))), 'Sobrecarga + Colapso não anulam');
const ca = nadia(R); ca.def.push({ nome: 'Compulsão Ampliada', pts: 2 }); eq(R.limiarCompulsao(ca), 2, 'limiar da Compulsão Ampliada');

// 7. dano (seção 8)
eq(R.dano({ margem: 2, arma: { dano: 3, tipo: 'agr' }, alvoBlind: 0 }).marca, 5, 'exemplo da seção 4: 2 + 3 = 5 agravados');
eq(R.dano({ margem: 2, arma: { dano: 3, tipo: 'agr' }, alvoBlind: 1, alvoTipo: 'pesada' }).marca, 4, 'cena da seção 8: pesada 1 subtrai');
eq(R.dano({ margem: 3, arma: { dano: 0, tipo: 'sup' }, alvoBlind: 0 }).marca, 1, 'desarmado: 3 superficiais, divididos por dois');
eq(R.dano({ margem: 1, arma: { dano: 3, tipo: 'agr' }, alvoBlind: 3, alvoTipo: 'leve' }).marca, 4, 'blindagem leve não segura arma de fogo');
eq(R.dano({ margem: 1, arma: { dano: 0, tipo: 'agr' }, alvoBlind: 9, alvoTipo: 'magitek' }).marca, 1, 'piso de 1 ponto');
eq(R.dano({ margem: 1, arma: { dano: 3, tipo: 'agr', perf: 2 }, alvoBlind: 2, alvoTipo: 'pesada' }).marca, 4, 'Perfuração ignora blindagem');
eq(R.dano({ margem: 2, arma: { dano: 3, tipo: 'agr' }, alvoBlind: 0, surpresa: true }).marca, 10, 'Surpresa dobra o dano');
eq(R.dano({ margem: 0, arma: { dano: 3 } }), null, 'sem margem, sem dano');

// 8. paradas do catálogo e penalidades
const RL = window.PH_ROLAGENS; let nt = 0; Object.keys(RL).forEach(g => nt += Object.keys(RL[g].tipos).length);
eq(nt, 30, 'trinta tipos de rolagem');
Object.keys(RL).forEach(g => Object.keys(RL[g].tipos).forEach(k => {
  const t = RL[g].tipos[k];
  [t.a, t.a2].forEach(a => a && ok(R.ATR.includes(a), g + '/' + k + ': atributo ' + a + ' existe'));
  t.p && ok(R.PER.includes(t.p), g + '/' + k + ': perícia ' + t.p + ' existe');
  ok(t.n && t.d, g + '/' + k + ': tem nome e descrição');
  if (!t.iniciativa) ok(t.dez && t.col && t.ftot, g + '/' + k + ': textos de Despertar, Colapso e Fracasso');
}));
eq(R.parada(f, RL.ataque.tipos.tiroteio).total, 4, 'Nadia sob fogo: Autocontrole 3 + Armas de Fogo 1');
eq(R.parada(f, RL.pericia.tipos.medicina, { esp: true }).total, 9, 'Medicina com especialização: 4 + 4 + 1');
eq(R.parada(f, RL.especial.tipos.remorso).total, 7, 'Remorso = Moralidade − Manchas');
const deb = nadia(R); deb.saude = [1, 1, 2, 1, 1]; eq(R.parada(deb, RL.ataque.tipos.tiroteio).total, 2, 'Saúde cheia: −2 em paradas físicas');
eq(R.parada(deb, RL.social.tipos.astucia).total, 4, 'Saúde cheia não afeta social');
const debv = nadia(R); debv.fv = [1, 1, 1, 1, 1, 1]; eq(R.parada(debv, RL.social.tipos.astucia).total, 2, 'Vontade cheia: −2 em sociais');

// 9. ficha antiga ou incompleta é completada sem perder nada
const antiga = { id: { personagem: 'X' }, campoDesconhecido: 42 }; const c = R.completar(antiga);
ok(c.campoDesconhecido === 42 && c.id.personagem === 'X' && c.atr['Força'] === 0, 'completar() preserva dados e preenche o que falta');

console.log((total - falhou) + ' de ' + total + ' testes passaram.');
process.exit(falhou ? 1 : 0);
