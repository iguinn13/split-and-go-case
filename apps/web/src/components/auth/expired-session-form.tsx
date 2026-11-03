'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Ends a session the API has already rejected: posts to the logout handler (a POST, so a
 * link from another site can never trigger it) and falls back to a button without JS.
 */
export function ExpiredSessionForm() {
    const form = useRef<HTMLFormElement>(null);
    const submitted = useRef(false);

    useEffect(() => {
        if (submitted.current) return;

        submitted.current = true;
        form.current?.requestSubmit();
    }, []);

    return (
        <form ref={form} action="/api/auth/logout" method="post" className="flex flex-col gap-3">
            <p>Sua sessão expirou. Você será levado para a tela de entrada.</p>
            <Button type="submit" className="self-start">
                Entrar novamente
            </Button>
        </form>
    );
}
