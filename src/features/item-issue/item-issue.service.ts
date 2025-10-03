import { Injectable } from '@nestjs/common';
import { CreateItemIssueDto } from './dto/create-item-issue.dto';
import { UpdateItemIssueDto } from './dto/update-item-issue.dto';

@Injectable()
export class ItemIssueService {
  create(createItemIssueDto: CreateItemIssueDto) {
    return 'This action adds a new itemIssue';
  }

  findAll() {
    return `This action returns all itemIssue`;
  }

  findOne(id: number) {
    return `This action returns a #${id} itemIssue`;
  }

  update(id: number, updateItemIssueDto: UpdateItemIssueDto) {
    return `This action updates a #${id} itemIssue`;
  }

  remove(id: number) {
    return `This action removes a #${id} itemIssue`;
  }
}
