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
