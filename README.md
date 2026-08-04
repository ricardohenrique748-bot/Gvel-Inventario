# Gvel Diesel — Center Truck

Sistema de gestão de pátio: checklist de vistoria (com geração e compartilhamento de PDF) e controle de entrada/saída de veículos, com dashboard. PWA instalável, tema escuro com a identidade visual da Gvel Diesel.

## Stack

React + Vite + TypeScript, React Router, Tailwind CSS, Supabase (Postgres + Auth + Storage), Recharts, jsPDF + html2canvas, react-hook-form + zod, react-signature-canvas, vite-plugin-pwa.

## Configuração inicial

### 1. Instalar dependências

```bash
npm install
```

### 2. Criar o projeto Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, rode os arquivos de `supabase/migrations/` **em ordem** (0001 até o mais recente) — juntos eles criam as tabelas, índices, políticas de RLS, os buckets de storage e um seed de marcas comuns.
3. Em **Edge Functions**, publique as duas funções em `supabase/functions/`:
   - `create-usuario` — cria conta de login (Supabase Auth) + registro em `usuarios`.
   - `delete-usuario` — exclui conta de login + registro em `usuarios` (só admins podem chamar).
   (Via `supabase functions deploy create-usuario` / `delete-usuario` com a CLI, ou colando o código na aba Edge Functions do dashboard.)
4. Em **Authentication → Users**, crie o primeiro usuário que vai acessar o sistema (e-mail/senha) — ele também precisa existir na tabela `usuarios` (a migration `0009` promove automaticamente o usuário mais antigo a administrador). Depois disso, novos usuários são criados pela própria tela de Configurações → Usuários do app.

### 3. Configurar variáveis de ambiente

Copie `.env.example` para `.env` e preencha com os dados do seu projeto (em **Project Settings → API**):

```bash
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_ANON_KEY
```

### 4. Rodar em desenvolvimento

```bash
npm run dev
```

> A PWA (manifest + service worker) só é ativada em build de produção. Para testar a instalação no celular/Lighthouse:
> ```bash
> npm run build
> npm run preview
> ```

## Estrutura

- `src/pages` — telas do Módulo 2 (Dashboard, Movimentações, Registrar Entrada, Detalhe do Veículo, Clientes, Relatórios).
- `src/pages/inspecao` — wizard do Módulo 1 (Dados do veículo → Checklist → Assinatura → Resumo/PDF).
- `src/data/checklistSchema.ts` — seções e itens do checklist (editável em código).
- `src/lib/pdf.ts` + `src/pages/inspecao/reportHtml.ts` — geração do relatório de vistoria em PDF.
- `src/lib/share.ts` — compartilhamento do PDF via Web Share API (WhatsApp etc.), com fallback para download.
- `src/hooks` — acesso a dados (Supabase) por entidade.
- `supabase/migrations` — schema do banco.

## Identidade visual

As cores da marca estão centralizadas em `tailwind.config.js` (`background`, `surface`, `primary`, `secondary`, `status.*`) e na paleta de gráficos validada em `src/lib/chartColors.ts`.
