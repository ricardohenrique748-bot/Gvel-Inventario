export interface MembroEquipe {
  nome: string
  funcao: string
}

export const EQUIPE_GVEL: MembroEquipe[] = [
  { nome: 'DAVID JONATAS DANTAS DOS SANTOS', funcao: 'AJUDANTE GERAL' },
  { nome: 'ELISMAR BATISTA DE ALMEIDA', funcao: 'ELETRICISTA' },
  { nome: 'EVERTON NUNES ROSA FRANCISCO', funcao: 'POLIDOR' },
  { nome: 'GABRIEL HENRIQUE CHAIM FAUSTINO', funcao: 'MECANICO DIESEL' },
  { nome: 'GABRIEL THOMAS MARQUES TEIXEIRA', funcao: 'MONTADOR' },
  { nome: 'GUILHERME BOCALON BUENO', funcao: 'POLIDOR' },
  { nome: 'GUILHERME SILVA SACOMANO', funcao: 'MECANICO DIESEL B' },
  { nome: 'HELIO DE OLIVEIRA MACHADO', funcao: 'PINTOR AUTOMOTIVO' },
  { nome: 'JOAO PAULO MARTINS DAS NEVES', funcao: 'ELETRICISTA' },
  { nome: 'JOAO VITOR DE SOUZA LIMA', funcao: 'POLIDOR' },
  { nome: 'JOAO VITOR MARQUES TEIXEIRA', funcao: 'FUNILEIRO' },
  { nome: 'JOAO VITOR PONTEL MARTINS', funcao: 'AJUDANTE GERAL' },
  { nome: 'JOSE ULISSES RODRIGUES', funcao: 'PINTOR AUTOMOTIVO' },
  { nome: 'KAUA NUNES IRALA CONSTANTE', funcao: 'AJUDANTE GERAL' },
  { nome: 'KAUE CAIRES DE SOUZA', funcao: 'AJUDANTE GERAL' },
  { nome: 'LEONARDO SANTOS NASCIMENTO', funcao: 'POLIDOR' },
  { nome: 'LUIS ANTONIO SILVA E SILVA', funcao: 'FUNILEIRO' },
  { nome: 'LUIS FERNANDO PEREIRA GARCIA', funcao: 'MECANICO B' },
  { nome: 'MAICOM EVERTON PEREIRA FERREIRA', funcao: 'MECANICO A' },
  { nome: 'MATHEUS DIAS DE AGUIAR', funcao: 'MECANICO DIESEL B' },
  { nome: 'MAURICIO INACIO DA SILVA', funcao: 'AUX MECANICO' },
  { nome: 'RIAN ROBSON DA SILVA', funcao: 'AJUDANTE GERAL' },
  { nome: 'WELLINTON DE OLIVEIRA MARQUES', funcao: 'MECANICO A' },
  { nome: 'FELIPE TAVARES NADOTTI', funcao: 'MECANICO DIESEL' },
  { nome: 'JOSE AUGUSTO SATURNINO DE SOUZA', funcao: 'AJUDANTE GERAL' },
  { nome: 'JOSE LINO LEANI', funcao: 'MECANICO DIESEL' },
  { nome: 'RAI MILLER LEMOS DE ASSIS', funcao: 'MECANICO DIESEL' },
  { nome: 'ROBERT ALVES DE FRANCA', funcao: 'AUX MECANICO' },
  { nome: 'CRISTIANO FERREIRA DE OLIVEIRA', funcao: 'TECNICO EM MANUTENCAO' },
  { nome: 'MAGAIVER DE LIMA LOPES', funcao: 'MECANICO DIESEL' },
]

export const FUNCOES_EQUIPE = Array.from(new Set(EQUIPE_GVEL.map((m) => m.funcao))).sort()

// Remove acentos para busca flexível
export function removerAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function buscarFuncaoPorNome(nome: string): string | undefined {
  if (!nome) return undefined
  const norm = removerAcentos(nome.trim().toLowerCase())
  const encontrado = EQUIPE_GVEL.find((m) => {
    const mNorm = removerAcentos(m.nome.toLowerCase())
    return mNorm === norm || norm.includes(mNorm) || mNorm.includes(norm)
  })
  return encontrado?.funcao
}

export function obterNomeCompletoMembro(nome: string): string {
  if (!nome) return ''
  const norm = removerAcentos(nome.trim().toLowerCase())
  
  // Apelidos ou variações comuns
  if (norm === 'maicon') return 'MAICOM EVERTON PEREIRA FERREIRA'
  if (norm === 'chaim') return 'GABRIEL HENRIQUE CHAIM FAUSTINO'
  if (norm === 'pontel') return 'JOAO VITOR PONTEL MARTINS'

  const encontrado = EQUIPE_GVEL.find((m) => {
    const mNorm = removerAcentos(m.nome.toLowerCase())
    if (mNorm === norm) return true
    const partes = mNorm.split(' ')
    return partes.includes(norm) || (norm.length >= 4 && mNorm.includes(norm))
  })
  return encontrado ? encontrado.nome : nome
}

export function formatarNomeSobrenome(nomeCompleto: string): string {
  if (!nomeCompleto) return ''
  const nomeResolvido = obterNomeCompletoMembro(nomeCompleto)
  const partes = nomeResolvido.trim().split(/\s+/).filter(Boolean)
  if (partes.length <= 1) return partes[0] || ''

  const prep = ['DE', 'DA', 'DO', 'DOS', 'DAS', 'E']
  if (prep.includes(partes[1].toUpperCase()) && partes[2]) {
    return `${partes[0]} ${partes[1]} ${partes[2]}`
  }

  return `${partes[0]} ${partes[1]}`
}
