// Mirrors the API currency catalog (docs/specs/06-currencies.md).
export const CURRENCIES = {
    BRL: { name: 'Real brasileiro', minorUnits: 2 },
    USD: { name: 'Dólar americano', minorUnits: 2 },
    EUR: { name: 'Euro', minorUnits: 2 },
    GBP: { name: 'Libra esterlina', minorUnits: 2 },
    CAD: { name: 'Dólar canadense', minorUnits: 2 },
    CHF: { name: 'Franco suíço', minorUnits: 2 },
    MXN: { name: 'Peso mexicano', minorUnits: 2 },
    AUD: { name: 'Dólar australiano', minorUnits: 2 },
    JPY: { name: 'Iene japonês', minorUnits: 0 },
    KRW: { name: 'Won sul-coreano', minorUnits: 0 },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

export function isCurrencyCode(code: string): code is CurrencyCode {
    return Object.hasOwn(CURRENCIES, code);
}
