import * as pdfjsLib from 'pdfjs-dist'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

export interface RegistroFaltaExtraido {
  matricula: string
  nome: string
  funcao: string
  cartao: string
  departamento: string
  data: string // ISO yyyy-mm-dd
  observacao: string
}

export interface ResultadoImportacaoFaltas {
  empresa: string | null
  periodoInicio: string | null // ISO
  periodoFim: string | null // ISO
  registros: RegistroFaltaExtraido[]
  erros: string[]
}

interface LinhaItem {
  texto: string
  x: number
  largura: number
}

interface Linha {
  y: number
  itens: LinhaItem[]
  texto: string // itens concatenados com espaço, na ordem de x — só para casar regex de rótulo
}

function dataBrParaIso(dataBr: string): string | null {
  const m = dataBr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  const [, dia, mes, ano] = m
  return `${ano}-${mes}-${dia}`
}

// Agrupa os itens de texto da página em "linhas visuais" (mesma coordenada Y,
// com uma pequena tolerância) e ordena cada linha da esquerda pra direita.
function agruparLinhas(items: TextItem[]): Linha[] {
  const TOLERANCIA_Y = 2.5
  const linhas: Linha[] = []

  for (const item of items) {
    const texto = item.str
    if (!texto || !texto.trim()) continue
    const x = item.transform[4]
    const y = item.transform[5]

    let linha = linhas.find((l) => Math.abs(l.y - y) <= TOLERANCIA_Y)
    if (!linha) {
      linha = { y, itens: [], texto: '' }
      linhas.push(linha)
    }
    linha.itens.push({ texto: texto.trim(), x, largura: item.width })
  }

  // PDF: y cresce de baixo pra cima — ordena de cima pra baixo (y desc).
  linhas.sort((a, b) => b.y - a.y)
  for (const linha of linhas) {
    linha.itens.sort((a, b) => a.x - b.x)
    linha.texto = linha.itens.map((i) => i.texto).join(' ')
  }
  return linhas
}

const RE_TITULO_PERIODO = /per[íi]odo de (\d{2}\/\d{2}\/\d{4})\s*[àa]\s*(\d{2}\/\d{2}\/\d{4})/i
const RE_DEPARTAMENTO = /^Departamento\s*:\s*(.+)$/i
const RE_DATA = /^Data\s*:\s*(\d{2}\/\d{2}\/\d{4})/i
const RE_CABECALHO_TABELA = /^Matr[íi]cula\s+Nome\s+Fun[çc][ãa]o\s+Cart[ãa]o\s+Observa[çc][ãa]o$/i
const RE_RESUMO_LINHA = /funcion[áa]rio\(s\)\s+ausente\(s\)/i
const RE_RODAPE = /PROPWin/i
const RE_MATRICULA_INICIO = /^\d+$/

/**
 * Extrai as faltas de um "Relatório de Ausências" (PROPWin) em PDF.
 *
 * O relatório não tem colunas com delimitador — é texto posicionado. Por
 * isso cada linha da tabela ("Matricula Nome Função Cartão Observação")
 * calibra as fronteiras de coluna usando a posição X de cada uma dessas 5
 * palavras-cabeçalho; as linhas de dado seguintes usam essas fronteiras pra
 * agrupar as palavras de cada célula (evita cortar nomes/funções compostos
 * no meio, já que eles não têm nenhum separador textual entre si).
 */
export async function parseFaltasPdf(file: File): Promise<ResultadoImportacaoFaltas> {
  const buffer = await file.arrayBuffer()
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise

  const registros: RegistroFaltaExtraido[] = []
  const erros: string[] = []

  let empresa: string | null = null
  let periodoInicio: string | null = null
  let periodoFim: string | null = null

  let departamentoAtual = ''
  let dataAtual = ''
  let colunas: number[] | null = null // fronteiras X: [matricula, nome, funcao, cartao, observacao]
  let cabecalhoEncontrado = false

  for (let numPagina = 1; numPagina <= doc.numPages; numPagina++) {
    const page = await doc.getPage(numPagina)
    const content = await page.getTextContent()
    const linhas = agruparLinhas(content.items as TextItem[])

    for (const linha of linhas) {
      const texto = linha.texto.trim()
      if (!texto) continue

      if (!periodoInicio) {
        const mPeriodo = texto.match(RE_TITULO_PERIODO)
        if (mPeriodo) {
          periodoInicio = dataBrParaIso(mPeriodo[1])
          periodoFim = dataBrParaIso(mPeriodo[2])
          continue
        }
      }

      if (RE_CABECALHO_TABELA.test(texto)) {
        cabecalhoEncontrado = true
        if (linha.itens.length >= 5) {
          colunas = linha.itens.slice(0, 5).map((i) => i.x)
        }
        continue
      }

      const mDepto = texto.match(RE_DEPARTAMENTO)
      if (mDepto) {
        departamentoAtual = mDepto[1].trim()
        continue
      }

      const mData = texto.match(RE_DATA)
      if (mData) {
        dataAtual = dataBrParaIso(mData[1]) || ''
        continue
      }

      if (RE_RESUMO_LINHA.test(texto) || RE_RODAPE.test(texto)) continue
      if (!empresa && numPagina === 1 && !texto.toUpperCase().startsWith('RELATÓRIO') && texto === texto.toUpperCase() && texto.length > 3) {
        // Primeira linha em caixa alta da página 1 que não é o título — é o nome da empresa.
        empresa = texto
        continue
      }

      // Linha de dado: só processa se já vimos um cabeçalho de tabela (temos
      // as fronteiras de coluna) e a linha começa com um número (matrícula).
      if (!colunas || linha.itens.length === 0) continue
      if (!RE_MATRICULA_INICIO.test(linha.itens[0].texto)) continue
      if (!dataAtual) continue

      const celulas = ['', '', '', '', '']

      function acrescentar(idx: number, texto: string) {
        if (!texto) return
        celulas[idx] = celulas[idx] ? `${celulas[idx]} ${texto}` : texto
      }

      // Ponto de corte "ideal" pra um texto fundido: a matrícula e o cartão
      // são sempre numéricos, e nome/função/observação são sempre texto —
      // então a fronteira letra<->dígito mais próxima do ponto estimado pela
      // largura é o corte real (exato), muito mais confiável do que a
      // proporção por contagem de caracteres (que erra porque dígito e letra
      // não têm a mesma largura renderizada).
      function pontoDeCorte(texto: string, indiceEstimado: number): number {
        let melhor = indiceEstimado
        let menorDistancia = Infinity
        for (let i = 1; i < texto.length; i++) {
          const anteriorDigito = /\d/.test(texto[i - 1])
          const atualDigito = /\d/.test(texto[i])
          if (anteriorDigito === atualDigito) continue
          if (texto[i - 1] === ' ' || texto[i] === ' ') continue
          const distancia = Math.abs(i - indiceEstimado)
          if (distancia < menorDistancia) {
            menorDistancia = distancia
            melhor = i
          }
        }
        // Só usa a fronteira letra/dígito se ela estiver razoavelmente perto
        // da estimativa por largura — senão pode ser uma fronteira de outra
        // parte do texto que não tem nada a ver com este corte.
        return menorDistancia <= Math.max(6, texto.length * 0.4) ? melhor : indiceEstimado
      }

      // Caso normal: cada célula da tabela chega como seu próprio item de
      // texto (extração fiel às posições do PDF). Mas o extrator do PDF por
      // vezes funde duas células vizinhas num único item sem espaço entre
      // elas — quando isso acontece, o item "vaza" para dentro da largura da
      // coluna seguinte. Detecta esse caso pela largura renderizada e quebra
      // o texto no ponto da fronteira, em vez de perder o conteúdo da coluna
      // seguinte ou vazar dígitos/letras pra célula errada.
      for (const item of linha.itens) {
        let idxColuna = 0
        for (let c = 0; c < colunas!.length; c++) {
          if (item.x >= colunas![c] - 3) idxColuna = c
        }

        let restante = item.texto
        let xAtual = item.x
        let larguraAtual = item.largura
        let coluna = idxColuna

        while (coluna < colunas!.length - 1 && xAtual + larguraAtual > colunas![coluna + 1] + 3 && restante.length > 1) {
          const fracao = (colunas![coluna + 1] - xAtual) / larguraAtual
          const indiceEstimado = Math.max(1, Math.min(restante.length - 1, Math.round(restante.length * fracao)))
          const indiceCorte = pontoDeCorte(restante, indiceEstimado)
          acrescentar(coluna, restante.slice(0, indiceCorte).trim())
          const restoAnterior = restante
          restante = restante.slice(indiceCorte).trim()
          const larguraCortada = larguraAtual * (indiceCorte / restoAnterior.length)
          xAtual = colunas![coluna + 1]
          larguraAtual = Math.max(0, larguraAtual - larguraCortada)
          coluna += 1
        }
        acrescentar(coluna, restante)
      }

      const [matricula, nome, funcao, cartao, observacao] = celulas
      if (!matricula || !nome) continue

      registros.push({
        matricula,
        nome,
        funcao,
        cartao,
        departamento: departamentoAtual,
        data: dataAtual,
        observacao: observacao || 'FALTA',
      })
    }
  }

  if (registros.length === 0) {
    if (cabecalhoEncontrado && !colunas) {
      erros.push('O cabeçalho da tabela foi encontrado, mas não deu pra calibrar as colunas (Matrícula/Nome/Função/Cartão/Observação). Avise para eu ajustar o importador.')
    } else if (!cabecalhoEncontrado) {
      erros.push('Não foi encontrado o cabeçalho "Matricula Nome Função Cartão Observação" no PDF — confira se é o "Relatório de Ausências" do PROPWin.')
    } else {
      erros.push('Nenhum registro de falta encontrado no PDF.')
    }
  }

  return { empresa, periodoInicio, periodoFim, registros, erros }
}
