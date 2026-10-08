import { useMemo, useState } from 'react'
import { Fuel, X, Camera, AlertTriangle, Ban, CheckCircle2, CloudOff, Trash2, FileText, FileUp } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Label, Select, Textarea } from '@/components/ui/Input'
import { SearchableSelect } from '@/components/SearchableSelect'
import { nowLocalInputValue, toLocalInputValue } from '@/lib/format'
import {
  arquivoParaDataUrl,
  registrarAbastecimento,
  AbastecimentoBloqueadoError,
  type AbastecimentoConsumo,
  type ConfigConsumoCompleta,
  type MetaConsumoVeiculo,
  type Posto,
} from '@/hooks/useConsumoCombustivel'
import { enfileirarAbastecimento, isErroDeRede } from './filaOffline'
import { conferirValorTotal, ordenarAbastecimentos, validarAbastecimento } from './dominio'
import { fmtMoeda, fmtNum, parseDecimal, type VeiculoConsumo } from './ui'
import { soDigitos, type DadosComprovante } from './comprovante'
import { erroConsumo } from './erros'

interface InfoLeitura {
  origem: string
  preenchidos: string[]
  faltando: string[]
  avisos: string[]
}

function QuadroLeitura({ info }: { info: InfoLeitura }) {
  return (
    <div className="space-y-1 rounded-xl border border-border/20 bg-background p-3 text-xs normal-case">
      {info.preenchidos.length > 0 && (
        <p className="text-status-success">
          ✓ Preenchido {info.origem === 'foto' ? 'pela foto' : 'pelo PDF'}: {info.preenchidos.join(', ')}.
        </p>
      )}
      {info.avisos.map((a, i) => (
        <p key={i} className="text-status-warning">⚠ {a}</p>
      ))}
      {info.faltando.length > 0 && <p className="text-secondary">Falta informar: {info.faltando.join(', ')}.</p>}
    </div>
  )
}

const numBR = (n: number, casas = 2) => n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: 3, useGrouping: false })

function lerArquivoComoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

const COMBUSTIVEIS = ['DIESEL S10', 'DIESEL S500']

interface Props {
  veiculos: VeiculoConsumo[]
  abastecimentos: AbastecimentoConsumo[]
  postos: Posto[]
  motoristas: string[]
  metas: Record<string, MetaConsumoVeiculo>
  config: ConfigConsumoCompleta
  usuarioNome: string
  placaInicial?: string
  onClose: () => void
}

type Resultado =
  | { tipo: 'salvo'; status: string; revisao: string[]; alertas: string[] }
  | { tipo: 'offline' }

export function AbastecimentoModal({ veiculos, abastecimentos, postos, motoristas, metas, config, usuarioNome, placaInicial, onClose }: Props) {
  const [veiculoId, setVeiculoId] = useState(() => veiculos.find((v) => v.placa === placaInicial)?.id ?? '')
  const [motorista, setMotorista] = useState('')
  const [dataHora, setDataHora] = useState(nowLocalInputValue())
  const [odometro, setOdometro] = useState('')
  const [horimetro, setHorimetro] = useState('')
  const [litros, setLitros] = useState('')
  const [valorLitro, setValorLitro] = useState('')
  const [valorTotalInformado, setValorTotalInformado] = useState('')
  const [postoId, setPostoId] = useState('')
  const [postoLivre, setPostoLivre] = useState('')
  const [tanqueCheio, setTanqueCheio] = useState<boolean | null>(null)
  const [combustivel, setCombustivel] = useState('DIESEL S10')
  const [fotoCupom, setFotoCupom] = useState<string>()
  const [fotoPainel, setFotoPainel] = useState<string>()
  const [observacoes, setObservacoes] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [lendoPdf, setLendoPdf] = useState(false)
  const [infoPdf, setInfoPdf] = useState<InfoLeitura | null>(null)
  // id gerado no aparelho = chave de idempotência (fila offline / reenvio)
  const [id] = useState(() => crypto.randomUUID())

  const veiculo = veiculos.find((v) => v.id === veiculoId)
  const meta = veiculo ? metas[veiculo.placa] : undefined
  const postosAtivos = postos.filter((p) => p.ativo)

  const doVeiculo = useMemo(
    () => (veiculo ? ordenarAbastecimentos(abastecimentos.filter((a) => a.placa === veiculo.placa && a.status !== 'invalidado')) : []),
    [abastecimentos, veiculo],
  )
  const ultimo = [...doVeiculo].reverse().find((a) => a.odometro != null)
  const temReferencia = doVeiculo.some((a) => a.tanqueCheio && a.combustivel.toUpperCase().indexOf('ARLA') < 0)

  const nLitros = parseDecimal(litros)
  const nValorLitro = parseDecimal(valorLitro)
  const nOdometro = parseDecimal(odometro)
  const nHorimetro = parseDecimal(horimetro)
  const nTotalInformado = parseDecimal(valorTotalInformado)
  // Enquanto o campo de data é editado ele fica vazio/incompleto por um
  // instante; new Date('').toISOString() lança e derrubava a tela inteira.
  const dataValida = dataHora ? new Date(dataHora) : null
  const dataHoraIso = dataValida && !Number.isNaN(dataValida.getTime()) ? dataValida.toISOString() : null
  const valor = nLitros ? conferirValorTotal(nLitros, nValorLitro, nTotalInformado, config.toleranciaValorTotal) : undefined

  // Validação ao vivo, com a mesma regra que roda ao gravar.
  const previa = useMemo(() => {
    if (!veiculo || !nLitros || !dataHoraIso) return null
    return validarAbastecimento(
      {
        id,
        placa: veiculo.placa,
        dataHora: dataHoraIso,
        odometro: nOdometro,
        horimetro: nHorimetro,
        litros: nLitros,
        valorLitro: nValorLitro,
        valorTotalInformado: nTotalInformado,
        tanqueCheio: !!tanqueCheio,
        combustivel,
      },
      abastecimentos,
      meta,
      config,
    )
  }, [veiculo, nLitros, nOdometro, nHorimetro, nValorLitro, nTotalInformado, dataHoraIso, tanqueCheio, combustivel, abastecimentos, meta, config, id])

  async function escolherFoto(e: React.ChangeEvent<HTMLInputElement>, set: (v: string | undefined) => void) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      set(await arquivoParaDataUrl(file))
    } catch {
      setErro('Não foi possível carregar a foto.')
    }
  }

  // Preenche o formulário com o que foi lido do comprovante (PDF ou foto).
  // Só escreve os campos que vieram — nunca apaga o que já foi digitado.
  function aplicarDados(d: DadosComprovante, origem: string) {
    const preenchidos: string[] = []
    const avisos: string[] = []

    if (d.placa) {
      const v = veiculos.find((x) => x.placa === d.placa)
      if (v) {
        setVeiculoId(v.id)
        preenchidos.push(`placa ${d.placa}`)
      } else avisos.push(`Placa ${d.placa} do comprovante não está na frota de consumo — selecione manualmente.`)
    }
    if (d.dataHora) {
      setDataHora(toLocalInputValue(d.dataHora.toISOString()))
      preenchidos.push('data/hora')
    }
    if (d.valorTotal != null) {
      setValorTotalInformado(numBR(d.valorTotal))
      preenchidos.push(`valor ${fmtMoeda(d.valorTotal)}`)
    }
    if (d.litros != null) {
      setLitros(numBR(d.litros, 1))
      preenchidos.push('litros')
    }
    if (d.valorLitro != null) {
      setValorLitro(numBR(d.valorLitro, 3))
      preenchidos.push('valor/litro')
    }
    if (d.combustivel && COMBUSTIVEIS.includes(d.combustivel)) {
      setCombustivel(d.combustivel)
      preenchidos.push('combustível')
    }
    if (d.odometro != null) {
      setOdometro(String(Math.round(d.odometro)))
      preenchidos.push('odômetro')
    }
    if (d.motorista) {
      setMotorista(d.motorista.toUpperCase())
      preenchidos.push('motorista')
    }
    if (d.postoNome || d.postoCnpj) {
      const cnpj = soDigitos(d.postoCnpj)
      const posto = postosAtivos.find(
        (p) => (cnpj && soDigitos(p.cnpj) === cnpj) || (d.postoNome && p.nome.toUpperCase() === d.postoNome.toUpperCase()),
      )
      if (posto) setPostoId(posto.id)
      else {
        setPostoId('__outro__')
        setPostoLivre(d.postoNome ?? '')
        if (cnpj) avisos.push(`Posto não cadastrado (CNPJ ${d.postoCnpj}) — cadastre em Configurações para os próximos.`)
      }
      preenchidos.push('posto')
    }
    if (d.identificador) {
      const ident = d.identificador
      const usado = abastecimentos.find((a) => a.observacoes?.includes(ident))
      if (usado) avisos.push(`Este comprovante já foi usado no abastecimento de ${usado.placa} em ${new Date(usado.dataHora).toLocaleDateString('pt-BR')}.`)
      setObservacoes((o) => (o.includes(ident) ? o : [o.trim(), `COMPROVANTE ${ident}`].filter(Boolean).join(' · ')))
    }
    if (d.observacao) avisos.push(`Conferir: ${d.observacao}`)
    if (d.tipo === 'pix') avisos.unshift('Comprovante de pagamento Pix: não traz litros nem preço por litro — use o cupom da bomba para esses dados.')
    if (d.tipo === 'foto' && preenchidos.length > 0) avisos.push('Leitura automática da foto — confira os números antes de registrar.')

    const faltando = [
      d.litros == null && 'litros',
      d.valorLitro == null && 'valor/litro',
      d.odometro == null && 'odômetro',
      'tanque cheio?',
      d.combustivel == null && 'combustível (confira)',
    ].filter((x): x is string => !!x)
    setInfoPdf({ origem, preenchidos, faltando, avisos })
  }

  // Comprovante em PDF (Pix do banco ou cupom/NFC-e do posto): anexa como cupom.
  async function importarPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setErro(null)
    setLendoPdf(true)
    try {
      const { lerComprovantePdf } = await import('./lerComprovantePdf')
      const d = await lerComprovantePdf(file)
      setFotoCupom(await lerArquivoComoDataUrl(file))
      aplicarDados(d, 'PDF')
    } catch (err) {
      setErro(erroConsumo(err, 'Não foi possível ler o PDF.'))
    } finally {
      setLendoPdf(false)
    }
  }

  // Foto do cupom: anexa e manda pra leitura automática (precisa de internet).
  async function escolherFotoCupom(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setErro(null)
    let dataUrl: string
    try {
      dataUrl = await arquivoParaDataUrl(file)
      setFotoCupom(dataUrl)
    } catch {
      setErro('Não foi possível carregar a foto.')
      return
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setInfoPdf({ origem: 'foto', preenchidos: [], faltando: [], avisos: ['Sem internet: a foto foi anexada, mas a leitura automática só funciona online.'] })
      return
    }
    setLendoPdf(true)
    try {
      const { lerCupomPorFoto } = await import('./lerCupomFoto')
      aplicarDados(await lerCupomPorFoto(dataUrl), 'foto')
    } catch (err) {
      setInfoPdf({
        origem: 'foto',
        preenchidos: [],
        faltando: [],
        avisos: [`${erroConsumo(err, 'Leitura automática indisponível.')} A foto continua anexada.`],
      })
    } finally {
      setLendoPdf(false)
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!veiculo) return setErro('Selecione a placa.')
    if (!dataHoraIso) return setErro('Informe a data e hora do abastecimento.')
    if (!nLitros || nLitros <= 0) return setErro('Informe os litros abastecidos.')
    if (tanqueCheio === null) return setErro('Informe se completou o tanque.')
    if (nOdometro == null) return setErro('Informe o odômetro — sem ele não dá pra calcular o consumo.')
    if (previa?.bloqueios.length) return setErro(previa.bloqueios.join(' '))

    const posto = postosAtivos.find((p) => p.id === postoId)
    const input = {
      id,
      veiculoId: veiculo.id,
      placa: veiculo.placa,
      veiculoNome: veiculo.nome,
      motoristaNome: motorista.trim() || undefined,
      dataHora: dataHoraIso,
      odometro: nOdometro,
      horimetro: nHorimetro,
      litros: nLitros,
      valorLitro: nValorLitro,
      valorTotalInformado: nTotalInformado,
      postoId: posto?.id,
      postoNome: posto?.nome ?? postoLivre.trim(),
      tanqueCheio,
      combustivel,
      fotoCupom,
      fotoPainel,
      observacoes: observacoes.trim() || undefined,
      origem: 'web' as const,
      usuarioNome,
    }

    setSalvando(true)
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        enfileirarAbastecimento(input)
        setResultado({ tipo: 'offline' })
        return
      }
      const r = await registrarAbastecimento(input, meta, config)
      setResultado({ tipo: 'salvo', status: r.status, revisao: r.revisao, alertas: r.alertas })
    } catch (err) {
      if (err instanceof AbastecimentoBloqueadoError) setErro(err.message)
      else if (isErroDeRede(err)) {
        enfileirarAbastecimento(input)
        setResultado({ tipo: 'offline' })
      } else setErro(erroConsumo(err, 'Não foi possível salvar o abastecimento.'))
    } finally {
      setSalvando(false)
    }
  }

  const kmDesdeAnterior = nOdometro != null && ultimo?.odometro != null ? nOdometro - ultimo.odometro : undefined

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4 animate-fade-in">
      <div className="flex w-full max-w-xl flex-col overflow-hidden bg-surface shadow-2xl sm:max-h-[94vh] sm:rounded-2xl sm:border sm:border-border/20">
        <div className="flex items-center justify-between border-b border-border/10 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
              <Fuel className="h-5 w-5" />
            </div>
            <h2 className="text-base font-black uppercase text-foreground">Abastecimento</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-xl p-2 text-secondary hover:bg-background hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {resultado ? (
          <div className="flex-1 space-y-4 overflow-y-auto p-6 text-sm">
            {resultado.tipo === 'offline' ? (
              <div className="flex gap-3 rounded-xl border border-status-warning/30 bg-status-warning/10 p-4">
                <CloudOff className="h-5 w-5 shrink-0 text-status-warning" />
                <p className="normal-case text-foreground">
                  Sem internet — o abastecimento foi <strong>salvo no aparelho</strong> e será enviado automaticamente quando a
                  conexão voltar.
                </p>
              </div>
            ) : (
              <>
                <div
                  className={`flex gap-3 rounded-xl border p-4 ${
                    resultado.status === 'valido' ? 'border-status-success/30 bg-status-success/10' : 'border-status-warning/30 bg-status-warning/10'
                  }`}
                >
                  {resultado.status === 'valido' ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-status-success" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 shrink-0 text-status-warning" />
                  )}
                  <p className="normal-case text-foreground">
                    {resultado.status === 'valido'
                      ? 'Abastecimento registrado.'
                      : 'Abastecimento registrado e enviado para a fila de revisão — não entra na média oficial até ser validado.'}
                  </p>
                </div>
                {[...resultado.revisao, ...resultado.alertas].length > 0 && (
                  <ul className="list-disc space-y-1 pl-5 normal-case text-secondary">
                    {[...resultado.revisao, ...resultado.alertas].map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                )}
              </>
            )}
            <Button type="button" className="w-full" onClick={onClose}>
              Fechar
            </Button>
          </div>
        ) : (
          <form onSubmit={salvar} className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
              {erro && (
                <div className="flex gap-2 rounded-xl border border-status-danger/30 bg-status-danger/10 px-3.5 py-2.5 text-sm normal-case text-status-danger">
                  <Ban className="mt-0.5 h-4 w-4 shrink-0" /> {erro}
                </div>
              )}

              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3 text-xs font-bold uppercase text-primary hover:bg-primary/10">
                <FileUp className="h-4 w-4" />
                {lendoPdf ? 'Lendo comprovante…' : 'Importar comprovante (PDF) ou tire a foto do cupom'}
                <input type="file" accept="application/pdf,.pdf" className="hidden" disabled={lendoPdf} onChange={importarPdf} />
              </label>

              {infoPdf && infoPdf.origem === 'PDF' && <QuadroLeitura info={infoPdf} />}

              <SearchableSelect
                label="Placa *"
                value={veiculoId}
                onChange={setVeiculoId}
                options={veiculos.map((v) => ({ id: v.id, label: v.placa, sublabel: v.nome }))}
                placeholder="Selecione a placa"
              />

              {veiculo && (
                <div className="rounded-xl bg-background px-3.5 py-2.5 text-xs normal-case text-secondary">
                  {ultimo ? (
                    <>
                      Último registro: <strong className="text-foreground">{fmtNum(ultimo.odometro)} km</strong> em{' '}
                      {new Date(ultimo.dataHora).toLocaleDateString('pt-BR')}
                      {kmDesdeAnterior != null && kmDesdeAnterior >= 0 && (
                        <> · <strong className="text-foreground">{fmtNum(kmDesdeAnterior)} km</strong> desde o anterior</>
                      )}
                    </>
                  ) : (
                    'Nenhum abastecimento registrado para esta placa.'
                  )}
                  {!temReferencia && (
                    <p className="mt-1 font-semibold text-status-warning">
                      Sem abastecimento de referência: complete o tanque e marque “Tanque cheio: SIM” para iniciar o controle de
                      consumo deste caminhão.
                    </p>
                  )}
                </div>
              )}

              <div>
                <Label>Completou o tanque? *</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { v: true, label: 'Sim, tanque cheio' },
                    { v: false, label: 'Não, parcial' },
                  ].map((o) => (
                    <button
                      key={String(o.v)}
                      type="button"
                      onClick={() => setTanqueCheio(o.v)}
                      className={`h-12 rounded-xl border text-sm font-bold uppercase transition-colors ${
                        tanqueCheio === o.v ? 'border-primary bg-primary/15 text-primary' : 'border-secondary/30 text-secondary hover:border-secondary'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="abLitros">Litros *</Label>
                  <Input id="abLitros" inputMode="decimal" noUppercase placeholder="0,0" value={litros} onChange={(e) => setLitros(e.target.value)} />
                  {!nLitros && nTotalInformado && nValorLitro ? (
                    <button
                      type="button"
                      className="mt-1 text-[11px] font-bold normal-case text-primary underline"
                      onClick={() => setLitros(numBR(nTotalInformado / nValorLitro, 1))}
                    >
                      Calcular: total ÷ valor/litro = {fmtNum(nTotalInformado / nValorLitro, 1)} L
                    </button>
                  ) : null}
                </div>
                <div>
                  <Label htmlFor="abComb">Combustível</Label>
                  <Select id="abComb" value={combustivel} onChange={(e) => setCombustivel(e.target.value)}>
                    {COMBUSTIVEIS.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="abOdo">Odômetro (km) *</Label>
                  <Input id="abOdo" inputMode="decimal" noUppercase placeholder="0" value={odometro} onChange={(e) => setOdometro(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="abHor">Horímetro (h)</Label>
                  <Input id="abHor" inputMode="decimal" noUppercase placeholder="Opcional" value={horimetro} onChange={(e) => setHorimetro(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="abVl">Valor/litro (R$)</Label>
                  <Input id="abVl" inputMode="decimal" noUppercase placeholder="0,000" value={valorLitro} onChange={(e) => setValorLitro(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="abVt">Total na nota (R$)</Label>
                  <Input
                    id="abVt"
                    inputMode="decimal"
                    noUppercase
                    placeholder="Opcional"
                    value={valorTotalInformado}
                    onChange={(e) => setValorTotalInformado(e.target.value)}
                  />
                </div>
              </div>
              {valor && nValorLitro != null && (
                <p className="-mt-2 text-xs normal-case text-secondary">
                  Total calculado: <strong className="text-foreground">{fmtMoeda(valor.valorTotal)}</strong>
                  {valor.divergente && <span className="text-status-warning"> · diferença de {fmtMoeda(valor.diferenca)} na nota</span>}
                </p>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="abMot">Motorista</Label>
                  <Input id="abMot" list="abMotoristas" placeholder="Nome do motorista" value={motorista} onChange={(e) => setMotorista(e.target.value)} />
                  <datalist id="abMotoristas">
                    {motoristas.map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <Label htmlFor="abData">Data/hora</Label>
                  <Input id="abData" type="datetime-local" value={dataHora} onChange={(e) => setDataHora(e.target.value)} />
                </div>
              </div>

              <div>
                <Label htmlFor="abPosto">Posto</Label>
                <Select id="abPosto" value={postoId} onChange={(e) => setPostoId(e.target.value)}>
                  <option value="">{postosAtivos.length ? 'Selecione o posto' : 'Nenhum posto cadastrado'}</option>
                  {postosAtivos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                      {p.cidade ? ` — ${p.cidade}` : ''}
                      {p.interno ? ' (interno)' : ''}
                    </option>
                  ))}
                  <option value="__outro__">Outro (digitar)</option>
                </Select>
                {postoId === '__outro__' && (
                  <Input className="mt-2" placeholder="Nome do posto" value={postoLivre} onChange={(e) => setPostoLivre(e.target.value)} />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FotoCampo label="Foto do cupom" valor={fotoCupom} onEscolher={escolherFotoCupom} onRemover={() => setFotoCupom(undefined)} />
                <FotoCampo label="Foto do painel" valor={fotoPainel} onEscolher={(e) => escolherFoto(e, setFotoPainel)} onRemover={() => setFotoPainel(undefined)} />
              </div>
              {lendoPdf && <p className="-mt-2 text-xs font-bold text-primary">Lendo o cupom e preenchendo os campos…</p>}
              {infoPdf && infoPdf.origem === 'foto' && <QuadroLeitura info={infoPdf} />}

              <div>
                <Label htmlFor="abObs">Observação</Label>
                <Textarea id="abObs" rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
              </div>

              {previa && (previa.bloqueios.length > 0 || previa.revisao.length > 0 || previa.alertas.length > 0) && (
                <div className="space-y-1.5 rounded-xl border border-status-warning/30 bg-status-warning/10 p-3 text-xs normal-case">
                  {previa.bloqueios.map((m, i) => (
                    <p key={`b${i}`} className="font-semibold text-status-danger">⛔ {m}</p>
                  ))}
                  {previa.revisao.map((m, i) => (
                    <p key={`r${i}`} className="text-foreground">⚠ Vai para revisão: {m.mensagem}</p>
                  ))}
                  {previa.alertas.map((m, i) => (
                    <p key={`a${i}`} className="text-secondary">ℹ {m.mensagem}</p>
                  ))}
                </div>
              )}
            </div>

            <div className="flex shrink-0 gap-2.5 border-t border-border/15 bg-surface px-4 py-3 sm:px-6">
              <Button type="button" variant="secondary" className="flex-1 sm:flex-none" onClick={onClose} disabled={salvando}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={salvando || !!previa?.bloqueios.length}>
                {salvando ? 'Salvando…' : 'Registrar'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function FotoCampo({
  label,
  valor,
  onEscolher,
  onRemover,
}: {
  label: string
  valor?: string
  onEscolher: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemover: () => void
}) {
  return (
    <div>
      <Label>{label}</Label>
      {valor ? (
        <div className="relative h-24 overflow-hidden rounded-xl border border-status-success/40">
          {valor.startsWith('data:application/pdf') ? (
            <div className="flex h-full flex-col items-center justify-center gap-1 text-secondary">
              <FileText className="h-6 w-6" />
              <span className="text-[10px] font-bold">PDF ANEXADO</span>
            </div>
          ) : (
            <img src={valor} alt={label} className="h-full w-full object-cover" />
          )}
          <button type="button" onClick={onRemover} aria-label="Remover foto" className="absolute right-1 top-1 rounded bg-red-600 p-1 text-white">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <label className="flex h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border/40 text-secondary hover:border-primary/60 hover:text-primary">
          <Camera className="h-5 w-5" />
          <span className="text-[10px] font-bold">TIRAR / ESCOLHER</span>
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onEscolher} />
        </label>
      )}
    </div>
  )
}
