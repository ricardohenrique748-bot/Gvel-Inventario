-- Checklist de Liberação do Veículo como segundo modelo de inspeção.
-- `modelo`: 'vistoria' (checklist padrão) ou 'liberacao' (liberação pós-manutenção).
-- Os campos abaixo só são preenchidos no modelo 'liberacao'; `inspetor` passa a
-- guardar o responsável pela manutenção e `responsavel_nome` o responsável
-- pela liberação.

alter table inspecoes
  add column if not exists modelo text not null default 'vistoria'
    check (modelo in ('vistoria', 'liberacao')),
  add column if not exists numero_os text,
  add column if not exists horimetro numeric,
  add column if not exists status_liberacao text
    check (status_liberacao in ('liberado', 'liberado_restricao', 'nao_liberado')),
  add column if not exists observacoes text;
