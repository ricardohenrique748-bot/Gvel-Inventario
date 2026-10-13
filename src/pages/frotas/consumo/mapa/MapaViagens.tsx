import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useTheme } from '@/contexts/ThemeContext'
import { ATRIBUICAO_MAPA, estiloGoogle } from './estiloGoogle'
import type { PontoMapa } from './osm'

export interface RotaNoMapa {
  id: string
  coordenadas: [number, number][]
  rotulo: string
}

interface Props {
  origem?: PontoMapa
  destino?: PontoMapa
  /** Rota da viagem que está sendo cadastrada. */
  rota?: [number, number][]
  /** Viagens já cadastradas no período. */
  viagens?: RotaNoMapa[]
  destaqueId?: string | null
  onClickMapa?: (lat: number, lng: number) => void
  className?: string
}

type Estilo = 'mapa' | 'satelite'

const COR_ORIGEM = '#16a34a'
const COR_DESTINO = '#dc2626'
const COR_ROTA_NOVA = '#E23B2E'
const COR_VIAGEM = '#3b82f6'
const COR_VIAGEM_DESTAQUE = '#f59e0b'
const CENTRO_BRASIL: L.LatLngExpression = [-15.8, -47.9]

// Modo "Mapa": estilo vetorial com a cara do Google Maps (estiloGoogle.ts),
// desenhado pelo MapLibre dentro do Leaflet. Satélite e o reserva (aparelho
// sem WebGL ou estilo fora do ar) vêm da Esri, gratuitos e sem chave.
const esri = (servico: string) => `https://server.arcgisonline.com/ArcGIS/rest/services/${servico}/MapServer/tile/{z}/{y}/{x}`
const BASES_RASTER = {
  claro: [{ url: esri('World_Street_Map'), attribution: 'Mapa &copy; Esri, HERE, Garmin, OpenStreetMap', maxNativeZoom: 19 }],
  escuro: [
    { url: esri('Canvas/World_Dark_Gray_Base'), attribution: 'Mapa &copy; Esri, HERE, Garmin, OpenStreetMap', maxNativeZoom: 16 },
    { url: esri('Canvas/World_Dark_Gray_Reference'), attribution: '', maxNativeZoom: 16 },
  ],
  satelite: [
    { url: esri('World_Imagery'), attribution: 'Imagens &copy; Esri, Maxar, Earthstar Geographics', maxNativeZoom: 19 },
    { url: esri('Reference/World_Boundaries_and_Places'), attribution: '', maxNativeZoom: 19 },
    { url: esri('Reference/World_Transportation'), attribution: '', maxNativeZoom: 19 },
  ],
} as const

function adicionarRaster(chave: keyof typeof BASES_RASTER, grupo: L.LayerGroup) {
  for (const b of BASES_RASTER[chave]) L.tileLayer(b.url, { maxZoom: 19, maxNativeZoom: b.maxNativeZoom, attribution: b.attribution }).addTo(grupo)
}

const temWebGL = (() => {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
})()

// MapLibre (~1 MB) só é baixado quando o mapa abre.
async function camadaVetorial(escuro: boolean): Promise<L.Layer> {
  const [style, { maplibreGL }] = await Promise.all([
    estiloGoogle(escuro),
    import('@maplibre/maplibre-gl-leaflet'),
    import('maplibre-gl/dist/maplibre-gl.css'),
  ])
  return maplibreGL({ style, attributionControl: false, attribution: ATRIBUICAO_MAPA } as L.LeafletMaplibreGLOptions)
}

function pino(letra: string, cor: string) {
  return L.divIcon({
    className: 'mapa-pino',
    html: `<span style="background:${cor}"><b>${letra}</b></span>`,
    iconSize: [28, 36],
    iconAnchor: [14, 34],
    tooltipAnchor: [0, -30],
  })
}

function enquadrar(mapa: L.Map, limites: L.LatLngExpression[]) {
  if (limites.length === 1) mapa.setView(limites[0], 12)
  else if (limites.length > 1) mapa.fitBounds(L.latLngBounds(limites), { padding: [40, 40], maxZoom: 13 })
  else mapa.setView(CENTRO_BRASIL, 4)
}

// Linha com contorno (fica legível em qualquer fundo, inclusive satélite).
function linhaComContorno(
  grupo: L.LayerGroup,
  coords: [number, number][],
  cor: string,
  peso: number,
  opacidade: number,
  contorno: string,
) {
  L.polyline(coords, { color: contorno, weight: peso + 4, opacity: opacidade * 0.9, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(grupo)
  return L.polyline(coords, { color: cor, weight: peso, opacity: opacidade, lineCap: 'round', lineJoin: 'round' }).addTo(grupo)
}

// Leaflet puro (sem wrapper React): o mapa é criado uma vez e as camadas são
// redesenhadas quando as props mudam.
export function MapaViagens({ origem, destino, rota, viagens = [], destaqueId, onClickMapa, className }: Props) {
  const divRef = useRef<HTMLDivElement>(null)
  const mapaRef = useRef<L.Map | null>(null)
  const baseRef = useRef<L.LayerGroup | null>(null)
  const camadasRef = useRef<L.LayerGroup | null>(null)
  // Último enquadramento, para refazer quando o mapa muda de tamanho.
  const enquadramentoRef = useRef<{ limites: L.LatLngExpression[] } | null>(null)
  const onClickRef = useRef(onClickMapa)
  onClickRef.current = onClickMapa
  const { theme } = useTheme()
  const escuro = theme === 'dark'
  const [estilo, setEstilo] = useState<Estilo>('mapa')

  useEffect(() => {
    if (!divRef.current || mapaRef.current) return
    // Rolagem do mouse só dá zoom depois de clicar no mapa — antes ela rola a
    // página (senão quem desce até a lista acaba afastando o mapa).
    const mapa = L.map(divRef.current, { center: CENTRO_BRASIL, zoom: 4, zoomControl: true, scrollWheelZoom: false })
    mapa.on('focus click', () => mapa.scrollWheelZoom.enable())
    mapa.on('blur mouseout', () => mapa.scrollWheelZoom.disable())
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(mapa)
    baseRef.current = L.layerGroup().addTo(mapa)
    camadasRef.current = L.layerGroup().addTo(mapa)
    mapa.on('click', (e: L.LeafletMouseEvent) => onClickRef.current?.(e.latlng.lat, e.latlng.lng))
    mapaRef.current = mapa

    // O container pode mudar de tamanho (aba aberta, janela redimensionada).
    const obs = new ResizeObserver(() => {
      mapa.invalidateSize()
      if (enquadramentoRef.current) enquadrar(mapa, enquadramentoRef.current.limites)
    })
    obs.observe(divRef.current)
    return () => {
      obs.disconnect()
      mapa.remove()
      mapaRef.current = null
    }
  }, [])

  // Mapa base conforme o tema e o estilo escolhido.
  useEffect(() => {
    const base = baseRef.current
    if (!base) return
    base.clearLayers()
    if (estilo === 'satelite') {
      adicionarRaster('satelite', base)
      return
    }
    const reserva = () => adicionarRaster(escuro ? 'escuro' : 'claro', base)
    if (!temWebGL) return reserva()
    let cancelado = false
    camadaVetorial(escuro)
      .then((camada) => !cancelado && camada.addTo(base))
      .catch((e) => {
        console.warn('Mapa vetorial indisponível, usando o reserva:', e)
        if (!cancelado) reserva()
      })
    return () => {
      cancelado = true
    }
  }, [estilo, escuro])

  useEffect(() => {
    const mapa = mapaRef.current
    const grupo = camadasRef.current
    if (!mapa || !grupo) return
    grupo.clearLayers()
    const limites: L.LatLngExpression[] = []
    const contorno = escuro || estilo === 'satelite' ? '#0b0b0b' : '#ffffff'

    // A destacada é desenhada por último, por cima das outras.
    const ordenadas = [...viagens].sort((a, b) => Number(a.id === destaqueId) - Number(b.id === destaqueId))
    for (const v of ordenadas) {
      if (v.coordenadas.length < 2) continue
      const destacada = v.id === destaqueId
      const apagada = !!destaqueId && !destacada
      linhaComContorno(grupo, v.coordenadas, destacada ? COR_VIAGEM_DESTAQUE : COR_VIAGEM, destacada ? 5 : 3, apagada ? 0.3 : 0.9, contorno)
        .bindTooltip(v.rotulo, { sticky: true })
      if (!apagada) {
        const inicio = v.coordenadas[0]
        const fim = v.coordenadas[v.coordenadas.length - 1]
        for (const [p, cor] of [
          [inicio, COR_ORIGEM],
          [fim, COR_DESTINO],
        ] as const) {
          L.circleMarker(p, { radius: destacada ? 6 : 4, color: contorno, weight: 2, fillColor: cor, fillOpacity: 1 })
            .bindTooltip(v.rotulo)
            .addTo(grupo)
        }
      }
      if (!destaqueId || destacada) limites.push(...v.coordenadas)
    }

    if (rota && rota.length > 1) {
      linhaComContorno(grupo, rota, COR_ROTA_NOVA, 5, 0.95, contorno)
      limites.push(...rota)
    }
    for (const [ponto, cor, letra, nome] of [
      [origem, COR_ORIGEM, 'A', 'Origem'],
      [destino, COR_DESTINO, 'B', 'Destino'],
    ] as const) {
      if (!ponto) continue
      L.marker([ponto.lat, ponto.lng], { icon: pino(letra, cor), keyboard: false })
        .bindTooltip(`${nome}: ${ponto.rotulo}`)
        .addTo(grupo)
      limites.push([ponto.lat, ponto.lng])
    }

    enquadramentoRef.current = limites.length ? { limites } : null
    enquadrar(mapa, limites)
  }, [origem, destino, rota, viagens, destaqueId, escuro, estilo])

  const botao = (ativo: boolean) =>
    `px-2.5 py-1 text-[11px] font-bold transition-colors ${ativo ? 'bg-primary text-white' : 'bg-surface/90 text-secondary hover:text-foreground'}`

  return (
    <div className={`relative ${className ?? ''}`}>
      <div
        ref={divRef}
        className={`absolute inset-0 ${escuro ? 'mapa-escuro' : ''} z-0 overflow-hidden rounded-xl border border-border/30`}
        role="application"
        aria-label="Mapa das viagens. Clique para marcar origem ou destino."
      />
      <div className="absolute right-2 top-2 z-[400] flex flex-col items-end gap-1.5">
        <div className="flex overflow-hidden rounded-lg border border-border/30 shadow-md backdrop-blur" role="group" aria-label="Estilo do mapa">
          <button type="button" className={botao(estilo === 'mapa')} aria-pressed={estilo === 'mapa'} onClick={() => setEstilo('mapa')}>
            Mapa
          </button>
          <button type="button" className={botao(estilo === 'satelite')} aria-pressed={estilo === 'satelite'} onClick={() => setEstilo('satelite')}>
            Satélite
          </button>
        </div>
        <button
          type="button"
          className="rounded-lg border border-border/30 bg-surface/90 px-2.5 py-1 text-[11px] font-bold text-secondary shadow-md backdrop-blur hover:text-foreground"
          onClick={() => mapaRef.current && enquadrar(mapaRef.current, enquadramentoRef.current?.limites ?? [])}
          title="Enquadrar as rotas"
        >
          Ver tudo
        </button>
      </div>
    </div>
  )
}
