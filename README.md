# Torre de Controle WTA

Painel de decisão + automação de dados para a **WTA Medicina do Trabalho**
(saúde ocupacional, Uberlândia). Transforma a planilha gerencial da WTA em um
painel único, sem emoji, que a direção usa para decidir — e prepara o terreno
para migrar a operação de Excel para uma base de dados viva.

- **Produção:** https://torre-controle-wta.vercel.app
- **Contexto/estado do projeto (vault):** `Dev.Tossi/Projetos/Torre de Controle WTA/`
  (leia `Hub.md` e `Onde parei.md` antes de mexer).

---

## O que o painel mostra

Seis abas, todas calculadas a partir da mesma planilha:

- **Comercial** — diagnóstico jan–jul 2026 vs 2025 (faturamento, contratos, ticket,
  receita recorrente, participação de renovação), com drill-down por indicador e vendedor.
- **Visão geral** — faturamento rastreado, OS, entregues, ticket, gargalos por etapa,
  faturamento por ano, e os "3 sinais que a planilha esconde".
- **Renovações** — motor de vencimentos (o que vence, quando, quanto).
- **Dinheiro parado** — backlog priorizado (valor × idade × prestador).
- **Cross-sell** — lacunas de serviço por cliente (quem tem PCMSO sem PGR, etc.).
- **Qualidade de dados** — clientes com código duplicado, sem CNPJ, valor zero, sem data.

Números-chave da base atual (12.219 OS, 2022–2026): faturamento total
R$ 5.375.000,39; jan–jul 2026 R$ 1.607.448,08 em 2.753 contratos; 1.655 renovações
vencidas em aberto; R$ 525.730,10 parados em 946 OS a realizar.

---

## Arquitetura

```
PLANILHA_GERENCIAL.xlsx  (aba "2022-2026")
        │
        ▼
   etl/etl.mjs            motor de ETL em JS (SheetJS) -> payload {DATA, F1, COM}
        │
        ▼
   etl/payload.json       snapshot completo (também espelhado no Supabase)
        │
        ├──────────────► Supabase  (tabela public.snapshot, jsonb)
        │                   ▲  keepalive diário impede a pausa do plano free
        ▼                   │
   src/shell.html  ──build──►  dist/index.html  ──deploy──►  Vercel (produção)
   (painel-fonte)          (auto-contido)
```

O painel (`dist/index.html`) tenta ler o snapshot mais recente do Supabase ao
carregar; se falhar ou demorar, cai no **seed** embutido (`payload_seed.json`),
então o site nunca fica em branco.

---

## Estrutura do repositório

```
etl/
  etl.mjs                 Motor de ETL (Node ESM). Lê o xlsx -> payload.json.
  etl_full.validated.mjs  Mesmo motor + harness que validou 100% contra o Python.
  payload.json            Snapshot completo (DATA + F1 + COM, drills de 12 linhas).
  payload_seed.json       Seed enxuto (drills de 5 linhas) — fallback do painel.
src/
  shell.html              Painel-fonte montado (markup + styles.css + app.js + motion.js).
  styles.css              Design system (tokens, rampa vermelha, sombras, motions).
  app.js                  Render das 6 abas + drill-downs.
  motion.js               Camada de motion (reveal, count-up, sweep do donut).
api/
  keepalive.js            Função serverless (cron) que dá um SELECT no Supabase.
build/
  build.py                src/shell.html -> dist/index.html (gzip + base64 inline).
dist/
  index.html              Artefato publicado (auto-descomprime no navegador).
supabase/
  schema.sql              Tabela snapshot + RLS.
  config.md               URL, chave publishable e onde fica a secret (referência).
docs/
  DEPLOY.md               Como publicar e por que o index é auto-contido.
```

---

## Como rodar

### 1. Regerar o payload a partir de uma planilha nova

```bash
npm install
node etl/etl.mjs caminho/para/PLANILHA_GERENCIAL.xlsx etl/payload.json
```

"Hoje" (referência de vencimentos/idade do backlog) usa a data do sistema.
Para reproduzir os números validados de 18/07/2026:

```bash
WTA_HOJE=2026-07-18 node etl/etl.mjs caminho/PLANILHA_GERENCIAL.xlsx etl/payload.json
```

### 2. Reconstruir o painel

Depois de mexer em `src/shell.html` (ou nos assets que ele embute):

```bash
python3 build/build.py        # gera dist/index.html
```

### 3. Publicar

Ver `docs/DEPLOY.md`. Em resumo: publica-se `dist/index.html` + `api/keepalive.js`
+ `vercel.json` na Vercel (projeto `torre-controle-wta`).

---

## Supabase e segredos

Config em `supabase/config.md`. A **chave publishable (anon)** é pública e pode ir
no front/keepalive. A **secret key (service_role) NUNCA vai para o código, chat ou
front** — fica só no dashboard do Supabase / variável de ambiente de servidor
("keys, not prompts").

O plano free pausa o projeto após ~7 dias ocioso; o cron diário em `vercel.json`
chama `/api/keepalive`, que faz um SELECT barato e mantém o banco ativo.
