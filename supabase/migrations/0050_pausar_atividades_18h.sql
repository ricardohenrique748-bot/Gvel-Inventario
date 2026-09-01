-- Regra: às 18:00 (horário de Brasília) qualquer atividade do checklist que
-- ainda estiver em andamento (com início apontado, sem fim e ainda não
-- pausada) é pausada automaticamente. Roda direto no Postgres via pg_cron,
-- então funciona mesmo sem ninguém com o app aberto no momento.

-- 1. Habilita a extensão de agendamento (se ainda não estiver habilitada).
--    Se este comando falhar por permissão, habilite pg_cron manualmente em
--    Database → Extensions no painel do Supabase e rode o restante deste
--    arquivo novamente.
create extension if not exists pg_cron;

-- 2. Função que faz a pausa em massa.
create or replace function pausar_atividades_em_andamento_18h()
returns void
language plpgsql
security definer
as $$
begin
  update checklist_itens
  set pausado = true,
      pausa_inicio = now()
  where hora_inicio is not null
    and hora_fim is null
    and pausado = false;
end;
$$;

-- 3. Remove um agendamento anterior com o mesmo nome, se existir, pra este
--    arquivo poder ser rodado de novo sem duplicar o job.
select cron.unschedule(jobid) from cron.job where jobname = 'pausar-atividades-18h';

-- 4. Agenda a execução diária. O pg_cron roda em UTC; Brasília é UTC-3 (sem
--    horário de verão desde 2019), então 18:00 BRT = 21:00 UTC.
select cron.schedule(
  'pausar-atividades-18h',
  '0 21 * * *',
  $$select pausar_atividades_em_andamento_18h()$$
);
