# Anghel Modas

Site-vitrine da Anghel Modas (moda feminina): uma página única com uma abertura em 3D onde um **manequim de vitrine se veste sozinho** conforme a pessoa rola a página, um **catálogo em arara 3D**, um **provador 3D** onde a cliente monta o look no manequim com as peças da loja, mural de clientes, comunidade (recados e contador de visitas) e contato. Tem também um **painel** (`/admin`) para cadastrar as peças com foto, publicar fotos de clientes, ligar/desligar opções do site e cuidar dos recados, sem mexer no código.

Mesma base do ChocoFeliz: **Vite + React + TypeScript + Tailwind v4 + Three.js (React Three Fiber) + Motion + Lenis**, publicado no **Netlify** com **Netlify Forms**, **Functions** e **Blobs** (sem banco de dados para manter).

## O que tem de diferente: o 3D

Tudo é feito em código (sem modelos 3D prontos): o manequim, as roupas e os tecidos.

### Abertura (rolando a página)

| Momento | O que acontece |
| --- | --- |
| **Tela de carregamento** | A cortina de veludo do provador; um fio dourado desenha o manequim do logo e o contador vai a 100%. Quando o 3D está pronto, a cortina abre para os lados. |
| **Construção** (automática) | O manequim nasce do chão em curvas de nível douradas (como um croqui), vira porcelana champanhe e a roupa é "costurada" de cima para baixo com um brilho dourado. |
| **01 · A peça** | As peças se afastam do corpo (vista explodida) com anotações escritas à mão. |
| **02 · O tecido** | A câmera chega perto e o tecido troca: linho, tricô, canelado, cetim, renda. |
| **03 · A cor** | A cor nova escorre pela roupa de cima para baixo: chocolate, manteiga, rosé, terracota… |
| **04 · O look** | O manequim gira e, a cada volta, veste um look diferente montado com as peças do catálogo. |

### Catálogo em arara 3D

As peças cadastradas no painel ficam penduradas em cabides dourados num varão. Arrastar (mouse, dedo, trackpad lateral ou setas) passa as peças, e os cabides **balançam com o movimento**. Cada cabide tem uma etiqueta de papel com nome, cores e preço. Tocar numa peça abre a ficha: fotos, cores, tamanhos, "Quero esta peça" (WhatsApp) e **"No manequim 3D"**, que mostra a peça vestida no manequim, na cor escolhida. Peça sem foto aparece no cabide como uma foto do próprio manequim vestido com ela. Também dá para ver o catálogo em lista.

### Provador 3D ("Monte o seu look")

A cliente escolhe a parte de cima, a de baixo, um vestido ou um conjunto, e o manequim veste na hora (com a costura dourada). Troca as cores de cada peça, escolhe o tamanho e pede pelo WhatsApp com o look já escrito na mensagem. Dá para **tirar uma foto** (formato do feed) e **gravar um vídeo de 360°** (formato dos stories, com o nome da loja e das peças) e compartilhar direto pelo celular.

**Como a peça vira 3D:** no cadastro, cada peça escolhe um **molde** (regata, ombro só, frente única, camisa, pantalona, saia midi, vestido longo com fenda… são 27) e um **tecido** (malha, canelado, tricô, linho, jeans, cetim, crepe, suplex, renda, estampado). O molde dá o formato; o tecido muda o brilho e a textura (nervuras do canelado, pontos do tricô, trama do linho, sarja do jeans, furinhos da renda). No painel, tocando no tecido da foto, o conta-gotas tira **a cor certinha** e um **recorte do tecido**, que vira a textura da peça no manequim.

Enquanto o catálogo do painel estiver vazio, o site mostra uma **coleção de exemplo** (inspirada nos posts do Instagram, sem preço) para a vitrine não ficar vazia. Ela some sozinha quando a primeira peça for cadastrada.

## Rodando

```bash
npm install
npm run dev        # http://localhost:5173 (o painel fica em /admin)
npm run build      # gera dist/
npm run typecheck
```

No `npm run dev` as Netlify Functions e o Netlify Blobs são simulados pelo `@netlify/vite-plugin` (os dados de teste ficam na pasta `.netlify/`, fora do git). Para entrar no painel localmente, crie um arquivo `.env` com `ADMIN_PASSWORD=uma-senha-de-teste`.

Só no `npm run dev` existe também o **laboratório dos moldes**, em `/moldes`: todos os moldes vestidos lado a lado, para ajustar o desenho deles (`?fit=regata,camisa` mostra só alguns; `?view=back` mostra as costas).

## Publicando no Netlify

O `netlify.toml` já está pronto (build `npm run build`, pasta `dist`, Node 22, funções em `netlify/functions`). É só conectar o repositório no Netlify.

**Senha do painel (obrigatório para usar o `/admin`):** em **Site configuration → Environment variables → Add a variable**, crie `ADMIN_PASSWORD` com uma senha forte e depois faça um novo deploy (**Deploys → Trigger deploy**). Sem ela o painel avisa que não está configurado; o resto do site funciona normalmente.

As mensagens do formulário aparecem em **Netlify → Forms → pedido** (com o look montado no provador, quando a cliente montou um). Para receber por e-mail: **Forms → Form notifications → Add notification**.

## Painel (`/admin`)

Endereço: `seusite.netlify.app/admin` (não aparece no menu e não é indexado pelo Google). Entra com a senha do `ADMIN_PASSWORD`.

- **Catálogo**: cadastre a peça com até 6 fotos (dá para fotografar direto do celular; o painel reduz a foto, corrige a rotação e remove localização e outros dados da câmera). Nome, categoria, tecido, **molde no provador 3D** (conjunto escolhe o de cima e o de baixo), cores (atalhos com nomes ou qualquer cor; **toque no tecido da foto** para tirar a cor e o recorte do tecido), tamanhos, preço (opcional), descrição e as chaves **Novidade**, **Esgotada** e **Esconder do site**. Uma **prévia 3D** mostra na hora como a peça fica no manequim. Depois dá para editar, trocar a capa, incluir ou apagar fotos e apagar a peça. Cabem até 300 peças.
- **Mural de clientes**: fotos de clientes usando as peças (com a autorização delas), com título, look e data opcionais. Cabem até 400 fotos.
- **Opções do site**: esconde uma categoria inteira (fora de estação, por exemplo) e liga/desliga os preços no site. Pelo menos uma categoria fica sempre ligada.
- **Comunidade**: visitas (total, hoje, 7 e 30 dias, e um gráfico dos últimos 14 dias) e os recados: aprovar, tirar do site ou apagar. Uma chave escolhe se os recados novos entram direto ou esperam aprovação (o padrão é esperar). A aba mostra quantos estão esperando.

As mudanças aparecem no site em poucos segundos. Tudo fica guardado no **Netlify Blobs** do próprio site (Netlify → Blobs → `anghel-modas`), sem banco de dados.

Segurança: a senha é conferida na função `netlify/functions/admin.mts`; depois de 8 senhas erradas seguidas o acesso daquele endereço de internet trava por 15 minutos.

**Contador de visitas:** cada navegador conta uma vez por dia; robôs de busca e prévias de link (WhatsApp, Facebook…) não contam, e cada endereço de internet soma no máximo 25 visitas por dia. O site não guarda IP: só um código embaralhado, e só do dia.

**Recados:** contra spam e abuso, o formulário tem um campo-armadilha invisível para robôs, recusa mensagens com links, aceita no máximo 3 recados por hora do mesmo endereço e, por padrão, só publica depois da aprovação no painel.

## Onde editar

| O quê | Onde |
| --- | --- |
| Peças do catálogo, fotos, cores, preços | **Painel** (`/admin` → Catálogo) |
| Fotos de clientes | **Painel** (`/admin` → Mural de clientes) |
| Esconder categorias, mostrar preços | **Painel** (`/admin` → Opções do site) |
| Aprovar ou apagar recados | **Painel** (`/admin` → Comunidade) |
| WhatsApp (35 98874-7707), Instagram (@aanghelmodas), e-mail, cidade | `src/data/brand.ts` |
| Categorias, tamanhos, tecidos e cores com nome | `src/data/catalog.ts` |
| Nome e lista dos moldes do provador | `src/data/fits.ts` (o desenho 3D de cada molde fica em `src/components/three/garments.ts`) |
| Coleção de exemplo (catálogo vazio) | `src/data/sample.ts` |
| Brilho e textura de cada tecido | `src/components/three/fabric.ts` |
| Medidas e pose do manequim | `src/components/three/body.ts` |
| Textos da abertura | `src/components/sections/Hero.tsx` |
| Menu | `src/data/nav.ts` |

## Desempenho

O 3D foi ajustado para pesar menos em notebook e celular. Se for mexer nele, vale manter:

- **Um shader só para todas as roupas**: recortes (decote, cavas, costas, fenda), texturas dos tecidos e efeitos da abertura são todos parâmetros (uniforms). Trocar peça, cor ou tecido não recompila nada.
- **Cada molde é gerado uma vez** e guardado; trocar de cor não gera malha nova.
- **Tudo é preparado atrás da tela de carregamento** (`Warmup.tsx`): a abertura e o provador compilam os shaders e sobem tudo para a GPU antes da cortina abrir.
- **As cenas 3D só desenham quando estão na tela**, e o three.js fica num arquivo à parte (quem abre o site baixa a página primeiro).
- **A arara monta só os cabides perto do centro**, então um catálogo grande continua leve. As fotos dos cartões são as miniaturas (720 px).
- **Resolução no máximo 1,5×**, caindo para 1× sozinha na abertura se o aparelho não segurar 60 fps.
- **Sem pós-processamento e sem sombras de verdade**: o brilho vem dos materiais e a sombra no chão é um degradê.
- **Nada de `backdrop-filter` em cima do canvas**, e animações de scroll só com `transform`/`opacity`.

## Estrutura

```
src/
  admin/        painel (/admin): catálogo, mural de clientes, opções e comunidade; carregado à parte
  components/
    three/      3D: manequim (body), moldes das roupas (garments), tecidos (fabric), abertura,
                arara do catálogo e provador
    sections/   seções da página (abertura, catálogo, provador, clientes, como comprar, comunidade, contato)
    layout/     cortina de abertura, menu, rodapé, cursor, scroll suave
    ui/         peças reutilizáveis (logo, miniatura da peça…)
  context/      estado da abertura, dados do painel e look montado no provador
  data/         conteúdo editável (marca, catálogo, moldes, coleção de exemplo)
  dev/          laboratório dos moldes (só no npm run dev)
  lib/          chamadas às funções, imagens (redução, conta-gotas, recorte do tecido), etiquetas
netlify/
  functions/    site (dados públicos), image (entrega as fotos), visit (conta visitas),
                comment (recebe recados), admin (painel, com senha)
  lib/          acesso ao Netlify Blobs, validação das peças e das opções, limpeza de textos
```
