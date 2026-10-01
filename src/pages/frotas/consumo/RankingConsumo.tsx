import { useMemo, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Input'
import type { ViagemConsumo } from '@/hooks/useConsumoCombustivel'
import { consolidar, cruzarComViagens, indicadoresPorMotorista, type Ciclo } from './dominio'
import { SecaoTitulo, dentroDoPeriodo, fmtMoeda, fmtNum, type Periodo } from './ui'

type Criterio = 'kmL' | 'custoKm' | 'custoT'

interface Props {
  ciclosPorPlaca: Record<string, Ciclo[]>
  viagens: ViagemConsumo[]
  periodo: Periodo
  filtroPeriodo: React.ReactNode
}

interface Linha {
  nome: string
  km: number
  litros: number
  kmL?: number
  custoKm?: number
  custoT?: number
}

// Menor custo é melhor; maior km/L é melhor. Sem dado vai pro fim, sem posição.
function ordenar(linhas: Linha[], criterio: Criterio) {
  const sinal = criterio === 'kmL' ? -1 : 1
  return [...linhas].sort((a, b) => {
    const va = a[criterio]
    const vb = b[criterio]
    if (va == null) return 1
    if (vb == null) return -1
    return sinal * (va - vb)
  })
}

export function RankingConsumo({ ciclosPorPlaca, viagens, periodo, filtroPeriodo }: Props) {
  const [criterio, setCriterio] = useState<Criterio>('kmL')

  const ciclosPeriodo = useMemo(
    () => Object.values(ciclosPorPlaca).flat().filter((c) => c.status === 'fechado' && dentroDoPeriodo(c.dataFim, periodo)),
    [ciclosPorPlaca, periodo],
  )

  const veiculos: Linha[] = useMemo(
    () =>
      Object.entries(ciclosPorPlaca)
        .map(([placa, ciclos]) => {
          const doPeriodo = ciclos.filter((c) => c.status === 'fechado' && dentroDoPeriodo(c.dataFim, periodo))
          const c = consolidar(doPeriodo)
          const cruz = cruzarComViagens(ciclos, viagens.filter((v) => v.placa === placa), periodo)
          return { nome: placa, km: c.km, litros: c.litros, kmL: c.kmL, custoKm: c.custoKm, custoT: cruz.custoTonelada }
        })
        .filter((l) => l.km > 0),
    [ciclosPorPlaca, viagens, periodo],
  )

  const motoristas: Linha[] = useMemo(() => {
    const toneladas = new Map<string, number>()
    for (const v of viagens) {
      if (!v.motorista || !v.toneladas || !dentroDoPeriodo(v.dataHora, periodo)) continue
      const nome = v.motorista.trim().toUpperCase()
      toneladas.set(nome, (toneladas.get(nome) ?? 0) + v.toneladas)
    }
    return indicadoresPorMotorista(ciclosPeriodo)
      .filter((m) => m.km > 0)
      .map((m) => ({
        nome: m.motorista,
        km: m.km,
        litros: m.litros,
        kmL: m.kmL,
        custoKm: m.custoKm,
        custoT: toneladas.get(m.motorista) ? m.custo / toneladas.get(m.motorista)! : undefined,
      }))
  }, [ciclosPeriodo, viagens, periodo])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {filtroPeriodo}
        <Select className="h-10 w-auto text-xs font-bold" value={criterio} onChange={(e) => setCriterio(e.target.value as Criterio)}>
          <option value="kmL">Por KM/L (maior primeiro)</option>
          <option value="custoKm">Por custo/km (menor primeiro)</option>
          <option value="custoT">Por custo/tonelada (menor primeiro)</option>
        </Select>
      </div>
      <p className="text-xs normal-case text-secondary">
        Ferramenta analítica: não altera os dados oficiais. Todas as médias são km total ÷ litros total. No ranking de motoristas, cada trecho
        de um ciclo é atribuído ao motorista do abastecimento que fecha o trecho.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <TabelaRanking titulo="Veículos" linhas={ordenar(veiculos, criterio)} criterio={criterio} />
        <TabelaRanking titulo="Motoristas" linhas={ordenar(motoristas, criterio)} criterio={criterio} />
      </div>
    </div>
  )
}

function TabelaRanking({ titulo, linhas, criterio }: { titulo: string; linhas: Linha[]; criterio: Criterio }) {
  return (
    <Card className="overflow-hidden">
      <div className="p-4">
        <SecaoTitulo titulo={titulo} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-background/60 text-[10px] uppercase text-secondary">
            <tr>
              {['#', titulo === 'Veículos' ? 'Placa' : 'Motorista', 'KM', 'Litros', 'KM/L', 'Custo/km', 'Custo/t'].map((h) => (
                <th key={h} className="whitespace-nowrap px-3 py-2 text-left font-bold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center normal-case text-secondary">
                  Dados insuficientes no período.
                </td>
              </tr>
            )}
            {linhas.map((l, i) => (
              <tr key={l.nome} className="border-t border-border/10">
                <td className="px-3 py-2 tabular-nums text-secondary">{l[criterio] != null ? i + 1 : '—'}</td>
                <td className="px-3 py-2 font-bold text-foreground">{l.nome}</td>
                <td className="px-3 py-2 tabular-nums">{fmtNum(l.km)}</td>
                <td className="px-3 py-2 tabular-nums">{fmtNum(l.litros)}</td>
                <td className={`px-3 py-2 tabular-nums ${criterio === 'kmL' ? 'font-bold text-foreground' : ''}`}>{l.kmL != null ? fmtNum(l.kmL, 2) : '—'}</td>
                <td className={`whitespace-nowrap px-3 py-2 tabular-nums ${criterio === 'custoKm' ? 'font-bold text-foreground' : ''}`}>{fmtMoeda(l.custoKm)}</td>
                <td className={`whitespace-nowrap px-3 py-2 tabular-nums ${criterio === 'custoT' ? 'font-bold text-foreground' : ''}`}>
                  {l.custoT != null ? fmtMoeda(l.custoT) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
