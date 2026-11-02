import { describe, expect, it } from 'vitest';
import { findDuplicateMemberFields } from './member-uniqueness.js';

const path = (index: number) => `members.${index}.`;

describe('findDuplicateMemberFields', () => {
  it('returns nothing for distinct members', () => {
    expect(
      findDuplicateMemberFields(
        [{ name: 'Ana', email: 'ana@x.dev' }],
        [
          { name: 'Bia', email: null },
          { name: 'Caio', email: null },
        ],
        path,
      ),
    ).toEqual([]);
  });

  it('flags names equal ignoring case, including the existing ones', () => {
    const details = findDuplicateMemberFields(
      [{ name: 'Ana', email: null }],
      [
        { name: 'ANA', email: null },
        { name: 'bia', email: null },
        { name: 'Bia', email: null },
      ],
      path,
    );
    expect(details.map((d) => d.path)).toEqual(['members.0.name', 'members.2.name']);
  });

  it('flags repeated emails but ignores missing ones', () => {
    const details = findDuplicateMemberFields(
      [{ name: 'Ana', email: 'ana@x.dev' }],
      [
        { name: 'Bia', email: 'ANA@x.dev' },
        { name: 'Caio', email: null },
        { name: 'Duda', email: null },
      ],
      path,
    );
    expect(details).toEqual([{ path: 'members.0.email', message: 'Duplicate member email' }]);
  });
});
