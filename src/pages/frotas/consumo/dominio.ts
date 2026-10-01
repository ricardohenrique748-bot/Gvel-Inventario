// Serviço de domínio do consumo de combustível (ConsumptionCycleService).
//
// Toda regra de cálculo do módulo de Consumo vive aqui — nada de conta de
// km/L espalhada em componente. Código puro (sem React/Supabase, só imports
// relativos) pra rodar nos testes com `node --test`.
//
// Regra central: média oficial = ciclo TANQUE CHEIO → TANQUE CHEIO.
//   km      = odômetro do tanque cheio final − odômetro do tanque cheio inicial
//   litros  = soma de TODOS os abastecimentos de diesel depois do inicial,
//             até o final inclusive (parciais entram)
//   km/L    = km / litros
// Consolidação (período, veículo, motorista, frota): SEMPRE km total /
// litros total — nunca média das médias.

export type StatusAbastecimento = 'valido' | 'pendente_revisao' | 'invalidado'
export type StatusCiclo = 'aberto' | 'fechado' | 'invalidado'
export type CondicaoCarga = 'carregado' | 'vazio' | 'misto'
export type Semaforo = 'verde' | 'amarelo' | 'vermelho'

export type TipoAlerta =
  | 'ODOMETRO_INCONSISTENTE'
  | 'HORIMETRO_INCONSISTENTE'
  | 'LITROS_ACIMA_CAPACIDADE'
  | 'POSSIVEL_DUPLICIDADE'
  | 'CONSUMO_ABAIXO_META'
  | 'CONSUMO_ACIMA_META'
  | 'DESVIO_ESTATISTICO'
  | 'QUEDA_CONTINUA'
  | 'INTERVALO_ABASTECIMENTO_ANORMAL'
  | 'VALOR_TOTAL_DIVERGENTE'

export const TIPO_ALERTA_LABEL: Record<TipoAlerta, string> = {
  ODOMETRO_INCONSISTENTE: 'Odômetro inconsistente',
  HORIMETRO_INCONSISTENTE: 'Horímetro inconsistente',
  LITROS_ACIMA_CAPACIDADE: 'Litros acima da capacidade',
  POSSIVEL_DUPLICIDADE: 'Possível duplicidade',
  CONSUMO_ABAIXO_META: 'Consumo abaixo da meta',
  CONSUMO_ACIMA_META: 'Consumo anormal (acima da meta)',
  DESVIO_ESTATISTICO: 'Desvio do histórico do veículo',
  QUEDA_CONTINUA: 'Queda contínua de eficiência',
  INTERVALO_ABASTECIMENTO_ANORMAL: 'Intervalo de abastecimento anormal',
  VALOR_TOTAL_DIVERGENTE: 'Valor total divergente',
}

export interface AbastecimentoDominio {
  id: string
  placa: string
  dataHora: string
  odometro?: number
  horimetro?: number
  litros: number
  valorLitro?: number
  valorTotal: number
  tanqueCheio: boolean
  combustivel: string
  status: StatusAbastecimento
  motoristaNome?: string
}

export interface ConfigConsumo {
  semaforoVerdePct: number
  semaforoAmareloPct: number
  anomaliaAbaixoMetaPct: number
  anomaliaAcimaMetaPct: number
  desviosPadraoAlerta: number
  ciclosQuedaContinua: number
  maxKmSemRegistro: number
  toleranciaCapacidadePct: number
  toleranciaValorTotal: number
  janelaDuplicidadeMin: number
  velocidadeMaxKmh: number
  velocidadeMinKmh: number
}

export const CONFIG_PADRAO: ConfigConsumo = {
  semaforoVerdePct: 5,
  semaforoAmareloPct: 15,
  anomaliaAbaixoMetaPct: 15,
  anomaliaAcimaMetaPct: 20,
  desviosPadraoAlerta: 2,
  ciclosQuedaContinua: 3,
  maxKmSemRegistro: 1500,
  toleranciaCapacidadePct: 5,
  toleranciaValorTotal: 1,
  janelaDuplicidadeMin: 10,
  velocidadeMaxKmh: 90,
  velocidadeMinKmh: 2,
}

export interface MetaVeiculo {
  capacidadeTanque?: number
  capacidadeTanqueArla?: number
  metaKmL?: number
  metaKmLCarregado?: number
  metaKmLVazio?: number
}

export interface Ciclo {
  /** id do abastecimento que abriu o ciclo */
  id: string
  placa: string
  inicio: AbastecimentoDominio
  fim?: AbastecimentoDominio
  /** Abastecimentos depois do inicial, até o final inclusive. */
  abastecimentos: AbastecimentoDominio[]
  status: StatusCiclo
  motivoStatus?: string
  dataInicio: string
  dataFim?: string
  km: number
  litros: number
  horas?: number
  kmL?: number
  l100km?: number
  lh?: number
  custoTotal: number
  custoKm?: number
  /** Ciclo aberto: km/L parcial, NUNCA média oficial. */
  kmLEstimado?: number
  motoristas: string[]
  condicaoCarga?: CondicaoCarga
  meta?: number
  desvioMetaPct?: number
  semaforo?: Semaforo
  anomalias: TipoAlerta[]
}

export interface Consolidado {
  ciclos: number
  km: number
  litros: number
  horas: number
  kmL?: number
  l100km?: number
  lh?: number
  custoTotal: number
  custoKm?: number
}

// ------------------------------------------------------------
// Utilidades
// ------------------------------------------------------------
export function isArla(combustivel: string | undefined | null): boolean {
  return (combustivel ?? '').toUpperCase().includes('ARLA')
}

export function normalizarPlaca(placa: string): string {
  return placa.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function dividir(a: number, b: number): number | undefined {
  return b > 0 ? a / b : undefined
}

function arred(n: number, casas = 2): number {
  const f = 10 ** casas
  return Math.round(n * f) / f
}

/** Ordem cronológica estável (data, depois odômetro, depois id). */
export function ordenarAbastecimentos<T extends AbastecimentoDominio>(lista: T[]): T[] {
  return [...lista].sort((a, b) => {
    const t = new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime()
    if (t !== 0) return t
    const o = (a.odometro ?? Infinity) - (b.odometro ?? Infinity)
    if (o !== 0 && Number.isFinite(o)) return o
    return a.id.localeCompare(b.id)
  })
}

// ------------------------------------------------------------
// Valor total
// ------------------------------------------------------------
/** Nunca confia no total informado: calcula litros × valor/litro e compara. */
export function conferirValorTotal(
  litros: number,
  valorLitro: number | undefined,
  valorInformado: number | undefined,
  tolerancia: number,
): { valorTotal: number; divergente: boolean; diferenca: number } {
  if (valorLitro == null || !(valorLitro > 0)) {
    return { valorTotal: arred(valorInformado ?? 0), divergente: false, diferenca: 0 }
  }
  const calculado = arred(litros * valorLitro)
  if (valorInformado == null) return { valorTotal: calculado, divergente: false, diferenca: 0 }
  const diferenca = arred(valorInformado - calculado)
  return { valorTotal: calculado, divergente: Math.abs(diferenca) > tolerancia, diferenca }
}

// ------------------------------------------------------------
// Metas / semáforo
// ------------------------------------------------------------
/** Meta da condição de carga, caindo na meta geral quando não houver específica. */
export function metaAplicavel(meta: MetaVeiculo | undefined, condicao?: CondicaoCarga): number | undefined {
  if (!meta) return undefined
  if (condicao === 'carregado' && meta.metaKmLCarregado) return meta.metaKmLCarregado
  if (condicao === 'vazio' && meta.metaKmLVazio) return meta.metaKmLVazio
  return meta.metaKmL || undefined
}

export function desvioMetaPct(kmL: number, meta: number): number {
  return ((kmL - meta) / meta) * 100
}

export function classificarSemaforo(kmL: number, meta: number, config: ConfigConsumo): Semaforo {
  const desvio = desvioMetaPct(kmL, meta)
  if (desvio >= -config.semaforoVerdePct) return 'verde'
  if (desvio >= -config.semaforoAmareloPct) return 'amarelo'
  return 'vermelho'
}

// ------------------------------------------------------------
// Ciclos
// ------------------------------------------------------------
export interface OpcoesCiclo {
  meta?: MetaVeiculo
  config?: ConfigConsumo
  /** Condição de carga do ciclo (vem do cruzamento com viagens). */
  condicaoPorCiclo?: (inicio: string, fim: string | undefined) => CondicaoCarga | undefined
}

/**
 * Monta os ciclos de UM veículo. Considera só diesel não invalidado;
 * ARLA 32 nunca entra. Abastecimentos antes do primeiro tanque cheio são
 * ignorados (não existe média retroativa sem referência).
 */
export function calcularCiclos(abastecimentos: AbastecimentoDominio[], opcoes: OpcoesCiclo = {}): Ciclo[] {
  const config = opcoes.config ?? CONFIG_PADRAO
  const diesel = ordenarAbastecimentos(abastecimentos.filter((a) => !isArla(a.combustivel) && a.status !== 'invalidado'))

  const ciclos: Ciclo[] = []
  let atual: { inicio: AbastecimentoDominio; itens: AbastecimentoDominio[] } | null = null

  for (const a of diesel) {
    if (atual) atual.itens.push(a)
    if (a.tanqueCheio) {
      if (atual) ciclos.push(montarCiclo(atual.inicio, atual.itens, true, opcoes, config))
      atual = { inicio: a, itens: [] }
    }
  }
  if (atual) ciclos.push(montarCiclo(atual.inicio, atual.itens, false, opcoes, config))

  // Anomalias dependem do histórico fechado anterior do próprio veículo.
  const fechadosAnteriores: Ciclo[] = []
  for (const c of ciclos) {
    if (c.status === 'fechado') {
      c.anomalias = detectarAnomaliasCiclo(c, fechadosAnteriores, config)
      fechadosAnteriores.push(c)
    }
  }
  return ciclos
}

function montarCiclo(
  inicio: AbastecimentoDominio,
  itens: AbastecimentoDominio[],
  fechado: boolean,
  opcoes: OpcoesCiclo,
  config: ConfigConsumo,
): Ciclo {
  const fim = fechado ? itens[itens.length - 1] : undefined
  const litros = arred(itens.reduce((s, a) => s + a.litros, 0), 3)
  const custoTotal = arred(itens.reduce((s, a) => s + a.valorTotal, 0))
  const motoristas = [
    ...new Set([inicio, ...itens].map((a) => a.motoristaNome?.trim().toUpperCase()).filter((m): m is string => !!m)),
  ]

  const base: Ciclo = {
    id: inicio.id,
    placa: inicio.placa,
    inicio,
    fim,
    abastecimentos: itens,
    status: 'aberto',
    dataInicio: inicio.dataHora,
    dataFim: fim?.dataHora,
    km: 0,
    litros,
    custoTotal,
    motoristas,
    anomalias: [],
  }

  if (!fechado) {
    const ultimoOdo = [...itens].reverse().find((a) => a.odometro != null)?.odometro
    if (ultimoOdo != null && inicio.odometro != null && ultimoOdo > inicio.odometro) {
      base.km = ultimoOdo - inicio.odometro
      base.kmLEstimado = dividir(base.km, litros)
    }
    return base
  }

  base.condicaoCarga = opcoes.condicaoPorCiclo?.(inicio.dataHora, fim?.dataHora)

  if (itens.some((a) => a.status === 'pendente_revisao')) {
    return { ...base, status: 'invalidado', motivoStatus: 'Contém abastecimento pendente de revisão' }
  }
  if (inicio.odometro == null || fim?.odometro == null) {
    return { ...base, status: 'invalidado', motivoStatus: 'Odômetro não informado no tanque cheio' }
  }
  const km = fim.odometro - inicio.odometro
  if (km <= 0) return { ...base, status: 'invalidado', motivoStatus: 'KM do ciclo zerado ou negativo' }
  if (litros <= 0) return { ...base, status: 'invalidado', motivoStatus: 'Sem litros no ciclo' }

  const horas =
    inicio.horimetro != null && fim.horimetro != null && fim.horimetro > inicio.horimetro
      ? arred(fim.horimetro - inicio.horimetro, 1)
      : undefined

  const ciclo: Ciclo = {
    ...base,
    status: 'fechado',
    km,
    horas,
    kmL: km / litros,
    l100km: (litros / km) * 100,
    lh: horas ? litros / horas : undefined,
    custoKm: dividir(custoTotal, km),
  }

  const meta = metaAplicavel(opcoes.meta, ciclo.condicaoCarga)
  if (meta) {
    ciclo.meta = meta
    ciclo.desvioMetaPct = desvioMetaPct(ciclo.kmL!, meta)
    ciclo.semaforo = classificarSemaforo(ciclo.kmL!, meta, config)
  }
  return ciclo
}

// ------------------------------------------------------------
// Consolidação (sempre km total / litros total)
// ------------------------------------------------------------
export function consolidar(ciclos: Ciclo[]): Consolidado {
  const fechados = ciclos.filter((c) => c.status === 'fechado')
  const km = fechados.reduce((s, c) => s + c.km, 0)
  const litros = fechados.reduce((s, c) => s + c.litros, 0)
  const custoTotal = fechados.reduce((s, c) => s + c.custoTotal, 0)
  // L/h só com ciclos que têm horímetro, senão mistura litros sem horas.
  const comHoras = fechados.filter((c) => c.horas)
  const horas = comHoras.reduce((s, c) => s + (c.horas ?? 0), 0)
  const litrosComHoras = comHoras.reduce((s, c) => s + c.litros, 0)
  return {
    ciclos: fechados.length,
    km,
    litros,
    horas,
    kmL: dividir(km, litros),
    l100km: km > 0 ? (litros / km) * 100 : undefined,
    lh: dividir(litrosComHoras, horas),
    custoTotal,
    custoKm: dividir(custoTotal, km),
  }
}

// ------------------------------------------------------------
// Anomalias de ciclo
// ------------------------------------------------------------
export function detectarAnomaliasCiclo(ciclo: Ciclo, historicoAnterior: Ciclo[], config: ConfigConsumo): TipoAlerta[] {
  const anomalias: TipoAlerta[] = []
  if (ciclo.status !== 'fechado' || ciclo.kmL == null) return anomalias

  if (ciclo.meta) {
    if (ciclo.kmL < ciclo.meta * (1 - config.anomaliaAbaixoMetaPct / 100)) anomalias.push('CONSUMO_ABAIXO_META')
    if (ciclo.kmL > ciclo.meta * (1 + config.anomaliaAcimaMetaPct / 100)) anomalias.push('CONSUMO_ACIMA_META')
  }

  // Desvio estatístico só contra o histórico do PRÓPRIO veículo, e só com
  // amostra mínima — com 2 ou 3 ciclos o desvio padrão não diz nada.
  const valores = historicoAnterior.filter((c) => c.status === 'fechado' && c.kmL != null).map((c) => c.kmL!)
  if (valores.length >= 5) {
    const media = valores.reduce((s, v) => s + v, 0) / valores.length
    const dp = Math.sqrt(valores.reduce((s, v) => s + (v - media) ** 2, 0) / (valores.length - 1))
    if (dp > 0 && ciclo.kmL < media - config.desviosPadraoAlerta * dp) anomalias.push('DESVIO_ESTATISTICO')
  }

  const ultimos = [...historicoAnterior.filter((c) => c.status === 'fechado'), ciclo]
  if (detectarQuedaContinua(ultimos, config.ciclosQuedaContinua)) anomalias.push('QUEDA_CONTINUA')

  return anomalias
}

/** N ciclos fechados consecutivos (os mais recentes), cada um pior que o anterior. */
export function detectarQuedaContinua(ciclosFechados: Ciclo[], n = 3): boolean {
  const ult = ciclosFechados.filter((c) => c.status === 'fechado' && c.kmL != null).slice(-n)
  if (ult.length < n) return false
  for (let i = 1; i < ult.length; i++) {
    if (!(ult[i].kmL! < ult[i - 1].kmL!)) return false
  }
  return true
}

export const HIPOTESES_QUEDA_CONTINUA = [
  'pneus (calibragem/desgaste)',
  'filtros',
  'bicos injetores',
  'turbo',
  'excesso de marcha lenta',
  'condições operacionais',
  'rota',
  'carga',
]

// ------------------------------------------------------------
// Validação de um novo abastecimento
// ------------------------------------------------------------
export interface ResultadoValidacao {
  /** Impede o registro (odômetro menor que o último válido). */
  bloqueios: string[]
  /** Vão pra fila de revisão (status pendente_revisao). */
  revisao: { tipo: TipoAlerta; mensagem: string }[]
  /** Só alertam, sem segurar o registro. */
  alertas: { tipo: TipoAlerta; mensagem: string }[]
  valorTotal: number
}

export function validarAbastecimento(
  novo: Omit<AbastecimentoDominio, 'valorTotal' | 'status'> & { valorTotalInformado?: number },
  existentes: AbastecimentoDominio[],
  meta: MetaVeiculo | undefined,
  config: ConfigConsumo,
): ResultadoValidacao {
  const r: ResultadoValidacao = { bloqueios: [], revisao: [], alertas: [], valorTotal: 0 }
  const placa = normalizarPlaca(novo.placa)
  const doVeiculo = ordenarAbastecimentos(
    existentes.filter((a) => normalizarPlaca(a.placa) === placa && a.id !== novo.id && a.status !== 'invalidado'),
  )
  const tNovo = new Date(novo.dataHora).getTime()
  const anteriores = doVeiculo.filter((a) => new Date(a.dataHora).getTime() <= tNovo)

  // Odômetro
  const anteriorComOdo = [...anteriores].reverse().find((a) => a.odometro != null)
  if (novo.odometro != null && anteriorComOdo?.odometro != null) {
    if (novo.odometro < anteriorComOdo.odometro) {
      r.bloqueios.push(
        `Odômetro ${novo.odometro.toLocaleString('pt-BR')} km é menor que o último registrado (${anteriorComOdo.odometro.toLocaleString('pt-BR')} km). Peça a correção a um administrador.`,
      )
    } else {
      const km = novo.odometro - anteriorComOdo.odometro
      if (km > config.maxKmSemRegistro) {
        r.alertas.push({
          tipo: 'INTERVALO_ABASTECIMENTO_ANORMAL',
          mensagem: `${km.toLocaleString('pt-BR')} km desde o último abastecimento (limite ${config.maxKmSemRegistro.toLocaleString('pt-BR')} km) — pode haver abastecimento não registrado.`,
        })
      }
    }
  }

  // Horímetro
  const anteriorComHor = [...anteriores].reverse().find((a) => a.horimetro != null)
  if (novo.horimetro != null && anteriorComHor?.horimetro != null) {
    const horas = novo.horimetro - anteriorComHor.horimetro
    if (horas < 0) {
      r.revisao.push({ tipo: 'HORIMETRO_INCONSISTENTE', mensagem: 'Horímetro menor que o registro anterior.' })
    } else if (novo.odometro != null && anteriorComHor.odometro != null) {
      const km = novo.odometro - anteriorComHor.odometro
      if (horas > 0 && km / horas > config.velocidadeMaxKmh) {
        r.revisao.push({
          tipo: 'HORIMETRO_INCONSISTENTE',
          mensagem: `Distância muito alta para as horas registradas (${Math.round(km / horas)} km/h de média).`,
        })
      } else if (horas >= 10 && km / horas < config.velocidadeMinKmh) {
        r.revisao.push({
          tipo: 'HORIMETRO_INCONSISTENTE',
          mensagem: `Horas excessivas para a distância registrada (${horas.toLocaleString('pt-BR')} h para ${km.toLocaleString('pt-BR')} km).`,
        })
      } else if (horas === 0 && km > 50) {
        r.revisao.push({ tipo: 'HORIMETRO_INCONSISTENTE', mensagem: 'Horímetro parado com quilometragem rodada.' })
      }
    }
  }

  // Capacidade do tanque
  const capacidade = isArla(novo.combustivel) ? meta?.capacidadeTanqueArla : meta?.capacidadeTanque
  if (capacidade && novo.litros > capacidade * (1 + config.toleranciaCapacidadePct / 100)) {
    r.revisao.push({
      tipo: 'LITROS_ACIMA_CAPACIDADE',
      mensagem: `${novo.litros.toLocaleString('pt-BR')} L acima da capacidade do tanque (${capacidade.toLocaleString('pt-BR')} L + ${config.toleranciaCapacidadePct}%).`,
    })
  }

  // Duplicidade: mesma placa + mesmos litros + até N minutos de diferença
  const janela = config.janelaDuplicidadeMin * 60_000
  const duplicado = doVeiculo.find(
    (a) => Math.abs(new Date(a.dataHora).getTime() - tNovo) <= janela && Math.abs(a.litros - novo.litros) < 0.01,
  )
  if (duplicado) {
    r.revisao.push({ tipo: 'POSSIVEL_DUPLICIDADE', mensagem: 'Já existe abastecimento com os mesmos litros nesse horário.' })
  }

  // Valor total
  const valor = conferirValorTotal(novo.litros, novo.valorLitro, novo.valorTotalInformado, config.toleranciaValorTotal)
  r.valorTotal = valor.valorTotal
  if (valor.divergente) {
    r.revisao.push({
      tipo: 'VALOR_TOTAL_DIVERGENTE',
      mensagem: `Valor informado difere em R$ ${valor.diferenca.toFixed(2)} de litros × valor/litro.`,
    })
  }

  return r
}

// ------------------------------------------------------------
// Análise por motorista (visão analítica, não oficial)
// ------------------------------------------------------------
export interface IndicadorMotorista {
  motorista: string
  km: number
  litros: number
  custo: number
  kmL?: number
  custoKm?: number
}

/**
 * Atribui cada trecho de um ciclo FECHADO ao motorista do abastecimento que
 * fecha o trecho (km desde o abastecimento anterior + litros repostos).
 * O ciclo continua sendo do veículo; isto é só uma leitura analítica.
 */
export function indicadoresPorMotorista(ciclos: Ciclo[]): IndicadorMotorista[] {
  const mapa = new Map<string, IndicadorMotorista>()
  for (const c of ciclos) {
    if (c.status !== 'fechado') continue
    let anterior = c.inicio
    for (const a of c.abastecimentos) {
      const nome = a.motoristaNome?.trim().toUpperCase() || 'NÃO INFORMADO'
      const km = a.odometro != null && anterior.odometro != null ? Math.max(0, a.odometro - anterior.odometro) : 0
      const item = mapa.get(nome) ?? { motorista: nome, km: 0, litros: 0, custo: 0 }
      item.km += km
      item.litros += a.litros
      item.custo += a.valorTotal
      mapa.set(nome, item)
      if (a.odometro != null) anterior = a
    }
  }
  return [...mapa.values()].map((m) => ({ ...m, kmL: dividir(m.km, m.litros), custoKm: dividir(m.custo, m.km) }))
}

// ------------------------------------------------------------
// Cruzamento abastecimentos × viagens
// ------------------------------------------------------------
export interface ViagemDominio {
  placa: string
  dataHora: string
  km?: number
  toneladas?: number
  condicaoCarga?: CondicaoCarga
}

export interface CruzamentoPeriodo {
  km: number
  litros: number
  kmL?: number
  custoTotal: number
  viagens: number
  toneladas?: number
  tkmL?: number
  custoTonelada?: number
  /** Motivos de não haver dado suficiente — nunca inventar valores. */
  insuficiente: string[]
}

/** Condição de carga de um intervalo, a partir das viagens que caem nele. */
export function condicaoDoIntervalo(
  viagens: ViagemDominio[],
  inicio: string,
  fim: string | undefined,
): CondicaoCarga | undefined {
  const t0 = new Date(inicio).getTime()
  const t1 = fim ? new Date(fim).getTime() : Infinity
  const conds = new Set(
    viagens
      .filter((v) => {
        const t = new Date(v.dataHora).getTime()
        return t >= t0 && t <= t1 && v.condicaoCarga
      })
      .map((v) => v.condicaoCarga!),
  )
  if (conds.size === 0) return undefined
  if (conds.size === 1) return [...conds][0]
  return 'misto'
}

export function cruzarComViagens(
  ciclos: Ciclo[],
  viagens: ViagemDominio[],
  periodo: { inicio: string; fim: string },
): CruzamentoPeriodo {
  const t0 = new Date(periodo.inicio).getTime()
  const t1 = new Date(periodo.fim).getTime()
  const noPeriodo = ciclos.filter((c) => {
    if (c.status !== 'fechado' || !c.dataFim) return false
    const t = new Date(c.dataFim).getTime()
    return t >= t0 && t <= t1
  })
  const cons = consolidar(noPeriodo)
  const viagensPeriodo = viagens.filter((v) => {
    const t = new Date(v.dataHora).getTime()
    return t >= t0 && t <= t1
  })

  const insuficiente: string[] = []
  if (cons.ciclos === 0) insuficiente.push('Nenhum ciclo tanque cheio → tanque cheio fechado no período')
  if (viagensPeriodo.length === 0) insuficiente.push('Nenhuma viagem registrada/importada no período')

  const comTon = viagensPeriodo.filter((v) => v.toneladas != null && v.toneladas > 0)
  const toneladas = comTon.length > 0 ? comTon.reduce((s, v) => s + v.toneladas!, 0) : undefined
  if (viagensPeriodo.length > 0 && toneladas == null) insuficiente.push('Viagens sem toneladas')

  const comTonKm = comTon.filter((v) => v.km != null && v.km > 0)
  const tkm = comTonKm.reduce((s, v) => s + v.toneladas! * v.km!, 0)
  if (comTon.length > 0 && comTonKm.length === 0) insuficiente.push('Viagens sem KM para calcular t·km')

  return {
    km: cons.km,
    litros: cons.litros,
    kmL: cons.kmL,
    custoTotal: cons.custoTotal,
    viagens: viagensPeriodo.length,
    toneladas,
    tkmL: comTonKm.length > 0 && cons.litros > 0 ? tkm / cons.litros : undefined,
    custoTonelada: toneladas && cons.ciclos > 0 ? cons.custoTotal / toneladas : undefined,
    insuficiente,
  }
}
