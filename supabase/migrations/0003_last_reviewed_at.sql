-- Permite que a UI saiba, sem N+1 queries nem heurísticas frágeis, se um
-- conteúdo já foi revisado hoje — usado para trocar o rótulo do botão de
-- revisão para "Revisão N feita" e desabilitá-lo pelo resto do dia, em vez
-- de continuar mostrando "Marcar como revisado" como se nada tivesse
-- acontecido. É mantido em sincronia com review_logs (a fonte real de
-- verdade para "já revisado hoje") só porque o único lugar que escreve
-- nele é este RPC, na mesma transação que insere o log — resetContent e
-- archiveContent não tocam neste campo de propósito (ver PLAN.md Etapa 20).
alter table contents add column last_reviewed_at date;

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
           next_review_date = v_today + v_intervals[v_next_index + 1],
           last_reviewed_at = v_today
     where id = p_content_id
     returning * into v_content;
  else
    update contents
       set status = 'mastered',
           next_review_date = null,
           last_reviewed_at = v_today
     where id = p_content_id
     returning * into v_content;
  end if;

  return v_content;
end;
$$;
