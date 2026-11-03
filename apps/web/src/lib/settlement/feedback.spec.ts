import { describe, expect, it, vi } from 'vitest';
import {
    announcementFor,
    EVENT_TTL_MS,
    applyFeedback,
    FEEDBACK_KEY,
    rememberEvent,
    takeEvent,
    type EventStorage,
} from './feedback';

function fakeStorage(initial: Record<string, string> = {}): EventStorage & {
    data: Map<string, string>;
} {
    const data = new Map(Object.entries(initial));

    return {
        data,
        getItem: (key) => data.get(key) ?? null,
        setItem: (key, value) => void data.set(key, value),
        removeItem: (key) => void data.delete(key),
    };
}

describe('rememberEvent / takeEvent', () => {
    it('round-trips an event once and clears it', () => {
        const storage = fakeStorage();

        rememberEvent(storage, { type: 'group-closed', groupId: 'g1' });
        expect(takeEvent(storage, 'g1')).toEqual({ type: 'group-closed', groupId: 'g1' });
        expect(takeEvent(storage, 'g1')).toBeNull();
    });

    it('keeps events that belong to another group', () => {
        const storage = fakeStorage();

        rememberEvent(storage, { type: 'transfer-paid', groupId: 'g2', sentence: 'A paga B' });
        expect(takeEvent(storage, 'g1')).toBeNull();
        expect(storage.data.has(FEEDBACK_KEY)).toBe(true);
        expect(takeEvent(storage, 'g2')?.type).toBe('transfer-paid');
    });

    it('discards corrupted or malformed payloads instead of throwing', () => {
        for (const raw of ['{not json', '42', 'null', '{"type":"x","groupId":"g1"}']) {
            const storage = fakeStorage({ [FEEDBACK_KEY]: raw });

            expect(takeEvent(storage, 'g1')).toBeNull();
            expect(storage.data.has(FEEDBACK_KEY)).toBe(false);
        }
    });

    it('does not throw when the storage is unavailable', () => {
        const broken: EventStorage = {
            getItem: () => {
                throw new Error('denied');
            },
            setItem: () => {
                throw new Error('denied');
            },
            removeItem: () => {
                throw new Error('denied');
            },
        };

        expect(() => rememberEvent(broken, { type: 'group-closed', groupId: 'g' })).not.toThrow();
        expect(takeEvent(broken, 'g')).toBeNull();
    });
});

describe('event TTL', () => {
    it('ignores and clears events older than the TTL', () => {
        const storage = fakeStorage();

        rememberEvent(storage, { type: 'group-closed', groupId: 'g1' }, 1_000);
        expect(takeEvent(storage, 'g1', 1_000 + EVENT_TTL_MS + 1)).toBeNull();
        expect(storage.data.has(FEEDBACK_KEY)).toBe(false);
    });

    it('accepts an event right inside the TTL', () => {
        const storage = fakeStorage();

        rememberEvent(storage, { type: 'group-closed', groupId: 'g1' }, 1_000);
        expect(takeEvent(storage, 'g1', 1_000 + EVENT_TTL_MS)?.type).toBe('group-closed');
    });

    it('discards legacy payloads without a timestamp', () => {
        const storage = fakeStorage({
            [FEEDBACK_KEY]: JSON.stringify({ type: 'group-closed', groupId: 'g1' }),
        });

        expect(takeEvent(storage, 'g1')).toBeNull();
    });
});

describe('announcementFor', () => {
    it('announces the closing with the paid summary', () => {
        expect(announcementFor({ type: 'group-closed', groupId: 'g' }, '0 de 3 pagas')).toBe(
            'Grupo fechado. O plano de quitação está fixo. 0 de 3 pagas.',
        );
    });

    it('announces the closing of a group without transfers', () => {
        expect(announcementFor({ type: 'group-closed', groupId: 'g' }, null)).toBe(
            'Grupo fechado. O plano de quitação está fixo.',
        );
    });

    it('announces a paid transfer with the new summary', () => {
        expect(
            announcementFor(
                { type: 'transfer-paid', groupId: 'g', sentence: 'Duda paga R$ 50,00 para Ana' },
                '1 de 2 pagas',
            ),
        ).toBe('Transferência marcada como paga: Duda paga R$ 50,00 para Ana. 1 de 2 pagas.');
    });
});

describe('applyFeedback', () => {
    it('focuses the target and announces once', () => {
        const storage = fakeStorage();

        rememberEvent(storage, { type: 'group-closed', groupId: 'g' });
        const target = { focus: vi.fn() };
        const announce = vi.fn();
        const args = { storage, groupId: 'g', summary: '0 de 1 pagas', target, announce };

        expect(applyFeedback(args)).toBe(true);
        expect(target.focus).toHaveBeenCalledTimes(1);
        expect(announce).toHaveBeenCalledWith(
            'Grupo fechado. O plano de quitação está fixo. 0 de 1 pagas.',
        );

        // A later re-render with the same props does nothing.
        expect(applyFeedback(args)).toBe(false);
        expect(target.focus).toHaveBeenCalledTimes(1);
    });

    it('does nothing without a pending event', () => {
        const target = { focus: vi.fn() };
        const announce = vi.fn();

        expect(
            applyFeedback({
                storage: fakeStorage(),
                groupId: 'g',
                summary: null,
                target,
                announce,
            }),
        ).toBe(false);
        expect(target.focus).not.toHaveBeenCalled();
        expect(announce).not.toHaveBeenCalled();
    });
});
