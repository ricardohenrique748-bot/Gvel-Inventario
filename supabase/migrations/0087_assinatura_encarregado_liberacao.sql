-- Liberação do veículo: o encarregado (responsável pela manutenção) assina
-- ao enviar para aprovação. `assinatura_url` continua sendo a do aprovador.
-- A data/hora do envio fica em `data_hora` (preenchida automaticamente).

alter table inspecoes
  add column if not exists assinatura_encarregado_url text;
