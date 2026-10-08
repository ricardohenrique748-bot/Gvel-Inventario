import { useCallback, useEffect, useState } from 'react'
import { supabase, FOTOS_BUCKET } from '@/lib/supabase'
import { comprimirImagem, dataUrlParaBlob } from '@/lib/imagem'
import { comPrefixoEmpresa } from '@/lib/tenant'
import { up } from '@/lib/text'
import {
  CONFIG_PADRAO,
  calcularCiclos,
  normalizarPlaca,
  validarAbastecimento,
  TIPO_ALERTA_LABEL,
  type AbastecimentoDominio,
  type CondicaoCarga,
  type ConfigConsumo,
  type MetaVeiculo,
  type StatusAbastecimento,
  type TipoAlerta,
  type ViagemDominio,
} from '@/pages/frotas/consumo/dominio'
import { erroConsumo } from '@/pages/frotas/consumo/erros'

// Dados do módulo de Consumo (aba "Consumo" da Gestão de Frotas). Toda
// regra de cálculo está no domínio (pages/frotas/consumo/dominio.ts); aqui
// é só ler/gravar no Supabase. Detalhes do schema: migration 0090.

export type OrigemAbastecimentoConsumo = 'manual' | 'despesa_viagem' | 'app' | 'web' | 'importacao'

export interface AbastecimentoConsumo extends AbastecimentoDominio {
  veiculoId: string
  veiculoNome?: string
  postoId?: string
  postoNome: string
  valorTotalInformado?: number
  motivosRevisao: TipoAlerta[]
  fotoCupomUrl?: string
  fotoPainelUrl?: string
  origem: OrigemAbastecimentoConsumo
  observacoes?: string
  createdByNome?: string
  createdAt: string
}

export interface Posto {
  id: string
  nome: string
  cnpj?: string
  cidade?: string
  uf?: string
  interno: boolean
  ativo: boolean
}

export interface MetaConsumoVeiculo extends MetaVeiculo {
  placa: string
}

export interface AlertaConsumo {
  id: string
  tipo: TipoAlerta
  placa: string
  referenciaId: string
  mensagem: string
  severidade: 'baixa' | 'media' | 'alta'
  resolvido: boolean
  resolvidoPor?: string
  resolvidoEm?: string
  createdAt: string
}

export interface ViagemConsumo extends ViagemDominio {
  id: string
  motorista?: string
  origem?: string
  destino?: string
  valorFrete?: number
  fonte: string
  chaveImportacao?: string
}

export interface RegistroAuditoria {
  id: string
  acao: string
  usuarioEmail?: string
  valoresAnteriores?: Record<string, unknown>
  valoresNovos?: Record<string, unknown>
  motivo?: string
  createdAt: string
}

// ------------------------------------------------------------
// Leitura paginada (o Supabase devolve no máximo 1000 linhas por chamada)
// ------------------------------------------------------------
async function buscarTodas<T>(montar: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const pagina = 1000
  const todas: T[] = []
  for (let de = 0; ; de += pagina) {
    const { data, error } = await montar(de, de + pagina - 1)
    if (error) throw error
    todas.push(...(data ?? []))
    if (!data || data.length < pagina) break
  }
  return todas
}

const num = (v: unknown) => (v == null ? undefined : Number(v))

function mapAbastecimento(row: any): AbastecimentoConsumo {
  return {
    id: row.id,
    placa: normalizarPlaca(row.placa),
    veiculoId: row.veiculo_id,
    veiculoNome: row.veiculo_nome || undefined,
    dataHora: row.data_hora,
    odometro: num(row.odometro),
    horimetro: num(row.horas_motor),
    litros: Number(row.volume) || 0,
    valorLitro: num(row.valor_unitario),
    valorTotal: Number(row.valor_total) || 0,
    valorTotalInformado: num(row.valor_total_informado),
    tanqueCheio: !!row.tanque_cheio,
    combustivel: row.combustivel,
    status: (row.status || 'valido') as StatusAbastecimento,
    motivosRevisao: (row.motivos_revisao || []) as TipoAlerta[],
    motoristaNome: row.motorista_nome || undefined,
    postoId: row.posto_id || undefined,
    postoNome: row.posto_fornecedor,
    fotoCupomUrl: row.foto_cupom_url || undefined,
    fotoPainelUrl: row.foto_painel_url || undefined,
    origem: row.origem,
    observacoes: row.observacoes || undefined,
    createdByNome: row.created_by_nome || undefined,
    createdAt: row.created_at,
  }
}

function mapViagem(row: any): ViagemConsumo {
  const kmLeitura = row.km_chegada != null && row.km_saida != null ? Number(row.km_chegada) - Number(row.km_saida) : undefined
  return {
    id: row.id,
    placa: normalizarPlaca(row.placa),
    dataHora: row.data_hora_saida,
    km: num(row.km_rodado) ?? (kmLeitura && kmLeitura > 0 ? kmLeitura : num(row.distancia_estimada_km)),
    toneladas: num(row.peso_carga_toneladas),
    condicaoCarga: (row.condicao_carga || undefined) as CondicaoCarga | undefined,
    motorista: row.motorista_nome || undefined,
    origem: row.origem || undefined,
    destino: row.destino || undefined,
    valorFrete: num(row.frete_bruto),
    fonte: row.fonte || 'manual',
    chaveImportacao: row.chave_importacao || undefined,
  }
}

function mapConfig(row: any): ConfigConsumo & { mapeamentoMoveTruck: Record<string, string> } {
  if (!row) return { ...CONFIG_PADRAO, mapeamentoMoveTruck: {} }
  return {
    semaforoVerdePct: Number(row.semaforo_verde_pct),
    semaforoAmareloPct: Number(row.semaforo_amarelo_pct),
    anomaliaAbaixoMetaPct: Number(row.anomalia_abaixo_meta_pct),
    anomaliaAcimaMetaPct: Number(row.anomalia_acima_meta_pct),
    desviosPadraoAlerta: Number(row.desvios_padrao_alerta),
    ciclosQuedaContinua: Number(row.ciclos_queda_continua),
    maxKmSemRegistro: Number(row.max_km_sem_registro),
    toleranciaCapacidadePct: Number(row.tolerancia_capacidade_pct),
    toleranciaValorTotal: Number(row.tolerancia_valor_total),
    janelaDuplicidadeMin: Number(row.janela_duplicidade_min),
    velocidadeMaxKmh: Number(row.velocidade_max_kmh),
    velocidadeMinKmh: Number(row.velocidade_min_kmh),
    mapeamentoMoveTruck: row.mapeamento_movetruck || {},
  }
}

export type ConfigConsumoCompleta = ReturnType<typeof mapConfig>

// ------------------------------------------------------------
// Hook principal: tudo que a aba precisa, carregado junto
// ------------------------------------------------------------
export function useConsumoCombustivel(mesesHistorico = 13) {
  const [abastecimentos, setAbastecimentos] = useState<AbastecimentoConsumo[]>([])
  const [viagens, setViagens] = useState<ViagemConsumo[]>([])
  const [postos, setPostos] = useState<Posto[]>([])
  const [metas, setMetas] = useState<Record<string, MetaConsumoVeiculo>>({})
  const [config, setConfig] = useState<ConfigConsumoCompleta>(mapConfig(null))
  const [alertas, setAlertas] = useState<AlertaConsumo[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setErro(null)
    const desde = new Date()
    desde.setMonth(desde.getMonth() - mesesHistorico)
    try {
      const [abs, vgs, pts, mts, cfg, als] = await Promise.all([
        buscarTodas((de, ate) =>
          supabase.from('abastecimentos').select('*').gte('data_hora', desde.toISOString()).order('data_hora').range(de, ate),
        ),
        buscarTodas((de, ate) =>
          supabase
            .from('viagens_frota')
            .select(
              'id,placa,motorista_nome,data_hora_saida,km_rodado,km_saida,km_chegada,distancia_estimada_km,peso_carga_toneladas,frete_bruto,condicao_carga,origem,destino,fonte,chave_importacao',
            )
            .gte('data_hora_saida', desde.toISOString())
            .order('data_hora_saida')
            .range(de, ate),
        ),
        supabase.from('postos').select('*').order('nome'),
        supabase.from('metas_consumo_veiculo').select('*'),
        supabase.from('config_consumo').select('*').maybeSingle(),
        supabase.from('alertas_consumo').select('*').order('created_at', { ascending: false }).limit(1000),
      ])
      setAbastecimentos(abs.map(mapAbastecimento))
      setViagens(vgs.map(mapViagem))
      setPostos(
        (pts.data ?? []).map((p: any) => ({
          id: p.id,
          nome: p.nome,
          cnpj: p.cnpj || undefined,
          cidade: p.cidade || undefined,
          uf: p.uf || undefined,
          interno: !!p.interno,
          ativo: p.ativo !== false,
        })),
      )
      const mapaMetas: Record<string, MetaConsumoVeiculo> = {}
      for (const m of (mts.data ?? []) as any[]) {
        mapaMetas[normalizarPlaca(m.placa)] = {
          placa: normalizarPlaca(m.placa),
          capacidadeTanque: num(m.capacidade_tanque),
          capacidadeTanqueArla: num(m.capacidade_tanque_arla),
          metaKmL: num(m.meta_km_l),
          metaKmLCarregado: num(m.meta_km_l_carregado),
          metaKmLVazio: num(m.meta_km_l_vazio),
        }
      }
      setMetas(mapaMetas)
      setConfig(mapConfig(cfg.data))
      setAlertas(
        ((als.data ?? []) as any[]).map((a) => ({
          id: a.id,
          tipo: a.tipo,
          placa: normalizarPlaca(a.placa),
          referenciaId: a.referencia_id,
          mensagem: a.mensagem,
          severidade: a.severidade,
          resolvido: a.resolvido,
          resolvidoPor: a.resolvido_por || undefined,
          resolvidoEm: a.resolvido_em || undefined,
          createdAt: a.created_at,
        })),
      )
    } catch (err) {
      console.warn('Erro ao carregar dados de consumo:', err)
      setErro(erroConsumo(err, 'Não foi possível carregar os dados de consumo.'))
    } finally {
      setLoading(false)
    }
  }, [mesesHistorico])

  useEffect(() => {
    refetch()
    const handle = () => refetch()
    window.addEventListener('consumo_combustivel_updated', handle)
    return () => window.removeEventListener('consumo_combustivel_updated', handle)
  }, [refetch])

  return { abastecimentos, viagens, postos, metas, config, alertas, loading, erro, refetch }
}

function avisarAtualizacao() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('consumo_combustivel_updated'))
}

// ------------------------------------------------------------
// Registro de abastecimento
// ------------------------------------------------------------
export interface NovoAbastecimentoInput {
  /** Gerado no aparelho — é a chave de idempotência da sincronização offline. */
  id: string
  veiculoId: string
  placa: string
  veiculoNome?: string
  motoristaNome?: string
  dataHora: string
  odometro?: number
  horimetro?: number
  litros: number
  valorLitro?: number
  valorTotalInformado?: number
  postoId?: string
  postoNome: string
  tanqueCheio: boolean
  combustivel: string
  /** dataURL (comprimida) — vira arquivo no Storage na hora de gravar. */
  fotoCupom?: string
  fotoPainel?: string
  observacoes?: string
  origem: OrigemAbastecimentoConsumo
  usuarioNome?: string
}

export class AbastecimentoBloqueadoError extends Error {}

export async function arquivoParaDataUrl(file: File): Promise<string> {
  const comprimido = await comprimirImagem(file)
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(comprimido)
  })
}

async function enviarFoto(id: string, nome: string, dataUrl: string): Promise<string | null> {
  try {
    const blob = dataUrlParaBlob(dataUrl)
    const ext = blob.type === 'application/pdf' ? 'pdf' : 'jpg'
    const path = comPrefixoEmpresa(`abastecimentos/${id}/${nome}.${ext}`)
    const { error } = await supabase.storage.from(FOTOS_BUCKET).upload(path, blob, {
      contentType: blob.type || 'image/jpeg',
      upsert: true,
    })
    if (error) throw error
    return supabase.storage.from(FOTOS_BUCKET).getPublicUrl(path).data.publicUrl
  } catch (err) {
    console.warn(`Falha ao enviar foto "${nome}" do abastecimento:`, err)
    return null
  }
}

async function buscarHistoricoVeiculo(placa: string): Promise<AbastecimentoConsumo[]> {
  // O histórico pra validar/fechar ciclo vem sempre do banco (não da lista em
  // tela), pra a validação da sincronização offline enxergar o estado atual.
  const desde = new Date()
  desde.setMonth(desde.getMonth() - 24)
  // Registros antigos podem ter a placa com traço (ABC-1234).
  const p = normalizarPlaca(placa)
  const comTraco = `${p.slice(0, 3)}-${p.slice(3)}`
  const linhas = await buscarTodas((de, ate) =>
    supabase
      .from('abastecimentos')
      .select('*')
      .in('placa', [p, comTraco])
      .gte('data_hora', desde.toISOString())
      .order('data_hora')
      .range(de, ate),
  )
  return linhas.map(mapAbastecimento)
}

export interface ResultadoRegistro {
  status: StatusAbastecimento
  revisao: string[]
  alertas: string[]
  jaExistia: boolean
}

/**
 * Valida e grava. Bloqueia (lança AbastecimentoBloqueadoError) quando o
 * odômetro é menor que o último; manda pra revisão as inconsistências.
 * Idempotente pelo `id`: reenviar o mesmo registro não duplica.
 */
export async function registrarAbastecimento(
  input: NovoAbastecimentoInput,
  meta: MetaVeiculo | undefined,
  config: ConfigConsumo,
): Promise<ResultadoRegistro> {
  const { data: existente } = await supabase.from('abastecimentos').select('id,status').eq('id', input.id).maybeSingle()
  if (existente) return { status: existente.status, revisao: [], alertas: [], jaExistia: true }

  const historico = await buscarHistoricoVeiculo(input.placa)
  const validacao = validarAbastecimento(
    {
      id: input.id,
      placa: input.placa,
      dataHora: input.dataHora,
      odometro: input.odometro,
      horimetro: input.horimetro,
      litros: input.litros,
      valorLitro: input.valorLitro,
      valorTotalInformado: input.valorTotalInformado,
      tanqueCheio: input.tanqueCheio,
      combustivel: input.combustivel,
      motoristaNome: input.motoristaNome,
    },
    historico,
    meta,
    config,
  )
  if (validacao.bloqueios.length > 0) throw new AbastecimentoBloqueadoError(validacao.bloqueios.join(' '))

  const [fotoCupomUrl, fotoPainelUrl] = await Promise.all([
    input.fotoCupom ? enviarFoto(input.id, 'cupom', input.fotoCupom) : null,
    input.fotoPainel ? enviarFoto(input.id, 'painel', input.fotoPainel) : null,
  ])

  const status: StatusAbastecimento = validacao.revisao.length > 0 ? 'pendente_revisao' : 'valido'
  const { error } = await supabase.from('abastecimentos').upsert(
    {
      id: input.id,
      veiculo_id: input.veiculoId,
      placa: normalizarPlaca(input.placa),
      veiculo_nome: input.veiculoNome || null,
      motorista_nome: up(input.motoristaNome) || null,
      combustivel: input.combustivel,
      data_hora: input.dataHora,
      odometro: input.odometro ?? null,
      horas_motor: input.horimetro ?? null,
      posto_id: input.postoId || null,
      posto_fornecedor: up(input.postoNome) || 'NÃO INFORMADO',
      volume: input.litros,
      valor_unitario: input.valorLitro ?? null,
      valor_total: validacao.valorTotal,
      valor_total_informado: input.valorTotalInformado ?? null,
      tanque_cheio: input.tanqueCheio,
      status,
      motivos_revisao: [...new Set(validacao.revisao.map((r) => r.tipo))],
      foto_cupom_url: fotoCupomUrl,
      foto_painel_url: fotoPainelUrl,
      origem: input.origem,
      aprovado: status === 'valido',
      observacoes: up(input.observacoes) || null,
      created_by_nome: input.usuarioNome || null,
    },
    { onConflict: 'id', ignoreDuplicates: true },
  )
  if (error) {
    if (String(error.message).includes('ODOMETRO_MENOR')) throw new AbastecimentoBloqueadoError(error.message.replace(/^ODOMETRO_MENOR:\s*/, ''))
    throw error
  }

  // Leitura de odômetro, como já fazia o abastecimento da Manutenção de Frota.
  if (input.odometro != null) {
    await supabase
      .from('leituras_odometro')
      .insert({
        veiculo_id: input.veiculoId,
        placa: normalizarPlaca(input.placa),
        data_leitura: input.dataHora,
        quilometragem: input.odometro,
        horas_motor: input.horimetro ?? null,
        origem: 'abastecimento',
      })
      .then(({ error: e }) => e && console.warn('Falha ao gerar leitura de odômetro:', e))
  }

  const alertasNovos: { tipo: TipoAlerta; mensagem: string; severidade: 'baixa' | 'media' | 'alta' }[] = [
    ...validacao.revisao.map((r) => ({ ...r, severidade: 'media' as const })),
    ...validacao.alertas.map((r) => ({ ...r, severidade: 'baixa' as const })),
  ]
  let statusFinal = status
  const revisaoFinal = validacao.revisao.map((r) => r.mensagem)

  // Fechou ciclo? Recalcula o veículo com o novo registro e alerta as
  // anomalias do ciclo que acabou de fechar.
  if (input.tanqueCheio && status === 'valido') {
    const comNovo: AbastecimentoDominio[] = [
      ...historico,
      {
        id: input.id,
        placa: normalizarPlaca(input.placa),
        dataHora: input.dataHora,
        odometro: input.odometro,
        horimetro: input.horimetro,
        litros: input.litros,
        valorLitro: input.valorLitro,
        valorTotal: validacao.valorTotal,
        tanqueCheio: true,
        combustivel: input.combustivel,
        status: 'valido',
        motoristaNome: input.motoristaNome,
      },
    ]
    const ciclo = calcularCiclos(comNovo, { meta, config }).find((c) => c.fim?.id === input.id)
    for (const tipo of ciclo?.anomalias ?? []) {
      alertasNovos.push({
        tipo,
        severidade: tipo === 'CONSUMO_ACIMA_META' || tipo === 'QUEDA_CONTINUA' ? 'alta' : 'media',
        mensagem: `${TIPO_ALERTA_LABEL[tipo]}: ciclo fechado com ${ciclo!.kmL!.toFixed(2).replace('.', ',')} km/L${
          ciclo!.meta ? ` (meta ${ciclo!.meta.toFixed(2).replace('.', ',')})` : ''
        }.`,
      })
    }
    // Eficiência bem acima da meta costuma ser erro (odômetro, abastecimento
    // não lançado, tanque cheio marcado errado): segura o ciclo pra revisão
    // em vez de deixar entrar na média oficial.
    if (ciclo?.anomalias.includes('CONSUMO_ACIMA_META')) {
      const { error: e } = await supabase
        .from('abastecimentos')
        .update({ status: 'pendente_revisao', aprovado: false, motivos_revisao: ['CONSUMO_ACIMA_META'], motivo_alteracao: null })
        .eq('id', input.id)
      if (!e) {
        statusFinal = 'pendente_revisao'
        revisaoFinal.push('Km/L muito acima da meta — confira odômetro, abastecimentos não lançados e o tanque cheio.')
      }
    }
  }

  if (alertasNovos.length > 0) {
    await gravarAlertas(
      alertasNovos.map((a) => ({ ...a, placa: input.placa, veiculoId: input.veiculoId, referenciaId: input.id })),
    )
  }

  avisarAtualizacao()
  return {
    status: statusFinal,
    revisao: revisaoFinal,
    alertas: alertasNovos.filter((a) => !validacao.revisao.some((r) => r.tipo === a.tipo)).map((a) => a.mensagem),
    jaExistia: false,
  }
}

async function gravarAlertas(
  lista: { tipo: TipoAlerta; mensagem: string; severidade: 'baixa' | 'media' | 'alta'; placa: string; veiculoId?: string; referenciaId: string }[],
) {
  const { error } = await supabase.from('alertas_consumo').upsert(
    lista.map((a) => ({
      tipo: a.tipo,
      placa: normalizarPlaca(a.placa),
      veiculo_id: a.veiculoId || null,
      referencia_id: a.referenciaId,
      mensagem: a.mensagem,
      severidade: a.severidade,
    })),
    { onConflict: 'company_id,tipo,referencia_id', ignoreDuplicates: true },
  )
  if (error) console.warn('Falha ao gravar alertas de consumo:', error)
}

// ------------------------------------------------------------
// Revisão / correções (todas auditadas pelo trigger da 0090)
// ------------------------------------------------------------
export async function atualizarAbastecimento(
  id: string,
  campos: Partial<{
    status: StatusAbastecimento
    odometro: number | null
    horimetro: number | null
    litros: number
    valorLitro: number | null
    valorTotal: number
    tanqueCheio: boolean
    combustivel: string
    motoristaNome: string | null
    observacoes: string | null
    motivosRevisao: TipoAlerta[]
  }>,
  motivo: string | null,
): Promise<void> {
  const payload: Record<string, unknown> = { motivo_alteracao: motivo?.trim() || null }
  if (campos.status !== undefined) {
    payload.status = campos.status
    payload.aprovado = campos.status === 'valido'
  }
  if (campos.odometro !== undefined) payload.odometro = campos.odometro
  if (campos.horimetro !== undefined) payload.horas_motor = campos.horimetro
  if (campos.litros !== undefined) payload.volume = campos.litros
  if (campos.valorLitro !== undefined) payload.valor_unitario = campos.valorLitro
  if (campos.valorTotal !== undefined) payload.valor_total = campos.valorTotal
  if (campos.tanqueCheio !== undefined) payload.tanque_cheio = campos.tanqueCheio
  if (campos.combustivel !== undefined) payload.combustivel = campos.combustivel
  if (campos.motoristaNome !== undefined) payload.motorista_nome = up(campos.motoristaNome)
  if (campos.observacoes !== undefined) payload.observacoes = up(campos.observacoes)
  if (campos.motivosRevisao !== undefined) payload.motivos_revisao = campos.motivosRevisao

  const { error } = await supabase.from('abastecimentos').update(payload).eq('id', id)
  if (error) throw new Error(error.message.replace(/^MOTIVO_OBRIGATORIO:\s*/, ''))
  avisarAtualizacao()
}

// Exclusão definitiva — só a conta liberada em podeExcluirAbastecimento; o RLS
// (migration 0093) recusa as demais. A auditoria registra a 'exclusao' com os
// valores anteriores.
export async function excluirAbastecimento(id: string): Promise<void> {
  const { data, error } = await supabase.from('abastecimentos').delete().eq('id', id).select('id')
  if (error) throw new Error(error.message)
  if (!data?.length) throw new Error('Sem permissão para excluir este abastecimento.')
  await supabase.from('alertas_consumo').delete().eq('referencia_id', id)
  avisarAtualizacao()
}

export async function resolverAlerta(id: string, usuario: string): Promise<void> {
  const { error } = await supabase
    .from('alertas_consumo')
    .update({ resolvido: true, resolvido_por: usuario, resolvido_em: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
  avisarAtualizacao()
}

export async function buscarAuditoria(abastecimentoId: string): Promise<RegistroAuditoria[]> {
  const { data, error } = await supabase
    .from('auditoria_abastecimentos')
    .select('*')
    .eq('abastecimento_id', abastecimentoId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    id: r.id,
    acao: r.acao,
    usuarioEmail: r.usuario_email || undefined,
    valoresAnteriores: r.valores_anteriores || undefined,
    valoresNovos: r.valores_novos || undefined,
    motivo: r.motivo || undefined,
    createdAt: r.created_at,
  }))
}

// ------------------------------------------------------------
// Cadastros: postos, metas, configuração
// ------------------------------------------------------------
export async function salvarPosto(posto: Omit<Posto, 'id'> & { id?: string }): Promise<void> {
  const payload = {
    nome: up(posto.nome),
    cnpj: posto.cnpj || null,
    cidade: up(posto.cidade) || null,
    uf: up(posto.uf) || null,
    interno: posto.interno,
    ativo: posto.ativo,
    updated_at: new Date().toISOString(),
  }
  const { error } = posto.id
    ? await supabase.from('postos').update(payload).eq('id', posto.id)
    : await supabase.from('postos').insert(payload)
  if (error) throw error
  avisarAtualizacao()
}

export async function salvarMetaVeiculo(meta: MetaConsumoVeiculo): Promise<void> {
  const { error } = await supabase.from('metas_consumo_veiculo').upsert(
    {
      placa: normalizarPlaca(meta.placa),
      capacidade_tanque: meta.capacidadeTanque ?? null,
      capacidade_tanque_arla: meta.capacidadeTanqueArla ?? null,
      meta_km_l: meta.metaKmL ?? null,
      meta_km_l_carregado: meta.metaKmLCarregado ?? null,
      meta_km_l_vazio: meta.metaKmLVazio ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'company_id,placa' },
  )
  if (error) throw error
  avisarAtualizacao()
}

export async function salvarConfigConsumo(c: ConfigConsumoCompleta): Promise<void> {
  const { error } = await supabase.from('config_consumo').upsert(
    {
      semaforo_verde_pct: c.semaforoVerdePct,
      semaforo_amarelo_pct: c.semaforoAmareloPct,
      anomalia_abaixo_meta_pct: c.anomaliaAbaixoMetaPct,
      anomalia_acima_meta_pct: c.anomaliaAcimaMetaPct,
      desvios_padrao_alerta: c.desviosPadraoAlerta,
      ciclos_queda_continua: c.ciclosQuedaContinua,
      max_km_sem_registro: c.maxKmSemRegistro,
      tolerancia_capacidade_pct: c.toleranciaCapacidadePct,
      tolerancia_valor_total: c.toleranciaValorTotal,
      janela_duplicidade_min: c.janelaDuplicidadeMin,
      velocidade_max_kmh: c.velocidadeMaxKmh,
      velocidade_min_kmh: c.velocidadeMinKmh,
      mapeamento_movetruck: c.mapeamentoMoveTruck,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'company_id' },
  )
  if (error) throw error
  avisarAtualizacao()
}
