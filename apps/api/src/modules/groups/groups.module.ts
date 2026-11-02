import { Module } from '@nestjs/common';
import { AddMemberUseCase } from './add-member.use-case.js';
import { CreateGroupUseCase } from './create-group.use-case.js';
import { GetGroupUseCase } from './get-group.use-case.js';
import { GroupAccessService } from './group-access.service.js';
import { GroupsController } from './groups.controller.js';
import { GroupsRepository } from './groups.repository.js';
import { ListGroupsUseCase } from './list-groups.use-case.js';
import { RemoveMemberUseCase } from './remove-member.use-case.js';
import { UpdateGroupUseCase } from './update-group.use-case.js';

@Module({
  controllers: [GroupsController],
  providers: [
    GroupsRepository,
    GroupAccessService,
    CreateGroupUseCase,
    ListGroupsUseCase,
    GetGroupUseCase,
    UpdateGroupUseCase,
    AddMemberUseCase,
    RemoveMemberUseCase,
  ],
  // Other modules import the access service, never the repository.
  exports: [GroupAccessService],
})
export class GroupsModule {}
