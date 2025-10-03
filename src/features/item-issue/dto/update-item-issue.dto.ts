import { PartialType } from '@nestjs/mapped-types';
import { CreateItemIssueDto } from './create-item-issue.dto';

export class UpdateItemIssueDto extends PartialType(CreateItemIssueDto) {}
