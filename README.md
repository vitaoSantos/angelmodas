# Anghel Modas

Site-vitrine da Anghel Modas (moda feminina): uma página única com uma **capa com as fotos reais das peças**, um **catálogo em arara 3D**, um **provador** onde a cliente monta o look com as fotos das peças, mural de clientes, comunidade (recados e contador de visitas) e contato. Tem também um **painel** (`/admin`) para cadastrar as peças com foto, publicar fotos de clientes, ligar/desligar opções do site e cuidar dos recados, sem mexer no código.

Mesma base do ChocoFeliz: **Vite + React + TypeScript + Tailwind v4 + Three.js (React Three Fiber, só na arara) + Motion + Lenis**, publicado no **Netlify** com **Netlify Forms**, **Functions** e **Blobs** (sem banco de dados para manter).

## A vitrine

Tudo o que a cliente vê é foto de verdade das peças. O 3D fica só na arara, e o celular recebe uma versão mais leve dela.

### Capa

As novidades passam como uma revista: uma cortina revela a próxima foto a cada 5,6 s, com barrinhas de progresso como nos stories e a etiqueta da peça (nome, preço, "Novidade") que abre a ficha. No computador a foto fica ao lado do título, com a próxima peça encostada atrás; no celular ela ocupa a tela inteira (toque na direita avança, na esquerda volta). A capa usa as fotos de capa das peças cadastradas, das novidades para as mais antigas.

### Catálogo em arara 3D

As peças ficam penduradas em cabides dourados num varão. Arrastar (mouse, dedo, trackpad lateral ou setas) passa as peças, e os cabides **balançam com o movimento**. Cada cabide tem uma etiqueta de papel com nome, cores e o preço em destaque. Tocar numa peça abre a ficha. Peça sem foto com modelo aparece no cabide com a foto da peça sozinha num papel cor de linho. Também dá para ver o catálogo em lista.

### Provador ("Monte o seu look")

Um quadro cor de linho com duas faixas, **parte de cima** e **parte de baixo**, ou uma faixa só para a **peça inteira** (vestido, macacão, conjunto). Arrastar a faixa para o lado (ou as setas) troca a peça; as cores trocam na lista "Vestindo agora". A cliente escolhe o tamanho, pede pelo WhatsApp com o look já escrito na mensagem e pode **salvar a foto do look** (formato do feed, com as peças, os nomes e o @ da loja) para compartilhar.

**De onde vem a imagem de cada peça:** no cadastro, cada cor pode ter uma **foto da peça sozinha** (esticada na cama ou no cabide). O painel **tira o fundo na hora**, no próprio navegador e sem custo, e a peça aparece recortada no papel do provador, com a sombra do próprio contorno. Se o fundo não sair bem, dá para usar a foto com fundo, que aparece como uma foto pousada no papel. Sem a foto da peça sozinha, o provador usa a foto com modelo, mostrando a parte do corpo onde a peça veste.

Dicas para a foto da peça sozinha: peça inteira na foto, esticada sem dobras, sobre um fundo liso de cor diferente da peça (lençol, parede, papel), com luz do dia e sem sombras fortes. Peça branca num fundo claro não separa: use um fundo escuro.

### Ficha da peça

Fotos com modelo e as fotos da peça sozinha de cada cor (tocar numa cor mostra a foto dela), o "tecido de perto" (o recorte que o conta-gotas tira da foto), tamanhos, "Quero esta peça" (WhatsApp) e "Montar um look com esta peça", que leva a peça para o provador.

## Rodando

```bash
npm install
npm run dev        # http://localhost:5173 (o painel fica em /admin)
npm run build      # gera dist/
npm run typecheck
```

No `npm run dev` as Netlify Functions e o Netlify Blobs são simulados pelo `@netlify/vite-plugin` (os dados de teste ficam na pasta `.netlify/`, fora do git). Para entrar no painel localmente, crie um arquivo `.env` com `ADMIN_PASSWORD=uma-senha-de-teste`.

## Publicando no Netlify

O `netlify.toml` já está pronto (build `npm run build`, pasta `dist`, Node 22, funções em `netlify/functions`). É só conectar o repositório no Netlify.

**Senha do painel (obrigatório para usar o `/admin`):** em **Site configuration → Environment variables → Add a variable**, crie `ADMIN_PASSWORD` com uma senha forte e depois faça um novo deploy (**Deploys → Trigger deploy**). Sem ela o painel avisa que não está configurado; o resto do site funciona normalmente.

**Análise da foto com IA (opcional):** o botão **Analisar a foto** do painel usa a API do Claude. Crie uma chave em [platform.claude.com](https://platform.claude.com) (**API keys**), coloque créditos na conta e crie no Netlify a variável `ANTHROPIC_API_KEY` com a chave (mesmo caminho da senha), depois faça um novo deploy. Cada análise custa poucos centavos (uma foto reduzida e uma resposta curta). A IA só sugere: nada é salvo até você conferir e tocar em salvar. Sem a variável, o botão avisa que não está configurado e o resto do painel funciona normalmente.

As mensagens do formulário aparecem em **Netlify → Forms → pedido** (com o look montado no provador, quando a cliente montou um). Para receber por e-mail: **Forms → Form notifications → Add notification**.

## Painel (`/admin`)

Endereço: `seusite.netlify.app/admin` (não aparece no menu e não é indexado pelo Google). Entra com a senha do `ADMIN_PASSWORD`.

- **Catálogo**: cadastre a peça com até 6 fotos (dá para fotografar direto do celular; o painel reduz a foto, corrige a rotação e remove localização e outros dados da câmera). Nome, categoria, tecido, **onde veste no provador** (parte de cima, de baixo, peça inteira, conjunto ou fora do provador), cores (atalhos com nomes ou qualquer cor; **toque no tecido da foto** para tirar a cor e o recorte do tecido) com a **foto da peça sozinha** de cada cor (o fundo sai sozinho; dá para escolher com ou sem fundo), tamanhos, preço (opcional), descrição e as chaves **Novidade**, **Esgotada** e **Esconder do site**. A **prévia no provador** mostra na hora como a peça aparece para a cliente. Com a variável `ANTHROPIC_API_KEY`, o botão **Analisar a foto** preenche o cadastro a partir da foto. Depois dá para editar, trocar a capa, incluir ou apagar fotos e apagar a peça. Cabem até 300 peças.
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
| Opções de "onde veste" no provador | `src/data/fits.ts` |
| Textos da capa | `src/components/sections/Hero.tsx` |
| Como o fundo da foto da peça é tirado | `src/lib/cutout.ts` |
| Menu | `src/data/nav.ts` |

## Desempenho

O site foi ajustado para não travar no celular. Se for mexer, vale manter:

- **Uma cena 3D só (a arara)**, carregada à parte: quem abre o site baixa a página primeiro, e o three.js só vem quando a arara está chegando na tela.
- **No celular a arara é mais leve**: resolução 1×, sem antisserrilhado, menos cabides montados de uma vez e sem as partículas douradas. Ela é desmontada quando fica longe da tela (libera a memória de vídeo) e só desenha quando está visível.
- **A arara monta só os cabides perto do centro**, então um catálogo grande continua leve. As fotos dos cartões são as miniaturas (720 px).
- **Capa e provador são só imagens**: a capa baixa a primeira foto com prioridade e a próxima antes da hora; as fotos do provador e das listas carregam conforme aparecem.
- **Nada fica grudado na tela no celular** (o quadro do provador rola junto com a página), e o granulado e o cursor personalizado só existem no computador.
- **Nada de `backdrop-filter` em cima do canvas**, e animações só com `transform`/`opacity`/`clip-path`.

## Estrutura

```
src/
  admin/        painel (/admin): catálogo, mural de clientes, opções e comunidade; carregado à parte
  components/
    three/      arara 3D do catálogo (cabides, varão, etiquetas, luz)
    sections/   seções da página (capa, catálogo, provador, ficha da peça, clientes, como comprar, comunidade, contato)
    layout/     cortina de abertura, menu, rodapé, cursor, scroll suave
    ui/         peças reutilizáveis (logo, miniatura, foto da peça, quadro do provador…)
  context/      estado da abertura, dados do painel, look montado no provador e ficha da peça
  data/         conteúdo editável (marca, catálogo, onde veste)
  lib/          chamadas às funções, imagens (redução, conta-gotas, recorte do tecido, tirar o fundo),
                etiquetas da arara, foto do look
netlify/
  functions/    site (dados públicos), image (entrega as fotos), visit (conta visitas),
                comment (recebe recados), admin (painel, com senha)
  lib/          acesso ao Netlify Blobs, validação das peças e das opções, limpeza de textos,
                análise da foto com IA
```
