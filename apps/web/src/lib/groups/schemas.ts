import { z } from 'zod';

// Mirrors the API rules (apps/api/src/modules/groups/dto/group.schemas.ts) with pt-BR messages.
const optionalEmail = z
  .string()
  .trim()
  .max(254, 'O e-mail deve ter no máximo 254 caracteres.')
  .refine(
    (value) => value === '' || z.email().safeParse(value).success,
    'Informe um e-mail válido.',
  );

export const memberSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Informe o nome.')
    .max(60, 'O nome deve ter no máximo 60 caracteres.'),
  email: optionalEmail,
});

export const createGroupFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'O nome deve ter pelo menos 2 caracteres.')
      .max(80, 'O nome deve ter no máximo 80 caracteres.'),
    description: z.string().trim().max(500, 'A descrição deve ter no máximo 500 caracteres.'),
    baseCurrency: z.string().min(1, 'Escolha a moeda-base.'),
    members: z.array(memberSchema).max(50, 'Um grupo aceita no máximo 50 participantes.'),
  })
  .superRefine((value, ctx) => addDuplicateIssues(value.members, ctx));

export type MemberFormInput = z.infer<typeof memberSchema>;
export type CreateGroupFormInput = z.infer<typeof createGroupFormSchema>;

/** Flags repeated names (case-insensitive) and e-mails inside one member list (RN-GRP-03/04). */
function addDuplicateIssues(members: MemberFormInput[], ctx: z.RefinementCtx) {
  const names = new Set<string>();
  const emails = new Set<string>();
  members.forEach((member, index) => {
    const name = member.name.trim().toLowerCase();
    if (name) {
      if (names.has(name)) {
        ctx.addIssue({
          code: 'custom',
          path: ['members', index, 'name'],
          message: 'Já existe um participante com este nome.',
        });
      }
      names.add(name);
    }
    const email = member.email.trim().toLowerCase();
    if (email) {
      if (emails.has(email)) {
        ctx.addIssue({
          code: 'custom',
          path: ['members', index, 'email'],
          message: 'Já existe um participante com este e-mail.',
        });
      }
      emails.add(email);
    }
  });
}

/** Add-member form: also checks against the members already in the group. */
export function buildAddMemberSchema(existing: { name: string; email: string | null }[]) {
  return memberSchema.superRefine((value, ctx) => {
    const name = value.name.trim().toLowerCase();
    if (name && existing.some((m) => m.name.toLowerCase() === name)) {
      ctx.addIssue({
        code: 'custom',
        path: ['name'],
        message: 'Já existe um participante com este nome.',
      });
    }
    const email = value.email.trim().toLowerCase();
    if (email && existing.some((m) => m.email?.toLowerCase() === email)) {
      ctx.addIssue({
        code: 'custom',
        path: ['email'],
        message: 'Já existe um participante com este e-mail.',
      });
    }
  });
}

/** Maps a Zod error to `{ "a.b.c": first message }`. */
export function pathErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.');
    if (!(key in result)) result[key] = issue.message;
  }
  return result;
}

/** Payload for POST /groups: blank rows are dropped, empty optionals are omitted. */
export function toCreateGroupPayload(input: CreateGroupFormInput) {
  return {
    name: input.name,
    baseCurrency: input.baseCurrency,
    ...(input.description ? { description: input.description } : {}),
    members: input.members.map((m) => ({
      name: m.name,
      ...(m.email ? { email: m.email } : {}),
    })),
  };
}

/** Removes untouched blank rows from the dynamic list before validation. */
export function dropBlankMembers<T extends { name: string; email: string }>(members: T[]): T[] {
  return members.filter((m) => m.name.trim() !== '' || m.email.trim() !== '');
}
