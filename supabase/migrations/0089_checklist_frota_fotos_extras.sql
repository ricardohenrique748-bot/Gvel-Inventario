-- Checklist da frota pesada: fotos adicionais livres além das 5 posições fixas
-- (avarias, pneus, detalhes). Lista de { url, label }.

alter table checklists_frota
  add column if not exists fotos_extras jsonb not null default '[]'::jsonb;
