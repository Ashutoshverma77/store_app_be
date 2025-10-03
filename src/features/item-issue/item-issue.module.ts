import { Module } from '@nestjs/common';
import { ItemIssueService } from './item-issue.service';
import { ItemIssueController } from './item-issue.controller';
import { ItemIssueGateway } from './item-issue.gateway';

@Module({
  controllers: [ItemIssueController],
  providers: [ItemIssueService, ItemIssueGateway],
})
export class ItemIssueModule {}
