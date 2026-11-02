# Spec 06 — Moedas e Câmbio

## Contexto

Grupos de viagem misturam moedas: o hotel é pago em euros, o jantar em reais, o passeio em dólares. Cada grupo tem uma **moeda-base** e cada despesa pode ser lançada em **qualquer moeda suportada**. O sistema converte para a moeda-base no momento do lançamento, guarda a taxa usada (snapshot) e faz todo o rateio, saldo e liquidação na moeda-base.

## User stories

- **US-CUR-01** — Como organizador, quero escolher a moeda-base do grupo (padrão BRL).
- **US-CUR-02** — Como participante, quero lançar uma despesa na moeda em que paguei, sem converter manualmente.
- **US-CUR-03** — Como participante, quero ver a taxa sugerida e poder ajustá-la, para refletir o câmbio que realmente paguei.
- **US-CUR-04** — Como participante, quero ver em cada despesa o valor original, a taxa e o valor convertido.

## Moedas suportadas

Catálogo único em `common/money/currencies.ts`, com `code`, `name` e `minorUnits` (casas decimais, ISO 4217):

| Código | Moeda | Casas | Código | Moeda | Casas |
|---|---|---|---|---|---|
| BRL | Real brasileiro | 2 | CHF | Franco suíço | 2 |
| USD | Dólar americano | 2 | MXN | Peso mexicano | 2 |
| EUR | Euro | 2 | AUD | Dólar australiano | 2 |
| GBP | Libra esterlina | 2 | JPY | Iene japonês | **0** |
| CAD | Dólar canadense | 2 | KRW | Won sul-coreano | **0** |

Todas existem no provedor de sugestão de câmbio. Adicionar uma moeda é uma linha no catálogo (e, se necessário, no provedor).

## Requisitos funcionais

| ID | Requisito |
|---|---|
| RF-CUR-01 | `GET /currencies` retorna o catálogo (`code`, `name`, `minorUnits`). |
| RF-CUR-02 | `GET /exchange-rates?from=USD&to=BRL&date=2026-07-10` retorna a taxa sugerida (`date` opcional, padrão hoje). |
| RF-CUR-03 | Toda despesa guarda `currency`, `originalAmountMinor`, `exchangeRate` e `amountMinor` (convertido, na moeda-base). |
| RF-CUR-04 | A interface pré-preenche a taxa com a sugestão (na data da despesa) e permite editá-la. |
| RF-CUR-05 | Saldos, extratos, partes e plano de liquidação são expressos na moeda-base do grupo. |

## Regras de negócio

| ID | Regra |
|---|---|
| RN-CUR-01 | **Taxa:** quanto vale 1 unidade da moeda da despesa, em unidades da moeda-base. Ex.: `5.4325` em USD→BRL significa US$ 1,00 = R$ 5,4325. |
| RN-CUR-02 | `exchangeRate` é texto decimal positivo, `^\d{1,10}(\.\d{1,8})?$`, até 8 casas. Nunca `float`. |
| RN-CUR-03 | Se `currency` é igual à moeda-base, a taxa é `1`. Se enviada, precisa ser `1`; senão `422 EXCHANGE_RATE_INVALID`. |
| RN-CUR-04 | Se `currency` difere da moeda-base, `exchangeRate` é **obrigatória** na criação e na edição da despesa. O servidor não busca a taxa por conta própria: o que o usuário viu e confirmou é o que fica registrado. |
| RN-CUR-05 | **Conversão:** `amountMinor = arredondarMeioParaCima(originalAmountMinor × taxa × 10^(casasBase − casasOrigem))`, calculada com `BigInt` (taxa escalada por 10⁸). |
| RN-CUR-06 | O valor convertido deve estar entre `1` e `1.000.000.000` unidades mínimas; fora disso `422 AMOUNT_OUT_OF_RANGE`. Valor original também respeita o limite superior. |
| RN-CUR-07 | A taxa é **snapshot imutável** da despesa: não muda quando o câmbio muda. Só muda se a despesa for editada. |
| RN-CUR-08 | O rateio é feito pela alocação proporcional por maior resto (`03-expenses.md`), tanto no valor original quanto no convertido. A soma das partes convertidas é **sempre** igual ao `amountMinor` da despesa. |
| RN-CUR-09 | A moeda-base do grupo não muda depois de criado. |
| RN-CUR-10 | **Sugestão de taxa:** vem de um provedor externo (BCE, via Frankfurter), com cache em memória por par e data (1 h, no máximo 500 entradas; chamadas simultâneas da mesma chave compartilham uma só consulta ao provedor). A data aceita vai de 1999-01-04 até amanhã em UTC. Mesma moeda retorna `1` sem chamar o provedor. |
| RN-CUR-11 | Falha ou indisponibilidade do provedor retorna `503 EXCHANGE_RATE_UNAVAILABLE`; o usuário informa a taxa manualmente e a despesa segue normalmente. |
| RN-CUR-12 | O plano de liquidação é sempre na moeda-base (liquidar em outras moedas é V2). |

## Exemplos

| Moeda-base | Despesa | Taxa | Convertido |
|---|---|---|---|
| BRL | US$ 100,00 (`10000`) | 5.4325 | R$ 543,25 (`54325`) |
| BRL | ¥ 5.000 (`5000`, JPY 0 casas) | 0.0345 | R$ 172,50 (`17250`) |
| BRL | € 33,33 (`3333`) | 6.0712 | R$ 202,35 (`20235`: 3333 × 6,0712 = 20235,3096 → arredonda para baixo) |
| USD | R$ 100,00 (`10000`) | 0.1841 | US$ 18,41 (`1841`) |
| JPY | US$ 10,00 (`1000`) | 157.25 | ¥ 1.573 (`1573`: 10 × 157,25 = 1572,5 → meio para cima) |

Valores conferidos com aritmética `BigInt`; viram casos de teste de `convertAmount`.

## Critérios de aceite

### AC-CUR-01 — Catálogo de moedas
- **Quando** chamo `GET /currencies`
- **Então** recebo as 10 moedas com `code`, `name` e `minorUnits` (JPY e KRW com `0`).

### AC-CUR-02 — Despesa em moeda estrangeira
- **Dado** um grupo em BRL
- **Quando** lanço US$ 100,00 (`originalAmountMinor = 10000`, `currency = USD`, `exchangeRate = "5.4325"`)
- **Então** a despesa guarda valor original `10000`, taxa `5.43250000` e `amountMinor = 54325`, e os saldos são calculados em reais.

### AC-CUR-03 — Moeda sem casas decimais
- **Quando** lanço ¥ 5.000 (`originalAmountMinor = 5000`, `currency = JPY`) com taxa `0.0345` em grupo BRL
- **Então** `amountMinor = 17250` (R$ 172,50).

### AC-CUR-04 — Arredondamento da conversão
- **Quando** a conversão resulta em fração da menor unidade (ex.: `1572,5` ienes)
- **Então** o valor é arredondado meio para cima (`1573`) e o resultado é o mesmo em toda execução.

### AC-CUR-05 — Taxa obrigatória
- **Quando** lanço despesa em moeda diferente da base sem `exchangeRate`
- **Então** recebo `422 EXCHANGE_RATE_INVALID`.

### AC-CUR-06 — Taxa inválida
- **Quando** `exchangeRate` é `0`, negativa, com mais de 8 casas, notação científica ou texto não numérico
- **Então** recebo `422 EXCHANGE_RATE_INVALID`.

### AC-CUR-07 — Mesma moeda com taxa diferente de 1
- **Quando** `currency` é igual à moeda-base e `exchangeRate` é diferente de `1`
- **Então** recebo `422 EXCHANGE_RATE_INVALID`; sem `exchangeRate`, a taxa registrada é `1` e a API a devolve como `"1.00000000"` (8 casas, como toda taxa gravada).

### AC-CUR-08 — Moeda não suportada
- **Quando** envio `currency = "XYZ"`
- **Então** recebo `422 VALIDATION_ERROR`.

### AC-CUR-09 — Soma das partes convertidas
- **Dado** uma despesa em moeda estrangeira com rateio `EQUAL`, `PERCENTAGE` ou `FIXED`
- **Então** a soma das partes (na moeda-base) é exatamente igual ao `amountMinor` da despesa, e a soma das partes originais é igual ao `originalAmountMinor`.

### AC-CUR-10 — Snapshot imutável
- **Dado** uma despesa criada com taxa `5.4325`
- **Quando** o câmbio de mercado muda
- **Então** a despesa e os saldos continuam usando `5.4325`, até que a despesa seja editada.

### AC-CUR-11 — Valor fora do limite
- **Quando** o valor convertido é `0` (valor minúsculo com taxa muito baixa) ou maior que `1.000.000.000`
- **Então** recebo `422 AMOUNT_OUT_OF_RANGE`.

### AC-CUR-12 — Sugestão de taxa
- **Quando** chamo `GET /exchange-rates?from=USD&to=BRL`
- **Então** recebo `{ from, to, rate, date, source }` com `rate` em texto decimal.
- **E** com `from = to`, recebo `rate = "1"` sem chamada externa.

### AC-CUR-13 — Provedor indisponível
- **Dado** que o provedor de câmbio falha ou excede o tempo limite
- **Quando** peço a sugestão de taxa
- **Então** recebo `503 EXCHANGE_RATE_UNAVAILABLE` e ainda consigo lançar a despesa informando a taxa manualmente.

### AC-CUR-14 — Grupo em outra moeda-base
- **Dado** um grupo com `baseCurrency = USD`
- **Quando** lanço R$ 100,00 (BRL) com taxa `0.1841`
- **Então** `amountMinor = 1841` e saldos e plano são expressos em USD.
