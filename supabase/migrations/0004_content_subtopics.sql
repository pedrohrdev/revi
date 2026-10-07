-- Subconteúdos: os conceitos menores que compõem um conteúdo (ex.: em
-- "Requisições no Express", os itens req.params, req.query e req.body).
-- Não têm agenda, status nem histórico próprios — a repetição espaçada
-- continua sendo inteiramente do conteúdo, por isso vivem como uma lista
-- ordenada na própria linha de `contents` em vez de numa tabela à parte
-- (ver PLAN.md Etapa 24). Assim criar/editar continua sendo um único
-- INSERT/UPDATE atômico e a RLS de `contents` já cobre a coluna.
--
-- Aditiva e segura para dados existentes: o default preenche '{}' em
-- todas as linhas atuais, e nada em mark_content_reviewed, review_logs,
-- reset ou archive lê ou escreve esta coluna.

-- Invariantes que o servidor (lib/subtopics.ts) já garante, repetidas aqui
-- como defesa em profundidade contra escrita direta pela API: até 20
-- itens, cada um sem espaços nas pontas, não vazio, com até 120 caracteres,
-- sem nulos e sem duplicatas ignorando maiúsculas/minúsculas. A
-- deduplicação que também ignora acentos fica só no servidor, para não
-- depender da extensão unaccent.
create or replace function subtopics_are_valid(p_subtopics text[])
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(array_ndims(p_subtopics), 1) = 1
     and cardinality(p_subtopics) <= 20
     and not exists (
       select 1
         from unnest(p_subtopics) as item
        where item is null
           or item = ''
           or item <> btrim(item)
           or char_length(item) > 120
     )
     and (select count(distinct lower(item)) from unnest(p_subtopics) as item)
         = cardinality(p_subtopics);
$$;

alter table contents
  add column subtopics text[] not null default '{}'
  constraint subtopics_valid check (subtopics_are_valid(subtopics));
