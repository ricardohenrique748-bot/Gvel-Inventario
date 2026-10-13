import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useTheme } from '@/contexts/ThemeContext'

export interface RotaNoMapa {
  id: string
  coordenadas: [number, number][]
  rotulo: string
}

interface Props {
  /** Viagens do período. */
  viagens?: RotaNoMapa[]
  destaqueId?: string | null
  className?: string
}

const COR_ORIGEM = '#16a34a'
const COR_DESTINO = '#dc2626'
const COR_VIAGEM = '#3b82f6'
const COR_VIAGEM_DESTAQUE = '#f59e0b'
const CENTRO_BRASIL: L.LatLngExpression = [-15.8, -47.9]

// Satélite da Esri (ArcGIS Online), gratuito e sem chave, com nomes de
// lugares e rodovias por cima.
const esri = (servico: string) => `https://server.arcgisonline.com/ArcGIS/rest/services/${servico}/MapServer/tile/{z}/{y}/{x}`
const CAMADAS_SATELITE = [
  { url: esri('World_Imagery'), attribution: 'Imagens &copy; Esri, Maxar, Earthstar Geographics' },
  { url: esri('Reference/World_Boundaries_and_Places'), attribution: '' },
  { url: esri('Reference/World_Transportation'), attribution: '' },
]
// Contorno escuro das linhas: destaca as rotas sobre a imagem.
const CONTORNO = '#0b0b0b'

function enquadrar(mapa: L.Map, limites: L.LatLngExpression[]) {
  if (limites.length === 1) mapa.setView(limites[0], 12)
  else if (limites.length > 1) mapa.fitBounds(L.latLngBounds(limites), { padding: [40, 40], maxZoom: 13 })
  else mapa.setView(CENTRO_BRASIL, 4)
}

// Linha com contorno, legível sobre a imagem de satélite.
function linhaComContorno(grupo: L.LayerGroup, coords: [number, number][], cor: string, peso: number, opacidade: number) {
  L.polyline(coords, { color: CONTORNO, weight: peso + 4, opacity: opacidade * 0.9, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(grupo)
  return L.polyline(coords, { color: cor, weight: peso, opacity: opacidade, lineCap: 'round', lineJoin: 'round' }).addTo(grupo)
}

// Leaflet puro (sem wrapper React): o mapa é criado uma vez e as camadas são
// redesenhadas quando as props mudam.
export function MapaViagens({ viagens = [], destaqueId, className }: Props) {
  const divRef = useRef<HTMLDivElement>(null)
  const mapaRef = useRef<L.Map | null>(null)
  const camadasRef = useRef<L.LayerGroup | null>(null)
  // Último enquadramento, para refazer quando o mapa muda de tamanho.
  const enquadramentoRef = useRef<{ limites: L.LatLngExpression[] } | null>(null)
  const { theme } = useTheme()
  const escuro = theme === 'dark'

  useEffect(() => {
    if (!divRef.current || mapaRef.current) return
    // Rolagem do mouse só dá zoom depois de clicar no mapa — antes ela rola a
    // página (senão quem desce até a lista acaba afastando o mapa).
    const mapa = L.map(divRef.current, { center: CENTRO_BRASIL, zoom: 4, zoomControl: true, scrollWheelZoom: false })
    mapa.on('focus click', () => mapa.scrollWheelZoom.enable())
    mapa.on('blur mouseout', () => mapa.scrollWheelZoom.disable())
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(mapa)
    for (const c of CAMADAS_SATELITE) L.tileLayer(c.url, { maxZoom: 19, attribution: c.attribution }).addTo(mapa)
    camadasRef.current = L.layerGroup().addTo(mapa)
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

  useEffect(() => {
    const mapa = mapaRef.current
    const grupo = camadasRef.current
    if (!mapa || !grupo) return
    grupo.clearLayers()
    const limites: L.LatLngExpression[] = []

    // A destacada é desenhada por último, por cima das outras.
    const ordenadas = [...viagens].sort((a, b) => Number(a.id === destaqueId) - Number(b.id === destaqueId))
    for (const v of ordenadas) {
      if (v.coordenadas.length < 2) continue
      const destacada = v.id === destaqueId
      const apagada = !!destaqueId && !destacada
      linhaComContorno(grupo, v.coordenadas, destacada ? COR_VIAGEM_DESTAQUE : COR_VIAGEM, destacada ? 5 : 3, apagada ? 0.3 : 0.9)
        .bindTooltip(v.rotulo, { sticky: true })
      if (!apagada) {
        const inicio = v.coordenadas[0]
        const fim = v.coordenadas[v.coordenadas.length - 1]
        for (const [p, cor] of [
          [inicio, COR_ORIGEM],
          [fim, COR_DESTINO],
        ] as const) {
          L.circleMarker(p, { radius: destacada ? 6 : 4, color: CONTORNO, weight: 2, fillColor: cor, fillOpacity: 1 })
            .bindTooltip(v.rotulo)
            .addTo(grupo)
        }
      }
      if (!destaqueId || destacada) limites.push(...v.coordenadas)
    }

    enquadramentoRef.current = limites.length ? { limites } : null
    enquadrar(mapa, limites)
  }, [viagens, destaqueId])

  return (
    <div className={`relative ${className ?? ''}`}>
      <div
        ref={divRef}
        className={`absolute inset-0 ${escuro ? 'mapa-escuro' : ''} z-0 overflow-hidden rounded-xl border border-border/30`}
                aria-label="Mapa das viagens do período."
      />
      <div className="absolute right-2 top-2 z-[400]">
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
