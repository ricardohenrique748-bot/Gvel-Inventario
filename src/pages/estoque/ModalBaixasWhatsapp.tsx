import { useMemo, useRef, useState } from 'react'
import { AlertTriangle, ImagePlus, Loader2, MessageSquareText, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Label, Select } from '@/components/ui/Input'
import { EQUIPE_GVEL } from '@/constants/equipe'
import { useEquipeConhecida } from '@/hooks/useEquipeConhecida'
import { comprimirImagem } from '@/lib/imagem'
import { estoqueDisponivel } from '@/lib/tambores'
import { lerBaixasWhatsapp, separarImagensDoTexto, type ImagemLeitura } from '@/lib/lerBaixasWhatsapp'
import type { ItemConsumo, RegistroBaixaConsumo } from '@/lib/types'

interface Linha {
  key: string
  selecionada: boolean
  itemTexto: string
  itemId: string
  quantidade: string
  placa: string
  responsavel: string
  motivo: string
  observacao: string | null
}

interface Props {
  itens: ItemConsumo[]
  placas: string[]
  onClose: () => void
  /** Grava as baixas (em sequência). Deve lançar erro se alguma falhar. */
  onConfirmar: (baixas: RegistroBaixaConsumo[]) => Promise<void>
}

function arquivoParaBase64(file: File): Promise<ImagemLeitura> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result)
      resolve({ data: dataUrl.replace(/^data:[^,]+,/, ''), mediaType: file.type || 'image/jpeg' })
    }
    reader.onerror = () => reject(new Error('Não foi possível ler a foto.'))
    reader.readAsDataURL(file)
  })
}

/**
 * Colar a conversa do WhatsApp → a IA separa as baixas de insumo → o usuário
 * confere/corrige cada linha → confirma e as baixas são lançadas.
 */
export function ModalBaixasWhatsapp({ itens, placas, onClose, onConfirmar }: Props) {
  const [texto, setTexto] = useState('')
  const [fotos, setFotos] = useState<{ file: File; url: string }[]>([])
  const [lendo, setLendo] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [linhas, setLinhas] = useState<Linha[] | null>(null)
  const [ignorados, setIgnorados] = useState<{ trecho: string; motivo: string }[]>([])
  const fotoInputRef = useRef<HTMLInputElement>(null)

  const nomesEquipeReal = useEquipeConhecida()
  const equipe = useMemo(
    () => Array.from(new Set([...EQUIPE_GVEL.map((m) => m.nome), ...nomesEquipeReal])).sort(),
    [nomesEquipeReal],
  )
  const itensOrdenados = useMemo(() => [...itens].sort((a, b) => a.nome.localeCompare(b.nome)), [itens])
  const itemPorId = useMemo(() => new Map(itens.map((it) => [it.id, it])), [itens])

  async function adicionarFotos(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(e.target.files ?? [])
    e.target.value = ''
    for (const arquivo of arquivos) {
      const comprimida = await comprimirImagem(arquivo)
      setFotos((prev) => [...prev, { file: comprimida, url: URL.createObjectURL(comprimida) }])
    }
  }

  async function ler() {
    setErro(null)
    const { texto: textoLimpo, imagens: imagensDoTexto } = separarImagensDoTexto(texto)
    if (!textoLimpo.trim()) {
      setErro('Cole a mensagem do WhatsApp.')
      return
    }
    setLendo(true)
    try {
      const anexadas = await Promise.all(fotos.map((f) => arquivoParaBase64(f.file)))
      // Fotos anexadas entram depois das que vieram no texto, avisando a IA.
      const textoFinal =
        anexadas.length > 0
          ? `${textoLimpo}\n\n(Fotos anexadas à parte: ${anexadas
              .map((_, i) => `[IMAGEM ${imagensDoTexto.length + i + 1}]`)
              .join(', ')})`
          : textoLimpo
      const r = await lerBaixasWhatsapp({
        texto: textoFinal,
        imagens: [...imagensDoTexto, ...anexadas],
        itens,
        equipe,
        placas,
      })
      setLinhas(
        r.baixas.map((b, i) => ({
          key: `${i}-${b.item_texto}`,
          selecionada: true,
          itemTexto: b.item_texto,
          itemId: b.item_id ?? '',
          quantidade: b.quantidade != null ? String(b.quantidade) : '',
          placa: b.placa ?? '',
          responsavel: b.responsavel ?? '',
          motivo: b.motivo ?? '',
          observacao: b.observacao,
        })),
      )
      setIgnorados(r.ignorados)
      if (r.baixas.length === 0) setErro('Nenhuma baixa encontrada na mensagem.')
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível ler a mensagem.')
    } finally {
      setLendo(false)
    }
  }

  function atualizar(key: string, campos: Partial<Linha>) {
    setLinhas((prev) => prev?.map((l) => (l.key === key ? { ...l, ...campos } : l)) ?? null)
  }

  // Estoque que sobra por item depois das linhas marcadas (um mesmo item pode
  // aparecer em várias linhas, ex.: 2 colas para cada uma de 3 placas).
  const problemas = useMemo(() => {
    const porLinha = new Map<string, string>()
    const usadoPorItem = new Map<string, number>()
    for (const l of linhas ?? []) {
      if (!l.selecionada) continue
      const item = itemPorId.get(l.itemId)
      const qtd = Number(l.quantidade.replace(',', '.'))
      if (!item) porLinha.set(l.key, 'Escolha o insumo.')
      else if (!(qtd > 0)) porLinha.set(l.key, 'Informe a quantidade.')
      else if (!l.responsavel.trim()) porLinha.set(l.key, 'Informe o responsável.')
      else {
        const usado = (usadoPorItem.get(item.id) ?? 0) + qtd
        usadoPorItem.set(item.id, usado)
        const disponivel = estoqueDisponivel(item)
        if (usado > disponivel) porLinha.set(l.key, `Estoque insuficiente (disponível: ${disponivel} ${item.unidade}).`)
      }
    }
    return porLinha
  }, [linhas, itemPorId])

  const selecionadas = linhas?.filter((l) => l.selecionada) ?? []

  async function confirmar() {
    if (selecionadas.length === 0 || problemas.size > 0) return
    setSalvando(true)
    setErro(null)
    try {
      await onConfirmar(
        selecionadas.map((l, i) => {
          const item = itemPorId.get(l.itemId)!
          return {
            id: `baixa_${Date.now()}_${i}`,
            item_id: item.id,
            item_nome: item.nome,
            unidade: item.unidade,
            quantidade: Math.round(Number(l.quantidade.replace(',', '.')) * 1000) / 1000,
            responsavel: l.responsavel.trim().toUpperCase(),
            placa: l.placa.trim() ? l.placa.trim().toUpperCase() : null,
            motivo: l.motivo.trim() ? l.motivo.trim().toUpperCase() : null,
            data_hora: new Date().toISOString(),
          }
        }),
      )
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao lançar as baixas.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-3xl rounded-2xl border border-border/20 bg-surface shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between border-b border-border/10 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <MessageSquareText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-foreground uppercase">Baixas pelo WhatsApp</h2>
              <p className="text-[11px] text-secondary">Cole a conversa, confira as baixas e confirme</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-secondary hover:bg-surface-hover" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {!linhas ? (
            <>
              <div>
                <Label htmlFor="texto-whatsapp">Mensagem do WhatsApp</Label>
                <textarea
                  id="texto-whatsapp"
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  rows={10}
                  placeholder={'Cole aqui as mensagens. Ex.:\n05 folhas de lixa 80\n02 fita crepe larga\nPlaca FRI8E96\nColaborador João Vitor funilaria'}
                  className="mt-1 w-full rounded-xl border border-border/30 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <p className="mt-1 text-[11px] text-secondary">
                  Fotos que vierem junto no texto copiado são lidas automaticamente. Se a placa veio só em foto, anexe a foto abaixo.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label>Fotos (opcional)</Label>
                  <Button type="button" variant="secondary" size="md" onClick={() => fotoInputRef.current?.click()} className="gap-1.5 text-xs">
                    <ImagePlus className="h-4 w-4" />
                    Anexar fotos
                  </Button>
                  <input ref={fotoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={adicionarFotos} />
                </div>
                {fotos.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {fotos.map((f, i) => (
                      <div key={f.url} className="relative">
                        <img src={f.url} alt={`Foto ${i + 1}`} className="h-16 w-16 rounded-lg object-cover border border-border/20" />
                        <button
                          type="button"
                          onClick={() => setFotos((prev) => prev.filter((x) => x.url !== f.url))}
                          className="absolute -right-1.5 -top-1.5 rounded-full bg-black/80 p-0.5 text-white"
                          aria-label="Remover foto"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-secondary">
                Confira cada linha. Só as marcadas serão lançadas. Corrija o que estiver errado antes de confirmar.
              </p>
              <div className="space-y-3">
                {linhas.map((l) => {
                  const item = itemPorId.get(l.itemId)
                  const problema = problemas.get(l.key)
                  return (
                    <div
                      key={l.key}
                      className={`rounded-xl border p-3 space-y-2 ${
                        !l.selecionada ? 'border-border/20 opacity-50' : problema ? 'border-status-danger/50' : 'border-border/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={l.selecionada}
                            onChange={(e) => atualizar(l.key, { selecionada: e.target.checked })}
                            className="h-4 w-4 rounded"
                          />
                          <span className="text-xs text-secondary">
                            Na mensagem: <strong className="text-foreground">{l.itemTexto}</strong>
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setLinhas((prev) => prev?.filter((x) => x.key !== l.key) ?? null)}
                          className="rounded-lg p-1 text-secondary hover:text-status-danger"
                          aria-label="Remover linha"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
                        <Select
                          value={l.itemId}
                          onChange={(e) => atualizar(l.key, { itemId: e.target.value })}
                          className="!h-9 !text-xs"
                          aria-label="Insumo"
                        >
                          <option value="">— Escolha o insumo —</option>
                          {itensOrdenados.map((it) => (
                            <option key={it.id} value={it.id}>
                              {it.nome} ({estoqueDisponivel(it)} {it.unidade})
                            </option>
                          ))}
                        </Select>
                        <div className="flex items-center gap-1.5">
                          <Input
                            value={l.quantidade}
                            onChange={(e) => atualizar(l.key, { quantidade: e.target.value })}
                            inputMode="decimal"
                            className="!h-9 !text-xs"
                            aria-label="Quantidade"
                          />
                          <span className="text-[11px] font-bold text-secondary">{item?.unidade ?? ''}</span>
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-3">
                        <Input
                          value={l.placa}
                          onChange={(e) => atualizar(l.key, { placa: e.target.value.toUpperCase() })}
                          placeholder="Placa"
                          className="!h-9 !text-xs uppercase"
                          aria-label="Placa"
                        />
                        <Input
                          value={l.responsavel}
                          onChange={(e) => atualizar(l.key, { responsavel: e.target.value })}
                          placeholder="Responsável"
                          list="equipe-baixas-whatsapp"
                          className="!h-9 !text-xs uppercase"
                          aria-label="Responsável"
                        />
                        <Input
                          value={l.motivo}
                          onChange={(e) => atualizar(l.key, { motivo: e.target.value })}
                          placeholder="Motivo / setor"
                          className="!h-9 !text-xs uppercase"
                          aria-label="Motivo"
                        />
                      </div>

                      {l.observacao && (
                        <p className="flex items-start gap-1.5 text-[11px] text-amber-500">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
                          {l.observacao}
                        </p>
                      )}
                      {l.selecionada && problema && <p className="text-[11px] font-semibold text-status-danger">{problema}</p>}
                    </div>
                  )
                })}
              </div>
              <datalist id="equipe-baixas-whatsapp">
                {equipe.map((nome) => (
                  <option key={nome} value={nome} />
                ))}
              </datalist>

              {ignorados.length > 0 && (
                <div className="rounded-xl bg-background p-3">
                  <p className="text-xs font-bold text-foreground uppercase mb-1.5">Não virou baixa</p>
                  <ul className="space-y-1">
                    {ignorados.map((ig, i) => (
                      <li key={i} className="text-[11px] text-secondary">
                        <span className="text-foreground">“{ig.trecho}”</span> — {ig.motivo}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {erro && <p className="text-xs font-semibold text-status-danger">{erro}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-border/10 px-6 py-4">
          {linhas ? (
            <>
              <Button type="button" variant="secondary" onClick={() => setLinhas(null)} disabled={salvando}>
                Voltar
              </Button>
              <Button type="button" onClick={confirmar} disabled={salvando || selecionadas.length === 0 || problemas.size > 0}>
                {salvando ? 'Lançando…' : `Confirmar ${selecionadas.length} baixa(s)`}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="button" onClick={ler} disabled={lendo || !texto.trim()} className="gap-2">
                {lendo && <Loader2 className="h-4 w-4 animate-spin" />}
                {lendo ? 'Lendo mensagem…' : 'Ler mensagem'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
