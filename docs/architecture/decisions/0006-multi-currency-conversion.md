# ADR 0006 — Multi-moeda: conversão por despesa com taxa registrada

- **Status:** Aceita
- **Contexto:** Grupos de viagem misturam moedas. É preciso rateio exato, saldos que fecham em zero e resultados reproduzíveis, mesmo que o câmbio de mercado mude depois.
- **Decisão:**
  1. Cada grupo tem uma **moeda-base** (padrão BRL, imutável). Saldos, extratos, partes e plano de liquidação estão sempre nela.
  2. Cada despesa guarda um **snapshot**: `currency`, `originalAmountMinor`, `exchangeRate` e `amountMinor` (convertido). A taxa nunca é recalculada depois.
  3. **Conversão:** `amountMinor = round_half_up(originalAmountMinor × taxa × 10^(casasBase − casasOrigem))`, em `BigInt`, com a taxa escalada por 10⁸. Função pura `convertAmount`.
  4. **Rateio** por uma única regra de alocação proporcional por maior resto (`allocateProportionally`), aplicada ao valor original e ao valor convertido com os **mesmos pesos**. As duas somas são exatas, então o invariante "soma dos saldos = 0" vale sem ajustes extras.
  5. **Taxa:** o cliente sempre envia a taxa (obrigatória quando a moeda difere da base). O servidor não busca a taxa sozinho, para que o que o usuário viu e confirmou seja o que fica registrado.
  6. **Sugestão de taxa:** `GET /exchange-rates` consulta um provedor externo (Frankfurter, taxas do BCE) por par e data, com cache em memória de 1 h. A falha do provedor (`503 EXCHANGE_RATE_UNAVAILABLE`) nunca bloqueia o lançamento: o usuário digita a taxa.
  7. **`ExchangeRateProvider` é uma interface** (única do MVP): fronteira externa, com implementação real e falsa nos testes. Justificativa conforme a constituição, seção 2.4.
  8. **Liquidação** na moeda-base. Liquidar em outras moedas é V2.
- **Alternativas consideradas:**
  - Converter só na hora de exibir: saldos mudariam com o câmbio e a liquidação não seria reproduzível.
  - Converter cada parte separadamente: a soma das partes convertidas pode diferir do total convertido por centavos, quebrando o invariante.
  - Servidor buscar a taxa na criação: cria dependência de disponibilidade e resultados que o usuário não viu.
  - Apenas taxa manual: pior experiência; mantemos a edição manual como fallback.
- **Consequências:**
  - Despesas em moeda estrangeira têm duas alocações e dois conjuntos de partes persistidos.
  - O catálogo de moedas é a fonte única de casas decimais, no back-end (`GET /currencies`) e no front.
  - Testes de propriedade cobrem soma exata nas duas moedas, e os exemplos de `specs/06-currencies.md` são casos de teste de `convertAmount`.
