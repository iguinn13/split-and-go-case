'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { applyFeedback } from '@/lib/settlement/feedback';

/**
 * Wraps the plan summary. After "Fechar grupo" or "Marcar como paga" refreshes the page, the
 * button that had focus no longer exists: this moves focus to the summary (the "x de y pagas"
 * line) and announces the result in a polite live region. The live region is always rendered so
 * the change of its text is announced.
 */
export function SettlementFeedback({
    groupId,
    summary,
    children,
}: {
    groupId: string;
    summary: string | null;
    children: ReactNode;
}) {
    const targetRef = useRef<HTMLDivElement>(null);
    const [message, setMessage] = useState('');

    useEffect(() => {
        // Run after the dialog (if any) finished unmounting and restored focus elsewhere.
        const frame = requestAnimationFrame(() => {
            applyFeedback({
                storage: window.sessionStorage,
                groupId,
                summary,
                target: targetRef.current,
                announce: setMessage,
            });
        });

        return () => cancelAnimationFrame(frame);
    }, [groupId, summary, children]);

    return (
        <>
            <div
                ref={targetRef}
                tabIndex={-1}
                data-testid="settlement-summary"
                className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
                {children}
            </div>
            <p role="status" className="sr-only" data-testid="settlement-announcement">
                {message}
            </p>
        </>
    );
}
