# Segurança — Possible Care

Estado da postura de segurança e pontos que exigem atenção operacional.

## Autenticação e autorização

- Login por email/senha via Supabase Auth; todas as rotas (exceto `/login` e
  `/reset-password`) exigem sessão (`AuthGuard`).
- Papel de admin: coluna `profiles.is_admin`, verificada **no servidor** pela
  função `public.is_current_user_admin()` (SECURITY DEFINER, search_path fixo).
- **Escalonamento de privilégio corrigido** (migration 20260702002205): a
  política `profiles_update_own` tem `WITH CHECK` impedindo que um usuário
  comum grave `is_admin = true` no próprio perfil.

## RLS (Row Level Security)

Todas as tabelas de dados têm RLS ativo. Modelo vigente desde 02/jul/2026:

- `analises`, `clientes`, `bureaus`: SELECT/UPDATE restritos a
  **dono (`created_by`) ou admin**.
- `scoring_config`, `politicas_credito`, `api_keys`, `sugestoes_config`:
  escrita restrita a admin.

> **Decisão de produto pendente:** o modelo anterior permitia que toda a
> equipe autenticada visse clientes e análises. As migrations de 02/jul
> (geradas pelo Lovable) mudaram para dono-ou-admin. Se o fluxo da equipe
> exigir visão compartilhada, é preciso decidir conscientemente e ajustar as
> políticas — hoje um analista NÃO vê análises criadas por colegas.

## Edge function `extract-pdf`

- Valida payload: máx. 40 páginas por análise, máx. ~3 MB por imagem base64,
  prompt limitado a 20k caracteres — contém abuso de créditos de IA.
- CORS permanece `*` (necessário para o preview do Lovable).
- **Verificar no dashboard do Supabase que `verify_jwt` está HABILITADO** para
  esta function (Settings → Edge Functions). O código não impõe autenticação
  própria; sem verify_jwt, qualquer pessoa na internet pode consumir créditos.
- Não há rate limiting além do repasse do 429 do gateway — considerar limite
  por usuário se o uso crescer.

## Chaves e segredos

- `.env` commitado contém apenas a **publishable/anon key** do Supabase —
  projetada para uso público no client (a segurança real vem do RLS). Padrão
  do Lovable; não é vazamento.
- `LOVABLE_API_KEY` vive apenas como secret da edge function (server-side).
- Nenhuma senha hardcoded no frontend (o antigo fallback de senha de admin em
  `scoringConfig.ts` foi removido; o gate real é RLS).

## Dados pessoais (LGPD)

`clientes` e `analises.extracted_data` contêm PII sensível (CPF, renda,
patrimônio, IRPF completo). Recomendações:

- Restringir quem é admin (admin lê tudo).
- Definir política de retenção/expurgo para `extracted_data` (hoje o JSON
  integral do IRPF fica no banco por tempo indeterminado).
- Habilitar Point-in-Time Recovery/backups no projeto Supabase.
