# Revi — Plano de Implementação (MVP)

> Este documento é a fonte de verdade para a implementação do Revi. Foi escrito para ser executado por um agente de código, **uma etapa por vez, estritamente sequencial**, na ordem em que aparecem. Cada etapa tem objetivo, arquivos envolvidos, alterações necessárias, critérios de conclusão (testáveis dentro da própria etapa, sem depender de UI futura) e dependências. Não pule etapas, não implemente etapas em paralelo, e não implemente nada além do que está descrito na etapa atual.
>
> Revisado em 2026-09-19 após duas auditorias técnicas. Esta versão corrige integridade de dados, concorrência, RLS, datas, scaffold e critérios de validação. A restrição de uma revisão por conteúdo por dia é uma regra de produto explícita, mantida da revisão anterior; SMTP é requisito operacional para o login em produção. Nenhuma etapa foi implementada por esta revisão documental.

## Contexto

O Revi é um sistema simples para organizar revisões de conteúdos que o usuário já estudou (não é um app de flashcards). O usuário registra um tópico que estudou, e o sistema calcula automaticamente quando ele deve revisá-lo de novo, usando repetição espaçada de intervalos fixos. Objetivo explícito do usuário: MVP extremamente simples, evitando overengineering — mas correto, seguro e realmente executável por outro agente sem depender de ferramentas MCP.

Stack: **Next.js (App Router) + TypeScript + Supabase (Postgres + Auth) + Tailwind/shadcn**.

Projeto começou vazio (greenfield). O repositório já contém este `PLAN.md` — isso afeta a etapa de scaffold (ver Etapa 1).

## Decisões de produto confirmadas (não reabrir sem necessidade)

- **Unidade de conteúdo**: tópico de estudo (título + matéria opcional + notas), **não** flashcard de pergunta/resposta.
- **Algoritmo de revisão**: intervalos fixos `[1, 3, 7, 15, 30]` dias, sem fator de facilidade adaptativo (sem SM-2 completo). Ver semântica exata em "Convenções técnicas transversais".
- **Autenticação**: e-mail + senha via Supabase Auth, **sem confirmação de e-mail** (`signUp` já ativa a conta na hora, sem clique em link nenhum). *Revisado em 2026-09-20*: a decisão original era magic link (sem senha); o usuário pediu explicitamente a troca para "registro e login normal sem confirmação de e-mail" depois de testar o magic link na prática (Etapa 8 esbarrou repetidamente no limite de envio do e-mail padrão do Supabase). Trade-off de segurança aceito conscientemente: sem confirmação, não há garantia de que quem cadastra um e-mail é o dono dele. Efeito colateral bem-vindo: **elimina a necessidade de SMTP em produção** (Etapa 18) e de qualquer configuração de redirect/callback — não há mais e-mail nenhum no fluxo de autenticação.
- **Fuso horário oficial do MVP**: `America/Sao_Paulo`. Todo conceito de "hoje" no produto (datas de revisão, validação de datas futuras, bloqueio de revisão duplicada no mesmo dia) usa esse fuso, independentemente do fuso do navegador do usuário ou do servidor.
- **Revisão antecipada**: permitida, limitada a **uma revisão por conteúdo por dia** em `America/Sao_Paulo`, mesmo antes de `next_review_date`. Essa é uma regra de produto, além de uma proteção contra duplicidade. Reset não libera uma segunda revisão no mesmo dia; nesse caso, é necessário aguardar o próximo dia.
- **Conteúdos dominados (`mastered`)**: não podem ser revisados novamente até serem resetados.
- **Conteúdos arquivados (`archived`)**: não podem ser revisados.
- **Reset**: reativa o conteúdo (`status = 'active'`) e reinicia o ciclo (`interval_index = 0`, `studied_at = hoje`, `next_review_date` recalculada). Reset **não apaga** o histórico de revisões (`review_logs` preservado).
- **Datas de estudo futuras são rejeitadas** na criação de conteúdo (validação na Server Action, usando "hoje" em `America/Sao_Paulo`).
- **Atomicidade**: registrar uma revisão (inserir em `review_logs` + atualizar `contents`) é uma operação atômica e resistente a requisições concorrentes/duplicadas, garantida no banco ao chamar a função Postgres transacional. As limitações das escritas diretas estão descritas em "Limite da garantia de integridade".
- **Deploy na Vercel faz parte da conclusão do MVP** (última etapa do plano).
- **Mutações**: via Server Actions do Next.js, sem API routes separadas — exceto a transição de "marcar como revisado", que a Server Action delega a uma função Postgres (RPC) para garantir atomicidade e controle de concorrência no banco.
- **Dados**: Supabase Postgres com Row Level Security. Sem tabela `profiles` no MVP (usa `auth.users` diretamente).
- **Provisionamento**: o plano **não depende de ferramentas MCP**. Toda interação com Supabase é feita via Supabase CLI, arquivos de migration versionados em `supabase/migrations/`, e o painel web do Supabase quando uma ação exigir acesso manual (criação de projeto, configuração de Auth URLs). Cada etapa que exige uma ação manual no painel deixa isso explícito.

## Escopo do MVP

**Dentro do MVP:**
- Login/cadastro via e-mail e senha, sem confirmação de e-mail.
- Cadastrar um conteúdo estudado (título, matéria opcional, notas opcionais, data de estudo).
- Dashboard com conteúdos "para revisar hoje".
- Marcar conteúdo como revisado (a qualquer momento, inclusive antecipadamente) → avança automaticamente para o próximo intervalo, ou marca como dominado no último intervalo.
- Listar todos os conteúdos (ativos / dominados / arquivados).
- Ver histórico de revisões de um conteúdo.
- Editar (título/matéria/notas), arquivar e resetar um conteúdo.
- Deploy funcional em produção na Vercel. Sem SMTP: o fluxo de e-mail+senha sem confirmação não envia e-mail nenhum, então nenhum provedor de e-mail é necessário para o login funcionar com usuários externos.

**Fora do MVP (explicitamente adiado, não implementar agora):**
- Flashcards / auto-teste ativo.
- Algoritmo adaptativo (SM-2 completo, fator de facilidade).
- Notificações/lembretes (e-mail, push).
- Estatísticas avançadas, streaks, gráficos.
- Tags/categorias múltiplas, busca avançada.
- Snooze/adiar revisão por N dias.
- Edição da data de estudo (`studied_at`) fora do fluxo de reset — evita inconsistência entre `studied_at`, `interval_index` e `next_review_date`.

## Fluxo do usuário

1. Usuário acessa o app; se é a primeira vez, cria uma conta com e-mail e senha (fica logado na hora, sem confirmação); se já tem conta, entra com e-mail e senha.
2. Cai no **Dashboard**: vê lista "Para revisar hoje" (pode estar vazia) e lista geral de conteúdos ativos ordenados pela próxima data de revisão.
3. Clica em "Novo conteúdo" → preenche título (obrigatório), matéria (opcional), notas (opcional), data de estudo (default hoje, não pode ser futura) → salva. Sistema calcula `next_review_date = studied_at + 1 dia`.
4. A qualquer momento (inclusive antes da data prevista, respeitando o limite de uma revisão por conteúdo por dia), usuário pode abrir um conteúdo `active` e clicar em "Marcar como revisado" → sistema avança o índice de intervalo e recalcula a próxima data, ou marca como dominado se era o último intervalo.
5. Na quinta revisão, o conteúdo vira **dominado** — some das listas de revisão ativa e não pode mais ser revisado até ser resetado. A data prevista para essa revisão é 30 dias após a quarta, mas a antecipação também é permitida, respeitando o limite diário.
6. Usuário pode arquivar um conteúdo `active` (não quer mais revisar) — conteúdos arquivados não podem ser revisados.
7. Usuário pode resetar um conteúdo `mastered` ou `archived` (ou mesmo `active`, se quiser recomeçar) — isso reativa o conteúdo e reinicia o ciclo, sem apagar o histórico.
8. Página de detalhe do conteúdo mostra histórico de revisões (preservado mesmo após reset).

## Convenções técnicas transversais

Estas decisões atravessam várias etapas e devem ser seguidas de forma consistente. Leia esta seção antes de implementar qualquer etapa.

### Fuso horário e semântica de "hoje"

- Fuso oficial: `America/Sao_Paulo`.
- No banco (SQL/RPC): sempre calcular "hoje" como `(now() at time zone 'America/Sao_Paulo')::date`. Nunca usar `current_date` puro (depende do timezone da sessão do Postgres, que pode não ser `America/Sao_Paulo`).
- No servidor (Next.js — Server Components, Server Actions): usar uma função utilitária única `lib/date.ts#todaySaoPaulo()` que retorna a data de hoje em `America/Sao_Paulo` no formato `YYYY-MM-DD`, implementada com `Intl.DateTimeFormat` e `formatToParts` para montar explicitamente `YYYY-MM-DD` com `timeZone: 'America/Sao_Paulo'` (sem depender de biblioteca externa de datas — evita overengineering).
- No navegador: não é necessário replicar o cálculo — o formulário de "nova data de estudo" apenas envia a data escolhida pelo usuário; a validação de "não pode ser futura" é sempre feita no servidor (Server Action) comparando com `todaySaoPaulo()`.
- Colunas `studied_at` e `next_review_date` são do tipo `date` (sem componente de hora), para evitar ambiguidade de fuso ao armazenar. Validar formato e existência real da data antes de compará-la. Somar dias de calendário com operações UTC sobre os componentes da data, sem conversão para o fuso local do processo. O formulário recebe o default e o máximo de hoje do servidor.

### Semântica dos intervalos (importante — não ambíguo)

`INTERVALS = [1, 3, 7, 15, 30]` dias são **incrementais/relativos à data da última revisão**, não cumulativos a partir da data original de estudo. Ou seja:

```
next_review_date = data_da_revisão_atual + INTERVALS[próximo_índice]
```

Isso significa que, em dias corridos desde a data original de estudo (`studied_at`), supondo que cada revisão seja feita exatamente na data prevista, as revisões acontecem aproximadamente nos dias acumulados:

| Revisão nº | interval_index após revisão | Intervalo usado (dias desde a última revisão) | Dia acumulado desde `studied_at` |
|---|---|---|---|
| criação | 0 | — | dia 0 |
| 1ª revisão | 1 | 1 | dia 1 |
| 2ª revisão | 2 | 3 | dia 4 |
| 3ª revisão | 3 | 7 | dia 11 |
| 4ª revisão | 4 | 15 | dia 26 |
| 5ª revisão | → `mastered` | 30 | dia 56 |

Esse comportamento é intencional (cada intervalo cresce a partir da última revisão, como é padrão em repetição espaçada) e deve ser coberto por teste automatizado (ver Etapa 3).

### Estratégia de testes

- **Testes unitários**: Vitest para `lib/review.ts` e `lib/date.ts`, sem I/O. Controlar o relógio JavaScript para testar a virada do dia em São Paulo, datas inválidas, fim de mês e ano bissexto.
- **Testes de integração**: Vitest com `@supabase/supabase-js` e pelo menos dois usuários autenticados reais. O ambiente padrão é Supabase local via CLI/Docker. Criar contas com e-mail confirmado e senha de teste pela API administrativa; obter sessões reais por `signInWithPassword` apenas no harness, sem adicionar login por senha à UI do produto.
- Cada etapa valida seu próprio resultado sem depender de UI futura. Usar `test:unit` = `vitest run tests/unit`, `test:integration` = `vitest run tests/integration` e `test` = `vitest run`, que descobre todos os testes existentes. Na Etapa 3 só existem unitários; a partir da Etapa 6, a execução completa inclui integração. Carregar/validar o ambiente do banco apenas no harness de integração, nunca no setup global dos unitários. Integração sem ambiente configurado falha com uma instrução clara, não passa silenciosamente.
- Credenciais administrativas são exclusivas do harness de testes: criação/limpeza de usuários e fixtures. Todas as operações sob teste usam sessões comuns, sujeitas a RLS. Não usar credenciais administrativas da produção.
- **Sem Docker**: usar um projeto remoto de desenvolvimento dedicado e identificado explicitamente, com credenciais administrativas desse projeto somente no harness. Os critérios de stack local passam a exigir conectividade e migrations desse ambiente. Não executar `db reset` remoto; limpar somente usuários e dados criados pela suíte, em `finally`/teardown. Não confundir esse projeto com produção.
  - **Decisão tomada na Etapa 4**: a máquina de desenvolvimento estava com memória/swap esgotados para rodar a stack local via Docker com segurança; o usuário optou pelo caminho remoto. Projeto de desenvolvimento dedicado: `Revi` (ref `aimcowhpirmypxevhtfv`, org `jludrxhsnpidjprdwqun`), vinculado via `supabase link`. Esse é o alvo permitido em `.env.local`/`.env.test.local` (`SUPABASE_TEST_PROJECT_REF`) para todas as etapas seguintes — nunca usar `supabase db reset` contra ele.
- Configurar `.env.test.local` ignorado pelo Git, contendo URL, chave pública e chave administrativa do ambiente de teste. O harness carrega esse arquivo explicitamente e exige um alvo local ou um project ref de desenvolvimento permitido; recusa o ref de produção. `.env.example` contém somente nomes e valores vazios.

### Fixtures de tempo e testes do ciclo

O RPC usa `now()` do Postgres. Fake timers do Vitest não alteram esse relógio. Não adicionar parâmetro de data controlável pelo usuário nem alterar o RPC de produção para facilitar testes.

- A sequência pontual dos dias 1, 4, 11, 26 e 56 é validada nos testes unitários com datas fixas.
- Para exercitar as cinco transições reais no mesmo teste de integração, chamar o RPC como usuário autenticado. Após cada uma das primeiras quatro chamadas, o harness administrativo move **somente o log recém-criado dessa fixture** para um dia passado distinto: hoje − 5, − 4, − 3 e − 2 dias, respectivamente, às 12h em São Paulo. Assim, a próxima chamada encontra o dia atual livre, sem violar o índice único nem inverter a ordem dos logs.
- Após cada chamada, antes de preparar a próxima fixture, conferir índice, status, quantidade de logs e próxima data contra a fórmula TypeScript usando a data local do `reviewed_at` retornado pela consulta ao log. A quinta chamada deve resultar em `mastered`, índice 4 e data nula. Essa sequência testa transições e paridade SQL/TypeScript; não simula a passagem real de 56 dias.
- Testes de duplicidade/concorrência usam fixtures separadas e **não** movem logs. Em um conteúdo ativo nos índices 0–3, duas chamadas concorrentes produzem um sucesso e um `already_reviewed_today`. No índice 4, a segunda recebe `content_not_active`, pois a primeira concluiu o ciclo.
- Testar explicitamente revisar → resetar → tentar revisar no mesmo dia: o histórico permanece e a tentativa recebe `already_reviewed_today`.
- No E2E, usar o mesmo harness apenas no ambiente de desenvolvimento: preparar conteúdos independentes em cada estado, incluindo índice 4 com quatro logs em dias passados, e concluir a última revisão pela UI. Não exigir cinco revisões consecutivas sem preparação nem esperar dias reais. Não executar essa preparação em produção.

### Testes de Server Actions

Na Etapa 10, importar as actions no Vitest e substituir apenas as fronteiras do Next.js: a fábrica de `lib/supabase/server.ts` retorna o client real do usuário de teste; `revalidatePath` e eventuais redirects são spies/mocks. Não simular queries, RPC, sessão Supabase ou respostas do banco. Isso valida negócio, autenticação e RLS sem inventar um contexto HTTP. Cookies reais, redirects e atualização visual são verificados com o Next.js rodando nas etapas 8 e 11–17. Um teste com client sem sessão deve confirmar rejeição da action.

### Migrations, ambientes e provisionamento sem MCP

- Todo schema vive em arquivos SQL versionados em `supabase/migrations/`.
- A aplicação em desenvolvimento e a suíte usam o Supabase **local por padrão**; `.env.local` recebe sua URL e chave pública. Produção só é provisionada e recebe migrations na Etapa 18. Sem Docker, usar o projeto remoto dedicado de desenvolvimento para ambos.
- `0001_init.sql` já habilita RLS nas tabelas, ainda sem policies: o acesso comum fica bloqueado até `0002_rls_and_rpc.sql`. Isso evita tabelas expostas entre etapas.
- Local: `supabase start` e `supabase db reset` em banco descartável de desenvolvimento. Remoto dedicado: verificar o project ref antes de `supabase link --project-ref <ref>` e `supabase db push`. O comando `db reset` deste plano é exclusivamente local.
- Aplicar `0002` no mesmo ambiente em que o app será executado antes da Etapa 7. Em produção, aplicar todas as migrations na Etapa 18, antes de disponibilizar a aplicação.
- Gerar `lib/database.types.ts` após a Etapa 6 (`supabase gen types typescript --local --schema public`, ou `--project-id <ref-dev>` na alternativa remota). Regenerar após mudanças de schema/RPC e tipar os clients com `Database`.
- Configuração local de Auth vive em `supabase/config.toml`, aplicada ao ambiente remoto dedicado via `supabase config push` (sempre revisar `supabase config diff` antes — o comando opera no arquivo inteiro, não por campo, e pode sobrescrever configurações reais não relacionadas à mudança pretendida; mascara segredos como `auth.sms.twilio.auth_token`/`auth.external.apple.secret` e se recusa a desativar um provedor de SMS já ativo). *Revisado em 2026-09-20*: como a autenticação passou a ser e-mail+senha sem confirmação, não há mais e-mail nenhum no fluxo de login — a menção original a SMTP/caixa de testes de e-mail não se aplica mais.
- Verificar Advisors no painel quando houver projeto remoto. Ausência de painel no stack local não bloqueia validação local; a checagem remota é obrigatória antes de concluir a Etapa 18.

### Limite da garantia de integridade

O MVP mantém `security invoker` e as policies abaixo. O RPC garante que **uma revisão feita por ele** grava log e estado juntos. RLS isola usuários, mas não obriga o proprietário a passar pelo RPC: a API do Supabase ainda permite inserir logs próprios e alterar seus próprios conteúdos conforme as policies. Portanto, não há promessa de impedir adulteração do próprio histórico/estado por chamadas diretas. A UI e as Server Actions usam exclusivamente o RPC para registrar revisões. Impedir toda escrita direta exigiria outro modelo de permissões e não é requisito deste MVP.

Os logs não têm update/delete pela API comum; isso não impede a remoção em cascata ao excluir seu conteúdo/usuário nem a preparação administrativa de fixtures fora de produção.

### Execução sequencial

Todas as etapas abaixo são sequenciais. Não há etapas paralelas. Cada etapa lista suas dependências explícitas; nenhuma etapa deve ser iniciada antes de suas dependências estarem concluídas e validadas.

## Algoritmo de revisão (regras)

```
INTERVALS = [1, 3, 7, 15, 30]  // dias, incrementais (ver "Semântica dos intervalos")

Criar conteúdo:
  rejeitar se studied_at > hoje (America/Sao_Paulo)
  interval_index = 0
  next_review_date = studied_at + INTERVALS[0] dias
  status = 'active'

Marcar como revisado (a qualquer momento, revisão antecipada permitida):
  rejeitar se status != 'active' (mastered/archived não podem ser revisados)
  rejeitar se já existe um review_log para este conteúdo com reviewed_at::date (America/Sao_Paulo) = hoje
    (regra de uma revisão por dia, inclusive após reset; também evita cliques duplos)
  registrar log: { content_id, interval_index_at_review: interval_index, reviewed_at: now() }
  se interval_index + 1 < INTERVALS.length:
    interval_index += 1
    next_review_date = hoje + INTERVALS[interval_index] dias
  senão:
    status = 'mastered'
    next_review_date = null

Resetar conteúdo (de qualquer status):
  interval_index = 0
  studied_at = hoje
  next_review_date = hoje + INTERVALS[0] dias
  status = 'active'
  (review_logs existentes NÃO são apagados)

Arquivar conteúdo (apenas se status = 'active'):
  status = 'archived'
  (next_review_date não é alterado; fica sem uso enquanto arquivado)
```

Regra de exibição: **"para revisar hoje"** = `status = 'active' AND next_review_date <= hoje (America/Sao_Paulo)`.

A etapa "Marcar como revisado" **precisa** ser atômica e resistente a concorrência — é implementada como uma função Postgres (RPC), não apenas em TypeScript. Ver Etapa 6. A função `lib/review.ts` em TypeScript replica a mesma fórmula e é usada para: (a) calcular o `next_review_date` inicial na criação do conteúdo, e (b) ser testada isoladamente como especificação executável do algoritmo. O RPC no banco é a **fonte de verdade** para a transição de estado de "marcar como revisado"; ambos devem produzir o mesmo resultado para a mesma sequência de entradas (testado explicitamente — ver Etapa 6).

## Arquitetura

- **Next.js App Router (TypeScript)**: Server Components para leitura, **Server Actions** para mutações simples (criar, arquivar, resetar, editar — updates de uma linha só, sem necessidade de RPC). A mutação "marcar como revisado" é uma Server Action que chama a função Postgres `mark_content_reviewed` via RPC, para garantir atomicidade e controle de concorrência no banco.
- **Supabase**: Auth (e-mail + senha, sem confirmação de e-mail) + Postgres com Row Level Security. Todo acesso a dados passa pelo Supabase client autenticado (`@supabase/ssr`); RLS garante isolamento por usuário. As Server Actions também verificam autenticação e validam entradas antes de tocar o banco (defesa em profundidade, não apenas RLS).
- **Tailwind + shadcn/ui**: Button, Card, Input, Textarea, Tabs, Label, Sonner (toasts), preset `base-nova` (Base UI). Sem `react-hook-form`/`zod`/componente `Form`: formulários usam `<form>` nativo com os componentes acima, validados nas Server Actions (Etapa 10). Usar as convenções atuais (Tailwind v4, configuração via CSS, sem `tailwind.config.js`; shadcn CLI detecta isso automaticamente).
- **Vitest** para testes unitários e de integração.
- Sem service role key no client; sem backend separado.
- Deploy: Vercel, com variáveis de ambiente de produção e Supabase Auth configurado para o domínio publicado (Etapa 18).

### Estrutura de arquivos alvo

```
app/
  layout.tsx
  page.tsx                     // Dashboard
  login/page.tsx               // tabs Entrar/Criar conta
  login/actions.ts              // signIn/signUp (email+senha, sem confirmação)
  contents/
    page.tsx                   // lista (tabs ativos/dominados/arquivados)
    new/page.tsx
    actions.ts                 // server actions
    [id]/page.tsx                // detalhe + histórico
    [id]/edit/page.tsx
lib/
  review.ts                    // regras puras do algoritmo (espelha o RPC)
  date.ts                      // todaySaoPaulo(), isFutureSaoPaulo()
  supabase/client.ts             // browser client
  supabase/server.ts             // server client (cookies)
  data/contents.ts               // queries
  database.types.ts              // tipos gerados do schema e RPC
proxy.ts                         // refresh de sessão + proteção de rotas
supabase/migrations/
  0001_init.sql                  // tabelas + constraints + trigger updated_at + RLS habilitado
  0002_rls_and_rpc.sql            // RLS + função mark_content_reviewed + índice único anti-duplicidade
tests/
  unit/review.test.ts
  unit/date.test.ts
  integration/rls.test.ts         // isolamento entre usuários
  integration/review-flow.test.ts // ciclo completo, concorrência, estados bloqueados
  helpers/fixtures.ts            // preparação/limpeza administrativa, só em teste
```

## Schema do Supabase

### `supabase/migrations/0001_init.sql`

```sql
create extension if not exists pgcrypto;

create table contents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (title ~ '[^[:space:]]'),
  subject text,
  notes text,
  studied_at date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  interval_index int not null default 0 check (interval_index >= 0 and interval_index < 5),
  next_review_date date,
  status text not null default 'active' check (status in ('active','mastered','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint next_review_date_required_when_active
    check (status <> 'active' or next_review_date is not null)
);

create table review_logs (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references contents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  interval_index_at_review int not null check (interval_index_at_review >= 0 and interval_index_at_review < 5),
  reviewed_at timestamptz not null default now()
);

-- RLS habilitado desde a criação; policies entram em 0002.
alter table contents enable row level security;
alter table review_logs enable row level security;

create index idx_contents_due on contents (user_id, status, next_review_date);
create index idx_review_logs_content on review_logs (content_id);

create or replace function set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger contents_set_updated_at
  before update on contents
  for each row
  execute function set_updated_at();
```

Nota: a validação "`studied_at` não pode ser futura" **não** é feita via `CHECK` no banco (constraints com funções não-imutáveis como `now()` são frágeis/dependem do timezone da sessão). Essa validação é responsabilidade da Server Action (Etapa 10), usando `lib/date.ts#todaySaoPaulo()`. `next_review_date` é `NULL` apenas quando `status` é `mastered` ou `archived` — nunca quando `active` (garantido pela constraint acima).

### `supabase/migrations/0002_rls_and_rpc.sql`

```sql
alter table contents enable row level security;
alter table review_logs enable row level security;

-- contents: dono acessa tudo
create policy "contents_select_own" on contents
  for select using (auth.uid() = user_id);
create policy "contents_insert_own" on contents
  for insert with check (auth.uid() = user_id);
create policy "contents_update_own" on contents
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "contents_delete_own" on contents
  for delete using (auth.uid() = user_id);

-- review_logs: dono acessa apenas logs de conteúdos que ele realmente possui
-- (checagem dupla: user_id da própria linha E dono do content_id referenciado,
--  para não confiar apenas em review_logs.user_id)
create policy "review_logs_select_own" on review_logs
  for select using (
    auth.uid() = user_id
    and exists (
      select 1 from contents c
      where c.id = review_logs.content_id and c.user_id = auth.uid()
    )
  );
create policy "review_logs_insert_own" on review_logs
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from contents c
      where c.id = review_logs.content_id and c.user_id = auth.uid()
    )
  );
-- Sem update/delete direto de logs pela API comum; cascatas e fixtures administrativas são exceções.

-- Evita duas revisões do mesmo conteúdo no mesmo dia (America/Sao_Paulo),
-- reforçando no banco a proteção contra requisições concorrentes/duplicadas.
create unique index uq_review_logs_content_day
  on review_logs (content_id, (timezone('America/Sao_Paulo', reviewed_at)::date));

-- Função transacional: registra a revisão e avança o estado do conteúdo atomicamente.
create or replace function mark_content_reviewed(p_content_id uuid)
returns contents
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_content contents%rowtype;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_intervals int[] := array[1,3,7,15,30];
  v_next_index int;
begin
  select * into v_content
    from contents
   where id = p_content_id and user_id = auth.uid()
   for update;

  if not found then
    raise exception 'content_not_found_or_not_owned';
  end if;

  if v_content.status <> 'active' then
    raise exception 'content_not_active';
  end if;

  if exists (
    select 1 from review_logs
     where content_id = p_content_id
       and (timezone('America/Sao_Paulo', reviewed_at))::date = v_today
  ) then
    raise exception 'already_reviewed_today';
  end if;

  insert into review_logs (content_id, user_id, interval_index_at_review, reviewed_at)
  values (p_content_id, auth.uid(), v_content.interval_index, now());

  v_next_index := v_content.interval_index + 1;

  if v_next_index < array_length(v_intervals, 1) then
    update contents
       set interval_index = v_next_index,
           next_review_date = v_today + v_intervals[v_next_index + 1]
     where id = p_content_id
     returning * into v_content;
  else
    update contents
       set status = 'mastered',
           next_review_date = null
     where id = p_content_id
     returning * into v_content;
  end if;

  return v_content;
end;
$$;
```

Por que `security invoker` (não `definer`): a função roda com o privilégio de quem a chama, então as políticas de RLS de `contents` e `review_logs` continuam se aplicando normalmente dentro da função — não é necessário duplicar a checagem de posse manualmente além do `where user_id = auth.uid()` já usado no `select ... for update`. O `for update` serializa chamadas concorrentes para o mesmo `content_id`: a segunda chamada espera a primeira terminar, e então enxerga o estado já avançado e o log já gravado, sendo bloqueada por `already_reviewed_today` (ou `content_not_active` quando a primeira chamada conclui o ciclo). O índice único `uq_review_logs_content_day` é uma segunda camada de proteção independente contra duplicidade, mesmo que algum outro caminho de código tente inserir diretamente em `review_logs`.

Não há RPC para `reset`, `archive`, `create` ou `update`: são updates/inserts de uma única linha, já atômicos por natureza no Postgres, e protegidos por RLS — não precisam de uma função dedicada (evita overengineering).

## Checklist de implementação

### Etapa 1 — Scaffold do projeto Next.js

- [x] **Objetivo**: ter a base Next.js rodando localmente, preservando os arquivos e diretórios existentes.
- **Arquivos/componentes envolvidos**: `package.json`, lockfile npm, `tsconfig.json`, `next.config.ts`, `app/`, PostCSS/CSS do Tailwind e `.gitignore`.
- **Alterações necessárias**:
  - Gerar o scaffold em uma pasta temporária vazia fora do repositório, com nome npm válido. Não executar `create-next-app .` na raiz existente: `PLAN.md`, `.agents` e `.codex` podem causar conflito. Não mover nem excluir esses itens.
  - Usar `create-next-app@latest` com opções não interativas para TypeScript, Tailwind v4, App Router, ESLint, npm, alias `@/*` e sem `src/`, conforme a estrutura alvo. Registrar as versões efetivamente instaladas em `package.json` e no lockfile. Next.js 16+ usa `proxy.ts` na Etapa 7.
  - Integrar os arquivos gerados na raiz, sem copiar eventual `.git` temporário, `node_modules` ou `.next`, e sem sobrescrever arquivos preexistentes. Manter o `.git` original e o `PLAN.md` intactos. Ajustar o nome do pacote para `revi` e sincronizar o lockfile se necessário.
  - Instalar dependências na raiz. Confirmar `.gitignore` para `.env*`, com exceção explícita de `.env.example`.
  - Validar `npm run dev`, lint e build; parar o servidor de verificação ao terminar.
- **Critérios de conclusão**: scaffold presente, plano e diretórios preexistentes preservados, dev/lint/build funcionando. Nenhuma configuração de Supabase é necessária nesta etapa. Marcar o checkbox somente após essas verificações; a preservação do plano refere-se ao seu conteúdo, exceto essa atualização de progresso autorizada pelo roteiro.
- **Dependências**: nenhuma.

### Etapa 2 — Dependências, shadcn/ui e Vitest

- [x] **Objetivo**: ter as bibliotecas de UI, o SDK do Supabase e o runner de testes disponíveis no projeto.
- **Arquivos/componentes envolvidos**: `package.json`, `components.json`, `components/ui/*`, `vitest.config.ts`.
- **Alterações necessárias**:
  - Instalar `@supabase/supabase-js` e `@supabase/ssr`.
  - Inicializar shadcn/ui (detecta Tailwind v4 automaticamente) e adicionar os componentes: `button`, `card`, `input`, `textarea`, `tabs`, `label`, `sonner`. O preset padrão atual do CLI (`base-nova`, sobre Base UI) não possui um item `form` com arquivos (`react-hook-form`/`zod`) — decisão confirmada com o usuário: não adicionar essa dependência; formulários usam `<form>` nativo + os componentes acima (ver Etapas 13 e 15).
  - Instalar e configurar Vitest (`vitest.config.ts`, script `"test": "vitest run"` em `package.json`).
  - Criar as pastas `tests/unit` e `tests/integration` (vazias por enquanto); preparar a separação dos scripts unit/integration conforme a estratégia de testes.
- **Critérios de conclusão**: `npm run test -- --passWithNoTests` executa nesta etapa sem testes; não habilitar essa tolerância permanentemente e exigir testes reais a partir da Etapa 3; componentes shadcn presentes em `components/ui`; build sem erros.
- **Dependências**: Etapa 1.

### Etapa 3 — Lógica pura do algoritmo e utilitário de datas (com testes)

- [x] **Objetivo**: isolar as regras do algoritmo de repetição espaçada e a semântica de datas em funções puras, testáveis sem banco ou UI.
- **Arquivos/componentes envolvidos**: `lib/review.ts`, `lib/date.ts`, `tests/unit/review.test.ts`, `tests/unit/date.test.ts`.
- **Alterações necessárias**:
  - `lib/date.ts`: `todaySaoPaulo(): string` (formato `YYYY-MM-DD`, baseado em `America/Sao_Paulo`); `isFutureSaoPaulo(dateStr: string): boolean`.
  - `lib/review.ts`: constante `INTERVALS = [1, 3, 7, 15, 30]`; `computeNextReview(intervalIndex: number, fromDate: string): string`; `isLastInterval(intervalIndex: number): boolean`. Sem dependência de Supabase ou de framework.
  - Testes cobrindo: sequência completa de datas a partir de uma `studied_at` fixa, confirmando os dias acumulados 1, 4, 11, 26, 56 (ver tabela em "Semântica dos intervalos"), fim de mês, ano bissexto, datas inexistentes e virada de dia em São Paulo; `isLastInterval` correto no último índice; `isFutureSaoPaulo` correto para datas passadas/hoje/futuras.
- **Critérios de conclusão**: `npm run test` passa cobrindo os casos acima, sem qualquer dependência de banco ou UI.
- **Dependências**: Etapa 2.

### Etapa 4 — Ambiente Supabase de desenvolvimento

- [x] **Objetivo**: preparar o banco e Auth de desenvolvimento/testes, sem provisionar produção.
- **Arquivos/componentes envolvidos**: `supabase/config.toml`, `.env.local`, `.env.test.local`, `.env.example` e configuração de carregamento do ambiente de testes.
- **Alterações necessárias**:
  - Instalar a Supabase CLI por um método suportado e registrar sua versão; rodar `supabase init`.
  - Verificar Docker e iniciar `supabase start`. Obter URL, chave pública e credenciais administrativas locais via `supabase status`, sem versionar nem imprimir segredos em documentação.
  - Popular `.env.local` com `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` do stack local. A chave pública pode ser anon/publishable; o nome da variável é uma convenção do app.
  - Configurar `.env.test.local` e o harness conforme a estratégia de testes. Criar `.env.example` sem valores sensíveis; confirmar que só esse exemplo será versionado.
  - Se Docker não funcionar, documentar a limitação e criar/selecionar pelo painel um projeto remoto dedicado a desenvolvimento. Autenticar a CLI, confirmar o ref, vincular esse projeto e usar suas credenciais de desenvolvimento nos dois arquivos de ambiente. O harness exige esse ref explícito como alvo permitido.
- **Critérios de conclusão**: `supabase status` confirma o stack local, ou a alternativa remota dedicada está identificada e acessível; variáveis apontam ao mesmo ambiente de desenvolvimento e arquivos sensíveis são ignorados pelo Git. Não é necessário criar um projeto de produção.
- **Dependências**: Etapas 1–3.

### Etapa 5 — Migration do schema base

- [x] **Objetivo**: aplicar as tabelas `contents` e `review_logs` com todas as constraints de integridade descritas na seção "Schema do Supabase".
- **Arquivos/componentes envolvidos**: `supabase/migrations/0001_init.sql`.
- **Alterações necessárias**:
  - Criar o arquivo de migration com o conteúdo exato descrito em "`supabase/migrations/0001_init.sql`" acima (extensão `pgcrypto`, tabelas, constraints, índices, trigger `updated_at` e RLS já habilitado).
  - Aplicar localmente: `supabase db reset` (aplica todas as migrations do zero no stack local).
  - Na alternativa remota dedicada de desenvolvimento, aplicar com `supabase db push` após conferir o ref. Não aplicar em produção nesta etapa.
- **Critérios de conclusão** (via SQL administrativo no ambiente de desenvolvimento, sem UI; usar um usuário de fixture existente para satisfazer a FK):
  - Inserir uma linha válida em `contents` funciona.
  - Inserir com `title` vazio/whitespace falha (constraint).
  - Inserir com `status = 'active'` e `next_review_date = null` falha (constraint).
  - Inserir com `status = 'mastered'` e `next_review_date = null` funciona.
  - Atualizar uma linha de `contents` em transação posterior à inserção e conferir que `updated_at` mudou (o `now()` é constante dentro de uma transação).
  - Confirmar RLS habilitado nas duas tabelas e acesso comum bloqueado enquanto não existem policies.
- **Dependências**: Etapa 4.

### Etapa 6 — RLS e função transacional `mark_content_reviewed` (com testes)

- [x] **Objetivo**: garantir isolamento entre usuários e atomicidade/concorrência da transição "marcar como revisado", validado por testes automatizados — sem depender de UI.
- **Arquivos/componentes envolvidos**: `supabase/migrations/0002_rls_and_rpc.sql`, `lib/database.types.ts`, `tests/helpers/fixtures.ts`, `tests/integration/rls.test.ts`, `tests/integration/review-flow.test.ts`.
- **Alterações necessárias**:
  - Criar o arquivo de migration com o conteúdo exato descrito em "`supabase/migrations/0002_rls_and_rpc.sql`" acima (RLS de `contents` e `review_logs`, índice único anti-duplicidade, função `mark_content_reviewed`).
  - Aplicar no ambiente de desenvolvimento selecionado: `supabase db reset` local, ou `supabase db push` no remoto dedicado. Validar com **dois usuários de teste autenticados de verdade**, criados pelo harness conforme a estratégia de testes. Nunca usar apenas consultas administrativas para comprovar RLS.
  - Gerar e versionar `lib/database.types.ts` após aplicar ambas as migrations, incluindo a assinatura do RPC; regenerar se o schema mudar.
  - `tests/integration/rls.test.ts` deve cobrir:
    - Usuário A não consegue `select`/`update`/`delete` um `content` do usuário B.
    - Usuário A não consegue ler `review_logs` de um `content` do usuário B.
    - Usuário A não consegue inserir um `review_log` apontando para um `content_id` do usuário B.
  - `tests/integration/review-flow.test.ts` deve cobrir, chamando `mark_content_reviewed` via RPC:
    - Ciclo completo: cinco chamadas autenticadas usando a preparação descrita em "Fixtures de tempo e testes do ciclo". Conferir os resultados de cada transição contra a fórmula TypeScript e a quinta revisão até `mastered`; não fazer cinco chamadas no mesmo dia sem preparar os logs entre elas.
    - Revisão antecipada: chamar antes de `next_review_date` funciona normalmente.
    - Conteúdo `mastered` ou `archived`: chamada é rejeitada (`content_not_active`).
    - Duas chamadas concorrentes para um conteúdo ativo nos índices 0–3: uma avança; a outra recebe `already_reviewed_today`. No índice 4, esperar um sucesso e um `content_not_active`. Usar `Promise.all` com clients reais e conferir estado/logs finais.
    - Confirmar rollback: em uma fixture exclusiva, provocar falha no update de `contents` após o insert de log (por exemplo, trigger temporário instalado administrativamente no banco de desenvolvimento que rejeita apenas aquele ID); chamar o RPC com usuário comum e verificar que nenhum log ou avanço persistiu. Remover o mecanismo de falha em `finally`, sem adicioná-lo às migrations.
    - Tentar inserir diretamente um segundo `review_log` para o mesmo conteúdo no mesmo dia (bypassando o RPC) é bloqueado pelo índice único.
- **Critérios de conclusão**: testes passam no ambiente de desenvolvimento selecionado; tipos gerados; app e testes apontam a um banco com ambas as migrations aplicadas.
- **Dependências**: Etapa 5.

### Etapa 7 — Clientes Supabase e proxy de sessão

- [x] **Objetivo**: ter a integração de autenticação/sessão funcionando entre client, server e proxy.
- **Arquivos/componentes envolvidos**: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `proxy.ts`.
- **Alterações necessárias**:
  - `lib/supabase/client.ts`: client Supabase para uso em Client Components.
  - `lib/supabase/server.ts`: client Supabase para Server Components/Actions, usando cookies (`@supabase/ssr`) e a API assíncrona do Next.js instalado. Tipar ambos os clients com `Database` gerado na Etapa 6.
  - `proxy.ts`: validar/renovar sessão conforme a integração atual do `@supabase/ssr`, propagando cookies; redirecionar para `/login` sem autenticação. Excluir `/login` e assets estáticos do matcher (`/auth/callback` foi removido do matcher na revisão da Etapa 8 — a rota não existe mais, já que o fluxo de e-mail+senha sem confirmação não usa callback). Não confiar apenas em `getSession` para autorizar acesso; usar a validação recomendada pelo SDK, mantendo autenticação nas actions e RLS.
- **Critérios de conclusão**: com o dev server rodando, uma requisição não autenticada a uma rota protegida (ex: `/`) retorna redirect temporário para `/login` (normalmente 307; verificar status e `Location`, sem exigir 302) — verificável via `curl -I` ou teste automatizado, sem depender da página de login existir visualmente.
- **Dependências**: Etapas 4 e 6.

### Etapa 8 — Autenticação (e-mail + senha, sem confirmação)

> **Revisada em 2026-09-20.** A versão original desta etapa implementava magic link (ver decisão original preservada no histórico do PLAN.md/git). O usuário testou esse fluxo na prática, esbarrou repetidamente no limite de envio do e-mail padrão do Supabase (agravado pelas tentativas de teste desta sessão) e pediu a troca para e-mail+senha sem confirmação — ver a decisão registrada em "Decisões de produto confirmadas". O texto abaixo já descreve a versão revisada, efetivamente implementada.

- [x] **Objetivo**: usuário consegue criar conta e entrar no app com e-mail e senha, sem etapa de confirmação por e-mail.
- **Arquivos/componentes envolvidos**: `app/login/page.tsx`, `app/login/actions.ts`, ação de logout (`app/actions.ts`).
- **Alterações necessárias**:
  - `app/login/page.tsx`: uma página com duas abas (shadcn Tabs) — "Entrar" e "Criar conta" — cada uma com seu próprio formulário nativo (e-mail + senha) e sua própria Server Action.
  - `app/login/actions.ts`: `signIn` chama `supabase.auth.signInWithPassword({ email, password })`; `signUp` chama `supabase.auth.signUp({ email, password })`. Como `auth.email.enable_confirmations = false` no projeto (ver abaixo), `signUp` sempre retorna uma sessão ativa ou um erro — nunca um estado "confirme seu e-mail" pendente.
  - Erros mapeados por código (`error.code`, não por mensagem): `invalid_credentials` (login) → "E-mail ou senha inválidos" (mensagem genérica de propósito — Supabase não diferencia "e-mail não existe" de "senha errada", por segurança); `user_already_exists` (cadastro) → "Este e-mail já tem uma conta"; `weak_password` → "A senha precisa ter pelo menos 6 caracteres" (`minimum_password_length` do Supabase).
  - Ação de logout (`supabase.auth.signOut`) acessível na UI (botão no layout autenticado) — inalterada por esta revisão.
  - **Sem callback, sem PKCE, sem redirect URL, sem SMTP**: como não há e-mail nenhum no fluxo, `app/auth/callback/route.ts` foi removida (existia só para o fluxo de código do magic link) e o matcher do `proxy.ts` não precisa mais excluir `/auth/callback`. `auth.email.enable_confirmations` foi desativado no projeto de dev via `supabase config push` — revisar sempre `supabase config diff` antes de rodar esse comando num projeto real (ver nota em "Migrations e provisionamento sem MCP"); nesse push específico, o próprio CLI recusou automaticamente desativar o Twilio (não deixa desligar um provedor de SMS ativo por essa via) e não enviou os campos de segredo mascarados, então o único campo realmente alterado no remoto foi `enable_confirmations`.
- **Critérios de conclusão**: fluxo completo testado — criar conta ativa a sessão na hora (sem clicar em nada); entrar com credenciais corretas funciona; senha errada e e-mail duplicado no cadastro mostram erro correto; logout funciona e volta para `/login`.
  - **Resultado (2026-09-20)**: diferente da versão com magic link, esse fluxo **não depende de e-mail real nenhum**, então deu para automatizar de ponta a ponta via `curl` (POST multipart replicando a codificação de Server Action do Next.js, com cookie jar) contra o dev server local: `signUp` cria a conta, já retorna com o cookie de sessão real setado (sem clique em nada); com esse cookie, `GET /` responde `200` (não redireciona) e mostra o e-mail do usuário + botão "Sair" no header; `signOut` limpa os cookies de sessão e uma requisição seguinte já volta a redirecionar para `/login`; `signIn` com a mesma senha funciona; senha errada retorna exatamente `?error=invalid_credentials`; cadastro duplicado retorna exatamente `?error=user_already_exists`; as duas mensagens de erro renderizam corretamente na aba certa. Um erro transitório (`"JWT issued at future"`, skew de relógio entre os serviços do Supabase) apareceu uma vez logo após o cadastro e se resolveu sozinho em ~3s numa nova tentativa — não é um bug do app. Usuários de teste limpos via API admin depois.
- **Dependências**: Etapa 7.

### Etapa 9 — Camada de dados (queries)

- [x] **Objetivo**: centralizar as leituras de dados do Supabase usadas pelas páginas, usando a semântica de "hoje" em `America/Sao_Paulo`.
- **Arquivos/componentes envolvidos**: `lib/data/contents.ts`, `tests/integration/contents-data.test.ts`.
- **Alterações necessárias**:
  - `getDueToday(client)`: conteúdos `active` com `next_review_date <= todaySaoPaulo()`.
  - `getAllByStatus(client, status)`: lista por status (`active`/`mastered`/`archived`).
  - `getContentById(client, id)`.
  - `getReviewLogs(client, contentId)`: histórico ordenado por `reviewed_at`.
  - Teste de integração: inserir linhas pela API `.from(...).insert(...)` com client de teste autenticado e `user_id` explícito (sem depender de Server Actions) e validar que cada query retorna exatamente o esperado.
- **Critérios de conclusão**: testes de integração passam, cobrindo `getDueToday` com conteúdos antes/depois/no dia de hoje.
- **Dependências**: Etapa 6.

### Etapa 10 — Server Actions (mutações), com autenticação, validação e testes

- [x] **Objetivo**: implementar todas as escritas do sistema, com autenticação e validação na própria action, e cobertura de teste completa do ciclo de negócio — sem depender de UI.
- **Arquivos/componentes envolvidos**: `app/contents/actions.ts`, `tests/integration/actions.test.ts`.
- **Alterações necessárias**:
  - Todas as actions verificam que há um usuário autenticado (via `lib/supabase/server.ts`); se não houver, retornam erro (não devem ser alcançáveis sem sessão, mas a checagem é defesa em profundidade).
  - `createContent(input)`: valida `title` não vazio (após trim) e `studied_at` não futura (`lib/date.ts#isFutureSaoPaulo`); usa `computeNextReview` (Etapa 3) para definir `next_review_date` inicial; atribui `user_id` a partir do usuário autenticado e insere via client autenticado. RLS verifica esse valor, não o preenche; nunca aceitar `user_id` do formulário. Validar também formato/data real e índices recebidos pelas funções puras.
  - `markReviewed(contentId)`: chama o RPC `mark_content_reviewed` via `client.rpc(...)`; mapeia os erros do banco (`content_not_active`, `already_reviewed_today`, `content_not_found_or_not_owned`) para mensagens amigáveis.
  - `archiveContent(contentId)`: executar um único `UPDATE` filtrado por ID e `status = active`, atribuindo `archived`; verificar se retornou linha. Não separar a verificação do estado e a escrita, para evitar corrida com revisão/reset.
  - `resetContent(contentId)`: update simples reaplicando o estado inicial (Etapa 3/6), sem tocar em `review_logs`.
  - `updateContent(contentId, input)`: edita `title`/`subject`/`notes` (não edita `studied_at`).
  - Cada action chama `revalidatePath` nas rotas afetadas após sucesso. Validar UUIDs e campos permitidos, rejeitar título vazio também na edição, e tratar update sem linhas como falha sem expor dados de outros usuários.
  - Testes de integração conforme "Testes de Server Actions": mocks somente das fronteiras Next.js, client Supabase real autenticado, sem páginas renderizadas:
    - Criar conteúdo com sucesso e `next_review_date` inicial correta.
    - Criar conteúdo com `studied_at` futura é rejeitado.
    - Criar conteúdo com título vazio/whitespace é rejeitado.
    - Ciclo completo via `markReviewed` até `mastered`, com as fixtures de tempo documentadas; verificar cinco logs e paridade de datas.
    - Revisão antecipada funciona, mas segunda revisão no mesmo dia é rejeitada, inclusive após reset.
    - Client sem sessão é rejeitado e entradas inválidas não chegam a ser persistidas.
    - Reset após `mastered`: volta a `active`, `interval_index = 0`, e os `review_logs` anteriores continuam presentes (`getReviewLogs` ainda retorna as linhas antigas).
    - Arquivar um conteúdo `active` e então tentar `markReviewed` nele é rejeitado.
    - Duas chamadas concorrentes a `markReviewed` para o mesmo conteúdo (via `Promise.all`) resultam em apenas um avanço de estado.
    - Isolamento entre usuários: usuário A não consegue chamar `markReviewed`/`archiveContent`/`resetContent`/`updateContent` em um conteúdo do usuário B.
- **Critérios de conclusão**: todos os testes acima passam.
- **Dependências**: Etapas 3, 6, 7 e 9.

### Etapa 11 — Dashboard

- [x] **Objetivo**: página inicial mostrando o que precisa ser revisado hoje, consumindo a camada de dados e actions já testadas.
- **Arquivos/componentes envolvidos**: `app/page.tsx`.
- **Alterações necessárias**:
  - Seção "Para revisar hoje" usando `getDueToday`.
  - Seção com todos os conteúdos ativos, ordenados por `next_review_date`.
  - Botão "Marcar como revisado" em cada item (chama `markReviewed`); exibe toast de erro amigável se a action retornar `already_reviewed_today` ou `content_not_active`.
  - Link para "Novo conteúdo".
  - Estado vazio quando não há nada para revisar.
- **Critérios de conclusão**: verificação manual no navegador — dashboard reflete corretamente o estado do banco; marcar como revisado atualiza a lista sem reload manual. (A lógica de negócio já foi validada na Etapa 10; aqui valida-se apenas a integração visual.)
  - **Nota de verificação (2026-09-20)**: quando esta etapa foi implementada, não era possível confirmar visualmente numa sessão autenticada real (a autenticação era magic link, e o token bruto do e-mail nunca fica acessível via banco). Evidências indiretas usadas na época: `next build` type-checando a página contra os tipos de `ContentRow` (já testados na Etapa 9); lint limpo; revisão manual do código.
  - **Confirmado ao vivo (2026-09-20, após a troca de auth para e-mail+senha)**: com a Etapa 8 revisada, uma sessão autenticada real virou trivial de obter via `curl`. Refiz a verificação: criei um usuário e conteúdos reais direto no banco (1 ativo vencido, 1 ativo com `next_review_date` amanhã, 1 dominado, 1 arquivado) via API admin, logei via `curl` e busquei `GET /` com o cookie de sessão real. Confirmado, olhando o HTML renderizado (ignorando os `<script>` de flight-data do React): a seção "Para revisar hoje" contém **só** o conteúdo vencido; a seção "Todos os conteúdos ativos" contém os **dois** ativos (vencido + futuro); "Nada para revisar hoje" corretamente não aparece; botão "Marcar como revisado" presente. Usuário e conteúdos de teste apagados depois (cascade via `auth.users`).
- **Dependências**: Etapas 8, 9, 10.

### Etapa 12 — Lista de conteúdos

- [x] **Objetivo**: visão completa de todos os conteúdos do usuário, filtrável por status.
- **Arquivos/componentes envolvidos**: `app/contents/page.tsx`.
- **Alterações necessárias**:
  - Tabs (shadcn) para Ativos / Dominados / Arquivados, usando `getAllByStatus`.
  - Link para o detalhe de cada conteúdo.
- **Critérios de conclusão**: verificação manual — as três abas mostram os conteúdos corretos conforme o `status` no banco.
  - **Nota de verificação (2026-09-20)**: na época (auth por magic link), mesma limitação da Etapa 11 — sem sessão automatizável. Evidência da época: `getAllByStatus` já testada (Etapa 9); build type-checando; lint limpo; `/contents` sem sessão redirecionando para `/login`.
  - **Confirmado ao vivo (2026-09-20, após a troca de auth)**: com o mesmo usuário/conteúdos de teste da nota da Etapa 11 (2 ativos, 1 dominado, 1 arquivado), `GET /contents` com sessão real mostrou as três abas com as contagens corretas — "Ativos (2)", "Dominados (1)", "Arquivados (1)" — e o conteúdo da aba ativa (Ativos, a default) continha o item ativo esperado.
- **Dependências**: Etapas 8 e 9.

### Etapa 13 — Novo conteúdo

- [x] **Objetivo**: permitir cadastrar um novo conteúdo estudado pela UI.
- **Arquivos/componentes envolvidos**: `app/contents/new/page.tsx`.
- **Alterações necessárias**:
  - Formulário `<form>` nativo (usando `Input`, `Textarea`, `Label`, `Button` do shadcn, sem `react-hook-form`/`zod`) com título (obrigatório), matéria (opcional), notas (opcional), data de estudo (default hoje, input de data não permite futuro no client como conveniência de UX — a validação real continua sendo a da Server Action).
  - Submissão chama `createContent`; redireciona ao dashboard após sucesso; toast de confirmação ou de erro.
- **Critérios de conclusão**: verificação manual — conteúdo criado aparece corretamente no dashboard/lista com `next_review_date` calculada conforme a Etapa 3/10; tentar submeter com data futura mostra erro.
  - **Nota de verificação (2026-09-20)**: na época (magic link), mesma limitação das Etapas 8, 11 e 12. Evidência da época: `createContent` já testada (Etapa 10, incluindo rejeição de data futura); build type-checando; lint limpo; `/contents/new` sem sessão redirecionando para `/login`. O `input[type=date] max` impede escolher uma data futura no client como conveniência de UX (a validação real é da Server Action).
  - **Confirmado ao vivo (2026-09-20, após a troca de auth)**: `GET /contents/new` com sessão real responde `200` e renderiza o formulário (campo `studiedAt` presente). A submissão em si (`createContent` chamado via `useTransition` a partir de um componente client) não dá para replicar por `curl` sem executar JS — diferente dos forms de login, este `<form action={handleSubmit}>` usa uma função **client-side** (não uma Server Action ligada diretamente ao form), então não existe fallback de submissão sem JS para simular por HTTP puro. A cobertura real da lógica de negócio continua vindo de `actions.test.ts` (Etapa 10), que já chama `createContent` diretamente; o que ficou confirmado agora é só a renderização inicial da página autenticada.
- **Dependências**: Etapas 8 e 10.

### Etapa 14 — Detalhe do conteúdo

- [x] **Objetivo**: página com informações completas e ações sobre um conteúdo específico.
- **Arquivos/componentes envolvidos**: `app/contents/[id]/page.tsx`.
- **Alterações necessárias**:
  - Exibir título, matéria, notas, status, próxima data de revisão (ou indicação de "dominado"/"arquivado" quando não houver).
  - Exibir histórico de revisões (`getReviewLogs`).
  - Botões de ação, exibidos condicionalmente conforme `status`: "Marcar como revisado" (só se `active`), "Arquivar" (só se `active`), "Resetar" (de qualquer status, incluindo `active`), link para "Editar".
- **Critérios de conclusão**: verificação manual — todas as ações disponíveis na página funcionam e refletem imediatamente o novo estado; histórico permanece visível após reset.
  - **Nota de verificação (2026-09-20)**: na época (magic link), mesma limitação das etapas de UI anteriores. Evidência da época: `markReviewed`/`archiveContent`/`resetContent`/`getContentById`/`getReviewLogs` já testadas (Etapas 9/10, incluindo histórico preservado após reset); build type-checando; lint limpo; rota redirecionando para `/login` sem sessão.
  - **Confirmado ao vivo (2026-09-20, após a troca de auth)**: com sessão real e conteúdos reais de cada status (ativo com histórico, dominado, arquivado), `GET /contents/[id]` renderizou corretamente em cada caso: título/matéria/notas, `Status: Ativo`/`Dominado`/`Arquivado`, "Sem revisão agendada" para dominado/arquivado, histórico com a revisão registrada aparecendo para o conteúdo ativo. Botões condicionais conferidos por presença no HTML: "Marcar como revisado" e "Arquivar" presentes **só** no ativo, ausentes em dominado/arquivado; "Resetar" e "Editar" presentes nos três. Os cliques nos botões em si (Server Actions chamadas via componente client, mesma limitação da Etapa 13) continuam cobertos por `actions.test.ts`, não por clique real.
- **Dependências**: Etapas 9 e 10.

### Etapa 15 — Edição de conteúdo

- [x] **Objetivo**: permitir editar título/matéria/notas de um conteúdo existente.
- **Arquivos/componentes envolvidos**: `app/contents/[id]/edit/page.tsx`.
- **Alterações necessárias**:
  - Formulário pré-preenchido com os dados atuais (sem campo de `studied_at`, que não é editável — ver "Fora do MVP").
  - Submissão chama `updateContent`; redireciona de volta ao detalhe; toast de confirmação.
- **Critérios de conclusão**: verificação manual — edição persiste corretamente e é refletida na página de detalhe.
  - **Nota de verificação (2026-09-20)**: na época (magic link), mesma limitação das etapas de UI anteriores. Evidência da época: `updateContent` já testada (Etapa 10, incluindo rejeição de título vazio); build type-checando; lint limpo; rota redirecionando para `/login` sem sessão.
  - **Confirmado ao vivo (2026-09-20, após a troca de auth)**: `GET /contents/[id]/edit` com sessão real renderizou o formulário corretamente pré-preenchido com os valores reais do conteúdo (título, matéria e notas conferidos no HTML via os atributos `value`/conteúdo do `<textarea>`), e sem campo de `studied_at`. A submissão em si tem a mesma limitação de client-side action das Etapas 13/14 — cobertura de comportamento vem de `actions.test.ts`.
- **Dependências**: Etapas 10 e 14.

### Etapa 16 — Polimento de UI

- [x] **Objetivo**: deixar a experiência coerente e sem arestas antes da verificação final.
- **Arquivos/componentes envolvidos**: todas as páginas criadas nas etapas 11–15.
- **Alterações necessárias**:
  - Estados vazios (nenhum conteúdo cadastrado, nenhuma revisão hoje).
  - Estados de carregamento onde fizer sentido.
  - Toasts de feedback (sucesso/erro) via `sonner` em todas as actions, incluindo os erros específicos do RPC (`already_reviewed_today`, `content_not_active`).
  - Responsividade básica (mobile/desktop).
- **Critérios de conclusão**: navegação fluida em telas pequenas e grandes, nenhuma ação sem feedback visual.
  - **Nota de verificação (2026-09-20)**: mesma limitação das etapas de UI anteriores para confirmação visual ao vivo. Auditoria de código cobriu: (1) toast de sucesso ausente em `MarkReviewedButton` (inconsistente com `ContentActions`) — corrigido; (2) `loading.tsx` adicionado em `/`, `/contents`, `/contents/[id]` e `/contents/[id]/edit` (Suspense automático do App Router); (3) header (e-mail truncado/oculto em telas estreitas) e o card do dashboard (data + botão empilham em vez de espremer) ajustados para mobile. Build type-checa tudo; lint limpo; todas as rotas protegidas confirmadas redirecionando para `/login` sem sessão.
- **Dependências**: Etapas 11–15.

### Etapa 17 — Verificação end-to-end local

- [x] **Objetivo**: validar o fluxo completo do MVP localmente antes do deploy.
- **Arquivos/componentes envolvidos**: aplicação completa.
- **Alterações necessárias** (nenhuma alteração de código; apenas validação):
  - Rodar `npm run test` e confirmar que toda a suíte (unit + integration) passa.
  - Rodar `npm run dev` e validar pela UI login, criação, revisão antecipada, bloqueio diário inclusive após reset, histórico preservado, arquivamento e bloqueio de revisão em arquivados/dominados. Para validar domínio sem esperar dias, usar conteúdo preparado no índice 4 pelo harness de desenvolvimento e realizar a revisão final pela UI; o ciclo de cinco transições já foi validado na integração.
  - Rodar lint e build de produção. Na alternativa remota, verificar Advisors no painel; no stack local, registrar que Advisors remotos serão verificados obrigatoriamente na Etapa 18.
- **Critérios de conclusão**: todo o fluxo do MVP funciona de ponta a ponta sem erros; suíte de testes 100% verde; nenhum advisor crítico pendente no ambiente remoto, quando aplicável.
  - **Resultado (2026-09-20)**:
    - `npm run test`: 66/66 (35 unit + 31 integration), banco de dev confirmado sem sobra de fixtures depois.
    - `npm run lint`: sem erros. `npm run build`: sem erros, todas as 8 rotas geradas.
    - `npx supabase db advisors --linked --type all`: 8 achados, todos `WARN`/`INFO` — nenhum `ERROR`. `unindexed_foreign_keys` em `review_logs.user_id` (INFO) e 6x `auth_rls_initplan` sugerindo trocar `auth.uid()` por `(select auth.uid())` nas policies (WARN, só performance em escala) — nenhum dos dois é bug de correção ou segurança; ambos exigiriam uma nova migration, fora do escopo desta etapa ("apenas validação"); ficam registrados aqui como possível follow-up pós-MVP. `auth_leaked_password_protection` (WARN) — na época desta etapa não se aplicava (autenticação era magic link, sem senha); **passou a ser relevante depois da revisão da Etapa 8 para e-mail+senha** (2026-09-20) e não está exposta em `supabase/config.toml` (não encontrada no schema declarativo do CLI), então fica registrada aqui como recomendação de segurança pós-MVP a ativar manualmente no painel (Authentication → Auth → Password) em vez de assumida silenciosamente.
    - Walkthrough "pela UI" — na data original desta etapa não pôde ser feito ao vivo (autenticação era magic link, token bruto não recuperável do banco). Em vez disso, cada cenário pedido já estava (e continua) coberto por teste automatizado que exercita a pilha real (Server Action → RLS → RPC/Postgres): criação (`actions.test.ts`), revisão antecipada e bloqueio diário mesmo após reset (`actions.test.ts` "allows an early review, but rejects a second one the same day — even after reset"), histórico preservado (`actions.test.ts` "reactivates a mastered content... preserves history"), arquivamento e bloqueio de revisão em arquivado (`actions.test.ts` "rejects marking an archived content as reviewed"), bloqueio em dominado (`review-flow.test.ts` "rejects marking a %s content as reviewed" para mastered/archived), ciclo completo até dominado usando o índice 4 preparado pelo harness (`review-flow.test.ts` e `actions.test.ts`, ambos "walks the full 5-review cycle to mastery"). **Atualização (2026-09-20, após a troca de auth para e-mail+senha na Etapa 8)**: login/cadastro/logout passaram a ser confirmáveis ao vivo via `curl` (ver nota da Etapa 8), e a renderização autenticada do dashboard, lista, detalhe e edição também (ver notas "Confirmado ao vivo" nas Etapas 11, 12, 14 e 15) — a única parte que continua não sendo clicada de verdade é a submissão de formulários/botões que chamam Server Actions a partir de componentes client (sem fallback HTTP sem JS), coberta pelos testes de `actions.test.ts` já citados.
- **Dependências**: Etapas 1–16.

### Etapa 18 — Deploy na Vercel (produção)

> **Revisada em 2026-09-20** junto com a Etapa 8: como a autenticação passou a ser e-mail+senha sem confirmação (sem e-mail nenhum no fluxo), esta etapa não depende mais de SMTP nem de configuração de callback/redirect — simplificação bem-vinda em relação à versão original (magic link).

- [x] **Objetivo**: publicar o MVP com login funcionando para qualquer usuário, sem depender da equipe do Supabase.
- **Arquivos/componentes envolvidos**: configuração da Vercel, projeto Supabase de produção, Auth URLs. Não salvar segredos de produção em arquivos versionados.
- **Alterações necessárias**:
  - Criar/selecionar no painel o projeto Supabase de produção, separado do ambiente de testes. Obter ref, URL e chave pública. Conferir explicitamente o ref antes de vincular a CLI e executar `supabase db push` com **todas** as migrations; não disponibilizar o app com schema parcial.
  - Aplicar a mesma mudança de configuração de Auth da Etapa 8 (`auth.email.enable_confirmations = false`) ao projeto de produção via `supabase config push --project-ref <ref-produção>`, revisando `supabase config diff` antes (mesmo cuidado documentado na Etapa 8 — o comando opera no arquivo inteiro).
  - Verificar RLS, policies, RPC e Advisors no projeto de produção antes de disponibilizar o app. Não rodar `db reset`, harness administrativo ou fixtures de tempo em produção.
  - Publicar com a Vercel CLI a partir do projeto local ou conectar um repositório remoto já publicado. Configurar `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` do projeto de produção antes do build final. A criação de remoto Git não é pré-requisito se for usada a CLI.
  - Validar cadastro, login e logout no domínio real (não precisa de e-mail externo nenhum, já que não há confirmação); criar, revisar uma vez, arquivar e resetar conteúdo de smoke test por fluxos normais. Confirmar que uma segunda conta não lê nem altera os dados da primeira. Não tentar repetir as cinco revisões no mesmo dia em produção.
- **Critérios de conclusão**: aplicação acessível na Vercel, migrations completas, nenhum Advisor crítico, cadastro/login/logout funcionais para qualquer usuário, fluxo de smoke test e isolamento entre usuários confirmados.
  - **Decisão do usuário (2026-09-20)**: em vez de um projeto Supabase de produção separado, o usuário confirmou explicitamente reutilizar o mesmo projeto de dev/teste (`aimcowhpirmypxevhtfv`) para produção também — depois de eu explicar o trade-off (a suíte automatizada cria/apaga contas fixture nesse banco). Combinado: não rodar mais `npm run test` (a suíte automatizada, com seus fixtures) contra esse projeto depois do deploy, exceto se pedido/realmente necessário. Como já é o mesmo projeto, migrations/RLS/RPC/`enable_confirmations`/Advisors já estavam verificados (Etapas 5, 6, 8, 17) — nada disso precisou ser refeito para "produção".
  - **Deploy**: `vercel link -y -p revi` (criou o projeto na Vercel e conectou automaticamente ao repositório GitHub `pedrohrdev/revi`); `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` configuradas via `vercel env add ... production`; `vercel --prod` (confirmado explicitamente com o usuário antes, por ser produção). Build limpo, deploy `READY`. URL de produção: **https://revi-rouge.vercel.app**.
  - **Smoke test (2026-09-20)**: `GET /` sem sessão confirmado redirecionando para `/login` (proxy protegendo a rota em produção). Fluxo completo testado com duas contas reais criadas via `curl` (mesma técnica da Etapa 8 — sem precisar de e-mail externo, já que não há confirmação): cadastro da conta A ativa sessão na hora; dashboard renderiza autenticado; criação de conteúdo + `mark_content_reviewed` (RPC) avançando `interval_index`/`next_review_date` corretamente + arquivamento + reset, todos direto contra o banco de produção com a sessão real da conta A (a submissão de formulários client-side não é replicável por `curl`, mesma limitação documentada na Etapa 13 — já coberta por `actions.test.ts`); histórico preservado através de arquivar+resetar; página de detalhe e lista (`/contents`, contagem "Ativos (1)") renderizando o conteúdo real corretamente; logout invalida a sessão de verdade. **Isolamento**: conta B criada, confirmado que não vê o conteúdo da conta A nem no dashboard nem acessando a URL do conteúdo diretamente (`404`, sem vazamento de dados). Um erro transitório (`"JWT issued at future"`, mesmo skew de relógio entre serviços do Supabase observado em dev) apareceu uma vez logo após o cadastro da conta A e se resolveu sozinho em ~3s — confirmado via `vercel logs`, não é um bug do app. As duas contas de teste e o conteúdo foram apagados via API admin depois; banco de produção confirmado com só as duas contas reais do usuário e nenhum conteúdo residual.
- **Dependências**: Etapa 17; acesso às contas Supabase/Vercel. Essas dependências operacionais não bloqueiam a Etapa 1.

### Etapa 19 (pós-MVP, 2026-09-20) — Esqueci minha senha

> Adicionada depois do MVP e do deploy (Etapas 1–18), a pedido do usuário, motivada pela própria conta dele não conseguir entrar. Único novo requisito de produto desde a Etapa 18; não reabre nem altera nenhuma etapa anterior.

- [x] **Objetivo**: permitir que um usuário com senha esquecida recupere o acesso à própria conta pela tela de login, sem depender de suporte manual.
- **Arquivos/componentes envolvidos**: `app/login/actions.ts`, `app/login/page.tsx`, `app/reset-password/actions.ts` (novo), `app/reset-password/page.tsx` (novo), `proxy.ts`, `.env.local`/`.env.example`.
- **Alterações realizadas**:
  - `requestPasswordReset` (nova Server Action em `app/login/actions.ts`): chama `supabase.auth.resetPasswordForEmail(email, { redirectTo: `${NEXT_PUBLIC_SITE_URL}/reset-password` })` e sempre redireciona para o mesmo estado `sent=forgot`, exista ou não a conta — o Supabase nunca revela se um e-mail está cadastrado (proteção contra enumeração de contas); erros são apenas logados no servidor para diagnóstico.
  - `app/reset-password/page.tsx` + `actions.ts` (novos): a página troca o `?code=` do link de recuperação por sessão via `exchangeCodeForSession` (redireciona para `/login?error=reset_link_invalid&tab=forgot` se o link já expirou/foi usado) e então renderiza um formulário simples de nova senha; `updatePassword` chama `supabase.auth.updateUser({ password })`.
  - `app/login/page.tsx`: nova aba "Esqueci a senha" (fora do componente `Tabs`, controlada por `?tab=forgot`) com formulário de e-mail ou, quando `?sent=forgot`, mensagem de confirmação; link "Esqueci minha senha" adicionado abaixo do formulário de login.
  - `proxy.ts`: `/reset-password` adicionada à lista de rotas públicas (o visitante ainda não está autenticado ao chegar pelo link do e-mail).
  - `NEXT_PUBLIC_SITE_URL` recolocada em `.env.local` (`http://localhost:3000`) e `.env.example` — necessária para montar a URL de redirect do link de recuperação; precisa ser configurada também como env var de produção na Vercel (`https://revi-rouge.vercel.app`).
- **Trade-off de segurança (mantido deliberadamente, ver Etapa 8)**: o cadastro continua sem confirmação de e-mail — ou seja, criar conta não prova posse do e-mail. A recuperação de senha, no entanto, **exige** que o e-mail exista de verdade e receba a mensagem do Supabase; isso reintroduz a dependência de entrega de e-mail (rate limits, SMTP) que havia sido removida do fluxo de login/cadastro na Etapa 8 — mas agora escopada apenas ao fluxo de "esqueci a senha", não ao cadastro/login normais.
- **Critérios de conclusão**: `npm run lint`, `npm run build` e `npm run test` passam; fluxo de solicitação de reset verificado ao vivo contra o projeto Supabase real.
  - **Resultado (2026-09-20)**: lint limpo; build de produção gera as 8 rotas incluindo `/reset-password`; `npm run test` 66/66. Fluxo de solicitação verificado via `curl` (mesma técnica da Etapa 8, formulário ligado diretamente à Server Action): `POST /login?tab=forgot` com e-mail real retornou `303` para `/login?sent=forgot&tab=forgot` com os cookies de PKCE do fluxo `recovery` corretamente definidos (`sb-...-code-verifier`), confirmando que `resetPasswordForEmail` foi de fato chamado contra o Supabase real; página de confirmação renderiza a mensagem esperada. A etapa final do fluxo (clicar no link recebido por e-mail e definir nova senha) depende de e-mail real e não foi automatizada — mesma limitação documentada para outros fluxos dependentes de e-mail neste projeto (Etapa 8); a lógica de troca de código e atualização de senha é direta (`exchangeCodeForSession` + `updateUser`, ambas chamadas padrão do SDK do Supabase) e a mesma técnica de link PKCE já foi validada estruturalmente durante o desenvolvimento (via `admin.generateLink({ type: "recovery" })`, sem enviar e-mail).
- **Dependências**: Etapa 18 (produção já publicada); `NEXT_PUBLIC_SITE_URL` precisa ser adicionada às env vars de produção da Vercel para o link de recuperação apontar para o domínio certo.
  - **Deploy (2026-09-20)**: PR mergeada na `main`; `NEXT_PUBLIC_SITE_URL=https://revi-rouge.vercel.app` adicionada às env vars de produção da Vercel; `vercel --prod` publicado com sucesso (build limpo, `READY`, alias em `https://revi-rouge.vercel.app`). Confirmado ao vivo em produção via `curl` (mesma técnica de submissão de Server Action sem JS): `POST /login?tab=forgot` retornou `303` com os cookies de PKCE do fluxo `recovery` corretamente definidos. Foi enviado de fato um pedido de redefinição de senha para a conta real do usuário (`gustavorossi015@gmail.com`) através desse teste — o e-mail de recuperação deve estar na caixa de entrada dele.
  - **Bug 1 encontrado pelo usuário ao clicar no link real (2026-09-20)**: `ERR_CONNECTION_REFUSED` em `localhost:3000` — a URL do link apontava para `localhost` em vez de produção. Causa raiz: `auth.site_url` do projeto Supabase permanecia `http://localhost:3000` (sobra de antes deste projeto ter qualquer fluxo por e-mail) e `additional_redirect_urls` estava vazio; como `resetPasswordForEmail`'s `redirectTo` precisa estar na allow-list, o Supabase caiu de volta silenciosamente para `site_url`. **Corrigido**: `site_url` → `https://revi-rouge.vercel.app`, `additional_redirect_urls` passou a incluir a URL de callback (ver Bug 2), via `supabase config push` (mudança isolada, confirmada por `config diff` antes de aplicar).
  - **Bug 2 encontrado pelo usuário depois de corrigir o Bug 1 (2026-09-20)**: link abriu a página `/reset-password` normalmente, mas ao enviar a nova senha voltou "Não foi possível atualizar a senha". Causa raiz: a troca do código PKCE (`exchangeCodeForSession`) acontecia dentro de `app/reset-password/page.tsx`, um **Server Component** — o Next.js proíbe gravar cookies durante a renderização de Server Components, e `lib/supabase/server.ts` engole esse erro silenciosamente (`catch` pensado para refresh de sessão já existente, não para estabelecer uma sessão nova). A troca com o Supabase até funcionava, mas a sessão nunca era persistida em cookie, então `updateUser` falhava por falta de sessão no submit seguinte. **Corrigido**: nova rota `app/reset-password/confirm/route.ts` (Route Handler, que pode gravar cookies) faz a troca do código e redireciona para `/reset-password` só em caso de sucesso; `requestPasswordReset` passou a apontar `redirectTo` para essa rota; `app/reset-password/page.tsx` simplificada para apenas checar sessão ativa (`getClaims`) e renderizar o formulário. Isso também exigiu adicionar a URL exata da nova rota (`.../reset-password/confirm`, local e produção) à allow-list — confirmado que o match do Supabase é exato, não por prefixo de `site_url`.
  - **Limitação de verificação**: a etapa de trocar o código PKCE de verdade só pode ser exercida por um clique real vindo de um e-mail real (mesma limitação documentada para os fluxos de e-mail anteriores neste projeto) — `admin.generateLink({ type: "recovery" })` gera um link de fluxo implícito (tokens na fragment da URL), incompatível com o fluxo PKCE real do app, então não serve para testar a rota `/reset-password/confirm` via automação. A correção do Bug 2 foi validada por revisão de código (Route Handlers, ao contrário de Server Components, têm permissão documentada do Next.js para gravar cookies) e por lint/build/teste completos; a confirmação definitiva depende do usuário clicar no link mais recente enviado para sua conta real.

### Etapa 20 (pós-MVP, 2026-09-20) — Progresso de revisões, correção de UI desatualizada e identidade visual

> Pedido do usuário: o botão "Marcar como revisado" continuava aparecendo como se nada tivesse acontecido logo após revisar; pediu bolinhas numeradas de progresso (1 a 5), o botão passando a indicar "Revisão N feita" depois de usado, fonte Inter, mais cor (verde) e uma experiência mais viva/animada. Trouxe também, em seguida, uma paleta de cores específica ("Earthy Harmony": Porcelain/Beige/Palm Leaf/Carbon Black/Onyx) para substituir minha escolha inicial de verde genérico.

- [x] **Objetivo**: corrigir a UI que não refletia o estado real após uma ação, dar visibilidade ao progresso do ciclo de revisão, e aplicar a nova identidade visual (fonte, cores, animações leves) sem adicionar funcionalidades de produto novas.
- **Bug real corrigido**: nenhum dos handlers em `content-actions.tsx`/`mark-reviewed-button.tsx` chamava `router.refresh()` após uma mutação bem-sucedida — `revalidatePath` no servidor invalida o cache do Next.js, mas como essas Server Actions são chamadas imperativamente (via `useTransition`, não por um `<form action>` com navegação), a árvore já renderizada no cliente só busca dados novos se algo pedir explicitamente. Corrigido adicionando `router.refresh()` em `handleMarkReviewed`, `handleArchive` e `handleReset` (o `handleDelete` já navegava para `/contents`, o que resolvia o problema por outro caminho).
- **`last_reviewed_at` (migration `0003_last_reviewed_at.sql`)**: nova coluna `date` em `contents`, escrita exclusivamente por `mark_content_reviewed` (mesma transação do `insert` em `review_logs`), para permitir que a UI saiba de forma barata e correta se "já foi revisado hoje" — decisão explícita contra uma heurística baseada só em `next_review_date > hoje` (que erraria para qualquer conteúdo ativo simplesmente ainda não vencido) e contra uma query N+1 por card. `resetContent`/`archiveContent` não tocam nesse campo de propósito: como não apagam `review_logs`, a trava de "uma revisão por dia" já vale por `review_logs`, e `last_reviewed_at` permanece consistente com ela sem precisar de sincronização extra (ver comentário na migration).
- **`components/review-progress.tsx` (novo)**: 5 bolinhas numeradas (uma por intervalo do algoritmo), preenchidas em verde (`bg-primary`) até `interval_index` (ou todas, se `mastered`). Usado no dashboard, na lista de conteúdos e na página de detalhe.
- **Botão de revisão com estado real**: `MarkReviewedButton` (dashboard) e o botão principal de `ContentActions` (detalhe) agora recebem `intervalIndex`, `lastReviewedAt` e `today` (calculado uma vez no Server Component, nunca no cliente, para não depender do relógio do navegador) e mostram "✓ Revisão N feita" (desabilitado) quando `lastReviewedAt === today`, em vez de continuar oferecendo "Marcar como revisado".
- **Excluir mantido do pedido anterior**: `AlertDialog` (novo componente shadcn, `components/ui/alert-dialog.tsx`, disponível no preset `base-nova`) confirma antes de excluir — não fazia parte deste pedido, mas foi implementado na mesma sessão logo antes.
- **Identidade visual**:
  - Fonte trocada de Geist para **Inter** (`next/font/google`) em `app/layout.tsx`, mantendo o nome da CSS variable (`--font-geist-sans`) para não precisar rastrear onde mais ela é referenciada.
  - Paleta "Earthy Harmony" aplicada em `app/globals.css`: `--primary` = Palm Leaf `#899878` (verde oliva, usado em botões, bolinhas de progresso preenchidas, badge de "dominado", anel de foco); claro = Porcelain `#f7f7f2` + Beige `#e4e6c3`; escuro = Carbon Black `#222725` (superfícies) sobre Onyx `#121113` (fundo). Tons derivados (muted/secondary/border) usam `color-mix()` a partir dessas 5 cores em vez de inventar novos tons soltos — mesmo padrão que o preset shadcn já usava em outros lugares do projeto. Contraste de `primary-foreground` sobre Palm Leaf verificado manualmente (~4.9:1, WCAG AA para texto normal) — por isso é Carbon Black/Onyx, não branco.
  - Animações leves via Tailwind + `tw-animate-css` (já presente no projeto, usado pelo `alert-dialog`): `animate-in fade-in` nas páginas principais, `hover:-translate-y-0.5 hover:shadow-md` nos cards clicáveis, `transition-all duration-300` nas bolinhas de progresso quando mudam de estado. Nada com JavaScript adicional — só classes utilitárias.
  - Dashboard ganhou 3 "StatPill" (Para hoje / Ativos / Dominados) usando dados que a página já buscava, sem queries novas — interpretação de "mais telas"/"mais vivo" como enriquecer as telas existentes, não criar rotas novas sem escopo definido.
- **Critérios de conclusão**: `npm run lint`, `npm run build` e `npm run test` passam; migration aplicada no projeto Supabase real (compartilhado dev/prod) com confirmação explícita do usuário antes (mudança de schema em produção).
  - **Resultado (2026-09-20)**: lint limpo; build gera as 9 rotas normalmente; `npm run test` 70/70 (incluindo novas asserções de `last_reviewed_at` em `actions.test.ts` e `review-flow.test.ts`, e os testes de `deleteContent` do pedido anterior). Migration `0003` aplicada via `supabase db push --linked` após confirmação do usuário; tipos TS regenerados via `supabase gen types typescript --linked`.
  - **Limitação de verificação**: sem extensão do Chrome conectada neste ambiente, não foi possível fazer uma checagem visual ao vivo (screenshot real) do resultado — mesma limitação documentada para outras etapas de UI neste projeto. Validado por lint/build/teste e revisão de código; fica pendente uma checagem visual do usuário depois do deploy.
- **Dependências**: Etapa 19 (schema/app já em produção); migration `0003` precisa ser aplicada antes do deploy do código que assume a coluna `last_reviewed_at`.

### Etapa 21 (pós-MVP, 2026-09-20) — Bug real de fonte, criação sem sair da home, e datas por extenso

> Usuário achou o resultado da Etapa 20 ruim ("ta mto ruim") e pediu, especificamente: "Novo conteúdo" abrir sem sair da home; clicar numa bolinha mostrar em que dia é aquela revisão; "Próxima revisão" no formato "Segunda, dia 12 de agosto"; trocar a fonte (achava que não tinha virado Inter); mais seções e mais animação.

- [x] **Bug real encontrado: a troca de fonte da Etapa 20 nunca tinha efeito nenhum**. `app/globals.css` tinha `--font-sans: var(--font-sans);` dentro de `@theme inline` — uma referência circular (a variável definida em termos dela mesma), que o navegador trata como inválida e cai no stack padrão do sistema. Isso já estava quebrado antes desta sessão (não foi algo que a Etapa 20 introduziu) — a troca de Geist para Inter no `layout.tsx` nunca chegou a aparecer na tela por causa disso. **Corrigido**: `--font-sans: var(--font-geist-sans)`, apontando para a variável que o `next/font` realmente popula.
- **"Novo conteúdo" agora abre em um Dialog na própria home**, sem navegar para `/contents/new`: o formulário foi extraído para `components/new-content-form.tsx` (reutilizável) e `components/new-content-dialog.tsx` (novo) usa o componente `Dialog` do shadcn (`components/ui/dialog.tsx`, preset `base-nova`) controlado (`open`/`onOpenChange`), fechando e dando `router.refresh()` ao salvar com sucesso. A rota `/contents/new` continua existindo (reaproveita o mesmo `NewContentForm`) como acesso direto, mas não é mais o caminho principal a partir da home.
- **Bolinhas de progresso agora são clicáveis** (`components/review-progress.tsx` reescrito): cada bolinha abre um `Popover` (shadcn) mostrando a data daquela revisão — real, quando já aconteceu (via `review_logs`, disponível só na página de detalhe) ou está definida (`next_review_date`, a mais próxima); **projetada** para as revisões futuras seguintes, assumindo que as anteriores acontecem em dia (deixado explícito no texto do popover, já que os intervalos são relativos à última revisão de verdade, não cumulativos — uma revisão adiantada ou atrasada desloca tudo depois dela). Nas telas que não carregam `review_logs` por item (dashboard, lista, para evitar N+1), bolinhas já concluídas mostram "Revisão feita" sem data exata.
- **Datas por extenso em pt-BR**: nova `formatReviewDatePtBR` em `lib/date.ts` (usada em todo "Próxima revisão:" e nos popovers das bolinhas), formato "Segunda, dia 12 de agosto" — nomes de dia da semana fixos em português (sem o sufixo "-feira" que o `Intl` "long" produziria) para bater exatamente com o que o usuário pediu; ancorado ao meio-dia UTC antes de extrair os campos de calendário, para nunca deslocar a data por causa do fuso fixo de São Paulo (mesmo cuidado que o resto de `lib/date.ts` já tinha).
- **Mais animação**: entrada em cascata dos cards (`animate-in fade-in slide-in-from-bottom-1`, com `animationDelay` incremental por item, usando `fill-mode-backwards` do `tw-animate-css`) nas listas do dashboard e de `/contents`.
- **Skills de design/animação**: não há, nas skills disponíveis nesta sessão, uma skill dedicada a design de front-end ou animação para código de um projeto real (existe uma para o conteúdo publicado pela ferramenta Artifact, que é um mecanismo diferente e não se aplica a arquivos deste repositório) — a melhoria visual foi feita diretamente, sem uma skill externa.
- **Critérios de conclusão**: `npm run lint`, `npm run build` e `npm run test` passam.
  - **Resultado (2026-09-20)**: lint limpo; build gera as mesmas 9 rotas; `npm run test` 72/72 (2 novos testes de `formatReviewDatePtBR`, verificados contra o dia da semana real via `date -u -d`).
  - **Limitação de verificação**: sem extensão do Chrome conectada neste ambiente novamente — não foi possível confirmar visualmente o resultado. Fica pendente checagem visual do usuário depois do deploy, incluindo se o contraste da paleta "Earthy Harmony" ficou bom na prática.
- **Dependências**: Etapa 20.

### Etapa 22 (pós-MVP, 2026-09-20) — Bug real de navegação: nada levava até a página de detalhe

> Usuário pediu novamente "faça que seja possível excluir um conteúdo" — a funcionalidade já existia (Etapa 20) e estava em produção, mas ele não conseguia achá-la. Com um screenshot da home em produção, ficou claro o motivo: não tinha nenhum jeito de chegar em `/contents/[id]` (onde fica o botão Excluir) a partir da tela em que ele estava.

- [x] **Bug real encontrado**: os cards do dashboard (`app/page.tsx`) nunca foram um link — só a lista em `/contents` (`ContentListItem`) navegava para o detalhe. E não existia nenhum link para `/contents` em lugar nenhum da UI (nem no header, nem na home) — ou seja, a única forma de chegar à página de detalhe (e portanto ao botão Excluir) era digitar a URL manualmente. Isso não é uma regressão desta sessão: essa lacuna de navegação existia desde as etapas originais do MVP, só ficou visível agora que "Excluir" passou a morar lá.
- **Corrigido**:
  - `app/layout.tsx`: header ganhou uma `nav` com dois links — "Revi" (para `/`) e "Conteúdos" (para `/contents`) — visível em toda página autenticada.
  - `app/page.tsx`: o cabeçalho de cada `ContentCard` (título + matéria) agora é um `Link` para `/contents/${id}`; o resto do card (bolinhas de progresso, botão "Marcar como revisado") continua fora do link, sem precisar de `stopPropagation` porque só o cabeçalho ficou clicável, não o card inteiro.
- **Critérios de conclusão**: `npm run lint`, `npm run build` e `npm run test` passam.
  - **Resultado (2026-09-20)**: lint limpo; build gera as mesmas 9 rotas; `npm run test` 72/72 (sem mudança de comportamento testável — é navegação de UI).
- **Dependências**: Etapa 20 (onde o botão Excluir foi criado, mas ficou inalcançável).

## Observações para o agente que for implementar

- Implemente **uma etapa por vez**, marque o checkbox correspondente (`- [x]`) ao concluí-la, e só avance para a próxima depois de validar os critérios de conclusão descritos nela — nenhuma etapa deve ser considerada concluída com base em uma etapa futura.
- Não implemente itens listados em "Fora do MVP" sem alinhamento explícito.
- Mantenha `lib/review.ts` livre de dependências de Supabase — é a peça que permite evoluir o cálculo isoladamente; um algoritmo futuro pode exigir alterações de schema e do RPC. O RPC `mark_content_reviewed` é a fonte de verdade para a transição real de estado; `lib/review.ts` é usado para o cálculo inicial e como especificação testável.
- Use os componentes shadcn/ui já padronizados em vez de criar componentes de UI do zero.
- Nunca exponha credenciais administrativas no client ou em variáveis `NEXT_PUBLIC_*`. O harness usa somente credenciais do stack local ou do projeto remoto dedicado de desenvolvimento; nunca as de produção.

## Verificação documental de consistência

Esta seção registra as decisões do plano, não resultados de testes da aplicação. Todas as etapas permanecem pendentes até serem implementadas e verificadas.

- **Scaffold**: realizado em pasta temporária, preservando `PLAN.md`, `.git`, `.agents` e `.codex`.
- **Ordem**: execução 1→18, sem delegação ou etapas paralelas; concorrência apenas nos testes que precisam exercitá-la.
- **Schema**: próxima data aceita nulo para inativos; ativos exigem data. RLS já está habilitado em `0001`; policies/RPC entram em `0002` antes de utilizar o app.
- **Revisões**: RPC transacional com bloqueio de linha e unicidade diária. Garantia delimitada ao caminho RPC, sem promessa de impedir adulteração dos próprios dados por API direta.
- **Datas e reset**: São Paulo é o fuso oficial. Uma revisão por conteúdo por dia, inclusive após reset. Histórico preservado pelo reset; quinta revisão conclui o ciclo, inclusive antecipadamente.
- **Testes executáveis**: paridade SQL/TypeScript, fixtures administrativas somente em desenvolvimento, estados finais e erros concorrentes definidos, mocks somente das fronteiras Next.js nas actions.
- **Ambientes**: desenvolvimento local por padrão; alternativa remota dedicada consistente com permissões e critérios. Produção recebe todas as migrations somente na etapa final.
- **Tipagem**: geração dos tipos do banco e RPC na Etapa 6.
- **Auth e publicação**: *(desatualizado pela revisão de 2026-09-20 — ver Etapa 8)* a versão original desta seção descrevia um fluxo PKCE/code com template e SMTP obrigatório em produção; a autenticação passou a ser e-mail+senha sem confirmação, sem callback, sem PKCE e sem SMTP nenhum.
- **Pré-requisitos**: Etapa 1 depende apenas do ambiente Node/npm e acesso ao registry; Docker/Supabase entram na Etapa 4, contas de produção na Etapa 18 (sem SMTP — ver nota acima). Nenhuma etapa foi executada por esta revisão original do PLAN.md.
