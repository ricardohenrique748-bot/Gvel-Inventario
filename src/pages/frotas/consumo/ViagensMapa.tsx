import { useCallback, useEffect, useMemo, useState } from 'react'
import { MapPin, Navigation, Route, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input, Label, Select } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { getErrorMessage } from '@/lib/erros'
import { nowLocalInputValue } from '@/lib/format'
import { MapaViagens, type RotaNoMapa } from './mapa/MapaViagens'
import { buscarEndereco, calcularRota, enderecoDoPonto, type PontoMapa, type RotaCalculada } from './mapa/osm'
import { SecaoTitulo, fmtDataHora, fmtNum, parseDecimal, type Periodo, type VeiculoConsumo } from './ui'

// Aba "Viagens" do Consumo: cadastro de viagem marcando origem e destino no
// mapa (OpenStreetMap), com rota e km calculados, e as viagens do período
// desenhadas no mapa. Grava em viagens_frota (migration 0095 para as
// coordenadas/rota).

interface Props {
  veiculos: VeiculoConsumo[]
  motoristas: string[]
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

type Alvo = 'origem' | 'destino'

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

export function ViagensMapa({ veiculos, motoristas, periodo, filtroPeriodo, isAdmin }: Props) {
  // ---------- Cadastro ----------
  const [placa, setPlaca] = useState('')
  const [motorista, setMotorista] = useState('')
  const [dataSaida, setDataSaida] = useState(nowLocalInputValue())
  const [condicao, setCondicao] = useState('')
  const [toneladas, setToneladas] = useState('')
  const [origem, setOrigem] = useState<PontoMapa>()
  const [destino, setDestino] = useState<PontoMapa>()
  const [rota, setRota] = useState<RotaCalculada>()
  const [alvo, setAlvo] = useState<Alvo>('origem')
  const [busca, setBusca] = useState<Record<Alvo, string>>({ origem: '', destino: '' })
  const [resultados, setResultados] = useState<{ alvo: Alvo; itens: PontoMapa[] } | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [calculando, setCalculando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  // ---------- Viagens do período ----------
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

  // Com origem e destino marcados, calcula a rota.
  useEffect(() => {
    if (!origem || !destino) {
      setRota(undefined)
      return
    }
    let cancelado = false
    setCalculando(true)
    setErro(null)
    calcularRota(origem, destino)
      .then((r) => !cancelado && setRota(r))
      .catch((e) => !cancelado && (setRota(undefined), setErro(getErrorMessage(e, 'Não foi possível calcular a rota.'))))
      .finally(() => !cancelado && setCalculando(false))
    return () => {
      cancelado = true
    }
  }, [origem, destino])

  function definirPonto(a: Alvo, p: PontoMapa) {
    if (a === 'origem') setOrigem(p)
    else setDestino(p)
    setBusca((b) => ({ ...b, [a]: p.rotulo }))
    setResultados(null)
    // Depois da origem, o próximo clique no mapa marca o destino.
    if (a === 'origem' && !destino) setAlvo('destino')
  }

  async function pesquisar(a: Alvo) {
    setBuscando(true)
    setErro(null)
    try {
      const itens = await buscarEndereco(busca[a])
      setResultados({ alvo: a, itens })
      if (!itens.length) setErro('Nenhum endereço encontrado. Tente cidade e UF, ex.: "Uberlândia MG".')
    } catch (e) {
      setErro(getErrorMessage(e, 'Busca de endereço indisponível.'))
    } finally {
      setBuscando(false)
    }
  }

  async function cliqueNoMapa(lat: number, lng: number) {
    const a = alvo
    definirPonto(a, { lat, lng, rotulo: 'BUSCANDO ENDEREÇO…' })
    definirPonto(a, await enderecoDoPonto(lat, lng))
  }

  function limparCadastro() {
    setOrigem(undefined)
    setDestino(undefined)
    setRota(undefined)
    setBusca({ origem: '', destino: '' })
    setResultados(null)
    setAlvo('origem')
    setCondicao('')
    setToneladas('')
    setDataSaida(nowLocalInputValue())
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setAviso(null)
    const veiculo = veiculos.find((v) => v.placa === placa)
    if (!veiculo) return setErro('Selecione o caminhão.')
    if (!motorista.trim()) return setErro('Informe o motorista.')
    if (!origem || !destino) return setErro('Marque a origem e o destino (pela busca ou clicando no mapa).')
    const data = new Date(dataSaida)
    if (Number.isNaN(data.getTime())) return setErro('Informe a data e hora de saída.')
    const t = parseDecimal(toneladas)

    setSalvando(true)
    try {
      const { error } = await supabase.from('viagens_frota').insert({
        placa: veiculo.placa,
        veiculo_id: veiculo.id || null,
        veiculo_nome: veiculo.nome || null,
        motorista_nome: motorista.trim().toUpperCase(),
        origem: origem.rotulo,
        destino: destino.rotulo,
        endereco_origem: origem.endereco?.toUpperCase() || null,
        cidade_origem: origem.cidade || null,
        uf_origem: origem.uf || null,
        endereco_destino: destino.endereco?.toUpperCase() || null,
        cidade_destino: destino.cidade || null,
        uf_destino: destino.uf || null,
        origem_lat: origem.lat,
        origem_lng: origem.lng,
        destino_lat: destino.lat,
        destino_lng: destino.lng,
        rota_coordenadas: rota?.coordenadas ?? null,
        distancia_estimada_km: rota?.distanciaKm ?? null,
        tempo_estimado_horas: rota?.tempoHoras ?? null,
        data_hora_saida: data.toISOString(),
        condicao_carga: condicao || null,
        peso_carga_toneladas: t ?? null,
        status: 'confirmada',
        fonte: 'manual',
      })
      if (error) throw error
      setAviso(`Viagem ${veiculo.placa} ${origem.rotulo} → ${destino.rotulo} cadastrada.`)
      limparCadastro()
      avisarAtualizacao()
    } catch (err) {
      setErro(erroViagem(err, 'Não foi possível salvar a viagem.'))
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(v: ViagemMapa) {
    if (!confirm(`Excluir a viagem ${v.placa} ${v.origem} → ${v.destino} de ${fmtDataHora(v.dataHora)}?`)) return
    const { error } = await supabase.from('viagens_frota').delete().eq('id', v.id)
    if (error) alert(erroViagem(error, 'Não foi possível excluir a viagem.'))
    else {
      if (destaqueId === v.id) setDestaqueId(null)
      avisarAtualizacao()
    }
  }

  const campoBusca = (a: Alvo, rotulo: string, cor: string) => (
    <div className="space-y-1">
      <Label htmlFor={`busca-${a}`}>{rotulo}</Label>
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <span className={`absolute left-3 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full ${cor}`} aria-hidden="true" />
          <Input
            id={`busca-${a}`}
            className="h-10 pl-7 text-xs"
            placeholder="Cidade, endereço ou empresa"
            value={busca[a]}
            onFocus={() => setAlvo(a)}
            onChange={(e) => setBusca((b) => ({ ...b, [a]: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                pesquisar(a)
              }
            }}
          />
        </div>
        <Button type="button" variant="secondary" size="md" className="h-10 px-3" onClick={() => pesquisar(a)} disabled={buscando} aria-label={`Buscar ${rotulo.toLowerCase()}`}>
          <Search className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant={alvo === a ? 'primary' : 'secondary'}
          size="md"
          className="h-10 px-3"
          onClick={() => setAlvo(a)}
          title={`Marcar ${rotulo.toLowerCase()} clicando no mapa`}
          aria-pressed={alvo === a}
        >
          <MapPin className="h-4 w-4" />
        </Button>
      </div>
      {resultados?.alvo === a && resultados.itens.length > 0 && (
        <ul className="max-h-48 overflow-y-auto rounded-xl border border-border/30 bg-background text-xs">
          {resultados.itens.map((p, i) => (
            <li key={i}>
              <button type="button" onClick={() => definirPonto(a, p)} className="w-full px-3 py-2 text-left hover:bg-overlay/[0.06]">
                <span className="font-bold text-foreground">{p.rotulo}</span>
                {p.endereco && <span className="block normal-case text-secondary">{p.endereco}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_1fr]">
        {/* Cadastro */}
        <Card className="p-4">
          <SecaoTitulo titulo="Nova viagem" descricao="Busque ou clique no mapa para marcar a origem e o destino." />
          <form onSubmit={salvar} className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="viagemPlaca">Caminhão</Label>
                <Select id="viagemPlaca" className="h-10 px-3 text-xs font-bold" value={placa} onChange={(e) => setPlaca(e.target.value)}>
                  <option value="">Selecione</option>
                  {veiculos.map((v) => (
                    <option key={v.placa} value={v.placa}>
                      {v.placa}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="viagemSaida">Saída</Label>
                <Input id="viagemSaida" type="datetime-local" className="h-10 px-2 text-xs" value={dataSaida} onChange={(e) => setDataSaida(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="viagemMotorista">Motorista</Label>
              <Input id="viagemMotorista" list="viagemMotoristas" className="h-10 text-xs" value={motorista} onChange={(e) => setMotorista(e.target.value)} />
              <datalist id="viagemMotoristas">
                {motoristas.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>

            {campoBusca('origem', 'Origem', 'bg-green-600')}
            {campoBusca('destino', 'Destino', 'bg-red-600')}

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="viagemCondicao">Condição</Label>
                <Select id="viagemCondicao" className="h-10 px-3 text-xs font-bold" value={condicao} onChange={(e) => setCondicao(e.target.value)}>
                  <option value="">Não informada</option>
                  <option value="carregado">Carregado</option>
                  <option value="vazio">Vazio</option>
                  <option value="misto">Misto</option>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="viagemToneladas">Carga (t)</Label>
                <Input id="viagemToneladas" inputMode="decimal" className="h-10 text-xs" placeholder="Opcional" value={toneladas} onChange={(e) => setToneladas(e.target.value)} />
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-border/30 bg-background/60 px-3 py-2.5 text-xs">
              <Route className="h-4 w-4 shrink-0 text-secondary" />
              {calculando ? (
                <span className="text-secondary">Calculando rota…</span>
              ) : rota ? (
                <span>
                  <strong className="text-foreground">{fmtNum(rota.distanciaKm, 1)} km</strong>
                  <span className="text-secondary"> · ~{fmtNum(rota.tempoHoras, 1)} h de carro (caminhão costuma levar mais)</span>
                </span>
              ) : (
                <span className="normal-case text-secondary">A rota aparece quando origem e destino estiverem marcados.</span>
              )}
            </div>

            {erro && <p className="rounded-lg bg-status-danger/10 px-3 py-2 text-xs normal-case text-status-danger">{erro}</p>}
            {aviso && <p className="rounded-lg bg-status-success/10 px-3 py-2 text-xs normal-case text-status-success">{aviso}</p>}

            <div className="flex gap-2">
              <Button type="button" variant="secondary" size="md" className="flex-1" onClick={limparCadastro} disabled={salvando}>
                Limpar
              </Button>
              <Button type="submit" size="md" className="flex-1" disabled={salvando || calculando}>
                <Navigation className="h-4 w-4" /> {salvando ? 'Salvando…' : 'Salvar viagem'}
              </Button>
            </div>
          </form>
        </Card>

        {/* Mapa */}
        <Card className="flex flex-col p-3">
          <p className="mb-2 px-1 text-[11px] normal-case text-secondary">
            Clique no mapa para marcar a{' '}
            <strong className={alvo === 'origem' ? 'text-green-600' : 'text-red-600'}>{alvo === 'origem' ? 'origem' : 'destino'}</strong>. Linhas azuis: viagens do período.
          </p>
          <MapaViagens
            className="h-[420px] w-full lg:h-full lg:min-h-[520px]"
            origem={origem}
            destino={destino}
            rota={rota?.coordenadas}
            viagens={rotasNoMapa}
            destaqueId={destaqueId}
            onClickMapa={cliqueNoMapa}
          />
        </Card>
      </div>

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
