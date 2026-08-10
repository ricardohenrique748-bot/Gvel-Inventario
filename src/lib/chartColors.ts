// Paleta de gráficos — validada com scripts/validate_palette.js (skill dataviz)
// contra a superfície dos cards, tanto no modo claro (#ffffff) quanto no escuro
// (#1c1c1c). Ordem fixa: não embaralhar (a ordem é o que garante a distinção
// sob daltonismo).
export const CHART_ENTRADA = '#3987e5'
export const CHART_SAIDA = '#E23B2E' // = primary da marca (Gvel Diesel)

export const CHART_CATEGORICAL = [
  '#3987e5', // azul
  '#d95926', // laranja
  '#199e70', // aqua
  '#9085e9', // violeta
  '#d55181', // magenta
] as const

export const CHART_OTHER = '#6b6b6b' // bucket "Outras" — neutro, fora da paleta categórica

export const CHART_CHROME = {
  grid: '#333333',
  axis: '#9A9A9A',
  tooltipBg: '#1c1c1c',
  tooltipBorder: 'rgba(255,255,255,0.1)',
}
