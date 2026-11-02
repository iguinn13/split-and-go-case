# Spec 00 — Visão do Produto

## Problema

Grupos de pessoas que dividem gastos (viagens, repúblicas, eventos) perdem tempo e geram atrito para saber **quem deve quanto a quem**. Planilhas e anotações manuais erram arredondamentos, não lidam bem com divisões desiguais e resultam em muitas transferências desnecessárias no acerto final.

## Proposta de valor

O **Split&Go** permite que um grupo registre despesas conforme acontecem, divida cada uma de forma flexível e, no fim, receba o **menor número possível de transferências** para zerar todas as dívidas.

## Personas

| Persona | Necessidade |
|---|---|
| **Organizador** (dono do grupo) | Criar o grupo, cadastrar participantes, acompanhar saldos e fechar o grupo no fim. |
| **Participante** | Lançar despesas que pagou, ver o quanto deve ou tem a receber e saber exatamente quem paga quem. |
| **Convidado** | Participa do rateio sem ter conta (apenas nome). Quem organiza lança por ele. |

## Escopo do MVP

Dentro do escopo:

- Cadastro e login (e-mail/senha, JWT) — `01-auth.md`
- Grupos com múltiplos participantes — `02-groups-and-members.md`
- Despesas pagas por 1 pessoa e divididas por N, com rateio igualitário, por porcentagem ou por valor fixo — `03-expenses.md`
- **Múltiplas moedas:** grupo com moeda-base, despesas em outras moedas com taxa de câmbio registrada e sugestão automática de taxa — `03-expenses.md`, `06-currencies.md`
- Saldo por participante e algoritmo de simplificação de dívidas — `04-balances-and-settlement.md`
- Painel de quitação: extrato individual, plano final de liquidação e fechamento do grupo — `05-settlement-dashboard.md`
- Execução local com Docker Compose

Fora do escopo do MVP (ver `engineering/roadmap-v2.md`):

- Liquidação em moedas diferentes da moeda-base e câmbio na data do pagamento
- Convite por link/e-mail, notificações, recibos com foto
- Pagamento integrado (Pix etc.)
- Recuperação de senha, login social
- Aplicativo móvel nativo

## Glossário

| Termo | Definição |
|---|---|
| **Grupo** | Conjunto de participantes que compartilham despesas. Está `OPEN` ou `CLOSED`. |
| **Participante** (member) | Pessoa dentro de um grupo. Pode estar vinculada a um usuário (com conta) ou ser convidada (só nome). |
| **Despesa** | Gasto pago por um participante e dividido entre N participantes. |
| **Rateio** (split) | Regra que define quanto cada participante deve em uma despesa: `EQUAL`, `PERCENTAGE` ou `FIXED`. |
| **Moeda-base** | Moeda do grupo (padrão BRL). Saldos, partes e plano de liquidação são expressos nela. |
| **Taxa de câmbio** | Quanto vale 1 unidade da moeda da despesa na moeda-base. Registrada em cada despesa (snapshot imutável). |
| **Menor unidade** (minor unit) | Menor fração da moeda: centavo em BRL/USD/EUR; iene em JPY (0 casas decimais). |
| **Parte** (share) | Valor, na moeda-base, que um participante deve em uma despesa. |
| **Saldo** (balance) | `total pago − total devido` de um participante. Positivo = tem a receber; negativo = deve. |
| **Plano de liquidação** | Lista mínima de transferências `de → para → valor` que zera todos os saldos. |
| **Fechamento** | Congela o grupo (sem novas despesas) e persiste o plano de liquidação. |

## Requisitos não funcionais

| ID | Requisito |
|---|---|
| RNF-01 | A aplicação sobe localmente com um único comando (`docker compose up`). |
| RNF-02 | Precisão monetária exata: nenhum cálculo (inclusive conversão cambial) usa ponto flutuante. |
| RNF-03 | Cálculo de saldo e plano de liquidação para um grupo de até 50 participantes e 1.000 despesas responde em menos de 1 segundo. |
| RNF-04 | Todas as entradas da API são validadas e retornam erros no contrato padrão. |
| RNF-05 | Interface responsiva (uso primário em celular durante viagens). |
| RNF-06 | Código, lint e testes automatizados rodam no CI a cada PR. |
| RNF-07 | A indisponibilidade do provedor de câmbio nunca impede lançar despesas: a taxa pode ser informada manualmente. |

## Critérios de sucesso do MVP

1. Um organizador cria um grupo com 4 participantes, lança despesas com os 3 tipos de rateio (inclusive em moeda estrangeira) e fecha o grupo em menos de 5 minutos.
2. Para qualquer conjunto de despesas válido, a soma dos saldos é exatamente `0` e o plano de liquidação zera todos os saldos.
3. O plano usa o menor número de transferências possível para grupos de até 16 participantes com saldo diferente de zero.
