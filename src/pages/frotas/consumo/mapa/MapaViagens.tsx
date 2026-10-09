import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useTheme } from '@/contexts/ThemeContext'
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

const COR_ORIGEM = '#16a34a'
const COR_DESTINO = '#dc2626'
const COR_ROTA_NOVA = '#E23B2E'
const COR_VIAGEM = '#3b82f6'
const CENTRO_BRASIL: L.LatLngExpression = [-15.8, -47.9]

function enquadrar(mapa: L.Map, limites: L.LatLngExpression[]) {
  if (limites.length === 1) mapa.setView(limites[0], 12)
  else if (limites.length > 1) mapa.fitBounds(L.latLngBounds(limites), { padding: [30, 30], maxZoom: 13 })
}

// Leaflet puro (sem wrapper React): o mapa é criado uma vez e as camadas são
// redesenhadas quando as props mudam.
export function MapaViagens({ origem, destino, rota, viagens = [], destaqueId, onClickMapa, className }: Props) {
  const divRef = useRef<HTMLDivElement>(null)
  const mapaRef = useRef<L.Map | null>(null)
  const camadasRef = useRef<L.LayerGroup | null>(null)
  // Último enquadramento, para refazer quando o mapa muda de tamanho.
  const enquadramentoRef = useRef<{ limites: L.LatLngExpression[] } | null>(null)
  const onClickRef = useRef(onClickMapa)
  onClickRef.current = onClickMapa
  const { theme } = useTheme()

  useEffect(() => {
    if (!divRef.current || mapaRef.current) return
    // Rolagem do mouse só dá zoom depois de clicar no mapa — antes ela rola a
    // página (senão quem desce até a lista acaba afastando o mapa).
    const mapa = L.map(divRef.current, { center: CENTRO_BRASIL, zoom: 4, zoomControl: true, scrollWheelZoom: false })
    mapa.on('focus click', () => mapa.scrollWheelZoom.enable())
    mapa.on('blur mouseout', () => mapa.scrollWheelZoom.disable())
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapa)
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

  useEffect(() => {
    const mapa = mapaRef.current
    const grupo = camadasRef.current
    if (!mapa || !grupo) return
    grupo.clearLayers()
    const limites: L.LatLngExpression[] = []

    for (const v of viagens) {
      if (v.coordenadas.length < 2) continue
      const destacada = v.id === destaqueId
      L.polyline(v.coordenadas, {
        color: COR_VIAGEM,
        weight: destacada ? 5 : 3,
        opacity: destaqueId && !destacada ? 0.35 : 0.85,
      })
        .bindTooltip(v.rotulo, { sticky: true })
        .addTo(grupo)
      if (!destaqueId || destacada) limites.push(...v.coordenadas)
    }

    if (rota && rota.length > 1) {
      L.polyline(rota, { color: COR_ROTA_NOVA, weight: 5, opacity: 0.9 }).addTo(grupo)
      limites.push(...rota)
    }
    for (const [ponto, cor, nome] of [
      [origem, COR_ORIGEM, 'Origem'],
      [destino, COR_DESTINO, 'Destino'],
    ] as const) {
      if (!ponto) continue
      L.circleMarker([ponto.lat, ponto.lng], { radius: 8, color: '#ffffff', weight: 2, fillColor: cor, fillOpacity: 1 })
        .bindTooltip(`${nome}: ${ponto.rotulo}`)
        .addTo(grupo)
      limites.push([ponto.lat, ponto.lng])
    }

    enquadramentoRef.current = limites.length ? { limites } : null
    enquadrar(mapa, limites)
  }, [origem, destino, rota, viagens, destaqueId])

  return (
    <div
      ref={divRef}
      className={`${className ?? ''} ${theme === 'dark' ? 'mapa-escuro' : ''} z-0 overflow-hidden rounded-xl border border-border/30`}
      role="application"
      aria-label="Mapa das viagens. Clique para marcar origem ou destino."
    />
  )
}
