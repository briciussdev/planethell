/* PlanetHell — o que cada Atributo e cada Perícia significam, em linguagem de mesa.
   Fonte única: a ficha e a landing page leem daqui. Texto escrito para PlanetHell. */
window.PH_GLOSS = {
  atributos: {
    'Força': {
      grupo: 'Físico · Poder',
      resumo: 'Músculo bruto: o que você levanta, arromba, segura e quanto dano o seu corpo entrega num golpe.',
      onde: 'Entra no ataque desarmado, na arma de duas mãos, no agarrão e no Deslocamento.',
      niveis: ['Franzino: carregar a própria mochila já cansa', 'Comum: levanta o que um adulto levanta',
               'Forte: abre porta emperrada, domina uma pessoa', 'Muito forte: quebra fechadura, ergue quem tem o dobro do seu peso',
               'Brutal: entorta metal com as mãos']
    },
    'Destreza': {
      grupo: 'Físico · Finesse',
      resumo: 'Precisão e reflexo. Mira, equilíbrio, mãos rápidas e o corpo saindo do lugar certo na hora certa.',
      onde: 'Ataque com arma de uma mão, esquiva, Iniciativa e Deslocamento.',
      niveis: ['Desajeitado: esbarra nas coisas', 'Comum: dirige, corre, acerta um alvo parado',
               'Ágil: passa por um vão apertado em movimento', 'Muito ágil: acerta em movimento, some de vista num beco',
               'Sobre-humano: parece que sabia onde a bala ia passar']
    },
    'Vigor': {
      grupo: 'Físico · Resistência',
      resumo: 'Fôlego e couro grosso: quanto castigo o corpo aguenta antes de parar.',
      onde: 'Saúde é Vigor + Tamanho, e é o Vigor que diz quanto você sara no começo da sessão.',
      niveis: ['Frágil: uma noite mal dormida já derruba', 'Comum: aguenta um dia duro',
               'Resistente: trabalha ferido, atravessa o frio da faixa externa', 'Muito resistente: continua de pé depois do que derrubaria dois',
               'Inquebrável: o corpo simplesmente não desiste']
    },
    'Presença': {
      grupo: 'Social · Poder',
      resumo: 'O peso que você tem numa sala. Carisma, ameaça silenciosa, a atenção que vira na sua direção.',
      onde: 'Liderança, Intimidação e tudo o que depende de ser notado.',
      niveis: ['Apagado: ninguém lembra que você estava lá', 'Comum: é ouvido quando fala',
               'Marcante: a conversa muda de assunto quando você entra', 'Imponente: uma sala inteira espera você decidir',
               'Magnético: gente segue você sem saber direito por quê']
    },
    'Manipulação': {
      grupo: 'Social · Finesse',
      resumo: 'Conduzir o outro para onde você quer sem que ele perceba o empurrão.',
      onde: 'Persuasão, Astúcia, barganha, mentira bem contada e contato do mercado negro.',
      niveis: ['Direto demais: mente e todo mundo vê', 'Comum: consegue um desconto, inventa uma desculpa',
               'Hábil: faz alguém achar que a ideia foi dele', 'Perigoso: negocia com quem sabe negociar e sai ganhando',
               'Assustador: faz gente agir contra o próprio interesse, sorrindo']
    },
    'Autocontrole': {
      grupo: 'Social · Resistência',
      resumo: 'A rédea que você mantém em si mesmo sob pressão — e, neste sistema, também o tamanho do risco que você carrega.',
      onde: 'Força de Vontade, Iniciativa, tiroteio… e é igual ao seu número de dados de Tensão: quanto maior, mais alto você voa e mais feio você cai.',
      niveis: ['Pavio curto: explode à toa', 'Comum: se segura na maioria das vezes',
               'Firme: mantém a voz calma com uma arma apontada', 'Muito firme: decide bem no meio do desastre',
               'Gelo: nada na sua cara entrega o que você está pensando']
    },
    'Inteligência': {
      grupo: 'Mental · Poder',
      resumo: 'Conhecimento acumulado e capacidade de juntar as peças. O que você sabe e o que consegue deduzir.',
      onde: 'Medicina, Ciências, Informática, Investigação, Ocultismo.',
      niveis: ['Distraído: esquece o combinado', 'Comum: aprende o que precisa para o trabalho',
               'Culto: sabe de cabeça o que os outros procuram', 'Brilhante: enxerga o padrão antes de ter todos os dados',
               'Genial: resolve o que a corporação inteira não resolveu']
    },
    'Raciocínio': {
      grupo: 'Mental · Finesse',
      resumo: 'Pensamento rápido: improviso, resposta na hora, sacar a situação antes que ela vire outra coisa.',
      onde: 'Percepção, Manha, reação a emboscada, resposta afiada numa negociação.',
      niveis: ['Lento: entende depois que passou', 'Comum: reage a tempo na maioria das vezes',
               'Rápido: improvisa um plano B no meio da fuga', 'Muito rápido: percebe a armadilha enquanto entra nela',
               'Instantâneo: já respondeu antes de a pergunta terminar']
    },
    'Perseverança': {
      grupo: 'Mental · Resistência',
      resumo: 'Teimosia produtiva: continuar quando já era hora de largar, e aguentar o que mexe com a cabeça.',
      onde: 'Força de Vontade, tiro de precisão, resistir a medo, dor e manipulação.',
      niveis: ['Desiste fácil', 'Comum: termina o que começou, quase sempre',
               'Obstinado: atravessa a madrugada até acabar', 'Inabalável: pressão psicológica não funciona em você',
               'Fanático: só a morte interrompe']
    }
  },

  pericias: {
    /* ---- Físicas ---- */
    'Armamento': { grupo: 'Física', resumo: 'Lutar com o que tem fio, ponta ou peso: faca, bastão, espada monomolecular, chave inglesa.',
      exemplo: 'Especializações: Faca · Lâminas longas · Improvisado · Duelo' },
    'Armas de Fogo': { grupo: 'Física', resumo: 'Pistola, rifle, arma Magitek. Manter, apontar, acertar e não travar na hora errada.',
      exemplo: 'A parada muda com a situação: sob fogo é Autocontrole, de tocaia é Perseverança, no saque é Destreza.' },
    'Atletismo': { grupo: 'Física', resumo: 'Correr, saltar, escalar, nadar, se jogar de um telhado para o outro — e esquivar de tudo.',
      exemplo: 'É a perícia da esquiva, a única defesa que funciona contra qualquer coisa.' },
    'Briga': { grupo: 'Física', resumo: 'Porrada sem arma: soco, cotovelada, agarrão, e aparar um golpe com o corpo.',
      exemplo: 'Aparar com Briga devolve dano na mesma rolagem; desarmado, quase sempre é pouco.' },
    'Condução': { grupo: 'Física', resumo: 'Veículo em situação difícil: perseguição, trânsito de Night City, terreno da faixa externa.',
      exemplo: 'Especializações: Motocicleta · Blindados · Voadores · Perseguição' },
    'Furtividade': { grupo: 'Física', resumo: 'Não ser visto, não ser ouvido, não aparecer em câmera nem em sensor.',
      exemplo: 'É o teste que decide se existe Surpresa — e Surpresa dobra o dano.' },
    'Larcínio': { grupo: 'Física', resumo: 'Fechadura, bolso alheio, cofre, trava de veículo. O ofício de abrir o que não é seu.',
      exemplo: 'Especializações: Arrombamento · Batedor de carteira · Alarmes' },
    'Ofícios': { grupo: 'Física', resumo: 'Consertar e fabricar: implantes, manutenção de Mecha, remendo de campo, adaptação de Magitek.',
      exemplo: 'É com ela que o Cyberpunk cuida do próprio corpo e escapa da Falha Maintenance.' },
    'Sobrevivência': { grupo: 'Física', resumo: 'Se virar longe da cidade: água, abrigo, rastro, e as 44 horas de escuro sem virar comida.',
      exemplo: 'Especializações: Faixa quente · Faixa gelada · Caça · Rastreio' },

    /* ---- Sociais ---- */
    'Astúcia': { grupo: 'Social', resumo: 'Enganar com o que você diz: lábia, golpe, disfarce de conversa, sair pela tangente.',
      exemplo: 'Especializações: Disfarce · Trapaça · Falsa identidade' },
    'Empatia': { grupo: 'Social', resumo: 'Ler gente: o que a pessoa sente, o que ela esconde, quando ela está mentindo.',
      exemplo: 'Também serve para acalmar alguém em pânico — inclusive um aliado.' },
    'Etiqueta': { grupo: 'Social', resumo: 'Saber se comportar no ambiente de cada grupo: corte de Nova Roma, cúpula corporativa, mesa de senhores da guerra.',
      exemplo: 'Errar a etiqueta em Meca ou em Romania custa mais caro que errar um tiro.' },
    'Expressão': { grupo: 'Social', resumo: 'Comunicar com arte e intenção: discurso, música, transmissão, propaganda, texto que circula.',
      exemplo: 'Especializações: Palco · Transmissão pirata · Escrita' },
    'Intimidação': { grupo: 'Social', resumo: 'Conseguir pelo medo: ameaça explícita, presença que pesa, promessa que todo mundo sabe que é verdade.',
      exemplo: 'Funciona rápido e deixa rastro: quem cede por medo raramente esquece.' },
    'Liderança': { grupo: 'Social', resumo: 'Fazer um grupo agir junto, dar ordem que é seguida e segurar a moral quando tudo desanda.',
      exemplo: 'Especializações: Comando de esquadrão · Multidão · Crise' },
    'Manha': { grupo: 'Social', resumo: 'Malandragem de rua: saber com quem falar, onde não pisar, quanto custa o silêncio de alguém.',
      exemplo: 'É o que diz se você reconhece o território antes de ele reconhecer você.' },
    'Persuasão': { grupo: 'Social', resumo: 'Convencer pelo argumento e pelo apelo: negociar, vender uma ideia, conseguir um favor.',
      exemplo: 'Especializações: Barganha · Sedução · Interrogatório amistoso' },
    'Trato com Animais': { grupo: 'Social', resumo: 'Lidar com bicho — e, num mundo de fauna quase extinta, também com o que veio dos desertos e com Lycans em forma plena.',
      exemplo: 'Animal vivo é raridade e vale dinheiro: quem sabe cuidar tem lugar garantido.' },

    /* ---- Mentais ---- */
    'Ciências': { grupo: 'Mental', resumo: 'Química, biologia, física aplicada, engenharia genética, robótica, Biotec.',
      exemplo: 'Especializações: Farmacologia · Genética · Robótica' },
    'Erudição': { grupo: 'Mental', resumo: 'Conhecimento formal e histórico: o que aconteceu antes do cataclismo, idiomas, arquivos, tratados.',
      exemplo: 'Muito do que se sabe do mundo antigo é boato; Erudição separa o registro do boato.' },
    'Finanças': { grupo: 'Mental', resumo: 'Dinheiro e como ele se move: crédito, contrato, corporação, lavagem, o preço real da água e do ouro.',
      exemplo: 'Especializações: Corporativo · Mercado negro · Contabilidade criativa' },
    'Informática': { grupo: 'Mental', resumo: 'Sistemas, redes, invasão, IAs e interfaces Magitek.',
      exemplo: 'Cobre desde puxar um registro até conversar com uma inteligência que não queria ser encontrada.' },
    'Investigação': { grupo: 'Mental', resumo: 'Procurar com método: cena, documento, contradição no depoimento, fio solto que leva a outro.',
      exemplo: 'Percepção é notar; Investigação é procurar até achar.' },
    'Medicina': { grupo: 'Mental', resumo: 'Manter alguém vivo: trauma, cirurgia, remédio, e o que fazer quando o corpo é metade máquina.',
      exemplo: 'É a via comum de tratar dano agravado — com equipamento Magitek, cura de verdade.' },
    'Ocultismo': { grupo: 'Mental', resumo: 'Teologia Anunnaki, glyphs, rituais, entidades dos Nexus e o que consta nas escrituras que ninguém lê inteiras.',
      exemplo: 'Num mundo em que os deuses existem e têm endereço, isto é conhecimento prático.' },
    'Política': { grupo: 'Mental', resumo: 'Como o poder se organiza nas cinco nações, quem deve favor a quem, e onde a decisão realmente acontece.',
      exemplo: 'Especializações: Babylon · Romania · Meca · Sovia · Eden' },
    'Percepção': { grupo: 'Mental', resumo: 'Notar o que está ali: o vulto, o cheiro errado, o silêncio que não devia existir.',
      exemplo: 'É o teste que se opõe à Furtividade — e o que evita a emboscada.' }
  }
};
