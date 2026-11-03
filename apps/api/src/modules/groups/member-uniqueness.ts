import type { ErrorDetail } from '../../common/errors/app-error.js';

export interface MemberIdentity {
    name: string;
    email: string | null;
}

/**
 * Pure check of RN-GRP-03 and RN-GRP-04: names are unique ignoring case and
 * emails (already normalized) are unique. `existing` members come first and
 * `incoming` ones are reported with `pathPrefix` + their index.
 */
export function findDuplicateMemberFields(
    existing: readonly MemberIdentity[],
    incoming: readonly MemberIdentity[],
    pathPrefix: (index: number) => string,
): ErrorDetail[] {
    const names = new Set(existing.map((member) => member.name.toLowerCase()));
    const emails = new Set(
        existing.flatMap((member) => (member.email ? [member.email.toLowerCase()] : [])),
    );
    const details: ErrorDetail[] = [];

    incoming.forEach((member, index) => {
        const name = member.name.toLowerCase();

        if (names.has(name)) {
            details.push({ path: `${pathPrefix(index)}name`, message: 'Duplicate member name' });
        }

        names.add(name);

        if (member.email) {
            const email = member.email.toLowerCase();

            if (emails.has(email)) {
                details.push({
                    path: `${pathPrefix(index)}email`,
                    message: 'Duplicate member email',
                });
            }

            emails.add(email);
        }
    });

    return details;
}
