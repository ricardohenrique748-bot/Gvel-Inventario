# RH

- **Tela:** `src/pages/RH.tsx`, `/rh?aba=...`
- **Permissão:** `rh` (`rh_dashboard`, `rh_planilha`, `rh_atestado`, `rh_faltas`)

## Abas

| Aba | Fonte dos dados | Quem vê |
|---|---|---|
| Dashboard | Planilha Google do RH (`useRhSheet`) | permissão `rh_dashboard` |
| Planilha | Folha completa por colaborador (`useRhSheet`) | `rh_planilha` |
| Atestado | Planilha Google de atestados (`useAtestadosSheet`) | `rh_atestado` |
| Faltas | PDF importado (`faltasPdfParser.ts`) → `faltas_colaboradores`, `lotes_importacao_faltas` | `rh_faltas` |
| Hora Extra | Planilha Google (`useHoraExtraSheet`) | **só admin e `rh@gveldiesel.com`** (fixo no código, não é liberável por checkbox) |
| Turnover | `rh_turnover` (`useTurnover`) | mesma regra da Hora Extra **e** só na empresa GVEL |

## Planilhas Google

As abas que vêm de planilha leem o CSV publicado ("Publicar na Web") direto do navegador. O resultado fica em cache no `localStorage`, com a data da última sincronização. Para trocar de planilha, altere `SHEET_PUB_ID` e o `gid` da aba no topo do hook correspondente.

Se a planilha deixar de estar publicada, ou se mudar a ordem ou o nome das colunas, a aba quebra ou fica vazia.
