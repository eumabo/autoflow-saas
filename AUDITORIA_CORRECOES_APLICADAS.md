# Vortan Oficina — correções aplicadas

- Cadastro envia nome e oficina em `user_metadata`, compatível com o trigger atual.
- Primeiro acesso conclui o perfil e ativa o trial uma única vez.
- Financeiro passa a exigir assinatura válida.
- Ações do Admin sincronizam `subscriptions` e `af_profiles`.
- Checkout avulso não grava ID de preferência como se fosse assinatura recorrente.
- Assinatura recorrente cria uma `preapproval` vinculada ao usuário.
- Webhook valida ID do usuário, moeda, valor e recebedor opcional, além de ser idempotente por `payment_id`.
- Webhook reconhece pagamentos, preapprovals e faturas recorrentes.
- Link público da OS retorna somente campos necessários e remove o bloco interno de orçamento das observações.

## Secrets já usados

- `MERCADOPAGO_ACCESS_TOKEN`
- `MERCADOPAGO_PREAPPROVAL_PLAN_ID`

## Secrets opcionais recomendados

- `VORTAN_MONTHLY_PRICE=29.90`
- `MERCADOPAGO_CURRENCY=BRL`
- `MERCADOPAGO_COLLECTOR_ID=<ID do recebedor>`

## Deploy

```powershell
npx supabase functions deploy rapid-action --no-verify-jwt
```

O frontend também precisa ser publicado novamente após o build.
