# Gestão — Dashboard Gerencial, Controle de Horas, Kanbans, Relatórios

## Dashboard Gerencial (`/dashboard-gerencial`)

`src/pages/DashboardGerencial.tsx`. Visão executiva montada a partir das movimentações, clientes, usuários e liberações (`useMovimentacoes`, `useClientes`, `useUsuarios`, `useLiberacoes`).

Permissão: `dashboard_gerencial` / `dashboard_visao_geral`.

## Controle de Horas (`/controle-horas`)

`src/pages/ControleDeHoras.tsx` + `useControleHoras.ts`. Indicador de performance dos mecânicos, calculado a partir das atividades do checklist de O.S (`checklist_os` + `checklist_itens`): tempo entre início e fim menos `minutos_pausados`. A pausa automática das 18h às 08h (pg_cron) garante que a noite não conte. Horas úteis em `src/lib/horasUteis.ts`.

Permissão: `dashboard_controle_horas`.

## Kanban Localiza (`/kanban`) e Kanban Vamos (`/kanban-vamos`)

`Kanban.tsx` / `KanbanVamos.tsx`. Os dois leem **planilhas Google publicadas como CSV** (`useKanbanSheet`, `useVamosSheet`), não o banco.

- **Localiza:** as colunas seguem o fluxo operacional.
- **Vamos:** as colunas seguem o status de orçamento da planilha, que é o único campo de andamento disponível.

O cache e o histórico de mudanças ficam no `localStorage` do aparelho.

Permissão: `kanban`.

## Relatórios (`/relatorios`)

`src/pages/Relatorios.tsx`. Relatórios do pátio (movimentações por período, pátio e cliente) com exportação em PDF e CSV, e o link público da frota do cliente.

Permissão: `relatorios`.
