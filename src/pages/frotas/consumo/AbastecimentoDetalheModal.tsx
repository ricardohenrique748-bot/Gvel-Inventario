import { useEffect, useState } from 'react'
import { X, History, ShieldCheck, Ban, RotateCcw, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Label, Select, Textarea } from '@/components/ui/Input'
import {
  atualizarAbastecimento,
  buscarAuditoria,
  type AbastecimentoConsumo,
  type AlertaConsumo,
  type RegistroAuditoria,
} from '@/hooks/useConsumoCombustivel'
import { TIPO_ALERTA_LABEL, conferirValorTotal, type ConfigConsumo } from './dominio'
import { StatusAbastecimentoBadge, fmtDataHora, fmtMoeda, fmtNum, parseDecimal } from './ui'
import { erroConsumo } from './erros'

const ACAO_LABEL: Record<string, string> = {
  criacao: 'Criação',
  edicao: 'Edição',
  validacao: 'Validação',
  invalidacao: 'Invalidação',
  reativacao: 'Reativação',
  correcao_odometro: 'Correção de odômetro',
  correcao_litros: 'Correção de litros',
  correcao_tanque_cheio: 'Correção de tanque cheio',
  exclusao: 'Exclusão',
}

const CAMPOS_AUDITADOS: [string, string][] = [
  ['odometro', 'Odômetro'],
  ['horas_motor', 'Horímetro'],
  ['volume', 'Litros'],
  ['valor_unitario', 'Valor/litro'],
  ['valor_total', 'Valor total'],
  ['tanque_cheio', 'Tanque cheio'],
  ['combustivel', 'Combustível'],
  ['status', 'Status'],
  ['motorista_nome', 'Motorista'],
  ['observacoes', 'Observação'],
]

interface Props {
  abastecimento: AbastecimentoConsumo
  alertas: AlertaConsumo[]
  config: ConfigConsumo
  isAdmin: boolean
  onClose: () => void
}

export function AbastecimentoDetalheModal({ abastecimento: a, alertas, config, isAdmin, onClose }: Props) {
  const [auditoria, setAuditoria] = useState<RegistroAuditoria[] | null>(null)
  const [modo, setModo] = useState<'ver' | 'editar' | 'invalidar' | 'observacao'>('ver')
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({
    odometro: a.odometro != null ? String(a.odometro) : '',
    horimetro: a.horimetro != null ? String(a.horimetro) : '',
    litros: String(a.litros),
    valorLitro: a.valorLitro != null ? String(a.valorLitro) : '',
    tanqueCheio: a.tanqueCheio,
    combustivel: a.combustivel,
    motorista: a.motoristaNome ?? '',
    observacoes: a.observacoes ?? '',
  })

  useEffect(() => {
    buscarAuditoria(a.id)
      .then(setAuditoria)
      .catch(() => setAuditoria([]))
  }, [a.id])

  const alertasDoRegistro = alertas.filter((al) => al.referenciaId === a.id)

  async function executar(fn: () => Promise<void>) {
    setErro(null)
    setSalvando(true)
    try {
      await fn()
      onClose()
    } catch (err) {
      setErro(erroConsumo(err, 'Não foi possível salvar.'))
    } finally {
      setSalvando(false)
    }
  }

  function salvarEdicao() {
    const odometro = form.odometro.trim() ? parseDecimal(form.odometro) ?? null : null
    const mudouOdometro = odometro !== (a.odometro ?? null)
    if (mudouOdometro && !isAdmin) return setErro('Só administradores podem corrigir o odômetro.')
    if (!motivo.trim()) return setErro('Informe a justificativa da alteração.')
    const litros = parseDecimal(form.litros)
    if (!litros || litros <= 0) return setErro('Litros inválidos.')
    const valorLitro = form.valorLitro.trim() ? parseDecimal(form.valorLitro) ?? null : null
    const { valorTotal } = conferirValorTotal(litros, valorLitro ?? undefined, valorLitro == null ? a.valorTotal : undefined, config.toleranciaValorTotal)
    executar(() =>
      atualizarAbastecimento(
        a.id,
        {
          odometro,
          horimetro: form.horimetro.trim() ? parseDecimal(form.horimetro) ?? null : null,
          litros,
          valorLitro,
          valorTotal,
          tanqueCheio: form.tanqueCheio,
          combustivel: form.combustivel,
          motoristaNome: form.motorista.trim() || null,
          observacoes: form.observacoes.trim() || null,
        },
        motivo,
      ),
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4 animate-fade-in">
      <div className="flex w-full max-w-2xl flex-col overflow-hidden bg-surface shadow-2xl sm:max-h-[94vh] sm:rounded-2xl sm:border sm:border-border/20">
        <div className="flex items-center justify-between border-b border-border/10 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-black uppercase text-foreground">
              {a.placa} · {fmtDataHora(a.dataHora)}
            </h2>
            <StatusAbastecimentoBadge status={a.status} />
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-xl p-2 text-secondary hover:bg-background hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-4 text-sm sm:p-6">
          {erro && <div className="rounded-xl border border-status-danger/30 bg-status-danger/10 px-3.5 py-2.5 normal-case text-status-danger">{erro}</div>}

          {modo === 'ver' && (
            <>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Item label="Combustível" valor={a.combustivel} />
                <Item label="Tanque cheio" valor={a.tanqueCheio ? 'Sim' : 'Não (parcial)'} />
                <Item label="Litros" valor={`${fmtNum(a.litros, 1)} L`} />
                <Item label="Odômetro" valor={a.odometro != null ? `${fmtNum(a.odometro)} km` : '—'} />
                <Item label="Horímetro" valor={a.horimetro != null ? `${fmtNum(a.horimetro, 1)} h` : '—'} />
                <Item label="Valor/litro" valor={a.valorLitro != null ? fmtMoeda(a.valorLitro) : '—'} />
                <Item label="Valor total" valor={fmtMoeda(a.valorTotal)} />
                <Item label="Total na nota" valor={a.valorTotalInformado != null ? fmtMoeda(a.valorTotalInformado) : '—'} />
                <Item label="Motorista" valor={a.motoristaNome ?? '—'} />
                <Item label="Posto" valor={a.postoNome || '—'} />
                <Item label="Origem" valor={a.origem} />
                <Item label="Registrado por" valor={a.createdByNome ?? '—'} />
              </dl>
              {a.observacoes && <p className="rounded-xl bg-background p-3 normal-case text-secondary">{a.observacoes}</p>}

              {(a.motivosRevisao.length > 0 || alertasDoRegistro.length > 0) && (
                <div className="space-y-1 rounded-xl border border-status-warning/30 bg-status-warning/10 p-3 text-xs normal-case">
                  {a.motivosRevisao.map((m) => (
                    <p key={m} className="font-semibold text-foreground">⚠ {TIPO_ALERTA_LABEL[m] ?? m}</p>
                  ))}
                  {alertasDoRegistro.map((al) => (
                    <p key={al.id} className="text-secondary">{al.mensagem}</p>
                  ))}
                </div>
              )}

              {(a.fotoCupomUrl || a.fotoPainelUrl) && (
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { url: a.fotoCupomUrl, label: 'Cupom' },
                    { url: a.fotoPainelUrl, label: 'Painel' },
                  ]
                    .filter((f) => f.url)
                    .map((f) => (
                      <a key={f.label} href={f.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-border/20">
                        {f.url!.toLowerCase().endsWith('.pdf') ? (
                          <span className="flex h-36 items-center justify-center text-xs font-bold text-primary">ABRIR PDF</span>
                        ) : (
                          <img src={f.url} alt={f.label} className="h-36 w-full object-cover" />
                        )}
                        <span className="block bg-background px-2 py-1 text-center text-[10px] font-bold">{f.label}</span>
                      </a>
                    ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {a.status === 'pendente_revisao' && (
                  <Button
                    type="button"
                    size="md"
                    variant="success"
                    disabled={salvando}
                    onClick={() => executar(() => atualizarAbastecimento(a.id, { status: 'valido', motivosRevisao: [] }, motivo || 'Validado na revisão'))}
                  >
                    <ShieldCheck className="h-4 w-4" /> Validar
                  </Button>
                )}
                <Button type="button" size="md" variant="secondary" onClick={() => setModo('editar')}>
                  <Pencil className="h-4 w-4" /> Editar / corrigir
                </Button>
                <Button type="button" size="md" variant="secondary" onClick={() => setModo('observacao')}>
                  Adicionar observação
                </Button>
                {isAdmin && a.status !== 'invalidado' && (
                  <Button type="button" size="md" variant="danger" onClick={() => setModo('invalidar')}>
                    <Ban className="h-4 w-4" /> Invalidar
                  </Button>
                )}
                {isAdmin && a.status === 'invalidado' && (
                  <Button
                    type="button"
                    size="md"
                    variant="secondary"
                    disabled={salvando}
                    onClick={() => executar(() => atualizarAbastecimento(a.id, { status: 'pendente_revisao' }, 'Reativado para nova revisão'))}
                  >
                    <RotateCcw className="h-4 w-4" /> Reativar
                  </Button>
                )}
              </div>
            </>
          )}

          {modo === 'invalidar' && (
            <div className="space-y-3">
              <p className="normal-case text-secondary">
                O abastecimento deixa de contar nos ciclos e na média. O registro não é apagado e a ação fica na auditoria.
              </p>
              <Motivo valor={motivo} onChange={setMotivo} />
              <div className="flex gap-2">
                <Button type="button" variant="secondary" size="md" onClick={() => setModo('ver')}>
                  Voltar
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="md"
                  disabled={salvando}
                  onClick={() => (motivo.trim() ? executar(() => atualizarAbastecimento(a.id, { status: 'invalidado' }, motivo)) : setErro('Informe a justificativa.'))}
                >
                  Confirmar invalidação
                </Button>
              </div>
            </div>
          )}

          {modo === 'observacao' && (
            <div className="space-y-3">
              <Label htmlFor="obsNova">Observação</Label>
              <Textarea id="obsNova" rows={3} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
              <div className="flex gap-2">
                <Button type="button" variant="secondary" size="md" onClick={() => setModo('ver')}>
                  Voltar
                </Button>
                <Button
                  type="button"
                  size="md"
                  disabled={salvando}
                  onClick={() => executar(() => atualizarAbastecimento(a.id, { observacoes: form.observacoes.trim() || null }, 'Observação adicionada'))}
                >
                  Salvar observação
                </Button>
              </div>
            </div>
          )}

          {modo === 'editar' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Campo label={`Odômetro${isAdmin ? '' : ' (só admin)'}`} valor={form.odometro} disabled={!isAdmin} onChange={(v) => setForm({ ...form, odometro: v })} />
                <Campo label="Horímetro" valor={form.horimetro} onChange={(v) => setForm({ ...form, horimetro: v })} />
                <Campo label="Litros" valor={form.litros} onChange={(v) => setForm({ ...form, litros: v })} />
                <Campo label="Valor/litro" valor={form.valorLitro} onChange={(v) => setForm({ ...form, valorLitro: v })} />
                <div>
                  <Label htmlFor="edComb">Combustível</Label>
                  <Select id="edComb" value={form.combustivel} onChange={(e) => setForm({ ...form, combustivel: e.target.value })}>
                    {['DIESEL S10', 'DIESEL S500'].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                    {!['DIESEL S10', 'DIESEL S500'].includes(form.combustivel) && <option>{form.combustivel}</option>}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edTq">Tanque cheio</Label>
                  <Select id="edTq" value={form.tanqueCheio ? 's' : 'n'} onChange={(e) => setForm({ ...form, tanqueCheio: e.target.value === 's' })}>
                    <option value="s">Sim</option>
                    <option value="n">Não (parcial)</option>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label htmlFor="edMot">Motorista</Label>
                  <Input id="edMot" value={form.motorista} onChange={(e) => setForm({ ...form, motorista: e.target.value })} />
                </div>
              </div>
              <Motivo valor={motivo} onChange={setMotivo} />
              <div className="flex gap-2">
                <Button type="button" variant="secondary" size="md" onClick={() => setModo('ver')}>
                  Voltar
                </Button>
                <Button type="button" size="md" disabled={salvando} onClick={salvarEdicao}>
                  Salvar correção
                </Button>
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-black uppercase text-secondary">
              <History className="h-3.5 w-3.5" /> Auditoria
            </p>
            {auditoria == null ? (
              <p className="text-xs text-secondary">Carregando…</p>
            ) : auditoria.length === 0 ? (
              <p className="text-xs normal-case text-secondary">Sem registros de auditoria (criado antes do controle de consumo).</p>
            ) : (
              <ul className="space-y-2">
                {auditoria.map((r) => (
                  <li key={r.id} className="rounded-xl bg-background p-3 text-xs normal-case">
                    <p className="font-bold text-foreground">
                      {ACAO_LABEL[r.acao] ?? r.acao} · {fmtDataHora(r.createdAt)} · {r.usuarioEmail ?? 'sistema'}
                    </p>
                    {r.motivo && <p className="text-secondary">Motivo: {r.motivo}</p>}
                    {r.valoresAnteriores && r.valoresNovos && (
                      <ul className="mt-1 text-secondary">
                        {CAMPOS_AUDITADOS.filter(([k]) => JSON.stringify(r.valoresAnteriores![k]) !== JSON.stringify(r.valoresNovos![k])).map(([k, label]) => (
                          <li key={k}>
                            {label}: {String(r.valoresAnteriores![k] ?? '—')} → <strong className="text-foreground">{String(r.valoresNovos![k] ?? '—')}</strong>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Item({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase text-secondary">{label}</dt>
      <dd className="font-semibold text-foreground">{valor}</dd>
    </div>
  )
}

function Campo({ label, valor, onChange, disabled }: { label: string; valor: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input inputMode="decimal" noUppercase value={valor} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function Motivo({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label htmlFor="motivoAlt">Justificativa *</Label>
      <Textarea id="motivoAlt" rows={2} value={valor} onChange={(e) => onChange(e.target.value)} placeholder="Obrigatória — fica registrada na auditoria" />
    </div>
  )
}
