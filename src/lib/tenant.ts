// Empresa do usuário autenticado no momento, mantida em memória pelo
// AuthContext. Usada só para prefixar caminhos de upload no Storage por
// empresa (isolamento de arquivos) — nunca para decisões de segurança:
// a segurança de verdade é sempre o RLS do banco/Storage, que valida a
// empresa lendo `usuarios.company_id` a partir do usuário autenticado, não
// deste valor.
let currentCompanyId: string | null = null

export function setCurrentCompanyId(id: string | null) {
  currentCompanyId = id
}

/** Prefixa um caminho de upload com a empresa atual (ex.: "abc-123/entrada/foto.jpg"). */
export function comPrefixoEmpresa(path: string): string {
  return currentCompanyId ? `${currentCompanyId}/${path}` : path
}
