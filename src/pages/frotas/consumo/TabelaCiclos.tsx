import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Input'
import { exportRowsToCsv } from '@/lib/csv'
import { HIPOTESES_QUEDA_CONTINUA, TIPO_ALERTA_LABEL, type Ciclo } from './dominio'
import { SemaforoBadge, StatusCicloBadge, dentroDoPeriodo, fmtData, fmtMoeda, fmtNum, fmtPct, type Periodo, type VeiculoConsumo } from './ui'

interface Props {
  ciclosPorPlaca: Record<string, Ciclo[]>
  veiculos: VeiculoConsumo[]
  periodo: Periodo
  filtroPeriodo: React.ReactNode
}

export function TabelaCiclos({ ciclosPorPlaca, veiculos, periodo, filtroPeriodo }: Props) {
  const [placa, setPlaca] = useState('')
  const [status, setStatus] = useState('')

  const linhas = useMemo(() => {
    return Object.values(ciclosPorPlaca)
      .flatMap((ciclos) => ciclos.map((c, i) => ({ c, numero: i + 1 })))
      .filter(
        ({ c }) =>
          (!placa || c.placa === placa) &&
          (!status || c.status === status) &&
          // ciclo aberto aparece sempre (é o estado atual); os demais pelo fim
          (c.status === 'aberto' || dentroDoPeriodo(c.dataFim, periodo)),
      )
      .sort((a, b) => (b.c.dataFim ?? b.c.dataInicio).localeCompare(a.c.dataFim ?? a.c.dataInicio))
  }, [ciclosPorPlaca, placa, status, periodo])

  function exportar() {
    exportRowsToCsv(
      'ciclos-consumo.csv',
      ['Ciclo', 'Placa', 'Data inicial', 'Data final', 'Odômetro inicial', 'Odômetro final', 'KM', 'Litros', 'KM/L', 'L/h', 'Custo', 'Custo/km', 'Meta', 'Desvio %', 'Status', 'Anomalias'],
      linhas.map(({ c, numero }) => [
        String(numero),
        c.placa,
        fmtData(c.dataInicio),
        fmtData(c.dataFim),
        String(c.inicio.odometro ?? ''),
        String(c.fim?.odometro ?? ''),
        String(c.km),
        c.litros.toFixed(1).replace('.', ','),
        c.kmL != null ? c.kmL.toFixed(3).replace('.', ',') : '',
        c.lh != null ? c.lh.toFixed(2).replace('.', ',') : '',
        c.custoTotal.toFixed(2).replace('.', ','),
        c.custoKm != null ? c.custoKm.toFixed(3).replace('.', ',') : '',
        c.meta != null ? c.meta.toFixed(2).replace('.', ',') : '',
        c.desvioMetaPct != null ? c.desvioMetaPct.toFixed(1).replace('.', ',') : '',
        c.status,
        c.anomalias.map((a) => TIPO_ALERTA_LABEL[a]).join(' / '),
      ]),
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {filtroPeriodo}
        <Select className="h-10 w-auto text-xs font-bold" value={placa} onChange={(e) => setPlaca(e.target.value)}>
          <option value="">Todas as placas</option>
          {veiculos.map((v) => (
            <option key={v.placa} value={v.placa}>
              {v.placa}
            </option>
          ))}
        </Select>
        <Select className="h-10 w-auto text-xs font-bold" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="fechado">Fechado</option>
          <option value="aberto">Aberto</option>
          <option value="invalidado">Invalidado</option>
        </Select>
        <Button type="button" variant="secondary" size="md" className="h-10" onClick={exportar} disabled={!linhas.length}>
          <Download className="h-4 w-4" /> CSV
        </Button>
      </div>

      <p className="text-xs normal-case text-secondary">
        Ciclo = tanque cheio → tanque cheio. Só ciclos <strong>fechados</strong> entram na média oficial; ciclo aberto mostra uma{' '}
        <strong>média estimada</strong>, e ciclo com abastecimento em revisão fica invalidado até ser validado.
      </p>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-background/60 text-[10px] uppercase text-secondary">
              <tr>
                {['Ciclo', 'Placa', 'Início', 'Fim', 'Odôm. inicial', 'Odôm. final', 'KM', 'Litros', 'KM/L', 'L/h', 'Custo', 'Custo/km', 'Meta', 'Desvio', 'Status', 'Situação', 'Anomalia'].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2 text-left font-bold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 && (
                <tr>
                  <td colSpan={17} className="px-3 py-8 text-center normal-case text-secondary">
                    Nenhum ciclo. Um ciclo começa no primeiro abastecimento com tanque cheio.
                  </td>
                </tr>
              )}
              {linhas.map(({ c, numero }) => (
                <tr key={c.id} className="border-t border-border/10 align-top">
                  <td className="px-3 py-2 tabular-nums">#{numero}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-bold text-foreground">{c.placa}</td>
                  <td className="whitespace-nowrap px-3 py-2">{fmtData(c.dataInicio)}</td>
                  <td className="whitespace-nowrap px-3 py-2">{fmtData(c.dataFim)}</td>
                  <td className="px-3 py-2 tabular-nums">{fmtNum(c.inicio.odometro)}</td>
                  <td className="px-3 py-2 tabular-nums">{fmtNum(c.fim?.odometro)}</td>
                  <td className="px-3 py-2 tabular-nums">{fmtNum(c.km)}</td>
                  <td className="px-3 py-2 tabular-nums">{fmtNum(c.litros, 1)}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-bold tabular-nums text-foreground">
                    {c.kmL != null ? (
                      fmtNum(c.kmL, 2)
                    ) : c.kmLEstimado != null ? (
                      <span className="font-normal text-secondary" title="Ciclo aberto — não é média oficial">
                        ~{fmtNum(c.kmLEstimado, 2)} (estimada)
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{c.lh != null ? fmtNum(c.lh, 2) : '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">{fmtMoeda(c.custoTotal)}</td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">{fmtMoeda(c.custoKm)}</td>
                  <td className="px-3 py-2 tabular-nums">{c.meta ? fmtNum(c.meta, 2) : '—'}</td>
                  <td className="px-3 py-2 tabular-nums">{fmtPct(c.desvioMetaPct)}</td>
                  <td className="px-3 py-2" title={c.motivoStatus}>
                    <StatusCicloBadge status={c.status} />
                    {c.motivoStatus && <p className="mt-1 max-w-[10rem] text-[10px] normal-case text-secondary">{c.motivoStatus}</p>}
                  </td>
                  <td className="px-3 py-2">{c.status === 'fechado' ? <SemaforoBadge semaforo={c.semaforo} /> : '—'}</td>
                  <td className="px-3 py-2 normal-case">
                    {c.anomalias.length === 0
                      ? '—'
                      : c.anomalias.map((a) => (
                          <p key={a} className="whitespace-nowrap font-semibold text-status-warning" title={a === 'QUEDA_CONTINUA' ? `Hipóteses: ${HIPOTESES_QUEDA_CONTINUA.join(', ')}` : undefined}>
                            ⚠ {TIPO_ALERTA_LABEL[a]}
                          </p>
                        ))}
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
