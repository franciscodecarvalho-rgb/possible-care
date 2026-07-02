# Política de Crédito — Possible Care

Documento de referência da metodologia de pontuação implementada em
`src/lib/creditScoring.ts`, com parâmetros configuráveis em `/configuracoes`
(persistidos na tabela `scoring_config` do Supabase, gated por admin via RLS).

## Visão geral

- Score de **0 a 1000**, calculado a partir de dados extraídos por IA
  (Gemini 2.5 Flash via Lovable AI Gateway) de documentos PDF.
- Decisão por bandas (padrão): **≥ 750** aprovado · **500–749** aprovado com
  ressalvas · **300–499** reprovado · **< 300** reprovado, risco elevado.
- Parcela estimada pela **Tabela Price** com taxa configurável
  (padrão 2,0% a.m.) sobre o valor e prazo solicitados.
- **Semântica de dados ausentes**: a extração retorna `null` para campos não
  encontrados. `0` é sempre valor legítimo (isento de IR, sem dívidas). Critério
  sem dado rende 0 pontos com o motivo explícito no relatório; se a maioria dos
  campos-chave estiver ausente (limiar configurável, padrão 50%), a análise é
  marcada **INCONCLUSIVA — DADOS INSUFICIENTES**.
- As **faixas (ranges)** e **pesos** de cada critério vêm da configuração e são
  aplicados diretamente no cálculo. Configs salvas antes do versionamento
  (`configVersion < 2`) têm suas faixas descartadas em favor das faixas padrão
  atuais (os pesos são preservados), pois eram decorativas na versão anterior
  do motor.

## Pessoa Física (via Declaração IRPF)

| Critério | Peso padrão | Métrica | Faixas padrão |
|---|---|---|---|
| Comprometimento de Renda | 250 | parcela ÷ renda mensal | <25% =100% · 25–35% =72% · 35–45% =36% · **>45% = 0** |
| Evolução Patrimonial | 200 | Δ patrimônio ÷ renda anual | <0 =0 · 0–5% =10% · 5–10% =40% · 10–20% =75% · >20% =100% |
| Patrimônio vs Renda | 150 | bens ÷ renda anual | <0,5x =7% · 0,5–1x =33% · 1–2x =67% · >2x =100% |
| Endividamento | 150 | dívidas ÷ patrimônio | 0 =100% · <30% =67% · 30–60% =33% · >60% =0 |
| Estabilidade de Renda | 100 | nº e tipo de fontes | única =60% · múltiplas =80% · múltiplas+dividendos =100% |
| Posse de Bens Reais | 100 | imóvel/veículo | nenhum =0 · veículo =40% · imóvel =60% · ambos =100% |
| Coerência Tributária | 50 | alíquota × imposto | coerente =100% · inconsistente =0. **Isento legítimo (alíquota 0 e imposto 0) é coerente.** |

**Justificativa do limiar de 45%:** a prática de mercado (regra 28/36) limita o
serviço total de dívidas a ~36% da renda; o BCB acompanha comprometimento
acima de 50% como indicador de superendividamento. Zerar em 45% mantém margem
prudencial, considerando que o modelo ainda não soma dívidas pré-existentes
(ver Limitações).

## Pessoa Jurídica

Dois caminhos documentais; critérios inaplicáveis ao documento enviado são
excluídos e os pesos restantes **redistribuídos proporcionalmente para somar
1000** (nota metodológica no relatório).

| Critério | Peso padrão | Aplicável a | Faixas padrão |
|---|---|---|---|
| Liquidez Corrente (AC/PC) | 150 | balanços | <1,0 =0 · 1,0–1,2 =47% · 1,2–1,5 =80% · >1,5 =100%. **PC = 0 com AC > 0 ⇒ 100%** |
| Evolução Faturamento | 150 | faturamento | queda =0 · estável =40% · 0–10% =67% · >10% =100% (meses reordenados cronologicamente) |
| Margem de Lucro (LL/RB) | 150 | balanços | <0 =0 · 0–3% =13% · 3–8% =40% · 8–15% =73% · >15% =100% |
| Endividamento ((PC+PNC)/AT) | 150 | balanços | <40% =100% · 40–60% =67% · 60–70% =27% · **>70% = 0** |
| Comprometimento Crédito/PL | 100 | balanços | <30% =100% · 30–60% =60% · 60–100% =20% · >100% =0 |
| Regularidade Faturamento (CV) | 100 | faturamento | <15% =100% · 15–30% =70% · 30–50% =30% · >50% =0 |
| Tempo de Mercado | 100 | ambos | <1a =0 · 1–3a =20% · 3–5a =40% · 5–10a =70% · >10a =100% |
| PL Positivo/Crescente | 50 | balanços | negativo =0 · positivo em queda =50% · positivo e crescente =100% |
| Diversificação de Receitas | 50 | ambos | concentrada =20% · moderada =60% · diversificada =100% |

**Justificativa do limiar de 70% de endividamento:** índices setoriais
(Serasa Experian) situam o endividamento geral médio de PMEs entre 50–65% do
ativo; acima de 70% a estrutura de capital é considerada comprometida para
absorver nova dívida.

## Ajuste manual

O analista pode ajustar o score em até **±200 pontos**, com justificativa
obrigatória gravada como nota de auditoria no relatório e no banco. A banda de
decisão é **recalculada** após o ajuste. Ajustes maiores exigem nova análise.

## Limitações conhecidas (leia antes de confiar no score)

1. **Dívidas pré-existentes não entram no comprometimento de renda** — o
   cálculo é `parcela nova ÷ renda`, sem somar parcelas já contratadas.
2. **Nenhuma consulta a bureau** (Serasa/SPC/SCR) compõe o score. As tabelas
   `bureaus`/`consultas_api` existem no banco, mas o módulo não foi implementado.
3. **PJ usa apenas o último balanço** para liquidez/margem/endividamento
   (o penúltimo só para tendência do PL), embora o formulário peça 3 exercícios.
4. **A taxa da PMT é um parâmetro global**, não a taxa real da operação.
5. **Critérios customizados** de `/configuracoes` são anotação de política —
   ainda não são calculados pelo motor (e por isso não entram na soma de 1000).
6. Sinais qualitativos ("múltiplas fontes", "possui imóvel") vêm da extração
   por IA sem verificação de valor, ônus ou liquidez do bem.

O relatório final registra: *"Este relatório constitui ferramenta auxiliar de
análise. A decisão final sobre a concessão de crédito é de exclusiva
responsabilidade do analista."*
