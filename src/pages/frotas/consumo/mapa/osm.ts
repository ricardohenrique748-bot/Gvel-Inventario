// Serviços públicos e gratuitos do OpenStreetMap usados pela aba Viagens.
// - Nominatim (busca de endereço): política de uso de no máximo 1 requisição
//   por segundo — a tela só busca ao apertar Enter/botão, nunca a cada tecla.
// - OSRM (rota): servidor de demonstração, perfil de carro. Bom para a
//   distância; o tempo real de caminhão costuma ser maior.

export interface PontoMapa {
  lat: number
  lng: number
  /** Texto curto para o campo origem/destino (ex.: "SÃO PAULO - SP"). */
  rotulo: string
  endereco?: string
  cidade?: string
  uf?: string
}

export interface RotaCalculada {
  distanciaKm: number
  tempoHoras: number
  /** [lat, lng] */
  coordenadas: [number, number][]
}

const NOMINATIM = 'https://nominatim.openstreetmap.org'
const OSRM = 'https://router.project-osrm.org'

// "ISO3166-2-lvl4": "BR-SP" → "SP"
function ufDe(address: Record<string, string> | undefined): string | undefined {
  const iso = address?.['ISO3166-2-lvl4']
  return iso?.startsWith('BR-') ? iso.slice(3) : undefined
}

function pontoDoResultado(r: any): PontoMapa {
  const a = (r.address ?? {}) as Record<string, string>
  const cidade = a.city || a.town || a.village || a.municipality || a.county
  const uf = ufDe(a)
  const rua = [a.road, a.house_number].filter(Boolean).join(', ')
  return {
    lat: Number(r.lat),
    lng: Number(r.lon),
    rotulo: (cidade ? `${cidade}${uf ? ` - ${uf}` : ''}` : String(r.display_name ?? '').split(',').slice(0, 2).join(',')).toUpperCase(),
    endereco: rua || undefined,
    cidade: cidade?.toUpperCase(),
    uf,
  }
}

export async function buscarEndereco(texto: string): Promise<PontoMapa[]> {
  const q = texto.trim()
  if (q.length < 3) return []
  const url = `${NOMINATIM}/search?format=jsonv2&addressdetails=1&limit=6&countrycodes=br&accept-language=pt-BR&q=${encodeURIComponent(q)}`
  const resp = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!resp.ok) throw new Error('Busca de endereço indisponível no momento. Tente de novo em alguns segundos.')
  return ((await resp.json()) as any[]).map(pontoDoResultado)
}

export async function enderecoDoPonto(lat: number, lng: number): Promise<PontoMapa> {
  const url = `${NOMINATIM}/reverse?format=jsonv2&addressdetails=1&zoom=16&accept-language=pt-BR&lat=${lat}&lon=${lng}`
  try {
    const resp = await fetch(url, { headers: { Accept: 'application/json' } })
    if (resp.ok) return { ...pontoDoResultado(await resp.json()), lat, lng }
  } catch {
    // sem endereço: fica só a coordenada
  }
  return { lat, lng, rotulo: `${lat.toFixed(5)}, ${lng.toFixed(5)}` }
}

export async function calcularRota(origem: PontoMapa, destino: PontoMapa): Promise<RotaCalculada> {
  const url = `${OSRM}/route/v1/driving/${origem.lng},${origem.lat};${destino.lng},${destino.lat}?overview=simplified&geometries=geojson`
  const resp = await fetch(url)
  if (!resp.ok) throw new Error('Cálculo de rota indisponível no momento. Tente de novo em alguns segundos.')
  const json = await resp.json()
  const rota = json?.routes?.[0]
  if (json?.code !== 'Ok' || !rota) throw new Error('Não foi encontrada rota entre a origem e o destino.')
  return {
    distanciaKm: Math.round((rota.distance / 1000) * 10) / 10,
    tempoHoras: Math.round((rota.duration / 3600) * 10) / 10,
    coordenadas: (rota.geometry.coordinates as [number, number][]).map(([lng, lat]) => [lat, lng]),
  }
}
