# Consumo de Combustível

Aba "Consumo" da Gestão de Frotas (`/frotas?aba=consumo`). Controle de abastecimentos e média km/L por veículo e motorista. Criado na migration 0090.

- **Código:** `src/pages/frotas/ConsumoCombustivel.tsx` + pasta `src/pages/frotas/consumo/`
- **Dados:** `src/hooks/useConsumoCombustivel.ts`
- **Testes:** `dominio.test.ts`, `comprovante.test.ts` (`npm test`)
- **Power BI:** [consumo-combustivel-powerbi.md](../consumo-combustivel-powerbi.md)

## Abas

| Aba | Arquivo |
|---|---|
| Painel | `PainelConsumo.tsx`: totais e semáforo |
| Abastecimentos | `ListaAbastecimentos.tsx`; novo/editar em `AbastecimentoModal.tsx` e `AbastecimentoDetalheModal.tsx` |
| Ciclos | `TabelaCiclos.tsx` |
| Configurações | `ConfiguracoesConsumo.tsx`: capacidade do tanque e metas por placa, postos, parâmetros |

> `RankingConsumo.tsx`, `RevisaoAlertas.tsx` e `ImportacaoMoveTruck.tsx` existem na pasta mas **não são exibidos em nenhuma tela** hoje (nenhum import). Para reativar, renderize-os em `ConsumoCombustivel.tsx`.

## Combustível

Só **diesel** (S10 e S500) aparece nas telas. O ARLA 32 foi retirado da interface em out/2026. Os registros antigos de ARLA continuam no banco, mas são escondidos da lista e ignorados no cálculo (`isArla`).

## Regras de domínio (`dominio.ts`)

O cálculo fica todo em funções puras e testadas. **Os ciclos não são gravados**: são recalculados a partir dos abastecimentos, para que uma correção nunca deixe um ciclo desatualizado.

- **Ciclo** = de um abastecimento com tanque cheio até o próximo com tanque cheio. km/L = km rodado ÷ litros repostos no ciclo. Abastecimentos antes do primeiro tanque cheio são ignorados; abastecimentos invalidados não entram.
- **Consolidado** = km total ÷ litros total. Nunca é a média das médias.
- **Meta:** por placa, com meta específica para "carregado" e "vazio" (a condição vem das viagens no intervalo, `cruzarComViagens`). Se não houver meta específica, vale a geral.
- **Semáforo:** verde, amarelo ou vermelho conforme o desvio em relação à meta (percentuais em `config_consumo`).
- **Alertas:**
  - `CONSUMO_ABAIXO_META` e `CONSUMO_ACIMA_META`
  - `DESVIO_ESTATISTICO`: só contra o histórico do próprio veículo e com amostra mínima
  - `QUEDA_CONTINUA`: N ciclos seguidos piorando
- **Validação** (`validarAbastecimento`):
  - odômetro não pode voltar
  - litros não podem passar da capacidade do tanque + tolerância
  - o valor total é recalculado (litros × valor/litro) e comparado com o informado
- **Por motorista:** cada trecho do ciclo é atribuído ao motorista do abastecimento que fecha o trecho. É só uma leitura analítica; o ciclo continua sendo do veículo.
- **Placa normalizada:** sem traço e em maiúsculas (`normalizarPlaca`, igual à função SQL `placa_normalizada`).

## No banco (0090)

- `valida_odometro_abastecimento` e `exige_motivo_correcao_abastecimento` repetem as regras críticas no banco.
- `audita_abastecimento` grava toda alteração em `auditoria_abastecimentos`.

## Entrada de dados

- **Manual:** pelo `AbastecimentoModal`.
- **Comprovante em PDF:** lido no navegador (`lerComprovantePdf.ts` + `comprovante.ts`).
- **Foto do cupom:** enviada para a Edge Function `ler-cupom-abastecimento`, que usa a API da Anthropic (`lerCupomFoto.ts`). Só os campos reconhecidos são preenchidos; o usuário confere antes de salvar.
- **Offline:** sem rede, o abastecimento fica salvo no aparelho como "pendente de sincronização" (`filaOffline.ts`) e sobe sozinho quando a conexão volta. O `id` é gerado no aparelho e o envio é idempotente, então reenviar nunca duplica.

## Importação MoveTruck

`ImportacaoMoveTruck.tsx` + `importarMoveTruck.ts` (o componente está fora da tela hoje, ver acima). Etapas: ler o `.xlsx` → escolher a aba → mapear colunas → validar → prévia (novos / duplicados / atualizáveis / com erro) → confirmar → gravar em `viagens_frota` → log em `importacoes_movetruck`. Nada é gravado sem passar pela prévia.
