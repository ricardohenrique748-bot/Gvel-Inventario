-- Multi-empresa (Fase 1) — módulos habilitados por empresa (item 8 do
-- pedido original). `null` (padrão, valor atual de todas as empresas
-- existentes) significa "sem restrição — todos os módulos liberados",
-- então nenhuma empresa já cadastrada perde acesso a nada com esta
-- migration. Quando preenchido, só os módulos da lista aparecem no menu
-- daquela empresa (ainda combinado com a permissão do usuário — os dois
-- precisam liberar pro item aparecer).

alter table companies add column if not exists modulos_habilitados text[];
