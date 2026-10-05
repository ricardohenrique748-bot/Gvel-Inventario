# Pátio — Inventário de Caminhões

Controle de entrada e saída de veículos de clientes no pátio da oficina.

- **Telas:** `Dashboard.tsx` (`/`), `Movimentacoes.tsx`, `RegistrarEntrada.tsx`, `VeiculoDetalhe.tsx`, `Clientes.tsx`, `ClienteDetalhe.tsx`
- **Dados:** `useMovimentacoes`, `useVeiculos`, `usePatios`, `useStatusManutencao`, `useHistoricoMovimentacao`, `useClientes`
- **Tabelas:** `movimentacoes`, `veiculos`, `clientes`, `patios`, `status_manutencao`, `movimentacao_historico`
- **Permissão:** `inventario_caminhoes` (`caminhoes_dashboard`, `caminhoes_movimentacoes`)

## Fluxo

1. **Entrada** (`registrarEntrada`): cria ou atualiza o veículo pela placa (`upsertVeiculo`) e grava a movimentação com `status = 'no_patio'`, pátio, motorista, KM e até 5 fotos (frente, laterais, traseira, painel). O usuário que registrou é gravado pelo trigger `set_movimentacao_usuario`. Rascunhos de entrada ficam no `localStorage` (`src/lib/rascunhosEntrada.ts`).
2. **No pátio:** o veículo pode trocar de pátio (`atualizarPatioMovimentacao`) e de status de manutenção (`atualizarStatusMovimentacao`). Cada etapa vai para `movimentacao_historico`.
3. **Saída** (`registrarSaida`): grava data, KM, destino, `status = 'saiu'` e finaliza a O.S do veículo (`finalizarOSAoSair`).

Todas as gravações disparam o evento `movimentacao_updated` no navegador, e `movimentacoes` está no Realtime: as outras telas e o app atualizam sozinhos.

## Pátios

Cadastrados em Configurações → Pátios ou pelo "+ Criar novo setor" nos formulários. Os nomes são gravados em maiúsculas. Pátios duplicados (erro de digitação) se corrigem com **Mesclar** (`mesclarPatios`), que move as movimentações para o destino e apaga a origem.

## Link público do cliente

`clientes.share_token` gera o link `/publico/frota/:token`, que mostra a frota do cliente no pátio sem login. A leitura passa pelas funções `get_frota_publica` e `get_veiculo_publico` (security definer), que expõem só os campos permitidos.

## Regras

- Editar e excluir movimentações: admin ou `inventario@gveldiesel.com`.
- Empresas que não usam o pátio (ex.: Pedrão) são redirecionadas da `/` para o primeiro módulo liberado (`HomeRedirect`).
