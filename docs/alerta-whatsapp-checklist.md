# Alerta no WhatsApp — checklist diário da Rodocaçamba

Todo dia às 18h (Brasília) o sistema confere quais cavalos da Rodocaçamba
ficaram **sem checklist** no dia e manda a lista no WhatsApp. Se todos fizeram,
não manda nada. Veículo marcado como inoperante não entra na conta.

Placas conferidas: GDT0H04, CUL2E24, GDT0I03, EDJ8C00, FXM9D74, GDT0I01,
GDT0I02 e ERA9G01. Essa lista fica em `PLACAS_PADRAO`, no código da função. Para
trocar sem publicar a função de novo, grave o segredo `CHECKLIST_PLACAS` com as
placas separadas por vírgula. Quando esse segredo existe, ele substitui a lista
do código.

- Função: `supabase/functions/alerta-checklist-rodocacamba/index.ts`
- Agendamento: `supabase/scripts/agendar_alerta_checklist_rodocacamba.sql` (pg_cron)
- Lista oficial da frota usada pela função: `supabase/functions/_shared/frotaOficial.json`
  (gerada por `node scripts/gerar-frota-oficial-edge.mjs` — rode de novo e
  republique a função sempre que mexer em `src/data/veiculosFrotaPadrao.ts`).
- Envio: API oficial da Meta (WhatsApp Cloud API).

Exemplo de mensagem:

> 🚛 Checklist diário da Rodocaçamba – 10/11/2026
> 3 veículo(s) operante(s) ficaram sem checklist hoje:
> DEE2C60 (JOÃO) · FXY1A23 · GHI4B56 (PEDRO)

## 1. Configurar na Meta (uma vez)

1. Em <https://business.facebook.com>, crie ou use o **Meta Business** da empresa
   e conclua a **verificação da empresa** (CNPJ).
2. Em <https://developers.facebook.com/apps>, crie um app do tipo **Business** e
   adicione o produto **WhatsApp**.
3. Em **WhatsApp → Configuração da API**, adicione o número **remetente**. Ele
   não pode estar em uso no WhatsApp do celular, então use um chip só para isso.
   Anote o **Phone number ID**.
4. Em **Configurações do negócio → Usuários do sistema**, crie um usuário do
   sistema (Admin), dê acesso ao app e à conta do WhatsApp e gere um **token
   permanente** com as permissões `whatsapp_business_messaging` e
   `whatsapp_business_management`.
5. No **WhatsApp Manager → Modelos de mensagem**, crie o modelo:
   - Nome: `checklist_rodocacamba_pendente`
   - Categoria: **Utilidade**
   - Idioma: **Português (BR)**
   - Corpo:
     ```
     🚛 Checklist diário da Rodocaçamba – {{1}}
     {{2}} veículo(s) operante(s) ficaram sem checklist hoje:
     {{3}}
     ```
   - Exemplos para a aprovação: `10/11/2026`, `2`, `DEE2C60 (JOÃO) · FXY1A23`

   Espere o modelo ser **aprovado**. Costuma levar de minutos a algumas horas.

## 2. Publicar a função no Supabase

Com a [Supabase CLI](https://supabase.com/docs/guides/cli) logada no projeto:

```sh
node scripts/gerar-frota-oficial-edge.mjs

npx supabase secrets set \
  WHATSAPP_TOKEN="token-permanente" \
  WHATSAPP_PHONE_NUMBER_ID="phone-number-id" \
  WHATSAPP_DESTINOS="5519999999999" \
  ALERTA_CRON_SECRET="uma-senha-longa-qualquer"

npx supabase functions deploy alerta-checklist-rodocacamba --no-verify-jwt
```

- `WHATSAPP_DESTINOS`: quem recebe, com DDI 55 e DDD, sem espaços. Para mais de
  um número, separe por vírgula: `5519999999999,5519988887777`.
- `--no-verify-jwt`: quem chama é o agendador, não um usuário logado. A função
  só responde se receber a `ALERTA_CRON_SECRET` no cabeçalho `x-cron-secret`.

## 3. Testar

Só calcula a lista, sem mandar mensagem:

```sh
curl "https://SEU-PROJETO.supabase.co/functions/v1/alerta-checklist-rodocacamba?simular=1" \
  -H "x-cron-secret: uma-senha-longa-qualquer"
```

Sem o `simular=1`, manda a mensagem de verdade. Com `&data=2026-11-10`, confere
outro dia.

## 4. Agendar

Abra `supabase/scripts/agendar_alerta_checklist_rodocacamba.sql`, troque
`SEU-PROJETO` e `SUA-SENHA` e rode no SQL Editor. O horário e como desligar o
alerta estão explicados no próprio arquivo.
