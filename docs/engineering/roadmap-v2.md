# Proposta de Evolução do Produto — V2

Itens priorizados por impacto no negócio. Cada um explica o problema, a proposta e o impacto esperado.

## Melhorias de negócio

### 1. Liquidação em múltiplas moedas e câmbio no dia do pagamento

- **Problema:** No MVP, o plano de liquidação é sempre na moeda-base. Em viagens internacionais, parte do grupo prefere pagar na moeda local ou em outra moeda, e a conversão no dia do pagamento muda o valor real.
- **Proposta:** Permitir que cada transferência seja paga em outra moeda, com a taxa do dia sugerida e registrada, e mostrar a diferença cambial frente ao valor planejado. Ampliar o catálogo de moedas (ARS, CLP e outras) e permitir taxas históricas por despesa em lote.
- **Impacto no negócio:** Resolve a última etapa de atrito em viagens internacionais (o caso de maior ticket e frequência) e diferencia o produto de apps que só somam valores. Reduz disputas sobre "quanto vale esse valor hoje".
- **Preparação já feita no MVP:** snapshot de taxa por despesa, catálogo de moedas com casas decimais e `ExchangeRateProvider` (ADR 0006).

### 2. Convites por link e notificações

- **Problema:** Hoje o organizador precisa cadastrar os participantes e só quem tem conta enxerga o grupo.
- **Proposta:** Link de convite (e e-mail) com entrada em um clique; notificações de nova despesa, lembrete de pagamento e confirmação de recebimento.
- **Impacto no negócio:** Aumenta a ativação e a retenção, com loop viral (cada grupo traz de 3 a 10 novos usuários). Lembretes aceleram a quitação, que é o momento de valor do produto.

### 3. Pagamento integrado (Pix) e conciliação

- **Problema:** O plano de liquidação diz quem paga quem, mas o pagamento acontece fora do app e é marcado manualmente.
- **Proposta:** Gerar QR Code/cópia e cola Pix com valor e destinatário de cada transferência; confirmar o pagamento automaticamente via webhook do provedor.
- **Impacto no negócio:** Fecha o ciclo do produto, aumenta a confiança no resultado e abre uma linha de receita (tarifa por transação ou plano premium).

## Novas funcionalidades

### A. Recibos e anexos com OCR

Foto da nota fiscal anexada à despesa, com extração automática de valor, data e estabelecimento para pré-preencher o formulário.

- **Impacto:** Reduz o esforço de lançamento (principal causa de abandono em apps de rateio) e dá transparência e prova em caso de contestação.

### B. Despesas recorrentes e categorias com relatórios

Despesas recorrentes (aluguel, contas de casa) e categorias (alimentação, transporte, hospedagem) com relatórios por pessoa e por período.

- **Impacto:** Amplia o uso de viagens (esporádico) para repúblicas e casais (mensal), aumentando retenção e receita recorrente. Os relatórios dão visibilidade de gastos e justificam um plano premium.

## Melhorias técnicas associadas

- Refresh token com rotação e revogação.
- Trilha de auditoria de despesas (edições e exclusões).
- Reabertura de grupo fechado com recálculo do plano.
- Fila de mensagens (notificações e webhooks) e armazenamento de objetos (anexos), reavaliando o ADR 0005.
- Observabilidade: métricas, tracing e alertas.
