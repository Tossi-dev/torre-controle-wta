# Auth — Torre de Controle WTA (F3)

## Objetivo

Login com papéis no painel. Fase 3 do plano "de painel a sistema". Fecha a gravação das
tarefas (que na F2 estava aberta como MVP) e controla quem vê/edita o quê.

## Decisões

- **Método:** magic-link (Supabase Auth, `signInWithOtp`). Sem senha — a pessoa digita o
  e-mail, recebe um link, clica e entra. Alinha com "não manusear senhas".
- **Papéis:** `admin` (direção) e `operador` (vendedores). Papel vem da tabela `profiles`.
- **Escopo (opção A):** o login trava o **painel inteiro** — o `APP()` (render dos dados) só
  roda depois de autenticar e ter papel. Sem sessão → só a tela de login.
- **Acesso restrito:** só e-mails presentes em `profiles` recebem papel e entram. E-mail
  autenticado sem linha em `profiles` = "aguarde liberação" (não renderiza o painel).

### Ressalva honesta (MVP)
O painel é 1 index.html auto-contido com o **seed embutido**. Com a opção A, o painel não é
**renderizado** sem login (gate de uso), mas o seed ainda está no arquivo (extraível por quem
abrir o código-fonte). Confidencialidade real dos dados exigiria **não embutir** o seed e
carregar tudo do Supabase só após login (RLS autenticada no `snapshot`) — fica como
endurecimento posterior. Para uma ferramenta interna, o gate de uso já resolve o dia a dia.

## Mecânica (sem SDK — REST puro, mantém o painel leve)

1. **Enviar link:** `POST /auth/v1/otp` com `{ email, options:{ email_redirect_to: SITE } }`
   + header `apikey` (publishable). Supabase manda o e-mail.
2. **Voltar do link:** Supabase redireciona para `SITE/#access_token=…&refresh_token=…&
   expires_in=…`. No load, lê `location.hash`, guarda tokens em `localStorage`, limpa o hash.
3. **Sessão:** guarda `access_token` + `refresh_token` + `expires_at`. No load, se válido usa;
   se expirado, `POST /auth/v1/token?grant_type=refresh_token`.
4. **Usuário/papel:** decodifica o JWT (sub, email) e busca `GET /rest/v1/profiles?id=eq.<sub>`
   usando o `access_token` como Bearer.
5. **Sair:** `POST /auth/v1/logout` + limpa `localStorage`.

`localStorage` funciona no site publicado (Vercel) — a restrição de storage é só de artifact
do Claude.ai, não vale aqui.

## Integração com a F2 (tarefas)

Depois do login, as chamadas REST de `task` passam a mandar o **`access_token` do usuário** como
`Authorization: Bearer` (com o `apikey` publishable). Assim a RLS enxerga
`auth.role() = 'authenticated'`. Enquanto não há sessão, cai no anon (compatível com a F2).

## Supabase

### profiles
```sql
create table if not exists public.profiles (
  id     uuid primary key references auth.users(id) on delete cascade,
  email  text,
  nome   text,
  papel  text not null default 'operador' check (papel in ('admin','operador')),
  criado timestamptz default now()
);
alter table public.profiles enable row level security;
-- cada um lê o próprio perfil
create policy prof_self on public.profiles for select using (auth.uid() = id);
-- admin lê/gere todos
create policy prof_admin_all on public.profiles for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.papel = 'admin'));
```
Semear o admin (o e-mail do Guilherme) depois que ele confirmar qual é. Operadores entram
quando os e-mails forem informados.

### RLS da task (apertar no deploy do F3)
Trocar a escrita aberta (anon) por exigir autenticado — fazer **junto com o deploy do F3**,
senão quebra a F2 se ela subir antes:
```sql
drop policy if exists task_ins on public.task;
drop policy if exists task_upd on public.task;
create policy task_ins on public.task for insert to authenticated with check (true);
create policy task_upd on public.task for update to authenticated using (true) with check (true);
-- leitura pode continuar liberada, ou também restringir a authenticated
```

### Config do Auth (dashboard)
- Site URL / Redirect URLs: incluir `https://torre-controle-wta.vercel.app`.
- Provider e-mail (magic-link) ligado. E-mail padrão do Supabase serve para poucos usuários;
  para produção séria, configurar SMTP próprio.

## Aberto / a confirmar
- **Consequência da opção A:** todo mundo que abre o painel precisa logar (inclusive os
  vendedores) → eles precisam de e-mail individual. Se não for prático, alternativa é gate só
  nas edições + área Dados (o "ver" continua aberto).
- E-mail do **admin** (Guilherme) para semear o primeiro acesso.
- E-mails dos **operadores** para liberar.
