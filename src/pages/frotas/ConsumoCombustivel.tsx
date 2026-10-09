import { useCallback, useMemo, useState, lazy, Suspense } from 'react'
import { createPortal } from 'react-dom'
import { LayoutDashboard, Fuel, Repeat, Settings, Plus, CloudOff, Map as MapIcon } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useConsumoCombustivel, type AbastecimentoConsumo } from '@/hooks/useConsumoCombustivel'
import { calcularCiclos, condicaoDoIntervalo, normalizarPlaca, type Ciclo } from './consumo/dominio'
import { useFilaOffline } from './consumo/filaOffline'
import { AbastecimentoModal } from './consumo/AbastecimentoModal'
import { AbastecimentoDetalheModal } from './consumo/AbastecimentoDetalheModal'
import { PainelConsumo } from './consumo/PainelConsumo'
import { ListaAbastecimentos } from './consumo/ListaAbastecimentos'
import { TabelaCiclos } from './consumo/TabelaCiclos'
import { ConfiguracoesConsumo } from './consumo/ConfiguracoesConsumo'
import { fmtData, periodoDoPreset, type PeriodoPreset, type VeiculoConsumo } from './consumo/ui'

// Leaflet (~150 KB) só é baixado quando a aba Viagens é aberta.
const ViagensMapa = lazy(() => import('./consumo/ViagensMapa').then((m) => ({ default: m.ViagensMapa })))

const ROTULO_PERIODO: Record<PeriodoPreset, string> = {
  mes: 'Mês atual',
  '30': '30 dias',
  '90': '90 dias',
  '180': '6 meses',
  '365': '12 meses',
  personalizado: 'Personalizado',
}

// Aba "Consumo" da Gestão de Frotas: abastecimento, ciclos tanque cheio →
// tanque cheio, média km/L, alertas e importação do MoveTruck.
// Regras de cálculo: ./consumo/dominio.ts · Banco: migration 0090.

type SubAba = 'painel' | 'abastecimentos' | 'ciclos' | 'viagens' | 'config'

interface Props {
  /** Veículos da frota (lista oficial + cadastros), já mesclados em Frotas.tsx. */
  veiculos: { id: string; placa: string; nome: string }[]
  motoristas: string[]
  isAdmin: boolean
  usuarioNome: string
}

export function ConsumoCombustivel({ veiculos: veiculosFrota, motoristas, isAdmin, usuarioNome }: Props) {
  const { abastecimentos, viagens, postos, metas, config, alertas, loading, erro } = useConsumoCombustivel()
  const [subAba, setSubAba] = useState<SubAba>('painel')
  const [preset, setPreset] = useState<PeriodoPreset>('90')
  const [personalizado, setPersonalizado] = useState(() => {
    const p = periodoDoPreset('30')
    return { inicio: p.inicio.slice(0, 10), fim: p.fim.slice(0, 10) }
  })
  const [novoAberto, setNovoAberto] = useState(false)
  const [detalhe, setDetalhe] = useState<AbastecimentoConsumo | null>(null)

  // Data vazia/incompleta enquanto o usuário edita viraria Invalid Date e
  // toISOString() derrubaria a tela — por isso o onChange ignora valor vazio.
  const periodo = useMemo(
    () =>
      periodoDoPreset(preset, {
        inicio: new Date(`${personalizado.inicio}T00:00:00`).toISOString(),
        fim: new Date(`${personalizado.fim}T23:59:59`).toISOString(),
      }),
    [preset, personalizado],
  )

  // Frota + placas que só aparecem em abastecimentos (ex.: veículo removido da lista).
  const veiculos: VeiculoConsumo[] = useMemo(() => {
    const mapa = new Map<string, VeiculoConsumo>()
    for (const v of veiculosFrota) mapa.set(normalizarPlaca(v.placa), { id: v.id, placa: normalizarPlaca(v.placa), nome: v.nome })
    for (const a of abastecimentos) if (!mapa.has(a.placa)) mapa.set(a.placa, { id: a.veiculoId, placa: a.placa, nome: a.veiculoNome ?? a.placa })
    return [...mapa.values()].sort((a, b) => a.placa.localeCompare(b.placa))
  }, [veiculosFrota, abastecimentos])

  // Ciclos de cada caminhão, calculados uma vez e compartilhados pelas sub-abas.
  const ciclosPorPlaca = useMemo(() => {
    const porPlaca = new Map<string, AbastecimentoConsumo[]>()
    for (const a of abastecimentos) porPlaca.set(a.placa, [...(porPlaca.get(a.placa) ?? []), a])
    const r: Record<string, Ciclo[]> = {}
    for (const [placa, lista] of porPlaca) {
      const viagensPlaca = viagens.filter((v) => v.placa === placa)
      r[placa] = calcularCiclos(lista, {
        meta: metas[placa],
        config,
        condicaoPorCiclo: (ini, fim) => condicaoDoIntervalo(viagensPlaca, ini, fim),
      })
    }
    return r
  }, [abastecimentos, viagens, metas, config])

  const metaDaPlaca = useCallback((placa: string) => metas[normalizarPlaca(placa)], [metas])
  const fila = useFilaOffline(metaDaPlaca, config)


  const abas: { id: SubAba; label: string; icon: typeof Fuel; badge?: number }[] = [
    { id: 'painel', label: 'Painel', icon: LayoutDashboard },
    { id: 'abastecimentos', label: 'Abastecimentos', icon: Fuel },
    { id: 'ciclos', label: 'Ciclos', icon: Repeat },
    { id: 'viagens', label: 'Viagens', icon: MapIcon },
    { id: 'config', label: 'Configurações', icon: Settings },
  ]

  // Atalhos de período em botões (um clique) + as datas que estão valendo.
  const filtroPeriodo = (
    <div className="flex flex-wrap items-center gap-2">
      <div role="group" aria-label="Período" className="flex flex-wrap gap-0.5 rounded-xl border border-border/30 bg-background/60 p-0.5">
        {(Object.keys(ROTULO_PERIODO) as PeriodoPreset[]).map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={preset === p}
            onClick={() => setPreset(p)}
            className={`h-8 rounded-lg px-3 text-[11px] font-bold transition-colors ${
              preset === p ? 'bg-primary text-white' : 'text-secondary hover:bg-overlay/[0.06] hover:text-foreground'
            }`}
          >
            {ROTULO_PERIODO[p]}
          </button>
        ))}
      </div>
      {preset === 'personalizado' && (
        <>
          <Input type="date" className="h-9 w-auto text-xs" value={personalizado.inicio} onChange={(e) => e.target.value && setPersonalizado({ ...personalizado, inicio: e.target.value })} />
          <Input type="date" className="h-9 w-auto text-xs" value={personalizado.fim} onChange={(e) => e.target.value && setPersonalizado({ ...personalizado, fim: e.target.value })} />
        </>
      )}
      <span className="text-[11px] normal-case text-secondary">
        {fmtData(periodo.inicio)} a {fmtData(periodo.fim)}
      </span>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/30 bg-surface/90 p-2 shadow-sm">
        <div className="flex flex-wrap gap-1">
          {abas.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setSubAba(a.id)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold uppercase transition-colors ${
                subAba === a.id ? 'bg-primary text-white' : 'text-secondary hover:bg-background hover:text-foreground'
              }`}
            >
              <a.icon className="h-4 w-4" />
              {a.label}
              {!!a.badge && (
                <span className={`rounded-full px-1.5 text-[10px] ${subAba === a.id ? 'bg-white/25' : 'bg-status-warning/20 text-status-warning'}`}>{a.badge}</span>
              )}
            </button>
          ))}
        </div>
        <Button type="button" size="md" onClick={() => setNovoAberto(true)} className="shadow-md shadow-primary/20">
          <Plus className="h-4 w-4" /> Abastecimento
        </Button>
      </div>

      {fila.itens.length > 0 && (
        <button
          type="button"
          onClick={() => fila.sincronizar()}
          className="flex w-full items-center gap-2 rounded-xl border border-status-warning/30 bg-status-warning/10 px-4 py-2.5 text-left text-xs font-bold text-status-warning"
        >
          <CloudOff className="h-4 w-4" /> {fila.itens.length} abastecimento(s) pendente(s) de sincronização neste aparelho — toque para enviar agora
        </button>
      )}

      {erro && (
        <div className="rounded-xl border border-status-danger/30 bg-status-danger/10 p-4 text-xs normal-case text-status-danger">
          {erro} — confira se a migration 0090 foi aplicada no Supabase.
        </div>
      )}

      {loading && abastecimentos.length === 0 ? (
        <div className="py-16 text-center text-sm text-secondary">Carregando consumo…</div>
      ) : (
        <>
          {subAba === 'painel' && (
            <PainelConsumo
              veiculos={veiculos}
              ciclosPorPlaca={ciclosPorPlaca}
              abastecimentos={abastecimentos}
              viagens={viagens}
              metas={metas}
              config={config}
              periodo={periodo}
              filtroPeriodo={filtroPeriodo}
            />
          )}
          {subAba === 'abastecimentos' && (
            <ListaAbastecimentos abastecimentos={abastecimentos} veiculos={veiculos} postos={postos} periodo={periodo} filtroPeriodo={filtroPeriodo} onAbrir={setDetalhe} />
          )}
          {subAba === 'ciclos' && <TabelaCiclos ciclosPorPlaca={ciclosPorPlaca} veiculos={veiculos} periodo={periodo} filtroPeriodo={filtroPeriodo} />}
          {subAba === 'viagens' && (
            <Suspense fallback={<p className="py-10 text-center text-xs text-secondary">Carregando mapa…</p>}>
              <ViagensMapa veiculos={veiculos} motoristas={motoristas} periodo={periodo} filtroPeriodo={filtroPeriodo} isAdmin={isAdmin} />
            </Suspense>
          )}
          {subAba === 'config' && <ConfiguracoesConsumo veiculos={veiculos} metas={metas} postos={postos} config={config} isAdmin={isAdmin} />}
        </>
      )}

      {novoAberto &&
        createPortal(
          <AbastecimentoModal
            veiculos={veiculos}
            abastecimentos={abastecimentos}
            postos={postos}
            motoristas={motoristas}
            metas={metas}
            config={config}
            usuarioNome={usuarioNome}
            onClose={() => setNovoAberto(false)}
          />,
          document.body,
        )}

      {detalhe &&
        createPortal(
          <AbastecimentoDetalheModal abastecimento={detalhe} alertas={alertas} config={config} isAdmin={isAdmin} onClose={() => setDetalhe(null)} />,
          document.body,
        )}
    </div>
  )
}
