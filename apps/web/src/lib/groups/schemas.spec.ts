import { describe, expect, it } from 'vitest';
import {
  buildAddMemberSchema,
  createGroupFormSchema,
  dropBlankMembers,
  pathErrors,
  toCreateGroupPayload,
} from './schemas';

const valid = {
  name: 'Viagem Floripa',
  description: '',
  baseCurrency: 'BRL',
  members: [
    { name: 'Bia', email: '' },
    { name: 'Caio', email: 'caio@example.com' },
  ],
};

describe('createGroupFormSchema', () => {
  it('accepts a valid group and optional e-mails', () => {
    expect(createGroupFormSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects short names and invalid e-mails with pt-BR messages', () => {
    const result = createGroupFormSchema.safeParse({
      ...valid,
      name: 'A',
      members: [{ name: 'Bia', email: 'nope' }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = pathErrors(result.error);
      expect(errors['name']).toBe('O nome deve ter pelo menos 2 caracteres.');
      expect(errors['members.0.email']).toBe('Informe um e-mail válido.');
    }
  });

  it('flags duplicate names ignoring case and duplicate e-mails', () => {
    const result = createGroupFormSchema.safeParse({
      ...valid,
      members: [
        { name: 'Bia', email: 'a@x.com' },
        { name: 'bia', email: 'A@x.com' },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = pathErrors(result.error);
      expect(errors['members.1.name']).toBe('Já existe um participante com este nome.');
      expect(errors['members.1.email']).toBe('Já existe um participante com este e-mail.');
    }
  });

  it('rejects more than 50 members and long member names', () => {
    const many = Array.from({ length: 51 }, (_, i) => ({ name: `P${i}`, email: '' }));
    expect(createGroupFormSchema.safeParse({ ...valid, members: many }).success).toBe(false);
    expect(
      createGroupFormSchema.safeParse({ ...valid, members: [{ name: 'x'.repeat(61), email: '' }] })
        .success,
    ).toBe(false);
  });
});

describe('buildAddMemberSchema', () => {
  const schema = buildAddMemberSchema([{ name: 'Ana', email: 'ana@example.com' }]);

  it('rejects names and e-mails already in the group', () => {
    const result = schema.safeParse({ name: 'ANA', email: 'ana@example.com' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(Object.keys(pathErrors(result.error))).toEqual(['name', 'email']);
    }
  });

  it('accepts a new member without e-mail', () => {
    expect(schema.safeParse({ name: 'Edu', email: '' }).success).toBe(true);
  });
});

describe('payload helpers', () => {
  it('omits empty optional fields', () => {
    const parsed = createGroupFormSchema.parse(valid);
    expect(toCreateGroupPayload(parsed)).toEqual({
      name: 'Viagem Floripa',
      baseCurrency: 'BRL',
      members: [{ name: 'Bia' }, { name: 'Caio', email: 'caio@example.com' }],
    });
  });

  it('drops blank rows only', () => {
    expect(
      dropBlankMembers([
        { name: '', email: '' },
        { name: ' ', email: '' },
        { name: 'Bia', email: '' },
        { name: '', email: 'x@y.com' },
      ]),
    ).toHaveLength(2);
  });
});
