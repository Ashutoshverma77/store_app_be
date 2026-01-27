import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { StoreScrapService } from './store-scrap.service';
import {
  CreateStoreScrapDto,
  UpdateStoreScrapDto,
} from './dto/create-store-scrap.dto';
import { StoreScrapGateway } from './store-scrap.gateway';

@Controller('api/store/itemscrap')
export class StoreScrapController {
  constructor(
    private readonly storeScrapService: StoreScrapService,
    private readonly gateway: StoreScrapGateway,
  ) {}

  @Post()
  async create(@Body() createStoreScrapDto: CreateStoreScrapDto) {

    await this.storeScrapService.create(createStoreScrapDto);
    this.gateway.broadcastAllScrapList().catch(() => {});
    return { status: true, msg: 'Scrap Added successfully' };
  }

  @Get()
  findAll() {
    return this.storeScrapService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.storeScrapService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateStoreScrapDto: UpdateStoreScrapDto,
  ) {
    return this.storeScrapService.update(+id, updateStoreScrapDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.storeScrapService.remove(+id);
  }
}
