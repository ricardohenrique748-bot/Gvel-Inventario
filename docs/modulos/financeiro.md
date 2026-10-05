# Financeiro

- **Tela:** `src/pages/Financeiro.tsx`, `/financeiro?aba=visao-geral|fluxo-caixa`
- **Permissão:** `financeiro` (`financeiro_visao_geral`, `financeiro_fluxo_caixa`)

## Visão Geral (só GVEL)

DRE e comparativo entre as divisões da GVEL (GVel Diesel, GVel Leves etc.), com top clientes e top planos de conta por mês.

- **Só aparece para a empresa GVEL** (`GVEL_COMPANY_ID`), mesmo que outra empresa tenha o módulo liberado: é histórico interno.
- **Origem dos dados:** a base está **fixa no código** em `DADOS_MESES` (janeiro a agosto/2026). Por cima dela entram os meses importados do Excel do painel gerencial (`importarPainelGerencialExcel.ts` → tabela `painel_gerencial_divisoes`). O mês importado substitui o do código.
- A importação de um mês **apaga e regrava** o mês inteiro (`importarDivisoesDoMes`). Só reconhece as divisões listadas em `DIVISOES_CONHECIDAS` (`usePainelGerencialDivisoes.ts`).
- **Saldo de caixa:** congelado em `SALDO_CAIXA_BASE_JUNHO` (−R$ 350.000) até jun/2026. A partir de julho soma receitas − despesas de cada mês.

## Fluxo de Caixa

Lançamentos de entradas e saídas (`fluxo_caixa_lancamentos`, via `useFluxoCaixaLancamentos`).

- Empresas com `companies.financeiro_campos_estendidos = true` veem campos extras (forma e status de pagamento, quantidade de veículos etc.; migrations 0079–0081).
- Os status de pagamento são texto livre, com sugestões em `STATUS_PAGAMENTO_OPCOES`.
- `src/lib/importarFluxoCaixaExcel.ts` existe, mas **não é usado** por nenhuma tela.

## Financeiro da frota

Contas bancárias, contas a pagar/receber e conciliação OFX ficam no sub-menu de Viagens da [Gestão de Frotas](frotas.md#sub-menu-de-viagens), não aqui.
