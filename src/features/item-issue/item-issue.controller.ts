import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ItemIssueService } from './item-issue.service';
import { CreateItemIssueDto } from './dto/create-item-issue.dto';
import { UpdateItemIssueDto } from './dto/update-item-issue.dto';

@Controller('item-issue')
export class ItemIssueController {
  constructor(private readonly itemIssueService: ItemIssueService) {}

  @Post()
  create(@Body() createItemIssueDto: CreateItemIssueDto) {
    return this.itemIssueService.create(createItemIssueDto);
  }

  @Get()
  findAll() {
    return this.itemIssueService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.itemIssueService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateItemIssueDto: UpdateItemIssueDto) {
    return this.itemIssueService.update(+id, updateItemIssueDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.itemIssueService.remove(+id);
  }
}
