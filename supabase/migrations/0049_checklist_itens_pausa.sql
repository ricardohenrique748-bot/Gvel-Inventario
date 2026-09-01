-- Suporte a pausa de atividades do checklist: o mecânico pode pausar uma
-- atividade em andamento (pra fazer outra coisa) e retomar depois, sem que
-- o tempo parado conte como horas trabalhadas no indicador de performance.
ALTER TABLE checklist_itens ADD COLUMN IF NOT EXISTS pausado boolean NOT NULL DEFAULT false;
ALTER TABLE checklist_itens ADD COLUMN IF NOT EXISTS pausa_inicio timestamptz;
ALTER TABLE checklist_itens ADD COLUMN IF NOT EXISTS minutos_pausados integer NOT NULL DEFAULT 0;
