import { useMemo, useState } from 'react'
import { Fuel, Gauge, DollarSign, Droplets, Target, Clock, Route, Weight } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Card } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { Select } from '@/components/ui/Input'
import { useTheme } from '@/contexts/ThemeContext'
import { CHART_CATEGORICAL, CHART_OTHER } from '@/lib/chartColors'
import type { AbastecimentoConsumo, MetaConsumoVeiculo, ViagemConsumo } from '@/hooks/useConsumoCombustivel'
import { classificarSemaforo, consolidar, cruzarComViagens, isArla, type Ciclo, type ConfigConsumo } from './dominio'
import {
  SecaoTitulo,
  SemaforoBadge,
  dentroDoPeriodo,
  fmtKmL,
  fmtMoeda,
  fmtNum,
  fmtPct,
  type Periodo,
  type VeiculoConsumo,
} from './ui'

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

export function PainelConsumo({ veiculos, ciclosPorPlaca, abastecimentos, viagens, metas, config, periodo, filtroPeriodo }: Props) {
  const [placaSel, setPlacaSel] = useState(FROTA)
  const [seriesSel, setSeriesSel] = useState<string[]>([FROTA])

  const ciclosPeriodo = useMemo(() => {
    const r: Record<string, Ciclo[]> = {}
    for (const [placa, ciclos] of Object.entries(ciclosPorPlaca)) {
      r[placa] = ciclos.filter((c) => c.status === 'fechado' && dentroDoPeriodo(c.dataFim, periodo))
    }
    return r
  }, [ciclosPorPlaca, periodo])

  const todosCiclosPeriodo = useMemo(() => Object.values(ciclosPeriodo).flat(), [ciclosPeriodo])
  const ciclosEscopo = placaSel === FROTA ? todosCiclosPeriodo : ciclosPeriodo[placaSel] ?? []
  const cons = consolidar(ciclosEscopo)
  const meta = metaPonderada(ciclosEscopo)

  const abastPeriodo = abastecimentos.filter(
    (a) => a.status !== 'invalidado' && dentroDoPeriodo(a.dataHora, periodo) && (placaSel === FROTA || a.placa === placaSel),
  )
  const litrosDiesel = abastPeriodo.filter((a) => !isArla(a.combustivel)).reduce((s, a) => s + a.litros, 0)
  const litrosArla = abastPeriodo.filter((a) => isArla(a.combustivel)).reduce((s, a) => s + a.litros, 0)
  const valorTotal = abastPeriodo.reduce((s, a) => s + a.valorTotal, 0)
  const comMeta = ciclosEscopo.filter((c) => c.semaforo)
  const pctFora = comMeta.length ? (comMeta.filter((c) => c.semaforo === 'vermelho').length / comMeta.length) * 100 : undefined

  // Por condição de carga (só ciclos com condição conhecida)
  const consCarregado = consolidar(ciclosEscopo.filter((c) => c.condicaoCarga === 'carregado'))
  const consVazio = consolidar(ciclosEscopo.filter((c) => c.condicaoCarga === 'vazio'))

  const cruzamento =
    placaSel === FROTA
      ? cruzarComViagens(todosCiclosPeriodo, viagens, periodo)
      : cruzarComViagens(ciclosPorPlaca[placaSel] ?? [], viagens.filter((v) => v.placa === placaSel), periodo)

  const veiculoSel = veiculos.find((v) => v.placa === placaSel)
  const metaVeiculo = placaSel !== FROTA ? metas[placaSel] : undefined

  // ---------- Tendência mensal ----------
  const meses = useMemo(() => {
    const ini = new Date(periodo.inicio)
    const fim = new Date(periodo.fim)
    const lista: string[] = []
    const d = new Date(ini.getFullYear(), ini.getMonth(), 1)
    while (d <= fim) {
      lista.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
      d.setMonth(d.getMonth() + 1)
    }
    return lista
  }, [periodo])

  const dadosTendencia = useMemo(() => {
    const mesDe = (iso: string) => iso.slice(0, 7)
    return meses.map((m) => {
      const linha: Record<string, number | string | undefined> = {
        mes: `${m.slice(5)}/${m.slice(2, 4)}`,
      }
      for (const s of seriesSel) {
        const ciclos = (s === FROTA ? todosCiclosPeriodo : ciclosPeriodo[s] ?? []).filter((c) => c.dataFim && mesDe(c.dataFim) === m)
        linha[s] = consolidar(ciclos).kmL
      }
      if (seriesSel.length === 1) {
        const ciclos = (seriesSel[0] === FROTA ? todosCiclosPeriodo : ciclosPeriodo[seriesSel[0]] ?? []).filter(
          (c) => c.dataFim && mesDe(c.dataFim) === m,
        )
        linha.meta = metaPonderada(ciclos) ?? (seriesSel[0] !== FROTA ? metas[seriesSel[0]]?.metaKmL : undefined)
      }
      return linha
    })
  }, [meses, seriesSel, todosCiclosPeriodo, ciclosPeriodo, metas])

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
      return {
        v,
        c,
        meta: m,
        desvio: c.kmL && m ? ((c.kmL - m) / m) * 100 : undefined,
        semaforo: c.kmL && m ? classificarSemaforo(c.kmL, m, config) : undefined,
      }
    })
    .filter((r) => r.c.ciclos > 0 || (abastecimentos.some((a) => a.placa === r.v.placa)))

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
      <div className="flex flex-wrap items-center gap-2">
        {filtroPeriodo}
        <Select value={placaSel} onChange={(e) => setPlacaSel(e.target.value)} className="h-10 w-auto min-w-[12rem] text-xs font-bold">
          <option value={FROTA}>Frota inteira</option>
          {veiculos.map((v) => (
            <option key={v.placa} value={v.placa}>
              {v.placa} — {v.nome}
            </option>
          ))}
        </Select>
      </div>

      {placaSel !== FROTA && veiculoSel && (
        <Card className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
          <span className="text-lg font-black text-foreground">{veiculoSel.placa}</span>
          <span className="text-secondary">{veiculoSel.nome}</span>
          <span className="text-secondary">
            Meta: <strong className="text-foreground">{fmtKmL(metaVeiculo?.metaKmL)}</strong>
            {metaVeiculo?.metaKmLCarregado ? ` · carregado ${fmtKmL(metaVeiculo.metaKmLCarregado)}` : ''}
            {metaVeiculo?.metaKmLVazio ? ` · vazio ${fmtKmL(metaVeiculo.metaKmLVazio)}` : ''}
          </span>
          {cons.kmL != null && meta != null && (
            <SemaforoBadge semaforo={classificarSemaforo(cons.kmL, meta, config)} />
          )}
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
        <StatCard icon={Droplets} label="Diesel abastecido" value={`${fmtNum(litrosDiesel)} L`} hint={`ARLA 32: ${fmtNum(litrosArla)} L`} />
        <StatCard icon={Fuel} label="Valor total" value={fmtMoeda(valorTotal)} hint={`${abastPeriodo.length} abastecimento(s)`} />
        <StatCard
          icon={Target}
          label="% fora da meta"
          value={pctFora != null ? `${fmtNum(pctFora, 0)}%` : '—'}
          hint={comMeta.length ? `${comMeta.length} ciclo(s) com meta` : 'Cadastre metas em Configurações'}
        />
        <StatCard icon={Clock} label="L/h" value={cons.lh != null ? fmtNum(cons.lh, 2) : '—'} hint={cons.horas ? `${fmtNum(cons.horas, 1)} h de motor` : 'Sem horímetro nos ciclos'} />
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
        <SecaoTitulo titulo="Tendência de KM/L" descricao="Média oficial por mês (km total / litros total dos ciclos fechados)." />
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[{ placa: FROTA, rotulo: 'Frota inteira' }, ...veiculos.map((v) => ({ placa: v.placa, rotulo: v.placa }))].map((o) => {
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
        <div className="mt-3 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dadosTendencia} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
              <CartesianGrid stroke={corGrid} vertical={false} />
              <XAxis dataKey="mes" tick={{ fill: corEixo, fontSize: 11 }} axisLine={{ stroke: corGrid }} tickLine={false} />
              <YAxis
                tick={{ fill: corEixo, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                domain={['auto', 'auto']}
                tickFormatter={(v: number) => v.toFixed(1).replace('.', ',')}
              />
              <Tooltip
                contentStyle={{
                  background: isDark ? '#1c1c1c' : '#ffffff',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                  borderRadius: 12,
                  fontSize: 12,
                }}
                labelStyle={{ color: isDark ? '#fff' : '#18181b', fontWeight: 700 }}
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
              {seriesSel.length === 1 && (
                <Line type="monotone" dataKey="meta" name="Meta" stroke={CHART_OTHER} strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
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
              {resumoVeiculos.map(({ v, c, meta: m, desvio, semaforo }) => (
                <tr
                  key={v.placa}
                  className="cursor-pointer border-t border-border/10 hover:bg-overlay/[0.04]"
                  onClick={() => setPlacaSel(v.placa)}
                >
                  <td className="whitespace-nowrap px-3 py-2 font-bold text-foreground">{v.placa}</td>
                  <td className="px-3 py-2 tabular-nums">{c.ciclos}</td>
                  <td className="px-3 py-2 tabular-nums">{fmtNum(c.km)}</td>
                  <td className="px-3 py-2 tabular-nums">{fmtNum(c.litros)}</td>
                  <td className="px-3 py-2 font-bold tabular-nums text-foreground">{c.kmL != null ? fmtNum(c.kmL, 2) : '—'}</td>
                  <td className="px-3 py-2 tabular-nums">{m ? fmtNum(m, 2) : '—'}</td>
                  <td className="px-3 py-2 tabular-nums">{fmtPct(desvio)}</td>
                  <td className="px-3 py-2 tabular-nums">{c.lh != null ? fmtNum(c.lh, 2) : '—'}</td>
                  <td className="px-3 py-2 tabular-nums">{fmtMoeda(c.custoKm)}</td>
                  <td className="px-3 py-2">{c.ciclos ? <SemaforoBadge semaforo={semaforo} /> : <span className="text-secondary">Sem ciclo</span>}</td>
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
