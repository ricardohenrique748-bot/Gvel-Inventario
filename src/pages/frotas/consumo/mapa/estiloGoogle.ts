// Estilo vetorial com a cara do Google Maps, gratuito e sem chave: parte do
// estilo "liberty" do OpenFreeMap (dados do OpenStreetMap) e troca as cores
// pela paleta atual do Google — terreno verde-menta, cidade cinza-clara, ruas
// brancas, rodovias azul-acinzentadas, água ciano — e os nomes para português.

const ESTILO_BASE = 'https://tiles.openfreemap.org/styles/liberty'
export const ATRIBUICAO_MAPA =
  '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> &copy; <a href="https://www.openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'

interface Paleta {
  terra: string
  urbano: string
  parque: string
  mata: string
  agua: string
  areia: string
  gelo: string
  hospital: string
  aeroporto: string
  predio: string
  predioBorda: string
  autoestrada: string
  autoestradaBorda: string
  tronco: string
  troncoBorda: string
  principal: string
  principalBorda: string
  rua: string
  ruaBorda: string
  caminho: string
  trilho: string
  pais: string
  estado: string
  texto: string
  textoForte: string
  halo: string
  textoAgua: string
  textoParque: string
}

const CLARO: Paleta = {
  terra: '#d4f2dd',
  urbano: '#eef0f3',
  parque: '#b6e6c2',
  mata: '#c3ecce',
  agua: '#90d5f5',
  areia: '#f6ecd9',
  gelo: '#ffffff',
  hospital: '#f9e3e3',
  aeroporto: '#e6e9ee',
  predio: '#e4e7ec',
  predioBorda: '#d6dbe2',
  autoestrada: '#8fa5c6',
  autoestradaBorda: '#6f88ad',
  tronco: '#aebfd8',
  troncoBorda: '#8ea2c2',
  principal: '#ffffff',
  principalBorda: '#c9d1dc',
  rua: '#ffffff',
  ruaBorda: '#dde2ea',
  caminho: '#e2e6ec',
  trilho: '#bcc4cf',
  pais: '#8f8f8f',
  estado: '#b4b4b4',
  texto: '#5f6368',
  textoForte: '#3c4043',
  halo: '#ffffff',
  textoAgua: '#2a7fb8',
  textoParque: '#1e8e3e',
}

// Modo noturno do Google Maps.
const ESCURO: Paleta = {
  terra: '#242f3e',
  urbano: '#2a3646',
  parque: '#263c3f',
  mata: '#283d3a',
  agua: '#17263c',
  areia: '#2f3948',
  gelo: '#3a4556',
  hospital: '#3a2f3e',
  aeroporto: '#2f3948',
  predio: '#2c3748',
  predioBorda: '#222b38',
  autoestrada: '#746855',
  autoestradaBorda: '#1f2835',
  tronco: '#5f5a4c',
  troncoBorda: '#1f2835',
  principal: '#38414e',
  principalBorda: '#212a37',
  rua: '#38414e',
  ruaBorda: '#212a37',
  caminho: '#323c4b',
  trilho: '#4a5568',
  pais: '#7a8696',
  estado: '#55606e',
  texto: '#9ca5b3',
  textoForte: '#d59563',
  halo: '#17263c',
  textoAgua: '#515c6d',
  textoParque: '#6b9a76',
}

// Camadas que fogem do visual chapado do Google (relevo sombreado, prédios
// 3D, hachuras).
const REMOVER = new Set(['natural_earth', 'building-3d', 'road_area_pattern', 'park_outline'])

const NOME_PT = ['coalesce', ['get', 'name:pt'], ['get', 'name:latin'], ['get', 'name']]

function corDaVia(id: string, p: Paleta): string | undefined {
  const contorno = id.includes('casing')
  if (id.includes('rail')) return p.trilho
  if (id.includes('path_pedestrian')) return contorno ? p.ruaBorda : p.caminho
  if (id.includes('motorway')) return contorno ? p.autoestradaBorda : p.autoestrada
  if (id.includes('trunk_primary')) return contorno ? p.troncoBorda : p.tronco
  if (id.includes('secondary_tertiary')) return contorno ? p.principalBorda : p.principal
  if (/minor|street|link|service_track/.test(id)) return contorno ? p.ruaBorda : p.rua
  return undefined
}

function corDoPreenchimento(id: string, p: Paleta): string | undefined {
  if (id === 'water') return p.agua
  if (id === 'park' || id === 'landcover_grass' || id === 'landuse_pitch' || id === 'landuse_cemetery' || id === 'landuse_track') return p.parque
  if (id === 'landcover_wood' || id === 'landcover_wetland') return p.mata
  if (id === 'landcover_sand') return p.areia
  if (id === 'landcover_ice') return p.gelo
  if (id === 'landuse_hospital') return p.hospital
  if (id === 'landuse_residential' || id === 'landuse_school') return p.urbano
  if (id === 'aeroway_fill') return p.aeroporto
  return undefined
}

function corDoTexto(id: string, p: Paleta): string {
  if (id.startsWith('water') || id === 'waterway_line_label') return p.textoAgua
  if (id.startsWith('label_city') || id.startsWith('label_country') || id === 'label_town') return p.textoForte
  return p.texto
}

function aplicarPaleta(estilo: any, p: Paleta) {
  estilo.layers = (estilo.layers as any[])
    .filter((l) => !REMOVER.has(l.id))
    .map((original) => {
      const l = { ...original, paint: { ...(original.paint ?? {}) }, layout: { ...(original.layout ?? {}) } }
      const id: string = l.id
      // Longe, o terreno é verde-menta; de perto vira o cinza da cidade e o verde
      // fica só para campos e mata (camada "campos", acrescentada abaixo).
      if (l.type === 'background') l.paint['background-color'] = ['interpolate', ['linear'], ['zoom'], 9, p.terra, 11, p.urbano]
      else if (l.type === 'fill') {
        if (id === 'building') {
          l.paint['fill-color'] = p.predio
          l.paint['fill-outline-color'] = p.predioBorda
          // Prédios aparecem a partir do zoom de rua, como no Google.
          delete l.maxzoom
        } else {
          const cor = corDoPreenchimento(id, p)
          if (cor) {
            delete l.paint['fill-pattern']
            delete l.paint['fill-outline-color']
            l.paint['fill-color'] = cor
            // Parques e reservas suaves no zoom de país, como no Google.
            l.paint['fill-opacity'] = id === 'park' ? ['interpolate', ['linear'], ['zoom'], 4, 0.45, 10, 1] : 1
            // A mancha urbana fica visível em todos os zooms (no liberty some no 12).
            if (id === 'landuse_residential') delete l.maxzoom
          }
        }
      } else if (l.type === 'line') {
        if (id.startsWith('waterway')) l.paint['line-color'] = p.agua
        else if (id === 'boundary_2' || id === 'boundary_disputed') l.paint['line-color'] = p.pais
        else if (id === 'boundary_3') l.paint['line-color'] = p.estado
        else if (id === 'aeroway_runway' || id === 'aeroway_taxiway') l.paint['line-color'] = p.principalBorda
        else {
          const cor = corDaVia(id, p)
          if (cor) l.paint['line-color'] = cor
        }
      } else if (l.type === 'symbol' && l.layout['text-field']) {
        // Escudos de rodovia (BR-050) usam o número da via; o resto, o nome em português.
        if (!id.includes('shield')) {
          l.layout['text-field'] = NOME_PT
          l.paint['text-color'] = corDoTexto(id, p)
          l.paint['text-halo-color'] = p.halo
          l.paint['text-halo-width'] = 1.5
          // Bairros em maiúsculas espaçadas, como no Google.
          if (id === 'label_other' || id === 'label_village') {
            l.layout['text-transform'] = 'uppercase'
            l.layout['text-letter-spacing'] = 0.08
            l.paint['text-color'] = p.texto
          }
        }
      }
      return l
    })
  // Campos, pastos e plantações em verde (o liberty não desenha), logo acima do fundo.
  const fundo = estilo.layers.findIndex((l: any) => l.type === 'background')
  estilo.layers.splice(fundo + 1, 0, {
    id: 'campos',
    type: 'fill',
    source: 'openmaptiles',
    'source-layer': 'landcover',
    minzoom: 9,
    filter: ['match', ['get', 'class'], ['farmland', 'grass', 'wood', 'wetland', 'scrub'], true, false],
    paint: { 'fill-color': p.terra, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0, 11, 1] },
  })
  return estilo
}

let estiloBase: Promise<any> | null = null

export async function estiloGoogle(escuro: boolean): Promise<any> {
  estiloBase ??= fetch(ESTILO_BASE).then((r) => {
    if (!r.ok) throw new Error('Estilo do mapa indisponível.')
    return r.json()
  })
  try {
    // Cada chamada recebe uma cópia: o MapLibre pode alterar o objeto.
    return aplicarPaleta(structuredClone(await estiloBase), escuro ? ESCURO : CLARO)
  } catch (e) {
    estiloBase = null
    throw e
  }
}
