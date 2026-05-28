# Possible-Care — API externa de consulta de análises

API para consumo externo (CRM Vitatech). Permite consultar o status de uma análise de crédito pelo número de protocolo (`AC-XXX`).

## Endpoint

```
GET https://<SUPABASE_PROJECT>.functions.supabase.co/consultar-analise/{protocolo}
```

> Substitua `<SUPABASE_PROJECT>` pelo subdomínio do projeto Supabase (mesmo prefixo usado pelas demais edge functions).

Também aceita `?protocolo=AC-XXX` como query string, mas o caminho `/consultar-analise/{protocolo}` é a forma canônica.

## Autenticação

Envie a chave em **um** destes headers:

| Header | Exemplo |
|---|---|
| `Authorization` | `Authorization: Bearer pck_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `x-api-key` | `x-api-key: pck_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |

A chave é gerada pelos administradores no painel `/api-keys` da aplicação. Somente o **hash SHA-256** é armazenado no banco — o valor em claro só é exibido uma única vez na geração e precisa ser guardado em cofre de senhas.

Chaves possuem o prefixo fixo `pck_live_` e podem ser revogadas a qualquer momento pelo admin. Uma chave revogada passa a retornar `401`.

## Resposta — 200 OK

```json
{
  "numero_analise": "AC-XXXX",
  "status": "aprovado",
  "limite_aprovado": 50000.00,
  "parcelas_maximas": 24,
  "prazo_maximo_dias": 720,
  "validade_analise": "2026-08-25",
  "observacoes": "",
  "cliente_consultado": "12345678900"
}
```

| Campo | Tipo | Notas |
|---|---|---|
| `numero_analise` | string | Mesmo protocolo `AC-XXX` consultado. |
| `status` | `"aprovado"` \| `"reprovado"` \| `"pendente"` \| `"expirado"` | Mapeado a partir da decisão e da validade. |
| `limite_aprovado` | number | 0 quando expirado/reprovado. Reflete o limite aprovado pelo analista (ou o sugerido se ainda não houve ajuste). |
| `parcelas_maximas` | number | 0 quando expirado/reprovado. |
| `prazo_maximo_dias` | number | `parcelas_maximas * 30`. |
| `validade_analise` | string (YYYY-MM-DD) \| null | Data até a qual a análise é considerada vigente. |
| `observacoes` | string | Conteúdo da justificativa de ajuste manual da liberação, quando houver. |
| `cliente_consultado` | string \| null | Documento (CPF/CNPJ) do cliente analisado. |

### Mapeamento de status

| Decisão interna | Resposta |
|---|---|
| `CRÉDITO APROVADO` | `aprovado` |
| `APROVADO COM RESSALVAS` | `aprovado` |
| `CRÉDITO REPROVADO` (qualquer variante) | `reprovado` |
| `ANÁLISE INCONCLUSIVA — DADOS INSUFICIENTES` | `pendente` |

Quando `today > validade_analise`, a resposta é sobrescrita: `status = "expirado"`, `limite_aprovado = 0`, `parcelas_maximas = 0`.

## Códigos de erro

| Status | Quando ocorre | Corpo |
|---|---|---|
| `400` | Protocolo ausente na URL. | `{ "error": "Protocolo ausente. Use /consultar-analise/{protocolo}." }` |
| `401` | API key ausente, malformada, inválida ou revogada. | `{ "error": "API key inválida ou revogada." }` |
| `404` | Protocolo não encontrado. | `{ "error": "Análise não encontrada." }` |
| `500` | Erro inesperado no servidor. | `{ "error": "Erro ao consultar análise." }` |

Todas as tentativas (sucesso ou erro) ficam registradas em `consultas_api` com data, IP de origem, status HTTP, resposta e key utilizada. Logs podem ser auditados em `/api-keys` (aba "Logs de consulta").

## Exemplo de uso

```bash
curl -i \
  -H "Authorization: Bearer pck_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  https://<SUPABASE_PROJECT>.functions.supabase.co/consultar-analise/AC-A1B2C3
```

```bash
# alternativa com header x-api-key
curl -i \
  -H "x-api-key: pck_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  "https://<SUPABASE_PROJECT>.functions.supabase.co/consultar-analise?protocolo=AC-A1B2C3"
```

## Notas para o time do CRM Vitatech

- **Cache:** a resposta pode ser cacheada localmente por curtos períodos, mas sempre revalidar antes de aprovar a venda — `status` pode mudar quando o analista revisa.
- **`expirado` significa renovar a análise:** o cliente precisa passar por um novo ciclo no Possible-Care antes que possa ser aprovado novamente.
- **Tratamento sugerido por status:**
  - `aprovado` → seguir com o pedido respeitando `limite_aprovado` e `parcelas_maximas`.
  - `reprovado` → bloquear a venda a prazo.
  - `pendente` → sinalizar para o vendedor solicitar à área de crédito a conclusão da análise.
  - `expirado` → exigir nova análise.
- **Rate limiting:** não há throttle explícito na edge function, mas o backend e a IA por trás têm limites próprios — consultas em laço devem ser evitadas. Para dashboards, prefira uma única consulta por protocolo por evento.
- **Rotacionar chaves periodicamente:** o painel `/api-keys` permite revogar e gerar nova chave a qualquer momento. Atualize o segredo no CRM antes de revogar a antiga.
- **Em caso de 401 inesperado:** confirme com o admin se a chave não foi revogada e se está sendo enviada exatamente como exibida no momento da geração (sem espaços extras).
