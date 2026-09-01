import { useMemo, useState } from 'react'
import { Pencil, Trash2, GitMerge, AlertTriangle, Check, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { usePatios, criarPatio, renomearPatio, mesclarPatios, excluirPatio } from '@/hooks/usePatios'
import { useMovimentacoes } from '@/hooks/useMovimentacoes'
import { useAuth } from '@/contexts/AuthContext'
import { isAdminUsuario } from '@/lib/permissoes'
import { removerAcentos } from '@/constants/equipe'
import type { Patio } from '@/lib/types'

// Distância de Levenshtein simples — usada só pra sinalizar nomes de pátio
// muito parecidos (typo, plural, espaço a mais), não pra decidir nada sozinha.
function distanciaLevenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const linha = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    let anterior = linha[0]
    linha[0] = i
    for (let j = 1; j <= n; j++) {
      const temp = linha[j]
      linha[j] = a[i - 1] === b[j - 1] ? anterior : 1 + Math.min(anterior, linha[j], linha[j - 1])
      anterior = temp
    }
  }
  return linha[n]
}

function normalizarNome(nome: string): string {
  return removerAcentos(nome.trim().toUpperCase()).replace(/\s+/g, ' ')
}

export function PatiosTab() {
  const { perfil, user } = useAuth()
  const isAdmin = isAdminUsuario(perfil, user?.email)
  const { patios, loading, refetch } = usePatios()
  const { movimentacoes: noPatio } = useMovimentacoes({ status: 'no_patio' })

  const [novoNome, setNovoNome] = useState('')
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [nomeEdicao, setNomeEdicao] = useState('')
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)

  const [mesclandoId, setMesclandoId] = useState<string | null>(null)
  const [destinoMesclagem, setDestinoMesclagem] = useState('')
  const [processandoMesclagem, setProcessandoMesclagem] = useState(false)

  const [excluindoId, setExcluindoId] = useState<string | null>(null)

  const contagemPorPatio = useMemo(() => {
    const map = new Map<string, number>()
    for (const m of noPatio) {
      if (!m.patio_id) continue
      map.set(m.patio_id, (map.get(m.patio_id) ?? 0) + 1)
    }
    return map
  }, [noPatio])

  // Sinaliza pares de pátios com nome muito parecido — provável duplicata por erro de digitação
  const duplicatasProvaveis = useMemo(() => {
    const alertas = new Map<string, string>() // patioId -> nome do pátio parecido
    for (let i = 0; i < patios.length; i++) {
      for (let j = i + 1; j < patios.length; j++) {
        const a = normalizarNome(patios[i].nome)
        const b = normalizarNome(patios[j].nome)
        if (a === b) continue
        const dist = distanciaLevenshtein(a, b)
        if (dist > 0 && dist <= 2 && Math.min(a.length, b.length) >= 5) {
          alertas.set(patios[i].id, patios[j].nome)
          alertas.set(patios[j].id, patios[i].nome)
        }
      }
    }
    return alertas
  }, [patios])

  async function handleCriar() {
    if (!novoNome.trim()) return
    setErro(null)
    setCriando(true)
    try {
      await criarPatio(novoNome)
      setNovoNome('')
      await refetch()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível criar o pátio.')
    } finally {
      setCriando(false)
    }
  }

  function iniciarEdicao(p: Patio) {
    setEditandoId(p.id)
    setNomeEdicao(p.nome)
    setMesclandoId(null)
  }

  async function salvarEdicao(id: string) {
    if (!nomeEdicao.trim()) return
    setErro(null)
    setSalvandoEdicao(true)
    try {
      await renomearPatio(id, nomeEdicao)
      setEditandoId(null)
      await refetch()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível renomear o pátio.')
    } finally {
      setSalvandoEdicao(false)
    }
  }

  function iniciarMesclagem(p: Patio) {
    setMesclandoId(p.id)
    setDestinoMesclagem('')
    setEditandoId(null)
  }

  async function confirmarMesclagem(origem: Patio) {
    const destino = patios.find((p) => p.id === destinoMesclagem)
    if (!destino) return
    const qtd = contagemPorPatio.get(origem.id) ?? 0
    if (
      !confirm(
        `Mesclar "${origem.nome}" em "${destino.nome}"?\n\n${qtd} veículo(s) no pátio agora serão movidos para "${destino.nome}" (o histórico também é atualizado). O pátio "${origem.nome}" será removido. Essa ação não pode ser desfeita.`,
      )
    ) {
      return
    }
    setErro(null)
    setProcessandoMesclagem(true)
    try {
      await mesclarPatios(origem.id, destino.id)
      setMesclandoId(null)
      await refetch()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível mesclar os pátios.')
    } finally {
      setProcessandoMesclagem(false)
    }
  }

  async function handleExcluir(p: Patio) {
    if (!isAdmin) {
      setErro('Só administradores podem excluir pátios.')
      return
    }
    const qtd = contagemPorPatio.get(p.id) ?? 0
    if (qtd > 0) {
      setErro(`"${p.nome}" tem ${qtd} veículo(s) no pátio agora — mescle com outro pátio antes de excluir.`)
      return
    }
    if (!confirm(`Excluir o pátio "${p.nome}"? Essa ação não pode ser desfeita.`)) return
    setErro(null)
    setExcluindoId(p.id)
    try {
      await excluirPatio(p.id)
      await refetch()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível excluir o pátio.')
    } finally {
      setExcluindoId(null)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-3">
          <p className="text-sm text-secondary">
            Pátios/setores usados nas movimentações e no trajeto de manutenção. Nomes muito parecidos (typo, plural,
            espaço a mais) fazem veículos "sumirem" dos filtros — use "Mesclar" para unificar duplicatas.
          </p>
          <div className="flex gap-2">
            <Input
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value.toUpperCase())}
              placeholder="Nome do novo pátio"
              className="uppercase"
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleCriar() }
              }}
            />
            <Button type="button" onClick={handleCriar} disabled={criando || !novoNome.trim()}>
              {criando ? 'Criando…' : 'Criar pátio'}
            </Button>
          </div>
          {erro && <p className="text-sm text-status-danger">{erro}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <p className="text-sm text-secondary">Carregando pátios…</p>
          ) : patios.length === 0 ? (
            <p className="text-sm text-secondary">Nenhum pátio cadastrado.</p>
          ) : (
            <div className="space-y-2">
              {patios.map((p) => {
                const qtd = contagemPorPatio.get(p.id) ?? 0
                const parecidoCom = duplicatasProvaveis.get(p.id)
                const outrosPatios = patios.filter((op) => op.id !== p.id)

                return (
                  <div key={p.id} className="rounded-xl bg-background px-4 py-3 space-y-2">
                    {editandoId === p.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          value={nomeEdicao}
                          onChange={(e) => setNomeEdicao(e.target.value.toUpperCase())}
                          className="uppercase flex-1 min-w-[160px]"
                          autoFocus
                        />
                        <Button type="button" size="md" onClick={() => salvarEdicao(p.id)} disabled={salvandoEdicao}>
                          <Check className="h-4 w-4" />
                          Salvar
                        </Button>
                        <Button type="button" variant="secondary" size="md" onClick={() => setEditandoId(null)}>
                          <X className="h-4 w-4" />
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-foreground font-medium">{p.nome}</p>
                          <Badge tone="neutral">{qtd} no pátio agora</Badge>
                          {parecidoCom && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Parecido com "{parecidoCom}"
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            onClick={() => iniciarEdicao(p)}
                            aria-label={`Renomear ${p.nome}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            onClick={() => iniciarMesclagem(p)}
                            aria-label={`Mesclar ${p.nome}`}
                            title="Mesclar com outro pátio"
                          >
                            <GitMerge className="h-4 w-4" />
                          </Button>
                          {isAdmin && (
                            <Button
                              type="button"
                              variant="danger"
                              size="icon"
                              onClick={() => handleExcluir(p)}
                              disabled={excluindoId === p.id}
                              aria-label={`Excluir ${p.nome}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    {mesclandoId === p.id && (
                      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/30 bg-surface p-3">
                        <span className="text-xs font-semibold uppercase text-secondary">Mesclar em:</span>
                        <Select
                          value={destinoMesclagem}
                          onChange={(e) => setDestinoMesclagem(e.target.value)}
                          className="!h-9 !text-sm !w-auto flex-1 min-w-[160px]"
                        >
                          <option value="">Selecione o pátio de destino</option>
                          {outrosPatios.map((op) => (
                            <option key={op.id} value={op.id}>
                              {op.nome}
                            </option>
                          ))}
                        </Select>
                        <Button
                          type="button"
                          size="md"
                          onClick={() => confirmarMesclagem(p)}
                          disabled={!destinoMesclagem || processandoMesclagem}
                        >
                          {processandoMesclagem ? 'Mesclando…' : 'Confirmar mesclagem'}
                        </Button>
                        <Button type="button" variant="secondary" size="md" onClick={() => setMesclandoId(null)}>
                          Cancelar
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
