import { Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error.js';
import { GroupAccessService } from '../groups/group-access.service.js';
import type { TransferView } from './dto/settlement.schemas.js';
import { toTransferView } from './settlement-plan.mapper.js';
import { SettlementsRepository } from './settlements.repository.js';

@Injectable()
export class PayTransferUseCase {
    constructor(
        private readonly access: GroupAccessService,
        private readonly settlements: SettlementsRepository,
    ) {}

    async execute(userId: string, groupId: string, transferId: string): Promise<TransferView> {
        // Owner or linked member may pay (RN-BAL-14).
        const group = await this.access.assertCanRead(groupId, userId);

        if (group.status !== 'CLOSED') {
            throw new AppError('GROUP_NOT_CLOSED', 409, 'Group is not closed');
        }

        const transfer = await this.settlements.markPaid(groupId, transferId);

        if (!transfer) throw new AppError('TRANSFER_NOT_FOUND', 404, 'Transfer not found');

        return toTransferView(transfer, new Map(group.members.map((m) => [m.id, m.name])));
    }
}
