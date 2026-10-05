# Manutenção

Tela `src/pages/Manutencao.tsx` (`/manutencao`), com duas abas guardadas na URL (`?secao=`).

- **Permissão:** `manutencao` (`manutencao_os`, `manutencao_liberacao`)

## Controle de O.S

Mostra os veículos que estão no pátio, agrupados por pátio. Cada veículo tem uma O.S com checklist de atividades.

- **Dados:** `useChecklistOS` (com Realtime, sincroniza app e web), `useOSStatusBatch`, `useEquipeConhecida`
- **Tabelas:** `checklist_os` (mecânico, número da O.S, status), `checklist_itens` (atividade com início, fim, pausa e `minutos_pausados`)
- Cada atividade pode ser iniciada, pausada, retomada e finalizada. O tempo efetivo alimenta o [Controle de Horas](gestao.md#controle-de-horas).
- **Automático (pg_cron):** às 18h toda atividade em andamento é pausada e às 08h é retomada. A noite não conta como hora trabalhada.
- A O.S é finalizada quando o veículo sai do pátio.

## Liberação do Veículo

Checklist de liberação pós-manutenção. Usa o mesmo wizard da vistoria (`src/pages/inspecao/NovaInspecao.tsx`) com `modelo = 'liberacao'`.

- **Tabelas:** `inspecoes`, `inspecao_itens` (campos de liberação desde a 0085)
- **Dados:** `useLiberacoes`, `useInspecao`; PDF em `pdfLiberacaoSalva.ts` e `reportHtml.ts`

### Fluxo

1. Qualquer usuário preenche o checklist com fotos, O.S, horímetro, responsável pela manutenção (`inspetor`) e encarregado.
2. O **encarregado assina** o envio (`assinatura_encarregado_url`). A liberação fica "aguardando aprovação" (`status_liberacao` nulo).
3. Só a **aprovadora** (`mariaclara@gveldiesel.com`, constante `APROVADOR_LIBERACAO_EMAIL`) define o status final: `liberado`, `liberado_restricao` ou `nao_liberado`. A regra está também no trigger `trava_aprovacao_liberacao` (0086); **para trocar a aprovadora, mude nos dois lugares.**
4. As liberações finalizadas ficam em `LiberacoesFinalizadas.tsx`. Só admin exclui.

## Vistoria (`/inspecoes/nova`)

Wizard com `modelo = 'vistoria'`: Dados do veículo → Checklist → Assinatura → Resumo/PDF. Os itens do checklist estão em código, em `src/data/checklistSchema.ts`. O PDF é compartilhado por Web Share (WhatsApp) ou baixado.
