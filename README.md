# Possible Care — Analisador de Crédito

Sistema interno de análise de crédito PF/PJ: extrai dados financeiros de
documentos PDF com IA, calcula um score configurável de 0 a 1000 e gera
relatório em PDF com trilha de auditoria. Inclui CRM leve de clientes com
funil de status.

## Stack

- **Frontend:** React 18 + Vite + TypeScript + Tailwind/shadcn (Lovable)
- **Backend:** Supabase (Postgres + RLS, Auth, Edge Functions)
- **Extração:** edge function `extract-pdf` → Lovable AI Gateway
  (Gemini 2.5 Flash); PDFs viram imagens no browser via PDF.js

## Fluxos principais

- `/analise/pf` — Pessoa Física via Declaração IRPF (1 PDF)
- `/analise/pj` — Pessoa Jurídica via Balanços Patrimoniais (até 3 PDFs) ou
  Relatório de Faturamento 12 meses (1 PDF)
- `/preview` → `/resultado` — conferência dos dados extraídos, score,
  relatório A4 exportável em PDF, ajuste manual limitado (±200 pts, com
  justificativa e recálculo da banda de decisão)
- `/historico` — todas as análises, filtros, métricas e comparativo
- `/clientes` — CRM: cadastro (CPF/CNPJ validados com dígito verificador),
  ficha com histórico de análises vinculadas (`analises.cliente_id`), funil
- `/configuracoes` — pesos, faixas, bandas de decisão e parâmetros
  financeiros do motor (somente admin; persistido em `scoring_config`)

## Política de crédito

Metodologia, limiares e limitações documentados em
[CREDIT_POLICY.md](./CREDIT_POLICY.md). Pontos-chave:

- Campo não encontrado na extração = `null` (nunca `0`); `0` é valor legítimo
  (isento de IR, sem dívidas) e pontua normalmente
- Comprometimento de renda PF zera acima de **45%**
- Endividamento PJ zera acima de **70%** do ativo total
- Faixas e pesos editados em `/configuracoes` são aplicados de verdade no
  cálculo (config versionada — `configVersion`)

Segurança e RLS: ver [SECURITY.md](./SECURITY.md).

## Desenvolvimento

```sh
npm install
npm run dev      # dev server
npm test         # vitest (motor de scoring + validação de documentos)
npm run build    # build de produção
```

Deploy: push para `main` → Lovable publica automaticamente.
