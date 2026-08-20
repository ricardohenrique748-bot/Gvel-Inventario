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
function removerAcentos(texto: string): string {
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
