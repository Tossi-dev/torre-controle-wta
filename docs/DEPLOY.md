# Deploy — Torre de Controle WTA

## Onde roda

- **Vercel**, projeto `torre-controle-wta` (produção: https://torre-controle-wta.vercel.app).
- Publicado via **deploy inline do MCP da Vercel** (arquivos enviados no corpo da chamada,
  sem build nem git).

## O que sobe

Três arquivos:

```
index.html          <- dist/index.html (o painel auto-contido)
api/keepalive.js    <- api/keepalive.js
vercel.json         <- vercel.json (cron do keepalive)
```

## Por que o painel é UM index.html auto-contido

O jeito óbvio — dividir o painel em vários arquivos (`a1.dat`, `a2.dat`, … buscados por
`fetch`) — **quebra na Vercel neste modo de deploy**: os sub-recursos são reescritos para
o `index.html` (a rota `/a1.dat` devolve o próprio index), então o `fetch` recebe HTML no
lugar dos dados e o painel morre com **"TypeError: Failed to fetch"**.

Solução: o painel inteiro (`src/shell.html`, ~59 KB) é comprimido com gzip, vira base64 e
é **embutido dentro do próprio index.html**. No navegador ele se auto-descomprime:

```
atob(D) -> Uint8Array -> Blob.stream().pipeThrough(new DecompressionStream("gzip"))
        -> text() -> document.write()
```

Sem nenhuma sub-requisição, nada é reescrito — imune ao problema de rota. O resultado é
~23,5 KB de index.html.

> Regra: **não voltar a dividir o painel em arquivos separados** buscados por fetch neste
> pipeline. Se um dia migrar para deploy por git com build normal, aí sim dá pra servir
> assets soltos.

## Passo a passo

1. Se mexeu no painel-fonte, rode `python3 build/build.py` para regenerar `dist/index.html`.
2. Publique os três arquivos acima no projeto `torre-controle-wta` (deploy inline do MCP,
   target = production).
3. Abra https://torre-controle-wta.vercel.app e confira: título "Painel de Decisão",
   pill "dados reais 2022–2026", `#h_os` = 12.219, sem erro no console.

## Limite prático do deploy inline (IMPORTANTE)

O deploy inline (MCP) transporta o arquivo como TEXTO. Acima de ~23 KB de base64 esse
transporte **corrompe** (1–2 caracteres trocados) e o gzip não descomprime → tela
"Erro: Failed to fetch". Confirmado na prática: o painel COM todos os drills (auto-contido
~27 KB, ou fatiado em b1..b5.js) não sobe íntegro pelo inline; a versão só com os drills do
Comercial (~23 KB) sobe. Diagnóstico rápido: no navegador, comparar o hash de `window.__D`
com o hash local por faixas (bisecção) acha o pedaço trocado.

### Caminho confiável para a versão completa: deploy por Git

A forma sem corrupção é **conectar o repositório GitHub à Vercel** (git deploy):
a Vercel puxa os arquivos direto do repo e serve `dist_chunked/` (index.html + b1..b5.js),
sem limite de tamanho e sem transcrição. Verificado que a Vercel serve os `.js` estáticos
corretamente (o `window.__D` chegou aos 26840 chars). Passos:

1. Subir este repo pro GitHub (`subir-github.bat`) — `Tossi-dev/torre-controle-wta`.
2. Na Vercel, projeto `torre-controle-wta` → conectar ao repo Git; **Output Directory =
   `dist_chunked`** (ou mover `index.html`+`b*.js`+`api/`+`vercel.json` pra raiz).
3. Todo push passa a publicar sozinho — fim do problema de transcrição.

Enquanto o git deploy não está ligado, a produção fica na última versão boa (promovida pela
dashboard da Vercel: Deployments → deployment bom → "Promote to Production").

### Build fatiado (para o git deploy)

`python3 build/build_chunked.py` gera `dist_chunked/` (index.html que carrega b1..b5.js e
descomprime). São arquivos `.js` estáticos — a Vercel serve certo (ao contrário de `.dat`).

## Keepalive (anti-pausa do Supabase free)

`vercel.json` agenda `/api/keepalive` 1×/dia (`0 6 * * *`). A função faz um SELECT barato
no Supabase com a chave **publishable**, gerando atividade e impedindo a pausa automática
do projeto free (~7 dias ocioso). Conferir nos logs de Cron da Vercel após o 1º disparo.
