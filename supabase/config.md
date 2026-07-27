# WTA Supabase — configuração

- **Projeto:** wta (Tossi-dev's Org, plano FREE)
- **Região:** São Paulo (sa-east-1)
- **Project ref:** dopflrttbclvtyvzlysb
- **URL:** https://dopflrttbclvtyvzlysb.supabase.co
- **REST base:** https://dopflrttbclvtyvzlysb.supabase.co/rest/v1/
- **Publishable key (anon — pública, pode ir no front):**
  `sb_publishable_pwV8JpbQjnpQY2JXh_6qyA_0DygnmuI`
- **Secret key (service_role — NÃO colar em chat/front; só em env de servidor):** começa com `sb_secret_gD9lL…` (guardada só no dashboard Supabase)

## Tabela
`public.snapshot` (id uuid, created_at timestamptz, source_file text, os_count int, faturamento numeric, payload jsonb)

RLS: leitura pública (anon+auth SELECT), insert só autenticado.

## Testes já feitos
- Schema rodado com sucesso no SQL Editor ("Success. No rows returned").
- GET REST com publishable key → 200, `[]` (tabela existe, sem linhas ainda).
- CORS OK a partir de https://torre-controle-wta.vercel.app.
