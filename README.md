# PlanetHell

RPG de mesa cyberpunk em d10. Este repositório é o site do jogo: a landing page com o **Guia do Jogador completo** e a **ficha de personagem online**, com login por usuário e PIN.

Tudo é HTML, CSS e JavaScript puros. Não há build nem dependências no site.

```
index.html              Landing page com o guia inteiro (gerada a partir de guia/)
img/                    Imagens da landing page
ficha/                  A ficha de personagem
  index.html              tela de entrada + ficha
  config.js               ← endereço do servidor (Google Apps Script). Vazio = modo local
  dados.js                raças, perícias, trilhas, vantagens… extraídos do guia (não edite à mão)
  regras.js               cálculos e verificação das regras de criação
  rolagens.js             os 30 tipos de rolagem do rolador
  armazem.js              login, PIN, salvamento, histórico (servidor ou navegador)
  exportar.js             planilha .xlsx (Excel / Google Sheets), PDF e .json
  app.js, ficha.css       a interface
backend/
  Code.gs                 o servidor das fichas, para colar no Google Apps Script
  appsscript.json         manifesto do Apps Script
guia/guia-do-jogador.md  o texto do guia (fonte da landing page e dos dados da ficha)
ferramentas/             scripts que regeneram index.html e ficha/dados.js a partir do guia
testes/                  testes automatizados
```

---

## 1. Publicar no GitHub Pages

1. Crie um repositório no GitHub e envie o conteúdo desta pasta para a raiz dele.
2. No repositório, abra **Settings → Pages**.
3. Em *Source*, escolha **Deploy from a branch**, a branch `main` e a pasta `/ (root)`.
4. Salve. Em alguns minutos o site fica em `https://SEU-USUARIO.github.io/NOME-DO-REPO/`, e a ficha em `…/NOME-DO-REPO/ficha/`.

Sem o passo 2 abaixo a ficha já funciona, em **modo local**: cada jogador guarda a ficha no próprio navegador, com usuário e PIN, mas ela não passa de um aparelho para outro.

---

## 2. Banco de dados: as fichas numa Planilha Google

As fichas ficam numa planilha da **sua** conta Google. Um pequeno programa (Google Apps Script) recebe os logins e os salvamentos. É gratuito e não precisa de servidor.

1. Crie uma planilha nova em <https://sheets.new> e dê um nome, por exemplo **PlanetHell — fichas**.
2. Na planilha, abra **Extensões → Apps Script**.
3. Apague o que estiver no arquivo `Código.gs` e cole o conteúdo de [`backend/Code.gs`](backend/Code.gs). Salve (ícone de disquete).
4. *(Opcional)* Em **Configurações do projeto** (engrenagem), marque *Mostrar o arquivo de manifesto "appsscript.json"*, abra esse arquivo e cole o conteúdo de [`backend/appsscript.json`](backend/appsscript.json).
5. No topo do editor, escolha a função **`instalar`** e clique em **Executar**. O Google vai pedir autorização: escolha a sua conta → **Avançado** → **Acessar PlanetHell (não seguro)** → **Permitir**. O aviso aparece porque o script é seu e não passou por revisão do Google. Ele só mexe nesta planilha.
6. Clique em **Implantar → Nova implantação**. Em *Selecione o tipo*, escolha **App da Web**.
   - **Executar como:** Eu
   - **Quem pode acessar:** Qualquer pessoa
7. Clique em **Implantar** e copie o **URL do app da Web** (termina em `/exec`).
8. Abra esse URL no navegador. Deve aparecer `{"ok":true,"app":"PlanetHell","servidor":"ativo"}`.
9. Cole o URL em [`ficha/config.js`](ficha/config.js):
   ```js
   window.PH_CONFIG = { servidor: 'https://script.google.com/macros/s/…/exec' };
   ```
   Envie a alteração para o GitHub. Pronto: as fichas agora ficam na planilha e abrem em qualquer aparelho.

**Atualizar o código do servidor depois:** cole o novo `Code.gs`, depois **Implantar → Gerenciar implantações → ✏️ → Versão: Nova versão → Implantar**. O URL continua o mesmo.

### O que fica na planilha

| Aba | Conteúdo |
| --- | --- |
| Contas | usuário, primeiro nome, PIN, data de criação, último acesso, tentativas erradas |
| Sessoes | sessões abertas (só o *hash* do token, nunca o token) |
| Fichas | a versão atual de cada ficha |
| Historico | cópias inteiras de versões anteriores |
| Registro | criações de conta, entradas, bloqueios e **toda recuperação de PIN**, com data |

### Nada é apagado

- O servidor **não tem nenhuma operação de apagar**. Não existe botão nem ação para excluir ficha.
- Cada salvamento atualiza a aba *Fichas*. A cada 5 minutos de edição, e sempre que o jogador clica em **Salvar**, uma cópia inteira vai para *Historico*. O jogador pode voltar a qualquer versão pelo botão **Versões**.
- Se a mesma ficha for editada em dois aparelhos, quem tiver a versão mais velha recebe um aviso de conflito em vez de sobrescrever. Se escolher manter a dele, a outra vai para o histórico.
- Sem internet, a ficha continua salva no aparelho e é enviada sozinha quando a conexão volta.
- A própria planilha tem **Arquivo → Histórico de versões**. Para um backup extra, faça de vez em quando **Arquivo → Fazer uma cópia**.

---

## 3. Segurança: o que protege e o que não protege

O login foi pensado para ser simples, sem e-mail. Isto é o que ele faz:

- **PIN de 4 dígitos gerado pelo sistema.** O jogador não escolhe, então nunca é uma senha que ele usa em outro lugar.
- **5 PINs errados bloqueiam o usuário por 15 minutos**, até com o PIN certo. Há também um freio global contra tentativas em massa e contra criação de contas em série.
- **Depois do login, o navegador guarda um token de sessão de 30 dias.** O PIN não trafega a cada salvamento. Na planilha fica só o *hash* do token.
- **Tudo o que o jogador digita vira texto.** Nomes começando com `=`, `+` ou `-` não viram fórmula na planilha, e nada do que o jogador escreve é interpretado como HTML na ficha.
- **Só você vê a planilha.** O script roda na sua conta. O endereço `/exec` é público porque está no `config.js`, mas ele só aceita as ações da ficha.

E isto é o que ele **não** protege, por decisão de projeto:

- **A recuperação de PIN usa só o nome do personagem e a raça.** Qualquer pessoa que saiba esses dois — e na mesa todo mundo sabe — consegue ver o usuário e o PIN de outro jogador. Para limitar o estrago: são no máximo 5 recuperações por personagem por hora, **toda recuperação fica registrada na aba *Registro*** com data e hora, e qualquer edição indevida pode ser desfeita pelas versões. Se isso incomodar, dá para exigir também o usuário na recuperação: é uma linha em `recuperar_` no `Code.gs` e outra em `armazem.js`.
- **O PIN fica guardado como texto na planilha**, porque a recuperação precisa mostrá-lo. Só o dono da planilha vê. Por isso mesmo ele é gerado pelo sistema.
- É uma ficha de jogo. **Não peça nem guarde dados pessoais nela** além do primeiro nome.
- O Apps Script gratuito aguenta com folga um grupo de jogo. Não foi feito para centenas de pessoas salvando ao mesmo tempo.

---

## 4. Exportar

- **Excel / Sheets**: baixa uma planilha `.xlsx` no visual da ficha (preto, verde, Orbitron), com fórmulas nos derivados. Para usar no Google Sheets: Google Drive → **Novo → Upload de arquivo**, depois abra com o Planilhas Google.
- **PDF**: abre a impressão do navegador com uma folha própria (fundo branco, economiza tinta). Escolha **Salvar como PDF**.
- **Arquivo**: baixa ou carrega um `.json` com a ficha inteira. Serve de backup e para levar a ficha de um aparelho a outro no modo local.

---

## 5. Mudar o guia

1. Edite `guia/guia-do-jogador.md`.
2. Regere os dados da ficha e a landing page:
   ```sh
   pip install markdown
   python3 ferramentas/extrair_dados.py
   python3 ferramentas/construir_site.py
   ```
3. Rode os testes (abaixo) e envie.

## 6. Testes

```sh
npm install
npx playwright install chromium
npm test
```

São três baterias:

- **`testes/regras.test.js`**: o motor de regras contra o guia. Cria a Nadia Corvo do passo a passo da seção 10 e confere derivados, verificação de criação, afinidades, Quirks, XP, dados, escada e dano.
- **`testes/servidor.test.js`**: roda o `Code.gs` com uma planilha simulada. Cobre contas, PIN, bloqueio, sessões, conflito entre aparelhos, histórico, fichas grandes, injeção de fórmula e a ausência de qualquer operação de apagar.
- **`testes/navegador.test.mjs`**: preenche a ficha clicando, nos dois modos (local e servidor). Cobre criar conta, montar a Nadia, conferir os cálculos, rolar, gastar XP, salvar, recarregar, trocar de aparelho, conflito, queda de conexão, recuperar o PIN, bloqueio, exportar `.xlsx` e PDF, e o layout no celular.

---

*PlanetHell é um projeto de fãs, gratuito e sem fins comerciais. O sistema de regras é adaptado de* Vampire: The Masquerade *5ª edição e do Mundo das Trevas.* Vampire: The Masquerade*,* World of Darkness *e marcas relacionadas pertencem à Paradox Interactive AB e aos seus licenciados. Este projeto não é afiliado, patrocinado nem endossado por eles. Nomes, personagens, lugares e eventos são fictícios.*
