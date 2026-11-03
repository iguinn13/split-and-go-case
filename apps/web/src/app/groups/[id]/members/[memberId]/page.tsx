import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BalanceAmount } from '@/components/balances/balance-amount';
import { Avatar } from '@/components/ui/avatar';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { ApiError, errorMessage } from '@/lib/api';
import { serverApi } from '@/lib/api/server';
import { balanceStatus, balancesHref, magnitude } from '@/lib/balances/status';
import type { Statement } from '@/lib/balances/types';
import { conversionLine, formatDate } from '@/lib/expenses/format';
import { isUuid } from '@/lib/http/guard';
import { formatMoney } from '@/lib/money/format-money';

export default async function StatementPage({
    params,
}: {
    params: Promise<{ id: string; memberId: string }>;
}) {
    const { id, memberId } = await params;

    // Malformed ids never reach the API.
    if (!isUuid(id) || !isUuid(memberId)) notFound();

    let statement: Statement;

    try {
        statement = await serverApi<Statement>(`/groups/${id}/members/${memberId}/statement`);
    } catch (error) {
        if (!(error instanceof ApiError)) throw error;

        // 404 covers unknown member and groups the user is not part of.
        if (error.statusCode === 404 || error.statusCode === 422) notFound();

        return (
            <ErrorState
                title="Não foi possível carregar o extrato"
                message={errorMessage(error.code)}
                action={
                    <Link
                        href={`/groups/${id}/members/${memberId}`}
                        className={buttonVariants({ variant: 'secondary' })}
                    >
                        Tentar novamente
                    </Link>
                }
            />
        );
    }

    const { currency, member, totals, lines } = statement;

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title={`Extrato de ${member.name}`}
                backHref={balancesHref(id)}
                backLabel="Voltar aos saldos"
            />

            <section
                aria-label="Resumo do extrato"
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card"
            >
                <div className="flex items-center gap-3">
                    <Avatar name={member.name} size="lg" decorative />
                    <div className="min-w-0 flex-1">
                        <p className="text-sm text-muted-foreground">Saldo final</p>
                        <p className="break-words font-semibold">{member.name}</p>
                    </div>
                    <BalanceAmount netMinor={totals.netMinor} currency={currency} />
                </div>
                <dl className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
                    <div>
                        <dt className="text-muted-foreground">Total pago</dt>
                        <dd className="font-semibold">{formatMoney(totals.paidMinor, currency)}</dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground">Total devido</dt>
                        <dd className="font-semibold">{formatMoney(totals.owedMinor, currency)}</dd>
                    </div>
                </dl>
            </section>

            {lines.length === 0 ? (
                <EmptyState
                    title="Nenhuma despesa neste extrato"
                    description="Este participante ainda não pagou nem deve em nenhuma despesa."
                />
            ) : (
                <ol className="flex flex-col gap-2" aria-label="Linhas do extrato">
                    {lines.map((line) => {
                        const result = balanceStatus(line.netMinor);

                        return (
                            <li
                                key={line.expenseId}
                                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-card"
                            >
                                <div>
                                    <p className="break-words font-semibold">{line.description}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {formatDate(line.occurredOn)}
                                    </p>
                                    {line.original ? (
                                        <p className="mt-1 break-words rounded-lg bg-muted px-2 py-1 text-sm text-muted-foreground">
                                            {conversionLine(
                                                line.original,
                                                line.amountMinor,
                                                currency,
                                            )}
                                        </p>
                                    ) : null}
                                </div>
                                <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm sm:grid-cols-4">
                                    <Cell
                                        label="Pago"
                                        value={formatMoney(line.paidMinor, currency)}
                                    />
                                    <Cell
                                        label="Devido"
                                        value={formatMoney(line.owedMinor, currency)}
                                    />
                                    <Cell
                                        label="Resultado"
                                        value={`${result.icon} ${formatMoney(magnitude(line.netMinor), currency)}`}
                                        srValue={`${result.label} ${formatMoney(magnitude(line.netMinor), currency)}`}
                                        className={result.textClass}
                                    />
                                    <Cell
                                        label="Saldo acumulado"
                                        value={formatMoney(line.runningBalanceMinor, currency)}
                                        strong
                                    />
                                </dl>
                            </li>
                        );
                    })}
                </ol>
            )}
        </div>
    );
}

function Cell({
    label,
    value,
    srValue,
    className,
    strong = false,
}: {
    label: string;
    value: string;
    /** Spoken text when the visible value is a sign + amount. */
    srValue?: string;
    className?: string;
    strong?: boolean;
}) {
    return (
        <div className="min-w-0">
            <dt className="text-muted-foreground">{label}</dt>
            <dd
                className={`break-words ${strong ? 'font-bold' : 'font-medium'} ${className ?? ''}`}
            >
                {srValue ? (
                    <>
                        <span aria-hidden="true">{value}</span>
                        <span className="sr-only">{srValue}</span>
                    </>
                ) : (
                    value
                )}
            </dd>
        </div>
    );
}
