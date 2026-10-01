// Extrai dados de abastecimento do texto de um comprovante em PDF
// (comprovante Pix/boleto do banco ou cupom/NFC-e do posto). Só devolve o
// que está escrito no documento — campo ausente fica undefined, nunca
// estimado. Código puro (sem pdfjs) pra rodar nos testes com `node --test`.

export interface DadosComprovante {
  placa?: string
  valorTotal?: number
  dataHora?: Date
  postoNome?: string
  postoCnpj?: string
  litros?: number
  valorLitro?: number
  combustivel?: string
  /** ID da transação / chave de acesso — vai pra observação, rastreável. */
  identificador?: string
  /** Só na leitura por foto: KM/motorista escritos no cupom e o que conferir. */
  odometro?: number
  motorista?: string
  observacao?: string
  /** Tipo reconhecido, só pra mensagem na tela. */
  tipo: 'pix' | 'cupom' | 'foto' | 'desconhecido'
}

const RE_PLACA = /\b([A-Z]{3})-?(\d[A-Z0-9]\d{2})\b/

function numeroBR(s: string): number | undefined {
  const n = Number(s.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : undefined
}

function dataHoraBR(data: string, hora?: string): Date | undefined {
  const m = data.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (!m) return undefined
  const [h, min, seg] = (hora ?? '12:00').split(':').map(Number)
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), h, min, seg || 0)
  return Number.isNaN(d.getTime()) ? undefined : d
}

export function extrairDadosComprovante(texto: string): DadosComprovante {
  const t = texto.replace(/\r/g, '')
  const linhas = t.split('\n').map((l) => l.trim()).filter(Boolean)
  const linhaCom = (re: RegExp) => linhas.find((l) => re.test(l))
  const tipo: DadosComprovante['tipo'] = /pix/i.test(t)
    ? 'pix'
    : /nfc-?e|cupom fiscal|documento auxiliar/i.test(t)
      ? 'cupom'
      : 'desconhecido'

  // Placa: preferir a linha que fala "placa"; senão a primeira no texto.
  const placaMatch = (linhaCom(/placa/i) ?? '').toUpperCase().match(RE_PLACA) ?? t.toUpperCase().match(RE_PLACA)
  const placa = placaMatch ? `${placaMatch[1]}${placaMatch[2]}` : undefined

  // Valor: "Valor: R$ 4.964,44" / "Valor total R$ ..." / "Valor a pagar ..."
  const valorMatch =
    t.match(/valor(?:\s+total|\s+a\s+pagar|\s+pago)?\s*:?\s*R\$\s*([\d.]+,\d{2})/i) ?? t.match(/R\$\s*([\d.]+,\d{2})/)
  const valorTotal = valorMatch ? numeroBR(valorMatch[1]) : undefined

  // Data/hora da operação (não a de emissão do comprovante).
  const dataMatch =
    t.match(/(?:realizad[oa]\s+em|data\s+(?:do\s+)?pagamento|data\s+de\s+emiss[ãa]o|emiss[ãa]o)\s*:?\s*(\d{2}\/\d{2}\/\d{4})\s*(?:-|às|as)?\s*(\d{2}:\d{2}(?::\d{2})?)?/i) ??
    t.match(/(\d{2}\/\d{2}\/\d{4})\s*(?:-|às|as)?\s*(\d{2}:\d{2}(?::\d{2})?)?/)
  const dataHora = dataMatch ? dataHoraBR(dataMatch[1], dataMatch[2]) : undefined

  // Posto: destinatário do Pix; num cupom, o emitente (primeira linha com CNPJ).
  const nomeDest = t.match(/nome\s+do\s+(?:destinat[áa]rio|favorecido|recebedor)\s*:\s*(.+)/i)?.[1]
  const cnpjDest = t.match(/CNPJ\s+do\s+(?:destinat[áa]rio|favorecido|recebedor)\s*:\s*([\d./-]{14,18})/i)?.[1]
  let postoNome = nomeDest?.trim().replace(/\.$/, '')
  let postoCnpj = cnpjDest
  if (!postoCnpj && tipo === 'cupom') {
    const idx = linhas.findIndex((l) => /CNPJ/i.test(l))
    postoCnpj = linhas[idx]?.match(/[\d./-]{14,18}/)?.[0]
    if (!postoNome && idx > 0) postoNome = linhas[idx - 1]
  }

  // Cupom de posto: litros, preço unitário e produto, quando existirem.
  const litrosMatch = t.match(/([\d.]+,\d{1,3})\s*(?:L|LT|LTS|LITROS)\b/i) ?? t.match(/qtde?\.?\s*:?\s*([\d.]+,\d{1,3})/i)
  const litros = litrosMatch ? numeroBR(litrosMatch[1]) : undefined
  const unitMatch = t.match(/(?:v(?:a)?l(?:or)?\.?\s*unit(?:[áa]rio)?\.?|pre[çc]o\s*\/?\s*l(?:itro)?)\s*:?\s*(?:R\$\s*)?([\d.]+,\d{2,3})/i)
  const valorLitro = unitMatch ? numeroBR(unitMatch[1]) : undefined
  const combustivel = /arla/i.test(t)
    ? 'ARLA 32'
    : /s-?500/i.test(t)
      ? 'DIESEL S500'
      : /s-?10\b/i.test(t)
        ? 'DIESEL S10'
        : undefined

  const identificador =
    t.match(/ID\s+da\s+transa[çc][ãa]o\s*:\s*(\S+)/i)?.[1] ?? t.match(/chave\s+de\s+acesso\s*:?\s*([\d ]{44,60})/i)?.[1]?.replace(/\s/g, '')

  return { placa, valorTotal, dataHora, postoNome, postoCnpj, litros, valorLitro, combustivel, identificador, tipo }
}

export const soDigitos = (s: string | undefined) => (s ?? '').replace(/\D/g, '')
