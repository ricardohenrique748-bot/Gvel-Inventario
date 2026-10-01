import { useState } from 'react'
import { Save, Plus } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Label } from '@/components/ui/Input'
import {
  salvarConfigConsumo,
  salvarMetaVeiculo,
  salvarPosto,
  type ConfigConsumoCompleta,
  type MetaConsumoVeiculo,
  type Posto,
} from '@/hooks/useConsumoCombustivel'
import { SecaoTitulo, parseDecimal, type VeiculoConsumo } from './ui'
import { erroConsumo } from './erros'

interface Props {
  veiculos: VeiculoConsumo[]
  metas: Record<string, MetaConsumoVeiculo>
  postos: Posto[]
  config: ConfigConsumoCompleta
  isAdmin: boolean
}

export function ConfiguracoesConsumo({ veiculos, metas, postos, config, isAdmin }: Props) {
  return (
    <div className="space-y-6">
      {!isAdmin && (
        <Card className="p-4 text-sm normal-case text-secondary">Metas, postos e parâmetros só podem ser alterados por administradores.</Card>
      )}
      <MetasVeiculos veiculos={veiculos} metas={metas} isAdmin={isAdmin} />
      <Postos postos={postos} isAdmin={isAdmin} />
      <Parametros key={JSON.stringify(config)} config={config} isAdmin={isAdmin} />
    </div>
  )
}

// ------------------------------------------------------------
function MetasVeiculos({ veiculos, metas, isAdmin }: { veiculos: VeiculoConsumo[]; metas: Record<string, MetaConsumoVeiculo>; isAdmin: boolean }) {
  return (
    <Card className="overflow-hidden">
      <div className="p-4">
        <SecaoTitulo
          titulo="Metas e capacidade por veículo"
          descricao="Meta geral obrigatória para o semáforo; carregado/vazio são opcionais (sem elas, vale a geral). Capacidade valida litros abastecidos (+ tolerância)."
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-background/60 text-[10px] uppercase text-secondary">
            <tr>
              {['Placa', 'Tanque diesel (L)', 'Tanque ARLA (L)', 'Meta km/L', 'Meta carregado', 'Meta vazio', ''].map((h) => (
                <th key={h} className="whitespace-nowrap px-3 py-2 text-left font-bold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {veiculos.map((v) => (
              <LinhaMeta key={v.placa + JSON.stringify(metas[v.placa] ?? {})} veiculo={v} meta={metas[v.placa]} isAdmin={isAdmin} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function LinhaMeta({ veiculo, meta, isAdmin }: { veiculo: VeiculoConsumo; meta?: MetaConsumoVeiculo; isAdmin: boolean }) {
  const s = (n?: number) => (n != null ? String(n).replace('.', ',') : '')
  const [f, setF] = useState({
    capacidadeTanque: s(meta?.capacidadeTanque),
    capacidadeTanqueArla: s(meta?.capacidadeTanqueArla),
    metaKmL: s(meta?.metaKmL),
    metaKmLCarregado: s(meta?.metaKmLCarregado),
    metaKmLVazio: s(meta?.metaKmLVazio),
  })
  const [estado, setEstado] = useState<'' | 'salvando' | 'ok' | 'erro'>('')
  const alterado =
    f.capacidadeTanque !== s(meta?.capacidadeTanque) ||
    f.capacidadeTanqueArla !== s(meta?.capacidadeTanqueArla) ||
    f.metaKmL !== s(meta?.metaKmL) ||
    f.metaKmLCarregado !== s(meta?.metaKmLCarregado) ||
    f.metaKmLVazio !== s(meta?.metaKmLVazio)

  async function salvar() {
    setEstado('salvando')
    try {
      await salvarMetaVeiculo({
        placa: veiculo.placa,
        capacidadeTanque: parseDecimal(f.capacidadeTanque),
        capacidadeTanqueArla: parseDecimal(f.capacidadeTanqueArla),
        metaKmL: parseDecimal(f.metaKmL),
        metaKmLCarregado: parseDecimal(f.metaKmLCarregado),
        metaKmLVazio: parseDecimal(f.metaKmLVazio),
      })
      setEstado('ok')
    } catch {
      setEstado('erro')
    }
  }

  const campo = (k: keyof typeof f) => (
    <td className="px-2 py-1.5">
      <Input
        noUppercase
        inputMode="decimal"
        disabled={!isAdmin}
        value={f[k]}
        onChange={(e) => {
          setF({ ...f, [k]: e.target.value })
          setEstado('')
        }}
        className="h-9 w-24 px-2 text-xs"
      />
    </td>
  )

  return (
    <tr className="border-t border-border/10">
      <td className="whitespace-nowrap px-3 py-1.5">
        <strong className="text-foreground">{veiculo.placa}</strong>
        <span className="block text-[10px] text-secondary">{veiculo.nome}</span>
      </td>
      {campo('capacidadeTanque')}
      {campo('capacidadeTanqueArla')}
      {campo('metaKmL')}
      {campo('metaKmLCarregado')}
      {campo('metaKmLVazio')}
      <td className="whitespace-nowrap px-2 py-1.5">
        {isAdmin && alterado && (
          <Button type="button" size="md" className="h-9" disabled={estado === 'salvando'} onClick={salvar}>
            <Save className="h-3.5 w-3.5" /> Salvar
          </Button>
        )}
        {estado === 'ok' && !alterado && <span className="text-status-success">Salvo</span>}
        {estado === 'erro' && <span className="text-status-danger">Erro ao salvar</span>}
      </td>
    </tr>
  )
}

// ------------------------------------------------------------
function Postos({ postos, isAdmin }: { postos: Posto[]; isAdmin: boolean }) {
  const vazio = { nome: '', cnpj: '', cidade: '', uf: '', interno: false, ativo: true }
  const [novo, setNovo] = useState(vazio)
  const [erro, setErro] = useState<string | null>(null)

  async function adicionar() {
    if (!novo.nome.trim()) return setErro('Informe o nome do posto.')
    setErro(null)
    try {
      await salvarPosto(novo)
      setNovo(vazio)
    } catch (e) {
      setErro(erroConsumo(e, 'Erro ao salvar posto.'))
    }
  }

  return (
    <Card className="space-y-3 p-4">
      <SecaoTitulo titulo="Postos" descricao="Postos externos e bomba interna da empresa." />
      <ul className="divide-y divide-border/10 text-xs">
        {postos.length === 0 && <li className="py-2 normal-case text-secondary">Nenhum posto cadastrado.</li>}
        {postos.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className={p.ativo ? '' : 'opacity-50'}>
              <strong className="text-foreground">{p.nome}</strong>
              {p.cidade ? ` · ${p.cidade}${p.uf ? `/${p.uf}` : ''}` : ''}
              {p.cnpj ? ` · CNPJ ${p.cnpj}` : ''}
              {p.interno ? ' · interno' : ''}
              {!p.ativo ? ' · inativo' : ''}
            </span>
            {isAdmin && (
              <Button type="button" size="md" variant="ghost" className="h-8" onClick={() => salvarPosto({ ...p, ativo: !p.ativo })}>
                {p.ativo ? 'Desativar' : 'Reativar'}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {isAdmin && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
          <Input className="col-span-2 h-10 text-xs" placeholder="Nome" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
          <Input className="h-10 text-xs" noUppercase placeholder="CNPJ" value={novo.cnpj} onChange={(e) => setNovo({ ...novo, cnpj: e.target.value })} />
          <Input className="h-10 text-xs" placeholder="Cidade" value={novo.cidade} onChange={(e) => setNovo({ ...novo, cidade: e.target.value })} />
          <Input className="h-10 text-xs" placeholder="UF" maxLength={2} value={novo.uf} onChange={(e) => setNovo({ ...novo, uf: e.target.value })} />
          <label className="flex items-center gap-2 text-xs normal-case">
            <input type="checkbox" checked={novo.interno} onChange={(e) => setNovo({ ...novo, interno: e.target.checked })} /> Interno
          </label>
          <Button type="button" size="md" className="col-span-2 h-10 sm:col-span-1" onClick={adicionar}>
            <Plus className="h-4 w-4" /> Adicionar
          </Button>
        </div>
      )}
      {erro && <p className="text-xs normal-case text-status-danger">{erro}</p>}
    </Card>
  )
}

// ------------------------------------------------------------
const PARAMETROS: { k: keyof ConfigConsumoCompleta; label: string; dica: string }[] = [
  { k: 'semaforoVerdePct', label: 'Verde até (% abaixo da meta)', dica: 'Acima disso vira amarelo' },
  { k: 'semaforoAmareloPct', label: 'Amarelo até (% abaixo da meta)', dica: 'Acima disso vira vermelho' },
  { k: 'anomaliaAbaixoMetaPct', label: 'Alerta consumo abaixo da meta (%)', dica: 'km/L < meta × (1 − x%)' },
  { k: 'anomaliaAcimaMetaPct', label: 'Alerta eficiência suspeita (%)', dica: 'km/L > meta × (1 + x%) → revisão' },
  { k: 'desviosPadraoAlerta', label: 'Desvios-padrão (histórico)', dica: 'Abaixo da média − N·σ do próprio veículo' },
  { k: 'ciclosQuedaContinua', label: 'Ciclos p/ queda contínua', dica: 'Ciclos seguidos piorando' },
  { k: 'maxKmSemRegistro', label: 'Máx. km sem registro', dica: 'Alerta de intervalo anormal' },
  { k: 'toleranciaCapacidadePct', label: 'Tolerância do tanque (%)', dica: 'Litros > capacidade × (1 + x%)' },
  { k: 'toleranciaValorTotal', label: 'Tolerância valor total (R$)', dica: 'Nota × litros·valor/litro' },
  { k: 'janelaDuplicidadeMin', label: 'Janela de duplicidade (min)', dica: 'Mesma placa e litros' },
  { k: 'velocidadeMaxKmh', label: 'Velocidade média máx. (km/h)', dica: 'km ÷ horas do horímetro' },
  { k: 'velocidadeMinKmh', label: 'Velocidade média mín. (km/h)', dica: 'Horas excessivas p/ distância' },
]

function Parametros({ config, isAdmin }: { config: ConfigConsumoCompleta; isAdmin: boolean }) {
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(PARAMETROS.map((p) => [p.k, String(config[p.k]).replace('.', ',')])),
  )
  const [estado, setEstado] = useState<string | null>(null)

  async function salvar() {
    const novo = { ...config }
    for (const p of PARAMETROS) {
      const n = parseDecimal(valores[p.k])
      if (n == null || n < 0) return setEstado(`Valor inválido em “${p.label}”.`)
      ;(novo as Record<string, unknown>)[p.k] = n
    }
    if (novo.semaforoAmareloPct < novo.semaforoVerdePct) return setEstado('O limite do amarelo deve ser maior que o do verde.')
    try {
      await salvarConfigConsumo(novo)
      setEstado('Parâmetros salvos.')
    } catch (e) {
      setEstado(erroConsumo(e, 'Erro ao salvar.'))
    }
  }

  return (
    <Card className="space-y-4 p-4">
      <SecaoTitulo titulo="Parâmetros" descricao="Semáforo, alertas e validações. Valem para todos os veículos da empresa." />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PARAMETROS.map((p) => (
          <div key={p.k}>
            <Label className="text-xs">{p.label}</Label>
            <Input noUppercase inputMode="decimal" disabled={!isAdmin} value={valores[p.k]} onChange={(e) => setValores({ ...valores, [p.k]: e.target.value })} className="h-10 text-sm" />
            <p className="mt-0.5 text-[10px] normal-case text-secondary">{p.dica}</p>
          </div>
        ))}
      </div>
      {isAdmin && (
        <div className="flex items-center justify-end gap-3">
          {estado && <span className="text-xs normal-case text-secondary">{estado}</span>}
          <Button type="button" size="md" onClick={salvar}>
            <Save className="h-4 w-4" /> Salvar parâmetros
          </Button>
        </div>
      )}
    </Card>
  )
}
