// issue.controller.ts
import { Body, Controller, Param, Post, Put } from '@nestjs/common';
import { IssueService } from './store-item-issue.service';
import {
  IssueOneLineDto,
  IssueBulkDto,
  ReturnBulkDto,
  ReturnLineDto,
} from './dto/create-store-item-issue.dto';
import { StoreNewItemGateway } from '../store-item/store-item.gateway';
import { IssueGateway } from './store-item-issue.gateway';

@Controller('api/store/issues')
export class IssueController {
  constructor(
    private readonly s: IssueService,
    private readonly gateway: StoreNewItemGateway,
    private readonly issuegateway: IssueGateway,
  ) {}

  @Post('draft')
  async createDraft(@Body() dto: any) {
    // console.log(dto);

    // return;
    const issue = await this.s.createDraftBulk(dto);
    this.gateway.broadcastAllList().catch(() => {});
    this.gateway.broadcastAllScrapList().catch(() => {});
    this.issuegateway.broadcastAllIssueList().catch(() => {});
    return { status: true, msg: 'Draft created', data: issue };
  }

  @Put(':id/approve')
  async approve(@Param('id') id: string, @Body() dto: any) {
    await this.s.approveIssueBulk(id, dto);
    this.gateway.broadcastAllList().catch(() => {});
    this.gateway.broadcastAllScrapList().catch(() => {});
    this.issuegateway.broadcastAllIssueList().catch(() => {});
    return { status: true, msg: 'Approved' };
  }

  @Post(':id/lines/:itemId/approve')
  async approveLine(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: any,
  ) {
    // console.log(id);
    // console.log(itemId);
    // console.log(dto);

    const out = await this.s.approveIssueLine(id, itemId, dto);
    this.gateway.broadcastAllList().catch(() => {});
    this.gateway.broadcastAllScrapList().catch(() => {});
    this.issuegateway.broadcastAllIssueList().catch(() => {});
    return { status: true, msg: 'Line approved', data: out };
  }

  @Put(':id/issue-line')
  async issueLine(@Param('id') id: string, @Body() dto: any) {
    // console.log(dto);

    const data = await this.s.issueLine(id, dto);
    this.gateway.broadcastAllList().catch(() => {});
    this.gateway.broadcastAllScrapList().catch(() => {});
    this.issuegateway.broadcastAllIssueList().catch(() => {});
    return { status: true, msg: 'Issued', data };
  }

  @Put(':id/issue-bulk')
  async issueBulk(@Param('id') id: string, @Body() dto: IssueBulkDto) {
    const data = await this.s.issueBulk(id, dto);
    this.gateway.broadcastAllList().catch(() => {});
    this.gateway.broadcastAllScrapList().catch(() => {});
    this.issuegateway.broadcastAllIssueList().catch(() => {});
    return { status: true, msg: 'Issued', data };
  }

  @Post(':id/issue')
  async issue(@Param('id') id: string, @Body() dto: any) {
    await this.s.issueApproved(id, dto);
    this.gateway.broadcastAllList().catch(() => {});
    this.gateway.broadcastAllScrapList().catch(() => {});
    this.issuegateway.broadcastAllIssueList().catch(() => {});
    return { status: true, msg: 'Issued' };
  }

  @Post(':id/return')
  async returnItem(@Param('id') id: string, @Body() dto: any) {
    await this.s.returnAgainstAllocation(id, dto);
    this.gateway.broadcastAllList().catch(() => {});
    this.gateway.broadcastAllScrapList().catch(() => {});
    this.issuegateway.broadcastAllIssueList().catch(() => {});
    return { status: true, msg: 'Returned' };
  }

  @Put(':id/return-line')
  async returnLine(@Param('id') id: string, @Body() dto: any) {
    const data = await this.s.returnLine(id, dto);
    this.gateway.broadcastAllList().catch(() => {});
    this.gateway.broadcastAllScrapList().catch(() => {});
    this.issuegateway.broadcastAllIssueList().catch(() => {});
    return { status: true, msg: 'Returned', data };
  }

  @Put(':id/return-bulk')
  async returnBulk(@Param('id') id: string, @Body() dto: any) {
    const data = await this.s.returnBulk(id, dto);
    this.gateway.broadcastAllList().catch(() => {});
    this.gateway.broadcastAllScrapList().catch(() => {});
    this.issuegateway.broadcastAllIssueList().catch(() => {});
    return { status: true, msg: 'Returned bulk', data };
  }
}
