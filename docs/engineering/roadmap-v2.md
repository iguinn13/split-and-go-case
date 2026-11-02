# Proposta de Evolução do Produto — V2

Itens priorizados por impacto no negócio. Cada um explica o problema, a proposta e o impacto esperado.

## Melhorias de negócio

### 1. Multi-moeda com taxa de câmbio por despesa

- **Problema:** Viagens internacionais misturam moedas. No MVP, o usuário precisa converter manualmente fora do app.
- **Proposta:** Cada despesa registra moeda, taxa e valor convertido para a moeda-base do grupo (snapshot imutável). A taxa é sugerida por uma API de câmbio (com cache) e pode ser ajustada manualmente. Respeita as casas decimais de cada moeda (ISO 4217).
- **Impacto no negócio:** Abre o público de viagens internacionais, o caso de uso de maior ticket e frequência. Reduz o atrito mais citado em apps concorrentes e diferencia o produto na proposta de "moedas diferentes".
- **Preparação já feita no MVP:** valores em centavos inteiros e campo `currency` no grupo (ADR 0001).

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
