export interface ApiErrorDetail {
    path: string;
    message: string;
}

export class ApiError extends Error {
    constructor(
        readonly statusCode: number,
        readonly code: string,
        message: string,
        readonly details: ApiErrorDetail[] = [],
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

const FALLBACK = 'Erro inesperado. Tente novamente em instantes.';

const MESSAGES: Record<string, string> = {
    UNAUTHORIZED: 'Sua sessão expirou. Entre novamente.',
    INVALID_CREDENTIALS: 'E-mail ou senha incorretos.',
    FORBIDDEN: 'Você não tem permissão para fazer isso.',
    NOT_FOUND: 'Recurso não encontrado.',
    GROUP_NOT_FOUND: 'Grupo não encontrado.',
    MEMBER_NOT_FOUND: 'Participante não encontrado.',
    EXPENSE_NOT_FOUND: 'Despesa não encontrada.',
    TRANSFER_NOT_FOUND: 'Transferência não encontrada.',
    EMAIL_ALREADY_IN_USE: 'Este e-mail já está em uso.',
    GROUP_CLOSED: 'Este grupo está fechado e não aceita alterações.',
    GROUP_NOT_CLOSED: 'Feche o grupo antes de realizar esta operação.',
    GROUP_NEEDS_MORE_MEMBERS: 'O grupo precisa de pelo menos 2 participantes.',
    MEMBER_HAS_EXPENSES: 'Este participante possui despesas e não pode ser removido.',
    VALIDATION_ERROR: 'Verifique os dados informados.',
    INVALID_SPLIT_PARTICIPANTS: 'Pagador ou participantes inválidos.',
    SPLIT_PERCENTAGE_SUM_INVALID: 'A soma das porcentagens deve ser 100%.',
    SPLIT_FIXED_SUM_INVALID: 'A soma dos valores deve ser igual ao total.',
    EXCHANGE_RATE_INVALID: 'Taxa de câmbio inválida.',
    AMOUNT_OUT_OF_RANGE: 'Valor fora do intervalo permitido.',
    EXCHANGE_RATE_UNAVAILABLE:
        'Não foi possível obter a taxa de câmbio agora. Informe-a manualmente.',
    NETWORK_ERROR: 'Não foi possível conectar ao servidor. Tente novamente.',
    INTERNAL_ERROR: FALLBACK,
};

export function errorMessage(code: string): string {
    return MESSAGES[code] ?? FALLBACK;
}
