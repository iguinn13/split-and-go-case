import { describe, expect, it } from 'vitest';
import { AVATAR_PALETTE_SIZE, avatarSlot, initialsOf } from './avatar';

describe('initialsOf', () => {
  it('uses the first letter of the first and last words', () => {
    expect(initialsOf('Ana Souza')).toBe('AS');
    expect(initialsOf('maria da Silva Costa')).toBe('MC');
  });

  it('handles a single word, extra spaces, accents and empty names', () => {
    expect(initialsOf('Bruno')).toBe('B');
    expect(initialsOf('  carla   dias  ')).toBe('CD');
    expect(initialsOf('émerson')).toBe('É');
    expect(initialsOf('   ')).toBe('?');
  });
});

describe('avatarSlot', () => {
  it('is deterministic and ignores case and surrounding spaces', () => {
    expect(avatarSlot('Ana')).toBe(avatarSlot('Ana'));
    expect(avatarSlot('Ana')).toBe(avatarSlot('  ana '));
  });

  it('always returns a slot inside the palette', () => {
    for (const name of ['Ana', 'Bruno', 'Carla', '', 'Zé', 'a'.repeat(500)]) {
      const slot = avatarSlot(name);
      expect(slot).toBeGreaterThanOrEqual(1);
      expect(slot).toBeLessThanOrEqual(AVATAR_PALETTE_SIZE);
    }
  });

  it('spreads different names over several colours', () => {
    const slots = new Set(['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio'].map(avatarSlot));
    expect(slots.size).toBeGreaterThan(2);
  });
});
