-- ============================================================
-- Agenda o alerta diário de checklist da Rodocaçamba no WhatsApp
-- (Edge Function alerta-checklist-rodocacamba).
--
-- Rode no SQL Editor DEPOIS de publicar a função e configurar os segredos.
-- Antes de rodar, troque:
--   SEU-PROJETO   → o ID do projeto (o mesmo da VITE_SUPABASE_URL)
--   SUA-SENHA     → o mesmo valor do segredo ALERTA_CRON_SECRET
--
-- Horário: '0 21 * * *' = 21h UTC = 18h de Brasília, todos os dias.
-- Para mudar, rode só o cron.schedule de novo com outro horário
-- (ex.: '30 20 * * 1-6' = 17h30, de segunda a sábado).
--
-- Pode rodar de novo sem problema.
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Senha guardada no Vault (não fica escrita no agendamento).
select vault.create_secret('SUA-SENHA', 'alerta_cron_secret')
 where not exists (select 1 from vault.secrets where name = 'alerta_cron_secret');

select cron.schedule(
  'alerta-checklist-rodocacamba',
  '0 21 * * *',
  $$
  select net.http_post(
    url := 'https://SEU-PROJETO.supabase.co/functions/v1/alerta-checklist-rodocacamba',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'alerta_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- Conferir:   select * from cron.job;
-- Histórico:  select * from cron.job_run_details order by start_time desc limit 10;
-- Respostas:  select id, status_code, content from net._http_response order by created desc limit 5;
-- Desligar:   select cron.unschedule('alerta-checklist-rodocacamba');
