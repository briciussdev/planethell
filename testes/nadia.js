/* A ficha pronta do passo a passo (seção 10): Nadia Corvo. Usada pelos testes. */
module.exports = function (R) {
  var f = R.novaFicha();
  f.id.personagem = 'Nadia Corvo'; f.id.jogador = 'Ana'; f.id.conceito = 'Médica desertora'; f.id.idade = '34'; f.id.patamar = 'Experiente';
  f.raca = 'Cyberpunk'; f.racaBase = 'Human'; f.afimBase = 'Bond';
  Object.assign(f.atr, { 'Inteligência': 4, 'Destreza': 3, 'Autocontrole': 3, 'Perseverança': 3, 'Força': 2, 'Vigor': 2, 'Raciocínio': 2, 'Manipulação': 2, 'Presença': 1 });
  Object.assign(f.per, { 'Medicina': 4, 'Ciências': 3, 'Percepção': 3, 'Empatia': 3, 'Investigação': 3, 'Furtividade': 2, 'Condução': 2, 'Astúcia': 2,
    'Armas de Fogo': 1, 'Atletismo': 1, 'Ofícios': 1, 'Erudição': 1 });
  f.esp = [{ pericia: 'Ciências', nome: 'Farmacologia' }, { pericia: 'Ofícios', nome: 'Implantes' }, { pericia: 'Erudição', nome: 'Anatomia das raças' }, { pericia: 'Medicina', nome: 'Trauma de combate' }];
  f.trilhas = [{ tipo: 'Improvement', nome: 'Braço mecânico', nivel: 2, niveis: [] }, { tipo: 'Quirk', nome: 'STILL', nivel: 1, niveis: [] }];
  f.vant = [{ nome: 'Recursos', pts: 1 }, { nome: 'Contatos', pts: 2, nota: 'mercado negro de fármacos' }, { nome: 'Refúgio', pts: 2 }, { nome: 'Aliados', pts: 2 }];
  f.def = [{ nome: 'Registro Militar', pts: 1 }, { nome: 'Segredo', pts: 1 }];
  f.convic = [{ txt: 'Eu não pergunto de que lado a pessoa está antes de operar.', ancora: 'Sami' }];
  f.ambicao = 'Sair do registro de desertores sem entregar ninguém';
  f.desejo = 'Conseguir um lote de antibióticos sem dever favor a ninguém';
  f.xp.total = 35;
  return f;
};
