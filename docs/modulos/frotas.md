# Gestão de Frotas

Frota própria da GVEL (caminhões que fazem viagens). Não confundir com os veículos de clientes do [pátio](patio.md).

- **Tela:** `src/pages/Frotas.tsx` (arquivo grande, cerca de 9 mil linhas), `/frotas?aba=...`
- **Permissão:** `frotas` (`frotas_dashboard`, `frotas_veiculos`, `frotas_checklist`, `frotas_viagens`, `frotas_consumo`)

## Abas

| Aba | Conteúdo | Dados |
|---|---|---|
| Dashboard | Gráficos, status e vencimento de documentos (CRLV) | `useVeiculosFrota` |
| Veículos | Cadastro da frota | lista oficial em `src/data/veiculosFrotaPadrao.ts` + ajustes em `veiculos_frota` |
| Checklist | Inspeções da frota com fotos (inclusive fotos extras, 0089) | `useChecklistsFrota` → `checklists_frota`, `checklist_frota_itens` |
| Viagens | Controle de viagens, com sub-menu próprio (abaixo) | `useViagensFrota`, `useCadastrosViagem` |
| Consumo | Abastecimentos e km/L | ver [consumo.md](consumo.md) |

As placas `IXF4J63` e `QXS9G97` usam checklist de ida e volta (`PLACAS_CHECKLIST_IDA_VOLTA`).

## Sub-menu de Viagens

Agrupado em `GRUPOS_MENU_VIAGENS`:

- **Operação**
  - Viagens (`viagens_frota`)
  - Financeiro das viagens
  - Pátio de terceiros (`patio_estadias`: guarda de veículo com diária; o valor padrão é R$ 60,00 e o taxímetro roda até a saída)
  - Manutenção (`ordens_servico`, `abastecimentos`, `leituras_odometro`, via `useManutencaoFrota`)
- **Gestão**
  - Contas bancárias
  - Contas a pagar/receber (`contas_pagar_receber`, `fornecedores`)
  - Conciliação bancária (importa OFX; `useConciliacao`)
- **Cadastro**
  - Pessoas (motoristas e outros), marcas e modelos
  - Endereços frequentes, centros de custo, tipos de carga
  - Tipos de lançamento, formas de pagamento
- **Configurações:** atalhos para Usuários e Empresa

As viagens também podem vir da importação do **MoveTruck** (`.xlsx`). O componente existe, mas hoje está fora da tela; ver [consumo.md](consumo.md#importação-movetruck).
