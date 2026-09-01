-- Contraparte da regra das 18h: às 08:00 (horário de Brasília, início do
-- expediente) toda atividade que ainda estiver pausada é retomada
-- automaticamente. O tempo que ficou pausada durante a noite é somado em
-- minutos_pausados (igual ao botão "RETOMAR" manual), então essa janela
-- continua não contando como hora trabalhada.

create or replace function retomar_atividades_pausadas_8h()
returns void
language plpgsql
security definer
as $$
begin
  update checklist_itens
  set minutos_pausados = minutos_pausados
        + greatest(0, round(extract(epoch from (now() - coalesce(pausa_inicio, now()))) / 60)::integer),
      pausado = false,
      pausa_inicio = null
  where pausado = true;
end;
$$;

-- Remove um agendamento anterior com o mesmo nome, se existir, pra este
-- arquivo poder ser rodado de novo sem duplicar o job.
select cron.unschedule(jobid) from cron.job where jobname = 'retomar-atividades-8h';

-- 08:00 BRT = 11:00 UTC (Brasília é UTC-3, sem horário de verão desde 2019).
select cron.schedule(
  'retomar-atividades-8h',
  '0 11 * * *',
  $$select retomar_atividades_pausadas_8h()$$
);
