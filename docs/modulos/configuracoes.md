# Configurações

`src/pages/Configuracoes.tsx` com as abas em `src/pages/configuracoes/` (`/configuracoes?tab=...`). Empresas, Clientes e Usuários nunca são escondidos pela restrição de módulos da empresa.

| Aba (`tab`) | Arquivo | O que faz |
|---|---|---|
| `empresas` | `EmpresasTab.tsx` | Cadastro de empresas (nome, CNPJ, logo, cor, módulos habilitados, campos estendidos do financeiro). |
| `clientes` | `ClientesTab.tsx` | Clientes e link público da frota |
| `frota` | `FrotaTab.tsx` | Marcas, modelos e veículos |
| `patios` | `PatiosTab.tsx` | Pátios/setores: criar, renomear, **mesclar** duplicados, excluir (excluir só admin) |
| `usuarios` | `UsuariosTab.tsx` | Contas, senha (Edge Functions), nível e permissões por módulo/sub-aba |
| `notificacoes` | `NotificacoesTab.tsx` | Preferências de alertas e som |

## Usuários e permissões

- Criar usuário chama a Edge Function `create-usuario`. O usuário nasce com `deve_trocar_senha` e é obrigado a trocar a senha no primeiro login (`/trocar-senha`).
- Os checkboxes de módulo gravam em `usuarios.modulos`. Marcar uma sub-aba mantém o módulo pai junto; ver as regras em [arquitetura.md](../arquitetura.md#login-e-permissões).
- Resetar senha chama `reset-senha` (padrão `123456`).

## Empresas

- `modulos_habilitados` vazio libera tudo para a empresa.
- `status`: `active` ou `inactive`.
- O master admin troca de empresa pelo seletor do cabeçalho/menu lateral (`Header.tsx`, `Sidebar.tsx`), não por esta aba.
- Logo e cor da empresa são aplicados na interface pelo `EmpresaContext`. A GVEL usa a marca padrão (`src/components/ui/Logo.tsx`).
