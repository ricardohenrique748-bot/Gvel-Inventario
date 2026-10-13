import { supabase } from '@/lib/supabase'
import { buscarEndereco, calcularRota, type PontoMapa } from './osm'

// Viagens cadastradas no Controle de Viagens (só texto de endereço) ganham
// coordenadas e rota para aparecerem na aba Viagens do Consumo (mapa).
// Roda em segundo plano depois do salvamento; se a busca falhar, a viagem
// continua salva, só fica "sem rota no mapa".

interface EnderecoViagem {
  endereco?: string
  cidade?: string
  uf?: string
}

export interface DadosRotaAutomatica {
  origem: EnderecoViagem
  destino: EnderecoViagem
  /** Preenche km/horas só quando o usuário não informou. */
  distanciaInformada: boolean
  tempoInformado: boolean
}

// Nominatim: no máximo 1 requisição por segundo.
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function localizar(e: EnderecoViagem): Promise<PontoMapa | undefined> {
  const cidadeUf = [e.cidade, e.uf].filter(Boolean).join(' ')
  const tentativas = [e.endereco && cidadeUf ? `${e.endereco}, ${cidadeUf}` : '', cidadeUf].filter((t) => t.trim().length >= 3)
  for (let i = 0; i < tentativas.length; i++) {
    if (i > 0) await esperar(1100)
    const [ponto] = await buscarEndereco(tentativas[i])
    if (ponto) return ponto
  }
  return undefined
}

export async function vincularRotaNoMapa(viagemId: string, dados: DadosRotaAutomatica): Promise<void> {
  try {
    const origem = await localizar(dados.origem)
    if (!origem) return
    await esperar(1100)
    const destino = await localizar(dados.destino)
    if (!destino) return
    const rota = await calcularRota(origem, destino).catch(() => undefined)

    const { error } = await supabase
      .from('viagens_frota')
      .update({
        origem_lat: origem.lat,
        origem_lng: origem.lng,
        destino_lat: destino.lat,
        destino_lng: destino.lng,
        rota_coordenadas: rota?.coordenadas ?? null,
        ...(rota && !dados.distanciaInformada ? { distancia_estimada_km: rota.distanciaKm } : {}),
        ...(rota && !dados.tempoInformado ? { tempo_estimado_horas: rota.tempoHoras } : {}),
      })
      .eq('id', viagemId)
    if (error) throw error
    window.dispatchEvent(new Event('viagem_frota_updated'))
  } catch (err) {
    console.warn('Não foi possível gerar a rota da viagem no mapa:', err)
  }
}
