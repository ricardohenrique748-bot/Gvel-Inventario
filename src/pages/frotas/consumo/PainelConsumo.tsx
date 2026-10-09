import { useCallback, useMemo, useState } from 'react'
import { Fuel, Gauge, DollarSign, Droplets, Target, Clock, Route, Weight } from 'lucide-react'
import { LineChart, Line, BarChart, Bar, LabelList, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Card } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { Select } from '@/components/ui/Input'
import { useTheme } from '@/contexts/ThemeContext'
import { CHART_CATEGORICAL, CHART_OTHER } from '@/lib/chartColors'
import type { AbastecimentoConsumo, MetaConsumoVeiculo, ViagemConsumo } from '@/hooks/useConsumoCombustivel'
import { classificarSemaforo, consolidar, cruzarComViagens, isArla, type Ciclo, type ConfigConsumo } from './dominio'
import { SecaoTitulo, SemaforoBadge, dentroDoPeriodo, fmtKmL, fmtMoeda, fmtNum, fmtPct, type Periodo, type VeiculoConsumo } from './ui'

interface Props {
  veiculos: VeiculoConsumo[]
  ciclosPorPlaca: Record<string, Ciclo[]>
  abastecimentos: AbastecimentoConsumo[]
  viagens: ViagemConsumo[]
  metas: Record<string, MetaConsumoVeiculo>
  config: ConfigConsumo
  periodo: Periodo
  filtroPeriodo: React.ReactNode
}

const FROTA = '__frota__'
const MAX_SERIES = CHART_CATEGORICAL.length

/** Meta ponderada de um conjunto de ciclos: km / Σ(km/meta) — os litros que a meta "permitiria". */
function metaPonderada(ciclos: Ciclo[]): number | undefined {
  const comMeta = ciclos.filter((c) => c.status === 'fechado' && c.meta)
  const km = comMeta.reduce((s, c) => s + c.km, 0)
  const litrosMeta = comMeta.reduce((s, c) => s + c.km / c.meta!, 0)
  return litrosMeta > 0 ? km / litrosMeta : undefined
}

type AgrupamentoTempo = 'mes' | 'semana' | 'dia'

const ROTULO_AGRUPAMENTO: Record<AgrupamentoTempo, string> = { mes: 'Mês', semana: 'Semana', dia: 'Dia' }

/** Chave ordenável do grupo (data local): YYYY-MM, segunda-feira da semana ou o dia. */
function chaveTempo(iso: string, ag: AgrupamentoTempo): string {
  const d = new Date(iso)
  const dois = (n: number) => String(n).padStart(2, '0')
  if (ag === 'mes') return `${d.getFullYear()}-${dois(d.getMonth() + 1)}`
  const base = ag === 'semana' ? new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)) : d
  return `${base.getFullYear()}-${dois(base.getMonth() + 1)}-${dois(base.getDate())}`
}

function rotuloTempo(chave: string, ag: AgrupamentoTempo): string {
  if (ag === 'mes') return `${chave.slice(5, 7)}/${chave.slice(2, 4)}`
  const dm = `${chave.slice(8, 10)}/${chave.slice(5, 7)}`
  return ag === 'semana' ? `sem. ${dm}` : dm
}

export function PainelConsumo({ veiculos, ciclosPorPlaca, abastecimentos, viagens, metas, config, periodo, filtroPeriodo }: Props) {
  const [placaSel, setPlacaSel] = useState(FROTA)
  const [seriesSel, setSeriesSel] = useState<string[]>([FROTA])
  const [agrupamento, setAgrupamento] = useState<'semana' | 'mes'>('semana')
  const [agrupamentoPlaca, setAgrupamentoPlaca] = useState<AgrupamentoTempo>('semana')

  const ciclosPeriodo = useMemo(() => {
    const r: Record<string, Ciclo[]> = {}
    for (const [placa, ciclos] of Object.entries(ciclosPorPlaca)) {
      r[placa] = ciclos.filter((c) => c.status === 'fechado' && dentroDoPeriodo(c.dataFim, periodo))
    }
    return r
  }, [ciclosPorPlaca, periodo])

  const todosCiclosPeriodo = useMemo(() => Object.values(ciclosPeriodo).flat(), [ciclosPeriodo])
  const ciclosEscopo = placaSel === FROTA ? todosCiclosPeriodo : (ciclosPeriodo[placaSel] ?? [])
  const cons = consolidar(ciclosEscopo)
  const meta = metaPonderada(ciclosEscopo)

  const abastPeriodo = abastecimentos.filter(
    (a) => a.status !== 'invalidado' && dentroDoPeriodo(a.dataHora, periodo) && (placaSel === FROTA || a.placa === placaSel),
  )
  // ARLA fica fora do valor total: o painel é de consumo de diesel.
  const abastDiesel = abastPeriodo.filter((a) => !isArla(a.combustivel))
  const litrosDiesel = abastDiesel.reduce((s, a) => s + a.litros, 0)
  const valorTotal = abastDiesel.reduce((s, a) => s + a.valorTotal, 0)
  const comMeta = ciclosEscopo.filter((c) => c.semaforo)
  const pctFora = comMeta.length ? (comMeta.filter((c) => c.semaforo === 'vermelho').length / comMeta.length) * 100 : undefined

  // Por condição de carga (só ciclos com condição conhecida)
  const consCarregado = consolidar(ciclosEscopo.filter((c) => c.condicaoCarga === 'carregado'))
  const consVazio = consolidar(ciclosEscopo.filter((c) => c.condicaoCarga === 'vazio'))

  const cruzamento =
    placaSel === FROTA
      ? cruzarComViagens(todosCiclosPeriodo, viagens, periodo)
      : cruzarComViagens(
          ciclosPorPlaca[placaSel] ?? [],
          viagens.filter((v) => v.placa === placaSel),
          periodo,
        )

  const veiculoSel = veiculos.find((v) => v.placa === placaSel)
  const metaVeiculo = placaSel !== FROTA ? metas[placaSel] : undefined

  // ---------- Tendência (por semana ou mês) ----------
  // Chave do grupo de um ciclo pela data de fechamento: segunda-feira da
  // semana (YYYY-MM-DD) ou o mês (YYYY-MM).
  const chaveGrupo = useCallback(
    (iso: string) => {
      const d = new Date(iso)
      if (agrupamento === 'mes') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const seg = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7))
      return `${seg.getFullYear()}-${String(seg.getMonth() + 1).padStart(2, '0')}-${String(seg.getDate()).padStart(2, '0')}`
    },
    [agrupamento],
  )

  // Eixo X do primeiro ao último grupo com ciclo fechado (sem pontas vazias),
  // preenchendo os buracos para o espaçamento refletir o tempo.
  const grupos = useMemo(() => {
    const datas = todosCiclosPeriodo
      .map((c) => c.dataFim)
      .filter((d): d is string => !!d)
      .sort()
    if (!datas.length) return []
    const lista: string[] = []
    const fim = chaveGrupo(datas[datas.length - 1])
    const d = new Date(datas[0])
    for (let i = 0; i < 400; i++) {
      const k = chaveGrupo(d.toISOString())
      if (lista[lista.length - 1] !== k) lista.push(k)
      if (k === fim) break
      if (agrupamento === 'mes') d.setMonth(d.getMonth() + 1, 1)
      else d.setDate(d.getDate() + 7)
    }
    return lista
  }, [todosCiclosPeriodo, chaveGrupo, agrupamento])

  const dadosTendencia = useMemo(() => {
    const rotulo = (k: string) => (agrupamento === 'mes' ? `${k.slice(5, 7)}/${k.slice(2, 4)}` : `${k.slice(8, 10)}/${k.slice(5, 7)}`)
    return grupos.map((g) => {
      const linha: Record<string, number | string | undefined> = {
        grupo: rotulo(g),
      }
      const doGrupo = (s: string) =>
        (s === FROTA ? todosCiclosPeriodo : (ciclosPeriodo[s] ?? [])).filter((c) => c.dataFim && chaveGrupo(c.dataFim) === g)
      for (const s of seriesSel) linha[s] = consolidar(doGrupo(s)).kmL
      if (seriesSel.length === 1) {
        linha.meta = metaPonderada(doGrupo(seriesSel[0])) ?? (seriesSel[0] !== FROTA ? metas[seriesSel[0]]?.metaKmL : undefined)
      }
      return linha
    })
  }, [grupos, agrupamento, chaveGrupo, seriesSel, todosCiclosPeriodo, ciclosPeriodo, metas])

  const temMeta = dadosTendencia.some((l) => typeof l.meta === 'number')
  // Escala vertical justa aos valores (com folga), nunca abaixo de zero.
  const valoresTendencia = dadosTendencia.flatMap((l) =>
    [...seriesSel, ...(temMeta ? ['meta'] : [])].map((k) => l[k]).filter((v): v is number => typeof v === 'number'),
  )
  const dominioY: [number, number] = valoresTendencia.length
    ? [Math.max(0, Math.floor((Math.min(...valoresTendencia) - 0.3) * 2) / 2), Math.ceil((Math.max(...valoresTendencia) + 0.3) * 2) / 2]
    : [0, 3]
  // Só placas com ciclo fechado no período viram opção de série.
  const placasComCiclo = veiculos.filter((v) => (ciclosPeriodo[v.placa] ?? []).length > 0)

  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const corEixo = isDark ? '#9A9A9A' : '#475569'
  const corGrid = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'

  // ---------- Resumo por caminhão ----------
  const resumoVeiculos = veiculos
    .map((v) => {
      const ciclos = ciclosPeriodo[v.placa] ?? []
      const c = consolidar(ciclos)
      const m = metaPonderada(ciclos) ?? metas[v.placa]?.metaKmL
      // Sem ciclo fechado: explica o porquê com o último ciclo do veículo.
      // O inválido tem prioridade: o último ciclo é quase sempre o aberto.
      const todos = ciclosPorPlaca[v.placa] ?? []
      const invalido = todos.filter((x) => x.status === 'invalidado' && dentroDoPeriodo(x.dataFim, periodo)).at(-1)
      const ultimo = todos.at(-1)
      const semCiclo = invalido
        ? `Ciclo inválido: ${invalido.motivoStatus ?? 'verifique os abastecimentos'}`
        : !ultimo
          ? 'Sem tanque cheio'
          : ultimo.status === 'aberto'
            ? 'Ciclo aberto (aguardando próximo tanque cheio)'
            : 'Sem ciclo no período'
      return {
        v,
        semCiclo,
        c,
        meta: m,
        desvio: c.kmL && m ? ((c.kmL - m) / m) * 100 : undefined,
        semaforo: c.kmL && m ? classificarSemaforo(c.kmL, m, config) : undefined,
      }
    })
    // Só placas com ciclo ou abastecimento de diesel válido no período (ARLA não forma ciclo).
    .filter(
      (r) =>
        r.c.ciclos > 0 ||
        abastecimentos.some(
          (a) => a.placa === r.v.placa && a.status !== 'invalidado' && !isArla(a.combustivel) && dentroDoPeriodo(a.dataHora, periodo),
        ),
    )

  // Maior média primeiro; só quem tem ciclo fechado no período. Com um
  // caminhão escolhido no filtro, mostra só ele.
  const kmLPorPlaca = resumoVeiculos
    .filter((r) => r.c.kmL != null && (placaSel === FROTA || r.v.placa === placaSel))
    .map((r) => ({
      placa: r.v.placa,
      kmL: r.c.kmL!,
      km: r.c.km,
      ciclos: r.c.ciclos,
    }))
    .sort((a, b) => b.kmL - a.kmL)

  // Frota inteira: uma barra por placa. Caminhão escolhido: a média dele ao
  // longo do tempo, por mês, semana ou dia (data de fechamento do ciclo).
  const barrasKmL: { rotulo: string; kmL: number; km: number; ciclos: number }[] =
    placaSel === FROTA
      ? kmLPorPlaca.map((p) => ({ rotulo: p.placa, kmL: p.kmL, km: p.km, ciclos: p.ciclos }))
      : (() => {
          const grupos = new Map<string, Ciclo[]>()
          for (const c of ciclosPeriodo[placaSel] ?? []) {
            if (!c.dataFim) continue
            const k = chaveTempo(c.dataFim, agrupamentoPlaca)
            grupos.set(k, [...(grupos.get(k) ?? []), c])
          }
          return [...grupos.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, ciclos]) => ({ rotulo: rotuloTempo(k, agrupamentoPlaca), ...consolidar(ciclos) }))
            .filter((b): b is typeof b & { kmL: number } => b.kmL != null)
            .map((b) => ({ rotulo: b.rotulo, kmL: b.kmL, km: b.km, ciclos: b.ciclos }))
        })()
  // Topo do eixo em múltiplo de 0,5 com folga para o rótulo acima da barra.
  const tetoBarras = Math.max(1, Math.ceil((Math.max(0, ...barrasKmL.map((b) => b.kmL)) + 0.2) * 2) / 2)

  function alternarSerie(id: string) {
    setSeriesSel((atual) => {
      if (id === FROTA) return [FROTA]
      const semFrota = atual.filter((s) => s !== FROTA)
      if (semFrota.includes(id)) {
        const r = semFrota.filter((s) => s !== id)
        return r.length ? r : [FROTA]
      }
      return semFrota.length >= MAX_SERIES ? semFrota : [...semFrota, id]
    })
  }

  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-end gap-x-6 gap-y-3 p-3">
        <div className="space-y-1">
          <span className="block text-[10px] font-bold uppercase text-secondary">Período</span>
          {filtroPeriodo}
        </div>
        <div className="space-y-1">
          <label htmlFor="painelCaminhao" className="block text-[10px] font-bold uppercase text-secondary">
            Caminhão
          </label>
          <Select id="painelCaminhao" value={placaSel} onChange={(e) => setPlacaSel(e.target.value)} className="h-9 w-64 max-w-full px-3 text-xs font-bold">
            <option value={FROTA}>Frota inteira</option>
            {veiculos.map((v) => (
              <option key={v.placa} value={v.placa}>
                {v.placa} — {v.nome}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {placaSel !== FROTA && veiculoSel && (
        <Card className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
          <span className="text-lg font-black text-foreground">{veiculoSel.placa}</span>
          <span className="text-secondary">{veiculoSel.nome}</span>
          <span className="text-secondary">
            Meta: <strong className="text-foreground">{fmtKmL(metaVeiculo?.metaKmL)}</strong>
            {metaVeiculo?.metaKmLCarregado ? ` · carregado ${fmtKmL(metaVeiculo.metaKmLCarregado)}` : ''}
            {metaVeiculo?.metaKmLVazio ? ` · vazio ${fmtKmL(metaVeiculo.metaKmLVazio)}` : ''}
          </span>
          {cons.kmL != null && meta != null && <SemaforoBadge semaforo={classificarSemaforo(cons.kmL, meta, config)} />}
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={Gauge}
          label={placaSel === FROTA ? 'KM/L da frota' : 'KM/L atual'}
          value={cons.kmL != null ? fmtNum(cons.kmL, 2) : '—'}
          hint={
            cons.ciclos
              ? `${cons.ciclos} ciclo(s) fechado(s)${meta ? ` · meta ${fmtNum(meta, 2)} (${fmtPct(((cons.kmL! - meta) / meta) * 100)})` : ''}`
              : 'Sem ciclo fechado no período'
          }
        />
        <StatCard icon={DollarSign} label="Custo/km" value={fmtMoeda(cons.custoKm)} hint={`${fmtNum(cons.km)} km nos ciclos`} />
        <StatCard icon={Droplets} label="Diesel abastecido" value={`${fmtNum(litrosDiesel)} L`} />
        <StatCard icon={Fuel} label="Valor total" value={fmtMoeda(valorTotal)} hint={`${abastDiesel.length} abastecimento(s) de diesel`} />
        <StatCard
          icon={Target}
          label="% fora da meta"
          value={pctFora != null ? `${fmtNum(pctFora, 0)}%` : '—'}
          hint={comMeta.length ? `${comMeta.length} ciclo(s) com meta` : 'Cadastre metas em Configurações'}
        />
        <StatCard
          icon={Clock}
          label="L/h"
          value={cons.lh != null ? fmtNum(cons.lh, 2) : '—'}
          hint={cons.horas ? `${fmtNum(cons.horas, 1)} h de motor` : 'Sem horímetro nos ciclos'}
        />
        <StatCard
          icon={Weight}
          label="KM/L carregado"
          value={consCarregado.kmL != null ? fmtNum(consCarregado.kmL, 2) : '—'}
          hint={consCarregado.ciclos ? `${consCarregado.ciclos} ciclo(s)` : 'Dados insuficientes'}
        />
        <StatCard
          icon={Route}
          label="KM/L vazio"
          value={consVazio.kmL != null ? fmtNum(consVazio.kmL, 2) : '—'}
          hint={consVazio.ciclos ? `${consVazio.ciclos} ciclo(s)` : 'Dados insuficientes'}
        />
      </div>

      {/* Cruzamento com viagens */}
      <Card className="p-4">
        <SecaoTitulo
          titulo="Abastecimentos × viagens no período"
          descricao="Consumo dos ciclos fechados cruzado com as viagens (registradas ou importadas do MoveTruck)."
        />
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:grid-cols-7">
          <Info label="KM" valor={fmtNum(cruzamento.km)} />
          <Info label="Diesel" valor={`${fmtNum(cruzamento.litros)} L`} />
          <Info label="Média" valor={fmtKmL(cruzamento.kmL)} />
          <Info label="Viagens" valor={fmtNum(cruzamento.viagens)} />
          <Info label="Toneladas" valor={cruzamento.toneladas != null ? `${fmtNum(cruzamento.toneladas, 1)} t` : 'Dados insuficientes'} />
          <Info label="t·km/L" valor={cruzamento.tkmL != null ? fmtNum(cruzamento.tkmL, 2) : 'Dados insuficientes'} />
          <Info label="Custo/t" valor={cruzamento.custoTonelada != null ? fmtMoeda(cruzamento.custoTonelada) : 'Dados insuficientes'} />
        </dl>
        {cruzamento.insuficiente.length > 0 && (
          <p className="mt-3 text-xs normal-case text-status-warning">DADOS INSUFICIENTES: {cruzamento.insuficiente.join(' · ')}.</p>
        )}
      </Card>

      {/* Tendência */}
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <SecaoTitulo
            titulo="Tendência de KM/L"
            descricao={`Média oficial por ${agrupamento === 'mes' ? 'mês' : 'semana'} (km total / litros total dos ciclos fechados em cada ${agrupamento === 'mes' ? 'mês' : 'semana'}).`}
          />
          <div className="flex rounded-lg border border-border/30 p-0.5">
            {(['semana', 'mes'] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAgrupamento(a)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${agrupamento === a ? 'bg-primary text-white' : 'text-secondary hover:text-foreground'}`}
              >
                {a === 'mes' ? 'Mês' : 'Semana'}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[{ placa: FROTA, rotulo: 'Frota inteira' }, ...placasComCiclo.map((v) => ({ placa: v.placa, rotulo: v.placa }))].map((o) => {
            const ativo = seriesSel.includes(o.placa)
            return (
              <button
                key={o.placa}
                type="button"
                onClick={() => alternarSerie(o.placa)}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold ${
                  ativo ? 'border-primary bg-primary/10 text-foreground' : 'border-border/30 text-secondary hover:border-secondary'
                }`}
              >
                {o.rotulo}
              </button>
            )
          })}
          <span className="self-center text-[10px] normal-case text-secondary">até {MAX_SERIES} caminhões ao mesmo tempo</span>
        </div>
        {dadosTendencia.length === 0 ? (
          <p className="mt-3 text-xs normal-case text-secondary">Nenhum ciclo fechado no período.</p>
        ) : (
          <div className="mt-3 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dadosTendencia} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
                <CartesianGrid stroke={corGrid} vertical={false} />
                <XAxis dataKey="grupo" tick={{ fill: corEixo, fontSize: 11 }} axisLine={{ stroke: corGrid }} tickLine={false} />
                <YAxis
                  tick={{ fill: corEixo, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  domain={dominioY}
                  allowDataOverflow={false}
                  tickFormatter={(v: number) => v.toFixed(1).replace('.', ',')}
                />
                <Tooltip
                  contentStyle={{
                    background: isDark ? '#1c1c1c' : '#ffffff',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  labelStyle={{
                    color: isDark ? '#fff' : '#18181b',
                    fontWeight: 700,
                  }}
                  formatter={(v) => (typeof v === 'number' ? `${v.toFixed(2).replace('.', ',')} km/L` : '—')}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {seriesSel.map((s, i) => (
                  <Line
                    key={s}
                    type="monotone"
                    dataKey={s}
                    name={s === FROTA ? 'Frota (real)' : `${s} (real)`}
                    stroke={CHART_CATEGORICAL[i % MAX_SERIES]}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    connectNulls
                  />
                ))}
                {seriesSel.length === 1 && temMeta && (
                  <Line
                    type="monotone"
                    dataKey="meta"
                    name="Meta"
                    stroke={CHART_OTHER}
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={false}
                    connectNulls
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* KM/L por placa */}
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          {placaSel === FROTA ? (
            <SecaoTitulo titulo="KM/L por placa" descricao="Média do período por caminhão (km total / litros total dos ciclos fechados)." />
          ) : (
            <SecaoTitulo
              titulo={`KM/L de ${placaSel} por ${ROTULO_AGRUPAMENTO[agrupamentoPlaca].toLowerCase()}`}
              descricao="Km total / litros total dos ciclos fechados em cada período (pela data do tanque cheio que fechou o ciclo)."
            />
          )}
          {placaSel !== FROTA && (
            <div role="group" aria-label="Agrupar por" className="flex rounded-lg border border-border/30 p-0.5">
              {(['mes', 'semana', 'dia'] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  aria-pressed={agrupamentoPlaca === a}
                  onClick={() => setAgrupamentoPlaca(a)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${
                    agrupamentoPlaca === a ? 'bg-primary text-white' : 'text-secondary hover:text-foreground'
                  }`}
                >
                  {ROTULO_AGRUPAMENTO[a]}
                </button>
              ))}
            </div>
          )}
        </div>
        {barrasKmL.length === 0 ? (
          <p className="mt-3 text-xs normal-case text-secondary">
            {placaSel === FROTA ? 'Nenhum caminhão com ciclo fechado no período.' : `${placaSel} não tem ciclo fechado no período.`}
          </p>
        ) : (
          <div className="mt-3 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barrasKmL} margin={{ top: 24, right: 16, bottom: 0, left: -8 }}>
                <CartesianGrid stroke={corGrid} vertical={false} />
                <XAxis dataKey="rotulo" tick={{ fill: corEixo, fontSize: 11 }} axisLine={{ stroke: corGrid }} tickLine={false} />
                <YAxis
                  tick={{ fill: corEixo, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, tetoBarras]}
                  ticks={Array.from({ length: tetoBarras * 2 + 1 }, (_, i) => i / 2)}
                  tickFormatter={(v: number) => v.toFixed(1).replace('.', ',')}
                />
                <Tooltip
                  cursor={{
                    fill: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                  }}
                  contentStyle={{
                    background: isDark ? '#1c1c1c' : '#ffffff',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  labelStyle={{
                    color: isDark ? '#fff' : '#18181b',
                    fontWeight: 700,
                  }}
                  itemStyle={{ color: isDark ? '#d4d4d4' : '#3f3f46' }}
                  formatter={(v, _n, item) => [
                    `${typeof v === 'number' ? v.toFixed(2).replace('.', ',') : '—'} km/L · ${fmtNum(item.payload.km)} km · ${fmtNum(item.payload.ciclos)} ciclo(s)`,
                    'Média',
                  ]}
                />
                <Bar dataKey="kmL" name="KM/L" fill={CHART_CATEGORICAL[0]} radius={[4, 4, 0, 0]} maxBarSize={48}>
                  <LabelList
                    dataKey="kmL"
                    position="top"
                    offset={6}
                    fill={isDark ? '#e5e5e5' : '#18181b'}
                    fontSize={barrasKmL.length > 16 ? 9 : 12}
                    fontWeight={700}
                    formatter={(v) => (typeof v === 'number' ? v.toFixed(2).replace('.', ',') : '')}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Resumo por caminhão */}
      <Card className="overflow-hidden">
        <div className="p-4">
          <SecaoTitulo titulo="Por caminhão" descricao="Ciclos fechados no período." />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-background/60 text-[10px] uppercase text-secondary">
              <tr>
                {['Placa', 'Ciclos', 'KM', 'Litros', 'KM/L', 'Meta', 'Desvio', 'L/h', 'Custo/km', 'Situação'].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2 text-left font-bold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resumoVeiculos.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center normal-case text-secondary">
                    Nenhum abastecimento registrado ainda.
                  </td>
                </tr>
              )}
              {resumoVeiculos.map(({ v, c, meta: m, desvio, semaforo, semCiclo }) => (
                <tr key={v.placa} className="cursor-pointer border-t border-border/10 hover:bg-overlay/[0.04]" onClick={() => setPlacaSel(v.placa)}>
                  <td className="whitespace-nowrap px-3 py-2 font-bold text-foreground">{v.placa}</td>
                  <td className="px-3 py-2 tabular-nums">{c.ciclos}</td>
                  <td className="px-3 py-2 tabular-nums">{fmtNum(c.km)}</td>
                  <td className="px-3 py-2 tabular-nums">{fmtNum(c.litros)}</td>
                  <td className="px-3 py-2 font-bold tabular-nums text-foreground">{c.kmL != null ? fmtNum(c.kmL, 2) : '—'}</td>
                  <td className="px-3 py-2 tabular-nums">{m ? fmtNum(m, 2) : '—'}</td>
                  <td className="px-3 py-2 tabular-nums">{fmtPct(desvio)}</td>
                  <td className="px-3 py-2 tabular-nums">{c.lh != null ? fmtNum(c.lh, 2) : '—'}</td>
                  <td className="px-3 py-2 tabular-nums">{fmtMoeda(c.custoKm)}</td>
                  <td className="px-3 py-2">
                    {c.ciclos ? <SemaforoBadge semaforo={semaforo} /> : <span className="text-secondary normal-case">{semCiclo}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function Info({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase text-secondary">{label}</dt>
      <dd className="font-bold text-foreground">{valor}</dd>
    </div>
  )
}
