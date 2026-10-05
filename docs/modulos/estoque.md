# Estoque — Ferramentas e Insumos

- **Tela:** `src/pages/InventarioFerramentas.tsx` (cerca de 8 mil linhas, com todos os modais no mesmo arquivo), `/inventario-ferramentas?aba=...`
- **Dados:** `useFerramentas.ts`, `useInsumos.ts`, regra de tambor em `src/lib/tambores.ts`
- **Tabelas:** `ferramentas`, `ferramentas_retiradas`, `itens_consumo`, `consumo_baixas`, `consumo_entradas`
- **Catálogo inicial:** `src/data/ferramentasPadrao.ts`
- **Permissão:** `estoque` (`estoque_ferramentas`, `estoque_consumo`, `estoque_caixas`, `estoque_em_uso`, `estoque_historico`)

## Abas

| Aba | Conteúdo |
|---|---|
| Ferramentas | Ferramentas do pátio |
| Especiais | Ferramentas especiais, detectadas por tipo, categoria e palavras-chave (diagnóstico, hidráulica pesada, especial motores...) |
| Insumos (Uso e Consumo) | Óleo, aditivos, descartáveis, com entradas (nota fiscal) e baixas |
| Caixas | Caixas/kits de ferramentas por mecânico, que podem ser vinculadas a um caminhão |
| Em uso | Ferramentas retiradas no momento |
| Histórico | Log de retiradas e devoluções |

Ferramentas marcadas como "estoque" (reserva) não entram nem em Ferramentas nem em Especiais.

## Retirada e devolução

A retirada é um wizard de 3 passos, com várias ferramentas, foto e mecânico/veículo (`registrarRetiradaFerramenta`). A devolução usa `registrarDevolucaoFerramenta` e pode ser revertida (`reverterDevolucaoFerramenta`).

## Insumos e tambores

- O estoque é guardado sempre na unidade base. Unidades grandes aceitam baixa na fração menor (ex.: óleo em LT com baixa em ML).
- **Troca de tambor** (`src/lib/tambores.ts`, testada): quando o tambor aberto esvazia e há tambor de reserva, o próximo entra sozinho (número +1, reserva −1) e o que faltou na baixa sai dele. Toda alteração de estoque passa por essa regra.
- A entrada de insumo pode gerar um lançamento no Financeiro (`registrarLancamentoEntradaConsumo`).

## Cópia local + Supabase (atenção)

Este módulo guarda uma cópia das ferramentas, retiradas e insumos no `localStorage` e mescla com o banco (`mesclarRemotasComLocais`). Os ids excluídos também ficam numa lista local. Existe um botão de **sincronização total** (`sincronizarTudoParaSupabase`) que sobe a cópia local para o banco.

Consequência: dois aparelhos podem ver estados diferentes até sincronizar, e limpar o navegador perde o que ainda não subiu. Fotos que falharam no upload ficam como base64 local e são reenviadas automaticamente depois.

## Permissões especiais

Editar e excluir: admin ou `inventario@gveldiesel.com`. No app, essa conta sempre tem acesso ao Estoque.
