import { useCallback, useEffect, useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { getErrorMessage } from '@/lib/erros'
import { MapaViagens, type RotaNoMapa } from './mapa/MapaViagens'
import { SecaoTitulo, fmtDataHora, fmtNum, type Periodo, type VeiculoConsumo } from './ui'

// Aba "Viagens" do Consumo: as viagens do período desenhadas no mapa de
// satélite. O cadastro é o do Controle de Viagens (botão "Nova viagem"), que
// grava em viagens_frota e calcula a rota em segundo plano (rotaAutomatica.ts;
// migration 0095 para as coordenadas/rota).

interface Props {
  veiculos: VeiculoConsumo[]
  periodo: Periodo
  filtroPeriodo: React.ReactNode
  isAdmin: boolean
}

interface ViagemMapa {
  id: string
  placa: string
  motorista: string
  dataHora: string
  origem: string
  destino: string
  km?: number
  horas?: number
  condicao?: string
  toneladas?: number
  coordenadas: [number, number][]
}

const CONDICAO_LABEL: Record<string, string> = { carregado: 'Carregado', vazio: 'Vazio', misto: 'Misto' }

function erroViagem(err: unknown, fallback: string): string {
  const msg = getErrorMessage(err, fallback)
  return /does not exist|schema cache|could not find the (table|column)/i.test(msg)
    ? `O banco ainda não tem os campos do mapa — aplique a migration 0095 no Supabase. (${msg})`
    : msg
}

function avisarAtualizacao() {
  window.dispatchEvent(new Event('viagem_frota_updated'))
  window.dispatchEvent(new Event('consumo_combustivel_updated'))
}

export function ViagensMapa({ veiculos, periodo, filtroPeriodo, isAdmin }: Props) {
  const [viagens, setViagens] = useState<ViagemMapa[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erroLista, setErroLista] = useState<string | null>(null)
  const [destaqueId, setDestaqueId] = useState<string | null>(null)
  const [filtroPlaca, setFiltroPlaca] = useState('')

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErroLista(null)
    const { data, error } = await supabase
      .from('viagens_frota')
      .select(
        'id,placa,motorista_nome,data_hora_saida,origem,destino,distancia_estimada_km,tempo_estimado_horas,condicao_carga,peso_carga_toneladas,rota_coordenadas',
      )
      .gte('data_hora_saida', periodo.inicio)
      .lte('data_hora_saida', periodo.fim)
      .order('data_hora_saida', { ascending: false })
      .limit(500)
    if (error) setErroLista(erroViagem(error, 'Não foi possível carregar as viagens.'))
    else
      setViagens(
        (data ?? []).map((v: any) => ({
          id: v.id,
          placa: v.placa,
          motorista: v.motorista_nome || '',
          dataHora: v.data_hora_saida,
          origem: v.origem || '',
          destino: v.destino || '',
          km: v.distancia_estimada_km != null ? Number(v.distancia_estimada_km) : undefined,
          horas: v.tempo_estimado_horas != null ? Number(v.tempo_estimado_horas) : undefined,
          condicao: v.condicao_carga || undefined,
          toneladas: v.peso_carga_toneladas != null ? Number(v.peso_carga_toneladas) : undefined,
          coordenadas: Array.isArray(v.rota_coordenadas) ? v.rota_coordenadas : [],
        })),
      )
    setCarregando(false)
  }, [periodo.inicio, periodo.fim])

  useEffect(() => {
    carregar()
    window.addEventListener('viagem_frota_updated', carregar)
    return () => window.removeEventListener('viagem_frota_updated', carregar)
  }, [carregar])

  const viagensFiltradas = useMemo(() => viagens.filter((v) => !filtroPlaca || v.placa === filtroPlaca), [viagens, filtroPlaca])
  const rotasNoMapa: RotaNoMapa[] = useMemo(
    () =>
      viagensFiltradas.map((v) => ({
        id: v.id,
        coordenadas: v.coordenadas,
        rotulo: `${v.placa} · ${v.origem} → ${v.destino}${v.km != null ? ` · ${fmtNum(v.km)} km` : ''}`,
      })),
    [viagensFiltradas],
  )

  async function excluir(v: ViagemMapa) {
    if (!confirm(`Excluir a viagem ${v.placa} ${v.origem} → ${v.destino} de ${fmtDataHora(v.dataHora)}?`)) return
    const { error } = await supabase.from('viagens_frota').delete().eq('id', v.id)
    if (error) alert(erroViagem(error, 'Não foi possível excluir a viagem.'))
    else {
      if (destaqueId === v.id) setDestaqueId(null)
      avisarAtualizacao()
    }
  }

  return (
    <div className="space-y-4">
      {/* Mapa */}
      <Card className="p-3">
        <MapaViagens className="h-[420px] w-full lg:h-[560px]" viagens={rotasNoMapa} destaqueId={destaqueId} />
      </Card>

      {/* Viagens do período */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-end justify-between gap-3 p-4">
          <SecaoTitulo titulo="Viagens do período" descricao="Clique numa viagem para destacá-la no mapa." />
          <div className="flex flex-wrap items-center gap-2">
            {filtroPeriodo}
            <div className="w-44">
              <Select className="h-9 px-3 text-xs font-bold" value={filtroPlaca} onChange={(e) => setFiltroPlaca(e.target.value)} aria-label="Filtrar por caminhão">
                <option value="">Todas as placas</option>
                {veiculos.map((v) => (
                  <option key={v.placa} value={v.placa}>
                    {v.placa}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>
        {erroLista ? (
          <p className="px-4 pb-4 text-xs normal-case text-status-danger">{erroLista}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-background/60 text-[10px] uppercase text-secondary">
                <tr>
                  {['Saída', 'Placa', 'Motorista', 'Origem → destino', 'KM', 'Condição', ''].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-2 text-left font-bold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!carregando && viagensFiltradas.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center normal-case text-secondary">
                      Nenhuma viagem no período.
                    </td>
                  </tr>
                )}
                {viagensFiltradas.map((v) => (
                  <tr
                    key={v.id}
                    onClick={() => setDestaqueId(destaqueId === v.id ? null : v.id)}
                    className={`cursor-pointer border-t border-border/10 ${destaqueId === v.id ? 'bg-primary/10' : 'hover:bg-overlay/[0.04]'}`}
                  >
                    <td className="whitespace-nowrap px-3 py-2">{fmtDataHora(v.dataHora)}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-bold text-foreground">{v.placa}</td>
                    <td className="px-3 py-2">{v.motorista || '—'}</td>
                    <td className="px-3 py-2">
                      {v.origem || '—'} → {v.destino || '—'}
                      {v.coordenadas.length < 2 && <span className="ml-1 text-[10px] normal-case text-secondary">(sem rota no mapa)</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">{v.km != null ? fmtNum(v.km) : '—'}</td>
                    <td className="px-3 py-2">
                      {v.condicao ? CONDICAO_LABEL[v.condicao] ?? v.condicao : '—'}
                      {v.toneladas != null && <span className="text-secondary"> · {fmtNum(v.toneladas, 1)} t</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {isAdmin && (
                        <button
                          type="button"
                          title="Excluir viagem"
                          className="rounded p-1 text-secondary hover:bg-red-500/10 hover:text-red-500"
                          onClick={(e) => {
                            e.stopPropagation()
                            excluir(v)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
