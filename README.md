# Gvel Diesel — Center Truck

Sistema de gestão de pátio: checklist de vistoria (com geração e compartilhamento de PDF) e controle de entrada/saída de veículos, com dashboard. PWA instalável, tema escuro com a identidade visual da Gvel Diesel.

## Stack

- **Frontend**: React + Vite + TypeScript, React Router, Tailwind CSS, Recharts, jsPDF + html2canvas, react-hook-form + zod, react-signature-canvas, vite-plugin-pwa.
- **Backend**: Node + Express + TypeScript (pasta `server/`), MongoDB (Atlas) via driver oficial, autenticação própria com JWT, fotos/assinaturas guardadas no MongoDB via GridFS.

## Configuração inicial

### 1. Criar o cluster MongoDB

1. Crie um cluster gratuito em [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Crie um usuário de banco e copie a connection string (`mongodb+srv://usuario:senha@seu-cluster.mongodb.net`).
3. Libere o acesso de rede (em **Network Access**, adicione seu IP ou `0.0.0.0/0` para desenvolvimento).

### 2. Backend (`server/`)

```bash
cd server
npm install
cp .env.example .env
```

Preencha o `server/.env`:

```bash
MONGODB_URI="mongodb+srv://usuario:senha@seu-cluster.mongodb.net"
JWT_SECRET="uma-string-aleatoria-longa"
PORT=4000
CORS_ORIGIN=http://localhost:5173
```

Rode o seed (cria os índices, semeia marcas comuns e um usuário admin inicial):

```bash
npm run seed
```

Isso imprime as credenciais do usuário admin criado (e-mail `admin@gvel.com`) — troque a senha depois de logar, ou crie outro usuário pela tela de Usuários.

Suba a API:

```bash
npm run dev
```

### 3. Frontend

Na raiz do projeto:

```bash
npm install
cp .env.example .env
```

Preencha o `.env` da raiz:

```bash
VITE_API_URL=http://localhost:4000/api
```

Rode em desenvolvimento:

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
- `src/lib/api.ts` — cliente HTTP fino sobre `fetch`, injeta o token JWT e fala com o backend.
- `src/hooks` — acesso a dados (via `src/lib/api.ts`) por entidade.
- `server/src/routes` — rotas REST da API (uma por entidade).
- `server/src/lib/relations.ts` — pipelines de agregação Mongo que resolvem as relações (equivalente aos `select` aninhados do PostgREST).
- `server/src/scripts/seed.ts` — cria índices e semeia dados iniciais (marcas comuns + usuário admin).

## Identidade visual

As cores da marca estão centralizadas em `tailwind.config.js` (`background`, `surface`, `primary`, `secondary`, `status.*`) e na paleta de gráficos validada em `src/lib/chartColors.ts`.
