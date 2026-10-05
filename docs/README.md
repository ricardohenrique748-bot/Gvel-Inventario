# Documentação do sistema

Documentação técnica de referência. Para instalar e rodar, ver o [README da raiz](../README.md).

## Geral

- [Arquitetura](arquitetura.md): multiempresa, login, permissões, app Android, fontes de dados, tarefas automáticas
- [Banco de dados](banco-de-dados.md): tabelas por módulo e mapa das migrations

## Módulos

| Módulo | Rota | Documento |
|---|---|---|
| Pátio (Inventário de Caminhões) | `/`, `/movimentacoes` | [modulos/patio.md](modulos/patio.md) |
| Manutenção (O.S e Liberação) | `/manutencao` | [modulos/manutencao.md](modulos/manutencao.md) |
| Gestão de Frotas | `/frotas` | [modulos/frotas.md](modulos/frotas.md) |
| Consumo de Combustível | `/frotas?aba=consumo` | [modulos/consumo.md](modulos/consumo.md) |
| Estoque (ferramentas e insumos) | `/inventario-ferramentas` | [modulos/estoque.md](modulos/estoque.md) |
| Financeiro | `/financeiro` | [modulos/financeiro.md](modulos/financeiro.md) |
| RH | `/rh` | [modulos/rh.md](modulos/rh.md) |
| Dashboard Gerencial, Controle de Horas, Kanbans, Relatórios | vários | [modulos/gestao.md](modulos/gestao.md) |
| Configurações | `/configuracoes` | [modulos/configuracoes.md](modulos/configuracoes.md) |

Integração com Power BI do consumo: [consumo-combustivel-powerbi.md](consumo-combustivel-powerbi.md).
