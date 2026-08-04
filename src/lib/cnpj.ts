export function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14)
  if (digits.length > 12) return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})$/, '$1.$2.$3/$4-$5')
  if (digits.length > 8) return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{1,4})$/, '$1.$2.$3/$4')
  if (digits.length > 5) return digits.replace(/^(\d{2})(\d{3})(\d{1,3})$/, '$1.$2.$3')
  if (digits.length > 2) return digits.replace(/^(\d{2})(\d{1,3})$/, '$1.$2')
  return digits
}

export interface CnpjInfo {
  nome: string
  endereco: string
  telefone: string
}

function formatCep(cep: string) {
  const digits = cep.replace(/\D/g, '')
  return digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : cep
}

function formatTelefone(tel: string | null | undefined) {
  if (!tel) return ''
  const digits = tel.replace(/\D/g, '')
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  return tel
}

export async function buscarCnpj(cnpjDigits: string): Promise<CnpjInfo> {
  const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjDigits}`)
  if (!res.ok) throw new Error('CNPJ não encontrado.')
  const data = await res.json()

  const endereco = [
    [data.logradouro, data.numero].filter(Boolean).join(', '),
    data.complemento,
    data.bairro,
    [data.municipio, data.uf].filter(Boolean).join(' - '),
    data.cep ? `CEP ${formatCep(data.cep)}` : null,
  ]
    .filter(Boolean)
    .join(' - ')

  return {
    nome: data.razao_social || data.nome_fantasia || '',
    endereco,
    telefone: formatTelefone(data.ddd_telefone_1),
  }
}
