# Estrutura GV — Sistema de gestão do Grupo GVEL

Sistema web + app Android (Capacitor) usado pela GVEL Diesel para controlar pátio, manutenção, frota, consumo de combustível, estoque de ferramentas e insumos, financeiro e RH. É multiempresa: cada empresa do grupo enxerga só os próprios dados.

A documentação detalhada fica em [`docs/`](docs/README.md).

## Stack

React 19 + Vite + TypeScript, React Router, Tailwind CSS, Supabase (Postgres + Auth + Storage + Realtime + Edge Functions), Recharts, jsPDF + html2canvas, pdfjs-dist, react-hook-form + zod, Capacitor 8 (Android/iOS). Deploy web na Vercel.

## Rodar localmente

```bash
npm install
cp .env.example .env   # preencher VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev
```

Sem `.env` preenchido o app entra num modo de login local de teste (`admin@gvel.com` / `admin`) — ver `src/contexts/AuthContext.tsx`.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (Vite) |
| `npm run build` | **Type-check real** (`tsc -b`) + build de produção em `dist/`. `tsc --noEmit` não checa nada neste repo — use o build. |
| `npm test` | Testes (`node --test`) — domínio do consumo, leitura de comprovante, troca de tambores |
| `npm run lint` | oxlint |
| `npm run build:apk` | Build + `cap sync android` |
| `npm run apk:debug` | Gera o APK de debug via Gradle (caminhos de JDK/SDK fixos da máquina do Ricardo) |
| `npm run build:ios` | Build + `cap sync ios` |

## Banco de dados (Supabase)

- Projeto: **Gvel Inventario** (`njuncnhzkiajtcnemblx`).
- Schema em `supabase/migrations/` (0001 → 0090), aplicado **em ordem** pelo SQL Editor do painel. Mapa das tabelas em [docs/banco-de-dados.md](docs/banco-de-dados.md).
- Edge Functions em `supabase/functions/`: `create-usuario`, `delete-usuario`, `reset-senha`, `ler-cupom-abastecimento`. Deploy: `supabase functions deploy <nome>` (precisa de `supabase login`).

## Deploy

- **Web:** Vercel, build do Vite. `vercel.json` reescreve todas as rotas para `index.html` (SPA).
- **App Android:** `npm run apk:debug`; o APK sai em `android/app/build/outputs/apk/debug/`. App id `com.gvel.entradaesaida`, nome "Estrutura - GV". O apk é **só da GVEL** — não deve conectar em outras empresas do multiempresa.

## Onde está cada coisa

| Pasta | Conteúdo |
|---|---|
| `src/pages` | Uma tela por rota (as maiores: `Frotas.tsx`, `InventarioFerramentas.tsx`, `Financeiro.tsx`, `RH.tsx`) |
| `src/pages/frotas/consumo` | Módulo de consumo de combustível (domínio testado em `dominio.ts`) |
| `src/pages/inspecao` | Wizard de vistoria e de liberação do veículo |
| `src/pages/configuracoes` | Abas de Configurações (empresas, usuários, pátios, frota...) |
| `src/pages/publico` | Páginas públicas por link (frota do cliente) |
| `src/hooks` | Acesso a dados por entidade (Supabase ou planilha Google) |
| `src/contexts` | Auth, empresa ativa, notificações, tema |
| `src/lib` | Utilitários: permissões, PDF, fotos, parsers (OFX, PDF de faltas, Excel) |
| `src/components/layout` | Menu lateral, barra inferior do app, cabeçalho, regras de menu (`nav.ts`) |
| `src/data` | Dados fixos em código: checklist, catálogo padrão de ferramentas, frota oficial |
| `supabase/` | Migrations e Edge Functions |
| `android/`, `ios/` | Projetos nativos do Capacitor |

## Identidade visual

Cores centralizadas em `tailwind.config.js` e na paleta de gráficos `src/lib/chartColors.ts`. Cada empresa pode ter cor e logo próprios (tabela `companies`), aplicados em tempo de execução pelo `EmpresaContext`.
