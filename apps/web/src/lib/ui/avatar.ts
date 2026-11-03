/** Pure helpers behind the Avatar component. */

export const AVATAR_PALETTE_SIZE = 8;

/** Up to two initials: first letter of the first and of the last word ("Ana Souza" -> "AS"). */
export function initialsOf(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);

    if (words.length === 0) return '?';

    const first = Array.from(words[0]!)[0]!;
    const last = words.length > 1 ? Array.from(words[words.length - 1]!)[0]! : '';

    return (first + last).toLocaleUpperCase('pt-BR');
}

/** Deterministic palette slot (1..8) for a name, so the same person always gets the same colour. */
export function avatarSlot(name: string): number {
    const key = name.trim().toLocaleLowerCase('pt-BR');
    let hash = 0;

    for (const char of key) hash = (Math.imul(hash, 31) + char.codePointAt(0)!) >>> 0;

    return (hash % AVATAR_PALETTE_SIZE) + 1;
}
