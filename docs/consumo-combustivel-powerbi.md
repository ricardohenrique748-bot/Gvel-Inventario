# Consumo de combustível — modelo para Power BI

Views criadas pela migration `supabase/migrations/0090_consumo_combustivel.sql`. Todas usam
`security_invoker`, ou seja, respeitam o RLS: quem conecta só enxerga a empresa ativa do usuário.

Conexão: Postgres do Supabase (Power BI → *Obter dados → Banco de dados PostgreSQL*), com um
usuário de leitura.

## Tabelas

| View | Grão | Chaves |
|---|---|---|
| `fato_abastecimento` | 1 linha por abastecimento (diesel; registros antigos de ARLA podem existir — a tela não usa mais ARLA desde out/2026) | `id`, `placa`, `motorista`, `posto_id`, `data` |
| `fato_ciclo` | 1 linha por ciclo tanque cheio → tanque cheio | `abastecimento_inicio_id`, `placa`, `data_referencia` |
| `fato_viagem` | 1 linha por viagem (manual ou MoveTruck) | `id`, `placa`, `motorista`, `data` |
| `dim_veiculo` | 1 linha por placa | `placa` (+ metas e capacidade) |
| `dim_motorista` | 1 linha por motorista | `motorista` |
| `dim_posto` | 1 linha por posto | `id` |
| `dim_data` | 1 linha por dia (2024 → hoje + 1 ano) | `data` |

Observações:

- `placa` sempre vem normalizada (`ABC1234`, sem traço).
- `fato_ciclo.status`: `fechado` (entra na média oficial), `aberto` (ainda sem o tanque cheio final)
  ou `invalidado` (km ≤ 0, sem odômetro ou com abastecimento pendente de revisão).
- `fato_ciclo.data_referencia` é a data do tanque cheio que **fecha** o ciclo. O consumo é atribuído
  ao período em que o ciclo fecha.
- `fato_abastecimento.litros_diesel` e `litros_arla` são colunas separadas. ARLA 32 nunca entra em km/L.
- `fato_ciclo` não traz a condição de carga, que é derivada das viagens no app. No BI, cruze pela
  placa e pelo intervalo `data_inicio`–`data_fim` se precisar.

## Relações

```
dim_data[data]          1 ──* fato_abastecimento[data]
dim_data[data]          1 ──* fato_ciclo[data_referencia]
dim_data[data]          1 ──* fato_viagem[data]
dim_veiculo[placa]      1 ──* fato_abastecimento[placa]
dim_veiculo[placa]      1 ──* fato_ciclo[placa]
dim_veiculo[placa]      1 ──* fato_viagem[placa]
dim_motorista[motorista] 1 ──* fato_abastecimento[motorista]
dim_motorista[motorista] 1 ──* fato_viagem[motorista]
dim_posto[id]           1 ──* fato_abastecimento[posto_id]
```

Filtro sempre em direção única (dimensão → fato). Marque `dim_data` como tabela de datas.

## Medidas DAX

Regra do módulo: **média = soma de km ÷ soma de litros** em qualquer nível (ciclo, veículo,
motorista, período, frota). Nunca usar `AVERAGE` sobre uma coluna de km/L.

```dax
Ciclos Fechados =
CALCULATE ( COUNTROWS ( fato_ciclo ), fato_ciclo[status] = "fechado" )

KM Total =
CALCULATE ( SUM ( fato_ciclo[km] ), fato_ciclo[status] = "fechado" )

Litros Total =
CALCULATE ( SUM ( fato_ciclo[litros] ), fato_ciclo[status] = "fechado" )

KM/L =
DIVIDE ( [KM Total], [Litros Total] )

L/100km =
DIVIDE ( [Litros Total], [KM Total] ) * 100

Horas Total =
CALCULATE (
    SUM ( fato_ciclo[horas] ),
    fato_ciclo[status] = "fechado",
    NOT ISBLANK ( fato_ciclo[horas] )
)

L/h =
DIVIDE (
    CALCULATE (
        SUM ( fato_ciclo[litros] ),
        fato_ciclo[status] = "fechado",
        NOT ISBLANK ( fato_ciclo[horas] )
    ),
    [Horas Total]
)

Custo Total =
CALCULATE ( SUM ( fato_ciclo[custo_total] ), fato_ciclo[status] = "fechado" )

Custo/km =
DIVIDE ( [Custo Total], [KM Total] )

-- Meta ponderada: km ÷ (litros que a meta permitiria)
Meta KM/L =
VAR LitrosMeta =
    SUMX (
        FILTER ( fato_ciclo, fato_ciclo[status] = "fechado" && fato_ciclo[meta_km_l] > 0 ),
        DIVIDE ( fato_ciclo[km], fato_ciclo[meta_km_l] )
    )
VAR KmComMeta =
    CALCULATE (
        SUM ( fato_ciclo[km] ),
        fato_ciclo[status] = "fechado",
        fato_ciclo[meta_km_l] > 0
    )
RETURN DIVIDE ( KmComMeta, LitrosMeta )

Desvio da Meta % =
DIVIDE ( [KM/L] - [Meta KM/L], [Meta KM/L] )

-- Ciclo fora da meta = mais de 15% abaixo (mesmo padrão do semáforo vermelho do app;
-- ajuste se mudar o parâmetro em Configurações).
Percentual Fora da Meta =
VAR ComMeta =
    FILTER ( fato_ciclo, fato_ciclo[status] = "fechado" && fato_ciclo[meta_km_l] > 0 )
VAR Fora =
    FILTER ( ComMeta, DIVIDE ( fato_ciclo[km], fato_ciclo[litros] ) < fato_ciclo[meta_km_l] * 0.85 )
RETURN DIVIDE ( COUNTROWS ( Fora ), COUNTROWS ( ComMeta ) )

Toneladas Transportadas =
SUM ( fato_viagem[toneladas] )

Custo/tonelada =
DIVIDE ( [Custo Total], [Toneladas Transportadas] )

-- t·km/L = Σ(toneladas × km de cada viagem) ÷ litros
t·km/L =
DIVIDE (
    SUMX (
        FILTER ( fato_viagem, fato_viagem[toneladas] > 0 && fato_viagem[km] > 0 ),
        fato_viagem[toneladas] * fato_viagem[km]
    ),
    [Litros Total]
)

Litros Diesel Abastecidos =
CALCULATE ( SUM ( fato_abastecimento[litros_diesel] ), fato_abastecimento[status] <> "invalidado" )

Litros ARLA =
CALCULATE ( SUM ( fato_abastecimento[litros_arla] ), fato_abastecimento[status] <> "invalidado" )
```

`Litros Diesel Abastecidos` é o volume que entrou nos tanques no período, incluindo ciclos ainda
abertos. Para média, use sempre `Litros Total`, que conta só ciclos fechados.
