import { z } from 'zod';
import { CURRENCIES, isCurrencyCode } from '@/lib/money/currencies';

// Mirrors the API rules (apps/api/src/modules/expenses/dto/expense.schemas.ts) in pt-BR.
const MAX_AMOUNT = 1_000_000_000;
const RATE_PATTERN = /^\d{1,10}(\.\d{1,8})?$/;

const memberId = z.uuid('Participante inválido.');

const amountMinor = z
  .number({ error: 'Informe o valor da despesa.' })
  .int('Informe um valor válido.')
  .min(1, 'O valor deve ser maior que zero.')
  .max(MAX_AMOUNT, 'O valor deve ser de no máximo 1.000.000.000 na menor unidade da moeda.');

const equalSplit = z
  .object({
    type: z.literal('EQUAL'),
    participantIds: z
      .array(memberId)
      .min(1, 'Selecione ao menos um participante.')
      .max(100, 'Selecione no máximo 100 participantes.'),
  })
  .strict();

const percentageSplit = z
  .object({
    type: z.literal('PERCENTAGE'),
    shares: z
      .array(
        z
          .object({
            memberId,
            basisPoints: z
              .number({ error: 'Informe a porcentagem de cada participante.' })
              .int()
              .min(1, 'Informe uma porcentagem maior que zero para cada participante.')
              .max(10_000, 'A porcentagem não pode passar de 100%.'),
          })
          .strict(),
      )
      .min(1, 'Selecione ao menos um participante.')
      .max(100),
  })
  .strict();

const fixedSplit = z
  .object({
    type: z.literal('FIXED'),
    shares: z
      .array(
        z
          .object({
            memberId,
            originalAmountMinor: z
              .number({ error: 'Informe o valor de cada participante.' })
              .int()
              .min(1, 'Informe um valor maior que zero para cada participante.')
              .max(MAX_AMOUNT, 'O valor deve ser de no máximo 1.000.000.000.'),
          })
          .strict(),
      )
      .min(1, 'Selecione ao menos um participante.')
      .max(100),
  })
  .strict();

const isoDate = z.string({ error: 'Informe a data.' }).refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}, 'Informe uma data válida.');

/**
 * Expense payload sent to the API. With `baseCurrency` the form also enforces the rate rules
 * (RN-CUR-03/04); Route Handlers omit it and let the API be the source of truth for them.
 */
export function buildExpensePayloadSchema(baseCurrency?: string) {
  return z
    .object({
      description: z
        .string({ error: 'Informe a descrição.' })
        .trim()
        .min(1, 'Informe a descrição.')
        .max(120, 'A descrição deve ter no máximo 120 caracteres.'),
      currency: z
        .string()
        .refine((value) => isCurrencyCode(value), 'Moeda não suportada.')
        .optional(),
      originalAmountMinor: amountMinor,
      exchangeRate: z.string().regex(RATE_PATTERN, 'Informe uma taxa de câmbio válida.').optional(),
      paidByMemberId: z.uuid('Escolha quem pagou.'),
      occurredOn: isoDate,
      split: z.discriminatedUnion('type', [equalSplit, percentageSplit, fixedSplit]),
    })
    .strict()
    .superRefine((value, ctx) => {
      if (baseCurrency === undefined) return;
      const foreign = (value.currency ?? baseCurrency) !== baseCurrency;
      const rate = value.exchangeRate;
      if (foreign && (rate === undefined || /^0+(\.0+)?$/.test(rate))) {
        ctx.addIssue({
          code: 'custom',
          path: ['exchangeRate'],
          message: 'Informe uma taxa de câmbio válida.',
        });
      }
    });
}

export type ExpensePayload = z.infer<ReturnType<typeof buildExpensePayloadSchema>>;

/** Currency codes accepted by `GET /exchange-rates` proxies. */
export const currencyCodeSchema = z.enum(Object.keys(CURRENCIES) as [string, ...string[]]);

export const exchangeRateQuerySchema = z.object({
  from: currencyCodeSchema,
  to: currencyCodeSchema,
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
