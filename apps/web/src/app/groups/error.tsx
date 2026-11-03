'use client';

import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';

export default function GroupsError({ reset }: { error: Error; reset: () => void }) {
    return (
        <ErrorState
            message="Erro inesperado. Tente novamente em instantes."
            action={<Button onClick={reset}>Tentar novamente</Button>}
        />
    );
}
