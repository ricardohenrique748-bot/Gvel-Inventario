# Arquitetura

## Visão geral

SPA em React (Vite) que fala direto com o Supabase pelo `supabase-js` (`src/lib/supabase.ts`) — não existe backend próprio. As regras de segurança ficam no banco (RLS e triggers). Lógica que precisa de chave privilegiada ou de IA roda em Edge Functions.

O mesmo build roda na web (Vercel) e dentro do app Android/iOS (Capacitor, `webDir: dist`). `src/lib/isNativeApp.ts` diz se está no app nativo; algumas telas mudam de comportamento por isso (menu inferior, splash, notificações push).

Todas as telas são carregadas sob demanda (`lazy` em `src/App.tsx`) e pré-baixadas em segundo plano quando o navegador fica ocioso (`PRE_CARREGAR_TELAS`).

## Rotas

| Rota | Tela |
|---|---|
| `/login`, `/trocar-senha` | Login e troca obrigatória de senha (`usuarios.deve_trocar_senha`) |
| `/` | Dashboard do pátio (`HomeRedirect` manda para outro módulo se a empresa não usa pátio) |
| `/movimentacoes`, `/movimentacoes/nova` | Lista e registro de entrada/saída |
| `/veiculos/:id`, `/clientes`, `/clientes/:id` | Detalhes |
| `/manutencao` | Controle de O.S e Liberação (`?secao=liberacao`) |
| `/frotas` | Gestão de Frotas (`?aba=veiculos|checklist|viagens|consumo`) |
| `/inventario-ferramentas` | Estoque (`?aba=...`) |
| `/inventario-caminhoes` | Atalho do módulo de pátio |
| `/dashboard-gerencial`, `/controle-horas` | Gestão |
| `/kanban`, `/kanban-vamos` | Kanbans alimentados por planilha |
| `/financeiro`, `/rh`, `/relatorios` | Módulos de gestão |
| `/inspecoes/nova` | Wizard de vistoria |
| `/configuracoes` | Configurações (`?tab=...`) |
| `/publico/frota/:token[/veiculo/:id]` | **Pública, sem login** — frota de um cliente por link |

## Multiempresa

Introduzido nas migrations 0072–0078.

- Tabela `companies` (nome, CNPJ, logo, cor, `modulos_habilitados`, `status`).
- Cada usuário pertence a uma empresa: `usuarios.company_id`.
- Toda tabela de negócio tem `company_id`, preenchido automaticamente pelo trigger `stamp_company_id`. O RLS filtra sempre por `company_id = current_company_id()`.
- `marcas` e `modelos` são compartilhadas entre empresas, de propósito (catálogo genérico de caminhões).
- **Master admin** (`usuarios.is_master_admin`, protegido pelo trigger `protect_is_master_admin`) pode "entrar" em outra empresa pelo seletor. Isso **muda o `company_id` do próprio usuário** — não é uma visualização paralela. Desde a 0077 nem o master admin vê dados de duas empresas ao mesmo tempo.
- `companies.modulos_habilitados = null` libera todos os módulos para a empresa. Preenchido, só os módulos listados aparecem no menu (`temAcessoModuloEmpresa` em `src/lib/permissoes.ts`). Configurações (empresas, clientes, usuários) nunca é escondido.
- Uploads no Storage são prefixados com o id da empresa (`src/lib/tenant.ts`). Isso é só organização; a segurança é o RLS do Storage (0074).
- O id da GVEL (`0923c894-85ca-45c1-ba1b-3124d19b4d65`) está fixo em `Financeiro.tsx`, `RH.tsx` e `components/ui/Logo.tsx` para liberar telas exclusivas da GVEL (Visão Geral do financeiro, Turnover) e a marca padrão.
- **O apk é só da GVEL.** Não pode conectar em outras empresas (ex.: Pedrão Tacógrafos). Não há trava específica no código para isso: o isolamento hoje depende de quem faz login no app.

## Login e permissões

- Login pelo Supabase Auth. O trigger `handle_new_auth_user` cria o registro em `usuarios` com a empresa certa.
- Criar, excluir e resetar senha de usuários passa pelas Edge Functions `create-usuario`, `delete-usuario` e `reset-senha` (precisam da service key).
- **Admin**: `usuarios.nivel = 'admin'`, ou uma das contas donas fixas no código: `victor@gveldiesel.com` e `ricardo_h.16@hotmail.com` (`isAdminUsuario`). Admin vê todos os módulos e é o único que pode excluir na maioria das telas.
- **Permissão por módulo**: `usuarios.modulos` (array de ids). A lista de módulos e sub-abas está em `MODULOS_SISTEMA` (`src/lib/permissoes.ts`); o menu usa os `is*Authorized` de `src/components/layout/nav.ts`.
  - Se o usuário tem o módulo pai e **nenhum** filho marcado, vê todas as sub-abas (permissão antiga). Com pelo menos um filho marcado, vale só o que está marcado.
  - Usuário sem módulos salvos não vê nada.
  - Um item só aparece no menu se a **empresa** e o **usuário** liberarem.
- **Regras fixas por e-mail** (fora da tela de permissões):

| E-mail | Regra | Onde |
|---|---|---|
| `inventario@gveldiesel.com` | Edita/exclui no estoque e nas movimentações sem ser admin; no app sempre tem Estoque | `InventarioFerramentas.tsx`, `Movimentacoes.tsx`, `nav.ts` |
| `rh@gveldiesel.com` | Vê a aba Hora Extra do RH (dado salarial; não é liberável por checkbox) | `RH.tsx` |
| `mariaclara@gveldiesel.com` | Única aprovadora da Liberação do Veículo (travado também no banco, 0086) | `src/pages/inspecao/types.ts` |
| `junior@`, `mariaclara@` | Conjunto de módulos legado, usado se não tiverem `modulos` salvos | `getModulosUsuario` |

## Fontes de dados

1. **Supabase** — a maioria dos módulos (hooks em `src/hooks`).
2. **Planilhas Google publicadas como CSV** — lidas direto pelo navegador e guardadas em `localStorage` como cache:
   - `useKanbanSheet` (Kanban Localiza), `useVamosSheet` (Kanban Vamos)
   - `useRhSheet` (planilha do RH), `useAtestadosSheet`, `useHoraExtraSheet`
   Para trocar uma planilha, altere o id/URL no topo do hook.
3. **Dados fixos em código** (`src/data`): checklist de vistoria, catálogo padrão de ferramentas, lista oficial da frota (`veiculosFrotaPadrao.ts`, com ajustes em `veiculos_frota`). O Financeiro também tem os meses base em `DADOS_MESES` (`Financeiro.tsx`), sobrescritos pelo que for importado em `painel_gerencial_divisoes`.
4. **`localStorage`** — além dos caches de planilha, guarda rascunhos (entrada de veículo), fila offline de abastecimentos (`frotas/consumo/filaOffline.ts`) e partes do estoque. Não é compartilhado entre aparelhos.

## Tempo real e notificações

- Realtime do Supabase em `movimentacoes` (0038) e no checklist de O.S (`useChecklistOS`) para sincronizar app e web.
- `NotificacoesContext` observa movimentações, O.S e checklists da frota e gera avisos (com som, configurável em Configurações → Notificações).
- Push no app: `src/lib/pushNotifications.ts` + plugins `@capacitor/push-notifications` e `local-notifications`.

## Tarefas automáticas no banco (pg_cron)

- **18h (Brasília)** — pausa toda atividade do checklist de O.S em andamento (0050).
- **08h** — retoma as pausadas, somando o tempo parado em `minutos_pausados` (0051). A noite não conta como hora trabalhada no Controle de Horas.

## Edge Functions

| Função | Uso |
|---|---|
| `create-usuario` | Cria login (Auth) + registro em `usuarios` |
| `delete-usuario` | Exclui login + registro (só admin) |
| `reset-senha` | Admin redefine a senha de um usuário (padrão `123456` se nenhuma for informada); usuário de outra empresa só por master admin |
| `ler-cupom-abastecimento` | Lê foto de cupom de posto com a API da Anthropic (Claude) e devolve litros, valor, combustível, odômetro. Precisa do segredo da API configurado na função. |

## Arquivos (Storage)

Dois buckets (criados na 0001, nomes em `src/lib/supabase.ts`): `fotos-inspecao` (todas as fotos — entrada do veículo, vistorias, ferramentas, checklists, comprovantes) e `assinaturas`. Helpers de upload e compressão: `src/lib/fotos.ts`, `src/lib/imagem.ts`, `src/lib/thumb.ts`, `src/lib/frotasStorage.ts`.

## PDFs e importações

- PDFs gerados no navegador: `src/lib/pdf.ts` (jsPDF + html2canvas), compartilhados por `src/lib/share.ts` (Web Share/WhatsApp, ou download).
- Importações: extrato OFX (`ofxParser.ts`), Excel do fluxo de caixa (`importarFluxoCaixaExcel.ts`), Excel do painel gerencial (`importarPainelGerencialExcel.ts`), PDF de faltas (`faltasPdfParser.ts`), comprovante de abastecimento em PDF e planilha .xlsx do MoveTruck (pasta do consumo).
