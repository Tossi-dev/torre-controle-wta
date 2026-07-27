# Torre de Controle WTA — Instruções para o Claude

> Este arquivo é lido no início de cada sessão de código deste repositório.

---

## ⚡ Antes de começar qualquer sessão

Leia estes dois arquivos do vault Dev.Tossi (fonte da verdade do projeto):

```
C:\Users\PC\OneDrive\Área de Trabalho\Dev.Tossi\Projetos\Torre de Controle WTA\Hub.md
C:\Users\PC\OneDrive\Área de Trabalho\Dev.Tossi\Projetos\Torre de Controle WTA\Onde parei.md
```

Só comece a trabalhar depois de ler os dois. Depois, leia `README.md` (arquitetura)
e, se for mexer em deploy, `docs/DEPLOY.md`.

---

## 🎯 Contexto do projeto

**O que é:** painel de decisão + automação de dados para a WTA Medicina do Trabalho
(saúde ocupacional, Uberlândia). Lê a planilha gerencial e entrega 6 abas de análise.
**Objetivo:** dar à direção da WTA um painel único e confiável e, em paralelo, migrar
a operação de Excel para uma base de dados viva — de forma gradual, "sem os
funcionários perceberem".
**Usuário/Cliente final:** direção da WTA (decisão) + equipe operacional (lançamento).
**Stakeholder principal:** Guilherme Tossi (Dev.Tossi) — administrador. Não escreve código.

---

## 🏗️ Stack técnica

- **Painel:** HTML/CSS/JS único, auto-contido (sem framework). Fonte em `src/`.
- **ETL:** Node ESM + SheetJS (`xlsx`) — `etl/etl.mjs`.
- **Banco:** Supabase (Postgres), tabela `public.snapshot` (jsonb). Ver `supabase/config.md`.
- **Deploy:** Vercel (projeto `torre-controle-wta`), via deploy inline do MCP.
- **Repo local:** `C:\Users\PC\OneDrive\Área de Trabalho\Dev.Tossi\Repositórios\Torre de Controle WTA\`

---

## 📐 Regras inegociáveis

- **Português em tudo** (código, UI, comentários).
- **Secret key do Supabase NUNCA** vai para código, chat ou front — só a publishable (anon).
  A secret vive no dashboard do Supabase / env de servidor ("keys, not prompts").
- **Painel sem emoji** e com o design system atual (rampa vermelha, Inter, motions com
  `prefers-reduced-motion`). KPI sempre com composição ("de onde vem o número").
- **Não quebrar a produção:** o deploy inline da Vercel reescreve sub-recursos para o
  index; por isso o painel é UM index.html auto-contido (ver `docs/DEPLOY.md`). Não
  voltar a dividir em `.dat`/arquivos separados sem reler esse doc.
- **Números vêm do motor**, não escritos à mão: qualquer KPI novo sai do `etl/etl.mjs`,
  que é validado contra o gabarito (`etl/etl_full.validated.mjs`).

---

## ⏭️ Ao terminar a sessão

Atualize `Onde parei.md` no vault (o que foi feito, próximo passo, bloqueios) e deixe
rastro em `log.md`. Caminho:

```
C:\Users\PC\OneDrive\Área de Trabalho\Dev.Tossi\Projetos\Torre de Controle WTA\Onde parei.md
```

---

## 📋 Próximos passos conhecidos

1. Área **Dados/Planilha** (admin): upload de Excel -> roda `etl/etl.mjs` -> grava
   snapshot no Supabase -> painel atualiza sozinho.
2. Integração **Google Sheets** (espelho + planilha embutida + link "atualizar planilha"
   + caminho de volta pra Excel). Falta o usuário definir a conta Google oficial.
