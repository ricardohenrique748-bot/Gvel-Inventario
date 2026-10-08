import { useMemo, useState } from 'react'
import { Download, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { exportRowsToCsv } from '@/lib/csv'
import { podeExcluirAbastecimento } from '@/lib/permissoes'
import { useAuth } from '@/contexts/AuthContext'
import { excluirAbastecimento } from '@/hooks/useConsumoCombustivel'
import type { AbastecimentoConsumo, Posto } from '@/hooks/useConsumoCombustivel'
import { isArla, ordenarAbastecimentos } from './dominio'
import { StatusAbastecimentoBadge, dentroDoPeriodo, fmtDataHora, fmtMoeda, fmtNum, type Periodo, type VeiculoConsumo } from './ui'

const POR_PAGINA = 50

interface Props {
  abastecimentos: AbastecimentoConsumo[]
  veiculos: VeiculoConsumo[]
  postos: Posto[]
  periodo: Periodo
  filtroPeriodo: React.ReactNode
  onAbrir: (a: AbastecimentoConsumo) => void
}

export function ListaAbastecimentos({ abastecimentos, veiculos, postos, periodo, filtroPeriodo, onAbrir }: Props) {
  const [placa, setPlaca] = useState('')
  const [motorista, setMotorista] = useState('')
  const [posto, setPosto] = useState('')
  const [tanque, setTanque] = useState('')
  const [status, setStatus] = useState('')
  const [origem, setOrigem] = useState('')
  const [combustivel, setCombustivel] = useState('diesel')
  const [pagina, setPagina] = useState(0)
  const [excluindo, setExcluindo] = useState<string | null>(null)
  const { user } = useAuth()
  const podeExcluir = podeExcluirAbastecimento(user?.email)
  const colunas = podeExcluir ? 11 : 10

  async function excluir(a: AbastecimentoConsumo) {
    if (!confirm(`Excluir o abastecimento de ${a.placa} em ${fmtDataHora(a.dataHora)}? Essa ação não pode ser desfeita.`)) return
    setExcluindo(a.id)
    try {
      await excluirAbastecimento(a.id)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Não foi possível excluir o abastecimento.')
    } finally {
      setExcluindo(null)
    }
  }

  // KM desde o abastecimento anterior do mesmo veículo (qualquer combustível, não invalidado).
  const kmDesdeAnterior = useMemo(() => {
    const mapa = new Map<string, number>()
    const porPlaca = new Map<string, AbastecimentoConsumo[]>()
    for (const a of abastecimentos) porPlaca.set(a.placa, [...(porPlaca.get(a.placa) ?? []), a])
    for (const lista of porPlaca.values()) {
      let anterior: number | undefined
      for (const a of ordenarAbastecimentos(lista.filter((x) => x.status !== 'invalidado'))) {
        if (a.odometro != null) {
          if (anterior != null) mapa.set(a.id, a.odometro - anterior)
          anterior = a.odometro
        }
      }
    }
    return mapa
  }, [abastecimentos])

  const filtrados = useMemo(() => {
    const m = motorista.trim().toUpperCase()
    return abastecimentos
      .filter(
        (a) =>
          dentroDoPeriodo(a.dataHora, periodo) &&
          (!placa || a.placa === placa) &&
          (!m || (a.motoristaNome ?? '').toUpperCase().includes(m)) &&
          (!posto || a.postoId === posto || a.postoNome === posto) &&
          (combustivel === 'todos' || (combustivel === 'arla') === isArla(a.combustivel)) &&
          (!tanque || String(a.tanqueCheio) === tanque) &&
          (!status || a.status === status) &&
          (!origem || a.origem === origem),
      )
      .sort((a, b) => b.dataHora.localeCompare(a.dataHora))
  }, [abastecimentos, periodo, placa, motorista, posto, tanque, status, origem, combustivel])

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
  const paginaAtual = Math.min(pagina, totalPaginas - 1)
  const visiveis = filtrados.slice(paginaAtual * POR_PAGINA, (paginaAtual + 1) * POR_PAGINA)
  const filtro = <T,>(set: (v: T) => void) => (v: T) => {
    set(v)
    setPagina(0)
  }

  function exportar() {
    exportRowsToCsv(
      'abastecimentos.csv',
      ['Data', 'Placa', 'Motorista', 'Combustível', 'Odômetro', 'Horímetro', 'Litros', 'Valor/litro', 'Valor total', 'Tanque cheio', 'KM desde anterior', 'Posto', 'Status', 'Origem'],
      filtrados.map((a) => [
        fmtDataHora(a.dataHora),
        a.placa,
        a.motoristaNome ?? '',
        a.combustivel,
        a.odometro != null ? String(a.odometro) : '',
        a.horimetro != null ? String(a.horimetro) : '',
        String(a.litros).replace('.', ','),
        a.valorLitro != null ? String(a.valorLitro).replace('.', ',') : '',
        a.valorTotal.toFixed(2).replace('.', ','),
        a.tanqueCheio ? 'SIM' : 'NÃO',
        kmDesdeAnterior.get(a.id) != null ? String(kmDesdeAnterior.get(a.id)) : '',
        a.postoNome,
        a.status,
        a.origem,
      ]),
    )
  }

  const sel = 'h-10 w-auto text-xs font-bold'
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {filtroPeriodo}
        <Select className={sel} value={placa} onChange={(e) => filtro(setPlaca)(e.target.value)}>
          <option value="">Todas as placas</option>
          {veiculos.map((v) => (
            <option key={v.placa} value={v.placa}>
              {v.placa}
            </option>
          ))}
        </Select>
        <Input className="h-10 w-40 text-xs" placeholder="Motorista" value={motorista} onChange={(e) => filtro(setMotorista)(e.target.value)} />
        <Select className={sel} value={posto} onChange={(e) => filtro(setPosto)(e.target.value)}>
          <option value="">Todos os postos</option>
          {postos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </Select>
        <Select className={sel} value={combustivel} onChange={(e) => filtro(setCombustivel)(e.target.value)}>
          <option value="diesel">Diesel</option>
          <option value="arla">ARLA</option>
          <option value="todos">Todos os combustíveis</option>
        </Select>
        <Select className={sel} value={tanque} onChange={(e) => filtro(setTanque)(e.target.value)}>
          <option value="">Tanque cheio e parcial</option>
          <option value="true">Tanque cheio</option>
          <option value="false">Parcial</option>
        </Select>
        <Select className={sel} value={status} onChange={(e) => filtro(setStatus)(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="valido">Válido</option>
          <option value="pendente_revisao">Pendente de revisão</option>
          <option value="invalidado">Invalidado</option>
        </Select>
        <Select className={sel} value={origem} onChange={(e) => filtro(setOrigem)(e.target.value)}>
          <option value="">Todas as origens</option>
          <option value="web">Web</option>
          <option value="app">App</option>
          <option value="importacao">Importação</option>
          <option value="manual">Manutenção de frota</option>
          <option value="despesa_viagem">Despesa de viagem</option>
        </Select>
        <Button type="button" variant="secondary" size="md" className="h-10" onClick={exportar} disabled={!filtrados.length}>
          <Download className="h-4 w-4" /> CSV
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-background/60 text-[10px] uppercase text-secondary">
              <tr>
                {['Data', 'Placa', 'Motorista', 'Combustível', 'Odômetro', 'Litros', 'Valor', 'Tanque cheio', 'KM desde anterior', 'Status'].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2 text-left font-bold">
                    {h}
                  </th>
                ))}
                {podeExcluir && <th className="w-10 px-3 py-2" />}
              </tr>
            </thead>
            <tbody>
              {visiveis.length === 0 && (
                <tr>
                  <td colSpan={colunas} className="px-3 py-8 text-center normal-case text-secondary">
                    Nenhum abastecimento com esses filtros.
                  </td>
                </tr>
              )}
              {visiveis.map((a) => (
                <tr key={a.id} className="cursor-pointer border-t border-border/10 hover:bg-overlay/[0.04]" onClick={() => onAbrir(a)}>
                  <td className="whitespace-nowrap px-3 py-2">{fmtDataHora(a.dataHora)}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-bold text-foreground">{a.placa}</td>
                  <td className="px-3 py-2">{a.motoristaNome ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2">{a.combustivel}</td>
                  <td className="px-3 py-2 tabular-nums">{fmtNum(a.odometro)}</td>
                  <td className="px-3 py-2 tabular-nums">{fmtNum(a.litros, 1)}</td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">{fmtMoeda(a.valorTotal)}</td>
                  <td className="px-3 py-2">{a.tanqueCheio ? <strong className="text-foreground">Sim</strong> : 'Não'}</td>
                  <td className="px-3 py-2 tabular-nums">{fmtNum(kmDesdeAnterior.get(a.id))}</td>
                  <td className="px-3 py-2">
                    <StatusAbastecimentoBadge status={a.status} />
                  </td>
                  {podeExcluir && (
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        title="Excluir abastecimento"
                        className="rounded p-1 text-secondary hover:bg-red-500/10 hover:text-red-500 disabled:opacity-40"
                        disabled={excluindo === a.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          excluir(a)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-border/10 px-3 py-2 text-xs text-secondary">
          <span>{filtrados.length} registro(s)</span>
          {totalPaginas > 1 && (
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="md" className="h-8" disabled={paginaAtual === 0} onClick={() => setPagina(paginaAtual - 1)}>
                Anterior
              </Button>
              <span>
                {paginaAtual + 1}/{totalPaginas}
              </span>
              <Button type="button" variant="ghost" size="md" className="h-8" disabled={paginaAtual >= totalPaginas - 1} onClick={() => setPagina(paginaAtual + 1)}>
                Próxima
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
