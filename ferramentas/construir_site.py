"""Gera o index.html (landing page com o guia completo) a partir de guia/guia-do-jogador.md.
Uso: python3 ferramentas/construir_site.py   (precisa de: pip install markdown)
"""
import re, markdown, html, os
FICHA=os.environ.get('FICHA_URL','ficha/')
AQUI=os.path.dirname(os.path.abspath(__file__))
tpl=open(os.path.join(AQUI,'modelo-landing.html')).read()
md=open(os.path.join(AQUI,'..','guia','guia-do-jogador.md')).read()
body=re.sub(r'^# PlanetHell — Guia do Jogador\n\n.*?\n\n\*Versão 6, pós-playtest\. (.*?)\*\n','',md,count=1,flags=re.S)
intro=re.match(r'^# PlanetHell — Guia do Jogador\n\n.*?\n\n\*Versão 6, pós-playtest\. (.*?)\*\n',md,flags=re.S).group(1)
assert body.lstrip().startswith('## 1.'), body[:80]

def slug(t):
    t=re.sub(r'<[^>]+>','',t).lower()
    t=re.sub(r'[^\w\s-]','',t,flags=re.U)
    return re.sub(r'[\s_]+','-',t).strip('-')
out=markdown.markdown(body,extensions=['tables','sane_lists'])
toc=[]
seen={}
def hdr(m):
    lvl,inner=m.group(1),m.group(2)
    sid='g-'+slug(inner); plain=re.sub(r'<[^>]+>','',inner)
    if sid in seen: seen[sid]+=1; sid=f'{sid}-{seen[sid]}'
    else: seen[sid]=1
    anchor=f'<a class="anchor" href="#{sid}" aria-label="Link para esta seção">#</a>'
    if lvl=='2':
        mm=re.match(r'^(\d+)\.\s+(.*)$',plain) or re.match(r'^Anexo ([A-D])\s+—\s+(.*)$',plain)
        if re.match(r'^\d',plain): code='SEC.%02d'%int(mm.group(1)); key='%02d'%int(mm.group(1)); title=mm.group(2)
        else: code='ANX.'+mm.group(1); key='ANX.'+mm.group(1); title=mm.group(2)
        toc.append((sid,key,title,code))
        return f'<h2 id="{sid}"><span class="sec">{code}</span><span>{html.escape(title)}</span>{anchor}</h2>'
    return f'<h{lvl} id="{sid}"><span>{inner}</span>{anchor}</h{lvl}>'
out=re.sub(r'<h([234])>(.*?)</h\1>',hdr,out)
out=out.replace('<table>','<div class="tablewrap"><table>').replace('</table>','</table></div>')
guide=f'<p class="intro-line">{html.escape(intro)}</p>\n'+out
tochtml='\n'.join(f'<li><a href="#{sid}" data-path="{code}_{html.escape(re.sub(r"[^A-Za-zÀ-ÿ0-9]+","_",t).strip("_").upper())}"><span class="k">{k}</span><span>{html.escape(t)}</span><span class="bar"></span></a></li>' for sid,k,t,code in toc)

R=[
 ('human','multidao.webp','object-position:50% 72%','Um humano encapuzado atravessando a multidão de neon.','Human','T3','70–90 anos',
  ('Prey','−2 em sociais com quem sabe o que você é, e nenhuma cura sobrenatural funciona'),('Survival','garantir uma saída antes de se comprometer'),
  [('Perseverance','uma vez por sessão, rerrole todo dado de Tensão que deu 1')]),
 ('punk','punk.webp','','Punk com as veias brilhando em azul sob a pele, encostado num muro pichado.','Punk','T3','70–80 anos · Quirk',
  ("Devil's Blood",'num Colapso a sua Quirk dispara sozinha, sem alvo escolhido'),('Defiance','provar que ninguém manda em você'),
  [('Multi-Quirk','a única raça que pode ter duas'),('Zeal','com metade da Saúde, +2 dados de dano')]),
 ('cyberpunk','cyberpunk.webp','','Ciborgue na oficina, olho ótico verde e braço mecânico exposto.','Cyberpunk','T3','base +40 a 100',
  ('Maintenance','a cada arco sem cuidado, −1 dado cumulativo no sistema implantado'),('Optimization','nada fica como está se pode ficar melhor'),
  [('Hard Wired','Blindagem pesada 1 permanente, e o golpe implantado causa dano agravado'),('Trick or Treat','acrescenta a Falha e a Compulsão de uma raça-base')]),
 ('android','android.webp','','Android de cabelo rosa num laboratório, braço mecânico aberto.','Android','T3','não envelhece',
  ('Soulless','nada que atue sobre almas funciona. EMP e energia divina são sempre agravados'),('Directive','uma ordem antiga voltou, e tem prioridade'),
  [('Null Signal','não pode ser localizado por meio mental ou espiritual')]),
 ('lycan','lycan.webp','object-position:40% 30%','Dois Lycans num beco de neon: um com plumagem de ave, outro de pele anfíbia.','Lycan','T3','80–400 anos',
  ('The Beast Within','−2 em ambiente de estímulo intenso: multidão, explosão, luz forte'),('Instinct','resolver com o corpo, agora'),
  [('Predator','+2 dados em Sobrevivência, Furtividade e Percepção sensorial')]),
 ('mecha','mecha.webp','','Mecha colossal num hangar, um técnico minúsculo a seus pés.','Mecha','T5','enquanto houver manutenção',
  ('Genki 元気','não recupera Saúde sozinho. Trilha cheia é destruição'),('Tejun 手順','a sequência correta, inteira e na ordem'),
  [('Tosei Dō 統制道','Blindagem base 3'),('Shashutsu 射出','expele um backup antes de ser destruído')]),
 ('other','other.webp','object-position:50% 22%','Um Other de quatro olhos conferindo a carga nas docas.','Other','T4','300–1500 anos',
  ('Strange Flesh','medicina convencional não funciona, e substâncias comuns são imprevisíveis'),('Curiosity','precisa saber o que é aquilo'),
  [('Star Trek','regenera membros, sobrevive no vácuo, recupera 1 de Saúde por hora')]),
 ('anunnaki','anunnaki.webp','','Dois Anunnaki de manto observando o planeta de uma sacada orbital.','Anunnaki','T4','não envelhece',
  ('Law of the Father','não age contra um superior da linhagem sem gastar 2 agravados de Vontade'),('Dominion','a sua vontade prevalece, e todos veem'),
  [('Miracle','altere um evento já ocorrido na cena'),('Divine Survival','não come, não dorme, não adoece')]),
 ('nefilin','nefilin.webp','object-position:26% 34%','Nefilin de asas abertas atravessando um templo de mármore branco.','Nefilin','T4','milênios · Quirk',
  ('Law of the Son','num Colapso, proteja o mais fraco contra o mais poderoso. Recusar custa 1 agravado'),('Legacy','isto precisa ser lembrado'),
  [('Fallen Angel','asas ocultáveis e voo pleno'),('Untainted','imune a degeneração por defeitos')]),
 ('youkai','youkai.webp','','Youkai de chifres e cauda num campo de batalha em chamas.','Youkai','T4','não envelhece',
  ('Hole in My Soul','Domains sagrados, Quirks purificadoras e Magitek causam sempre agravado, com Perfuração 1'),('In Love With Judas','isto pode piorar, e você sabe como'),
  [('Sympathy for the Devil',''),('Touch My Body',''),('Bad to the Bone','')]),
 ('hanyou','hanyou.webp','','Han\'you de chifres fumando na calçada, neon vermelho ao fundo.',"Han'you",'T3','100–700 anos · Quirk',
  ('Maleficent','quanto menor a Moralidade, mais forte e menos humano. Nunca passa de 7'),('Appetite','consumir algo de alguém que está aqui'),
  [('Devilicious','cura ao ferir'),('Sensual Seduction',''),('V of Violence','')]),
]
def vant(vs):
    parts=[]
    for n,d in vs:
        parts.append(f'<em>{html.escape(n)}</em>'+(f' — {html.escape(d)}' if d else ''))
    return '. '.join(parts) if all(d for _,d in vs) else ', '.join(parts)
cards=[]
for rid,img,pos,alt,name,tam,life,falha,comp,vs in R:
    st=f' style="{pos}"' if pos else ''
    cards.append(f'''<article class="race hud" id="raca-{rid}">
  <div class="race-shot">
    <img src="img/{img}"{st} alt="{html.escape(alt)}" loading="lazy">
    <div class="race-tag"><h3>{html.escape(name)}</h3><span class="size">T{tam[1]}</span></div>
  </div>
  <p class="race-life">{html.escape(life)}</p>
  <dl class="race-body">
    <div class="trait"><dt>Falha</dt><dd><em>{html.escape(falha[0])}</em></dd></div>
    <div class="trait"><dt>Compul.</dt><dd><em>{html.escape(comp[0])}</em></dd></div>
    <div class="trait up"><dt>Vant.</dt><dd>{', '.join('<em>'+html.escape(n)+'</em>' for n,_ in vs)}</dd></div>
  </dl>
</article>''')
def fig(img,alt,cap,pos=''):
    st=f' style="object-position:{pos}"' if pos else ''
    return f'<figure class="fig hud"><img src="img/{img}"{st} alt="{html.escape(alt)}" loading="lazy"><figcaption>{cap}</figcaption></figure>\n'
def before(g,marker,chunk):
    assert marker in g, marker
    return g.replace(marker,chunk+marker,1)
def after_heading(g,hid,chunk):
    i=g.index(f'id="{hid}"'); j=g.index('</h',i); j=g.index('>',j)+1
    return g[:j]+'\n'+chunk+g[j:]
guide=after_heading(guide,'g-a-notícia-que-veio-junto',fig('anunnaki.webp','Dois Anunnaki de manto observando o planeta de uma sacada orbital.','<b>Anunnaki</b> — os deuses de todas as religiões'))
guide=before(guide,'<h3 id="g-as-cinco-nações"',fig('night-city.webp','Night City de cima: arranha-céus, dirigíveis e canais de água escura.','<b>Night City</b> — capital de Babylon, a cidade que nunca dorme'))
gallery='<div class="races">\n'+'\n'.join(cards)+'\n</div>\n'
guide=before(guide,'<h3 id="g-a-tabela"',gallery)
guide=after_heading(guide,'g-10-criando-o-seu-personagem',fig('multidao.webp','Multidão de raças misturadas numa rua de neon, sob a chuva.','<b>Night City</b> — onze raças na mesma calçada','50% 40%'))
# the escada table drives the roller
i=guide.index('id="g-a-escada"'); t0=guide.index('<table>',i); t1=guide.index('</table>',t0)+8
tbl=guide[t0:t1]
KEY={'Contratempo':('contratempo','cobra'),'Tensão':('tensao','cobra'),'Colapso':('colapso','cobra'),'Compulsão':('compulsao','cobra'),
     'Lampejo':('lampejo','paga'),'Sobrecarga':('sobrecarga','paga'),'Despertar':('despertar','paga')}
def tag(m):
    row=m.group(0); cells=re.findall(r'<td>(.*?)</td>',row,re.S)
    name=re.sub(r'<[^>]+>','',cells[1]).strip()
    k,c=KEY[name]; return row.replace('<tr>',f'<tr class="{c}" data-r="{k}">',1)
tbl2=re.sub(r'<tr>\s*<td>.*?</tr>',tag,tbl,flags=re.S).replace('<table>','<table id="ladder">',1)
assert tbl2.count('data-r=')==7
roller=open(os.path.join(AQUI,'rolador-landing.html')).read().replace('class="hud roller" id="roller"','class="hud roller" id="rolador"').replace('A escada ao lado acende','A escada acima acende')
tail=guide[t1:]; close=tail.index('</div>')+6   # close the tablewrap
guide=guide[:t0]+tbl2+tail[:close]+'\n'+roller+'\n'+tail[close:]
def wrap(g,start_id,end_id,cls):
    a=g.index(f'<h2 id="{start_id}"'); b=g.index(f'<h2 id="{end_id}"')
    seg=g[a:b]
    def lv(m):
        return re.sub(r'(?<=[\s>])([1-5])(?=:)',r'<span class="lvl">\1</span>',m.group(0))
    seg=re.sub(r'<p>.*?</p>',lv,seg,flags=re.S)
    return g[:a]+f'<div class="anx {cls}">'+seg+'</div>\n'+g[b:]
guide=wrap(guide,'g-anexo-a-vantagens','g-anexo-b-defeitos','anx-vant')
guide=wrap(guide,'g-anexo-b-defeitos','g-anexo-c-as-dezessete-trilhas','anx-def')
cta='<p class="cta-row" style="margin:6px 0 18px"><a class="btn" href="'+FICHA+'">Abrir a ficha</a></p>\n'
guide=after_heading(guide,'g-11-a-ficha-digital',cta)
s=tpl.replace('{{TOC}}',tochtml).replace('{{GUIDE}}',guide).replace('{{FICHA}}',FICHA)
assert '{{' not in s and 'claude.ai/code/artifact' not in s and 'pós-playtest' not in s
assert 'id="g-10-criando-o-seu-personagem"' in s and '{{' not in s
if not os.environ.get('ARTEFATO'):
    fim=s.index('</style>')+len('</style>')
    s=('<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n'
       '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
       '<meta name="description" content="PlanetHell: RPG de mesa cyberpunk em d10. Guia do Jogador completo e ficha de personagem online.">\n'
       + s[:fim] + '\n</head>\n<body>\n' + s[fim:] + '\n</body>\n</html>\n')
open(os.environ.get('SAIDA') or os.path.join(AQUI,'..','index.html'),'w').write(s)
print('ok',len(s.encode())//1024,'KB',len(toc),'sections')
