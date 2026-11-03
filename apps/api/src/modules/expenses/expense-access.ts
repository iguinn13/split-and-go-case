import { AppError } from '../../common/errors/app-error.js';
import type { GroupWithMembers } from '../groups/groups.repository.js';

export function assertGroupOpen(group: GroupWithMembers): void {
    if (group.status === 'CLOSED') throw new AppError('GROUP_CLOSED', 409, 'Group is closed');
}

/** Expenses need at least 2 members (RN-EXP-13). */
export function assertCanHaveExpenses(group: GroupWithMembers): void {
    assertGroupOpen(group);

    if (group.members.length < 2) {
        throw new AppError('GROUP_NEEDS_MORE_MEMBERS', 409, 'Group needs at least 2 members');
    }
}

/** Only the creator of the expense or the group owner can edit or delete it (RN-EXP-10). */
export function assertCanModify(
    group: GroupWithMembers,
    expense: { createdByUserId: string },
    userId: string,
): void {
    if (expense.createdByUserId !== userId && group.ownerId !== userId) {
        throw new AppError(
            'FORBIDDEN',
            403,
            'Only the expense creator or the group owner can do this',
        );
    }
}
