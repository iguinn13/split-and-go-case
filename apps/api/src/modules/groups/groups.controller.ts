import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/zod/zod-validation.pipe.js';
import { AddMemberUseCase } from './add-member.use-case.js';
import { CreateGroupUseCase } from './create-group.use-case.js';
import {
  type CreateGroupInput,
  type GroupSummaryView,
  type GroupView,
  type MemberInput,
  type MemberView,
  type UpdateGroupInput,
  createGroupSchema,
  groupIdParamsSchema,
  memberInputSchema,
  memberParamsSchema,
  updateGroupSchema,
} from './dto/group.schemas.js';
import { GetGroupUseCase } from './get-group.use-case.js';
import { ListGroupsUseCase } from './list-groups.use-case.js';
import { RemoveMemberUseCase } from './remove-member.use-case.js';
import { UpdateGroupUseCase } from './update-group.use-case.js';

type GroupParams = { groupId: string };
type MemberParams = { groupId: string; memberId: string };

const groupParams = new ZodValidationPipe<GroupParams>(groupIdParamsSchema);

@Controller('groups')
export class GroupsController {
  constructor(
    private readonly createGroup: CreateGroupUseCase,
    private readonly listGroups: ListGroupsUseCase,
    private readonly getGroup: GetGroupUseCase,
    private readonly updateGroup: UpdateGroupUseCase,
    private readonly addMember: AddMemberUseCase,
    private readonly removeMember: RemoveMemberUseCase,
  ) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createGroupSchema)) body: CreateGroupInput,
  ): Promise<GroupView> {
    return this.createGroup.execute(user.id, body);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<GroupSummaryView[]> {
    return this.listGroups.execute(user.id);
  }

  @Get(':groupId')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param(groupParams) params: GroupParams,
  ): Promise<GroupView> {
    return this.getGroup.execute(user.id, params.groupId);
  }

  @Patch(':groupId')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param(groupParams) params: GroupParams,
    @Body(new ZodValidationPipe(updateGroupSchema)) body: UpdateGroupInput,
  ): Promise<GroupView> {
    return this.updateGroup.execute(user.id, params.groupId, body);
  }

  @Post(':groupId/members')
  add(
    @CurrentUser() user: AuthenticatedUser,
    @Param(groupParams) params: GroupParams,
    @Body(new ZodValidationPipe(memberInputSchema)) body: MemberInput,
  ): Promise<MemberView> {
    return this.addMember.execute(user.id, params.groupId, body);
  }

  @Delete(':groupId/members/:memberId')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe<MemberParams>(memberParamsSchema)) params: MemberParams,
  ): Promise<void> {
    return this.removeMember.execute(user.id, params.groupId, params.memberId);
  }
}
