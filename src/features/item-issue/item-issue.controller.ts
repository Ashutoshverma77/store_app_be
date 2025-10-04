import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
} from '@nestjs/common';
import { IssueService } from './item-issue.service';
import { CreateItemIssueDto } from './dto/create-item-issue.dto';
import { UpdateItemIssueDto } from './dto/update-item-issue.dto';
import { ItemIssueGateway } from './item-issue.gateway';

@Controller('/api/store')
export class ItemIssueController {
  constructor(
    private readonly itemIssueService: IssueService,
    private readonly gateway: ItemIssueGateway,
  ) {}

  @Post('issue')
  async create(@Body() payload: any) {
    // console.log(payload);
    // return;
    var data = await this.itemIssueService.createIssue(payload);
    this.gateway.broadcastAuthList().catch(() => {});
    return data;
  }

  @Get()
  findAll() {
    return this.itemIssueService.findAll();
  }

  // @Get(':id')
  // findOne(@Param('id') id: string) {
  //   return this.itemIssueService.findOne(+id);
  // }

  @Put('Issue/:id')
  async update(@Body() payload: any) {
    var data = await this.itemIssueService.update(payload);
    this.gateway.broadcastAuthList().catch(() => {});
    return data;
  }

  // @Delete('Issuedelete/:id')
  // remove(@Param('id') id: string) {
  //   return this.itemIssueService.remove(+id);
  // }

  @Put('Issueapprove/:id')
  async approveReceive(@Param('id') id: string, @Body() payload: any) {
    var data = await this.itemIssueService.approveIssue(payload);
    this.gateway.broadcastAuthList().catch(() => {});
    return data;
  }

  @Put('Issuetoplace')
  async Issuetoplace(@Body() payload: any) {
    var data = await this.itemIssueService.issueFromPlace(payload);
    this.gateway.broadcastAuthList().catch(() => {});
    return data;
  }

  @Put('returnItemIssue')
  async returnToStock(@Body() payload: any) {
    console.log(payload);
    var data = await this.itemIssueService.returnToStock(payload);
    this.gateway.broadcastAuthList().catch(() => {});
    return data;
  }

  @Put('issuereject')
  async issueReject(@Body() payload: any) {
    console.log(payload);
    var data = await this.itemIssueService.rejectIssue(payload);
    this.gateway.broadcastAuthList().catch(() => {});
    return data;
  }

  // @Delete(':id')
  // remove(@Param('id') id: string) {
  //   return this.itemIssueService.remove(+id);
  // }
}
