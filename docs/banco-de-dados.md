# Banco de dados

Postgres do Supabase, projeto **Gvel Inventario** (`njuncnhzkiajtcnemblx`). O schema é a soma das migrations em `supabase/migrations/`, aplicadas em ordem. Não existe migration "de baixo pra cima": para mudar algo, crie o próximo número (hoje o último é `0090`).

Toda tabela de negócio tem `company_id` com RLS por empresa (ver [arquitetura](arquitetura.md#multiempresa)), exceto `marcas` e `modelos`.

## Tabelas por módulo

### Base / cadastros
| Tabela | O que guarda | Criada em |
|---|---|---|
| `companies` | Empresas do grupo, cor/logo, módulos habilitados | 0072 |
| `usuarios` | Perfil do usuário: nível, módulos, empresa, foto, master admin | 0002 |
| `clientes` | Clientes; `share_token` gera o link público da frota | 0001, 0017 |
| `marcas`, `modelos` | Catálogo de caminhões (compartilhado entre empresas) | 0001 |
| `veiculos` | Veículos de clientes que passam pelo pátio | 0001 |

### Pátio e manutenção
| Tabela | O que guarda | Criada em |
|---|---|---|
| `patios` | Pátios/setores (OFICINA LEVE, POSTO DE MOLAS...) | 0006 |
| `status_manutencao` | Status do veículo dentro do pátio | 0008 |
| `movimentacoes` | Cada passagem do veículo: entrada, saída, pátio, KM, fotos, usuários | 0001 |
| `movimentacao_historico` | Linha do tempo de etapas da movimentação (O.S, mecânico, setor) | 0026 |
| `checklist_os`, `checklist_itens` | O.S do veículo e as atividades com início/fim/pausa (base do Controle de Horas) | 0039 |
| `inspecoes`, `inspecao_itens` | Vistorias e Liberações do veículo (`modelo` = `vistoria` ou `liberacao`) | 0001, 0085 |

### Frota própria e viagens
| Tabela | O que guarda | Criada em |
|---|---|---|
| `veiculos_frota` | Ajustes sobre a lista oficial da frota (que está em `src/data/veiculosFrotaPadrao.ts`) | 0071 |
| `checklists_frota`, `checklist_frota_itens` | Checklists de inspeção da frota | 0047 |
| `viagens_frota` | Viagens (manuais ou importadas do MoveTruck), frete, carga | 0062 |
| `centros_custo`, `transportadoras`, `tipos_carga`, `enderecos_frequentes` | Cadastros das viagens | 0063 |
| `pessoas`, `formas_pagamento`, `tipos_lancamento`, `contas_bancarias` | Cadastros das viagens e do financeiro da frota | 0064 |
| `fornecedores`, `contas_pagar_receber` | Contas a pagar/receber | 0065 |
| `lotes_importacao_extrato`, `transacoes_extrato` | Conciliação bancária (OFX) | 0069 |
| `veiculos_clientes`, `patio_estadias` | Pátio de terceiros (guarda com diária) | 0066 |
| `ordens_servico`, `leituras_odometro` | Manutenção da frota e leituras de KM | 0067 |

### Consumo de combustível (0090)
| Tabela | O que guarda |
|---|---|
| `abastecimentos` | Abastecimentos (criada na 0067, ampliada na 0090) |
| `postos` | Postos de combustível |
| `metas_consumo_veiculo` | Capacidade do tanque e metas de km/L por placa |
| `config_consumo` | Parâmetros gerais (tolerâncias, semáforo) |
| `alertas_consumo` | Alertas gerados para revisão |
| `auditoria_abastecimentos` | Histórico de alterações (trigger `audita_abastecimento`) |
| `importacoes_movetruck` | Log das importações de viagens |
| Views `fato_*` / `dim_*` | Modelo para o Power BI ([doc](consumo-combustivel-powerbi.md)) |

### Estoque
| Tabela | O que guarda | Criada em |
|---|---|---|
| `ferramentas`, `ferramentas_retiradas` | Ferramentas, caixas, retiradas e devoluções | 0037, 0046 |
| `itens_consumo` | Insumos (óleo, aditivos...), com tambor/recipiente | 0054 |
| `consumo_baixas` | Baixas de insumo (número do tambor, restante) | 0054 |
| `consumo_entradas` | Entradas de insumo | 0084 |

### Financeiro, gestão e RH
| Tabela | O que guarda | Criada em |
|---|---|---|
| `fluxo_caixa_lancamentos` | Lançamentos do fluxo de caixa | 0058 |
| `painel_gerencial_divisoes` | Faturamento/receitas/despesas por divisão e mês (importado do Excel) | 0082 |
| `lotes_importacao_faltas`, `faltas_colaboradores` | Faltas importadas de PDF | 0070 |
| `rh_turnover` | Turnover | 0083 |

> `src/hooks/useLancamentos.ts` e `useExtratoBancario.ts` usam as tabelas `lancamentos_financeiros` e `extrato_bancario`, que **não existem em nenhuma migration** e não são usadas por nenhuma tela. São código legado.

## Funções e triggers importantes

| Nome | O que faz | Migration |
|---|---|---|
| `current_company_id()` / `is_master_admin_user()` | Base de todo o RLS multiempresa | 0072 |
| `stamp_company_id` | Preenche `company_id` no insert | 0073 |
| `protect_is_master_admin` | Impede que alguém se promova a master admin | 0076 |
| `handle_new_auth_user` | Cria o `usuarios` quando nasce um login | 0021, 0075 |
| `set_movimentacao_usuario` | Grava quem registrou entrada/saída | 0032 |
| `get_frota_publica`, `get_veiculo_publico` | Leitura pública por token (link do cliente) | 0017–0048 |
| `trava_aprovacao_liberacao` | Só a aprovadora define o status da Liberação | 0086 |
| `valida_odometro_abastecimento`, `exige_motivo_correcao_abastecimento` | Regras de integridade do consumo | 0090 |
| pg_cron 18h / 08h | Pausa e retoma atividades do checklist de O.S | 0050, 0051 |

## Mapa das migrations

| Faixa | Assunto |
|---|---|
| 0001–0036 | Base: clientes, veículos, movimentações, pátios, usuários, link público, histórico de movimentação |
| 0037–0046 | Inventário de ferramentas e checklist de O.S |
| 0047–0049 | Checklist da frota, pausa de atividades |
| 0050–0051 | pg_cron (pausa 18h / retomada 08h) |
| 0052–0057 | Módulos por usuário, insumos/tambores, foto do usuário |
| 0058–0061 | Fluxo de caixa, recipientes de insumo |
| 0062–0071 | Viagens, cadastros, contas a pagar/receber, pátio de terceiros, manutenção da frota, conciliação, faltas, veículos da frota |
| 0072–0078 | **Multiempresa** |
| 0079–0084 | Financeiro estendido, painel gerencial, turnover, entradas de insumo |
| 0085–0089 | Liberação do veículo (aprovação, encarregado), fotos extras do checklist da frota |
| 0090 | Consumo de combustível |
