-- Liberação do veículo: nome do encarregado separado do responsável pela
-- manutenção (`inspetor`). É o encarregado quem assina no envio
-- (`assinatura_encarregado_url`). Liberações antigas ficam nulas e caem no `inspetor`.

alter table inspecoes
  add column if not exists encarregado_nome text;
