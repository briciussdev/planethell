"""Gera ficha/dados.js a partir de guia/guia-do-jogador.md. Rode de novo sempre que o guia mudar:
   python3 ferramentas/extrair_dados.py"""
import re, json, sys
import os
AQUI=os.path.dirname(os.path.abspath(__file__))
md=open(sys.argv[1] if len(sys.argv)>1 else os.path.join(AQUI,'..','guia','guia-do-jogador.md')).read()

def secao(inicio, fim=None):
    i=md.index(inicio); j=md.index(fim,i+len(inicio)) if fim else len(md)
    return md[i:j]
def tabelas(txt):
    """Todas as tabelas markdown do trecho, como listas de linhas (lista de células)."""
    out=[]; cur=[]
    for ln in txt.split('\n'):
        if ln.startswith('|'):
            cells=[c.strip() for c in ln.strip().strip('|').split('|')]
            if all(re.fullmatch(r'-{3,}',c) for c in cells): continue
            cur.append(cells)
        else:
            if cur: out.append(cur); cur=[]
    if cur: out.append(cur)
    return out
nb=lambda s: re.sub(r'\*\*?(.+?)\*\*?',r'\1',s).strip()

# ---------------- raças ----------------
S3=secao('## 3. As onze raças','## 4.')
t_racas,t_fcv=tabelas(S3)[0],tabelas(S3)[1]
t_comp=[t for t in tabelas(S3) if t[0][0]=='Compulsão'][0]
comp={nb(r[0]):{'impulso':r[1],'combate':r[2],'fora':r[3]} for r in t_comp[1:]}
racas={}
for r in t_racas[1:]:
    n=nb(r[0]); racas[n]={'tam':int(r[1]),'vida':r[2],'afins':[x.strip() for x in r[3].split('·')],'quirk':r[4].strip() not in ('—','-')}
for r in t_fcv[1:]:
    n=nb(r[0]); f=r[1]; c=nb(r[2]); v=r[3]
    fm=re.match(r'\*(.+?)\*(?: \((.+?)\))? — (.*)',f)
    racas[n]['falha']={'nome':fm.group(1)+(' '+fm.group(2) if fm.group(2) else ''),'txt':fm.group(3)}
    cn=re.sub(r'\s*\(.*?\)','',c).strip()
    racas[n]['compulsao']={'nome':c,'chave':cn,**comp.get(cn,{})}
    vants=[]
    for m in re.finditer(r'\*([^*]+?)\*(?: \((.+?)\))? — (.*?)(?=(?:\. \*[^*]+?\*(?: \(.+?\))? — )|$)',v):
        vants.append({'nome':m.group(1)+(' '+m.group(2) if m.group(2) else ''),'txt':m.group(3).rstrip('.')})
    racas[n]['vantagens']=vants
# textos longos "em detalhe"
det={}
for m in re.finditer(r'^\*\*([^*\n]+?), em detalhe\.\*\* (.*?)(?=\n\n\*\*[^*\n]+?, em detalhe|\n\n###)',S3,re.M|re.S):
    det[m.group(1)]=m.group(2).strip()
S6=secao('## 6. O Despertar','## 7.')
asc=tabelas(secao('### A Ascensão','### O preço'))[0]
for r in asc[1:]:
    for nome in re.findall(r'\*\*(.+?)\*\*',r[0]):
        racas[nome]['ascensao']={'nome':nb(r[1]),'ganha':r[2],'preco':r[3]}
desp=[{'nivel':int(r[0]),'txt':r[1]} for r in tabelas(secao('### A trilha','### A Ascensão'))[0][1:]]
consequencias=[{'d':int(r[0]),'txt':r[1]} for r in tabelas(secao('### O preço','### O que muda'))[0][1:]]

# ---------------- atributos e perícias ----------------
S10=secao('## 10. Criando','## 11.')
ta=tabelas(secao('### Passo 3','### Passo 4'))[0]
atributos=[]
for r in ta[1:]:
    grupo=nb(r[0])
    for i,cat in enumerate(['Poder','Finesse','Resistência']):
        atributos.append({'nome':r[i+1],'grupo':grupo,'cat':cat})
tp=tabelas(secao('### Passo 4','### Passo 5'))
pericias=[]
for r in tp[0][1:]:
    for i,g in enumerate(['Física','Social','Mental']): pericias.append({'nome':r[i],'grupo':g})
perfis=[{'nome':nb(r[0]),'dist':r[1],'qtd':int(r[2]),'pico':int(r[3]),'para':r[4]} for r in tp[1][1:]]
patamares=[{'nome':nb(r[0]),'xp':int(r[1]),'quem':r[2]} for r in tabelas(secao('### Patamares iniciais','## 11.'))[0][1:]]

# ---------------- trilhas ----------------
SC=secao('## Anexo C','## Anexo D')
trilhas={}
tc=tabelas(SC)
for r in tc[0][1:]:
    trilhas[nb(r[0]).title() if nb(r[0])!='MOTHER NATURE' else 'Mother Nature']={'niveis':r[1:6]}
# normaliza nomes como no guia (Improvement, System ...)
trilhas={k.replace(' ',' '):v for k,v in trilhas.items()}
onde=[{'racas':r[0],'trilhas':r[1]} for r in tc[1][1:]] if len(tc)>1 else []
custo_ativacao=[{'nivel':r[0],'custo':nb(r[1])} for r in tabelas(secao('## 9. Quirks','### A sua Quirk'))[0][1:]]
quirks=[]
S9=secao('### O catálogo','### Como escolher')
for m in re.finditer(r'#### (.+?) — (.+?)\n(.*?)(?=\n#### |\Z)',S9,re.S):
    papel=m.group(1)
    for r in tabelas(m.group(3))[0][1:]:
        quirks.append({'nome':nb(r[0]),'papel':papel,'niveis':r[1:6]})
molde=[r[1] for r in tabelas(secao('### A sua Quirk','### Exemplo trabalhado'))[0][1:]]

# ---------------- vantagens e defeitos ----------------
SA=secao('## Anexo A','## Anexo B')
vant=[]
prog=secao('### Progressivas','### De valor fechado')
for m in re.finditer(r'^\*\*(.+?)\.\*\* (.*?)(?=\n\n)',prog,re.M|re.S):
    nome=m.group(1); txt=m.group(2).strip()
    item={'nome':nome.split(' — ')[0],'custo':'1–5','min':1,'max':5,'txt':txt,'prog':True}
    if nome.startswith('Segunda Quirk'): item.update({'custo':'3/5/7','opcoes':[3,5,7],'so':'Punk','min':3,'max':7})
    vant.append(item)
for r in tabelas(secao('### De valor fechado','## Anexo B'))[0][1:]:
    c=r[1]; it={'nome':nb(r[0]),'custo':c,'txt':r[2]}
    m=re.fullmatch(r'(\d)–(\d)',c)
    if m: it.update({'min':int(m.group(1)),'max':int(m.group(2)),'prog':True})
    elif c=='1 cada': it.update({'min':1,'max':5,'prog':True,'cada':True})
    else: it.update({'min':int(c),'max':int(c)})
    vant.append(it)
SB=secao('## Anexo B','## Anexo C')
defe=[]
for t in tabelas(SB):
    for r in t[1:]:
        c=r[1]; it={'nome':nb(r[0]),'custo':c,'txt':r[2]}
        m=re.fullmatch(r'(\d)–(\d)',c)
        if m: it.update({'min':int(m.group(1)),'max':int(m.group(2)),'prog':True})
        elif c in ('1 cada','1 por ponto'): it.update({'min':1,'max':5,'prog':True,'cada':True})
        else: it.update({'min':int(c),'max':int(c)})
        defe.append(it)

# ---------------- experiência ----------------
SD=secao('## Anexo D',None)
custos_xp=[{'o':nb(r[0]),'custo':nb(r[1])} for r in tabelas(SD)[0][1:]]
ganho=re.findall(r'^\*\*(Até 10 pontos.+?|⭐ PLUS ULTRA:?)\*\*:? ?(.*)$',SD,re.M)

# ---------------- nações ----------------
S2=secao('## 2. O mundo','## 3.')
nacoes=[nb(r[0]) for r in [t for t in tabelas(S2) if t[0][0]=='Nação'][0][1:]]

# ---------------- escada e combate ----------------
escada=[{'saiu':nb(r[0]),'nome':nb(r[1]),'txt':r[2]} for r in tabelas(secao('### A escada','### Quando os dois'))[0][1:]]
ataques=[{'ataque':nb(r[0]),'parada':r[1],'defesa':r[2]} for r in tabelas(secao('### Ataque contra defesa','### Aparar ou esquivar'))[0][1:]]
manobras=[{'nome':nb(r[0]),'ganha':r[1],'custa':r[2]} for r in tabelas(secao('### Manobras','### Ações extras'))[0][1:]]
blind=[{'tipo':nb(r[0]),'reduz':r[1],'onde':r[2]} for r in tabelas(secao('### Blindagem','### Perfuração'))[0][1:]]
morais=[{'faixa':r[0],'estado':nb(r[1]),'efeito':r[2]} for r in [t for t in tabelas(secao('### Moralidade','### Os Preceitos')) if t[0][0]=='Moralidade'][0][1:]]

PH={'racas':racas,'detalhe':det,'despertar':desp,'consequencias':consequencias,'atributos':atributos,'pericias':pericias,
    'perfis':perfis,'patamares':patamares,'trilhas':trilhas,'custoAtivacao':custo_ativacao,'quirks':quirks,'moldeQuirk':molde,
    'vantagens':vant,'defeitos':defe,'custosXP':custos_xp,'ganhoXP':[{'rot':a,'txt':b} for a,b in ganho],'nacoes':nacoes,
    'escada':escada,'ataques':ataques,'manobras':manobras,'blindagem':blind,'moralidade':morais}
open(sys.argv[2] if len(sys.argv)>2 else os.path.join(AQUI,'..','ficha','dados.js'),'w').write(
 '/* Gerado automaticamente a partir do Guia do Jogador por extrair_dados.py. Não edite à mão. */\nwindow.PH='+json.dumps(PH,ensure_ascii=False,indent=1)+';\n')
print('dados.js atualizado:', len(racas), 'raças,', len(trilhas), 'trilhas,', len(quirks), 'quirks,', len(vant), 'vantagens,', len(defe), 'defeitos')
