import { useEffect, useMemo, useState } from 'react'
import { FileSpreadsheet, Upload, CheckCircle2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input, Label, Select } from '@/components/ui/Input'
import { salvarConfigConsumo, type ConfigConsumoCompleta, type ViagemConsumo } from '@/hooks/useConsumoCombustivel'
import {
  CAMPOS_MOVETRUCK,
  buscarLogsImportacao,
  escolherAbaViagens,
  gravarImportacao,
  lerXlsx,
  montarPrevia,
  sugerirMapeamento,
  type ClassificacaoLinha,
  type LogImportacao,
  type MapeamentoMoveTruck,
  type PlanilhaLida,
} from './importarMoveTruck'
import { SecaoTitulo, fmtDataHora, fmtMoeda, fmtNum } from './ui'
import { erroConsumo } from './erros'

const CLASSE: Record<ClassificacaoLinha, { label: string; tone: 'success' | 'neutral' | 'warning' | 'danger' }> = {
  novo: { label: 'Novos', tone: 'success' },
  duplicado: { label: 'Duplicados', tone: 'neutral' },
  atualizavel: { label: 'Atualizáveis', tone: 'warning' },
  erro: { label: 'Com erro', tone: 'danger' },
}

interface Props {
  viagens: ViagemConsumo[]
  config: ConfigConsumoCompleta
  usuarioNome: string
  isAdmin: boolean
}

export function ImportacaoMoveTruck({ viagens, config, usuarioNome, isAdmin }: Props) {
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [planilhas, setPlanilhas] = useState<PlanilhaLida[]>([])
  const [abaIdx, setAbaIdx] = useState(0)
  const [mapa, setMapa] = useState<MapeamentoMoveTruck>({})
  const [placaPadrao, setPlacaPadrao] = useState('')
  const [filtroClasse, setFiltroClasse] = useState<ClassificacaoLinha | ''>('')
  const [atualizar, setAtualizar] = useState(false)
  const [processando, setProcessando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [feito, setFeito] = useState<string | null>(null)
  const [logs, setLogs] = useState<LogImportacao[]>([])

  useEffect(() => {
    buscarLogsImportacao().then(setLogs).catch(() => setLogs([]))
  }, [feito])

  const planilha = planilhas[abaIdx]
  const previa = useMemo(
    () => (planilha ? montarPrevia(planilha, mapa, viagens, placaPadrao.trim() || undefined) : []),
    [planilha, mapa, viagens, placaPadrao],
  )
  const contagem = useMemo(() => {
    const c: Record<ClassificacaoLinha, number> = { novo: 0, duplicado: 0, atualizavel: 0, erro: 0 }
    for (const l of previa) c[l.classificacao]++
    return c
  }, [previa])

  async function abrirArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setErro(null)
    setFeito(null)
    try {
      const lidas = await lerXlsx(f)
      if (lidas.length === 0) throw new Error('Arquivo sem planilhas.')
      const idx = escolherAbaViagens(lidas)
      setArquivo(f)
      setPlanilhas(lidas)
      setAbaIdx(idx)
      setMapa(sugerirMapeamento(lidas[idx].colunas, config.mapeamentoMoveTruck as MapeamentoMoveTruck))
    } catch (err) {
      setErro(erroConsumo(err, 'Não foi possível ler o arquivo.'))
    }
  }

  function trocarAba(i: number) {
    setAbaIdx(i)
    setMapa(sugerirMapeamento(planilhas[i].colunas, config.mapeamentoMoveTruck as MapeamentoMoveTruck))
  }

  async function confirmar() {
    if (!arquivo) return
    setProcessando(true)
    setErro(null)
    try {
      const r = await gravarImportacao(arquivo.name, previa, atualizar, usuarioNome)
      // Lembra o mapeamento pra próxima importação.
      await salvarConfigConsumo({ ...config, mapeamentoMoveTruck: mapa as Record<string, string> }).catch(() => {})
      setFeito(`${r.importadas} viagem(ns) importada(s)${r.atualizadas ? `, ${r.atualizadas} atualizada(s)` : ''}.`)
      setPlanilhas([])
      setArquivo(null)
    } catch (err) {
      setErro(erroConsumo(err, 'Falha ao gravar a importação.'))
    } finally {
      setProcessando(false)
    }
  }

  const visiveis = previa.filter((l) => !filtroClasse || l.classificacao === filtroClasse).slice(0, 300)
  const faltaData = !mapa.DATA

  return (
    <div className="space-y-5">
      <SecaoTitulo
        titulo="Importar viagens do MoveTruck"
        descricao="Arquivo .xlsx com as abas Resumo Financeiro / Detalhamento de Viagens. Nada é gravado antes da prévia."
      />

      {!isAdmin && (
        <Card className="p-4 text-sm normal-case text-secondary">Somente administradores podem importar dados.</Card>
      )}

      {isAdmin && (
        <Card className="space-y-4 p-4">
          {erro && <p className="rounded-xl bg-status-danger/10 p-3 text-sm normal-case text-status-danger">{erro}</p>}
          {feito && (
            <p className="flex items-center gap-2 rounded-xl bg-status-success/10 p-3 text-sm normal-case text-status-success">
              <CheckCircle2 className="h-4 w-4" /> {feito}
            </p>
          )}
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/40 p-6 text-sm text-secondary hover:border-primary/60 hover:text-primary">
            <Upload className="h-5 w-5" />
            {arquivo ? arquivo.name : 'Selecionar arquivo .xlsx'}
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={abrirArquivo} />
          </label>

          {planilha && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="mtAba">Planilha</Label>
                  <Select id="mtAba" value={abaIdx} onChange={(e) => trocarAba(Number(e.target.value))}>
                    {planilhas.map((p, i) => (
                      <option key={p.nome} value={i}>
                        {p.nome} ({p.linhas.length} linhas)
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="mtPlaca">Placa padrão (se o arquivo for de um caminhão só)</Label>
                  <Input id="mtPlaca" placeholder="ABC1D23" value={placaPadrao} onChange={(e) => setPlacaPadrao(e.target.value)} />
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-black uppercase text-secondary">Mapeamento de colunas</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {CAMPOS_MOVETRUCK.map((c) => (
                    <div key={c.id}>
                      <Label className="text-xs">
                        {c.label}
                        {c.obrigatorio && ' *'}
                      </Label>
                      <Select
                        value={mapa[c.id] ?? ''}
                        onChange={(e) => setMapa({ ...mapa, [c.id]: e.target.value || undefined })}
                        className="h-10 text-xs"
                      >
                        <option value="">— não usar —</option>
                        {planilha.colunas.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </Select>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] normal-case text-secondary">
                  Sem coluna de placa, ela vem das linhas de agrupamento (“Placa: ABC1234”), do nome da aba ou da placa padrão. Sem coluna de
                  condição de carga, viagem com peso &gt; 0 conta como carregada.
                </p>
              </div>

              {faltaData ? (
                <p className="text-sm normal-case text-status-warning">Mapeie a coluna de data para ver a prévia.</p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(CLASSE) as ClassificacaoLinha[]).map((k) => (
                      <button key={k} type="button" onClick={() => setFiltroClasse(filtroClasse === k ? '' : k)}>
                        <Badge tone={CLASSE[k].tone} className={filtroClasse === k ? 'ring-2 ring-primary' : ''}>
                          {CLASSE[k].label}: {contagem[k]}
                        </Badge>
                      </button>
                    ))}
                  </div>

                  <div className="max-h-[28rem] overflow-auto rounded-xl border border-border/15">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-surface text-[10px] uppercase text-secondary">
                        <tr>
                          {['Linha', 'Situação', 'Placa', 'Data', 'Origem', 'Destino', 'KM', 'Ton.', 'Frete', 'Motorista', 'Carga', 'Erros'].map((h) => (
                            <th key={h} className="whitespace-nowrap px-2 py-2 text-left font-bold">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {visiveis.map((l) => (
                          <tr key={l.linha} className="border-t border-border/10">
                            <td className="px-2 py-1.5 tabular-nums">{l.linha}</td>
                            <td className="px-2 py-1.5">
                              <Badge tone={CLASSE[l.classificacao].tone}>{CLASSE[l.classificacao].label.replace(/s$/, '')}</Badge>
                            </td>
                            <td className="px-2 py-1.5 font-bold">{l.placa ?? '—'}</td>
                            <td className="whitespace-nowrap px-2 py-1.5">{l.data ? l.data.toLocaleDateString('pt-BR') : '—'}</td>
                            <td className="px-2 py-1.5">{l.origem ?? '—'}</td>
                            <td className="px-2 py-1.5">{l.destino ?? '—'}</td>
                            <td className="px-2 py-1.5 tabular-nums">{fmtNum(l.km, 1)}</td>
                            <td className="px-2 py-1.5 tabular-nums">{fmtNum(l.toneladas, 2)}</td>
                            <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">{fmtMoeda(l.valorFrete)}</td>
                            <td className="px-2 py-1.5">{l.motorista ?? '—'}</td>
                            <td className="px-2 py-1.5">{l.condicaoCarga ?? '—'}</td>
                            <td className="px-2 py-1.5 normal-case text-status-danger">{l.erros.join('; ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {previa.length > visiveis.length && (
                    <p className="text-[11px] normal-case text-secondary">Mostrando as primeiras {visiveis.length} linhas.</p>
                  )}

                  <label className="flex items-center gap-2 text-sm normal-case text-foreground">
                    <input type="checkbox" checked={atualizar} onChange={(e) => setAtualizar(e.target.checked)} />
                    Atualizar as {contagem.atualizavel} viagem(ns) já existente(s) com dados diferentes
                  </label>

                  <div className="flex justify-end">
                    <Button type="button" disabled={processando || contagem.novo + (atualizar ? contagem.atualizavel : 0) === 0} onClick={confirmar}>
                      <FileSpreadsheet className="h-4 w-4" />
                      {processando
                        ? 'Importando…'
                        : `Confirmar importação (${contagem.novo} nova(s)${atualizar && contagem.atualizavel ? ` + ${contagem.atualizavel}` : ''})`}
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="p-4">
          <SecaoTitulo titulo="Histórico de importações" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-background/60 text-[10px] uppercase text-secondary">
              <tr>
                {['Data/hora', 'Arquivo', 'Usuário', 'Linhas', 'Importadas', 'Atualizadas', 'Duplicadas', 'Com erro', 'Status'].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2 text-left font-bold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center normal-case text-secondary">
                    Nenhuma importação ainda.
                  </td>
                </tr>
              )}
              {logs.map((l) => (
                <tr key={l.id} className="border-t border-border/10">
                  <td className="whitespace-nowrap px-3 py-2">{fmtDataHora(l.dataHora)}</td>
                  <td className="px-3 py-2 normal-case">{l.arquivo}</td>
                  <td className="px-3 py-2">{l.usuarioNome ?? '—'}</td>
                  <td className="px-3 py-2 tabular-nums">{l.linhas}</td>
                  <td className="px-3 py-2 tabular-nums">{l.importadas}</td>
                  <td className="px-3 py-2 tabular-nums">{l.atualizadas}</td>
                  <td className="px-3 py-2 tabular-nums">{l.duplicadas}</td>
                  <td className="px-3 py-2 tabular-nums">{l.comErro}</td>
                  <td className="px-3 py-2">
                    <Badge tone={l.status === 'concluida' ? 'success' : l.status === 'parcial' ? 'warning' : 'danger'}>{l.status}</Badge>
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
